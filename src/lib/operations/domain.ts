import { z } from "zod";

export const NAIROBI_TIME_ZONE = "Africa/Nairobi";
export const DEFAULT_LOYALTY_VISITS = 5;
export const DEFAULT_LOYALTY_CAP_KES = 530;

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);

export function normalizeKenyanPhone(value: unknown) {
  if (typeof value !== "string") return value;
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^0[17]\d{8}$/.test(compact)) return `+254${compact.slice(1)}`;
  if (/^254[17]\d{8}$/.test(compact)) return `+${compact}`;
  return compact;
}

export const kenyanPhoneSchema = z.preprocess(
  normalizeKenyanPhone,
  z
    .string()
    .regex(/^\+254[17]\d{8}$/, "Use a Kenyan number, for example 0712345678."),
);

export const completeSaleSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(100),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1).max(200),
          quantity: z.coerce.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(100),
    discountKind: z.enum(["fixed_kes", "percent"]).optional(),
    discountValue: z.coerce.number().int().nonnegative().optional(),
    discountLabel: z.string().trim().min(1).max(100).optional(),
    paymentMethod: z.enum(["cash", "mpesa_buy_goods"]),
    paymentAmountKes: z.coerce.number().int().nonnegative().optional(),
    mpesaReceiptNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{5,20}$/)
      .optional(),
    paymentNote: optionalText,
    customerPhone: kenyanPhoneSchema,
    customerName: z.string().trim().min(1).max(120).optional(),
    loyaltyMenuItemId: z.string().min(1).max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.discountKind && value.discountValue === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "A discount value is required.",
      });
    }
    if (!value.discountKind && value.discountValue !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["discountKind"],
        message: "A discount kind is required.",
      });
    }
    if (value.discountKind === "percent" && (value.discountValue ?? 0) > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "A percentage cannot exceed 100.",
      });
    }
    if (value.paymentMethod === "mpesa_buy_goods" && !value.mpesaReceiptNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["mpesaReceiptNumber"],
        message: "The M-Pesa receipt number is required.",
      });
    }
  });

export const expenseSchema = z.object({
  categoryId: z.string().min(1).max(200),
  amountKes: z.coerce.number().int().positive().max(100_000_000),
  description: z.string().trim().min(1).max(500),
  payee: optionalText,
  paymentMethod: z.string().trim().min(1).max(50),
  incurredAt: z.coerce.date(),
});

export const voidExpenseSchema = z.object({
  expenseId: z.string().min(1).max(200),
  reason: z.string().trim().min(3).max(500),
});

export const voidSaleSchema = z.object({
  saleId: z.string().min(1).max(200),
  reason: z.string().trim().min(3).max(500),
});

export const reconciliationSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    rows: z
      .array(
        z.object({
          receiptNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,20}$/),
          amountKes: z.coerce.number().int().positive(),
          settledAt: z.coerce.date(),
        }),
      )
      .min(1)
      .max(2_000),
  })
  .refine((value) => value.periodEnd > value.periodStart, {
    path: ["periodEnd"],
    message: "The period end must be after its start.",
  });

export const inventoryItemSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(120),
  sku: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(80).nullable().optional(),
  ),
  unit: z.string().trim().min(1).max(30),
  reorderLevel: z.coerce.number().nonnegative().max(1_000_000_000),
  active: z.boolean().default(true),
});

export const inventoryMovementSchema = z
  .object({
    inventoryItemId: z.string().min(1).max(200),
    reason: z.enum(["purchase", "adjustment", "waste", "count"]),
    quantity: z.coerce.number().min(-1_000_000_000).max(1_000_000_000),
    note: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.reason !== "count" && value.quantity === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity must be greater than zero.",
      });
    }
    if (
      (value.reason === "purchase" || value.reason === "waste" || value.reason === "count") &&
      value.quantity < 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity cannot be negative for this movement type.",
      });
    }
  });

export const recipeSchema = z.object({
  menuItemId: z.string().min(1).max(200),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1).max(200),
        quantity: z.coerce.number().positive().max(1_000_000),
      }),
    )
    .max(100)
    .refine(
      (lines) => new Set(lines.map((line) => line.inventoryItemId)).size === lines.length,
      "An inventory item can appear only once.",
    ),
});

export const operationsSettingsSchema = z.object({
  tillNumber: z.string().trim().min(1).max(30),
  loyaltyVisitsRequired: z.coerce.number().int().min(1).max(100),
  loyaltyRewardCapKes: z.coerce.number().int().positive().max(100_000),
});

export const loyaltyAdjustmentSchema = z
  .object({
    customerPhone: kenyanPhoneSchema.optional(),
    customerId: z.string().trim().min(1).max(200).optional(),
    visitDelta: z.coerce.number().int().min(-1_000).max(1_000).refine(Boolean),
    note: z.string().trim().min(3).max(500),
  })
  .refine((value) => Boolean(value.customerPhone || value.customerId), {
    message: "A customer is required.",
  });

export const reportRangeSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "custom"]).default("daily"),
  date: z.coerce.date().optional(),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
});

export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";
export type ReportOptions = {
  period?: ReportPeriod;
  date?: Date;
  start?: Date;
  end?: Date;
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
    if (!options.start || !options.end) {
      throw new Error("A custom report requires start and end dates.");
    }
    const startParts = nairobiDateParts(options.start);
    const endParts = nairobiDateParts(options.end);
    const start = nairobiMidnight(startParts.year, startParts.month, startParts.day);
    const end = nairobiMidnight(endParts.year, endParts.month, endParts.day + 1);
    if (end <= start) throw new Error("Report end must not precede its start.");
    return { period, start, end };
  }

  const parts = nairobiDateParts(options.date ?? new Date());
  let start = nairobiMidnight(parts.year, parts.month, parts.day);
  if (period === "weekly") {
    const mondayOffset = (start.getUTCDay() + 6) % 7;
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

export type CompleteSaleInput = z.infer<typeof completeSaleSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ReconciliationInput = z.infer<typeof reconciliationSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type RecipeInput = z.infer<typeof recipeSchema>;
export type OperationsSettingsInput = z.infer<typeof operationsSettingsSchema>;

export class OperationsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationsError";
  }
}
