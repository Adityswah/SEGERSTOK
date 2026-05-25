import { sql } from "drizzle-orm";

import { db } from "@/db";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/responses";

const migrationStatements = [
  `CREATE TYPE "public"."ai_recommendation_action" AS ENUM('beli-sekarang', 'beli-bertahap', 'tunda-beli')`,
  `CREATE TYPE "public"."ai_pipeline_run_status" AS ENUM('success', 'partial', 'failed')`,
  `CREATE TABLE "ai_source_signals" (
    "id" text PRIMARY KEY NOT NULL,
    "source_type" varchar(24) NOT NULL,
    "source_name" varchar(160) NOT NULL,
    "source_url" text NOT NULL,
    "headline" varchar(280) NOT NULL,
    "summary" text NOT NULL,
    "commodity_tags" text DEFAULT '' NOT NULL,
    "signal_score" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone NOT NULL,
    "content_hash" varchar(80) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE "ai_material_risk_daily" (
    "id" text PRIMARY KEY NOT NULL,
    "ingredient_id" text,
    "item_name" varchar(160) NOT NULL,
    "signal_date" date NOT NULL,
    "risk_score" integer NOT NULL,
    "risk" "prediction_risk" NOT NULL,
    "trend_percent" numeric(6, 2) DEFAULT '0' NOT NULL,
    "current_price" integer DEFAULT 0 NOT NULL,
    "predicted_price" integer DEFAULT 0 NOT NULL,
    "source_count" integer DEFAULT 0 NOT NULL,
    "reason" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE "ai_weekly_stock_projections" (
    "id" text PRIMARY KEY NOT NULL,
    "ingredient_id" text NOT NULL,
    "week_start" date NOT NULL,
    "week_end" date NOT NULL,
    "current_stock" numeric(12, 2) NOT NULL,
    "predicted_weekly_usage" numeric(12, 2) NOT NULL,
    "predicted_ending_stock" numeric(12, 2) NOT NULL,
    "stock_cover_days" numeric(12, 2) NOT NULL,
    "risk_boost_percent" numeric(6, 2) DEFAULT '0' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE "ai_buy_recommendations" (
    "id" text PRIMARY KEY NOT NULL,
    "ingredient_id" text NOT NULL,
    "recommendation_date" date NOT NULL,
    "action" "ai_recommendation_action" NOT NULL,
    "recommended_quantity" numeric(12, 2) NOT NULL,
    "priority_score" integer NOT NULL,
    "explanation" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE "ai_pipeline_runs" (
    "id" text PRIMARY KEY NOT NULL,
    "run_type" varchar(64) NOT NULL,
    "status" "ai_pipeline_run_status" NOT NULL,
    "started_at" timestamp with time zone NOT NULL,
    "finished_at" timestamp with time zone,
    "metrics_json" text DEFAULT '{}' NOT NULL,
    "error_message" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "ai_material_risk_daily" ADD CONSTRAINT "ai_material_risk_daily_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action`,
  `ALTER TABLE "ai_weekly_stock_projections" ADD CONSTRAINT "ai_weekly_stock_projections_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action`,
  `ALTER TABLE "ai_buy_recommendations" ADD CONSTRAINT "ai_buy_recommendations_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action`,
  `CREATE UNIQUE INDEX "ai_source_signals_hash_idx" ON "ai_source_signals" USING btree ("content_hash")`,
  `CREATE INDEX "ai_source_signals_published_at_idx" ON "ai_source_signals" USING btree ("published_at")`,
  `CREATE INDEX "ai_source_signals_source_type_idx" ON "ai_source_signals" USING btree ("source_type")`,
  `CREATE UNIQUE INDEX "ai_material_risk_daily_item_date_idx" ON "ai_material_risk_daily" USING btree ("item_name","signal_date")`,
  `CREATE INDEX "ai_material_risk_daily_signal_date_idx" ON "ai_material_risk_daily" USING btree ("signal_date")`,
  `CREATE INDEX "ai_material_risk_daily_risk_idx" ON "ai_material_risk_daily" USING btree ("risk")`,
  `CREATE UNIQUE INDEX "ai_weekly_stock_projection_ingredient_week_idx" ON "ai_weekly_stock_projections" USING btree ("ingredient_id","week_start")`,
  `CREATE INDEX "ai_weekly_stock_projection_week_start_idx" ON "ai_weekly_stock_projections" USING btree ("week_start")`,
  `CREATE UNIQUE INDEX "ai_buy_recommendations_ingredient_date_idx" ON "ai_buy_recommendations" USING btree ("ingredient_id","recommendation_date")`,
  `CREATE INDEX "ai_buy_recommendations_date_idx" ON "ai_buy_recommendations" USING btree ("recommendation_date")`,
  `CREATE INDEX "ai_buy_recommendations_priority_idx" ON "ai_buy_recommendations" USING btree ("priority_score")`,
  `CREATE INDEX "ai_pipeline_runs_run_type_idx" ON "ai_pipeline_runs" USING btree ("run_type")`,
  `CREATE INDEX "ai_pipeline_runs_started_at_idx" ON "ai_pipeline_runs" USING btree ("started_at")`,
  `CREATE INDEX "ai_pipeline_runs_status_idx" ON "ai_pipeline_runs" USING btree ("status")`,
  `CREATE TABLE "ai_bot_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text,
    "message" text NOT NULL,
    "clean_message" text NOT NULL,
    "intent" varchar(32) NOT NULL,
    "flow" varchar(32) NOT NULL,
    "answer" text NOT NULL,
    "metadata_json" text DEFAULT '{}' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
  `ALTER TABLE "ai_bot_logs" ADD CONSTRAINT "ai_bot_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action`,
  `CREATE INDEX "ai_bot_logs_created_at_idx" ON "ai_bot_logs" USING btree ("created_at")`,
  `CREATE INDEX "ai_bot_logs_flow_idx" ON "ai_bot_logs" USING btree ("flow")`,
  `CREATE INDEX "ai_bot_logs_intent_idx" ON "ai_bot_logs" USING btree ("intent")`,
  `CREATE INDEX "ai_bot_logs_user_idx" ON "ai_bot_logs" USING btree ("user_id")`,
];

const ignoredErrorCodes = new Set(["42710", "42P07", "42701"]);

function getErrorCode(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  if ("code" in error && error.code) return String(error.code);
  if ("cause" in error) return getErrorCode(error.cause);
  return "";
}

function hasValidSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    if (!hasValidSecret(request)) return unauthorized("Invalid migration secret");
    if (process.env.NODE_ENV !== "production") return forbidden("Production migration endpoint only runs in production");

    let applied = 0;
    let skipped = 0;

    for (const statement of migrationStatements) {
      try {
        await db.execute(sql.raw(statement));
        applied += 1;
      } catch (error) {
        const code = getErrorCode(error);
        if (ignoredErrorCodes.has(code)) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    return ok({ applied, skipped, timestamp: new Date().toISOString() });
  } catch (error) {
    return serverError(error);
  }
}
