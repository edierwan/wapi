import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import {
  ensureTenantDifySettings,
  markDifySyncStatus,
  type TenantDifySyncStatus,
} from "@/server/tenant-dify";
import {
  buildKnowledgeDocuments,
  buildTenantDatasetName,
  type TenantKnowledgeSnapshot,
} from "@/server/tenant-dify-sync-core";

export type SyncTenantKnowledgeResult = {
  ok: boolean;
  status: TenantDifySyncStatus;
  message: string;
  documentCount: number;
  datasetId: string | null;
  datasetName: string | null;
  appId: string | null;
};

export async function loadTenantKnowledgeSnapshot(
  tenantId: string,
): Promise<TenantKnowledgeSnapshot> {
  const db = requireDb();

  const [tenant] = await db
    .select({
      id: schema.tenants.id,
      slug: schema.tenants.slug,
      name: schema.tenants.name,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`tenant ${tenantId} not found`);
  }

  const [profile] = await db
    .select({
      industry: schema.tenantBusinessProfiles.industry,
      supportEmail: schema.tenantBusinessProfiles.supportEmail,
      websiteUrl: schema.tenantBusinessProfiles.websiteUrl,
      brandVoice: schema.tenantBusinessProfiles.brandVoice,
      defaultLanguage: schema.tenantBusinessProfiles.defaultLanguage,
      defaultCurrency: schema.tenantBusinessProfiles.defaultCurrency,
      primaryCountry: schema.tenantBusinessProfiles.primaryCountry,
    })
    .from(schema.tenantBusinessProfiles)
    .where(eq(schema.tenantBusinessProfiles.tenantId, tenantId))
    .limit(1);

  const products = await db
    .select({
      id: schema.products.id,
      productCode: schema.products.productCode,
      name: schema.products.name,
      shortDescription: schema.products.shortDescription,
      longDescription: schema.products.longDescription,
      brand: schema.products.brand,
      currency: schema.products.currency,
      defaultPrice: schema.products.defaultPrice,
      aiSellingNotes: schema.products.aiSellingNotes,
      aiFaqNotes: schema.products.aiFaqNotes,
    })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.tenantId, tenantId),
        eq(schema.products.status, "active"),
      ),
    )
    .orderBy(desc(schema.products.updatedAt));

  const services = await db
    .select({
      id: schema.services.id,
      serviceCode: schema.services.serviceCode,
      name: schema.services.name,
      shortDescription: schema.services.shortDescription,
      longDescription: schema.services.longDescription,
      currency: schema.services.currency,
      defaultPrice: schema.services.defaultPrice,
      durationMinutes: schema.services.durationMinutes,
    })
    .from(schema.services)
    .where(
      and(
        eq(schema.services.tenantId, tenantId),
        eq(schema.services.status, "active"),
      ),
    )
    .orderBy(desc(schema.services.updatedAt));

  const memory = await db
    .select({
      id: schema.businessMemoryItems.id,
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
    );

  return { tenant, profile: profile ?? null, products, services, memory };
}

export async function syncTenantKnowledgeToDify(
  tenantId: string,
): Promise<SyncTenantKnowledgeResult> {
  const settings = await ensureTenantDifySettings(tenantId);
  const snapshot = await loadTenantKnowledgeSnapshot(tenantId);
  const documents = buildKnowledgeDocuments(snapshot);
  const datasetName =
    settings.difyDatasetName ??
    buildTenantDatasetName(snapshot.tenant.slug, snapshot.tenant.name);

  if (!settings.enabled) {
    const message = "Tenant AI knowledge is disabled.";
    await markDifySyncStatus({
      tenantId,
      status: "not_configured",
      error: message,
    });
    return {
      ok: false,
      status: "not_configured",
      message,
      documentCount: documents.length,
      datasetId: settings.difyDatasetId,
      datasetName,
      appId: settings.difyAppId,
    };
  }

  if (!settings.difyAppId || !settings.difyDatasetId) {
    const message =
      "Dify app or dataset mapping is still missing. Configure dify_app_id and dify_dataset_id before remote sync.";
    await markDifySyncStatus({
      tenantId,
      status: "pending_configuration",
      error: message,
    });
    return {
      ok: false,
      status: "pending_configuration",
      message,
      documentCount: documents.length,
      datasetId: settings.difyDatasetId,
      datasetName,
      appId: settings.difyAppId,
    };
  }

  await markDifySyncStatus({
    tenantId,
    status: "ready",
    error: null,
  });

  return {
    ok: true,
    status: "ready",
    message:
      "Knowledge package prepared with tenant-only documents. Remote Dify dataset upload remains a follow-up tranche.",
    documentCount: documents.length,
    datasetId: settings.difyDatasetId,
    datasetName,
    appId: settings.difyAppId,
  };
}