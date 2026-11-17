ALTER TABLE "employees" DROP CONSTRAINT "employees_role_id_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN "role_id";--> statement-breakpoint
DROP TABLE "roles";--> statement-breakpoint
ALTER TABLE "request_approvals" ALTER COLUMN "approver_role" TYPE varchar(255);
