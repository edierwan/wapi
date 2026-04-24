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
    emailVerified: boolean("email_verified").notNull().default(false),
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
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    productType: productType("product_type").notNull().default("physical"),
    status: itemStatus("status").notNull().default("active"),
    brand: text("brand"),
    unitOfMeasure: text("unit_of_measure").notNull().default("pc"),
    defaultPrice: numeric("default_price", { precision: 18, scale: 4 }),
    currency: text("currency").notNull().default("MYR"),
    costPrice: numeric("cost_price", { precision: 18, scale: 4 }),
    taxCode: text("tax_code"),
    trackInventory: boolean("track_inventory").notNull().default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("products_tenant_idx").on(t.tenantId),
    tenantCodeUq: uniqueIndex("products_tenant_code_uq").on(t.tenantId, t.productCode),
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
    status: itemStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProduct: index("product_variants_product_idx").on(t.productId),
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
    mediaType: text("media_type").notNull().default("image"),
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
    isSystemRole: boolean("is_system_role").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byTenant: index("roles_tenant_idx").on(t.tenantId),
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
export type ServiceType = (typeof serviceType.enumValues)[number];
