ALTER TABLE "ingredients"
  ADD COLUMN IF NOT EXISTS "is_bom" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "bom_recipes" (
  "id" text PRIMARY KEY NOT NULL,
  "finished_ingredient_id" text NOT NULL,
  "name" varchar(160) NOT NULL,
  "yield_quantity" numeric(12, 2) NOT NULL,
  "yield_unit" varchar(32) NOT NULL,
  "total_cost" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_by_id" text,
  "created_by_name" varchar(80) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bom_recipes_finished_ingredient_idx" UNIQUE("finished_ingredient_id"),
  CONSTRAINT "bom_recipes_name_idx" UNIQUE("name")
);

ALTER TABLE "bom_recipes"
  ADD CONSTRAINT "bom_recipes_finished_ingredient_id_ingredients_id_fk"
  FOREIGN KEY ("finished_ingredient_id") REFERENCES "public"."ingredients"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "bom_recipes"
  ADD CONSTRAINT "bom_recipes_created_by_id_user_id_fk"
  FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "bom_recipe_items" (
  "id" text PRIMARY KEY NOT NULL,
  "bom_recipe_id" text NOT NULL,
  "ingredient_id" text NOT NULL,
  "quantity" numeric(12, 2) NOT NULL,
  "total_cost" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bom_recipe_items_recipe_ingredient_idx" UNIQUE("bom_recipe_id", "ingredient_id")
);

ALTER TABLE "bom_recipe_items"
  ADD CONSTRAINT "bom_recipe_items_bom_recipe_id_bom_recipes_id_fk"
  FOREIGN KEY ("bom_recipe_id") REFERENCES "public"."bom_recipes"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "bom_recipe_items"
  ADD CONSTRAINT "bom_recipe_items_ingredient_id_ingredients_id_fk"
  FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "bom_production_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "bom_recipe_id" text NOT NULL,
  "finished_ingredient_id" text NOT NULL,
  "batches" numeric(12, 2) DEFAULT '1' NOT NULL,
  "produced_quantity" numeric(12, 2) NOT NULL,
  "total_cost" integer DEFAULT 0 NOT NULL,
  "production_date" timestamp with time zone DEFAULT now() NOT NULL,
  "operator_id" text,
  "operator_name" varchar(80) NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "bom_production_runs"
  ADD CONSTRAINT "bom_production_runs_bom_recipe_id_bom_recipes_id_fk"
  FOREIGN KEY ("bom_recipe_id") REFERENCES "public"."bom_recipes"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "bom_production_runs"
  ADD CONSTRAINT "bom_production_runs_finished_ingredient_id_ingredients_id_fk"
  FOREIGN KEY ("finished_ingredient_id") REFERENCES "public"."ingredients"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "bom_production_runs"
  ADD CONSTRAINT "bom_production_runs_operator_id_user_id_fk"
  FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "bom_production_runs_recipe_idx"
  ON "bom_production_runs" USING btree ("bom_recipe_id");

CREATE INDEX IF NOT EXISTS "bom_production_runs_date_idx"
  ON "bom_production_runs" USING btree ("production_date");

CREATE TABLE IF NOT EXISTS "bom_production_run_items" (
  "id" text PRIMARY KEY NOT NULL,
  "production_run_id" text NOT NULL,
  "ingredient_id" text NOT NULL,
  "ingredient_name" varchar(160) NOT NULL,
  "ingredient_unit" varchar(32) NOT NULL,
  "consumed_quantity" numeric(12, 2) NOT NULL,
  "unit_cost" integer DEFAULT 0 NOT NULL,
  "total_cost" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "bom_production_run_items"
  ADD CONSTRAINT "bom_production_run_items_production_run_id_bom_production_runs_id_fk"
  FOREIGN KEY ("production_run_id") REFERENCES "public"."bom_production_runs"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "bom_production_run_items"
  ADD CONSTRAINT "bom_production_run_items_ingredient_id_ingredients_id_fk"
  FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id")
  ON DELETE restrict ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "bom_production_run_items_run_idx"
  ON "bom_production_run_items" USING btree ("production_run_id");
