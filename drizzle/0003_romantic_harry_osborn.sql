CREATE TYPE "public"."guest_thought_status" AS ENUM('published', 'hidden');--> statement-breakpoint
CREATE TABLE "guest_thought" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"body" text NOT NULL,
	"status" "guest_thought_status" DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guest_thought_status_created_idx" ON "guest_thought" USING btree ("status","created_at");