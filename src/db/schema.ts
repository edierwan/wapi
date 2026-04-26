/**
 * WAPI database schema (Drizzle ORM / PostgreSQL).
 *
 * Design goals:
 *  - Multi-tenant by default: every business-domain table carries `tenant_id`.
 *  - Tenant routing is path-based today (`/t/{slug}`) and subdomain-ready later.
 *  - Auth tables use a Better-Auth-compatible shape so we can swap in Better Auth
 *    in Phase 2 without rewriting data.
 *  - WhatsApp (Baileys) and AI (Dify/Ollama) are modeled per-tenant from day one.
 */

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";

/* ────────────────────────────────────────────────────────────── */
/*  Enums                                                         */
/* ────────────────────────────────────────────────────────────── */

export const tenantStatus = pgEnum("tenant_status", [
  "active",
  "trial",
  "suspended",
  "disabled",
]);

export const memberRole = pgEnum("member_role", [
  "owner",
  "admin",
  "agent",
  "viewer",
]);

export const memberStatus = pgEnum("member_status", [
  "active",
  "invited",
  "disabled",
]);

export const waSessionStatus = pgEnum("wa_session_status", [
  "pending",
  "connecting",
  "connected",
  "disconnected",
  "expired",
  "error",
]);

export const aiProviderKind = pgEnum("ai_provider_kind", [
  "dify",
  "ollama",
  "openai_compatible",
]);

/* ────────────────────────────────────────────────────────────── */
/*  Auth (Better-Auth compatible minimum)                          */
/* ────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    image: text("image"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    status: text("status").notNull().default("active"),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    isSystemAdmin: boolean("is_system_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUq: uniqueIndex("users_email_uq").on(sql`lower(${t.email})`),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUq: uniqueIndex("sessions_token_uq").on(t.token),
    byUser: index("sessions_user_idx").on(t.userId),
  }),
);

/* ────────────────────────────────────────────────────────────── */
/*  Tenants + membership                                          */
/* ────────────────────────────────────────────────────────────── */

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatus("status").notNull().default("trial"),
    plan: text("plan"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUq: uniqueIndex("tenants_slug_uq").on(t.slug),
  }),
);

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("viewer"),
    status: memberStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUserUq: uniqueIndex("tenant_members_tenant_user_uq").on(
      t.tenantId,
      t.userId,
    ),
    byUser: index("tenant_members_user_idx").on(t.userId),
  }),
);

export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    businessName: text("business_name"),
    businessType: text("business_type"),
    defaultLanguage: text("default_language"),
    tone: text("tone"),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUq: uniqueIndex("tenant_settings_tenant_uq").on(t.tenantId),
  }),
);

/* ────────────────────────────────────────────────────────────── */
/*  WhatsApp / Baileys (scaffold — runtime added in Phase 2+)     */
/* ────────────────────────────────────────────────────────────── */

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    phoneNumber: text("phone_number"),
    gatewayUrl: text("gateway_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("connected_accounts_tenant_idx").on(t.tenantId),
  }),
);

export const whatsappSessions = pgTable(
  "whatsapp_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    status: waSessionStatus("status").notNull().default("pending"),
    lastQrAt: timestamp("last_qr_at", { withTimezone: true }),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    authPayload: jsonb("auth_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("whatsapp_sessions_tenant_idx").on(t.tenantId),
    byAccount: uniqueIndex("whatsapp_sessions_account_uq").on(t.accountId),
  }),
);

/* ────────────────────────────────────────────────────────────── */
/*  AI (Dify / Ollama / OpenAI-compatible) — per tenant           */
/* ────────────────────────────────────────────────────────────── */

export const aiProviderConfigs = pgTable(
  "ai_provider_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    kind: aiProviderKind("kind").notNull(),
    baseUrl: text("base_url"),
    apiKeyRef: text("api_key_ref"),
    config: jsonb("config"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("ai_provider_configs_tenant_idx").on(t.tenantId),
  }),
);

export const tenantAiSettings = pgTable(
  "tenant_ai_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    defaultProviderId: uuid("default_provider_id").references(
      () => aiProviderConfigs.id,
      { onDelete: "set null" },
    ),
    tone: text("tone"),
    language: text("language"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUq: uniqueIndex("tenant_ai_settings_tenant_uq").on(t.tenantId),
  }),
);

/* ────────────────────────────────────────────────────────────── */
/*  Relations                                                     */
/* ────────────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMembers),
  sessions: many(sessions),
}));

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  members: many(tenantMembers),
  settings: one(tenantSettings, {
    fields: [tenants.id],
    references: [tenantSettings.tenantId],
  }),
  accounts: many(connectedAccounts),
  aiSettings: one(tenantAiSettings, {
    fields: [tenants.id],
    references: [tenantAiSettings.tenantId],
  }),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
}));

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                         */
/* ────────────────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type TenantStatus = (typeof tenantStatus.enumValues)[number];
export type MemberRole = (typeof memberRole.enumValues)[number];
export type MemberStatus = (typeof memberStatus.enumValues)[number];

/* ════════════════════════════════════════════════════════════════ */
/*  PHASE 3                                                         */
/*  Business profile, master data (products & services), security,  */
/*  audit, API keys, webhooks, object storage.                      */
/*  See /docs/architecture/master-data.md and security.md           */
/* ════════════════════════════════════════════════════════════════ */

/* ── Enums (Phase 3) ───────────────────────────────────────────── */

export const businessNature = pgEnum("business_nature", [
  "product",
  "service",
  "hybrid",
  "booking",
  "lead_gen",
  "support",
  "other",
]);

export const productType = pgEnum("product_type", [
  "physical",
  "digital",
  "bundle",
  "consumable",
  "other",
]);

export const productStatus = pgEnum("product_status", [
  "draft",
  "active",
  "inactive",
  "archived",
]);

export const productMediaType = pgEnum("product_media_type", [
  "image",
  "video",
  "document",
]);

export const productChannel = pgEnum("product_channel", [
  "shopee",
  "lazada",
  "tiktok_shop",
  "shopify",
  "woocommerce",
  "facebook_shop",
  "instagram_shop",
  "custom",
]);

export const productChannelSyncStatus = pgEnum("product_channel_sync_status", [
  "not_synced",
  "synced",
  "error",
  "disabled",
]);

export const itemStatus = pgEnum("item_status", [
  "active",
  "inactive",
  "archived",
]);

export const serviceType = pgEnum("service_type", [
  "consultation",
  "appointment",
  "package",
  "subscription",
  "repair",
  "delivery",
  "other",
]);

export const apiKeyStatus = pgEnum("api_key_status", ["active", "revoked"]);

export const webhookStatus = pgEnum("webhook_status", ["active", "disabled"]);

export const storageObjectStatus = pgEnum("storage_object_status", [
  "uploading",
  "ready",
  "quarantined",
  "deleted",
]);

export const storageObjectKind = pgEnum("storage_object_kind", [
  "product_image",
  "service_image",
  "campaign_attachment",
  "chat_media_inbound",
  "chat_media_outbound",
  "export",
  "other",
]);

/* ── Tenant business profile ───────────────────────────────────── */

export const tenantBusinessProfiles = pgTable(
  "tenant_business_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    businessNature: businessNature("business_nature").notNull().default("other"),
    industry: text("industry"),
    businessRegistrationNo: text("business_registration_no"),
    taxId: text("tax_id"),
    defaultCurrency: text("default_currency").notNull().default("MYR"),
    defaultLanguage: text("default_language").notNull().default("en"),
    timezone: text("timezone").notNull().default("Asia/Kuala_Lumpur"),
    primaryCountry: text("primary_country").notNull().default("MY"),
    primaryPhone: text("primary_phone"),
    supportEmail: text("support_email"),
    websiteUrl: text("website_url"),
    brandVoice: text("brand_voice"),
    // Phase 5 master-data references (nullable; enforced by app layer).
    industryId: uuid("industry_id"),
    countryId: uuid("country_id"),
    currencyId: uuid("currency_id"),
    languageId: uuid("language_id"),
    timezoneId: uuid("timezone_id"),
    businessNatureId: uuid("business_nature_id"),
    brandVoiceId: uuid("brand_voice_id"),
    brandVoiceCustom: text("brand_voice_custom"),
    prohibitedWords: jsonb("prohibited_words"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantUq: uniqueIndex("tenant_business_profiles_tenant_uq").on(t.tenantId),
  }),
);

/* ── Product master ────────────────────────────────────────────── */

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: itemStatus("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("product_categories_tenant_idx").on(t.tenantId),
    tenantCodeUq: uniqueIndex("product_categories_tenant_code_uq").on(t.tenantId, t.code),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    productCode: text("product_code").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    name: text("name").notNull(),
    slug: text("slug"),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    productType: productType("product_type").notNull().default("physical"),
    status: productStatus("status").notNull().default("draft"),
    brand: text("brand"),
    unitOfMeasure: text("unit_of_measure").notNull().default("pc"),
    defaultPrice: numeric("default_price", { precision: 18, scale: 4 }),
    compareAtPrice: numeric("compare_at_price", { precision: 18, scale: 4 }),
    currency: text("currency").notNull().default("MYR"),
    costPrice: numeric("cost_price", { precision: 18, scale: 4 }),
    taxCode: text("tax_code"),
    trackInventory: boolean("track_inventory").notNull().default(false),
    aiSellingNotes: text("ai_selling_notes"),
    aiFaqNotes: text("ai_faq_notes"),
    tags: jsonb("tags"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("products_tenant_idx").on(t.tenantId),
    byCategory: index("products_category_idx").on(t.categoryId),
    tenantCodeUq: uniqueIndex("products_tenant_code_uq").on(t.tenantId, t.productCode),
    tenantSkuUq: uniqueIndex("products_tenant_sku_uq").on(t.tenantId, t.sku),
    tenantSlugUq: uniqueIndex("products_tenant_slug_uq").on(t.tenantId, t.slug),
  }),
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantCode: text("variant_code").notNull(),
    name: text("name").notNull(),
    attributes: jsonb("attributes"),
    sku: text("sku"),
    barcode: text("barcode"),
    defaultPrice: numeric("default_price", { precision: 18, scale: 4 }),
    status: productStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProduct: index("product_variants_product_idx").on(t.productId),
    tenantSkuUq: uniqueIndex("product_variants_tenant_sku_uq").on(t.tenantId, t.sku),
    productVariantUq: uniqueIndex("product_variants_product_code_uq").on(
      t.productId,
      t.variantCode,
    ),
  }),
);

export const priceLists = pgTable(
  "price_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("MYR"),
    customerSegment: text("customer_segment"),
    status: itemStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCodeUq: uniqueIndex("price_lists_tenant_code_uq").on(t.tenantId, t.code),
  }),
);

export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    priceListId: uuid("price_list_id").references(() => priceLists.id, {
      onDelete: "set null",
    }),
    currency: text("currency").notNull().default("MYR"),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    compareAtAmount: numeric("compare_at_amount", { precision: 18, scale: 4 }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    status: itemStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProduct: index("product_prices_product_idx").on(t.productId),
  }),
);

export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    mediaType: productMediaType("media_type").notNull().default("image"),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProduct: index("product_media_product_idx").on(t.productId),
  }),
);

export const productBundles = pgTable(
  "product_bundles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentProductId: uuid("parent_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    childProductId: uuid("child_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    childVariantId: uuid("child_variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  },
  (t) => ({
    byParent: index("product_bundles_parent_idx").on(t.parentProductId),
    bundleItemUq: uniqueIndex("product_bundles_parent_child_uq").on(
      t.parentProductId,
      t.childProductId,
      t.childVariantId,
    ),
  }),
);

export const productChannelMappings = pgTable(
  "product_channel_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    channel: productChannel("channel").notNull(),
    externalProductId: text("external_product_id"),
    externalVariantId: text("external_variant_id"),
    externalSku: text("external_sku"),
    channelTitle: text("channel_title"),
    channelStatus: text("channel_status"),
    channelUrl: text("channel_url"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncStatus: productChannelSyncStatus("sync_status").notNull().default("not_synced"),
    syncError: text("sync_error"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProduct: index("product_channel_mappings_product_idx").on(t.productId),
    tenantChannelProductUq: uniqueIndex("product_channel_mappings_tenant_channel_product_uq").on(
      t.tenantId,
      t.channel,
      t.productId,
      t.variantId,
    ),
  }),
);

/* ── Service master ────────────────────────────────────────────── */

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: itemStatus("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCodeUq: uniqueIndex("service_categories_tenant_code_uq").on(t.tenantId, t.code),
  }),
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => serviceCategories.id, {
      onDelete: "set null",
    }),
    serviceCode: text("service_code").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    serviceType: serviceType("service_type").notNull().default("consultation"),
    durationMinutes: integer("duration_minutes"),
    defaultPrice: numeric("default_price", { precision: 18, scale: 4 }),
    currency: text("currency").notNull().default("MYR"),
    taxCode: text("tax_code"),
    requiresBooking: boolean("requires_booking").notNull().default(false),
    requiresDeposit: boolean("requires_deposit").notNull().default(false),
    status: itemStatus("status").notNull().default("active"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("services_tenant_idx").on(t.tenantId),
    tenantCodeUq: uniqueIndex("services_tenant_code_uq").on(t.tenantId, t.serviceCode),
  }),
);

export const servicePackages = pgTable(
  "service_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    packageCode: text("package_code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    defaultPrice: numeric("default_price", { precision: 18, scale: 4 }),
    currency: text("currency").notNull().default("MYR"),
    validityDays: integer("validity_days"),
    status: itemStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantCodeUq: uniqueIndex("service_packages_tenant_code_uq").on(t.tenantId, t.packageCode),
  }),
);

export const servicePackageItems = pgTable(
  "service_package_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    byPackage: index("service_package_items_package_idx").on(t.packageId),
  }),
);

export const serviceAvailability = pgTable(
  "service_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id"),
    dayOfWeek: smallint("day_of_week").notNull(), // 0=Sun..6=Sat
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    capacity: integer("capacity"),
    status: itemStatus("status").notNull().default("active"),
  },
  (t) => ({
    byService: index("service_availability_service_idx").on(t.serviceId),
  }),
);

/* ── Roles & permissions ───────────────────────────────────────── */

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null tenantId = system-supplied role template
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    scopeType: text("scope_type").notNull().default("tenant"), // 'system' | 'tenant'
    isSystemRole: boolean("is_system_role").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("roles_tenant_idx").on(t.tenantId),
    byScope: index("roles_scope_idx").on(t.scopeType),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    description: text("description"),
  },
  (t) => ({
    codeUq: uniqueIndex("permissions_code_uq").on(t.code),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => ({
    rolePermUq: uniqueIndex("role_permissions_role_perm_uq").on(t.roleId, t.permissionId),
  }),
);

/* ── Audit log ─────────────────────────────────────────────────── */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    objectType: text("object_type"),
    objectId: uuid("object_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("audit_logs_tenant_idx").on(t.tenantId),
    byActor: index("audit_logs_actor_idx").on(t.actorUserId),
    byCreatedAt: index("audit_logs_created_idx").on(t.createdAt),
  }),
);

/* ── API keys ──────────────────────────────────────────────────── */

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    scopes: jsonb("scopes"),
    status: apiKeyStatus("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("api_keys_tenant_idx").on(t.tenantId),
    prefixUq: uniqueIndex("api_keys_prefix_uq").on(t.prefix),
  }),
);

/* ── Webhook endpoints ─────────────────────────────────────────── */

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secretRef: text("secret_ref").notNull(),
    events: jsonb("events").notNull(),
    status: webhookStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("webhook_endpoints_tenant_idx").on(t.tenantId),
  }),
);

/* ── Storage objects (MinIO / S3) ──────────────────────────────── */

export const storageObjects = pgTable(
  "storage_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: storageObjectKind("kind").notNull(),
    ownerType: text("owner_type"),
    ownerId: uuid("owner_id"),
    bucket: text("bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: storageObjectStatus("status").notNull().default("uploading"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenantKind: index("storage_objects_tenant_kind_idx").on(t.tenantId, t.kind),
    byOwner: index("storage_objects_owner_idx").on(t.ownerType, t.ownerId),
    bucketKeyUq: uniqueIndex("storage_objects_bucket_key_uq").on(t.bucket, t.storageKey),
  }),
);

/* ── Phase 3 types ─────────────────────────────────────────────── */

export type TenantBusinessProfile = typeof tenantBusinessProfiles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Service = typeof services.$inferSelect;
export type BusinessNature = (typeof businessNature.enumValues)[number];
export type ItemStatus = (typeof itemStatus.enumValues)[number];
export type ProductType = (typeof productType.enumValues)[number];
export type ProductStatus = (typeof productStatus.enumValues)[number];
export type ServiceType = (typeof serviceType.enumValues)[number];

/* ════════════════════════════════════════════════════════════════ */
/*  PHASE 4                                                         */
/*  Identity: password login, phone OTP, system roles.              */
/*  See /docs/architecture/auth-v2.md                               */
/* ════════════════════════════════════════════════════════════════ */

export const userSystemRoles = pgTable(
  "user_system_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"), // active | disabled
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userRoleUq: uniqueIndex("user_system_roles_user_role_uq").on(t.userId, t.roleId),
    byUser: index("user_system_roles_user_idx").on(t.userId),
  }),
);

export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    pendingRegistrationId: uuid("pending_registration_id"),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: text("purpose").notNull().default("register"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    provider: text("provider").notNull().default("whatsapp_gateway"),
    providerMessageId: text("provider_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byPhone: index("phone_verifications_phone_idx").on(t.phone),
    byPending: index("phone_verifications_pending_idx").on(t.pendingRegistrationId),
  }),
);

export const pendingRegistrations = pgTable(
  "pending_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessName: text("business_name").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    businessNature: text("business_nature"),
    numberOfAgents: integer("number_of_agents"),
    tenantSlugCandidate: text("tenant_slug_candidate").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byEmail: index("pending_registrations_email_idx").on(sql`lower(${t.email})`),
    byPhone: index("pending_registrations_phone_idx").on(t.phone),
  }),
);

export type UserSystemRole = typeof userSystemRoles.$inferSelect;
export type PhoneVerification = typeof phoneVerifications.$inferSelect;
export type PendingRegistration = typeof pendingRegistrations.$inferSelect;

/* ────────────────────────────────────────────────────────────── */
/*  PHASE 5 — Master / reference data                              */
/* ────────────────────────────────────────────────────────────── */

export const refCountries = pgTable(
  "ref_countries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iso2Code: text("iso2_code").notNull(),
    iso3Code: text("iso3_code"),
    name: text("name").notNull(),
    phoneCountryCode: text("phone_country_code"),
    defaultCurrencyCode: text("default_currency_code"),
    defaultLanguageCode: text("default_language_code"),
    defaultTimezone: text("default_timezone"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    iso2Uq: uniqueIndex("ref_countries_iso2_uq").on(t.iso2Code),
    byStatus: index("ref_countries_status_idx").on(t.status),
  }),
);

export const refCurrencies = pgTable(
  "ref_currencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol"),
    decimalPlaces: integer("decimal_places").notNull().default(2),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_currencies_code_uq").on(t.code) }),
);

export const refUnits = pgTable(
  "ref_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_units_code_uq").on(t.code) }),
);

export const refLanguages = pgTable(
  "ref_languages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    nativeName: text("native_name"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_languages_code_uq").on(t.code) }),
);

export const refTimezones = pgTable(
  "ref_timezones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    label: text("label").notNull(),
    utcOffset: text("utc_offset"),
    countryId: uuid("country_id").references(() => refCountries.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ nameUq: uniqueIndex("ref_timezones_name_uq").on(t.name) }),
);

export const refIndustries = pgTable(
  "ref_industries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_industries_code_uq").on(t.code) }),
);

export const refBusinessNatures = pgTable(
  "ref_business_natures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_business_natures_code_uq").on(t.code) }),
);

export const refBrandVoices = pgTable(
  "ref_brand_voices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    promptInstruction: text("prompt_instruction"),
    status: text("status").notNull().default("active"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ codeUq: uniqueIndex("ref_brand_voices_code_uq").on(t.code) }),
);

/* ────────────────────────────────────────────────────────────── */
/*  PHASE 5 — Contacts + Business Memory + AI Readiness            */
/* ────────────────────────────────────────────────────────────── */

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    fullName: text("full_name"),
    email: text("email"),
    languageId: uuid("language_id").references(() => refLanguages.id, {
      onDelete: "set null",
    }),
    countryId: uuid("country_id").references(() => refCountries.id, {
      onDelete: "set null",
    }),
    source: text("source"), // import | wa_inbound | manual | api | landing
    status: text("status").notNull().default("active"), // active | unsubscribed | blocked | bounced
    optInAt: timestamp("opt_in_at", { withTimezone: true }),
    optOutAt: timestamp("opt_out_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    leadScore: integer("lead_score").notNull().default(0),
    leadStatus: text("lead_status").notNull().default("none"), // none | new | warm | hot | customer
    notes: text("notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantPhoneUq: uniqueIndex("contacts_tenant_phone_uq").on(
      t.tenantId,
      t.phoneE164,
    ),
    byTenant: index("contacts_tenant_idx").on(t.tenantId),
    byLeadStatus: index("contacts_lead_status_idx").on(
      t.tenantId,
      t.leadStatus,
    ),
  }),
);

export const contactTags = pgTable(
  "contact_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantNameUq: uniqueIndex("contact_tags_tenant_name_uq").on(
      t.tenantId,
      t.name,
    ),
  }),
);

export const contactTagAssignments = pgTable(
  "contact_tag_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => contactTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUq: uniqueIndex("contact_tag_assignments_pair_uq").on(
      t.contactId,
      t.tagId,
    ),
  }),
);

export const contactConsents = pgTable(
  "contact_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // whatsapp | email | sms
    consentType: text("consent_type").notNull(), // marketing | transactional | ai_followup
    granted: boolean("granted").notNull(),
    source: text("source"), // form | inbound_message | import | manual
    evidenceText: text("evidence_text"),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byContact: index("contact_consents_contact_idx").on(t.contactId) }),
);

export const businessMemoryItems = pgTable(
  "business_memory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // fact | faq | policy | brand | offer | warning
    title: text("title").notNull(),
    body: text("body").notNull(),
    source: text("source").notNull().default("manual"), // manual | import | onboarding | inferred
    weight: integer("weight").notNull().default(1),
    status: text("status").notNull().default("active"),
    embedding: jsonb("embedding"), // store vector json until pgvector enabled
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("business_memory_items_tenant_idx").on(t.tenantId),
    byKind: index("business_memory_items_kind_idx").on(t.tenantId, t.kind),
  }),
);

export const aiReadinessScores = pgTable(
  "ai_readiness_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull().default(0), // 0-100
    bandLabel: text("band_label").notNull().default("not_ready"), // not_ready | basic | good | excellent
    components: jsonb("components"), // { businessProfile: 80, products: 60, ... }
    recommendations: jsonb("recommendations"), // [{code, title, weight}]
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byTenant: index("ai_readiness_scores_tenant_idx").on(t.tenantId) }),
);

/* ────────────────────────────────────────────────────────────── */
/*  PHASE 6 — WhatsApp gateway: outbound queue + inbound events    */
/* ────────────────────────────────────────────────────────────── */

export const messageQueue = pgTable(
  "message_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => connectedAccounts.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    campaignId: uuid("campaign_id"),
    toPhone: text("to_phone").notNull(),
    purpose: text("purpose").notNull().default("campaign"), // campaign | reply | otp | followup | broadcast | system
    status: text("status").notNull().default("queued"), // queued | sending | sent | delivered | read | failed | cancelled
    bodyText: text("body_text"),
    payload: jsonb("payload"), // attachments / template
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    providerMessageId: text("provider_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("message_queue_tenant_idx").on(t.tenantId),
    byStatus: index("message_queue_status_idx").on(t.status, t.scheduledAt),
    byCampaign: index("message_queue_campaign_idx").on(t.campaignId),
  }),
);

export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => connectedAccounts.id, {
      onDelete: "set null",
    }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    fromPhone: text("from_phone").notNull(),
    bodyText: text("body_text"),
    payload: jsonb("payload"),
    providerMessageId: text("provider_message_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    intent: text("intent"), // ai-classified: question | buying | objection | greeting | optout | other
    sentiment: text("sentiment"), // positive | neutral | negative
    handledByAi: boolean("handled_by_ai").notNull().default(false),
    aiReplyMessageId: uuid("ai_reply_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("inbound_messages_tenant_idx").on(t.tenantId),
    byContact: index("inbound_messages_contact_idx").on(t.contactId),
    byIntent: index("inbound_messages_intent_idx").on(t.tenantId, t.intent),
  }),
);

/* ────────────────────────────────────────────────────────────── */
/*  PHASE 7 — Campaigns + Variations + Safety reviews              */
/* ────────────────────────────────────────────────────────────── */

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    objective: text("objective"), // promo | event | re_engage | survey | followup | other
    status: text("status").notNull().default("draft"),
    // draft | safety_review | scheduled | sending | paused | completed | cancelled | failed
    sendMode: text("send_mode").notNull().default("standard"),
    // standard | reply_first
    audienceFilter: jsonb("audience_filter"), // {tags: [], leadStatus: [], languages: []}
    estimatedRecipients: integer("estimated_recipients"),
    excludedRecipients: integer("excluded_recipients"),
    finalRecipients: integer("final_recipients"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("campaigns_tenant_idx").on(t.tenantId),
    byStatus: index("campaigns_status_idx").on(t.tenantId, t.status),
  }),
);

export const campaignVariants = pgTable(
  "campaign_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("A"),
    bodyText: text("body_text").notNull(),
    languageCode: text("language_code"),
    weight: integer("weight").notNull().default(1),
    isAiGenerated: boolean("is_ai_generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byCampaign: index("campaign_variants_campaign_idx").on(t.campaignId) }),
);

export const campaignSafetyReviews = pgTable(
  "campaign_safety_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    overallStatus: text("overall_status").notNull().default("pending"),
    // pending | good | needs_review | high_risk
    checks: jsonb("checks"), // [{code, status, message, autoFixable}]
    autoFixesApplied: jsonb("auto_fixes_applied"),
    summaryText: text("summary_text"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCampaign: index("campaign_safety_reviews_campaign_idx").on(t.campaignId),
  }),
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => campaignVariants.id, {
      onDelete: "set null",
    }),
    queueId: uuid("queue_id").references(() => messageQueue.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    // pending | sent | delivered | read | failed | replied | excluded
    excludedReason: text("excluded_reason"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCampaign: index("campaign_recipients_campaign_idx").on(t.campaignId),
    pairUq: uniqueIndex("campaign_recipients_pair_uq").on(
      t.campaignId,
      t.contactId,
    ),
  }),
);

export const followupSequences = pgTable(
  "followup_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerType: text("trigger_type").notNull(), // no_reply | hot_lead | new_contact | custom
    triggerConfig: jsonb("trigger_config"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byTenant: index("followup_sequences_tenant_idx").on(t.tenantId) }),
);

export const followupSteps = pgTable(
  "followup_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => followupSequences.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    delayHours: integer("delay_hours").notNull().default(24),
    bodyText: text("body_text"),
    isAiGenerated: boolean("is_ai_generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySeq: index("followup_steps_sequence_idx").on(t.sequenceId),
    seqOrderUq: uniqueIndex("followup_steps_seq_order_uq").on(
      t.sequenceId,
      t.stepOrder,
    ),
  }),
);

/* ── Phase 5/6/7 types ─────────────────────────────────────────── */

export type RefCountry = typeof refCountries.$inferSelect;
export type RefCurrency = typeof refCurrencies.$inferSelect;
export type RefUnit = typeof refUnits.$inferSelect;
export type RefLanguage = typeof refLanguages.$inferSelect;
export type RefTimezone = typeof refTimezones.$inferSelect;
export type RefIndustry = typeof refIndustries.$inferSelect;
export type RefBusinessNature = typeof refBusinessNatures.$inferSelect;
export type RefBrandVoice = typeof refBrandVoices.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type ContactTag = typeof contactTags.$inferSelect;
export type BusinessMemoryItem = typeof businessMemoryItems.$inferSelect;
export type AiReadinessScore = typeof aiReadinessScores.$inferSelect;
export type MessageQueueRow = typeof messageQueue.$inferSelect;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignVariant = typeof campaignVariants.$inferSelect;
export type CampaignSafetyReview = typeof campaignSafetyReviews.$inferSelect;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type FollowupSequence = typeof followupSequences.$inferSelect;
export type FollowupStep = typeof followupSteps.$inferSelect;
