"use server";

import { revalidatePath } from "next/cache";

import { requireOwner, requireStaff } from "@/lib/auth/session";
import { assertCapability, hasCapability } from "@/lib/auth/permissions";
import {
  completeSaleSchema,
  expenseSchema,
  inventoryItemSchema,
  inventoryMovementSchema,
  loyaltyAdjustmentSchema,
  OperationsError,
  operationsSettingsSchema,
  recipeSchema,
  reconciliationSchema,
  voidExpenseSchema,
  voidSaleSchema,
} from "@/lib/operations/domain";
import { storeReceipt } from "@/lib/operations/receipts";
import {
  adjustLoyalty,
  completeSale,
  reconcileMpesa,
  recordExpense,
  recordInventoryMovement,
  saveInventoryItem,
  saveOperationsSettings,
  saveRecipe,
  voidExpense,
  voidSale,
} from "@/lib/operations/service";

export type OperationsActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

function parseJsonField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function optionalString(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeKenyanPhone(value: FormDataEntryValue | null) {
  const phone = optionalString(value)?.replace(/[\s()-]/g, "");
  return phone?.startsWith("0") ? `+254${phone.slice(1)}` : phone;
}

function parseSettlementRows(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const rows = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [receiptNumber, amountKes, localDate] = line.split(",").map((part) => part.trim());
      return {
        receiptNumber,
        amountKes,
        settledAt: localDate ? new Date(`${localDate.replace(" ", "T")}:00+03:00`) : undefined,
      };
    });
  return rows;
}

function validationMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Please review the submitted values.";
}

function actionFailure(error: unknown): OperationsActionResult {
  if (error instanceof OperationsError) return { ok: false, message: error.message };
  console.error("Operations action failed", error);
  return { ok: false, message: "The operation could not be completed. Please try again." };
}

function refreshOperations() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/operations");
}

export async function completeSaleAction(
  formData: FormData,
): Promise<OperationsActionResult<Awaited<ReturnType<typeof completeSale>>>> {
  const staff = await requireStaff();
  assertCapability(staff.user.role, "record_sale");
  const parsed = completeSaleSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
    items:
      (parseJsonField(formData.get("items")) as
        | { itemId?: string; menuItemId?: string; quantity: number }[]
        | undefined)?.map((item) => ({
        menuItemId: item.menuItemId ?? item.itemId,
        quantity: item.quantity,
      })),
    discountKind:
      formData.get("discountType") === "fixed"
        ? "fixed_kes"
        : formData.get("discountType") === "percent"
          ? "percent"
          : optionalString(formData.get("discountKind")),
    discountValue: optionalString(formData.get("discountValue")),
    discountLabel: optionalString(formData.get("discountLabel")),
    paymentMethod:
      formData.get("paymentMethod") === "mpesa"
        ? "mpesa_buy_goods"
        : formData.get("paymentMethod"),
    paymentAmountKes: optionalString(formData.get("paymentAmountKes")),
    mpesaReceiptNumber:
      optionalString(formData.get("mpesaReceiptNumber")) ??
      optionalString(formData.get("mpesaReceiptRef")),
    paymentNote: optionalString(formData.get("paymentNote")),
    customerPhone: normalizeKenyanPhone(formData.get("customerPhone")),
    customerName: optionalString(formData.get("customerName")),
    loyaltyMenuItemId: optionalString(formData.get("loyaltyMenuItemId")),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };
  try {
    const data = await completeSale(parsed.data, staff.user.id);
    refreshOperations();
    return {
      ok: true,
      message: data.idempotent ? "Sale was already completed." : "Sale completed.",
      data,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function voidSaleAction(
  formData: FormData,
): Promise<OperationsActionResult<{ id: string }>> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "void_financial_record");
  const parsed = voidSaleSchema.safeParse({
    saleId: formData.get("saleId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await voidSale(parsed.data.saleId, parsed.data.reason, owner.user.id);
    refreshOperations();
    return { ok: true, message: "Sale voided and stock/loyalty reversed.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function recordExpenseAction(
  formData: FormData,
): Promise<OperationsActionResult<{ id: string }>> {
  const staff = await requireStaff();
  assertCapability(staff.user.role, "record_expense");
  const parsed = expenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amountKes: formData.get("amountKes"),
    description: formData.get("description"),
    payee: optionalString(formData.get("payee")),
    paymentMethod: formData.get("paymentMethod"),
    incurredAt: formData.get("incurredAt") ?? formData.get("expenseDate"),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const receiptValue = formData.get("receipt");
    const receipt =
      receiptValue instanceof File && receiptValue.size > 0
        ? await storeReceipt(receiptValue)
        : undefined;
    const data = await recordExpense(parsed.data, staff.user.id, receipt);
    refreshOperations();
    return { ok: true, message: "Expense recorded.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function voidExpenseAction(
  formData: FormData,
): Promise<OperationsActionResult<{ id: string }>> {
  const staff = await requireOwner();
  assertCapability(staff.user.role, "void_financial_record");
  const parsed = voidExpenseSchema.safeParse({
    expenseId: formData.get("expenseId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await voidExpense(parsed.data.expenseId, parsed.data.reason, staff.user.id);
    refreshOperations();
    return { ok: true, message: "Expense voided.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function reconcileMpesaAction(
  formData: FormData,
): Promise<OperationsActionResult<Awaited<ReturnType<typeof reconcileMpesa>>>> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "reconcile_mpesa");
  const enteredRows =
    parseJsonField(formData.get("rows")) ??
    parseSettlementRows(formData.get("statementRows"));
  const rowDates = Array.isArray(enteredRows)
    ? enteredRows
        .map((row) =>
          row && typeof row === "object" && "settledAt" in row
            ? new Date(String(row.settledAt))
            : null,
        )
        .filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())))
    : [];
  const parsed = reconciliationSchema.safeParse({
    periodStart:
      optionalString(formData.get("periodStart")) ??
      (rowDates.length ? new Date(Math.min(...rowDates.map(Number))) : undefined),
    periodEnd:
      optionalString(formData.get("periodEnd")) ??
      (rowDates.length ? new Date(Math.max(...rowDates.map(Number)) + 1) : undefined),
    rows: enteredRows,
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await reconcileMpesa(parsed.data, owner.user.id);
    refreshOperations();
    return { ok: true, message: "M-Pesa reconciliation saved.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveInventoryItemAction(
  formData: FormData,
): Promise<OperationsActionResult<{ id: string }>> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "configure_inventory");
  const parsed = inventoryItemSchema.safeParse({
    id: optionalString(formData.get("id")),
    name: formData.get("name"),
    sku: optionalString(formData.get("sku")),
    unit: formData.get("unit"),
    reorderLevel: formData.get("reorderLevel") ?? formData.get("lowStockThreshold"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await saveInventoryItem(parsed.data, owner.user.id);
    refreshOperations();
    return { ok: true, message: "Inventory item saved.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function recordInventoryMovementAction(
  formData: FormData,
): Promise<OperationsActionResult<Awaited<ReturnType<typeof recordInventoryMovement>>>> {
  const staff = await requireStaff();
  assertCapability(staff.user.role, "record_stock_movement");
  const movementType = optionalString(formData.get("type"));
  const rawQuantity = Number(formData.get("quantity"));
  const parsed = inventoryMovementSchema.safeParse({
    inventoryItemId: formData.get("inventoryItemId"),
    reason:
      movementType === "usage"
        ? "adjustment"
        : movementType ??
          formData.get("movementReason") ??
          formData.get("reason"),
    quantity: movementType === "usage" ? -Math.abs(rawQuantity) : formData.get("quantity"),
    note:
      optionalString(formData.get("note")) ??
      (movementType ? optionalString(formData.get("reason")) : undefined),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };
  if (
    parsed.data.reason === "adjustment" &&
    !hasCapability(staff.user.role, "configure_inventory")
  ) {
    return { ok: false, message: "Only the owner can record stock adjustments." };
  }

  try {
    const data = await recordInventoryMovement(parsed.data, staff.user.id);
    refreshOperations();
    return { ok: true, message: "Inventory movement recorded.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveRecipeAction(
  formData: FormData,
): Promise<OperationsActionResult<{ id: string }>> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "configure_inventory");
  const submittedLines = parseJsonField(formData.get("lines"));
  const parsed = recipeSchema.safeParse({
    menuItemId: formData.get("menuItemId"),
    lines:
      submittedLines ??
      (formData.get("inventoryItemId")
        ? [
            {
              inventoryItemId: formData.get("inventoryItemId"),
              quantity: formData.get("quantity"),
            },
          ]
        : undefined),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await saveRecipe(parsed.data, owner.user.id);
    refreshOperations();
    return { ok: true, message: "Recipe saved.", data };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveOperationsSettingsAction(
  formData: FormData,
): Promise<OperationsActionResult> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "configure_loyalty");
  const parsed = operationsSettingsSchema.safeParse({
    tillNumber: formData.get("tillNumber"),
    loyaltyVisitsRequired: formData.get("loyaltyVisitsRequired"),
    loyaltyRewardCapKes: formData.get("loyaltyRewardCapKes"),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    await saveOperationsSettings(parsed.data, owner.user.id);
    refreshOperations();
    return { ok: true, message: "Operations settings saved." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adjustLoyaltyAction(
  formData: FormData,
): Promise<OperationsActionResult<{ customerId: string; balanceAfter: number }>> {
  const owner = await requireOwner();
  assertCapability(owner.user.role, "configure_loyalty");
  const parsed = loyaltyAdjustmentSchema.safeParse({
    customerPhone: normalizeKenyanPhone(formData.get("customerPhone")),
    customerId: optionalString(formData.get("customerId")),
    visitDelta: formData.get("visitDelta") ?? formData.get("points"),
    note: formData.get("note") ?? formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  try {
    const data = await adjustLoyalty(
      parsed.data.customerPhone ?? parsed.data.customerId!,
      parsed.data.visitDelta,
      parsed.data.note,
      owner.user.id,
    );
    refreshOperations();
    return { ok: true, message: "Loyalty balance adjusted.", data };
  } catch (error) {
    return actionFailure(error);
  }
}
