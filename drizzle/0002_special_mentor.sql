CREATE TABLE "pending_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"business_nature" text,
	"number_of_agents" integer,
	"tenant_slug_candidate" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"pending_registration_id" uuid,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" text DEFAULT 'register' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"provider" text DEFAULT 'whatsapp_gateway' NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_system_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "scope_type" text DEFAULT 'tenant' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_system_roles" ADD CONSTRAINT "user_system_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_system_roles" ADD CONSTRAINT "user_system_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_system_roles" ADD CONSTRAINT "user_system_roles_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "pending_registrations_phone_idx" ON "pending_registrations" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "phone_verifications_phone_idx" ON "phone_verifications" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "phone_verifications_pending_idx" ON "phone_verifications" USING btree ("pending_registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_system_roles_user_role_uq" ON "user_system_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "user_system_roles_user_idx" ON "user_system_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "roles_scope_idx" ON "roles" USING btree ("scope_type");