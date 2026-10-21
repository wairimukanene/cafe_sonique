import { readFileSync } from "node:fs";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  auditLog,
  booking,
  customer,
  inventoryItem,
  inventoryMovement,
  loyaltyEntry,
  payment,
  paymentMpesa,
  sale,
  saleDiscount,
  saleLineItem,
  recipeLine,
  menuCategory,
  menuItem,
} from "../src/lib/db/schema";

vi.mock("server-only", () => ({}));

let database: typeof import("../src/lib/db/client")["db"];
let client: typeof import("../src/lib/db/client")["sqlClient"];

function loadLocalEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const separator = line.indexOf("=");
    if (separator > 0) {
      process.env[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
}

beforeAll(async () => {
  loadLocalEnv();
  const databaseModule = await import("../src/lib/db/client");
  database = databaseModule.db;
  client = databaseModule.sqlClient;
});

afterAll(async () => {
  if (!database || !client) return;
  const testSales = await database
    .select({ id: sale.id })
    .from(sale)
    .where(like(sale.idempotencyKey, "vitest-operations-%"));
  const saleIds = testSales.map((row) => row.id);
  if (saleIds.length) {
    const testPayments = await database
      .select({ id: payment.id })
      .from(payment)
      .where(inArray(payment.saleId, saleIds));
    const paymentIds = testPayments.map((row) => row.id);
    if (paymentIds.length) {
      await database.delete(paymentMpesa).where(inArray(paymentMpesa.paymentId, paymentIds));
      await database.delete(payment).where(inArray(payment.id, paymentIds));
    }
    await database.delete(saleDiscount).where(inArray(saleDiscount.saleId, saleIds));
    await database.delete(saleLineItem).where(inArray(saleLineItem.saleId, saleIds));
    await database.delete(loyaltyEntry).where(inArray(loyaltyEntry.saleId, saleIds));
    await database
      .delete(inventoryMovement)
      .where(inArray(inventoryMovement.referenceId, saleIds));
    await database.delete(auditLog).where(inArray(auditLog.entityId, saleIds));
    await database.delete(sale).where(inArray(sale.id, saleIds));
  }
  await database.delete(recipeLine).where(eq(recipeLine.id, "test-recipe-espresso"));
  await database
    .delete(inventoryMovement)
    .where(eq(inventoryMovement.inventoryItemId, "test-inventory-beans"));
  await database.delete(inventoryItem).where(eq(inventoryItem.id, "test-inventory-beans"));
  await database.delete(loyaltyEntry).where(eq(loyaltyEntry.customerId, "test-loyalty-customer"));
  await database.delete(customer).where(eq(customer.phoneE164, "+254700000001"));
  await database.delete(customer).where(eq(customer.phoneE164, "+254700000002"));
  await database.delete(customer).where(eq(customer.phoneE164, "+254700000003"));
  await database.delete(auditLog).where(eq(auditLog.entityId, "test-booking"));
  await database.delete(booking).where(eq(booking.id, "test-booking"));
  await database.delete(menuItem).where(eq(menuItem.id, "test-menu-item"));
  await database.delete(menuCategory).where(eq(menuCategory.id, "test-menu-category"));
  await client.end({ timeout: 1 });
});

describe("PostgreSQL operational integrity", () => {
  it("persists a booking together with a traceable audit entry", async () => {
    await database.transaction(async (tx) => {
      await tx.insert(booking).values({
        id: "test-booking",
        name: "Automated Test",
        contact: "test@example.com",
        eventType: "Listening session",
        preferredDate: new Date("2027-01-01T09:00:00Z"),
      });
      await tx.insert(auditLog).values({
        id: "test-audit",
        action: "booking.created",
        entityType: "booking",
        entityId: "test-booking",
        metadata: { source: "integration-test" },
      });
    });

    const savedBooking = await database.query.booking.findFirst({
      where: eq(booking.id, "test-booking"),
    });
    const savedAudit = await database.query.auditLog.findFirst({
      where: eq(auditLog.entityId, "test-booking"),
    });

    expect(savedBooking?.status).toBe("new");
    expect(savedAudit?.action).toBe("booking.created");
  });

  it("supports publishing only active and available menu items", async () => {
    await database.insert(menuCategory).values({
      id: "test-menu-category",
      name: "Test category",
      slug: "test-category",
    });
    await database.insert(menuItem).values({
      id: "test-menu-item",
      categoryId: "test-menu-category",
      name: "Test coffee",
      description: "For integration testing",
      priceKes: 300,
      available: true,
      active: true,
    });

    const published = await database.query.menuItem.findMany({
      where: and(eq(menuItem.active, true), eq(menuItem.available, true)),
    });

    expect(published.some((item) => item.id === "test-menu-item")).toBe(true);
  });

  it("completes sales atomically, deduplicates retries and blocks duplicate M-Pesa refs", async () => {
    const { completeSale } = await import("../src/lib/operations/service");
    const actor = await database.query.user.findFirst({
      where: (users, { eq: equals }) =>
        equals(users.email, "owner@cafesonique.local"),
    });
    expect(actor).toBeTruthy();

    const base = {
      items: [{ menuItemId: "item-espresso", quantity: 1 }],
      paymentMethod: "mpesa_buy_goods" as const,
      paymentAmountKes: 250,
      mpesaReceiptNumber: "VITEST26001",
      customerPhone: "+254700000003",
    };
    const first = await completeSale(
      { ...base, idempotencyKey: "vitest-operations-primary" },
      actor!.id,
    );
    const retry = await completeSale(
      { ...base, idempotencyKey: "vitest-operations-primary" },
      actor!.id,
    );

    expect(retry).toMatchObject({ id: first.id, idempotent: true });
    expect(
      await database.query.auditLog.findFirst({
        where: eq(auditLog.entityId, first.id),
      }),
    ).toMatchObject({ action: "sale.completed" });

    await expect(
      completeSale(
        {
          ...base,
          idempotencyKey: "vitest-operations-duplicate-mpesa",
        },
        actor!.id,
      ),
    ).rejects.toBeTruthy();
  });

  it("redeems the sixth drink and reverses recipe stock when a sale is voided", async () => {
    const { completeSale, voidSale } = await import("../src/lib/operations/service");
    const actor = await database.query.user.findFirst({
      where: (users, { eq: equals }) =>
        equals(users.email, "owner@cafesonique.local"),
    });
    expect(actor).toBeTruthy();

    await database.insert(inventoryItem).values({
      id: "test-inventory-beans",
      name: "Test beans",
      sku: "VITEST-BEANS",
      unit: "dose",
      onHand: 10,
      reorderLevel: 2,
    });
    await database.insert(recipeLine).values({
      id: "test-recipe-espresso",
      menuItemId: "item-espresso",
      inventoryItemId: "test-inventory-beans",
      quantity: 1,
    });

    const sales = [];
    for (let visit = 1; visit <= 5; visit += 1) {
      sales.push(
        await completeSale(
          {
            idempotencyKey: `vitest-operations-loyalty-${visit}`,
            items: [{ menuItemId: "item-espresso", quantity: 1 }],
            paymentMethod: "cash",
            paymentAmountKes: 250,
            customerPhone: "+254700000001",
          },
          actor!.id,
        ),
      );
    }
    const reward = await completeSale(
      {
        idempotencyKey: "vitest-operations-loyalty-6",
        items: [{ menuItemId: "item-espresso", quantity: 1 }],
        paymentMethod: "cash",
        paymentAmountKes: 0,
        customerPhone: "+254700000001",
        loyaltyMenuItemId: "item-espresso",
      },
      actor!.id,
    );

    const loyaltyCustomer = await database.query.customer.findFirst({
      where: eq(customer.phoneE164, "+254700000001"),
    });
    expect(loyaltyCustomer?.loyaltyBalance).toBe(0);
    expect(
      await database.query.loyaltyEntry.findFirst({
        where: and(
          eq(loyaltyEntry.saleId, reward.id),
          eq(loyaltyEntry.type, "redemption"),
        ),
      }),
    ).toMatchObject({ visitDelta: -5, rewardCostKes: 250 });

    await voidSale(sales[0].id, "Integration reversal test", actor!.id);
    const stock = await database.query.inventoryItem.findFirst({
      where: eq(inventoryItem.id, "test-inventory-beans"),
    });
    expect(stock?.onHand).toBe(5);
    expect(
      await database.query.inventoryMovement.findFirst({
        where: and(
          eq(inventoryMovement.referenceId, sales[0].id),
          eq(inventoryMovement.reason, "void_reversal"),
        ),
      }),
    ).toBeTruthy();
  });

  it("comps one drink on the sixth visit and still charges the rest of the order", async () => {
    const { completeSale } = await import("../src/lib/operations/service");
    const actor = await database.query.user.findFirst({
      where: (users, { eq: equals }) =>
        equals(users.email, "owner@cafesonique.local"),
    });
    expect(actor).toBeTruthy();

    for (let visit = 1; visit <= 5; visit += 1) {
      await completeSale(
        {
          idempotencyKey: `vitest-operations-loyalty-mixed-${visit}`,
          items: [{ menuItemId: "item-espresso", quantity: 1 }],
          paymentMethod: "cash",
          paymentAmountKes: 250,
          customerPhone: "+254700000002",
        },
        actor!.id,
      );
    }

    const reward = await completeSale(
      {
        idempotencyKey: "vitest-operations-loyalty-mixed-6",
        items: [
          { menuItemId: "item-espresso", quantity: 2 },
          { menuItemId: "item-flat-white", quantity: 1 },
        ],
        paymentMethod: "cash",
        paymentAmountKes: 250 + 380,
        customerPhone: "+254700000002",
        loyaltyMenuItemId: "item-espresso",
      },
      actor!.id,
    );

    expect(reward.totalKes).toBe(630);
    const saved = await database.query.customer.findFirst({
      where: eq(customer.phoneE164, "+254700000002"),
    });
    expect(saved?.loyaltyBalance).toBe(0);
  });
});
