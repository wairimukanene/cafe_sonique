CREATE TYPE "public"."discount_kind" AS ENUM('fixed_kes', 'percent', 'loyalty_free_drink');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('recorded', 'void');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_reason" AS ENUM('purchase', 'sale', 'adjustment', 'waste', 'count', 'void_reversal');--> statement-breakpoint
CREATE TYPE "public"."loyalty_entry_type" AS ENUM('visit', 'redemption', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'mpesa_buy_goods');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('recorded', 'reconciled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('draft', 'completed', 'void');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('unmatched', 'matched', 'ignored');--> statement-breakpoint
CREATE TABLE "cafe_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" text PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"display_name" text,
	"loyalty_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"amount_kes" integer NOT NULL,
	"description" text NOT NULL,
	"payee" text,
	"payment_method" text NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"status" "expense_status" DEFAULT 'recorded' NOT NULL,
	"created_by" text NOT NULL,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text NOT NULL,
	"on_hand" numeric(14, 3) DEFAULT 0 NOT NULL,
	"reorder_level" numeric(14, 3) DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_item_id" text NOT NULL,
	"delta" numeric(14, 3) NOT NULL,
	"balance_after" numeric(14, 3) NOT NULL,
	"reason" "inventory_movement_reason" NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"sale_id" text,
	"type" "loyalty_entry_type" NOT NULL,
	"visit_delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reward_cost_kes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mpesa_settlement" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"receipt_number" text NOT NULL,
	"amount_kes" integer NOT NULL,
	"settled_at" timestamp with time zone NOT NULL,
	"matched_payment_id" text,
	"status" "settlement_status" DEFAULT 'unmatched' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'recorded' NOT NULL,
	"amount_kes" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_by" text,
	"reconciled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_mpesa" (
	"payment_id" text PRIMARY KEY NOT NULL,
	"till_number" text NOT NULL,
	"receipt_number" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "recipe_line" (
	"id" text PRIMARY KEY NOT NULL,
	"menu_item_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_session" (
	"id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"expected_kes" integer DEFAULT 0 NOT NULL,
	"settlement_kes" integer DEFAULT 0 NOT NULL,
	"difference_kes" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"status" "sale_status" DEFAULT 'draft' NOT NULL,
	"customer_id" text,
	"subtotal_kes" integer NOT NULL,
	"discount_total_kes" integer DEFAULT 0 NOT NULL,
	"total_kes" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by" text NOT NULL,
	"completed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_discount" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"label" text NOT NULL,
	"value" integer NOT NULL,
	"amount_kes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_line_item" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text NOT NULL,
	"menu_item_id" text,
	"name_snapshot" text NOT NULL,
	"unit_price_kes" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_kes" integer NOT NULL,
	"is_loyalty_redemption" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cafe_setting" ADD CONSTRAINT "cafe_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_receipt" ADD CONSTRAINT "expense_receipt_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_entry" ADD CONSTRAINT "loyalty_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_settlement" ADD CONSTRAINT "mpesa_settlement_session_id_reconciliation_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."reconciliation_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_settlement" ADD CONSTRAINT "mpesa_settlement_matched_payment_id_payment_id_fk" FOREIGN KEY ("matched_payment_id") REFERENCES "public"."payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_reconciled_by_user_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_mpesa" ADD CONSTRAINT "payment_mpesa_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_menu_item_id_menu_item_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_line" ADD CONSTRAINT "recipe_line_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_session" ADD CONSTRAINT "reconciliation_session_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_discount" ADD CONSTRAINT "sale_discount_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line_item" ADD CONSTRAINT "sale_line_item_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line_item" ADD CONSTRAINT "sale_line_item_menu_item_id_menu_item_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_phone_unique" ON "customer" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "expense_status_date_idx" ON "expense" USING btree ("status","incurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_category_slug_unique" ON "expense_category" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_receipt_storage_unique" ON "expense_receipt" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "expense_receipt_expense_idx" ON "expense_receipt" USING btree ("expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_sku_unique" ON "inventory_item" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "inventory_movement_item_date_idx" ON "inventory_movement" USING btree ("inventory_item_id","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_customer_date_idx" ON "loyalty_entry" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "loyalty_sale_idx" ON "loyalty_entry" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_session_receipt_unique" ON "mpesa_settlement" USING btree ("session_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_idempotency_unique" ON "payment" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_sale_idx" ON "payment" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "payment_method_status_idx" ON "payment" USING btree ("method","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mpesa_till_receipt_unique" ON "payment_mpesa" USING btree ("till_number","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_menu_inventory_unique" ON "recipe_line" USING btree ("menu_item_id","inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_reference_unique" ON "sale" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_idempotency_unique" ON "sale" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "sale_status_completed_idx" ON "sale" USING btree ("status","completed_at");--> statement-breakpoint
CREATE INDEX "sale_discount_sale_idx" ON "sale_discount" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_line_sale_idx" ON "sale_line_item" USING btree ("sale_id");