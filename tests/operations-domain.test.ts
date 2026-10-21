import { describe, expect, it } from "vitest";

import { hasCapability } from "../src/lib/auth/permissions";
import {
  completeSaleSchema,
  normalizeKenyanPhone,
  resolveNairobiReportRange,
} from "../src/lib/operations/domain";

describe("operations domain", () => {
  it("normalizes Kenyan phone numbers without storing display punctuation", () => {
    expect(normalizeKenyanPhone("0712 345 678")).toBe("+254712345678");
    expect(normalizeKenyanPhone("254-712-345-678")).toBe("+254712345678");
  });

  it("validates integer KES sales and M-Pesa references", () => {
    const valid = completeSaleSchema.safeParse({
      idempotencyKey: "sale-request-1",
      items: [{ menuItemId: "espresso", quantity: 2 }],
      paymentMethod: "mpesa_buy_goods",
      paymentAmountKes: 500,
      mpesaReceiptNumber: "ABC12345",
      customerPhone: "0712345678",
    });
    expect(valid.success).toBe(true);
    expect(
      completeSaleSchema.safeParse({
        idempotencyKey: "sale-request-phone",
        items: [{ menuItemId: "espresso", quantity: 1 }],
        paymentMethod: "cash",
        paymentAmountKes: 250,
      }).success,
    ).toBe(false);
    expect(
      completeSaleSchema.safeParse({
        idempotencyKey: "sale-request-2",
        items: [{ menuItemId: "espresso", quantity: 1 }],
        paymentMethod: "mpesa_buy_goods",
        paymentAmountKes: 250.5,
      }).success,
    ).toBe(false);
  });

  it("uses Nairobi calendar boundaries for daily reports", () => {
    const range = resolveNairobiReportRange({
      period: "daily",
      date: new Date("2026-10-11T01:00:00Z"),
    });
    expect(range.start.toISOString()).toBe("2026-10-10T21:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-11T21:00:00.000Z");
  });

  it("keeps financial controls owner-only", () => {
    expect(hasCapability("barista", "record_sale")).toBe(true);
    expect(hasCapability("barista", "reconcile_mpesa")).toBe(false);
    expect(hasCapability("owner", "view_financial_reports")).toBe(true);
  });
});
