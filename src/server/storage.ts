/**
 * Tenant-aware S3-compatible object storage (SeaweedFS at s3api.getouch.co).
 *
 * Server-only. Imports the AWS SDK dynamically so a missing dependency or
 * unconfigured environment never breaks the build / non-storage routes.
 *
 * Identity model:
 *   The bucket `wapi-assets` is owned by a least-privilege identity
 *   (`wapi-app`) with actions: Read|Write|List|Tagging scoped to that
 *   bucket only. Operator/root credentials are never used here.
 *
 * Tenant isolation:
 *   Every object lives under `tenants/{tenantId}/...`. The application
 *   layer is the only thing enforcing this — wapi-app has bucket-wide
 *   access — so all helpers in this module accept and validate a
 *   `tenantId` (UUID) and refuse keys that escape the prefix.
 *
 * Shared infra contract: `getouch.co/docs/s3-object-storage-2026-04-26.md`
 * Per-tenant layout reference: `docs/architecture/storage.md`
 */

import "server-only";
import { env } from "@/lib/env";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitelisted top-level categories under a tenant prefix. */
export const TENANT_STORAGE_CATEGORIES = [
  "_meta",
  "products",
  "services",
  "media",
  "exports",
  "imports",
  "campaigns",
  "messages",
] as const;
export type TenantStorageCategory = (typeof TENANT_STORAGE_CATEGORIES)[number];

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicConsoleUrl: string;
};

function readConfig(): StorageConfig | null {
  // env is the strict-validated config; we read raw process.env so an
  // unset value just disables the module instead of throwing at import.
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const bucket = process.env.S3_BUCKET?.trim() || "wapi-assets";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const forcePathStyle =
    (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";
  const publicConsoleUrl =
    process.env.S3_PUBLIC_CONSOLE_URL?.trim() || "https://s3.getouch.co";

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    publicConsoleUrl,
  };
}

export function storageEnabled(): boolean {
  return readConfig() !== null;
}

export function getStorageConfig(): StorageConfig | null {
  return readConfig();
}

/** Public, non-secret summary safe to render in admin UI. */
export function getStoragePublicConfig(): {
  enabled: boolean;
  endpoint: string | null;
  bucket: string | null;
  region: string | null;
  publicConsoleUrl: string;
  accessKeyIdPrefix: string | null;
} {
  const cfg = readConfig();
  if (!cfg) {
    return {
      enabled: false,
      endpoint: null,
      bucket: null,
      region: null,
      publicConsoleUrl:
        process.env.S3_PUBLIC_CONSOLE_URL?.trim() || "https://s3.getouch.co",
      accessKeyIdPrefix: null,
    };
  }
  return {
    enabled: true,
    endpoint: cfg.endpoint,
    bucket: cfg.bucket,
    region: cfg.region,
    publicConsoleUrl: cfg.publicConsoleUrl,
    accessKeyIdPrefix:
      cfg.accessKeyId.length > 8
        ? `${cfg.accessKeyId.slice(0, 6)}...${cfg.accessKeyId.slice(-2)}`
        : "***",
  };
}

/* ------------------------------------------------------------------ *
 * Key helpers
 * ------------------------------------------------------------------ */

function assertTenantId(tenantId: string): string {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenantId for storage prefix: ${tenantId}`);
  }
  return tenantId.toLowerCase();
}

export function buildTenantPrefix(tenantId: string): string {
  return `tenants/${assertTenantId(tenantId)}/`;
}

function sanitizeFilename(name: string): string {
  // Strip path traversal + leading dots + control chars; keep [\w.-]
  const stripped = name
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[/\\]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  if (!stripped || stripped === "." || stripped === "..") {
    throw new Error("Refusing to build object key with empty/dot filename.");
  }
  return stripped;
}

/**
 * Build an object key under a tenant prefix. Refuses path traversal.
 * Example: tenants/{tid}/products/{entity}/{filename}
 */
export function buildTenantObjectKey(
  tenantId: string,
  category: TenantStorageCategory,
  entityId: string,
  filename: string,
): string {
  if (!TENANT_STORAGE_CATEGORIES.includes(category)) {
    throw new Error(`Disallowed storage category: ${category}`);
  }
  if (!entityId || /[/\\\u0000]/.test(entityId)) {
    throw new Error(`Invalid entityId for storage key: ${entityId}`);
  }
  return `${buildTenantPrefix(tenantId)}${category}/${entityId}/${sanitizeFilename(filename)}`;
}

/* ------------------------------------------------------------------ *
 * S3 client (dynamically imported)
 * ------------------------------------------------------------------ */

type AnyClient = {
  send: (cmd: unknown) => Promise<unknown>;
};
type S3Mod = {
  S3Client: new (cfg: unknown) => AnyClient;
  PutObjectCommand: new (input: unknown) => unknown;
  GetObjectCommand: new (input: unknown) => unknown;
  ListObjectsV2Command: new (input: unknown) => unknown;
  DeleteObjectsCommand: new (input: unknown) => unknown;
  HeadObjectCommand: new (input: unknown) => unknown;
};

let cachedSdk: S3Mod | null = null;
let cachedClient: AnyClient | null = null;

async function loadSdk(): Promise<S3Mod | null> {
  if (cachedSdk) return cachedSdk;
  try {
    const moduleName = "@aws-sdk/client-s3";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as unknown as S3Mod;
    cachedSdk = mod;
    return mod;
  } catch (err) {
    console.warn(
      "[storage] @aws-sdk/client-s3 not installed; storage features disabled.",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function getClient(): Promise<{ client: AnyClient; sdk: S3Mod; cfg: StorageConfig } | null> {
  const cfg = readConfig();
  if (!cfg) return null;
  const sdk = await loadSdk();
  if (!sdk) return null;
  if (!cachedClient) {
    cachedClient = new sdk.S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
    });
  }
  return { client: cachedClient, sdk, cfg };
}

/* ------------------------------------------------------------------ *
 * Lifecycle + read helpers
 * ------------------------------------------------------------------ */

export type TenantStorageInitMetadata = {
  tenantSlug: string;
  environment?: string; // dev / preprod / prod
  createdByUserId?: string | null;
};

export type TenantStorageSummary =
  | {
      enabled: false;
      reason: string;
    }
  | {
      enabled: true;
      tenantId: string;
      bucket: string;
      prefix: string;
      initialized: boolean;
      objectsSampleCount: number;
      sampleTruncated: boolean;
      initializedAt: string | null;
      version: number | null;
    };

const _ = void env; // keep `env` import used (pulls in env validation)

/**
 * Write `_meta/storage.json` marker for a tenant. Idempotent: re-init
 * bumps the version field.
 */
export async function initializeTenantStorage(
  tenantId: string,
  metadata: TenantStorageInitMetadata,
): Promise<{ ok: true; key: string } | { ok: false; reason: string }> {
  const ctx = await getClient();
  if (!ctx) return { ok: false, reason: "storage_not_configured" };
  const prefix = buildTenantPrefix(tenantId);
  const key = `${prefix}_meta/storage.json`;
  const existing = await readMetaJson(tenantId).catch(() => null);
  const payload = {
    tenantId: assertTenantId(tenantId),
    tenantSlug: metadata.tenantSlug,
    environment: metadata.environment ?? process.env.NODE_ENV ?? "unknown",
    initializedAt: existing?.initializedAt ?? new Date().toISOString(),
    lastTouchedAt: new Date().toISOString(),
    version: (existing?.version ?? 0) + 1,
    createdByUserId: metadata.createdByUserId ?? existing?.createdByUserId ?? null,
  };
  const body = JSON.stringify(payload, null, 2);
  await ctx.client.send(
    new ctx.sdk.PutObjectCommand({
      Bucket: ctx.cfg.bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
    }),
  );
  return { ok: true, key };
}

async function readMetaJson(
  tenantId: string,
): Promise<{ initializedAt?: string; version?: number; createdByUserId?: string | null } | null> {
  const ctx = await getClient();
  if (!ctx) return null;
  const key = `${buildTenantPrefix(tenantId)}_meta/storage.json`;
  try {
    const res = (await ctx.client.send(
      new ctx.sdk.GetObjectCommand({ Bucket: ctx.cfg.bucket, Key: key }),
    )) as { Body?: { transformToString?: () => Promise<string> } };
    const text = (await res.Body?.transformToString?.()) ?? "";
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function listTenantStorageObjects(
  tenantId: string,
  opts: { maxKeys?: number } = {},
): Promise<{ keys: string[]; truncated: boolean }> {
  const ctx = await getClient();
  if (!ctx) return { keys: [], truncated: false };
  const res = (await ctx.client.send(
    new ctx.sdk.ListObjectsV2Command({
      Bucket: ctx.cfg.bucket,
      Prefix: buildTenantPrefix(tenantId),
      MaxKeys: Math.min(Math.max(opts.maxKeys ?? 100, 1), 1000),
    }),
  )) as { Contents?: Array<{ Key?: string }>; IsTruncated?: boolean };
  return {
    keys: (res.Contents ?? []).map((o) => o.Key ?? "").filter(Boolean),
    truncated: Boolean(res.IsTruncated),
  };
}

export async function getTenantStorageSummary(
  tenantId: string,
): Promise<TenantStorageSummary> {
  const ctx = await getClient();
  if (!ctx) return { enabled: false, reason: "storage_not_configured" };
  const prefix = buildTenantPrefix(tenantId);
  const [list, meta] = await Promise.all([
    listTenantStorageObjects(tenantId, { maxKeys: 50 }),
    readMetaJson(tenantId),
  ]);
  return {
    enabled: true,
    tenantId: assertTenantId(tenantId),
    bucket: ctx.cfg.bucket,
    prefix,
    initialized: meta !== null,
    objectsSampleCount: list.keys.length,
    sampleTruncated: list.truncated,
    initializedAt: meta?.initializedAt ?? null,
    version: meta?.version ?? null,
  };
}

/**
 * Delete every object under `tenants/{tenantId}/`. Hard-destructive.
 * Caller is responsible for any RBAC / typed-confirmation gating.
 *
 * Production guardrail: refuses to run unless either NODE_ENV !== "production"
 * or env `WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION === "true"`.
 */
export async function deleteTenantStoragePrefix(
  tenantId: string,
  opts: { confirmTenantId: string; allowInProduction?: boolean } = {
    confirmTenantId: "",
  },
): Promise<{ ok: true; deleted: number } | { ok: false; reason: string }> {
  if (assertTenantId(tenantId) !== assertTenantId(opts.confirmTenantId)) {
    return { ok: false, reason: "confirmTenantId_mismatch" };
  }
  const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const overridden =
    opts.allowInProduction === true ||
    (process.env.WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION ?? "").toLowerCase() ===
      "true";
  if (isProd && !overridden) {
    return { ok: false, reason: "production_purge_disabled" };
  }

  const ctx = await getClient();
  if (!ctx) return { ok: false, reason: "storage_not_configured" };
  const prefix = buildTenantPrefix(tenantId);

  let totalDeleted = 0;
  let continuationToken: string | undefined = undefined;
  for (let page = 0; page < 200; page++) {
    const list = (await ctx.client.send(
      new ctx.sdk.ListObjectsV2Command({
        Bucket: ctx.cfg.bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    )) as {
      Contents?: Array<{ Key?: string }>;
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    };
    const objects = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k));
    if (objects.length === 0) break;

    await ctx.client.send(
      new ctx.sdk.DeleteObjectsCommand({
        Bucket: ctx.cfg.bucket,
        Delete: {
          Objects: objects.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    totalDeleted += objects.length;
    if (!list.IsTruncated) break;
    continuationToken = list.NextContinuationToken;
    if (!continuationToken) break;
  }
  return { ok: true, deleted: totalDeleted };
}
