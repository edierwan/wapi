import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import {
  getStoragePublicConfig,
  getTenantStorageSummary,
  TENANT_STORAGE_CATEGORIES,
} from "@/server/storage";

export const dynamic = "force-dynamic";

export default async function TenantStorageSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const config = getStoragePublicConfig();
  const summary = config.enabled
    ? await getTenantStorageSummary(ctx.tenant.id).catch(() => null)
    : null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Settings" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">File storage</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Where this workspace stores uploads, exports, and media.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Backend</CardTitle>
          <CardDescription>
            Shared self-hosted SeaweedFS. Operators manage bucket-level access;
            your workspace only ever sees its own prefix.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Status">
            {config.enabled ? (
              <Badge>Enabled</Badge>
            ) : (
              <Badge>Not configured</Badge>
            )}
          </Field>
          <Field label="Bucket">
            <code className="font-mono text-xs">{config.bucket ?? "—"}</code>
          </Field>
          <Field label="Your prefix">
            <code className="font-mono text-xs break-all">
              tenants/{ctx.tenant.id}/
            </code>
          </Field>
          <Field label="Initialized">
            {summary && summary.enabled ? (
              summary.initialized ? (
                <Badge>
                  v{summary.version} · {summary.objectsSampleCount} obj
                  {summary.sampleTruncated ? "+" : ""}
                </Badge>
              ) : (
                <Badge>Not yet</Badge>
              )
            ) : (
              <span className="text-[var(--muted-foreground)] text-xs">—</span>
            )}
          </Field>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
          <CardDescription>
            Top-level folders inside your prefix. Application code is
            constrained to write only into these.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
            {TENANT_STORAGE_CATEGORIES.map((c) => (
              <li key={c} className="font-mono">
                tenants/{ctx.tenant.id}/{c}/
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy &amp; deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <p>
            Object names stored in your prefix are isolated by application
            policy. Operator credentials are never used by your workspace.
          </p>
          <p>
            When a workspace is deleted, the database rows referencing storage
            objects are removed automatically. The objects themselves are{" "}
            <strong>only purged</strong> when an operator explicitly requests a
            storage purge during workspace deletion (gated, dev-only by
            default).
          </p>
          <p className="text-xs">
            Reference:{" "}
            <Link className="underline-offset-2 hover:underline" href="/docs">
              docs/architecture/storage.md
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
