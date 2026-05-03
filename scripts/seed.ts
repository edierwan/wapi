/**
 * Dev/demo seed.
 *
 *   Usage:
 *     # requires DATABASE_URL exported (or a .env.local file)
 *     ENABLE_DEMO_SEED=true pnpm tsx scripts/seed.ts [email protected]
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

import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";

const envFiles = [".env.local", ".env"];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

async function main() {
  const demoSeedEnabled = (process.env.ENABLE_DEMO_SEED ?? "").toLowerCase() === "true";
  if (!demoSeedEnabled) {
    console.error(
      "ERROR: Demo seed is disabled. Set ENABLE_DEMO_SEED=true or use `pnpm db:seed:demo` when you intentionally want demo data.",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "ERROR: DATABASE_URL is required. Export it in your shell or add it to .env.local in the repo root.",
    );
    process.exit(1);
  }

  const email = (process.argv[2] ?? process.env.SEED_EMAIL ?? "[email protected]")
    .trim()
    .toLowerCase();
  const memberEmail =
    process.env.SEED_MEMBER_EMAIL?.trim().toLowerCase() || "phase3-viewer-demo@local.invalid";
  const ownerPassword = process.env.SEED_PASSWORD || "SeedDemo123!";
  const memberPassword = process.env.SEED_MEMBER_PASSWORD || "SeedViewer123!";
  const shouldResetOwnerPassword = Boolean(process.env.SEED_PASSWORD);
  const shouldResetMemberPassword = Boolean(process.env.SEED_MEMBER_PASSWORD);

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  console.log(`→ Seeding DB with user=${email}`);

  // 1) user
  let user = (
    await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  )[0];
  if (!user) {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    user = (
      await db
        .insert(schema.users)
        .values({
          email,
          name: "Demo Admin",
          isSystemAdmin: false,
          passwordHash,
        })
        .returning()
    )[0]!;
    console.log(`  ✓ created user ${user.id}`);
  } else {
    console.log(`  • user exists ${user.id}`);
  }

  if (!user.passwordHash || shouldResetOwnerPassword) {
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    [user] = await db
      .update(schema.users)
      .set({ passwordHash, isSystemAdmin: false })
      .where(eq(schema.users.id, user.id))
      .returning();
    console.log(
      `  ✓ ${user.passwordHash ? "reset" : "set"} owner password hash for ${email}`,
    );
  } else if (user.isSystemAdmin) {
    [user] = await db
      .update(schema.users)
      .set({ isSystemAdmin: false })
      .where(eq(schema.users.id, user.id))
      .returning();
    console.log("  ✓ cleared legacy system-admin flag on demo owner");
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

  // 3b) viewer member for permission checks
  let memberUser = (
    await db.select().from(schema.users).where(eq(schema.users.email, memberEmail)).limit(1)
  )[0];
  if (!memberUser) {
    const passwordHash = await bcrypt.hash(memberPassword, 12);
    memberUser = (
      await db
        .insert(schema.users)
        .values({
          email: memberEmail,
          name: "Demo Member",
          isSystemAdmin: false,
          passwordHash,
        })
        .returning()
    )[0]!;
    console.log(`  ✓ created viewer user ${memberUser.id}`);
  } else {
    console.log(`  • viewer user exists ${memberUser.id}`);
  }

  if (!memberUser.passwordHash || shouldResetMemberPassword) {
    const passwordHash = await bcrypt.hash(memberPassword, 12);
    [memberUser] = await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, memberUser.id))
      .returning();
    console.log(
      `  ✓ ${memberUser.passwordHash ? "reset" : "set"} viewer password hash for ${memberEmail}`,
    );
  }

  const memberMembership = (
    await db
      .select()
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenantId, tenant.id),
          eq(schema.tenantMembers.userId, memberUser.id),
        ),
      )
      .limit(1)
  )[0];
  if (!memberMembership) {
    await db.insert(schema.tenantMembers).values({
      tenantId: tenant.id,
      userId: memberUser.id,
      role: "viewer",
      status: "active",
    });
    console.log("  ✓ created viewer membership");
  } else {
    console.log(`  • viewer membership exists (${memberMembership.role})`);
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

  // 6) business profile (completed, so dashboard skips onboarding)
  const profile = (
    await db
      .select()
      .from(schema.tenantBusinessProfiles)
      .where(eq(schema.tenantBusinessProfiles.tenantId, tenant.id))
      .limit(1)
  )[0];
  if (!profile) {
    await db.insert(schema.tenantBusinessProfiles).values({
      tenantId: tenant.id,
      businessNature: "hybrid",
      industry: "Beauty salon",
      defaultCurrency: "MYR",
      defaultLanguage: "en",
      timezone: "Asia/Kuala_Lumpur",
      primaryCountry: "MY",
      primaryPhone: "+60123456789",
      supportEmail: "[email protected]",
      websiteUrl: "https://demo.local",
      brandVoice: "Friendly, concise, uses English mixed with casual Malay.",
      onboardingCompletedAt: new Date(),
    });
    console.log("  ✓ created tenant_business_profiles (onboarded)");
  } else {
    console.log("  • tenant_business_profiles exists");
  }

  // 7) sample product + service (so the UI has something to render)
  let sampleCategory = (
    await db
      .select()
      .from(schema.productCategories)
      .where(
        and(
          eq(schema.productCategories.tenantId, tenant.id),
          eq(schema.productCategories.code, "HAIRCARE"),
        ),
      )
      .limit(1)
  )[0];
  if (!sampleCategory) {
    sampleCategory = (
      await db
        .insert(schema.productCategories)
        .values({
          tenantId: tenant.id,
          code: "HAIRCARE",
          name: "Haircare",
          description: "Demo product category for seeded catalog items.",
          status: "active",
        })
        .returning()
    )[0]!;
    console.log("  ✓ created sample product category HAIRCARE");
  } else {
    console.log("  • sample product category exists");
  }

  const haveProduct = (
    await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.tenantId, tenant.id))
      .limit(1)
  )[0];
  if (!haveProduct) {
    const [product] = await db.insert(schema.products).values({
      tenantId: tenant.id,
      categoryId: sampleCategory.id,
      productCode: "SKU-001",
      sku: "SERUM-50-001",
      name: "Hair Serum 50ml",
      slug: "hair-serum-50ml",
      shortDescription: "Demo product so the UI has a realistic catalog row.",
      longDescription:
        "Lightweight daily serum for dry or weak hair. Suitable for home use and salon retail recommendations.",
      productType: "physical",
      status: "active",
      unitOfMeasure: "bottle",
      defaultPrice: "49.00",
      compareAtPrice: "59.00",
      currency: "MYR",
      brand: "Demo Company",
      aiSellingNotes:
        "Best for customers asking about daily scalp care, lightweight texture, and salon-recommended maintenance.",
      aiFaqNotes:
        "Do not claim medical hair-growth results. Mention external use only and advise patch testing for sensitive users.",
      tags: ["haircare", "retail", "demo"],
    }).returning({ id: schema.products.id });
    await db.insert(schema.productMedia).values({
      tenantId: tenant.id,
      productId: product.id,
      mediaType: "image",
      url: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=900&q=80",
      altText: "Hair serum product bottle on a clean background",
      sortOrder: 0,
    });
    console.log("  ✓ created sample product SKU-001");
  } else {
    console.log("  • products already seeded");
  }

  const haveService = (
    await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.tenantId, tenant.id))
      .limit(1)
  )[0];
  if (!haveService) {
    await db.insert(schema.services).values({
      tenantId: tenant.id,
      serviceCode: "SVC-001",
      name: "Hair Wash & Blow",
      shortDescription: "Demo service so the UI has a row.",
      serviceType: "appointment",
      durationMinutes: 45,
      defaultPrice: "35.00",
      currency: "MYR",
      requiresBooking: true,
    });
    console.log("  ✓ created sample service SVC-001");
  } else {
    console.log("  • services already seeded");
  }

  await pool.end();
  console.log("✔ seed complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
