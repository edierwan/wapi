import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import { getTenantProvider } from "@/server/ai-providers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DraftReplyForm } from "./draft-reply-form";

export const dynamic = "force-dynamic";

export default async function AiDraftPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const provider = await getTenantProvider(ctx.tenant.id);

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
              <div>
                <span className="text-[var(--muted-foreground)]">Secret ref:</span>{" "}
                <code className="text-xs">
                  {provider.apiKeyRef ?? "—"}
                </code>
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

      <DraftReplyForm tenantSlug={ctx.tenant.slug} />
    </section>
  );
}
