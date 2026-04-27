ALTER TABLE "tenant_ai_settings" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "mode" text DEFAULT 'shared_app_per_tenant_dataset' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "dify_app_id" text;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "dify_dataset_id" text;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "dify_dataset_name" text;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "api_key_ref" text;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "sync_status" text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_ai_settings" ADD COLUMN "last_sync_error" text;