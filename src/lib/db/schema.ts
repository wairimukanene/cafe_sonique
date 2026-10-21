import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").default("barista").notNull(),
    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("account_provider_unique").on(table.providerId, table.accountId),
    index("account_user_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const menuCategory = pgTable(
  "menu_category",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("menu_category_slug_unique").on(table.slug)],
);

export const menuItem = pgTable(
  "menu_item",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategory.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    priceKes: integer("price_kes").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    available: boolean("available").default(true).notNull(),
    active: boolean("active").default(true).notNull(),
    imagePath: text("image_path"),
    ...timestamps,
  },
  (table) => [index("menu_item_category_idx").on(table.categoryId)],
);

export const menuCategoryRelations = relations(menuCategory, ({ many }) => ({
  items: many(menuItem),
}));

export const menuItemRelations = relations(menuItem, ({ one }) => ({
  category: one(menuCategory, {
    fields: [menuItem.categoryId],
    references: [menuCategory.id],
  }),
}));

export const eventStatus = pgEnum("event_status", ["draft", "published", "archived"]);
export const bookingStatus = pgEnum("booking_status", [
  "new",
  "contacted",
  "confirmed",
  "declined",
  "cancelled",
]);
export const guestThoughtStatus = pgEnum("guest_thought_status", [
  "published",
  "hidden",
]);

export const event = pgTable(
  "event",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity"),
    imagePath: text("image_path"),
    status: eventStatus("status").default("draft").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("event_slug_unique").on(table.slug),
    index("event_status_date_idx").on(table.status, table.startsAt),
  ],
);

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").references(() => event.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    contact: text("contact").notNull(),
    eventType: text("event_type").notNull(),
    preferredDate: timestamp("preferred_date", { withTimezone: true }).notNull(),
    attendeeCount: integer("attendee_count").default(1).notNull(),
    message: text("message"),
    status: bookingStatus("status").default("new").notNull(),
    staffNotes: text("staff_notes"),
    ...timestamps,
  },
  (table) => [
    index("booking_status_idx").on(table.status),
    index("booking_created_idx").on(table.createdAt),
  ],
);

export const bookingRelations = relations(booking, ({ one }) => ({
  event: one(event, { fields: [booking.eventId], references: [event.id] }),
}));

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_actor_idx").on(table.actorId),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, { fields: [auditLog.actorId], references: [user.id] }),
}));

export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text("key").primaryKey(),
    count: integer("count").default(1).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const guestThought = pgTable(
  "guest_thought",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    body: text("body").notNull(),
    status: guestThoughtStatus("status").default("published").notNull(),
    ...timestamps,
  },
  (table) => [
    index("guest_thought_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    path: text("path").notNull(),
    altText: text("alt_text").notNull(),
    sourceUrl: text("source_url"),
    sourcePermalink: text("source_permalink"),
    approved: boolean("approved").default(false).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("media_asset_key_unique").on(table.key)],
);

export const saleStatus = pgEnum("sale_status", ["draft", "completed", "void"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "mpesa_buy_goods"]);
export const paymentStatus = pgEnum("payment_status", [
  "recorded",
  "reconciled",
  "reversed",
]);
export const discountKind = pgEnum("discount_kind", [
  "fixed_kes",
  "percent",
  "loyalty_free_drink",
]);
export const expenseStatus = pgEnum("expense_status", ["recorded", "void"]);
export const loyaltyEntryType = pgEnum("loyalty_entry_type", [
  "visit",
  "redemption",
  "adjustment",
]);
export const inventoryMovementReason = pgEnum("inventory_movement_reason", [
  "purchase",
  "sale",
  "adjustment",
  "waste",
  "count",
  "void_reversal",
]);
export const settlementStatus = pgEnum("settlement_status", [
  "unmatched",
  "matched",
  "ignored",
]);

export const cafeSetting = pgTable("cafe_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<string | number | boolean | null>().notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    phoneE164: text("phone_e164").notNull(),
    displayName: text("display_name"),
    loyaltyBalance: integer("loyalty_balance").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("customer_phone_unique").on(table.phoneE164)],
);

export const sale = pgTable(
  "sale",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    status: saleStatus("status").default("draft").notNull(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    subtotalKes: integer("subtotal_kes").notNull(),
    discountTotalKes: integer("discount_total_kes").default(0).notNull(),
    totalKes: integer("total_kes").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sale_reference_unique").on(table.reference),
    uniqueIndex("sale_idempotency_unique").on(table.idempotencyKey),
    index("sale_status_completed_idx").on(table.status, table.completedAt),
    check("sale_totals_valid", sql`${table.subtotalKes} >= 0 and ${table.discountTotalKes} >= 0 and ${table.totalKes} >= 0 and ${table.totalKes} = ${table.subtotalKes} - ${table.discountTotalKes}`),
  ],
);

export const saleLineItem = pgTable(
  "sale_line_item",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").references(() => menuItem.id, { onDelete: "set null" }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceKes: integer("unit_price_kes").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalKes: integer("line_total_kes").notNull(),
    isLoyaltyRedemption: boolean("is_loyalty_redemption").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sale_line_sale_idx").on(table.saleId),
    check("sale_line_values_valid", sql`${table.quantity} > 0 and ${table.unitPriceKes} >= 0 and ${table.lineTotalKes} = ${table.quantity} * ${table.unitPriceKes}`),
  ],
);

export const saleDiscount = pgTable(
  "sale_discount",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "cascade" }),
    kind: discountKind("kind").notNull(),
    label: text("label").notNull(),
    value: integer("value").notNull(),
    amountKes: integer("amount_kes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("sale_discount_sale_idx").on(table.saleId)],
);

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sale.id, { onDelete: "restrict" }),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").default("recorded").notNull(),
    amountKes: integer("amount_kes").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    reconciledBy: text("reconciled_by").references(() => user.id, { onDelete: "set null" }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payment_idempotency_unique").on(table.idempotencyKey),
    index("payment_sale_idx").on(table.saleId),
    index("payment_method_status_idx").on(table.method, table.status),
    check("payment_amount_positive", sql`${table.amountKes} > 0`),
  ],
);

export const paymentMpesa = pgTable(
  "payment_mpesa",
  {
    paymentId: text("payment_id")
      .primaryKey()
      .references(() => payment.id, { onDelete: "cascade" }),
    tillNumber: text("till_number").notNull(),
    receiptNumber: text("receipt_number").notNull(),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("mpesa_till_receipt_unique").on(table.tillNumber, table.receiptNumber),
  ],
);

export const reconciliationSession = pgTable("reconciliation_session", {
  id: text("id").primaryKey(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  expectedKes: integer("expected_kes").default(0).notNull(),
  settlementKes: integer("settlement_kes").default(0).notNull(),
  differenceKes: integer("difference_kes").default(0).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const mpesaSettlement = pgTable(
  "mpesa_settlement",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => reconciliationSession.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    amountKes: integer("amount_kes").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),
    matchedPaymentId: text("matched_payment_id").references(() => payment.id, {
      onDelete: "set null",
    }),
    status: settlementStatus("status").default("unmatched").notNull(),
  },
  (table) => [
    uniqueIndex("settlement_session_receipt_unique").on(
      table.sessionId,
      table.receiptNumber,
    ),
  ],
);

export const expenseCategory = pgTable(
  "expense_category",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("expense_category_slug_unique").on(table.slug)],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => expenseCategory.id, { onDelete: "restrict" }),
    amountKes: integer("amount_kes").notNull(),
    description: text("description").notNull(),
    payee: text("payee"),
    paymentMethod: text("payment_method").notNull(),
    incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
    status: expenseStatus("status").default("recorded").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (table) => [
    index("expense_status_date_idx").on(table.status, table.incurredAt),
    check("expense_amount_positive", sql`${table.amountKes} > 0`),
  ],
);

export const expenseReceipt = pgTable(
  "expense_receipt",
  {
    id: text("id").primaryKey(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("expense_receipt_storage_unique").on(table.storageKey),
    index("expense_receipt_expense_idx").on(table.expenseId),
  ],
);

export const loyaltyEntry = pgTable(
  "loyalty_entry",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    saleId: text("sale_id").references(() => sale.id, { onDelete: "set null" }),
    type: loyaltyEntryType("type").notNull(),
    visitDelta: integer("visit_delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    rewardCostKes: integer("reward_cost_kes").default(0).notNull(),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("loyalty_customer_date_idx").on(table.customerId, table.createdAt),
    index("loyalty_sale_idx").on(table.saleId),
  ],
);

export const inventoryItem = pgTable(
  "inventory_item",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku"),
    unit: text("unit").notNull(),
    onHand: numeric("on_hand", { precision: 14, scale: 3, mode: "number" })
      .default(0)
      .notNull(),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 3, mode: "number" })
      .default(0)
      .notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("inventory_sku_unique").on(table.sku)],
);

export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: text("id").primaryKey(),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItem.id, { onDelete: "restrict" }),
    delta: numeric("delta", { precision: 14, scale: 3, mode: "number" }).notNull(),
    balanceAfter: numeric("balance_after", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    reason: inventoryMovementReason("reason").notNull(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    note: text("note"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_movement_item_date_idx").on(table.inventoryItemId, table.createdAt),
  ],
);

export const recipeLine = pgTable(
  "recipe_line",
  {
    id: text("id").primaryKey(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    inventoryItemId: text("inventory_item_id")
      .notNull()
      .references(() => inventoryItem.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("recipe_menu_inventory_unique").on(
      table.menuItemId,
      table.inventoryItemId,
    ),
  ],
);

export const saleRelations = relations(sale, ({ one, many }) => ({
  customer: one(customer, { fields: [sale.customerId], references: [customer.id] }),
  creator: one(user, { fields: [sale.createdBy], references: [user.id] }),
  lines: many(saleLineItem),
  discounts: many(saleDiscount),
  payments: many(payment),
}));

export const saleLineRelations = relations(saleLineItem, ({ one }) => ({
  sale: one(sale, { fields: [saleLineItem.saleId], references: [sale.id] }),
  menuItem: one(menuItem, {
    fields: [saleLineItem.menuItemId],
    references: [menuItem.id],
  }),
}));

export const saleDiscountRelations = relations(saleDiscount, ({ one }) => ({
  sale: one(sale, { fields: [saleDiscount.saleId], references: [sale.id] }),
}));

export const paymentRelations = relations(payment, ({ one }) => ({
  sale: one(sale, { fields: [payment.saleId], references: [sale.id] }),
  mpesa: one(paymentMpesa),
}));

export const paymentMpesaRelations = relations(paymentMpesa, ({ one }) => ({
  payment: one(payment, {
    fields: [paymentMpesa.paymentId],
    references: [payment.id],
  }),
}));

export const expenseRelations = relations(expense, ({ one, many }) => ({
  category: one(expenseCategory, {
    fields: [expense.categoryId],
    references: [expenseCategory.id],
  }),
  receipts: many(expenseReceipt),
}));

export const expenseReceiptRelations = relations(expenseReceipt, ({ one }) => ({
  expense: one(expense, {
    fields: [expenseReceipt.expenseId],
    references: [expense.id],
  }),
}));

export const inventoryItemRelations = relations(inventoryItem, ({ many }) => ({
  movements: many(inventoryMovement),
  recipes: many(recipeLine),
}));

export const inventoryMovementRelations = relations(inventoryMovement, ({ one }) => ({
  inventoryItem: one(inventoryItem, {
    fields: [inventoryMovement.inventoryItemId],
    references: [inventoryItem.id],
  }),
}));

export const recipeLineRelations = relations(recipeLine, ({ one }) => ({
  inventoryItem: one(inventoryItem, {
    fields: [recipeLine.inventoryItemId],
    references: [inventoryItem.id],
  }),
  menuItem: one(menuItem, {
    fields: [recipeLine.menuItemId],
    references: [menuItem.id],
  }),
}));
