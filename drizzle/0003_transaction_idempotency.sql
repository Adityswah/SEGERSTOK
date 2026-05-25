ALTER TABLE "stock_transactions"
  ADD COLUMN IF NOT EXISTS "client_request_id" varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_transactions_client_request_id_idx"
  ON "stock_transactions" USING btree ("client_request_id")
;
