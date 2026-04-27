import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDb } from "@/db/client";
import { storageObjects, tenants } from "@/db/schema";
import {
  getStoragePublicConfig,
  getTenantStorageSummary,
  storageEnabled,
} from "@/server/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminStoragePage() {
  const db = requireDb();
  const config = getStoragePublicConfig();

  const tenantRows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(tenants.name);

  const dbCounts = await db
    .select({
      tenantId: storageObjects.tenantId,
      count: sql<number>`count(*)::int`,
      size: sql<number>`coalesce(sum(${storageObjects.sizeBytes}),0)::bigint`,
    })
    .from(storageObjects)
    .groupBy(storageObjects.tenantId);
  const dbCountByTenant = new Map(
    dbCounts.map((r) => [r.tenantId, { count: r.count, size: Number(r.size) }]),
  );

  // Live S3 head per tenant — best effort; keep small to avoid latency blowup.
  const liveSummaries = new Map<string, Awaited<ReturnType<typeof getTenantStorageSummary>>>();
  if (config.enabled) {
    const sample = tenantRows.slice(0, 50);
    await Promise.all(
      sample.map(async (t) => {
        try {
          liveSummaries.set(t.id, await getTenantStorageSummary(t.id));
        } catch {
          // ignore individual failures so the page still renders
        }
      }),
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Storage Backend</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            System-admin-only view of provider health, tenant prefixes, and storage initialization status.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backend</CardTitle>
          <CardDescription>
            Shared infra. Operator console:{" "}
            <Link
              className="underline-offset-2 hover:underline"
              href={config.publicConsoleUrl}
              target="_blank"
              rel="noreferrer"
            >
              {config.publicConsoleUrl}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Status">
            {config.enabled ? (
              <Badge>Configured</Badge>
            ) : (
              <Badge>Not configured</Badge>
            )}
          </Field>
          <Field label="Bucket">
            <code className="font-mono text-xs">{config.bucket ?? "—"}</code>
          </Field>
          <Field label="Endpoint">
            <code className="font-mono text-xs">{config.endpoint ?? "—"}</code>
          </Field>
          <Field label="Region">
            <code className="font-mono text-xs">{config.region ?? "—"}</code>
          </Field>
          <Field label="Identity (access key prefix)">
            <code className="font-mono text-xs">
              {config.accessKeyIdPrefix ?? "—"}
            </code>
          </Field>
          <Field label="Tenant prefix layout">
            <code className="font-mono text-xs">
              tenants/&#123;tenantId&#125;/&#123;category&#125;/...
            </code>
          </Field>
        </CardContent>
      </Card>

      {!config.enabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage is not configured</CardTitle>
            <CardDescription>
              Set <code className="font-mono">S3_ENDPOINT</code>,{" "}
              <code className="font-mono">S3_BUCKET</code>,{" "}
              <code className="font-mono">S3_ACCESS_KEY_ID</code>, and{" "}
              <code className="font-mono">S3_SECRET_ACCESS_KEY</code> in the WAPI
              environment. See{" "}
              <code className="font-mono">docs/architecture/storage.md</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenant prefixes</CardTitle>
          <CardDescription>
            DB count is the row count in <code className="font-mono">storage_objects</code>.
            Live status reflects whether the tenant has been initialized in S3
            (presence of <code className="font-mono">_meta/storage.json</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantRows.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No tenants.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Prefix</th>
                    <th className="px-3 py-2 font-medium">DB rows</th>
                    <th className="px-3 py-2 font-medium">DB size</th>
                    <th className="px-3 py-2 font-medium">Live init</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {tenantRows.map((t) => {
                    const dbInfo = dbCountByTenant.get(t.id);
                    const live = liveSummaries.get(t.id);
                    return (
                      <tr key={t.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-[var(--muted-foreground)] font-mono">
                            /t/{t.slug}
                          </div>
                          <div className="mt-1">
                            <Badge>{t.status}</Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <code className="font-mono text-xs">
                            tenants/{t.id}/
                          </code>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {dbInfo?.count ?? 0}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {formatBytes(dbInfo?.size ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {!config.enabled ? (
                            <span className="text-[var(--muted-foreground)]">—</span>
                          ) : live && live.enabled ? (
                            live.initialized ? (
                              <Badge>
                                v{live.version} · {live.objectsSampleCount} obj
                                {live.sampleTruncated ? "+" : ""}
                              </Badge>
                            ) : (
                              <Badge>Not initialized</Badge>
                            )
                          ) : (
                            <span className="text-[var(--muted-foreground)]">
                              n/a
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operator runbook</CardTitle>
          <CardDescription>
            Short reference. Full procedure in{" "}
            <code className="font-mono">
              getouch.co/docs/s3-object-storage-2026-04-26.md
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Provisioning a new identity, rotating a secret, and creating buckets
            are operator-only actions performed on the host. WAPI never holds
            the SeaweedFS root credential.
          </p>
          <ul className="list-disc pl-5 text-xs text-[var(--muted-foreground)]">
            <li>Identity used here is least-privilege, scoped to a single bucket.</li>
            <li>
              Tenant cleanup (storage purge) is gated by typed confirmation and
              is disabled in production unless an explicit env override is set.
            </li>
            <li>
              Cross-bucket isolation is verified post-provisioning via a smoke
              test (PUT/GET/LIST/DEL on own bucket, AccessDenied on others).
            </li>
          </ul>
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

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

// suppress unused-import lint when DB is not enabled
void eq;
void storageEnabled;
