ALTER TYPE "public"."repair_status" ADD VALUE 'draft' BEFORE 'reported';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'pending_department_head' BEFORE 'reported';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'pending_it_head' BEFORE 'reported';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'revision_required' BEFORE 'reported';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'pending_handover_confirmations' BEFORE 'reported';--> statement-breakpoint
ALTER TYPE "public"."repair_status" ADD VALUE 'ready_for_return' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "current_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "original_location" varchar(500);--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "department_head_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "department_head_decided_by" uuid;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "department_head_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "department_head_note" text;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_head_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_head_decided_by" uuid;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_head_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_head_note" text;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "employee_handover_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "employee_handover_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "employee_handover_note" text;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_handover_decision" "asset_recall_decision" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_handover_decided_by" uuid;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_handover_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "it_handover_note" text;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_department_head_decided_by_employees_id_fk" FOREIGN KEY ("department_head_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_it_head_decided_by_employees_id_fk" FOREIGN KEY ("it_head_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_it_handover_decided_by_employees_id_fk" FOREIGN KEY ("it_handover_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_repair_active_asset" ON "repair_requests" USING btree ("asset_id") WHERE "repair_requests"."status" not in ('closed', 'cancelled');