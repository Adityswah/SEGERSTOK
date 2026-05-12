CREATE TYPE "public"."ingredient_category" AS ENUM('Protein & Daging', 'Sayuran & Pelengkap', 'Bumbu Basah & Rempah Segar', 'Bahan Kering & Bumbu Kering');--> statement-breakpoint
CREATE TYPE "public"."prediction_risk" AS ENUM('Rendah', 'Sedang', 'Tinggi');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('Owner', 'Kasir', 'Cheef', 'Waiters');--> statement-breakpoint
CREATE TYPE "public"."stock_transaction_type" AS ENUM('masuk', 'keluar');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" "ingredient_category" NOT NULL,
	"unit" varchar(32) NOT NULL,
	"stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"minimum_stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"average_price" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"ingredient_id" text,
	"item_name" varchar(160) NOT NULL,
	"current_price" integer NOT NULL,
	"predicted_price" integer NOT NULL,
	"change_percent" numeric(6, 2) NOT NULL,
	"risk" "prediction_risk" NOT NULL,
	"source_name" varchar(160) NOT NULL,
	"source_url" text NOT NULL,
	"summary" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock_opname_details" (
	"id" text PRIMARY KEY NOT NULL,
	"opname_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"system_stock" numeric(12, 2) NOT NULL,
	"cashier_actual" numeric(12, 2),
	"chef_actual" numeric(12, 2),
	"waiters_actual" numeric(12, 2),
	"final_actual" numeric(12, 2),
	"variance" numeric(12, 2),
	"note" text
);
--> statement-breakpoint
CREATE TABLE "stock_opname" (
	"id" text PRIMARY KEY NOT NULL,
	"opname_date" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"created_by_id" text,
	"created_by_name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"ingredient_id" text NOT NULL,
	"type" "stock_transaction_type" NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" integer,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" text,
	"operator_name" varchar(80) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'Kasir' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_predictions" ADD CONSTRAINT "price_predictions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_details" ADD CONSTRAINT "stock_opname_details_opname_id_stock_opname_id_fk" FOREIGN KEY ("opname_id") REFERENCES "public"."stock_opname"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname_details" ADD CONSTRAINT "stock_opname_details_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_opname" ADD CONSTRAINT "stock_opname_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category");--> statement-breakpoint
CREATE INDEX "price_predictions_item_idx" ON "price_predictions" USING btree ("item_name");--> statement-breakpoint
CREATE INDEX "price_predictions_risk_idx" ON "price_predictions" USING btree ("risk");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_opname_details_opname_ingredient_idx" ON "stock_opname_details" USING btree ("opname_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "stock_transactions_ingredient_idx" ON "stock_transactions" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "stock_transactions_date_idx" ON "stock_transactions" USING btree ("transaction_date");