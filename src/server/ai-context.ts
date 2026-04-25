import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/**
 * Tenant-scoped AI context assembly.
 *
 * Reads tenant data from Postgres and produces a compact, structured
 * envelope safe to send as Dify `inputs`.
 *
 * Hard rules (do not regress):
 *   - Every query filters by `tenant_id`. No exceptions.
 *   - We never read another tenant's row, even by accident.
 *   - We trim long strings to keep prompt size bounded.
 */

const MAX_LIST = 12;
const MAX_BODY_CHARS = 600;
const MAX_DESC_CHARS = 240;

function trim(s: string | null | undefined, n: number): string {
  if (!s) return "";
  const flat = String(s).replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tone: string | null;
  language: string | null;
  businessProfileSummary: string;
  productsContext: string;
  servicesContext: string;
  businessMemoryContext: string;
  contactStats: { total: number; warm: number; hot: number; customer: number };
};

export async function assembleTenantContext(
  tenantId: string,
): Promise<TenantContext> {
  const db = requireDb();

  const [tenant] = await db
    .select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      slug: schema.tenants.slug,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);
  if (!tenant) throw new Error(`tenant ${tenantId} not found`);

  const [aiSettings] = await db
    .select()
    .from(schema.tenantAiSettings)
    .where(eq(schema.tenantAiSettings.tenantId, tenantId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(schema.tenantBusinessProfiles)
    .where(eq(schema.tenantBusinessProfiles.tenantId, tenantId))
    .limit(1);

  const productRows = await db
    .select({
      name: schema.products.name,
      shortDescription: schema.products.shortDescription,
      defaultPrice: schema.products.defaultPrice,
      currency: schema.products.currency,
      status: schema.products.status,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.tenantId, tenantId),
        eq(schema.products.status, "active"),
      ),
    )
    .orderBy(desc(schema.products.updatedAt))
    .limit(MAX_LIST);

  const serviceRows = await db
    .select({
      name: schema.services.name,
      shortDescription: schema.services.shortDescription,
      defaultPrice: schema.services.defaultPrice,
      currency: schema.services.currency,
      status: schema.services.status,
    })
    .from(schema.services)
    .where(
      and(
        eq(schema.services.tenantId, tenantId),
        eq(schema.services.status, "active"),
      ),
    )
    .orderBy(desc(schema.services.updatedAt))
    .limit(MAX_LIST);

  const memoryRows = await db
    .select({
      kind: schema.businessMemoryItems.kind,
      title: schema.businessMemoryItems.title,
      body: schema.businessMemoryItems.body,
      weight: schema.businessMemoryItems.weight,
    })
    .from(schema.businessMemoryItems)
    .where(
      and(
        eq(schema.businessMemoryItems.tenantId, tenantId),
        eq(schema.businessMemoryItems.status, "active"),
      ),
    )
    .orderBy(
      desc(schema.businessMemoryItems.weight),
      desc(schema.businessMemoryItems.updatedAt),
    )
    .limit(MAX_LIST * 2);

  const contactRows = await db
    .select({
      leadStatus: schema.contacts.leadStatus,
    })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId));

  const contactStats = {
    total: contactRows.length,
    warm: contactRows.filter((c) => c.leadStatus === "warm").length,
    hot: contactRows.filter((c) => c.leadStatus === "hot").length,
    customer: contactRows.filter((c) => c.leadStatus === "customer").length,
  };

  const businessProfileSummary = profile
    ? [
        profile.industry ? `Industry: ${profile.industry}` : null,
        profile.brandVoice ? `Voice: ${profile.brandVoice}` : null,
        profile.websiteUrl ? `Web: ${profile.websiteUrl}` : null,
        profile.supportEmail ? `Support: ${profile.supportEmail}` : null,
        profile.primaryCountry ? `Country: ${profile.primaryCountry}` : null,
        profile.defaultCurrency
          ? `Currency: ${profile.defaultCurrency}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const productsContext = productRows
    .map((p) => {
      const price =
        p.defaultPrice !== null && p.defaultPrice !== undefined
          ? `${p.currency} ${p.defaultPrice}`
          : "";
      const desc = trim(p.shortDescription, MAX_DESC_CHARS);
      return `- ${p.name}${price ? ` (${price})` : ""}${desc ? ` — ${desc}` : ""}`;
    })
    .join("\n");

  const servicesContext = serviceRows
    .map((s) => {
      const price =
        s.defaultPrice !== null && s.defaultPrice !== undefined
          ? `${s.currency} ${s.defaultPrice}`
          : "";
      const desc = trim(s.shortDescription, MAX_DESC_CHARS);
      return `- ${s.name}${price ? ` (${price})` : ""}${desc ? ` — ${desc}` : ""}`;
    })
    .join("\n");

  const businessMemoryContext = memoryRows
    .map((m) => `- [${m.kind}] ${m.title}: ${trim(m.body, MAX_BODY_CHARS)}`)
    .join("\n");

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tone: aiSettings?.tone ?? null,
    language: aiSettings?.language ?? profile?.defaultLanguage ?? null,
    businessProfileSummary,
    productsContext,
    servicesContext,
    businessMemoryContext,
    contactStats,
  };
}

/**
 * Convert assembled context to the `inputs` shape Dify chat-messages
 * expects (see docs/architecture/ai-dify.md "Suggested inputs contract").
 *
 * Always includes tenant_id so the Dify-side prompt can hard-fail on a
 * missing tenant scope.
 */
export function contextToDifyInputs(
  ctx: TenantContext,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tenant_id: ctx.tenantId,
    tenant_name: ctx.tenantName,
    tone: ctx.tone ?? "friendly",
    language: ctx.language ?? "en",
    business_profile: ctx.businessProfileSummary,
    products_context: ctx.productsContext,
    services_context: ctx.servicesContext,
    business_memory_context: ctx.businessMemoryContext,
    ...extra,
  };
}
