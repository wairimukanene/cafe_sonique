import "server-only";

import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";

import { requireOwner, requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  cafeSetting,
  customer,
  expense,
  expenseCategory,
  inventoryItem,
  inventoryMovement,
  loyaltyEntry,
  menuCategory,
  menuItem,
  mpesaSettlement,
  payment,
  paymentMpesa,
  recipeLine,
  reconciliationSession,
  sale,
  saleLineItem,
} from "@/lib/db/schema";
import {
  DEFAULT_LOYALTY_CAP_KES,
  DEFAULT_LOYALTY_VISITS,
  NAIROBI_TIME_ZONE,
} from "@/lib/operations/domain";

export async function getSalesWorkspace() {
  await requireStaff();
  const [menu, recentSales, loyaltyCustomers] = await Promise.all([
    db.query.menuCategory.findMany({
      where: eq(menuCategory.active, true),
      orderBy: [asc(menuCategory.sortOrder), asc(menuCategory.name)],
      with: {
        items: {
          where: and(eq(menuItem.active, true), eq(menuItem.available, true)),
          orderBy: [asc(menuItem.sortOrder), asc(menuItem.name)],
        },
      },
    }),
    db.query.sale.findMany({
      where: eq(sale.status, "completed"),
      orderBy: [desc(sale.completedAt)],
      limit: 50,
      with: { lines: true, discounts: true, payments: { with: { mpesa: true } } },
    }),
    db
      .select({
        id: customer.id,
        phone: customer.phoneE164,
        name: customer.displayName,
        points: customer.loyaltyBalance,
      })
      .from(customer)
      .orderBy(desc(customer.updatedAt))
      .limit(100),
  ]);
  return {
    menu,
    items: menu.flatMap((category) => category.items),
    recentSales,
    sales: recentSales,
    loyaltyCustomers,
  };
}

export async function getExpenseWorkspace() {
  await requireStaff();
  const [categories, expenses] = await Promise.all([
    db.query.expenseCategory.findMany({
      where: eq(expenseCategory.active, true),
      orderBy: [asc(expenseCategory.sortOrder), asc(expenseCategory.name)],
    }),
    db.query.expense.findMany({
      orderBy: [desc(expense.incurredAt)],
      limit: 100,
      with: { category: true, receipts: true },
    }),
  ]);
  return {
    categories,
    expenses: expenses.map((row) => ({
      ...row,
      categoryName: (row.category as { name: string }).name,
    })),
  };
}

export async function getReconciliationWorkspace() {
  await requireOwner();
  const [sessions, unreconciledPayments, entries] = await Promise.all([
    db
      .select()
      .from(reconciliationSession)
      .orderBy(desc(reconciliationSession.createdAt))
      .limit(50),
    db
      .select({
        paymentId: payment.id,
        amountKes: payment.amountKes,
        recordedAt: payment.recordedAt,
        receiptNumber: paymentMpesa.receiptNumber,
        tillNumber: paymentMpesa.tillNumber,
      })
      .from(payment)
      .innerJoin(paymentMpesa, eq(paymentMpesa.paymentId, payment.id))
      .where(eq(payment.status, "recorded"))
      .orderBy(desc(payment.recordedAt))
      .limit(500),
    db
      .select({
        id: mpesaSettlement.id,
        receiptRef: mpesaSettlement.receiptNumber,
        statementAmountKes: mpesaSettlement.amountKes,
        transactedAt: mpesaSettlement.settledAt,
        status: mpesaSettlement.status,
        matchedPaymentId: mpesaSettlement.matchedPaymentId,
      })
      .from(mpesaSettlement)
      .orderBy(desc(mpesaSettlement.settledAt))
      .limit(500),
  ]);
  return { sessions, unreconciledPayments, entries };
}

type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";
type ReportOptions = {
  period?: ReportPeriod;
  date?: Date;
  start?: Date;
  end?: Date;
  from?: string;
  to?: string;
};

function nairobiDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NAIROBI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function nairobiMidnight(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -3));
}

export function resolveNairobiReportRange(options: ReportOptions = {}) {
  const period = options.period ?? "daily";
  if (period === "custom") {
    const customStart = options.start ?? (options.from ? new Date(`${options.from}T12:00:00Z`) : null);
    const customEnd = options.end ?? (options.to ? new Date(`${options.to}T12:00:00Z`) : null);
    if (!customStart || !customEnd) {
      throw new Error("A custom report requires start and end dates.");
    }
    const startParts = nairobiDateParts(customStart);
    const endParts = nairobiDateParts(customEnd);
    const start = nairobiMidnight(startParts.year, startParts.month, startParts.day);
    const end = nairobiMidnight(endParts.year, endParts.month, endParts.day + 1);
    if (end <= start) throw new Error("Report end must not precede its start.");
    return { period, start, end };
  }

  const parts = nairobiDateParts(options.date ?? new Date());
  let start = nairobiMidnight(parts.year, parts.month, parts.day);
  if (period === "weekly") {
    const localWeekday = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day),
    ).getUTCDay();
    const mondayOffset = (localWeekday + 6) % 7;
    start = new Date(start.getTime() - mondayOffset * 86_400_000);
  } else if (period === "monthly") {
    start = nairobiMidnight(parts.year, parts.month, 1);
  }
  const end =
    period === "daily"
      ? new Date(start.getTime() + 86_400_000)
      : period === "weekly"
        ? new Date(start.getTime() + 7 * 86_400_000)
        : nairobiMidnight(parts.year, parts.month + 1, 1);
  return { period, start, end };
}

export async function getDailyOperationsSummary() {
  await requireStaff();
  const range = resolveNairobiReportRange({ period: "daily" });
  const [salesRows, expenseRows, paymentRows, loyaltyRows, stockRows] =
    await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          totalKes: sql<number>`coalesce(sum(${sale.totalKes}), 0)::int`,
        })
        .from(sale)
        .where(
          and(
            eq(sale.status, "completed"),
            gte(sale.completedAt, range.start),
            lt(sale.completedAt, range.end),
          ),
        ),
      db
        .select({ totalKes: sql<number>`coalesce(sum(${expense.amountKes}), 0)::int` })
        .from(expense)
        .where(
          and(
            eq(expense.status, "recorded"),
            gte(expense.incurredAt, range.start),
            lt(expense.incurredAt, range.end),
          ),
        ),
      db
        .select({
          method: payment.method,
          amountKes: sql<number>`coalesce(sum(${payment.amountKes}), 0)::int`,
        })
        .from(payment)
        .innerJoin(sale, eq(sale.id, payment.saleId))
        .where(
          and(
            eq(sale.status, "completed"),
            gte(sale.completedAt, range.start),
            lt(sale.completedAt, range.end),
          ),
        )
        .groupBy(payment.method),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(loyaltyEntry)
        .where(
          and(
            eq(loyaltyEntry.type, "redemption"),
            gte(loyaltyEntry.createdAt, range.start),
            lt(loyaltyEntry.createdAt, range.end),
          ),
        ),
      db
        .select()
        .from(inventoryItem)
        .where(
          and(
            eq(inventoryItem.active, true),
            sql`${inventoryItem.onHand} <= ${inventoryItem.reorderLevel}`,
          ),
        )
        .orderBy(asc(inventoryItem.name)),
    ]);
  const paymentMix = Object.fromEntries(
    paymentRows.map((row) => [row.method, Number(row.amountKes)]),
  );
  return {
    salesCount: Number(salesRows[0]?.count ?? 0),
    salesKes: Number(salesRows[0]?.totalKes ?? 0),
    expensesKes: Number(expenseRows[0]?.totalKes ?? 0),
    cashKes: paymentMix.cash ?? 0,
    mpesaKes: paymentMix.mpesa_buy_goods ?? 0,
    loyaltyRewards: Number(loyaltyRows[0]?.count ?? 0),
    lowStockItems: stockRows,
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function getReportsData(options: ReportOptions = {}) {
  await requireOwner();
  const range = resolveNairobiReportRange(options);
  const completedSales = and(
    eq(sale.status, "completed"),
    gte(sale.completedAt, range.start),
    lt(sale.completedAt, range.end),
  );
  const recordedExpenses = and(
    eq(expense.status, "recorded"),
    gte(expense.incurredAt, range.start),
    lt(expense.incurredAt, range.end),
  );

  const [
    saleRows,
    expenseRows,
    products,
    payments,
    loyaltyRows,
    reconciliationRows,
  ] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        grossKes: sql<number>`coalesce(sum(${sale.subtotalKes}), 0)::int`,
        discountsKes: sql<number>`coalesce(sum(${sale.discountTotalKes}), 0)::int`,
        netKes: sql<number>`coalesce(sum(${sale.totalKes}), 0)::int`,
      })
      .from(sale)
      .where(completedSales),
    db
      .select({
        count: sql<number>`count(*)::int`,
        totalKes: sql<number>`coalesce(sum(${expense.amountKes}), 0)::int`,
      })
      .from(expense)
      .where(recordedExpenses),
    db
      .select({
        menuItemId: saleLineItem.menuItemId,
        name: saleLineItem.nameSnapshot,
        quantity: sql<number>`sum(${saleLineItem.quantity})::int`,
        grossKes: sql<number>`sum(${saleLineItem.lineTotalKes})::int`,
      })
      .from(saleLineItem)
      .innerJoin(sale, eq(sale.id, saleLineItem.saleId))
      .where(completedSales)
      .groupBy(saleLineItem.menuItemId, saleLineItem.nameSnapshot)
      .orderBy(desc(sql`sum(${saleLineItem.quantity})`)),
    db
      .select({
        method: payment.method,
        count: sql<number>`count(*)::int`,
        amountKes: sql<number>`coalesce(sum(${payment.amountKes}), 0)::int`,
      })
      .from(payment)
      .innerJoin(sale, eq(sale.id, payment.saleId))
      .where(completedSales)
      .groupBy(payment.method),
    db
      .select({
        costKes: sql<number>`coalesce(sum(${loyaltyEntry.rewardCostKes}), 0)::int`,
        redemptions: sql<number>`count(*)::int`,
      })
      .from(loyaltyEntry)
      .where(
        and(
          eq(loyaltyEntry.type, "redemption"),
          gte(loyaltyEntry.createdAt, range.start),
          lt(loyaltyEntry.createdAt, range.end),
        ),
      ),
    db
      .select({
        differenceKes: sql<number>`coalesce(sum(${reconciliationSession.differenceKes}), 0)::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(reconciliationSession)
      .where(
        and(
          gte(reconciliationSession.createdAt, range.start),
          lt(reconciliationSession.createdAt, range.end),
        ),
      ),
  ]);

  const sales = saleRows[0] ?? { count: 0, grossKes: 0, discountsKes: 0, netKes: 0 };
  const expenses = expenseRows[0] ?? { count: 0, totalKes: 0 };
  const loyalty = loyaltyRows[0] ?? { costKes: 0, redemptions: 0 };
  const reconciliation = reconciliationRows[0] ?? {
    differenceKes: 0,
    sessions: 0,
  };
  const csvText = [
    ["Product", "Quantity", "Gross KES"].map(csvCell).join(","),
    ...products.map((product) =>
      [product.name, product.quantity, product.grossKes].map(csvCell).join(","),
    ),
  ].join("\r\n");

  return {
    timeZone: NAIROBI_TIME_ZONE,
    range,
    sales,
    expenses,
    loyalty,
    reconciliation,
    netAfterExpensesKes: Number(sales.netKes) - Number(expenses.totalKes),
    summary: {
      grossSalesKes: Number(sales.grossKes),
      discountsKes: Number(sales.discountsKes),
      expensesKes: Number(expenses.totalKes),
      netKes: Number(sales.netKes) - Number(expenses.totalKes),
    },
    products: products.map((product) => ({
      ...product,
      revenueKes: product.grossKes,
    })),
    payments,
    csvText,
  };
}

export async function getLoyaltyWorkspace(phone?: string) {
  await requireStaff();
  if (!phone) return { customer: null, customers: [], entries: [] };
  const normalizedPhone = phone.replace(/[\s()-]/g, "").replace(/^0/, "+254");
  const matchedCustomer = await db.query.customer.findFirst({
    where: eq(customer.phoneE164, normalizedPhone),
  });
  if (!matchedCustomer) return { customer: null, customers: [], entries: [] };
  const entries = await db
    .select()
    .from(loyaltyEntry)
    .where(eq(loyaltyEntry.customerId, matchedCustomer.id))
    .orderBy(desc(loyaltyEntry.createdAt))
    .limit(100);
  const displayCustomer = {
    ...matchedCustomer,
    phone: matchedCustomer.phoneE164,
    name: matchedCustomer.displayName,
    points: matchedCustomer.loyaltyBalance,
  };
  return { customer: displayCustomer, customers: [displayCustomer], entries };
}

export async function getInventoryWorkspace() {
  await requireStaff();
  const [items, movements, recipes, recipeItems] = await Promise.all([
    db.select().from(inventoryItem).orderBy(asc(inventoryItem.name)),
    db
      .select({
        id: inventoryMovement.id,
        itemName: inventoryItem.name,
        type: inventoryMovement.reason,
        quantity: inventoryMovement.delta,
        reason: inventoryMovement.note,
        createdAt: inventoryMovement.createdAt,
      })
      .from(inventoryMovement)
      .innerJoin(inventoryItem, eq(inventoryItem.id, inventoryMovement.inventoryItemId))
      .orderBy(desc(inventoryMovement.createdAt))
      .limit(200),
    db
      .select({
        id: recipeLine.id,
        menuItemId: recipeLine.menuItemId,
        menuItemName: menuItem.name,
        inventoryItemId: recipeLine.inventoryItemId,
        quantity: recipeLine.quantity,
      })
      .from(recipeLine)
      .innerJoin(menuItem, eq(menuItem.id, recipeLine.menuItemId))
      .orderBy(asc(menuItem.name)),
    db
      .select({ id: menuItem.id, name: menuItem.name })
      .from(menuItem)
      .where(eq(menuItem.active, true))
      .orderBy(asc(menuItem.name)),
  ]);
  return {
    items: items.map((item) => ({ ...item, quantityOnHand: item.onHand })),
    lowStockItems: items.filter((item) => item.active && item.onHand <= item.reorderLevel),
    movements,
    recipes,
    recipeItems,
  };
}

export async function getOperationsSettings() {
  await requireOwner();
  const rows = await db
    .select()
    .from(cafeSetting)
    .where(sql`${cafeSetting.key} like 'operations.%'`);
  const settings = new Map(rows.map((row) => [row.key, row.value]));
  return {
    tillNumber: String(settings.get("operations.till_number") ?? ""),
    loyaltyVisitsRequired: Number(
      settings.get("operations.loyalty_visits_required") ?? DEFAULT_LOYALTY_VISITS,
    ),
    loyaltyRewardCapKes: Number(
      settings.get("operations.loyalty_reward_cap_kes") ?? DEFAULT_LOYALTY_CAP_KES,
    ),
  };
}
