import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import { getTenantProvider } from "@/server/ai-providers";
import { resolveTenantDifyDataset } from "@/server/tenant-dify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DraftReplyForm } from "./draft-reply-form";
import { syncTenantKnowledgeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AiDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const ctx = await requireTenantContext(tenantSlug);
  const provider = await getTenantProvider(ctx.tenant.id);
  const dify = await resolveTenantDifyDataset(ctx.tenant.id);
  const canWrite = ["owner", "admin", "agent"].includes(
    ctx.currentUserRole ?? "",
  );
  const syncMessage = Array.isArray(query.knowledgeMessage)
    ? query.knowledgeMessage[0]
    : query.knowledgeMessage;
  const syncStatus = Array.isArray(query.knowledgeSync)
    ? query.knowledgeSync[0]
    : query.knowledgeSync;
  const syncCount = Array.isArray(query.knowledgeCount)
    ? query.knowledgeCount[0]
    : query.knowledgeCount;

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="AI" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI draft assistant</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Manual, human-in-the-loop only. Paste a customer message; we
          assemble tenant context (profile, catalog, business memory) and
          ask your AI provider for a draft. Nothing is sent or persisted.
        </p>
      </div>

      {syncMessage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Knowledge sync status</CardTitle>
            <CardDescription>
              {syncStatus ?? "status unknown"}
              {syncCount ? ` · ${syncCount} documents prepared` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">{syncMessage}</CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Provider status</CardTitle>
          <CardDescription>
            Resolution order: tenant_ai_settings → tenant default → global default.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {provider ? (
            <div className="space-y-1">
              <div>
                <span className="text-[var(--muted-foreground)]">Name:</span>{" "}
                {provider.name}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Kind:</span>{" "}
                {provider.kind}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Scope:</span>{" "}
                {provider.isTenantOwned ? "tenant-owned" : "global default"}
              </div>
              <div>
                <span className="text-[var(--muted-foreground)]">Base URL:</span>{" "}
                <code className="text-xs">{provider.baseUrl ?? "—"}</code>
              </div>
            </div>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              No provider resolved. Seed a global Dify provider (set{" "}
              <code>DIFY_DEFAULT_BASE_URL</code> at boot) or insert a
              tenant-owned <code>ai_provider_configs</code> row.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Tenant Dify dataset</CardTitle>
          <CardDescription>
            Shared Dify app, per-tenant dataset mapping. WAPI stays the tenancy boundary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <span className="text-[var(--muted-foreground)]">Mode:</span>{" "}
            {dify.settings.mode}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Enabled:</span>{" "}
            {dify.isEnabled ? "yes" : "no"}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">App ID:</span>{" "}
            <code className="text-xs">{dify.appId ?? "—"}</code>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Dataset ID:</span>{" "}
            <code className="text-xs">{dify.datasetId ?? "—"}</code>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Dataset name:</span>{" "}
            {dify.datasetName ?? `${ctx.tenant.name} (${ctx.tenant.slug}) knowledge`}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Sync status:</span>{" "}
            {dify.syncStatus}
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Last synced:</span>{" "}
            {dify.lastSyncedAt ? dify.lastSyncedAt.toISOString() : "—"}
          </div>
          {dify.lastSyncError ? (
            <p className="text-[color:var(--destructive,#b91c1c)]">
              {dify.lastSyncError}
            </p>
          ) : null}
          <form action={syncTenantKnowledgeAction}>
            <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
            <button
              type="submit"
              disabled={!canWrite}
              className="inline-flex items-center rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prepare tenant knowledge sync
            </button>
          </form>
        </CardContent>
      </Card>

      <DraftReplyForm tenantSlug={ctx.tenant.slug} />
    </section>
  );
}
