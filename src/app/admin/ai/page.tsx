import Link from "next/link";
import { eq, isNull } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireDb } from "@/db/client";
import { aiProviderConfigs, tenantAiSettings, tenants } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = requireDb();
  const providers = await db
    .select({
      id: aiProviderConfigs.id,
      tenantId: aiProviderConfigs.tenantId,
      name: aiProviderConfigs.name,
      kind: aiProviderConfigs.kind,
      baseUrl: aiProviderConfigs.baseUrl,
      apiKeyRef: aiProviderConfigs.apiKeyRef,
      isDefault: aiProviderConfigs.isDefault,
      updatedAt: aiProviderConfigs.updatedAt,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(aiProviderConfigs)
    .leftJoin(tenants, eq(tenants.id, aiProviderConfigs.tenantId));

  const settingsRows = await db
    .select({
      tenantId: tenantAiSettings.tenantId,
      defaultProviderId: tenantAiSettings.defaultProviderId,
    })
    .from(tenantAiSettings);

  const globalProviders = providers.filter((provider) => provider.tenantId === null).length;
  const tenantProviders = providers.length - globalProviders;
  const tenantOverrides = settingsRows.filter((row) => row.defaultProviderId !== null).length;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">AI providers</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Cross-tenant visibility into provider configuration without revealing secret values.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Providers" value={String(providers.length)} />
        <StatCard label="Global defaults" value={String(globalProviders)} />
        <StatCard label="Tenant-owned" value={String(tenantProviders)} />
        <StatCard label="Tenant overrides" value={String(tenantOverrides)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider registry</CardTitle>
          <CardDescription>
            Secret mode is shown as reference type only. Raw secrets are never rendered here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No AI providers configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Scope</th>
                    <th className="px-3 py-2 font-medium">Base URL</th>
                    <th className="px-3 py-2 font-medium">Secret mode</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {providers.map((provider) => (
                    <tr key={provider.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-[var(--foreground)]">{provider.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">{provider.kind}</div>
                        {provider.isDefault ? <Badge className="mt-2">Default</Badge> : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {provider.tenantId
                          ? `${provider.tenantName ?? "Tenant"} (/t/${provider.tenantSlug ?? "unknown"})`
                          : "Global"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {provider.baseUrl ?? "Not set"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {provider.apiKeyRef?.startsWith("env:")
                          ? "env ref"
                          : provider.apiKeyRef?.startsWith("literal:")
                            ? "literal ref"
                            : provider.apiKeyRef
                              ? "custom ref"
                              : "none"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {provider.updatedAt.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
