import { z } from "zod";

import { kenyanPhoneSchema, NAIROBI_TIME_ZONE } from "@/lib/operations/domain";

export const HOLD_MINUTES = 10;
export const MAX_LINE_QUANTITY = 20;
export const MAX_PAYMENT_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 20;
export const DEFAULT_OPTION_LABEL = "Standard";

export type ShopOrderStatus =
  | "awaiting_payment"
  | "paid"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "expired"
  | "cancelled";

export type Fulfilment = "pickup" | "delivery";

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopError";
  }
}

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const checkoutSchema = z
  .object({
    idempotencyKey: z.string().trim().min(16).max(100),
    items: z
      .array(
        z.object({
          optionId: z.string().min(1).max(200),
          quantity: z.coerce.number().int().min(1).max(MAX_LINE_QUANTITY),
        }),
      )
      .min(1, "Your bag is empty.")
      .max(30),
    fulfilment: z.enum(["pickup", "delivery"]),
    deliveryAreaId: optionalText(200),
    deliveryAddress: optionalText(300),
    deliveryNotes: optionalText(300),
    customerName: z.string().trim().min(2, "Please add your name.").max(100),
    phone: kenyanPhoneSchema,
  })
  .superRefine((value, ctx) => {
    if (value.fulfilment !== "delivery") return;
    if (!value.deliveryAreaId) {
      ctx.addIssue({ code: "custom", path: ["deliveryAreaId"], message: "Choose a delivery area." });
    }
    if (!value.deliveryAddress || value.deliveryAddress.length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Add a delivery address the rider can find.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export function groupCartLines(items: CheckoutInput["items"]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    grouped.set(item.optionId, (grouped.get(item.optionId) ?? 0) + item.quantity);
  }
  for (const quantity of grouped.values()) {
    if (quantity > MAX_LINE_QUANTITY) {
      throw new ShopError(`You can order up to ${MAX_LINE_QUANTITY} of each item.`);
    }
  }
  return grouped;
}

export const productColourSchema = z.object({
  key: z.string().min(1).max(200),
  id: z.string().min(1).max(200).optional(),
  name: z.string().trim().min(1, "Give each colour a name.").max(30),
  imageAlt: z.string().trim().max(200).default(""),
});

export const productOptionSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  colourKey: z.string().min(1).max(200).optional(),
  label: z.string().trim().min(1).max(40),
  stock: z.coerce.number().int().min(0).max(100_000),
});

export const productSchema = z
  .object({
    id: z.string().min(1).max(200).optional(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(3).max(400),
    priceKes: z.coerce.number().int().min(1).max(1_000_000),
    imageAlt: z.string().trim().max(200).default(""),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    colours: z.array(productColourSchema).max(12).default([]),
    options: z.array(productOptionSchema).min(1, "Add at least one size or a stock count.").max(60),
  })
  .superRefine((value, ctx) => {
    const colourNames = value.colours.map((colour) => colour.name.toLowerCase());
    if (new Set(colourNames).size !== colourNames.length) {
      ctx.addIssue({ code: "custom", path: ["colours"], message: "Each colour can only be listed once." });
    }
    const colourKeys = new Set(value.colours.map((colour) => colour.key));
    if (value.colours.length && value.options.some((option) => !option.colourKey || !colourKeys.has(option.colourKey))) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Choose a colour for every stock row." });
    }
    if (!value.colours.length && value.options.some((option) => option.colourKey)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Add the colour before using it in a stock row." });
    }
    const variants = value.options.map((option) => `${option.colourKey ?? ""}|${option.label.toLowerCase()}`);
    if (new Set(variants).size !== variants.length) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: value.colours.length
          ? "Each size can only be listed once per colour."
          : "Each size can only be listed once.",
      });
    }
    for (const colour of value.colours) {
      if (!value.options.some((option) => option.colourKey === colour.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["colours"],
          message: `Add at least one stock row for ${colour.name}.`,
        });
      }
    }
  });

export function variantLabel(colourName: string | null | undefined, sizeLabel: string) {
  const parts = [colourName, sizeLabel === DEFAULT_OPTION_LABEL ? null : sizeLabel].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export type ProductInput = z.infer<typeof productSchema>;

export const deliveryAreaSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  name: z.string().trim().min(2).max(80),
  feeKes: z.coerce.number().int().min(0).max(100_000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export type DeliveryAreaInput = z.infer<typeof deliveryAreaSchema>;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";
}

const nextStatuses: Record<ShopOrderStatus, Partial<Record<Fulfilment, ShopOrderStatus[]>>> = {
  awaiting_payment: { pickup: ["cancelled"], delivery: ["cancelled"] },
  paid: { pickup: ["ready_for_pickup", "cancelled"], delivery: ["out_for_delivery", "cancelled"] },
  ready_for_pickup: { pickup: ["completed", "cancelled"] },
  out_for_delivery: { delivery: ["completed", "cancelled"] },
  completed: {},
  expired: {},
  cancelled: {},
};

export function canMoveOrder(from: ShopOrderStatus, to: ShopOrderStatus, fulfilment: Fulfilment) {
  return nextStatuses[from][fulfilment]?.includes(to) ?? false;
}

export const fulfilmentStatuses: ShopOrderStatus[] = ["ready_for_pickup", "out_for_delivery", "completed"];

export const orderStatusLabels: Record<ShopOrderStatus, string> = {
  awaiting_payment: "Waiting for payment",
  paid: "Paid – to pack",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  completed: "Done",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function nairobiTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
}

export function stkPassword(shortCode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString("base64");
}

export function darajaPhone(phoneE164: string) {
  return phoneE164.replace(/^\+/, "");
}

export type StkCallbackResult = {
  merchantRequestId: string | null;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  amountKes: number | null;
  receipt: string | null;
  phone: string | null;
};

const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string().optional(),
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.coerce.number().int(),
      ResultDesc: z.string().default(""),
      CallbackMetadata: z
        .object({
          Item: z
            .array(z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() }))
            .default([]),
        })
        .optional(),
    }),
  }),
});

export function parseStkCallback(payload: unknown): StkCallbackResult | null {
  const parsed = callbackSchema.safeParse(payload);
  if (!parsed.success) return null;
  const callback = parsed.data.Body.stkCallback;
  const items = new Map(
    (callback.CallbackMetadata?.Item ?? []).map((item) => [item.Name, item.Value]),
  );
  const amount = items.get("Amount");
  const receipt = items.get("MpesaReceiptNumber");
  const phone = items.get("PhoneNumber");
  return {
    merchantRequestId: callback.MerchantRequestID ?? null,
    checkoutRequestId: callback.CheckoutRequestID,
    resultCode: callback.ResultCode,
    resultDesc: callback.ResultDesc,
    amountKes: amount === undefined ? null : Math.round(Number(amount)),
    receipt: typeof receipt === "string" && /^[A-Z0-9]{6,20}$/.test(receipt) ? receipt : null,
    phone: phone === undefined ? null : String(phone),
  };
}

export const FINAL_FAILURE_CODES = new Set([1, 1001, 1019, 1025, 1032, 1037, 2001, 9999]);

// Recorded when we stop waiting without any answer from Safaricom. Daraja never uses negative codes.
export const NO_REPLY_CODE = -1;

export function paymentFailureMessage(resultCode: number | null) {
  switch (resultCode) {
    case NO_REPLY_CODE:
      return "We haven't heard back from M-Pesa. If money left your account, don't pay again: this page updates by itself once M-Pesa confirms, or show your M-Pesa message at the bar.";
    case 1032:
      return "The payment was cancelled on the phone.";
    case 1037:
      return "The phone didn't respond in time. Make sure it's on and unlocked.";
    case 2001:
      return "The M-Pesa PIN was incorrect.";
    case 1:
      return "There wasn't enough money in M-Pesa for this payment.";
    default:
      return "The payment didn't go through.";
  }
}
