CREATE TYPE "public"."product_channel" AS ENUM('shopee', 'lazada', 'tiktok_shop', 'shopify', 'woocommerce', 'facebook_shop', 'instagram_shop', 'custom');--> statement-breakpoint
CREATE TYPE "public"."product_channel_sync_status" AS ENUM('not_synced', 'synced', 'error', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."product_media_type" AS ENUM('image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TABLE "product_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_product_id" uuid NOT NULL,
	"child_product_id" uuid NOT NULL,
	"child_variant_id" uuid,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_channel_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"channel" "product_channel" NOT NULL,
	"external_product_id" text,
	"external_variant_id" text,
	"external_sku" text,
	"channel_title" text,
	"channel_status" text,
	"channel_url" text,
	"last_synced_at" timestamp with time zone,
	"sync_status" "product_channel_sync_status" DEFAULT 'not_synced' NOT NULL,
	"sync_error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ref_units" (
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
ALTER TABLE "product_media" ALTER COLUMN "media_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_media" ALTER COLUMN "media_type" SET DATA TYPE product_media_type USING "media_type"::text::product_media_type;--> statement-breakpoint
ALTER TABLE "product_media" ALTER COLUMN "media_type" SET DEFAULT 'image';--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "status" SET DATA TYPE product_status USING "status"::text::product_status;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "status" SET DATA TYPE product_status USING "status"::text::product_status;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "compare_at_price" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_selling_notes" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ai_faq_notes" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_parent_product_id_products_id_fk" FOREIGN KEY ("parent_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_child_product_id_products_id_fk" FOREIGN KEY ("child_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_child_variant_id_product_variants_id_fk" FOREIGN KEY ("child_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_channel_mappings" ADD CONSTRAINT "product_channel_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_channel_mappings" ADD CONSTRAINT "product_channel_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_channel_mappings" ADD CONSTRAINT "product_channel_mappings_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_bundles_parent_idx" ON "product_bundles" USING btree ("parent_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_bundles_parent_child_uq" ON "product_bundles" USING btree ("parent_product_id","child_product_id","child_variant_id");--> statement-breakpoint
CREATE INDEX "product_channel_mappings_product_idx" ON "product_channel_mappings" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_channel_mappings_tenant_channel_product_uq" ON "product_channel_mappings" USING btree ("tenant_id","channel","product_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_units_code_uq" ON "ref_units" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_tenant_sku_uq" ON "product_variants" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku_uq" ON "products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_slug_uq" ON "products" USING btree ("tenant_id","slug");