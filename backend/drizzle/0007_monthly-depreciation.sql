CREATE TABLE "asset_depreciation_profiles" (
	"asset_id" uuid PRIMARY KEY NOT NULL,
	"original_cost" numeric(18, 0) NOT NULL,
	"opening_value" numeric(18, 0) NOT NULL,
	"first_month" date NOT NULL,
	"start_date" date NOT NULL,
	"term_months" integer NOT NULL,
	"remaining_months" integer NOT NULL,
	"stop_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "depreciation_profile_values" CHECK ("asset_depreciation_profiles"."original_cost" > 0 and "asset_depreciation_profiles"."opening_value" >= 0 and "asset_depreciation_profiles"."opening_value" <= "asset_depreciation_profiles"."original_cost"),
	CONSTRAINT "depreciation_profile_term" CHECK ("asset_depreciation_profiles"."remaining_months" > 0 and "asset_depreciation_profiles"."remaining_months" <= "asset_depreciation_profiles"."term_months" and "asset_depreciation_profiles"."term_months" <= 1200),
	CONSTRAINT "depreciation_profile_dates" CHECK ("asset_depreciation_profiles"."stop_date" is null or "asset_depreciation_profiles"."stop_date" >= "asset_depreciation_profiles"."start_date")
);
--> statement-breakpoint
CREATE TABLE "depreciation_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculated_at" timestamp with time zone,
	"submitted_by" uuid,
	"return_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "depreciation_periods_month_unique" UNIQUE("month"),
	CONSTRAINT "depreciation_period_status" CHECK ("depreciation_periods"."status" in ('draft', 'pending_approval', 'recorded')),
	CONSTRAINT "depreciation_period_month" CHECK (extract(day from "depreciation_periods"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "depreciation_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"first_month" date NOT NULL,
	CONSTRAINT "depreciation_settings_singleton" CHECK ("depreciation_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "asset_depreciations" ADD COLUMN "period_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_depreciation_profiles" ADD CONSTRAINT "asset_depreciation_profiles_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_depreciation_profiles" ADD CONSTRAINT "asset_depreciation_profiles_updated_by_employees_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depreciation_periods" ADD CONSTRAINT "depreciation_periods_submitted_by_employees_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_depreciations" ADD CONSTRAINT "asset_depreciations_period_id_depreciation_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."depreciation_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_depreciation_period_asset" ON "asset_depreciations" USING btree ("period_id","asset_id");