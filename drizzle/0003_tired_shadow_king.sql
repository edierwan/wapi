CREATE TABLE "ai_readiness_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"band_label" text DEFAULT 'not_ready' NOT NULL,
	"components" jsonb,
	"recommendations" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_memory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"embedding" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"variant_id" uuid,
	"queue_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"excluded_reason" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_safety_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"overall_status" text DEFAULT 'pending' NOT NULL,
	"checks" jsonb,
	"auto_fixes_applied" jsonb,
	"summary_text" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"label" text DEFAULT 'A' NOT NULL,
	"body_text" text NOT NULL,
	"language_code" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"send_mode" text DEFAULT 'standard' NOT NULL,
	"audience_filter" jsonb,
	"estimated_recipients" integer,
	"excluded_recipients" integer,
	"final_recipients" integer,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"consent_type" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text,
	"evidence_text" text,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tag_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"full_name" text,
	"email" text,
	"language_id" uuid,
	"country_id" uuid,
	"source" text,
	"status" text DEFAULT 'active' NOT NULL,
	"opt_in_at" timestamp with time zone,
	"opt_out_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"lead_status" text DEFAULT 'none' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followup_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_config" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "followup_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_hours" integer DEFAULT 24 NOT NULL,
	"body_text" text,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"from_phone" text NOT NULL,
	"body_text" text,
	"payload" jsonb,
	"provider_message_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"intent" text,
	"sentiment" text,
	"handled_by_ai" boolean DEFAULT false NOT NULL,
	"ai_reply_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid,
	"contact_id" uuid,
	"campaign_id" uuid,
	"to_phone" text NOT NULL,
	"purpose" text DEFAULT 'campaign' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"body_text" text,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_brand_voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt_instruction" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_business_natures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso2_code" text NOT NULL,
	"iso3_code" text,
	"name" text NOT NULL,
	"phone_country_code" text,
	"default_currency_code" text,
	"default_language_code" text,
	"default_timezone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"native_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_timezones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"utc_offset" text,
	"country_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "industry_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "country_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "currency_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "language_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "timezone_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "business_nature_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "brand_voice_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD COLUMN "brand_voice_custom" text;--> statement-breakpoint
ALTER TABLE "ai_readiness_scores" ADD CONSTRAINT "ai_readiness_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_memory_items" ADD CONSTRAINT "business_memory_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_variant_id_campaign_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."campaign_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_queue_id_message_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."message_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_safety_reviews" ADD CONSTRAINT "campaign_safety_reviews_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_safety_reviews" ADD CONSTRAINT "campaign_safety_reviews_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_variants" ADD CONSTRAINT "campaign_variants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_consents" ADD CONSTRAINT "contact_consents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tag_assignments" ADD CONSTRAINT "contact_tag_assignments_tag_id_contact_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."contact_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_language_id_ref_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."ref_languages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_country_id_ref_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."ref_countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_sequences" ADD CONSTRAINT "followup_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followup_steps" ADD CONSTRAINT "followup_steps_sequence_id_followup_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."followup_sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_account_id_connected_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queue" ADD CONSTRAINT "message_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queue" ADD CONSTRAINT "message_queue_account_id_connected_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queue" ADD CONSTRAINT "message_queue_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ref_timezones" ADD CONSTRAINT "ref_timezones_country_id_ref_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."ref_countries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_readiness_scores_tenant_idx" ON "ai_readiness_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "business_memory_items_tenant_idx" ON "business_memory_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "business_memory_items_kind_idx" ON "business_memory_items" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "campaign_recipients_campaign_idx" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_pair_uq" ON "campaign_recipients" USING btree ("campaign_id","contact_id");--> statement-breakpoint
CREATE INDEX "campaign_safety_reviews_campaign_idx" ON "campaign_safety_reviews" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_variants_campaign_idx" ON "campaign_variants" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "contact_consents_contact_idx" ON "contact_consents" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_tag_assignments_pair_uq" ON "contact_tag_assignments" USING btree ("contact_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_tags_tenant_name_uq" ON "contact_tags" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_phone_uq" ON "contacts" USING btree ("tenant_id","phone_e164");--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contacts_lead_status_idx" ON "contacts" USING btree ("tenant_id","lead_status");--> statement-breakpoint
CREATE INDEX "followup_sequences_tenant_idx" ON "followup_sequences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "followup_steps_sequence_idx" ON "followup_steps" USING btree ("sequence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "followup_steps_seq_order_uq" ON "followup_steps" USING btree ("sequence_id","step_order");--> statement-breakpoint
CREATE INDEX "inbound_messages_tenant_idx" ON "inbound_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inbound_messages_contact_idx" ON "inbound_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "inbound_messages_intent_idx" ON "inbound_messages" USING btree ("tenant_id","intent");--> statement-breakpoint
CREATE INDEX "message_queue_tenant_idx" ON "message_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "message_queue_status_idx" ON "message_queue" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "message_queue_campaign_idx" ON "message_queue" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_brand_voices_code_uq" ON "ref_brand_voices" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_business_natures_code_uq" ON "ref_business_natures" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_countries_iso2_uq" ON "ref_countries" USING btree ("iso2_code");--> statement-breakpoint
CREATE INDEX "ref_countries_status_idx" ON "ref_countries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_currencies_code_uq" ON "ref_currencies" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_industries_code_uq" ON "ref_industries" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_languages_code_uq" ON "ref_languages" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_timezones_name_uq" ON "ref_timezones" USING btree ("name");