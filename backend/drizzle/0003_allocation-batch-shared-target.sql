CREATE TYPE "public"."asset_allocation_target_type" AS ENUM('individual', 'shared_location');--> statement-breakpoint
ALTER TABLE "asset_allocations" ALTER COLUMN "recipient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_allocations" ALTER COLUMN "recipient_decision" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "asset_allocations" ALTER COLUMN "recipient_decision" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD COLUMN "target_type" "asset_allocation_target_type" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "chk_asset_allocation_target" CHECK (("asset_allocations"."target_type" = 'individual' and "asset_allocations"."recipient_id" is not null and "asset_allocations"."recipient_decision" is not null) or ("asset_allocations"."target_type" = 'shared_location' and "asset_allocations"."recipient_id" is null and "asset_allocations"."recipient_decision" is null));