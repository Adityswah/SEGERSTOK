CREATE TYPE "public"."opname_session_status" AS ENUM('draft', 'staff_input', 'owner_review', 'finalized');
CREATE TYPE "public"."opname_input_type" AS ENUM('primary', 'secondary');
CREATE TYPE "public"."owner_evaluation_severity" AS ENUM('low', 'medium', 'high');
CREATE TYPE "public"."owner_evaluation_status" AS ENUM('open', 'done');
CREATE TYPE "public"."stock_ledger_source" AS ENUM('stock_in', 'stock_out', 'bom_production', 'monthly_opname_final', 'owner_stock_correction');

CREATE TABLE "stock_opname_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "opname_date" timestamp with time zone NOT NULL,
  "status" "opname_session_status" DEFAULT 'draft' NOT NULL,
  "created_by_id" text,
  "created_by_name" varchar(80) NOT NULL,
  "finalized_by_id" text,
  "finalized_by_name" varchar(80),
  "finalized_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stock_opname_item_summaries" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "ingredient_id" text NOT NULL,
  "ingredient_name_snapshot" varchar(160) NOT NULL,
  "category_snapshot" varchar(160) NOT NULL,
  "unit_snapshot" varchar(32) NOT NULL,
  "system_stock_before" numeric(12, 2) NOT NULL,
  "total_role_actual" numeric(12, 2),
  "final_actual" numeric(12, 2),
  "variance_qty" numeric(12, 2),
  "variance_percent" numeric(8, 2),
  "estimated_variance_value" integer DEFAULT 0 NOT NULL,
  "owner_final_note" text,
  "needs_owner_review" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stock_opname_role_inputs" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "ingredient_id" text NOT NULL,
  "role" "role" NOT NULL,
  "area_name" varchar(120) NOT NULL,
  "input_type" "opname_input_type" DEFAULT 'primary' NOT NULL,
  "actual_qty" numeric(12, 2) NOT NULL,
  "note" text,
  "input_by_id" text,
  "input_by_name" varchar(80) NOT NULL,
  "input_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "owner_evaluations" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "ingredient_id" text,
  "severity" "owner_evaluation_severity" DEFAULT 'low' NOT NULL,
  "suspected_cause" varchar(240) NOT NULL,
  "owner_note" text NOT NULL,
  "action_item" text NOT NULL,
  "due_date" date,
  "status" "owner_evaluation_status" DEFAULT 'open' NOT NULL,
  "created_by_id" text,
  "created_by_name" varchar(80) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "stock_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "ingredient_id" text NOT NULL,
  "source" "stock_ledger_source" NOT NULL,
  "reference_id" text,
  "stock_before" numeric(12, 2) NOT NULL,
  "stock_after" numeric(12, 2) NOT NULL,
  "delta" numeric(12, 2) NOT NULL,
  "reason" text,
  "operator_id" text,
  "operator_name" varchar(80) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_opname_sessions" ADD CONSTRAINT "stock_opname_sessions_finalized_by_id_user_id_fk" FOREIGN KEY ("finalized_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_opname_item_summaries" ADD CONSTRAINT "stock_opname_item_summaries_session_id_stock_opname_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stock_opname_item_summaries" ADD CONSTRAINT "stock_opname_item_summaries_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_opname_role_inputs" ADD CONSTRAINT "stock_opname_role_inputs_session_id_stock_opname_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "stock_opname_role_inputs" ADD CONSTRAINT "stock_opname_role_inputs_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_opname_role_inputs" ADD CONSTRAINT "stock_opname_role_inputs_input_by_id_user_id_fk" FOREIGN KEY ("input_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "owner_evaluations" ADD CONSTRAINT "owner_evaluations_session_id_stock_opname_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."stock_opname_sessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "owner_evaluations" ADD CONSTRAINT "owner_evaluations_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "owner_evaluations" ADD CONSTRAINT "owner_evaluations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "stock_opname_sessions_date_idx" ON "stock_opname_sessions" USING btree ("opname_date");
CREATE UNIQUE INDEX "stock_opname_item_summaries_session_ingredient_idx" ON "stock_opname_item_summaries" USING btree ("session_id","ingredient_id");
CREATE INDEX "stock_opname_item_summaries_session_idx" ON "stock_opname_item_summaries" USING btree ("session_id");
CREATE UNIQUE INDEX "stock_opname_role_inputs_session_ingredient_role_idx" ON "stock_opname_role_inputs" USING btree ("session_id","ingredient_id","role");
CREATE INDEX "stock_opname_role_inputs_session_idx" ON "stock_opname_role_inputs" USING btree ("session_id");
CREATE INDEX "owner_evaluations_session_idx" ON "owner_evaluations" USING btree ("session_id");
CREATE INDEX "stock_ledger_ingredient_idx" ON "stock_ledger" USING btree ("ingredient_id");
CREATE INDEX "stock_ledger_source_idx" ON "stock_ledger" USING btree ("source");
CREATE INDEX "stock_ledger_created_at_idx" ON "stock_ledger" USING btree ("created_at");
