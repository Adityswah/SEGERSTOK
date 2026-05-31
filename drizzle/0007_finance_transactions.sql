DO $$ BEGIN
  CREATE TYPE "public"."finance_transaction_type" AS ENUM('pendapatan', 'pengeluaran');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."finance_fund_method" AS ENUM('cash', 'bank');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."finance_category" AS ENUM('keperluan_stock', 'non_keperluan_stock');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD COLUMN IF NOT EXISTS "finance_transaction_id" text;--> statement-breakpoint
ALTER TABLE "ingredient_master_options" ALTER COLUMN "type" TYPE varchar(48);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "finance_transaction_type" NOT NULL,
	"fund_method" "finance_fund_method" NOT NULL,
	"category" "finance_category" NOT NULL,
	"subcategory" varchar(160) NOT NULL,
	"ingredient_id" text,
	"item_name" varchar(160) NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"unit_price" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"attachment_name" varchar(240),
	"linked_stock_transaction_id" text,
	"operator_id" text,
	"operator_name" varchar(80) NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_transactions_finance_transaction_idx" ON "stock_transactions" USING btree ("finance_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_date_idx" ON "finance_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_type_idx" ON "finance_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_fund_method_idx" ON "finance_transactions" USING btree ("fund_method");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_category_idx" ON "finance_transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_ingredient_idx" ON "finance_transactions" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_transactions_operator_idx" ON "finance_transactions" USING btree ("operator_id");--> statement-breakpoint
INSERT INTO "ingredient_master_options" ("id", "type", "value", "active", "created_at", "updated_at")
VALUES
  ('finance-non-stock-prive', 'finance_non_stock_subcategory', 'Prive', true, now(), now()),
  ('finance-non-stock-operasional', 'finance_non_stock_subcategory', 'Operasional', true, now(), now()),
  ('finance-non-stock-maintenance', 'finance_non_stock_subcategory', 'Maintenance', true, now(), now()),
  ('finance-non-stock-peralatan', 'finance_non_stock_subcategory', 'Peralatan', true, now(), now()),
  ('finance-non-stock-administrasi', 'finance_non_stock_subcategory', 'Administrasi', true, now(), now()),
  ('finance-non-stock-transportasi', 'finance_non_stock_subcategory', 'Transportasi', true, now(), now())
ON CONFLICT ("type", "value") DO UPDATE SET "active" = true, "updated_at" = now();
--> statement-breakpoint
UPDATE "ingredient_master_options"
SET "active" = false, "updated_at" = now()
WHERE "type" = 'finance_non_stock_subcategory'
  AND "value" NOT IN ('Prive', 'Operasional', 'Maintenance', 'Peralatan', 'Administrasi', 'Transportasi');
