import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { after } from "next/server";

import { db } from "@/lib/db";
import {
  auditLog,
  cafeSetting,
  customer,
  deliveryArea,
  payment,
  paymentMpesa,
  rateLimit,
  sale,
  saleLineItem,
  shopOrder,
  shopOrderItem,
  shopPaymentAttempt,
  shopProduct,
  shopProductColour,
  shopProductOption,
  user,
} from "@/lib/db/schema";
import type { StaffRole } from "@/lib/auth-core";
import {
  canMoveOrder,
  FINAL_FAILURE_CODES,
  groupCartLines,
  HOLD_MINUTES,
  MAX_PAYMENT_ATTEMPTS,
  parseStkCallback,
  NO_REPLY_CODE,
  paymentFailureMessage,
  RESEND_COOLDOWN_SECONDS,
  ShopError,
  slugify,
  variantLabel,
  type CheckoutInput,
  type DeliveryAreaInput,
  type ProductInput,
  type ShopOrderStatus,
} from "./domain";
import { getMpesaStatus, MpesaRequestError, queryStkPush, sendStkPush } from "./mpesa";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Actor = { id: string; role: StaffRole };

export const SHOP_SYSTEM_USER_ID = "system-online-shop";
export const PUBLIC_SHOP_TAG = "public-shop";

const CHECKOUTS_PER_HOUR = 10;
const QUERY_AFTER_SECONDS = 25;
const QUERY_EVERY_SECONDS = 10;
const GIVE_UP_AFTER_SECONDS = 180;

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function orderCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `SN-${code}`;
}

function secondsSince(date: Date, now = new Date()) {
  return (now.getTime() - date.getTime()) / 1000;
}

export function markShopStale() {
  try {
    revalidateTag(PUBLIC_SHOP_TAG, "max");
  } catch {
    // Outside a request (e.g. during render) the short cache lifetime catches up instead.
  }
}

async function ensureSystemUser(tx: Tx) {
  await tx
    .insert(user)
    .values({
      id: SHOP_SYSTEM_USER_ID,
      name: "Online shop",
      email: "online-shop@system.invalid",
      role: "system",
      banned: true,
      banReason: "System account for website orders. It cannot sign in.",
    })
    .onConflictDoNothing();
}

async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  if (actorId === SHOP_SYSTEM_USER_ID) await ensureSystemUser(tx);
  await tx.insert(auditLog).values({
    id: crypto.randomUUID(),
    actorId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

async function consumeRateLimit(scope: string, identity: string, limit: number) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const hash = createHash("sha256").update(`${scope}:${identity}:${hour}`).digest("hex");
  const [row] = await db
    .insert(rateLimit)
    .values({ key: `${scope}:${hour}:${hash}`, count: 1 })
    .onConflictDoUpdate({ target: rateLimit.key, set: { count: sql`${rateLimit.count} + 1` } })
    .returning({ count: rateLimit.count });
  return row.count <= limit;
}

async function restoreStock(tx: Tx, orderId: string) {
  const items = await tx
    .select({ optionId: shopOrderItem.optionId, quantity: shopOrderItem.quantity })
    .from(shopOrderItem)
    .where(eq(shopOrderItem.orderId, orderId));
  for (const item of items) {
    if (!item.optionId) continue;
    await tx
      .update(shopProductOption)
      .set({ stock: sql`${shopProductOption.stock} + ${item.quantity}`, updatedAt: new Date() })
      .where(eq(shopProductOption.id, item.optionId));
  }
}

async function lockOrder(tx: Tx, orderId: string) {
  await tx.execute(sql`select id from shop_order where id = ${orderId} for update`);
  return tx.query.shopOrder.findFirst({ where: eq(shopOrder.id, orderId), with: { items: true } });
}

export async function releaseExpiredHolds(onlyOrderId?: string) {
  const now = new Date();
  const candidates = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(
      and(
        eq(shopOrder.status, "awaiting_payment"),
        lt(shopOrder.holdExpiresAt, now),
        onlyOrderId ? eq(shopOrder.id, onlyOrderId) : undefined,
      ),
    )
    .limit(50);

  let released = 0;
  for (const { id } of candidates) {
    const didRelease = await db.transaction(async (tx) => {
      const order = await lockOrder(tx, id);
      if (!order || order.status !== "awaiting_payment" || order.holdExpiresAt > now) return false;
      const [recentPrompt] = await tx
        .select({ id: shopPaymentAttempt.id })
        .from(shopPaymentAttempt)
        .where(
          and(
            eq(shopPaymentAttempt.orderId, id),
            eq(shopPaymentAttempt.status, "pending"),
            sql`${shopPaymentAttempt.createdAt} > now() - interval '2 minutes'`,
          ),
        )
        .limit(1);
      if (recentPrompt) return false;

      await tx
        .update(shopOrder)
        .set({ status: "expired", statusChangedAt: now, updatedAt: now })
        .where(eq(shopOrder.id, id));
      await restoreStock(tx, id);
      await audit(tx, SHOP_SYSTEM_USER_ID, "shop_order.expired", "shop_order", id, { code: order.code });
      return true;
    });
    if (didRelease) released += 1;
  }
  if (released) markShopStale();
  return released;
}

export async function placeOrder(input: CheckoutInput, clientIp: string) {
  const mpesa = getMpesaStatus();
  if (!mpesa.ready) {
    throw new ShopError("Online payment isn't switched on yet. Please order at the café for now.");
  }

  const existing = await db.query.shopOrder.findFirst({
    where: eq(shopOrder.idempotencyKey, input.idempotencyKey),
  });
  if (existing) return { token: existing.publicToken, code: existing.code, promptError: null };

  if (!(await consumeRateLimit("shop-checkout", clientIp, CHECKOUTS_PER_HOUR))) {
    throw new ShopError("Too many orders from this connection. Please try again in an hour.");
  }

  await releaseExpiredHolds();
  const grouped = groupCartLines(input.items);
  const optionIds = [...grouped.keys()];

  const order = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`shop:${input.idempotencyKey}`}))`);
    const prior = await tx.query.shopOrder.findFirst({
      where: eq(shopOrder.idempotencyKey, input.idempotencyKey),
    });
    if (prior) return prior;

    const rows = await tx
      .select({
        optionId: shopProductOption.id,
        optionLabel: shopProductOption.label,
        colourName: shopProductColour.name,
        stock: shopProductOption.stock,
        productId: shopProduct.id,
        productName: shopProduct.name,
        priceKes: shopProduct.priceKes,
        active: shopProduct.active,
      })
      .from(shopProductOption)
      .innerJoin(shopProduct, eq(shopProduct.id, shopProductOption.productId))
      .leftJoin(shopProductColour, eq(shopProductColour.id, shopProductOption.colourId))
      .where(inArray(shopProductOption.id, optionIds))
      .orderBy(asc(shopProductOption.id))
      .for("update", { of: shopProductOption });

    if (rows.length !== optionIds.length || rows.some((row) => !row.active)) {
      throw new ShopError("Something in your bag is no longer available. Please check your bag.");
    }

    const lines = rows.map((row) => {
      const quantity = grouped.get(row.optionId) ?? 0;
      const label = variantLabel(row.colourName, row.optionLabel);
      const name = label ? `${row.productName} (${label})` : row.productName;
      if (row.stock < quantity) {
        throw new ShopError(
          row.stock === 0
            ? `${name} has just sold out. Please remove it from your bag.`
            : `Only ${row.stock} of ${name} left. Please lower the quantity.`,
        );
      }
      return { ...row, quantity, label, lineTotalKes: row.priceKes * quantity };
    });

    let fee = 0;
    let areaName: string | null = null;
    if (input.fulfilment === "delivery") {
      const area = await tx.query.deliveryArea.findFirst({
        where: and(eq(deliveryArea.id, input.deliveryAreaId!), eq(deliveryArea.active, true)),
      });
      if (!area) throw new ShopError("We don't deliver to that area yet. Please choose another.");
      fee = area.feeKes;
      areaName = area.name;
    }

    const itemsTotalKes = lines.reduce((sum, line) => sum + line.lineTotalKes, 0);
    const now = new Date();
    const id = crypto.randomUUID();
    const [created] = await tx
      .insert(shopOrder)
      .values({
        id,
        code: orderCode(),
        publicToken: randomBytes(24).toString("base64url"),
        idempotencyKey: input.idempotencyKey,
        fulfilment: input.fulfilment,
        deliveryAreaId: input.fulfilment === "delivery" ? input.deliveryAreaId : null,
        deliveryAreaName: areaName,
        deliveryAddress: input.fulfilment === "delivery" ? input.deliveryAddress : null,
        deliveryNotes: input.fulfilment === "delivery" ? input.deliveryNotes : null,
        customerName: input.customerName,
        phoneE164: input.phone,
        itemsTotalKes,
        deliveryFeeKes: fee,
        totalKes: itemsTotalKes + fee,
        holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
      })
      .returning();

    await tx.insert(shopOrderItem).values(
      lines.map((line) => ({
        id: crypto.randomUUID(),
        orderId: id,
        productId: line.productId,
        optionId: line.optionId,
        nameSnapshot: line.productName,
        optionLabel: line.label,
        unitPriceKes: line.priceKes,
        quantity: line.quantity,
        lineTotalKes: line.lineTotalKes,
      })),
    );
    for (const line of lines) {
      await tx
        .update(shopProductOption)
        .set({ stock: sql`${shopProductOption.stock} - ${line.quantity}`, updatedAt: now })
        .where(eq(shopProductOption.id, line.optionId));
    }
    await audit(tx, SHOP_SYSTEM_USER_ID, "shop_order.placed", "shop_order", id, {
      code: created.code,
      totalKes: created.totalKes,
      fulfilment: created.fulfilment,
    });
    return created;
  });

  markShopStale();

  let promptError: string | null = null;
  try {
    await sendPaymentPrompt(order.id);
  } catch (error) {
    if (!(error instanceof ShopError) && !(error instanceof MpesaRequestError)) throw error;
    promptError = error.message;
  }
  return { token: order.publicToken, code: order.code, promptError };
}

export async function sendPaymentPrompt(orderId: string) {
  const order = await db.query.shopOrder.findFirst({
    where: eq(shopOrder.id, orderId),
    with: { attempts: { orderBy: [desc(shopPaymentAttempt.createdAt)] } },
  });
  if (!order || order.status !== "awaiting_payment") {
    throw new ShopError("This order is no longer waiting for payment.");
  }
  if (order.holdExpiresAt <= new Date()) {
    throw new ShopError("This order has expired. Please place it again from your bag.");
  }
  if (order.attempts.length >= MAX_PAYMENT_ATTEMPTS) {
    throw new ShopError("Too many payment attempts for this order. Please contact the café.");
  }
  const latest = order.attempts[0];
  if (latest?.status === "pending" && secondsSince(latest.createdAt) < RESEND_COOLDOWN_SECONDS) {
    throw new ShopError("A prompt was just sent. Check your phone, or try again in a few seconds.");
  }

  const push = await sendStkPush({
    phoneE164: order.phoneE164,
    amountKes: order.totalKes,
    accountReference: order.code.replace("-", ""),
    description: `Order ${order.code}`,
  });

  const attemptId = crypto.randomUUID();
  await db.insert(shopPaymentAttempt).values({
    id: attemptId,
    orderId: order.id,
    checkoutRequestId: push.checkoutRequestId,
    merchantRequestId: push.merchantRequestId,
    phoneE164: order.phoneE164,
    amountKes: order.totalKes,
  });

  if (getMpesaStatus().mode === "mock") {
    scheduleMockCallback(push.checkoutRequestId, order.phoneE164, order.totalKes);
  }
  return { checkoutRequestId: push.checkoutRequestId };
}

function scheduleMockCallback(checkoutRequestId: string, phoneE164: string, amountKes: number) {
  const run = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const cancelled = phoneE164.endsWith("0000");
    const receipt = `SIM${randomBytes(4).toString("hex").toUpperCase()}`;
    await handleStkCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: "mock",
          CheckoutRequestID: checkoutRequestId,
          ResultCode: cancelled ? 1032 : 0,
          ResultDesc: cancelled ? "Request cancelled by user" : "The service request is processed successfully.",
          CallbackMetadata: cancelled
            ? undefined
            : {
                Item: [
                  { Name: "Amount", Value: amountKes },
                  { Name: "MpesaReceiptNumber", Value: receipt },
                  { Name: "PhoneNumber", Value: Number(phoneE164.replace("+", "")) },
                ],
              },
        },
      },
    });
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

async function settingTill(tx: Tx) {
  const fromEnv = getMpesaStatus().tillNumber;
  if (fromEnv) return fromEnv;
  const row = await tx.query.cafeSetting.findFirst({ where: eq(cafeSetting.key, "operations.till_number") });
  return String(row?.value ?? "online").trim() || "online";
}

async function recordShopSale(
  tx: Tx,
  order: typeof shopOrder.$inferSelect & { items: (typeof shopOrderItem.$inferSelect)[] },
  receipt: string,
) {
  await ensureSystemUser(tx);
  const now = new Date();
  const [savedCustomer] = await tx
    .insert(customer)
    .values({ id: crypto.randomUUID(), phoneE164: order.phoneE164, displayName: order.customerName })
    .onConflictDoUpdate({ target: customer.phoneE164, set: { updatedAt: now } })
    .returning({ id: customer.id });

  const saleId = crypto.randomUUID();
  await tx.insert(sale).values({
    id: saleId,
    reference: order.code,
    status: "completed",
    customerId: savedCustomer?.id ?? null,
    subtotalKes: order.totalKes,
    discountTotalKes: 0,
    totalKes: order.totalKes,
    idempotencyKey: `shop:${order.id}`,
    createdBy: SHOP_SYSTEM_USER_ID,
    completedAt: now,
  });
  const lines = order.items.map((item) => ({
    id: crypto.randomUUID(),
    saleId,
    nameSnapshot: `Shop · ${item.nameSnapshot}${item.optionLabel ? ` (${item.optionLabel})` : ""}`,
    unitPriceKes: item.unitPriceKes,
    quantity: item.quantity,
    lineTotalKes: item.lineTotalKes,
  }));
  if (order.deliveryFeeKes > 0) {
    lines.push({
      id: crypto.randomUUID(),
      saleId,
      nameSnapshot: `Shop delivery · ${order.deliveryAreaName ?? "Nairobi"}`,
      unitPriceKes: order.deliveryFeeKes,
      quantity: 1,
      lineTotalKes: order.deliveryFeeKes,
    });
  }
  await tx.insert(saleLineItem).values(lines);

  const paymentId = crypto.randomUUID();
  await tx.insert(payment).values({
    id: paymentId,
    saleId,
    method: "mpesa_buy_goods",
    amountKes: order.totalKes,
    idempotencyKey: `shop:${order.id}:payment`,
    recordedBy: SHOP_SYSTEM_USER_ID,
  });
  await tx.insert(paymentMpesa).values({
    paymentId,
    tillNumber: await settingTill(tx),
    receiptNumber: receipt,
    note: `Online shop order ${order.code}`,
  });
  return saleId;
}

async function confirmOrderPaid(
  tx: Tx,
  orderId: string,
  paid: { receipt: string | null; amountKes: number; checkoutRequestId: string },
) {
  const order = await lockOrder(tx, orderId);
  if (!order) return;
  const now = new Date();

  if (order.paidAt) {
    if (paid.receipt && !order.mpesaReceipt) {
      await tx
        .update(shopOrder)
        .set({ mpesaReceipt: paid.receipt, updatedAt: now })
        .where(eq(shopOrder.id, order.id));
      if (order.saleId) {
        await tx.execute(sql`
          update payment_mpesa set receipt_number = ${paid.receipt}
          where receipt_number like 'STK-%'
            and payment_id in (select id from payment where sale_id = ${order.saleId})
        `);
      }
    }
    return;
  }

  if (paid.amountKes < order.totalKes) {
    await tx
      .update(shopOrder)
      .set({
        needsAttention: `M-Pesa reported KES ${paid.amountKes}, but the order total is KES ${order.totalKes}. Check the till before packing.`,
        updatedAt: now,
      })
      .where(eq(shopOrder.id, order.id));
    await audit(tx, SHOP_SYSTEM_USER_ID, "shop_order.amount_mismatch", "shop_order", order.id, {
      expectedKes: order.totalKes,
      receivedKes: paid.amountKes,
    });
    return;
  }

  let needsAttention: string | null = null;
  if (order.status === "expired" || order.status === "cancelled") {
    for (const item of order.items) {
      if (!item.optionId) continue;
      await tx
        .update(shopProductOption)
        .set({ stock: sql`greatest(${shopProductOption.stock} - ${item.quantity}, 0)`, updatedAt: now })
        .where(eq(shopProductOption.id, item.optionId));
    }
    needsAttention = `Paid after the order had ${order.status === "expired" ? "expired" : "been cancelled"}. Check the stock is still there before packing.`;
  }

  const receipt = paid.receipt ?? `STK-${paid.checkoutRequestId}`;
  const saleId = await recordShopSale(tx, order, receipt);
  await tx
    .update(shopOrder)
    .set({
      status: "paid",
      paidAt: now,
      mpesaReceipt: paid.receipt,
      saleId,
      needsAttention,
      statusChangedAt: now,
      updatedAt: now,
    })
    .where(eq(shopOrder.id, order.id));
  await audit(tx, SHOP_SYSTEM_USER_ID, "shop_order.paid", "shop_order", order.id, {
    code: order.code,
    totalKes: order.totalKes,
    receipt: paid.receipt,
  });
}

export async function handleStkCallback(payload: unknown) {
  const result = parseStkCallback(payload);
  if (!result) return { handled: false as const };

  const handled = await db.transaction(async (tx) => {
    const attempt = await tx.query.shopPaymentAttempt.findFirst({
      where: eq(shopPaymentAttempt.checkoutRequestId, result.checkoutRequestId),
    });
    if (!attempt) return false;
    await lockOrder(tx, attempt.orderId);
    await tx.execute(sql`select id from shop_payment_attempt where id = ${attempt.id} for update`);
    const current = await tx.query.shopPaymentAttempt.findFirst({
      where: eq(shopPaymentAttempt.id, attempt.id),
    });
    if (!current) return false;
    const now = new Date();

    if (result.resultCode === 0) {
      if (current.status === "succeeded" && current.mpesaReceipt) return true;
      await tx
        .update(shopPaymentAttempt)
        .set({
          status: "succeeded",
          resultCode: 0,
          resultDesc: result.resultDesc,
          mpesaReceipt: result.receipt,
          callbackPayload: payload as Record<string, unknown>,
          completedAt: current.completedAt ?? now,
        })
        .where(eq(shopPaymentAttempt.id, current.id));
      await confirmOrderPaid(tx, current.orderId, {
        receipt: result.receipt,
        amountKes: result.amountKes ?? current.amountKes,
        checkoutRequestId: current.checkoutRequestId,
      });
      return true;
    }

    if (current.status !== "pending") return true;
    await tx
      .update(shopPaymentAttempt)
      .set({
        status: "failed",
        resultCode: result.resultCode,
        resultDesc: result.resultDesc,
        callbackPayload: payload as Record<string, unknown>,
        completedAt: now,
      })
      .where(eq(shopPaymentAttempt.id, current.id));
    return true;
  });

  return { handled };
}

async function syncPendingPayment(orderId: string) {
  const [attempt] = await db
    .select()
    .from(shopPaymentAttempt)
    .where(and(eq(shopPaymentAttempt.orderId, orderId), eq(shopPaymentAttempt.status, "pending")))
    .orderBy(desc(shopPaymentAttempt.createdAt))
    .limit(1);
  if (!attempt) return;
  const now = new Date();
  if (secondsSince(attempt.createdAt, now) < QUERY_AFTER_SECONDS) return;
  if (attempt.lastQueriedAt && secondsSince(attempt.lastQueriedAt, now) < QUERY_EVERY_SECONDS) return;

  const [claimed] = await db
    .update(shopPaymentAttempt)
    .set({ lastQueriedAt: now })
    .where(
      and(
        eq(shopPaymentAttempt.id, attempt.id),
        eq(shopPaymentAttempt.status, "pending"),
        attempt.lastQueriedAt
          ? eq(shopPaymentAttempt.lastQueriedAt, attempt.lastQueriedAt)
          : sql`${shopPaymentAttempt.lastQueriedAt} is null`,
      ),
    )
    .returning({ id: shopPaymentAttempt.id });
  if (!claimed) return;

  let result: Awaited<ReturnType<typeof queryStkPush>>;
  try {
    result = await queryStkPush(attempt.checkoutRequestId);
  } catch {
    return;
  }

  if (result.state === "processing") {
    if (secondsSince(attempt.createdAt, now) > GIVE_UP_AFTER_SECONDS) {
      await db
        .update(shopPaymentAttempt)
        .set({ status: "failed", resultCode: NO_REPLY_CODE, resultDesc: "No response from M-Pesa", completedAt: now })
        .where(and(eq(shopPaymentAttempt.id, attempt.id), eq(shopPaymentAttempt.status, "pending")));
    }
    return;
  }

  await db.transaction(async (tx) => {
    await lockOrder(tx, attempt.orderId);
    const current = await tx.query.shopPaymentAttempt.findFirst({
      where: eq(shopPaymentAttempt.id, attempt.id),
    });
    if (!current || current.status !== "pending") return;
    if (result.resultCode === 0) {
      await tx
        .update(shopPaymentAttempt)
        .set({ status: "succeeded", resultCode: 0, resultDesc: result.resultDesc, completedAt: now })
        .where(eq(shopPaymentAttempt.id, current.id));
      await confirmOrderPaid(tx, current.orderId, {
        receipt: null,
        amountKes: current.amountKes,
        checkoutRequestId: current.checkoutRequestId,
      });
    } else if (FINAL_FAILURE_CODES.has(result.resultCode) || result.resultCode > 0) {
      await tx
        .update(shopPaymentAttempt)
        .set({ status: "failed", resultCode: result.resultCode, resultDesc: result.resultDesc, completedAt: now })
        .where(eq(shopPaymentAttempt.id, current.id));
    }
  });
}

function maskPhone(phoneE164: string) {
  const local = `0${phoneE164.slice(4)}`;
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`;
}

export async function getPublicOrder(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const load = () =>
    db.query.shopOrder.findFirst({
      where: eq(shopOrder.publicToken, token),
      with: {
        items: true,
        attempts: { orderBy: [desc(shopPaymentAttempt.createdAt)] },
      },
    });

  let order = await load();
  if (!order) return null;
  if (order.status === "awaiting_payment") {
    if (order.holdExpiresAt <= new Date()) await releaseExpiredHolds(order.id);
    await syncPendingPayment(order.id);
    order = (await load()) ?? order;
  }

  const latest = order.attempts[0] ?? null;
  const now = new Date();
  const awaiting = order.status === "awaiting_payment";
  const canRetry =
    awaiting &&
    order.holdExpiresAt > now &&
    order.attempts.length < MAX_PAYMENT_ATTEMPTS &&
    (!latest || latest.status !== "pending" || secondsSince(latest.createdAt, now) >= RESEND_COOLDOWN_SECONDS);

  return {
    code: order.code,
    status: order.status as ShopOrderStatus,
    fulfilment: order.fulfilment,
    customerName: order.customerName,
    phone: maskPhone(order.phoneE164),
    deliveryAreaName: order.deliveryAreaName,
    deliveryAddress: order.deliveryAddress,
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      option: item.optionLabel,
      quantity: item.quantity,
      lineTotalKes: item.lineTotalKes,
    })),
    itemsTotalKes: order.itemsTotalKes,
    deliveryFeeKes: order.deliveryFeeKes,
    totalKes: order.totalKes,
    receipt: order.mpesaReceipt,
    paidAt: order.paidAt?.toISOString() ?? null,
    holdExpiresAt: order.holdExpiresAt.toISOString(),
    payment: latest
      ? {
          state: latest.status,
          message: latest.status === "failed" ? paymentFailureMessage(latest.resultCode) : null,
        }
      : null,
    canRetry,
    attemptsLeft: Math.max(0, MAX_PAYMENT_ATTEMPTS - order.attempts.length),
  };
}

export type PublicOrder = NonNullable<Awaited<ReturnType<typeof getPublicOrder>>>;

export async function retryPaymentByToken(token: string) {
  const order = await db.query.shopOrder.findFirst({ where: eq(shopOrder.publicToken, token) });
  if (!order) throw new ShopError("Order not found.");
  await sendPaymentPrompt(order.id);
}

export async function moveOrder(orderId: string, to: ShopOrderStatus, actor: Actor) {
  if (to === "cancelled") throw new ShopError("Use cancel to cancel an order.");
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new ShopError("Order not found.");
    if (!canMoveOrder(order.status, to, order.fulfilment)) {
      throw new ShopError("This order can't move to that stage. Refresh the page and try again.");
    }
    const now = new Date();
    await tx
      .update(shopOrder)
      .set({ status: to, statusChangedAt: now, updatedAt: now, needsAttention: null })
      .where(eq(shopOrder.id, order.id));
    await audit(tx, actor.id, "shop_order.status_changed", "shop_order", order.id, {
      code: order.code,
      from: order.status,
      to,
    });
  });
}

export async function cancelOrder(orderId: string, reason: string, actor: Actor) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) throw new ShopError("Order not found.");
    if (!canMoveOrder(order.status, "cancelled", order.fulfilment)) {
      throw new ShopError("This order can't be cancelled any more.");
    }
    if (order.status !== "awaiting_payment" && actor.role !== "owner") {
      throw new ShopError("Only the owner can cancel an order that has been paid.");
    }
    const now = new Date();
    if (order.saleId) {
      await tx
        .update(sale)
        .set({ status: "void", voidedAt: now, voidReason: `Online order cancelled: ${reason}`, updatedAt: now })
        .where(and(eq(sale.id, order.saleId), eq(sale.status, "completed")));
      await tx.update(payment).set({ status: "reversed" }).where(eq(payment.saleId, order.saleId));
      await audit(tx, actor.id, "sale.voided", "sale", order.saleId, {
        reference: order.code,
        reason,
        totalKes: order.totalKes,
      });
    }
    await restoreStock(tx, order.id);
    await tx
      .update(shopOrder)
      .set({ status: "cancelled", cancelReason: reason, statusChangedAt: now, updatedAt: now })
      .where(eq(shopOrder.id, order.id));
    await audit(tx, actor.id, "shop_order.cancelled", "shop_order", order.id, {
      code: order.code,
      reason,
      wasPaid: Boolean(order.paidAt),
    });
  });
  markShopStale();
}

async function uniqueSlug(tx: Tx, name: string, excludeId?: string) {
  const base = slugify(name);
  const taken = await tx
    .select({ id: shopProduct.id, slug: shopProduct.slug })
    .from(shopProduct)
    .where(sql`${shopProduct.slug} = ${base} or ${shopProduct.slug} like ${`${base}-%`}`);
  const used = new Set(taken.filter((row) => row.id !== excludeId).map((row) => row.slug));
  if (!used.has(base)) return base;
  for (let index = 2; ; index += 1) {
    if (!used.has(`${base}-${index}`)) return `${base}-${index}`;
  }
}

export async function saveProduct(
  input: ProductInput,
  imagePath: string | null,
  colourPhotos: Record<string, string>,
  actor: Actor,
) {
  if (!input.id && actor.role !== "owner") {
    throw new ShopError("Only the owner can add new products.");
  }
  return db.transaction(async (tx) => {
    const id = input.id ?? crypto.randomUUID();
    const existing = input.id
      ? await tx.query.shopProduct.findFirst({
          where: eq(shopProduct.id, input.id),
          with: { options: true, colours: true },
        })
      : null;
    if (input.id && !existing) throw new ShopError("Product not found.");

    const isOwner = actor.role === "owner";
    const now = new Date();
    const ownerOnly = isOwner || !existing ? input : existing;
    const values = {
      name: input.name,
      slug: existing?.name === input.name ? existing.slug : await uniqueSlug(tx, input.name, id),
      description: input.description,
      priceKes: ownerOnly.priceKes,
      imageAlt: input.imageAlt || input.name,
      featured: ownerOnly.featured,
      active: ownerOnly.active,
      sortOrder: ownerOnly.sortOrder,
      updatedAt: now,
      ...(imagePath ? { imagePath } : {}),
    };

    if (existing) {
      await tx.update(shopProduct).set(values).where(eq(shopProduct.id, id));
    } else {
      await tx.insert(shopProduct).values({ id, ...values });
    }

    const currentColours = existing?.colours ?? [];
    const replacedPaths: string[] = [];
    if (imagePath && existing?.imagePath && existing.imagePath !== imagePath) replacedPaths.push(existing.imagePath);
    const colourIds = new Map<string, string>();

    if (isOwner) {
      for (const [index, colour] of input.colours.entries()) {
        const current = colour.id ? currentColours.find((item) => item.id === colour.id) : undefined;
        const photo = colourPhotos[colour.key];
        if (input.colours.length > 1 && !photo && !current?.imagePath) {
          throw new ShopError(`Add a photo for ${colour.name} so customers see the right colour.`);
        }
        const colourValues = {
          name: colour.name,
          imageAlt: colour.imageAlt || `${input.name} in ${colour.name}`,
          sortOrder: index,
          updatedAt: now,
          ...(photo ? { imagePath: photo } : {}),
        };
        if (current) {
          await tx.update(shopProductColour).set(colourValues).where(eq(shopProductColour.id, current.id));
          if (photo && current.imagePath && current.imagePath !== photo) replacedPaths.push(current.imagePath);
          colourIds.set(colour.key, current.id);
        } else {
          const colourId = crypto.randomUUID();
          await tx.insert(shopProductColour).values({ id: colourId, productId: id, ...colourValues });
          colourIds.set(colour.key, colourId);
        }
      }

      const keepIds = input.options.flatMap((option) => (option.id ? [option.id] : []));
      const currentIds = existing?.options.map((option) => option.id) ?? [];
      const removed = currentIds.filter((optionId) => !keepIds.includes(optionId));
      if (removed.length) {
        await tx.delete(shopProductOption).where(inArray(shopProductOption.id, removed));
      }
      for (const [index, option] of input.options.entries()) {
        const colourId = option.colourKey ? (colourIds.get(option.colourKey) ?? null) : null;
        if (option.id && currentIds.includes(option.id)) {
          await tx
            .update(shopProductOption)
            .set({ colourId, label: option.label, stock: option.stock, sortOrder: index, updatedAt: now })
            .where(eq(shopProductOption.id, option.id));
        } else {
          await tx.insert(shopProductOption).values({
            id: crypto.randomUUID(),
            productId: id,
            colourId,
            label: option.label,
            stock: option.stock,
            sortOrder: index,
          });
        }
      }

      const keepColourIds = new Set(colourIds.values());
      const removedColours = currentColours.filter((colour) => !keepColourIds.has(colour.id));
      if (removedColours.length) {
        await tx.delete(shopProductColour).where(
          inArray(
            shopProductColour.id,
            removedColours.map((colour) => colour.id),
          ),
        );
        replacedPaths.push(...removedColours.flatMap((colour) => (colour.imagePath ? [colour.imagePath] : [])));
      }
    } else {
      for (const colour of input.colours) {
        const current = colour.id ? currentColours.find((item) => item.id === colour.id) : undefined;
        const photo = colourPhotos[colour.key];
        if (!current || !photo) continue;
        await tx
          .update(shopProductColour)
          .set({ imagePath: photo, updatedAt: now })
          .where(eq(shopProductColour.id, current.id));
        if (current.imagePath && current.imagePath !== photo) replacedPaths.push(current.imagePath);
      }
    }

    const colourNames = new Map(input.colours.map((colour) => [colour.key, colour.name]));
    await audit(tx, actor.id, existing ? "shop_product.updated" : "shop_product.created", "shop_product", id, {
      name: input.name,
      priceKes: values.priceKes,
      ...(isOwner
        ? {
            stock: input.options.map(
              (option) =>
                `${variantLabel(option.colourKey ? colourNames.get(option.colourKey) : null, option.label) ?? option.label}: ${option.stock}`,
            ),
          }
        : {}),
      photoReplaced: Boolean(imagePath) || Object.keys(colourPhotos).length > 0,
    });
    return { id, replacedPaths };
  });
}

export async function saveDeliveryArea(input: DeliveryAreaInput, actor: Actor) {
  if (actor.role !== "owner") throw new ShopError("Only the owner can change delivery areas.");
  const id = input.id ?? crypto.randomUUID();
  await db.transaction(async (tx) => {
    const values = {
      name: input.name,
      feeKes: input.feeKes,
      sortOrder: input.sortOrder,
      active: input.active,
      updatedAt: new Date(),
    };
    if (input.id) {
      const [updated] = await tx
        .update(deliveryArea)
        .set(values)
        .where(eq(deliveryArea.id, id))
        .returning({ id: deliveryArea.id });
      if (!updated) throw new ShopError("Delivery area not found.");
    } else {
      await tx.insert(deliveryArea).values({ id, ...values });
    }
    await audit(tx, actor.id, input.id ? "delivery_area.updated" : "delivery_area.created", "delivery_area", id, {
      name: input.name,
      feeKes: input.feeKes,
      active: input.active,
    });
  });
  return { id };
}
