import "server-only";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

export const TENANT_DIFY_MODE = "shared_app_per_tenant_dataset" as const;

export const TENANT_DIFY_SYNC_STATUSES = [
  "not_configured",
  "pending_configuration",
  "ready",
  "sync_failed",
  "synced",
] as const;

export type TenantDifySyncStatus = (typeof TENANT_DIFY_SYNC_STATUSES)[number];

export type TenantDifySettings = {
  id: string;
  tenantId: string;
  enabled: boolean;
  mode: string;
  difyAppId: string | null;
  difyDatasetId: string | null;
  difyDatasetName: string | null;
  apiKeyRef: string | null;
  syncStatus: TenantDifySyncStatus;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  tone: string | null;
  language: string | null;
};

export type TenantDifyDatasetResolution = {
  settings: TenantDifySettings;
  appId: string | null;
  datasetId: string | null;
  datasetName: string | null;
  isEnabled: boolean;
  isConfigured: boolean;
  syncStatus: TenantDifySyncStatus;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
};

function normalizeSettings(
  row: typeof schema.tenantAiSettings.$inferSelect,
): TenantDifySettings {
  const syncStatus = TENANT_DIFY_SYNC_STATUSES.includes(
    row.syncStatus as TenantDifySyncStatus,
  )
    ? (row.syncStatus as TenantDifySyncStatus)
    : "not_configured";

  return {
    id: row.id,
    tenantId: row.tenantId,
    enabled: row.enabled,
    mode: row.mode,
    difyAppId: row.difyAppId,
    difyDatasetId: row.difyDatasetId,
    difyDatasetName: row.difyDatasetName,
    apiKeyRef: row.apiKeyRef,
    syncStatus,
    lastSyncedAt: row.lastSyncedAt,
    lastSyncError: row.lastSyncError,
    tone: row.tone,
    language: row.language,
  };
}

export async function getTenantDifySettings(
  tenantId: string,
): Promise<TenantDifySettings | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.tenantAiSettings)
    .where(eq(schema.tenantAiSettings.tenantId, tenantId))
    .limit(1);

  return row ? normalizeSettings(row) : null;
}

export async function ensureTenantDifySettings(
  tenantId: string,
): Promise<TenantDifySettings> {
  const existing = await getTenantDifySettings(tenantId);
  if (existing) return existing;

  const db = requireDb();
  const [row] = await db
    .insert(schema.tenantAiSettings)
    .values({
      tenantId,
      enabled: true,
      mode: TENANT_DIFY_MODE,
      syncStatus: "not_configured",
    })
    .returning();

  return normalizeSettings(row);
}

export async function resolveTenantDifyDataset(
  tenantId: string,
): Promise<TenantDifyDatasetResolution> {
  const settings = await ensureTenantDifySettings(tenantId);

  return {
    settings,
    appId: settings.difyAppId,
    datasetId: settings.difyDatasetId,
    datasetName: settings.difyDatasetName,
    isEnabled: settings.enabled,
    isConfigured: Boolean(
      settings.enabled && settings.difyAppId && settings.difyDatasetId,
    ),
    syncStatus: settings.syncStatus,
    lastSyncedAt: settings.lastSyncedAt,
    lastSyncError: settings.lastSyncError,
  };
}

export async function recordTenantDifyDataset(input: {
  tenantId: string;
  datasetId: string;
  datasetName?: string | null;
  appId?: string | null;
}) {
  const db = requireDb();
  const [row] = await db
    .update(schema.tenantAiSettings)
    .set({
      difyAppId: input.appId ?? undefined,
      difyDatasetId: input.datasetId,
      difyDatasetName: input.datasetName ?? undefined,
      syncStatus: "ready",
      lastSyncError: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tenantAiSettings.tenantId, input.tenantId))
    .returning();

  return row ? normalizeSettings(row) : null;
}

export async function markDifySyncStatus(input: {
  tenantId: string;
  status: TenantDifySyncStatus;
  error?: string | null;
}) {
  const db = requireDb();
  const patch: Partial<typeof schema.tenantAiSettings.$inferInsert> = {
    syncStatus: input.status,
    lastSyncError: input.error ?? null,
    updatedAt: new Date(),
  };

  if (input.status === "synced") {
    patch.lastSyncedAt = new Date();
  }

  const [row] = await db
    .update(schema.tenantAiSettings)
    .set(patch)
    .where(eq(schema.tenantAiSettings.tenantId, input.tenantId))
    .returning();

  return row ? normalizeSettings(row) : null;
}