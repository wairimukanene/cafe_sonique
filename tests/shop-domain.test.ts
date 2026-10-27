import { describe, expect, it } from "vitest";

import {
  canMoveOrder,
  checkoutSchema,
  groupCartLines,
  MAX_LINE_QUANTITY,
  nairobiTimestamp,
  parseStkCallback,
  paymentFailureMessage,
  productSchema,
  ShopError,
  slugify,
  stkPassword,
  variantLabel,
  DEFAULT_OPTION_LABEL,
} from "../src/lib/shop/domain";

const baseCheckout = {
  idempotencyKey: "0f4b2c1e-7a7d-4c1a-9c61-1d2e3f4a5b6c",
  items: [{ optionId: "shop-mug-standard", quantity: 2 }],
  fulfilment: "pickup",
  customerName: "Achieng Otieno",
  phone: "0712 345 678",
};

describe("checkout validation", () => {
  it("accepts a pickup order and normalises the phone", () => {
    const parsed = checkoutSchema.parse(baseCheckout);
    expect(parsed.phone).toBe("+254712345678");
    expect(parsed.deliveryAddress).toBeUndefined();
  });

  it("requires an area and an address for delivery", () => {
    const result = checkoutSchema.safeParse({ ...baseCheckout, fulfilment: "delivery", deliveryAddress: " " });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["deliveryAreaId", "deliveryAddress"]));
  });

  it("rejects an empty bag and silly quantities", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, items: [] }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...baseCheckout, items: [{ optionId: "x", quantity: MAX_LINE_QUANTITY + 1 }] })
        .success,
    ).toBe(false);
  });

  it("rejects non-Kenyan phone numbers", () => {
    expect(checkoutSchema.safeParse({ ...baseCheckout, phone: "+44 7700 900123" }).success).toBe(false);
  });
});

describe("cart grouping", () => {
  it("merges repeated lines", () => {
    const grouped = groupCartLines([
      { optionId: "a", quantity: 2 },
      { optionId: "b", quantity: 1 },
      { optionId: "a", quantity: 3 },
    ]);
    expect(Object.fromEntries(grouped)).toEqual({ a: 5, b: 1 });
  });

  it("refuses more than the per-item limit once merged", () => {
    expect(() =>
      groupCartLines([
        { optionId: "a", quantity: MAX_LINE_QUANTITY },
        { optionId: "a", quantity: 1 },
      ]),
    ).toThrow(ShopError);
  });
});

describe("order stages", () => {
  it("follows the pickup and delivery paths", () => {
    expect(canMoveOrder("paid", "ready_for_pickup", "pickup")).toBe(true);
    expect(canMoveOrder("paid", "out_for_delivery", "pickup")).toBe(false);
    expect(canMoveOrder("paid", "out_for_delivery", "delivery")).toBe(true);
    expect(canMoveOrder("ready_for_pickup", "completed", "pickup")).toBe(true);
    expect(canMoveOrder("out_for_delivery", "completed", "delivery")).toBe(true);
  });

  it("never moves an unpaid order forward or reopens a closed one", () => {
    expect(canMoveOrder("awaiting_payment", "paid", "pickup")).toBe(false);
    expect(canMoveOrder("awaiting_payment", "ready_for_pickup", "pickup")).toBe(false);
    expect(canMoveOrder("awaiting_payment", "cancelled", "pickup")).toBe(true);
    expect(canMoveOrder("completed", "cancelled", "pickup")).toBe(false);
    expect(canMoveOrder("expired", "paid", "delivery")).toBe(false);
  });
});

describe("Daraja helpers", () => {
  it("formats the timestamp in Nairobi time", () => {
    expect(nairobiTimestamp(new Date("2026-10-27T21:05:09Z"))).toBe("20261028000509");
  });

  it("builds the STK password from shortcode, passkey and timestamp", () => {
    const password = stkPassword("174379", "passkey", "20261027120000");
    expect(Buffer.from(password, "base64").toString()).toBe("174379passkey20261027120000");
  });

  it("parses a successful callback", () => {
    const result = parseStkCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: "29115-34620561-1",
          CheckoutRequestID: "ws_CO_191220191020363925",
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 1450.0 },
              { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
              { Name: "TransactionDate", Value: 20191219102115 },
              { Name: "PhoneNumber", Value: 254712345678 },
            ],
          },
        },
      },
    });
    expect(result).toEqual({
      merchantRequestId: "29115-34620561-1",
      checkoutRequestId: "ws_CO_191220191020363925",
      resultCode: 0,
      resultDesc: "The service request is processed successfully.",
      amountKes: 1450,
      receipt: "NLJ7RT61SV",
      phone: "254712345678",
    });
  });

  it("parses a cancelled callback without metadata", () => {
    const result = parseStkCallback({
      Body: {
        stkCallback: {
          MerchantRequestID: "1",
          CheckoutRequestID: "ws_CO_1",
          ResultCode: 1032,
          ResultDesc: "Request cancelled by user",
        },
      },
    });
    expect(result?.resultCode).toBe(1032);
    expect(result?.receipt).toBeNull();
    expect(paymentFailureMessage(1032)).toMatch(/cancelled/);
  });

  it("ignores junk payloads and suspicious receipts", () => {
    expect(parseStkCallback({ hello: "world" })).toBeNull();
    const result = parseStkCallback({
      Body: {
        stkCallback: {
          CheckoutRequestID: "ws_CO_2",
          ResultCode: 0,
          CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "<script>" }] },
        },
      },
    });
    expect(result?.receipt).toBeNull();
  });
});

describe("product editing", () => {
  const product = {
    name: "Sonique tee",
    description: "Heavyweight cotton.",
    priceKes: "2500",
    options: [
      { label: "M", stock: "4" },
      { label: "L", stock: "0" },
    ],
  };

  it("coerces form values", () => {
    const parsed = productSchema.parse(product);
    expect(parsed.priceKes).toBe(2500);
    expect(parsed.options[0].stock).toBe(4);
    expect(parsed.active).toBe(true);
  });

  it("rejects duplicate sizes and negative stock", () => {
    expect(productSchema.safeParse({ ...product, options: [{ label: "M", stock: 1 }, { label: "m", stock: 2 }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, options: [{ label: "M", stock: -1 }] }).success).toBe(false);
  });

  it("allows the same size in different colours, but not twice in one colour", () => {
    const colours = [
      { key: "white", name: "White" },
      { key: "black", name: "Black" },
    ];
    const ok = productSchema.safeParse({
      ...product,
      colours,
      options: [
        { colourKey: "white", label: "M", stock: 2 },
        { colourKey: "black", label: "M", stock: 3 },
      ],
    });
    expect(ok.success).toBe(true);
    expect(
      productSchema.safeParse({
        ...product,
        colours,
        options: [
          { colourKey: "white", label: "M", stock: 2 },
          { colourKey: "white", label: "m", stock: 1 },
          { colourKey: "black", label: "M", stock: 3 },
        ],
      }).success,
    ).toBe(false);
  });

  it("needs every stock row to have a colour, and every colour to have stock rows", () => {
    const colours = [
      { key: "white", name: "White" },
      { key: "black", name: "Black" },
    ];
    expect(
      productSchema.safeParse({ ...product, colours, options: [{ colourKey: "white", label: "M", stock: 1 }] }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        ...product,
        colours,
        options: [
          { colourKey: "white", label: "M", stock: 1 },
          { label: "L", stock: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        ...product,
        colours: [
          { key: "a", name: "White" },
          { key: "b", name: "white" },
        ],
        options: [
          { colourKey: "a", label: "M", stock: 1 },
          { colourKey: "b", label: "M", stock: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("labels variants for the bag and orders", () => {
    expect(variantLabel("White", "M")).toBe("White · M");
    expect(variantLabel("Olive", DEFAULT_OPTION_LABEL)).toBe("Olive");
    expect(variantLabel(null, "L")).toBe("L");
    expect(variantLabel(null, DEFAULT_OPTION_LABEL)).toBeNull();
  });

  it("makes readable slugs", () => {
    expect(slugify("Café Mug — Olive")).toBe("cafe-mug-olive");
    expect(slugify("!!!")).toBe("product");
  });
});
