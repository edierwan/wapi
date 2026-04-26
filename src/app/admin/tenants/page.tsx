import Link from "next/link";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDb } from "@/db/client";
import { connectedAccounts, tenantMembers, tenants } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const db = requireDb();

  const tenantRows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      plan: tenants.plan,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    })
    .from(tenants)
    .where(
      q
        ? or(
            ilike(tenants.name, `%${q}%`),
            ilike(tenants.slug, `%${q}%`),
            ilike(tenants.plan, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(tenants.updatedAt));

  const filteredTenants = status
    ? tenantRows.filter((tenant) => tenant.status === status)
    : tenantRows;

  const membershipRows = await db
    .select({
      tenantId: tenantMembers.tenantId,
      role: tenantMembers.role,
      status: tenantMembers.status,
    })
    .from(tenantMembers);

  const accountRows = await db
    .select({ tenantId: connectedAccounts.tenantId })
    .from(connectedAccounts);

  const membershipCounts = new Map<string, { active: number; ownerAdmins: number }>();
  for (const membership of membershipRows) {
    const bucket = membershipCounts.get(membership.tenantId) ?? {
      active: 0,
      ownerAdmins: 0,
    };
    if (membership.status === "active") {
      bucket.active += 1;
      if (membership.role === "owner" || membership.role === "admin") {
        bucket.ownerAdmins += 1;
      }
    }
    membershipCounts.set(membership.tenantId, bucket);
  }

  const accountCounts = new Map<string, number>();
  for (const account of accountRows) {
    accountCounts.set(account.tenantId, (accountCounts.get(account.tenantId) ?? 0) + 1);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Cross-tenant workspace directory for support, QA, and readiness audits.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tenants" value={String(filteredTenants.length)} />
        <StatCard
          label="Owner/admin seats"
          value={String(
            filteredTenants.reduce(
              (sum, tenant) => sum + (membershipCounts.get(tenant.id)?.ownerAdmins ?? 0),
              0,
            ),
          )}
        />
        <StatCard
          label="Connected accounts"
          value={String(
            filteredTenants.reduce(
              (sum, tenant) => sum + (accountCounts.get(tenant.id) ?? 0),
              0,
            ),
          )}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>
            Filter by tenant name, slug, plan, or current tenant status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/tenants" method="get" className="flex flex-wrap gap-3">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, slug, plan"
              className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <select
              name="status"
              defaultValue={status}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="trial">trial</option>
              <option value="suspended">suspended</option>
              <option value="disabled">disabled</option>
            </select>
            <Button type="submit" size="sm">Apply</Button>
            {q || status ? (
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/admin/tenants">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace directory</CardTitle>
          <CardDescription>
            Read-only first version. No suspend/resume actions are exposed in this tranche.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTenants.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No tenants matched the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Plan / status</th>
                    <th className="px-3 py-2 font-medium">Members</th>
                    <th className="px-3 py-2 font-medium">WA accounts</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                    <th className="px-3 py-2 font-medium text-right">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredTenants.map((tenant) => {
                    const memberStats = membershipCounts.get(tenant.id) ?? {
                      active: 0,
                      ownerAdmins: 0,
                    };
                    return (
                      <tr key={tenant.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-[var(--foreground)]">{tenant.name}</div>
                          <div className="font-mono text-xs text-[var(--muted-foreground)]">
                            /t/{tenant.slug}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge>{tenant.status}</Badge>
                            {tenant.plan ? <Badge>{tenant.plan}</Badge> : <Badge>No plan</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          <div>{memberStats.active} active</div>
                          <div className="mt-1">{memberStats.ownerAdmins} owner/admin</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {accountCounts.get(tenant.id) ?? 0}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {tenant.createdAt.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {tenant.updatedAt.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/t/${tenant.slug}`}>Open workspace</Link>
                          </Button>
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
