import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { env } from "@/lib/env";

/**
 * AI provider resolution.
 *
 * Resolves which `ai_provider_configs` row + secret to use for a given tenant.
 * Order (matches docs/architecture/ai-dify.md):
 *   1. tenant_ai_settings.default_provider_id
 *   2. tenant-owned ai_provider_configs row where is_default = true
 *   3. global ai_provider_configs row where tenant_id IS NULL AND is_default = true
 *
 * Secrets:
 *   `api_key_ref` is a POINTER, never the raw secret. Supported forms:
 *     - "env:NAME"  → process.env.NAME
 *     - "literal:…" → DEV ONLY; treated as the secret bytes (rejected in
 *                     production via APP_ENV)
 *   Anything else returns null. The resolver NEVER returns the secret to a
 *   caller that isn't on the server-only path (this whole module is
 *   `server-only`).
 */

export type ResolvedProvider = {
  id: string;
  tenantId: string | null;
  name: string;
  kind: "dify" | "ollama" | "openai_compatible";
  baseUrl: string | null;
  apiKeyRef: string | null;
  config: Record<string, unknown> | null;
  isTenantOwned: boolean;
};

export async function getTenantProvider(
  tenantId: string,
): Promise<ResolvedProvider | null> {
  const db = requireDb();

  // 1. tenant_ai_settings.default_provider_id
  const [settings] = await db
    .select()
    .from(schema.tenantAiSettings)
    .where(eq(schema.tenantAiSettings.tenantId, tenantId))
    .limit(1);

  if (settings?.defaultProviderId) {
    const [row] = await db
      .select()
      .from(schema.aiProviderConfigs)
      .where(eq(schema.aiProviderConfigs.id, settings.defaultProviderId))
      .limit(1);
    // Tenant safety: if the configured row belongs to another tenant,
    // ignore it and fall through. A null tenantId (global) is allowed.
    if (row && (row.tenantId === null || row.tenantId === tenantId)) {
      return toResolved(row, settings);
    }
  }

  // 2. tenant-owned default
  const [tenantDefault] = await db
    .select()
    .from(schema.aiProviderConfigs)
    .where(
      and(
        eq(schema.aiProviderConfigs.tenantId, tenantId),
        eq(schema.aiProviderConfigs.isDefault, true),
      ),
    )
    .orderBy(desc(schema.aiProviderConfigs.updatedAt))
    .limit(1);
  if (tenantDefault) return toResolved(tenantDefault, settings);

  // 3. global default
  const [globalDefault] = await db
    .select()
    .from(schema.aiProviderConfigs)
    .where(
      and(
        isNull(schema.aiProviderConfigs.tenantId),
        eq(schema.aiProviderConfigs.isDefault, true),
      ),
    )
    .orderBy(desc(schema.aiProviderConfigs.updatedAt))
    .limit(1);
  if (globalDefault) return toResolved(globalDefault, settings);

  return null;
}

function toResolved(
  row: typeof schema.aiProviderConfigs.$inferSelect,
  settings?: typeof schema.tenantAiSettings.$inferSelect,
): ResolvedProvider {
  const config = ((row.config as Record<string, unknown> | null) ?? {}) as Record<
    string,
    unknown
  >;

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    kind: row.kind,
    baseUrl: row.baseUrl,
    apiKeyRef: settings?.apiKeyRef ?? row.apiKeyRef,
    config: {
      ...config,
      ...(settings?.difyAppId ? { appId: settings.difyAppId } : null),
    },
    isTenantOwned: row.tenantId !== null,
  };
}

/**
 * Resolve `api_key_ref` into the actual secret string. Returns null when
 * the ref is missing, malformed, or points to an env var that is unset.
 *
 * Production refuses `literal:` (treats it as malformed) so a bad migration
 * cannot leak plaintext secrets.
 */
export function resolveSecret(apiKeyRef: string | null | undefined): string | null {
  if (!apiKeyRef) return null;
  const trimmed = apiKeyRef.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("env:")) {
    const name = trimmed.slice(4).trim();
    if (!name) return null;
    const value = process.env[name];
    return value && value.length > 0 ? value : null;
  }
  if (trimmed.startsWith("literal:")) {
    if (env.APP_ENV === "production") return null;
    const value = trimmed.slice(8);
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Convenience: resolve provider AND secret in one call. Returns null if
 * either resolution step fails.
 */
export async function getTenantProviderWithSecret(tenantId: string): Promise<
  | (ResolvedProvider & { apiKey: string })
  | null
> {
  const p = await getTenantProvider(tenantId);
  if (!p) return null;
  const apiKey = resolveSecret(p.apiKeyRef);
  if (!apiKey) return null;
  return { ...p, apiKey };
}

// silence unused-import lints if the file ever loses its only use
void or;
void sql;
