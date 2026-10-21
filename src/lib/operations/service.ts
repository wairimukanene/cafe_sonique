import "server-only";

import {
  and,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import { db } from "../db";
import {
  auditLog,
  cafeSetting,
  customer,
  expense,
  expenseCategory,
  expenseReceipt,
  inventoryItem,
  inventoryMovement,
  loyaltyEntry,
  menuItem,
  mpesaSettlement,
  payment,
  paymentMpesa,
  recipeLine,
  reconciliationSession,
  sale,
  saleDiscount,
  saleLineItem,
} from "../db/schema";
import {
  DEFAULT_LOYALTY_CAP_KES,
  DEFAULT_LOYALTY_VISITS,
  type CompleteSaleInput,
  type ExpenseInput,
  type InventoryItemInput,
  type InventoryMovementInput,
  type OperationsSettingsInput,
  OperationsError,
  type RecipeInput,
  type ReconciliationInput,
} from "./domain";
import {
  deleteStoredReceipt,
  type StoredReceipt,
} from "./receipts";

const SETTING_TILL = "operations.till_number";
const SETTING_LOYALTY_VISITS = "operations.loyalty_visits_required";
const SETTING_LOYALTY_CAP = "operations.loyalty_reward_cap_kes";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function settingValue(
  tx: DatabaseTransaction,
  key: string,
  fallback: string | number,
) {
  const row = await tx.query.cafeSetting.findFirst({
    where: eq(cafeSetting.key, key),
  });
  return row?.value ?? fallback;
}

async function audit(
  tx: DatabaseTransaction,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

function saleReference(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `CS-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function completeSale(input: CompleteSaleInput, actorId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`sale:${input.idempotencyKey}`}))`,
    );
    const prior = await tx.query.sale.findFirst({
      where: eq(sale.idempotencyKey, input.idempotencyKey),
    });
    if (prior) {
      return {
        id: prior.id,
        reference: prior.reference,
        totalKes: prior.totalKes,
        idempotent: true,
      };
    }

    const grouped = new Map<string, number>();
    for (const line of input.items) {
      grouped.set(line.menuItemId, (grouped.get(line.menuItemId) ?? 0) + line.quantity);
    }
    const itemIds = [...grouped.keys()];
    const menu = await tx
      .select()
      .from(menuItem)
      .where(
        and(
          inArray(menuItem.id, itemIds),
          eq(menuItem.active, true),
          eq(menuItem.available, true),
        ),
      );
    if (menu.length !== itemIds.length) {
      throw new OperationsError("One or more menu items are unavailable.");
    }

    const lines = menu.map((item) => {
      const quantity = grouped.get(item.id) ?? 0;
      return {
        item,
        quantity,
        lineTotalKes: item.priceKes * quantity,
      };
    });
    const subtotalKes = lines.reduce((sum, line) => sum + line.lineTotalKes, 0);
    let standardDiscountKes = 0;
    if (input.discountKind === "fixed_kes") {
      standardDiscountKes = input.discountValue ?? 0;
    } else if (input.discountKind === "percent") {
      standardDiscountKes = Math.round((subtotalKes * (input.discountValue ?? 0)) / 100);
    }
    standardDiscountKes = Math.min(subtotalKes, standardDiscountKes);

    if (!input.customerPhone) {
      throw new OperationsError("A customer phone is required.");
    }

    let customerId: string | null = null;
    let loyaltyDiscountKes = 0;
    let loyaltyBalance = 0;
    let loyaltyVisitsRequired = DEFAULT_LOYALTY_VISITS;
    if (input.customerPhone) {
      customerId = crypto.randomUUID();
      const [savedCustomer] = await tx
        .insert(customer)
        .values({
          id: customerId,
          phoneE164: input.customerPhone,
          displayName: input.customerName,
        })
        .onConflictDoUpdate({
          target: customer.phoneE164,
          set: {
            ...(input.customerName ? { displayName: input.customerName } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!savedCustomer) throw new OperationsError("Customer could not be saved.");
      customerId = savedCustomer.id;
      await tx.execute(sql`select id from customer where id = ${customerId} for update`);
      loyaltyBalance = savedCustomer.loyaltyBalance;

      const configuredVisits = Number(
        await settingValue(tx, SETTING_LOYALTY_VISITS, DEFAULT_LOYALTY_VISITS),
      );
      loyaltyVisitsRequired =
        Number.isInteger(configuredVisits) && configuredVisits > 0
          ? configuredVisits
          : DEFAULT_LOYALTY_VISITS;

      if (input.loyaltyMenuItemId) {
        const selected = lines.find((line) => line.item.id === input.loyaltyMenuItemId);
        if (!selected) {
          throw new OperationsError("The loyalty drink must be part of this sale.");
        }
        if (loyaltyBalance < loyaltyVisitsRequired) {
          throw new OperationsError("The customer does not have enough loyalty visits.");
        }
        const configuredCap = Number(
          await settingValue(tx, SETTING_LOYALTY_CAP, DEFAULT_LOYALTY_CAP_KES),
        );
        const cap =
          Number.isInteger(configuredCap) && configuredCap > 0
            ? configuredCap
            : DEFAULT_LOYALTY_CAP_KES;
        loyaltyDiscountKes = Math.min(
          selected.item.priceKes,
          cap,
          subtotalKes - standardDiscountKes,
        );
      }
    }

    const discountTotalKes = Math.min(
      subtotalKes,
      standardDiscountKes + loyaltyDiscountKes,
    );
    const totalKes = subtotalKes - discountTotalKes;
    if (input.paymentAmountKes !== undefined && input.paymentAmountKes !== totalKes) {
      throw new OperationsError("Payment amount must equal the sale total.");
    }

    const tillNumber = String(await settingValue(tx, SETTING_TILL, "")).trim();
    if (totalKes > 0 && input.paymentMethod === "mpesa_buy_goods" && !tillNumber) {
      throw new OperationsError("The Buy Goods till number has not been configured.");
    }
    if (totalKes > 0 && input.paymentMethod === "mpesa_buy_goods") {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`mpesa:${tillNumber}:${input.mpesaReceiptNumber}`}))`,
      );
      const duplicateReceipt = await tx.query.paymentMpesa.findFirst({
        where: and(
          eq(paymentMpesa.tillNumber, tillNumber),
          eq(paymentMpesa.receiptNumber, input.mpesaReceiptNumber!),
        ),
      });
      if (duplicateReceipt) {
        throw new OperationsError("That M-Pesa receipt number has already been recorded.");
      }
    }

    const saleId = crypto.randomUUID();
    const reference = saleReference();
    const now = new Date();
    await tx.insert(sale).values({
      id: saleId,
      reference,
      status: "completed",
      customerId,
      subtotalKes,
      discountTotalKes,
      totalKes,
      idempotencyKey: input.idempotencyKey,
      createdBy: actorId,
      completedAt: now,
    });
    await tx.insert(saleLineItem).values(
      lines.map((line) => ({
        id: crypto.randomUUID(),
        saleId,
        menuItemId: line.item.id,
        nameSnapshot: line.item.name,
        unitPriceKes: line.item.priceKes,
        quantity: line.quantity,
        lineTotalKes: line.lineTotalKes,
        isLoyaltyRedemption: line.item.id === input.loyaltyMenuItemId,
      })),
    );

    if (standardDiscountKes > 0 && input.discountKind && input.discountValue !== undefined) {
      await tx.insert(saleDiscount).values({
        id: crypto.randomUUID(),
        saleId,
        kind: input.discountKind,
        label: input.discountLabel ?? "Sale discount",
        value: input.discountValue,
        amountKes: standardDiscountKes,
      });
    }
    if (loyaltyDiscountKes > 0) {
      await tx.insert(saleDiscount).values({
        id: crypto.randomUUID(),
        saleId,
        kind: "loyalty_free_drink",
        label: "Loyalty free drink",
        value: 1,
        amountKes: loyaltyDiscountKes,
      });
    }

    if (totalKes > 0) {
      const paymentId = crypto.randomUUID();
      await tx.insert(payment).values({
        id: paymentId,
        saleId,
        method: input.paymentMethod,
        amountKes: totalKes,
        idempotencyKey: `${input.idempotencyKey}:payment`,
        recordedBy: actorId,
      });
      if (input.paymentMethod === "mpesa_buy_goods") {
        await tx.insert(paymentMpesa).values({
          paymentId,
          tillNumber,
          receiptNumber: input.mpesaReceiptNumber!,
          note: input.paymentNote,
        });
      }
    }

    if (customerId) {
      let balance = loyaltyBalance;
      if (loyaltyDiscountKes > 0) {
        balance -= loyaltyVisitsRequired;
        await tx.insert(loyaltyEntry).values({
          id: crypto.randomUUID(),
          customerId,
          saleId,
          type: "redemption",
          visitDelta: -loyaltyVisitsRequired,
          balanceAfter: balance,
          rewardCostKes: loyaltyDiscountKes,
          note: "One drink redeemed",
          createdBy: actorId,
        });
      }
      if (loyaltyDiscountKes === 0) {
        balance += 1;
        await tx.insert(loyaltyEntry).values({
          id: crypto.randomUUID(),
          customerId,
          saleId,
          type: "visit",
          visitDelta: 1,
          balanceAfter: balance,
          createdBy: actorId,
        });
      }
      await tx
        .update(customer)
        .set({ loyaltyBalance: balance, updatedAt: now })
        .where(eq(customer.id, customerId));
    }

    const recipes = await tx
      .select()
      .from(recipeLine)
      .where(inArray(recipeLine.menuItemId, itemIds));
    const deductions = new Map<string, number>();
    for (const recipe of recipes) {
      const soldQuantity = grouped.get(recipe.menuItemId) ?? 0;
      deductions.set(
        recipe.inventoryItemId,
        (deductions.get(recipe.inventoryItemId) ?? 0) + recipe.quantity * soldQuantity,
      );
    }
    for (const [inventoryItemId, deduction] of deductions) {
      await tx.execute(
        sql`select id from inventory_item where id = ${inventoryItemId} for update`,
      );
      const [updated] = await tx
        .update(inventoryItem)
        .set({
          onHand: sql`${inventoryItem.onHand} - ${deduction}`,
          updatedAt: now,
        })
        .where(eq(inventoryItem.id, inventoryItemId))
        .returning({ balanceAfter: inventoryItem.onHand });
      if (!updated) throw new OperationsError("A configured recipe item no longer exists.");
      await tx.insert(inventoryMovement).values({
        id: crypto.randomUUID(),
        inventoryItemId,
        delta: -deduction,
        balanceAfter: updated.balanceAfter,
        reason: "sale",
        referenceType: "sale",
        referenceId: saleId,
        note: reference,
        createdBy: actorId,
      });
    }

    await audit(tx, actorId, "sale.completed", "sale", saleId, {
      reference,
      totalKes,
      paymentMethod: input.paymentMethod,
      lineCount: lines.length,
      loyaltyRedeemedKes: loyaltyDiscountKes,
    });
    return { id: saleId, reference, totalKes, idempotent: false };
  });
}

export async function voidSale(saleId: string, reason: string, actorId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from sale where id = ${saleId} for update`);
    const existing = await tx.query.sale.findFirst({
      where: eq(sale.id, saleId),
    });
    if (!existing || existing.status !== "completed") {
      throw new OperationsError("Sale was not found or is already void.");
    }

    const now = new Date();
    await tx
      .update(sale)
      .set({ status: "void", voidedAt: now, voidReason: reason, updatedAt: now })
      .where(eq(sale.id, saleId));
    await tx
      .update(payment)
      .set({ status: "reversed" })
      .where(eq(payment.saleId, saleId));

    if (existing.customerId) {
      await tx.execute(
        sql`select id from customer where id = ${existing.customerId} for update`,
      );
      const linkedEntries = await tx
        .select()
        .from(loyaltyEntry)
        .where(eq(loyaltyEntry.saleId, saleId));
      const visitDelta = linkedEntries.reduce((sum, entry) => sum + entry.visitDelta, 0);
      if (visitDelta !== 0) {
        const linkedCustomer = await tx.query.customer.findFirst({
          where: eq(customer.id, existing.customerId),
        });
        if (!linkedCustomer) throw new OperationsError("Sale customer was not found.");
        const balanceAfter = linkedCustomer.loyaltyBalance - visitDelta;
        await tx
          .update(customer)
          .set({ loyaltyBalance: balanceAfter, updatedAt: now })
          .where(eq(customer.id, existing.customerId));
        await tx.insert(loyaltyEntry).values({
          id: crypto.randomUUID(),
          customerId: existing.customerId,
          saleId,
          type: "adjustment",
          visitDelta: -visitDelta,
          balanceAfter,
          note: `Sale voided: ${reason}`,
          createdBy: actorId,
        });
      }
    }

    const stockMovements = await tx
      .select()
      .from(inventoryMovement)
      .where(
        and(
          eq(inventoryMovement.referenceType, "sale"),
          eq(inventoryMovement.referenceId, saleId),
          eq(inventoryMovement.reason, "sale"),
        ),
      );
    for (const movement of stockMovements) {
      await tx.execute(
        sql`select id from inventory_item where id = ${movement.inventoryItemId} for update`,
      );
      const reversal = -movement.delta;
      const [updated] = await tx
        .update(inventoryItem)
        .set({
          onHand: sql`${inventoryItem.onHand} + ${reversal}`,
          updatedAt: now,
        })
        .where(eq(inventoryItem.id, movement.inventoryItemId))
        .returning({ balanceAfter: inventoryItem.onHand });
      if (updated) {
        await tx.insert(inventoryMovement).values({
          id: crypto.randomUUID(),
          inventoryItemId: movement.inventoryItemId,
          delta: reversal,
          balanceAfter: updated.balanceAfter,
          reason: "void_reversal",
          referenceType: "sale",
          referenceId: saleId,
          note: reason,
          createdBy: actorId,
        });
      }
    }

    await audit(tx, actorId, "sale.voided", "sale", saleId, {
      reference: existing.reference,
      reason,
      totalKes: existing.totalKes,
    });
    return { id: saleId };
  });
}

export async function recordExpense(
  input: ExpenseInput,
  actorId: string,
  receipt?: StoredReceipt,
) {
  const id = crypto.randomUUID();
  try {
    return await db.transaction(async (tx) => {
      const category = await tx.query.expenseCategory.findFirst({
        where: and(
          eq(expenseCategory.id, input.categoryId),
          eq(expenseCategory.active, true),
        ),
      });
      if (!category) throw new OperationsError("Expense category is unavailable.");

      await tx.insert(expense).values({
        id,
        categoryId: input.categoryId,
        amountKes: input.amountKes,
        description: input.description,
        payee: input.payee,
        paymentMethod: input.paymentMethod,
        incurredAt: input.incurredAt,
        createdBy: actorId,
      });
      if (receipt) {
        await tx.insert(expenseReceipt).values({
          id: crypto.randomUUID(),
          expenseId: id,
          ...receipt,
          uploadedBy: actorId,
        });
      }
      await audit(tx, actorId, "expense.recorded", "expense", id, {
        amountKes: input.amountKes,
        categoryId: input.categoryId,
        hasReceipt: Boolean(receipt),
      });
      return { id };
    });
  } catch (error) {
    if (receipt) await deleteStoredReceipt(receipt.storageKey);
    throw error;
  }
}

export async function voidExpense(expenseId: string, reason: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(expense)
      .set({
        status: "void",
        voidedAt: new Date(),
        voidReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.id, expenseId), eq(expense.status, "recorded")))
      .returning({ id: expense.id });
    if (!updated) throw new OperationsError("Expense was not found or is already void.");
    await audit(tx, actorId, "expense.voided", "expense", expenseId, { reason });
    return { id: expenseId };
  });
}

export async function reconcileMpesa(input: ReconciliationInput, actorId: string) {
  return db.transaction(async (tx) => {
    const duplicateRefs = input.rows.filter(
      (row, index) =>
        input.rows.findIndex((candidate) => candidate.receiptNumber === row.receiptNumber) !==
        index,
    );
    if (duplicateRefs.length) {
      throw new OperationsError("Settlement receipt numbers must be unique.");
    }

    const sessionId = crypto.randomUUID();
    const expectedRows = await tx
      .select({ total: sql<number>`coalesce(sum(${payment.amountKes}), 0)` })
      .from(payment)
      .where(
        and(
          eq(payment.method, "mpesa_buy_goods"),
          sql`${payment.recordedAt} >= ${input.periodStart}`,
          sql`${payment.recordedAt} < ${input.periodEnd}`,
        ),
      );
    const expectedKes = Number(expectedRows[0]?.total ?? 0);
    const settlementKes = input.rows.reduce((sum, row) => sum + row.amountKes, 0);
    await tx.insert(reconciliationSession).values({
      id: sessionId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      expectedKes,
      settlementKes,
      differenceKes: settlementKes - expectedKes,
      createdBy: actorId,
    });

    const candidates = await tx
      .select({
        paymentId: payment.id,
        amountKes: payment.amountKes,
        receiptNumber: paymentMpesa.receiptNumber,
      })
      .from(payment)
      .innerJoin(paymentMpesa, eq(paymentMpesa.paymentId, payment.id))
      .where(
        and(
          eq(payment.method, "mpesa_buy_goods"),
          eq(payment.status, "recorded"),
          inArray(
            paymentMpesa.receiptNumber,
            input.rows.map((row) => row.receiptNumber),
          ),
        ),
      );
    const matches = new Map(
      candidates.map((candidate) => [
        `${candidate.receiptNumber}:${candidate.amountKes}`,
        candidate.paymentId,
      ]),
    );
    const matchedPaymentIds = new Set<string>();
    for (const row of input.rows) {
      const matchedPaymentId = matches.get(`${row.receiptNumber}:${row.amountKes}`);
      if (matchedPaymentId) matchedPaymentIds.add(matchedPaymentId);
      await tx.insert(mpesaSettlement).values({
        id: crypto.randomUUID(),
        sessionId,
        receiptNumber: row.receiptNumber,
        amountKes: row.amountKes,
        settledAt: row.settledAt,
        matchedPaymentId,
        status: matchedPaymentId ? "matched" : "unmatched",
      });
    }

    if (matchedPaymentIds.size) {
      await tx
        .update(payment)
        .set({ status: "reconciled", reconciledBy: actorId, reconciledAt: new Date() })
        .where(inArray(payment.id, [...matchedPaymentIds]));
    }
    await audit(tx, actorId, "mpesa.reconciled", "reconciliation_session", sessionId, {
      expectedKes,
      settlementKes,
      matched: matchedPaymentIds.size,
      unmatched: input.rows.length - matchedPaymentIds.size,
    });
    return {
      id: sessionId,
      expectedKes,
      settlementKes,
      differenceKes: settlementKes - expectedKes,
      matched: matchedPaymentIds.size,
      unmatched: input.rows.length - matchedPaymentIds.size,
    };
  });
}

export async function saveInventoryItem(input: InventoryItemInput, actorId: string) {
  const id = input.id ?? crypto.randomUUID();
  await db.transaction(async (tx) => {
    const values = {
      name: input.name,
      sku: input.sku ?? null,
      unit: input.unit,
      reorderLevel: input.reorderLevel,
      active: input.active,
      updatedAt: new Date(),
    };
    if (input.id) {
      const [updated] = await tx
        .update(inventoryItem)
        .set(values)
        .where(eq(inventoryItem.id, id))
        .returning({ id: inventoryItem.id });
      if (!updated) throw new OperationsError("Inventory item was not found.");
    } else {
      await tx.insert(inventoryItem).values({ id, ...values });
    }
    await audit(
      tx,
      actorId,
      input.id ? "inventory_item.updated" : "inventory_item.created",
      "inventory_item",
      id,
      { name: input.name, unit: input.unit },
    );
  });
  return { id };
}

export async function recordInventoryMovement(
  input: InventoryMovementInput,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from inventory_item where id = ${input.inventoryItemId} for update`,
    );
    const current = await tx.query.inventoryItem.findFirst({
      where: eq(inventoryItem.id, input.inventoryItemId),
    });
    if (!current) throw new OperationsError("Inventory item was not found.");

    const delta =
      input.reason === "count"
        ? input.quantity - current.onHand
        : input.reason === "waste"
          ? -input.quantity
          : input.quantity;
    const balanceAfter = current.onHand + delta;
    const movementId = crypto.randomUUID();
    await tx
      .update(inventoryItem)
      .set({ onHand: balanceAfter, updatedAt: new Date() })
      .where(eq(inventoryItem.id, input.inventoryItemId));
    await tx.insert(inventoryMovement).values({
      id: movementId,
      inventoryItemId: input.inventoryItemId,
      delta,
      balanceAfter,
      reason: input.reason,
      note: input.note,
      createdBy: actorId,
    });
    await audit(tx, actorId, "inventory.movement_recorded", "inventory_movement", movementId, {
      inventoryItemId: input.inventoryItemId,
      reason: input.reason,
      delta,
      balanceAfter,
    });
    return { id: movementId, balanceAfter };
  });
}

export async function saveRecipe(input: RecipeInput, actorId: string) {
  await db.transaction(async (tx) => {
    const existingMenu = await tx.query.menuItem.findFirst({
      where: eq(menuItem.id, input.menuItemId),
    });
    if (!existingMenu) throw new OperationsError("Menu item was not found.");
    if (input.lines.length) {
      const existingInventory = await tx
        .select({ id: inventoryItem.id })
        .from(inventoryItem)
        .where(
          inArray(
            inventoryItem.id,
            input.lines.map((line) => line.inventoryItemId),
          ),
        );
      if (existingInventory.length !== input.lines.length) {
        throw new OperationsError("One or more inventory items were not found.");
      }
    }

    await tx.delete(recipeLine).where(eq(recipeLine.menuItemId, input.menuItemId));
    if (input.lines.length) {
      await tx.insert(recipeLine).values(
        input.lines.map((line) => ({
          id: crypto.randomUUID(),
          menuItemId: input.menuItemId,
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
        })),
      );
    }
    await audit(tx, actorId, "recipe.saved", "menu_item", input.menuItemId, {
      lineCount: input.lines.length,
    });
  });
  return { id: input.menuItemId };
}

export async function saveOperationsSettings(
  input: OperationsSettingsInput,
  actorId: string,
) {
  await db.transaction(async (tx) => {
    const settings = [
      [SETTING_TILL, input.tillNumber],
      [SETTING_LOYALTY_VISITS, input.loyaltyVisitsRequired],
      [SETTING_LOYALTY_CAP, input.loyaltyRewardCapKes],
    ] as const;
    for (const [key, value] of settings) {
      await tx
        .insert(cafeSetting)
        .values({ key, value, updatedBy: actorId })
        .onConflictDoUpdate({
          target: cafeSetting.key,
          set: { value, updatedBy: actorId, updatedAt: new Date() },
        });
    }
    await audit(tx, actorId, "operations_settings.updated", "cafe_setting", "operations", {
      tillNumber: input.tillNumber,
      loyaltyVisitsRequired: input.loyaltyVisitsRequired,
      loyaltyRewardCapKes: input.loyaltyRewardCapKes,
    });
  });
}

export async function adjustLoyalty(
  customerIdentifier: string,
  visitDelta: number,
  note: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const byPhone = customerIdentifier.startsWith("+");
    if (byPhone) {
      await tx.execute(
        sql`select id from customer where phone_e164 = ${customerIdentifier} for update`,
      );
    } else {
      await tx.execute(sql`select id from customer where id = ${customerIdentifier} for update`);
    }
    const existing = await tx.query.customer.findFirst({
      where: byPhone
        ? eq(customer.phoneE164, customerIdentifier)
        : eq(customer.id, customerIdentifier),
    });
    if (!existing) throw new OperationsError("Customer was not found.");
    const balanceAfter = existing.loyaltyBalance + visitDelta;
    if (balanceAfter < 0) {
      throw new OperationsError("The loyalty balance cannot be negative.");
    }
    const entryId = crypto.randomUUID();
    await tx
      .update(customer)
      .set({ loyaltyBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(customer.id, existing.id));
    await tx.insert(loyaltyEntry).values({
      id: entryId,
      customerId: existing.id,
      type: "adjustment",
      visitDelta,
      balanceAfter,
      note,
      createdBy: actorId,
    });
    await audit(tx, actorId, "loyalty.adjusted", "customer", existing.id, {
      visitDelta,
      balanceAfter,
      note,
    });
    return { customerId: existing.id, balanceAfter };
  });
}
