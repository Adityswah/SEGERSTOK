ALTER TABLE "stock_transactions" ADD COLUMN "transaction_no" varchar(40);--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD COLUMN "transaction_no" varchar(40);--> statement-breakpoint
ALTER TABLE "bom_production_runs" ADD COLUMN "transaction_no" varchar(40);--> statement-breakpoint
CREATE INDEX "stock_transactions_transaction_no_idx" ON "stock_transactions" USING btree ("transaction_no");--> statement-breakpoint
CREATE INDEX "finance_transactions_transaction_no_idx" ON "finance_transactions" USING btree ("transaction_no");--> statement-breakpoint
CREATE INDEX "bom_production_runs_transaction_no_idx" ON "bom_production_runs" USING btree ("transaction_no");
