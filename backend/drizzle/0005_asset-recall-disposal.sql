ALTER TABLE "asset_recall_requests" ADD COLUMN "processing_result" text;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD COLUMN "disposal_method" varchar(500);--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD COLUMN "disposal_date" date;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD COLUMN "recovery_value" numeric;