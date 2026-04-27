CREATE TABLE "password_reset_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_verification_id" uuid NOT NULL,
	"reset_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_sessions" ADD CONSTRAINT "password_reset_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_sessions" ADD CONSTRAINT "password_reset_sessions_phone_verification_id_phone_verifications_id_fk" FOREIGN KEY ("phone_verification_id") REFERENCES "public"."phone_verifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_sessions_token_uq" ON "password_reset_sessions" USING btree ("reset_token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_sessions_user_idx" ON "password_reset_sessions" USING btree ("user_id");