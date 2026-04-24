CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."business_nature" AS ENUM('product', 'service', 'hybrid', 'booking', 'lead_gen', 'support', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('physical', 'digital', 'bundle', 'consumable', 'other');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('consultation', 'appointment', 'package', 'subscription', 'repair', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."storage_object_kind" AS ENUM('product_image', 'service_image', 'campaign_attachment', 'chat_media_inbound', 'chat_media_outbound', 'export', 'other');--> statement-breakpoint
CREATE TYPE "public"."storage_object_status" AS ENUM('uploading', 'ready', 'quarantined', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" jsonb,
	"status" "api_key_status" DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"object_type" text,
	"object_id" uuid,
	"before_json" jsonb,
	"after_json" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"customer_segment" text,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"media_type" text DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"alt_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"price_list_id" uuid,
	"currency" text DEFAULT 'MYR' NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"compare_at_amount" numeric(18, 4),
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_code" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb,
	"sku" text,
	"barcode" text,
	"default_price" numeric(18, 4),
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"product_code" text NOT NULL,
	"sku" text,
	"barcode" text,
	"name" text NOT NULL,
	"short_description" text,
	"long_description" text,
	"product_type" "product_type" DEFAULT 'physical' NOT NULL,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"brand" text,
	"unit_of_measure" text DEFAULT 'pc' NOT NULL,
	"default_price" numeric(18, 4),
	"currency" text DEFAULT 'MYR' NOT NULL,
	"cost_price" numeric(18, 4),
	"tax_code" text,
	"track_inventory" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"branch_id" uuid,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"capacity" integer,
	"status" "item_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"package_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_price" numeric(18, 4),
	"currency" text DEFAULT 'MYR' NOT NULL,
	"validity_days" integer,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid,
	"service_code" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"long_description" text,
	"service_type" "service_type" DEFAULT 'consultation' NOT NULL,
	"duration_minutes" integer,
	"default_price" numeric(18, 4),
	"currency" text DEFAULT 'MYR' NOT NULL,
	"tax_code" text,
	"requires_booking" boolean DEFAULT false NOT NULL,
	"requires_deposit" boolean DEFAULT false NOT NULL,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "storage_object_kind" NOT NULL,
	"owner_type" text,
	"owner_id" uuid,
	"bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text,
	"uploaded_by_user_id" uuid,
	"status" "storage_object_status" DEFAULT 'uploading' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"business_nature" "business_nature" DEFAULT 'other' NOT NULL,
	"industry" text,
	"business_registration_no" text,
	"tax_id" text,
	"default_currency" text DEFAULT 'MYR' NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	"primary_country" text DEFAULT 'MY' NOT NULL,
	"primary_phone" text,
	"support_email" text,
	"website_url" text,
	"brand_voice" text,
	"prohibited_words" jsonb,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret_ref" text NOT NULL,
	"events" jsonb NOT NULL,
	"status" "webhook_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_availability" ADD CONSTRAINT "service_availability_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_availability" ADD CONSTRAINT "service_availability_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_business_profiles" ADD CONSTRAINT "tenant_business_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_uq" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_code_uq" ON "permissions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "price_lists_tenant_code_uq" ON "price_lists" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "product_categories_tenant_idx" ON "product_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_tenant_code_uq" ON "product_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "product_media_product_idx" ON "product_media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_prices_product_idx" ON "product_prices" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_product_code_uq" ON "product_variants" USING btree ("product_id","variant_code");--> statement-breakpoint
CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_code_uq" ON "products" USING btree ("tenant_id","product_code");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_perm_uq" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "roles_tenant_idx" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_availability_service_idx" ON "service_availability" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_categories_tenant_code_uq" ON "service_categories" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "service_package_items_package_idx" ON "service_package_items" USING btree ("package_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_packages_tenant_code_uq" ON "service_packages" USING btree ("tenant_id","package_code");--> statement-breakpoint
CREATE INDEX "services_tenant_idx" ON "services" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_tenant_code_uq" ON "services" USING btree ("tenant_id","service_code");--> statement-breakpoint
CREATE INDEX "storage_objects_tenant_kind_idx" ON "storage_objects" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE INDEX "storage_objects_owner_idx" ON "storage_objects" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "storage_objects_bucket_key_uq" ON "storage_objects" USING btree ("bucket","storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_business_profiles_tenant_uq" ON "tenant_business_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_tenant_idx" ON "webhook_endpoints" USING btree ("tenant_id");