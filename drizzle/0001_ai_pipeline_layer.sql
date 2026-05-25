CREATE TYPE "public"."ai_recommendation_action" AS ENUM('beli-sekarang', 'beli-bertahap', 'tunda-beli');--> statement-breakpoint
CREATE TYPE "public"."ai_pipeline_run_status" AS ENUM('success', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "ai_source_signals" (
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
);
--> statement-breakpoint
CREATE TABLE "ai_material_risk_daily" (
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
);
--> statement-breakpoint
CREATE TABLE "ai_weekly_stock_projections" (
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
);
--> statement-breakpoint
CREATE TABLE "ai_buy_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"ingredient_id" text NOT NULL,
	"recommendation_date" date NOT NULL,
	"action" "ai_recommendation_action" NOT NULL,
	"recommended_quantity" numeric(12, 2) NOT NULL,
	"priority_score" integer NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_pipeline_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"run_type" varchar(64) NOT NULL,
	"status" "ai_pipeline_run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"metrics_json" text DEFAULT '{}' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_material_risk_daily" ADD CONSTRAINT "ai_material_risk_daily_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_weekly_stock_projections" ADD CONSTRAINT "ai_weekly_stock_projections_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_buy_recommendations" ADD CONSTRAINT "ai_buy_recommendations_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_source_signals_hash_idx" ON "ai_source_signals" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "ai_source_signals_published_at_idx" ON "ai_source_signals" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "ai_source_signals_source_type_idx" ON "ai_source_signals" USING btree ("source_type");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_material_risk_daily_item_date_idx" ON "ai_material_risk_daily" USING btree ("item_name","signal_date");--> statement-breakpoint
CREATE INDEX "ai_material_risk_daily_signal_date_idx" ON "ai_material_risk_daily" USING btree ("signal_date");--> statement-breakpoint
CREATE INDEX "ai_material_risk_daily_risk_idx" ON "ai_material_risk_daily" USING btree ("risk");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_weekly_stock_projection_ingredient_week_idx" ON "ai_weekly_stock_projections" USING btree ("ingredient_id","week_start");--> statement-breakpoint
CREATE INDEX "ai_weekly_stock_projection_week_start_idx" ON "ai_weekly_stock_projections" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_buy_recommendations_ingredient_date_idx" ON "ai_buy_recommendations" USING btree ("ingredient_id","recommendation_date");--> statement-breakpoint
CREATE INDEX "ai_buy_recommendations_date_idx" ON "ai_buy_recommendations" USING btree ("recommendation_date");--> statement-breakpoint
CREATE INDEX "ai_buy_recommendations_priority_idx" ON "ai_buy_recommendations" USING btree ("priority_score");--> statement-breakpoint
CREATE INDEX "ai_pipeline_runs_run_type_idx" ON "ai_pipeline_runs" USING btree ("run_type");--> statement-breakpoint
CREATE INDEX "ai_pipeline_runs_started_at_idx" ON "ai_pipeline_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ai_pipeline_runs_status_idx" ON "ai_pipeline_runs" USING btree ("status");
