/**
 * Bootstrap super-admin user and system roles/permissions.
 *
 * Reads (REQUIRED):
 *   - DATABASE_URL
 *   - BOOTSTRAP_SUPER_ADMIN_EMAIL
 *   - BOOTSTRAP_SUPER_ADMIN_PASSWORD
 * Reads (OPTIONAL):
 *   - BOOTSTRAP_SUPER_ADMIN_NAME (default: "Getouch Admin")
 *
 * Idempotent. Never logs the password.
 *
 *   pnpm db:bootstrap:admin
 */

import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";

async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return bcrypt.hash(plain, 12);
}

for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (existsSync(p)) dotenv.config({ path: p, override: false });
}

type DB = ReturnType<typeof drizzle<typeof schema>>;

const SYSTEM_ROLES: Array<{
  code: string;
  name: string;
  description: string;
}> = [
  {
    code: "SYSTEM_SUPER_ADMIN",
    name: "System Super Admin",
    description: "Full access to every system module and every tenant.",
  },
  {
    code: "SYSTEM_ADMIN",
    name: "System Admin",
    description: "Operate the platform, but cannot grant SYSTEM_SUPER_ADMIN.",
  },
  {
    code: "SYSTEM_SUPPORT",
    name: "System Support",
    description: "Read-only access to tenants for support purposes.",
  },
  {
    code: "SYSTEM_BILLING",
    name: "System Billing",
    description: "Manage plans, subscriptions, invoices.",
  },
];

const SYSTEM_PERMISSIONS: Array<{
  code: string;
  module: string;
  action: string;
  description: string;
}> = [
  // Admin console gate
  { code: "system.admin.access", module: "system", action: "access", description: "Access /admin." },
  // Tenants
  { code: "system.tenants.read", module: "system.tenants", action: "read", description: "View any tenant." },
  { code: "system.tenants.write", module: "system.tenants", action: "write", description: "Create/update/suspend tenants." },
  { code: "system.tenants.impersonate", module: "system.tenants", action: "impersonate", description: "Impersonate a tenant member." },
  // Users
  { code: "system.users.read", module: "system.users", action: "read", description: "View global users." },
  { code: "system.users.write", module: "system.users", action: "write", description: "Update global users." },
  { code: "system.users.assign_role", module: "system.users", action: "assign_role", description: "Assign system roles." },
  // WhatsApp
  { code: "system.whatsapp.read", module: "system.whatsapp", action: "read", description: "View WhatsApp sessions across tenants." },
  { code: "system.whatsapp.write", module: "system.whatsapp", action: "write", description: "Reset/disconnect any WhatsApp session." },
  // Jobs
  { code: "system.jobs.read", module: "system.jobs", action: "read", description: "View global queues/jobs." },
  { code: "system.jobs.write", module: "system.jobs", action: "write", description: "Retry/cancel jobs." },
  // AI providers
  { code: "system.ai.read", module: "system.ai", action: "read", description: "View AI providers." },
  { code: "system.ai.write", module: "system.ai", action: "write", description: "Configure shared AI providers." },
  // Billing
  { code: "system.billing.read", module: "system.billing", action: "read", description: "View plans/invoices." },
  { code: "system.billing.write", module: "system.billing", action: "write", description: "Manage plans/invoices." },
  // Audit
  { code: "system.audit.read", module: "system.audit", action: "read", description: "Read system audit log." },
  // Health
  { code: "system.health.read", module: "system.health", action: "read", description: "View system health metrics." },
  // Feature flags
  { code: "system.flags.read", module: "system.flags", action: "read", description: "Read feature flags." },
  { code: "system.flags.write", module: "system.flags", action: "write", description: "Toggle feature flags." },
];

async function upsertRole(
  db: DB,
  spec: (typeof SYSTEM_ROLES)[number],
): Promise<string> {
  const existing = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(
      and(
        eq(schema.roles.code, spec.code),
        eq(schema.roles.scopeType, "system"),
        isNull(schema.roles.tenantId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(schema.roles)
      .set({ name: spec.name, description: spec.description, isSystemRole: true, updatedAt: new Date() })
      .where(eq(schema.roles.id, existing[0].id));
    return existing[0].id;
  }
  const inserted = await db
    .insert(schema.roles)
    .values({
      tenantId: null,
      code: spec.code,
      name: spec.name,
      description: spec.description,
      scopeType: "system",
      isSystemRole: true,
    })
    .returning({ id: schema.roles.id });
  return inserted[0].id;
}

async function upsertPermission(
  db: DB,
  spec: (typeof SYSTEM_PERMISSIONS)[number],
): Promise<string> {
  const existing = await db
    .select({ id: schema.permissions.id })
    .from(schema.permissions)
    .where(eq(schema.permissions.code, spec.code))
    .limit(1);
  if (existing[0]) {
    await db
      .update(schema.permissions)
      .set({ module: spec.module, action: spec.action, description: spec.description })
      .where(eq(schema.permissions.id, existing[0].id));
    return existing[0].id;
  }
  const inserted = await db
    .insert(schema.permissions)
    .values({ code: spec.code, module: spec.module, action: spec.action, description: spec.description })
    .returning({ id: schema.permissions.id });
  return inserted[0].id;
}

async function ensureRolePermission(db: DB, roleId: string, permissionId: string) {
  await db
    .insert(schema.rolePermissions)
    .values({ roleId, permissionId })
    .onConflictDoNothing();
}

async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_SUPER_ADMIN_NAME?.trim() || "Getouch Admin";

  if (!url) throw new Error("DATABASE_URL is required.");
  if (!email) throw new Error("BOOTSTRAP_SUPER_ADMIN_EMAIL is required.");
  if (!password || password.length < 8) {
    throw new Error("BOOTSTRAP_SUPER_ADMIN_PASSWORD is required (min 8 chars).");
  }

  console.log(`→ Bootstrapping super-admin (${email}) on DB at ${url.replace(/:[^:@]+@/, ":***@")}`);

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // 1. permissions
  const permIdByCode = new Map<string, string>();
  for (const p of SYSTEM_PERMISSIONS) {
    const id = await upsertPermission(db, p);
    permIdByCode.set(p.code, id);
  }
  console.log(`✓ ${SYSTEM_PERMISSIONS.length} system permissions upserted`);

  // 2. roles
  const roleIdByCode = new Map<string, string>();
  for (const r of SYSTEM_ROLES) {
    const id = await upsertRole(db, r);
    roleIdByCode.set(r.code, id);
  }
  console.log(`✓ ${SYSTEM_ROLES.length} system roles upserted`);

  // 3. SUPER_ADMIN gets every system permission
  const superRoleId = roleIdByCode.get("SYSTEM_SUPER_ADMIN")!;
  for (const code of permIdByCode.keys()) {
    await ensureRolePermission(db, superRoleId, permIdByCode.get(code)!);
  }
  // SYSTEM_ADMIN gets everything except SUPER_ADMIN-only ops; for MVP same as super.
  const adminRoleId = roleIdByCode.get("SYSTEM_ADMIN")!;
  for (const code of [
    "system.admin.access",
    "system.tenants.read",
    "system.tenants.write",
    "system.users.read",
    "system.users.write",
    "system.whatsapp.read",
    "system.whatsapp.write",
    "system.jobs.read",
    "system.jobs.write",
    "system.ai.read",
    "system.ai.write",
    "system.audit.read",
    "system.health.read",
    "system.flags.read",
  ]) {
    const pid = permIdByCode.get(code);
    if (pid) await ensureRolePermission(db, adminRoleId, pid);
  }
  // SYSTEM_SUPPORT: read-only
  const supportRoleId = roleIdByCode.get("SYSTEM_SUPPORT")!;
  for (const code of [
    "system.admin.access",
    "system.tenants.read",
    "system.users.read",
    "system.whatsapp.read",
    "system.jobs.read",
    "system.audit.read",
    "system.health.read",
  ]) {
    const pid = permIdByCode.get(code);
    if (pid) await ensureRolePermission(db, supportRoleId, pid);
  }
  // SYSTEM_BILLING
  const billingRoleId = roleIdByCode.get("SYSTEM_BILLING")!;
  for (const code of ["system.admin.access", "system.billing.read", "system.billing.write"]) {
    const pid = permIdByCode.get(code);
    if (pid) await ensureRolePermission(db, billingRoleId, pid);
  }
  console.log(`✓ Role-permission mappings upserted`);

  // 4. user
  const passwordHash = await hashPassword(password);
  const existing = (
    await db
      .select()
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = ${email}`)
      .limit(1)
  )[0];

  let userId: string;
  if (existing) {
    await db
      .update(schema.users)
      .set({
        name,
        passwordHash,
        emailVerified: true,
        status: "active",
        // legacy column kept harmless
        isSystemAdmin: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existing.id));
    userId = existing.id;
    console.log(`✓ Updated existing user ${email}`);
  } else {
    const inserted = await db
      .insert(schema.users)
      .values({
        email,
        name,
        passwordHash,
        emailVerified: true,
        status: "active",
        phoneVerified: false,
        isSystemAdmin: true,
      })
      .returning({ id: schema.users.id });
    userId = inserted[0].id;
    console.log(`✓ Created user ${email}`);
  }

  // 5. assign SYSTEM_SUPER_ADMIN role
  const link = (
    await db
      .select({ id: schema.userSystemRoles.id })
      .from(schema.userSystemRoles)
      .where(
        and(
          eq(schema.userSystemRoles.userId, userId),
          eq(schema.userSystemRoles.roleId, superRoleId),
        ),
      )
      .limit(1)
  )[0];

  if (link) {
    await db
      .update(schema.userSystemRoles)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(schema.userSystemRoles.id, link.id));
  } else {
    await db.insert(schema.userSystemRoles).values({
      userId,
      roleId: superRoleId,
      status: "active",
    });
  }
  console.log(`✓ Granted SYSTEM_SUPER_ADMIN to ${email}`);

  await pool.end();
  console.log("✅ Bootstrap complete.");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
