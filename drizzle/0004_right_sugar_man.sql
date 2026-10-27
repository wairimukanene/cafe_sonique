CREATE TYPE "public"."shop_fulfilment" AS ENUM('pickup', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."shop_order_status" AS ENUM('awaiting_payment', 'paid', 'ready_for_pickup', 'out_for_delivery', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shop_payment_attempt_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "delivery_area" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"fee_kes" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_area_fee_valid" CHECK ("delivery_area"."fee_kes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shop_order" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"public_token" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "shop_order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"fulfilment" "shop_fulfilment" NOT NULL,
	"delivery_area_id" text,
	"delivery_area_name" text,
	"delivery_address" text,
	"delivery_notes" text,
	"customer_name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"items_total_kes" integer NOT NULL,
	"delivery_fee_kes" integer DEFAULT 0 NOT NULL,
	"total_kes" integer NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"mpesa_receipt" text,
	"sale_id" text,
	"needs_attention" text,
	"cancel_reason" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_order_totals_valid" CHECK ("shop_order"."items_total_kes" > 0 and "shop_order"."delivery_fee_kes" >= 0 and "shop_order"."total_kes" = "shop_order"."items_total_kes" + "shop_order"."delivery_fee_kes")
);
--> statement-breakpoint
CREATE TABLE "shop_order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"option_id" text,
	"name_snapshot" text NOT NULL,
	"option_label" text,
	"unit_price_kes" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_kes" integer NOT NULL,
	CONSTRAINT "shop_order_item_values_valid" CHECK ("shop_order_item"."quantity" > 0 and "shop_order_item"."unit_price_kes" > 0 and "shop_order_item"."line_total_kes" = "shop_order_item"."quantity" * "shop_order_item"."unit_price_kes")
);
--> statement-breakpoint
CREATE TABLE "shop_payment_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"checkout_request_id" text NOT NULL,
	"merchant_request_id" text,
	"phone_e164" text NOT NULL,
	"amount_kes" integer NOT NULL,
	"status" "shop_payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"result_code" integer,
	"result_desc" text,
	"mpesa_receipt" text,
	"callback_payload" jsonb,
	"last_queried_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shop_product" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"price_kes" integer NOT NULL,
	"image_path" text,
	"image_alt" text DEFAULT '' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_product_price_valid" CHECK ("shop_product"."price_kes" > 0)
);
--> statement-breakpoint
CREATE TABLE "shop_product_option" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"label" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_option_stock_valid" CHECK ("shop_product_option"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_delivery_area_id_delivery_area_id_fk" FOREIGN KEY ("delivery_area_id") REFERENCES "public"."delivery_area"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order" ADD CONSTRAINT "shop_order_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_item" ADD CONSTRAINT "shop_order_item_order_id_shop_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_item" ADD CONSTRAINT "shop_order_item_product_id_shop_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_item" ADD CONSTRAINT "shop_order_item_option_id_shop_product_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."shop_product_option"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_payment_attempt" ADD CONSTRAINT "shop_payment_attempt_order_id_shop_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_product_option" ADD CONSTRAINT "shop_product_option_product_id_shop_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_order_code_unique" ON "shop_order" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_order_token_unique" ON "shop_order" USING btree ("public_token");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_order_idempotency_unique" ON "shop_order" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "shop_order_status_created_idx" ON "shop_order" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "shop_order_hold_idx" ON "shop_order" USING btree ("status","hold_expires_at");--> statement-breakpoint
CREATE INDEX "shop_order_item_order_idx" ON "shop_order_item" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_payment_checkout_unique" ON "shop_payment_attempt" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE INDEX "shop_payment_order_idx" ON "shop_payment_attempt" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_product_slug_unique" ON "shop_product" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_option_product_label_unique" ON "shop_product_option" USING btree ("product_id","label");