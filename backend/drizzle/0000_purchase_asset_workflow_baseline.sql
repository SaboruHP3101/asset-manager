CREATE TYPE "public"."allocation_decision" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."asset_allocation_status" AS ENUM('pending_confirmations', 'confirmed', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."asset_management_owner" AS ENUM('it', 'procurement');--> statement-breakpoint
CREATE TYPE "public"."asset_tracking_mode" AS ENUM('individual_asset', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."inspection_result" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'pending_procurement_head', 'issued', 'partially_received', 'fully_received', 'closed_short', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."purchase_receipt_status" AS ENUM('pending_inspection', 'inspecting', 'inspected');--> statement-breakpoint
CREATE TYPE "public"."purchase_request_status" AS ENUM('draft', 'pending_department_head', 'pending_procurement_enrichment', 'pending_procurement_head', 'pending_it_head', 'revision_required', 'approved', 'ordering', 'fully_ordered');--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('reported', 'assessed', 'approval_pending', 'in_progress', 'completed', 'confirmed', 'rejected', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('requested', 'dept_approved', 'verified', 'handoff_pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "approval_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"approval_step" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"previous_status" varchar(100) NOT NULL,
	"new_status" varchar(100) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"initiated_by" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"location" varchar(500) NOT NULL,
	"management_owner_snapshot" "asset_management_owner" NOT NULL,
	"status" "asset_allocation_status" DEFAULT 'pending_confirmations' NOT NULL,
	"department_head_decision" "allocation_decision" DEFAULT 'pending' NOT NULL,
	"department_head_decided_by" uuid,
	"department_head_decided_at" timestamp with time zone,
	"department_head_note" text,
	"recipient_decision" "allocation_decision" DEFAULT 'pending' NOT NULL,
	"recipient_decided_at" timestamp with time zone,
	"recipient_note" text,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_asset_allocation_attempt" CHECK ("asset_allocations"."attempt_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_category_id" uuid,
	"description" text,
	"management_owner" "asset_management_owner" DEFAULT 'procurement' NOT NULL,
	"tracking_mode" "asset_tracking_mode" DEFAULT 'individual_asset' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "asset_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "asset_depreciations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"opening_value" numeric NOT NULL,
	"depreciation_amount" numeric NOT NULL,
	"remaining_value" numeric NOT NULL,
	"depreciation_method" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_handover_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"handover_type" varchar(100) NOT NULL,
	"handover_from_employee_id" uuid,
	"received_by_employee_id" uuid,
	"handover_from_department_id" uuid,
	"received_by_department_id" uuid,
	"handover_date" date NOT NULL,
	"status" varchar(100) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"inspected_by_employee_id" uuid NOT NULL,
	"inspection_date" date NOT NULL,
	"completion_date" date,
	"actual_status" varchar(100) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_liquidation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"liquidation_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"liquidation_value" numeric NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "asset_liquidations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposed_by_employee_id" uuid NOT NULL,
	"proposed_date" date NOT NULL,
	"approved_date" date,
	"liquidation_date" date,
	"status" varchar(100) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_code" varchar(100) NOT NULL,
	"qr_code" varchar(255) NOT NULL,
	"asset_category_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"current_user_id" uuid,
	"current_managing_department_id" uuid,
	"purchase_order_item_id" uuid,
	"purchase_receipt_unit_id" uuid,
	"name" varchar(255),
	"current_location" varchar(500),
	"current_value" numeric,
	"status" varchar(100) NOT NULL,
	"initial_value" numeric NOT NULL,
	"purchase_date" date NOT NULL,
	"in_service_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "assets_asset_code_unique" UNIQUE("asset_code"),
	CONSTRAINT "assets_qr_code_unique" UNIQUE("qr_code"),
	CONSTRAINT "assets_purchase_receipt_unit_id_unique" UNIQUE("purchase_receipt_unit_id")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"uploaded_by_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"performed_by_employee_id" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_code" varchar(100) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(50),
	"department_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"password" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_department_head" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"notification_type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(100) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"signed_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date NOT NULL,
	"contract_value" numeric NOT NULL,
	"status" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "purchase_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"purchase_request_item_id" uuid NOT NULL,
	"selected_quote_id" uuid NOT NULL,
	"item_name_snapshot" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_excl_vat" numeric(18, 0) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"subtotal_excl_vat" numeric(18, 0) NOT NULL,
	"vat_amount" numeric(18, 0) NOT NULL,
	"total_incl_vat" numeric(18, 0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_purchase_order_item_quantity" CHECK ("purchase_order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_code" varchar(100) NOT NULL,
	"purchase_request_id" uuid NOT NULL,
	"request_revision_id" uuid NOT NULL,
	"contract_id" uuid,
	"supplier_id" uuid NOT NULL,
	"created_by_employee_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "purchase_orders_purchase_order_code_unique" UNIQUE("purchase_order_code")
);
--> statement-breakpoint
CREATE TABLE "purchase_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_receipt_id" uuid NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"delivered_quantity" integer NOT NULL,
	"accepted_quantity" integer DEFAULT 0 NOT NULL,
	"rejected_quantity" integer DEFAULT 0 NOT NULL,
	"management_owner_snapshot" "asset_management_owner" NOT NULL,
	"tracking_mode_snapshot" "asset_tracking_mode" NOT NULL,
	"inspection_result" "inspection_result" DEFAULT 'pending' NOT NULL,
	"inspected_by" uuid,
	"inspected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_purchase_receipt_item_delivered_quantity" CHECK ("purchase_receipt_items"."delivered_quantity" > 0),
	CONSTRAINT "chk_purchase_receipt_item_accepted_quantity" CHECK ("purchase_receipt_items"."accepted_quantity" >= 0),
	CONSTRAINT "chk_purchase_receipt_item_rejected_quantity" CHECK ("purchase_receipt_items"."rejected_quantity" >= 0),
	CONSTRAINT "chk_purchase_receipt_item_inspected_quantity" CHECK ("purchase_receipt_items"."accepted_quantity" + "purchase_receipt_items"."rejected_quantity" <= "purchase_receipt_items"."delivered_quantity")
);
--> statement-breakpoint
CREATE TABLE "purchase_receipt_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_receipt_item_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"serial_number" varchar(255),
	"inspection_result" "inspection_result" DEFAULT 'pending' NOT NULL,
	"inspected_by" uuid,
	"inspected_at" timestamp with time zone,
	"rejection_reason" text,
	"evidence_attachment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_purchase_receipt_unit_sequence" CHECK ("purchase_receipt_units"."sequence_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_code" varchar(100) NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"status" "purchase_receipt_status" DEFAULT 'pending_inspection' NOT NULL,
	"delivery_date" date NOT NULL,
	"delivery_note_number" varchar(100) NOT NULL,
	"delivery_note_attachment_id" uuid NOT NULL,
	"invoice_attachment_id" uuid,
	"warranty_attachment_id" uuid,
	"recorded_by" uuid NOT NULL,
	"inspected_at" timestamp with time zone,
	"inspected_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "purchase_receipts_receipt_code_unique" UNIQUE("receipt_code")
);
--> statement-breakpoint
CREATE TABLE "purchase_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_revision_id" uuid NOT NULL,
	"asset_category_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"specifications" text NOT NULL,
	"purpose" text,
	"quantity" integer NOT NULL,
	"unit" varchar(50) NOT NULL,
	"management_owner_snapshot" "asset_management_owner" NOT NULL,
	"tracking_mode_snapshot" "asset_tracking_mode" NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_purchase_request_item_quantity" CHECK ("purchase_request_items"."quantity" > 0),
	CONSTRAINT "chk_purchase_request_item_sort_order" CHECK ("purchase_request_items"."sort_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_request_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_item_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"unit_price_excl_vat" numeric(18, 0) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"is_selected" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "chk_purchase_request_quote_price" CHECK ("purchase_request_quotes"."unit_price_excl_vat" >= 0),
	CONSTRAINT "chk_purchase_request_quote_vat" CHECK ("purchase_request_quotes"."vat_rate" >= 0 AND "purchase_request_quotes"."vat_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "purchase_request_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_request_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"needed_by_date" date NOT NULL,
	"purpose" text NOT NULL,
	"note" text,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"returned_at" timestamp with time zone,
	"returned_by" uuid,
	"return_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "chk_purchase_request_revision_positive" CHECK ("purchase_request_revisions"."revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_code" varchar(100) NOT NULL,
	"status" "purchase_request_status" DEFAULT 'draft' NOT NULL,
	"current_revision" integer DEFAULT 1 NOT NULL,
	"requester_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "purchase_requests_request_code_unique" UNIQUE("request_code")
);
--> statement-breakpoint
CREATE TABLE "repair_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"department_id" uuid,
	"report_date" date NOT NULL,
	"issue_description" text NOT NULL,
	"status" "repair_status" DEFAULT 'reported' NOT NULL,
	"assessed_by" uuid,
	"assessed_at" timestamp with time zone,
	"assessment_notes" text,
	"needs_approval" boolean DEFAULT false NOT NULL,
	"estimated_repair_cost" numeric,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"assigned_to" uuid,
	"assigned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result_notes" text,
	"repair_cost" numeric,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmation_status" varchar(50),
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "request_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_type" varchar(50) NOT NULL,
	"request_id" uuid NOT NULL,
	"workflow_revision" integer,
	"action_type" varchar(50) NOT NULL,
	"approver_role" varchar(50) NOT NULL,
	"approved_by" uuid NOT NULL,
	"status" varchar(50) NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "supplier_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"address_type" varchar(100) NOT NULL,
	"address" varchar(1000) NOT NULL,
	"province_city" varchar(255),
	"country" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"position" varchar(255),
	"email" varchar(255),
	"phone_number" varchar(50),
	"is_primary_contact" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_code" varchar(100) NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"trade_name" varchar(255),
	"tax_code" varchar(100) NOT NULL,
	"website" varchar(2048),
	"status" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "suppliers_supplier_code_unique" UNIQUE("supplier_code"),
	CONSTRAINT "suppliers_tax_code_unique" UNIQUE("tax_code")
);
--> statement-breakpoint
CREATE TABLE "transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "transfer_status" DEFAULT 'requested' NOT NULL,
	"asset_id" uuid NOT NULL,
	"initiated_by" uuid NOT NULL,
	"from_department_id" uuid NOT NULL,
	"to_department_id" uuid NOT NULL,
	"to_user_id" uuid,
	"new_location" varchar(500),
	"reason" text NOT NULL,
	"dept_head_approved_by" uuid,
	"dept_head_approved_at" timestamp with time zone,
	"asset_team_verified_by" uuid,
	"asset_team_verified_at" timestamp with time zone,
	"sender_confirmed_by" uuid,
	"sender_confirmed_at" timestamp with time zone,
	"receiver_confirmed_by" uuid,
	"receiver_confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approver_id_employees_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_initiated_by_employees_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_recipient_id_employees_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_department_head_decided_by_employees_id_fk" FOREIGN KEY ("department_head_decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocations" ADD CONSTRAINT "asset_allocations_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_parent_category_id_asset_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."asset_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_depreciations" ADD CONSTRAINT "asset_depreciations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_depreciations" ADD CONSTRAINT "asset_depreciations_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_depreciations" ADD CONSTRAINT "asset_depreciations_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_handover_from_employee_id_employees_id_fk" FOREIGN KEY ("handover_from_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_received_by_employee_id_employees_id_fk" FOREIGN KEY ("received_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_handover_from_department_id_departments_id_fk" FOREIGN KEY ("handover_from_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_received_by_department_id_departments_id_fk" FOREIGN KEY ("received_by_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_handover_history" ADD CONSTRAINT "asset_handover_history_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_inspected_by_employee_id_employees_id_fk" FOREIGN KEY ("inspected_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidation_items" ADD CONSTRAINT "asset_liquidation_items_liquidation_id_asset_liquidations_id_fk" FOREIGN KEY ("liquidation_id") REFERENCES "public"."asset_liquidations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidation_items" ADD CONSTRAINT "asset_liquidation_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidation_items" ADD CONSTRAINT "asset_liquidation_items_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidation_items" ADD CONSTRAINT "asset_liquidation_items_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidations" ADD CONSTRAINT "asset_liquidations_proposed_by_employee_id_employees_id_fk" FOREIGN KEY ("proposed_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidations" ADD CONSTRAINT "asset_liquidations_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liquidations" ADD CONSTRAINT "asset_liquidations_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_category_id_asset_categories_id_fk" FOREIGN KEY ("asset_category_id") REFERENCES "public"."asset_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_user_id_employees_id_fk" FOREIGN KEY ("current_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_managing_department_id_departments_id_fk" FOREIGN KEY ("current_managing_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_purchase_receipt_unit_id_purchase_receipt_units_id_fk" FOREIGN KEY ("purchase_receipt_unit_id") REFERENCES "public"."purchase_receipt_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_employee_id_employees_id_fk" FOREIGN KEY ("uploaded_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_performed_by_employee_id_employees_id_fk" FOREIGN KEY ("performed_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_employees_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_contracts" ADD CONSTRAINT "purchase_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_contracts" ADD CONSTRAINT "purchase_contracts_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_contracts" ADD CONSTRAINT "purchase_contracts_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_request_item_id_purchase_request_items_id_fk" FOREIGN KEY ("purchase_request_item_id") REFERENCES "public"."purchase_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_selected_quote_id_purchase_request_quotes_id_fk" FOREIGN KEY ("selected_quote_id") REFERENCES "public"."purchase_request_quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_revision_id_purchase_request_revisions_id_fk" FOREIGN KEY ("request_revision_id") REFERENCES "public"."purchase_request_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_contract_id_purchase_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."purchase_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_employee_id_employees_id_fk" FOREIGN KEY ("created_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_submitted_by_employees_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancelled_by_employees_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_receipt_id_purchase_receipts_id_fk" FOREIGN KEY ("purchase_receipt_id") REFERENCES "public"."purchase_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_inspected_by_employees_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_units" ADD CONSTRAINT "purchase_receipt_units_purchase_receipt_item_id_purchase_receipt_items_id_fk" FOREIGN KEY ("purchase_receipt_item_id") REFERENCES "public"."purchase_receipt_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_units" ADD CONSTRAINT "purchase_receipt_units_inspected_by_employees_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_units" ADD CONSTRAINT "purchase_receipt_units_evidence_attachment_id_attachments_id_fk" FOREIGN KEY ("evidence_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_units" ADD CONSTRAINT "purchase_receipt_units_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_units" ADD CONSTRAINT "purchase_receipt_units_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_delivery_note_attachment_id_attachments_id_fk" FOREIGN KEY ("delivery_note_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_invoice_attachment_id_attachments_id_fk" FOREIGN KEY ("invoice_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_warranty_attachment_id_attachments_id_fk" FOREIGN KEY ("warranty_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_recorded_by_employees_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_inspected_by_employees_id_fk" FOREIGN KEY ("inspected_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_revision_id_purchase_request_revisions_id_fk" FOREIGN KEY ("request_revision_id") REFERENCES "public"."purchase_request_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_asset_category_id_asset_categories_id_fk" FOREIGN KEY ("asset_category_id") REFERENCES "public"."asset_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_quotes" ADD CONSTRAINT "purchase_request_quotes_request_item_id_purchase_request_items_id_fk" FOREIGN KEY ("request_item_id") REFERENCES "public"."purchase_request_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_quotes" ADD CONSTRAINT "purchase_request_quotes_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_quotes" ADD CONSTRAINT "purchase_request_quotes_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_quotes" ADD CONSTRAINT "purchase_request_quotes_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_quotes" ADD CONSTRAINT "purchase_request_quotes_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_revisions" ADD CONSTRAINT "purchase_request_revisions_purchase_request_id_purchase_requests_id_fk" FOREIGN KEY ("purchase_request_id") REFERENCES "public"."purchase_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_revisions" ADD CONSTRAINT "purchase_request_revisions_submitted_by_employees_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_revisions" ADD CONSTRAINT "purchase_request_revisions_returned_by_employees_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_request_revisions" ADD CONSTRAINT "purchase_request_revisions_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requester_id_employees_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_reporter_id_employees_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_assessed_by_employees_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_assigned_to_employees_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_confirmed_by_employees_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_approved_by_employees_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_initiated_by_employees_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_from_department_id_departments_id_fk" FOREIGN KEY ("from_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_department_id_departments_id_fk" FOREIGN KEY ("to_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_user_id_employees_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_dept_head_approved_by_employees_id_fk" FOREIGN KEY ("dept_head_approved_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_asset_team_verified_by_employees_id_fk" FOREIGN KEY ("asset_team_verified_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_sender_confirmed_by_employees_id_fk" FOREIGN KEY ("sender_confirmed_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_receiver_confirmed_by_employees_id_fk" FOREIGN KEY ("receiver_confirmed_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asset_allocation_attempt" ON "asset_allocations" USING btree ("asset_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_asset_allocation_pending" ON "asset_allocations" USING btree ("asset_id") WHERE "asset_allocations"."status" = 'pending_confirmations';--> statement-breakpoint
CREATE INDEX "idx_asset_allocation_recipient" ON "asset_allocations" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_asset_allocation_department" ON "asset_allocations" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_asset_category_management_owner" ON "asset_categories" USING btree ("management_owner");--> statement-breakpoint
CREATE INDEX "idx_asset_category_tracking_mode" ON "asset_categories" USING btree ("tracking_mode");--> statement-breakpoint
CREATE INDEX "idx_notification_recipient" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notification_recipient_read" ON "notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_notification_entity" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_item_order" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_item_request_item" ON "purchase_order_items" USING btree ("purchase_request_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_request" ON "purchase_orders" USING btree ("purchase_request_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_revision" ON "purchase_orders" USING btree ("request_revision_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_order_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_receipt_item_order_item" ON "purchase_receipt_items" USING btree ("purchase_receipt_id","purchase_order_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_receipt_item_receipt" ON "purchase_receipt_items" USING btree ("purchase_receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_receipt_unit_sequence" ON "purchase_receipt_units" USING btree ("purchase_receipt_item_id","sequence_number");--> statement-breakpoint
CREATE INDEX "idx_purchase_receipt_unit_item" ON "purchase_receipt_units" USING btree ("purchase_receipt_item_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_receipt_order" ON "purchase_receipts" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_receipt_status" ON "purchase_receipts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_request_item_sort_order" ON "purchase_request_items" USING btree ("request_revision_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_purchase_request_item_revision" ON "purchase_request_items" USING btree ("request_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_request_quote_supplier" ON "purchase_request_quotes" USING btree ("request_item_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_request_quote_selected" ON "purchase_request_quotes" USING btree ("request_item_id") WHERE "purchase_request_quotes"."is_selected" = true;--> statement-breakpoint
CREATE INDEX "idx_purchase_request_quote_item" ON "purchase_request_quotes" USING btree ("request_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_purchase_request_revision" ON "purchase_request_revisions" USING btree ("purchase_request_id","revision_number");--> statement-breakpoint
CREATE INDEX "idx_purchase_request_revision_request" ON "purchase_request_revisions" USING btree ("purchase_request_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_request_status" ON "purchase_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_purchase_department" ON "purchase_requests" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requester" ON "purchase_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "idx_repair_status" ON "repair_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_repair_asset" ON "repair_requests" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_repair_department" ON "repair_requests" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_repair_reporter" ON "repair_requests" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_request_approval_type" ON "request_approvals" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "idx_request_approval_request" ON "request_approvals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_request_approval_created_at" ON "request_approvals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_transfer_status" ON "transfer_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transfer_asset" ON "transfer_requests" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_from_department" ON "transfer_requests" USING btree ("from_department_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_to_department" ON "transfer_requests" USING btree ("to_department_id");