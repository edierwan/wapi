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
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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
