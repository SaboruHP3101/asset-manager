CREATE TYPE "public"."asset_recall_decision" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."asset_recall_status" AS ENUM('draft', 'pending_department_head', 'pending_it_head', 'revision_required', 'pending_handover_confirmations', 'in_progress', 'ready_for_return', 'completed');--> statement-breakpoint
CREATE TYPE "public"."asset_recall_type" AS ENUM('exchange', 'upgrade', 'disposal');--> statement-breakpoint
CREATE TABLE "asset_recall_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "asset_recall_type" DEFAULT 'exchange' NOT NULL,
	"status" "asset_recall_status" DEFAULT 'draft' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"asset_id" uuid NOT NULL,
	"replacement_asset_id" uuid,
	"requested_by" uuid NOT NULL,
	"requesting_department_id" uuid NOT NULL,
	"original_location" varchar(500),
	"reason" text,
	"department_head_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL,
	"department_head_decided_by" uuid,
	"department_head_decided_at" timestamp with time zone,
	"department_head_note" text,
	"it_head_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL,
	"it_head_decided_by" uuid,
	"it_head_decided_at" timestamp with time zone,
	"it_head_note" text,
	"employee_handover_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL,
	"employee_handover_decided_at" timestamp with time zone,
	"employee_handover_note" text,
	"it_handover_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL,
	"it_handover_decided_by" uuid,
	"it_handover_decided_at" timestamp with time zone,
	"it_handover_note" text,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_asset_recall_different_assets" CHECK ("asset_recall_requests"."replacement_asset_id" is null or "asset_recall_requests"."replacement_asset_id" <> "asset_recall_requests"."asset_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"managing_department_id" uuid NOT NULL,
	"location" varchar(500) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD COLUMN "handover_from_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD COLUMN "received_by_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "current_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_replacement_asset_id_assets_id_fk" FOREIGN KEY ("replacement_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_requested_by_employees_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_requesting_department_id_departments_id_fk" FOREIGN KEY ("requesting_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_department_head_decided_by_employees_id_fk" FOREIGN KEY ("department_head_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_it_head_decided_by_employees_id_fk" FOREIGN KEY ("it_head_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_it_handover_decided_by_employees_id_fk" FOREIGN KEY ("it_handover_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_recall_requests" ADD CONSTRAINT "asset_recall_requests_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_managing_department_id_departments_id_fk" FOREIGN KEY ("managing_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_asset_recall_status" ON "asset_recall_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_asset_recall_requester" ON "asset_recall_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_asset_recall_department" ON "asset_recall_requests" USING btree ("requesting_department_id");--> statement-breakpoint
CREATE INDEX "idx_asset_recall_asset" ON "asset_recall_requests" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asset_recall_active_asset" ON "asset_recall_requests" USING btree ("asset_id") WHERE "asset_recall_requests"."status" <> 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asset_recall_reserved_replacement" ON "asset_recall_requests" USING btree ("replacement_asset_id") WHERE "asset_recall_requests"."replacement_asset_id" is not null and "asset_recall_requests"."status" <> 'completed';--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_handover_from_warehouse_id_warehouses_id_fk" FOREIGN KEY ("handover_from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_received_by_warehouse_id_warehouses_id_fk" FOREIGN KEY ("received_by_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_warehouse_id_warehouses_id_fk" FOREIGN KEY ("current_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;