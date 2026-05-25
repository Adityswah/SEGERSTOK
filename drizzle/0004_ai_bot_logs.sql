CREATE TABLE IF NOT EXISTS "ai_bot_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text,
  "message" text NOT NULL,
  "clean_message" text NOT NULL,
  "intent" varchar(32) NOT NULL,
  "flow" varchar(32) NOT NULL,
  "answer" text NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_bot_logs"
  ADD CONSTRAINT "ai_bot_logs_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "ai_bot_logs_created_at_idx"
  ON "ai_bot_logs" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "ai_bot_logs_flow_idx"
  ON "ai_bot_logs" USING btree ("flow");

CREATE INDEX IF NOT EXISTS "ai_bot_logs_intent_idx"
  ON "ai_bot_logs" USING btree ("intent");

CREATE INDEX IF NOT EXISTS "ai_bot_logs_user_idx"
  ON "ai_bot_logs" USING btree ("user_id");
