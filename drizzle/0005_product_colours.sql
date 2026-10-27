CREATE TABLE "shop_product_colour" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"image_path" text,
	"image_alt" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "shop_option_product_label_unique";--> statement-breakpoint
ALTER TABLE "shop_product_option" ADD COLUMN "colour_id" text;--> statement-breakpoint
ALTER TABLE "shop_product_colour" ADD CONSTRAINT "shop_product_colour_product_id_shop_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_colour_product_name_unique" ON "shop_product_colour" USING btree ("product_id","name");--> statement-breakpoint
ALTER TABLE "shop_product_option" ADD CONSTRAINT "shop_product_option_colour_id_shop_product_colour_id_fk" FOREIGN KEY ("colour_id") REFERENCES "public"."shop_product_colour"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_product_option" ADD CONSTRAINT "shop_option_variant_unique" UNIQUE NULLS NOT DISTINCT("product_id","colour_id","label");