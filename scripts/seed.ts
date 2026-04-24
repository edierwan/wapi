/**
 * Dev/demo seed.
 *
 *   Usage:
 *     # requires DATABASE_URL exported (or a .env.local file)
 *     pnpm tsx scripts/seed.ts [email protected]
 *
 * Creates:
 *   - a user (the first CLI arg, or SEED_EMAIL env, defaults to [email protected])
 *   - a tenant "Demo Company" with slug "demo"
 *   - an owner membership linking the user to the tenant
 *   - a default tenant_settings row
 *   - a system-default AI provider config (kind=dify) if DIFY_DEFAULT_BASE_URL is set
 *
 * Idempotent: running it twice will not duplicate rows.
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: DATABASE_URL is required.");
    process.exit(1);
  }

  const email = (process.argv[2] ?? process.env.SEED_EMAIL ?? "[email protected]")
    .trim()
    .toLowerCase();

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  console.log(`→ Seeding DB with user=${email}`);

  // 1) user
  let user = (
    await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  )[0];
  if (!user) {
    user = (
      await db
        .insert(schema.users)
        .values({ email, name: "Demo Admin", isSystemAdmin: true })
        .returning()
    )[0]!;
    console.log(`  ✓ created user ${user.id}`);
  } else {
    console.log(`  • user exists ${user.id}`);
  }

  // 2) tenant
  let tenant = (
    await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, "demo"))
      .limit(1)
  )[0];
  if (!tenant) {
    tenant = (
      await db
        .insert(schema.tenants)
        .values({
          name: "Demo Company",
          slug: "demo",
          status: "active",
          plan: "starter",
        })
        .returning()
    )[0]!;
    console.log(`  ✓ created tenant ${tenant.id} (demo)`);
  } else {
    console.log(`  • tenant exists ${tenant.id} (demo)`);
  }

  // 3) membership
  const membership = (
    await db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenant.id),
          eq(schema.tenantMembers.userId, user.id),
        ),
      )
      .limit(1)
  )[0];
  if (!membership) {
    await db.insert(schema.tenantMembers).values({
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });
    console.log("  ✓ created owner membership");
  } else {
    console.log("  • membership exists");
  }

  // 4) settings
  const settings = (
    await db
      .select()
      .from(schema.tenantSettings)
      .where(eq(schema.tenantSettings.tenantId, tenant.id))
      .limit(1)
  )[0];
  if (!settings) {
    await db.insert(schema.tenantSettings).values({
      tenantId: tenant.id,
      businessName: "Demo Company",
      businessType: "Retail",
      defaultLanguage: "en",
      tone: "friendly",
      timezone: "Asia/Kuala_Lumpur",
    });
    console.log("  ✓ created tenant_settings");
  } else {
    console.log("  • tenant_settings exists");
  }

  // 5) optional: system-default AI config
  const difyBase = process.env.DIFY_DEFAULT_BASE_URL;
  if (difyBase) {
    const existing = (
      await db
        .select()
        .from(schema.aiProviderConfigs)
        .where(eq(schema.aiProviderConfigs.name, "system-dify"))
        .limit(1)
    )[0];
    if (!existing) {
      await db.insert(schema.aiProviderConfigs).values({
        tenantId: null,
        name: "system-dify",
        kind: "dify",
        baseUrl: difyBase,
        apiKeyRef: "DIFY_DEFAULT_API_KEY",
        isDefault: true,
        config: {},
      });
      console.log("  ✓ created system ai_provider_configs (dify)");
    } else {
      console.log("  • system ai_provider_configs exists");
    }
  } else {
    console.log("  · skipped system ai_provider_configs (no DIFY_DEFAULT_BASE_URL)");
  }

  await pool.end();
  console.log("✔ seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
