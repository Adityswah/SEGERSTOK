ALTER TABLE "ingredients" ALTER COLUMN "category" TYPE varchar(160) USING "category"::text;

CREATE TABLE IF NOT EXISTS "ingredient_master_options" (
  "id" text PRIMARY KEY NOT NULL,
  "type" varchar(24) NOT NULL,
  "value" varchar(160) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ingredient_master_options_type_value_idx"
  ON "ingredient_master_options" USING btree ("type", "value");

INSERT INTO "ingredient_master_options" ("id", "type", "value")
SELECT gen_random_uuid()::text, 'category', category::text
FROM (SELECT DISTINCT "category" FROM "ingredients" WHERE "active" = true) source
ON CONFLICT ("type", "value") DO UPDATE SET "active" = true, "updated_at" = now();

INSERT INTO "ingredient_master_options" ("id", "type", "value")
SELECT gen_random_uuid()::text, 'unit', unit
FROM (SELECT DISTINCT "unit" FROM "ingredients" WHERE "active" = true) source
ON CONFLICT ("type", "value") DO UPDATE SET "active" = true, "updated_at" = now();
