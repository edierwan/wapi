import Link from "next/link";
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
import { connectedAccounts, tenants, whatsappSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const status = typeof params.status === "string" ? params.status.trim() : "";
  const accountParam = typeof params.account === "string" ? params.account.trim() : "";
  const db = requireDb();

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      accountId: connectedAccounts.id,
      displayName: connectedAccounts.displayName,
      phoneNumber: connectedAccounts.phoneNumber,
      gatewayUrl: connectedAccounts.gatewayUrl,
      isActive: connectedAccounts.isActive,
      accountCreatedAt: connectedAccounts.createdAt,
      sessionId: whatsappSessions.id,
      sessionStatus: whatsappSessions.status,
      lastQrAt: whatsappSessions.lastQrAt,
      lastConnectedAt: whatsappSessions.lastConnectedAt,
      sessionUpdatedAt: whatsappSessions.updatedAt,
      authPayload: whatsappSessions.authPayload,
    })
    .from(connectedAccounts)
    .innerJoin(tenants, eq(tenants.id, connectedAccounts.tenantId))
    .leftJoin(whatsappSessions, eq(whatsappSessions.accountId, connectedAccounts.id));

  const filteredRows = rows.filter((row) => {
    const statusOk = status ? (row.sessionStatus ?? "pending") === status : true;
    const text = [
      row.tenantName,
      row.tenantSlug,
      row.displayName,
      row.phoneNumber,
      row.gatewayUrl,
      row.accountId,
      row.sessionId,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const queryOk = q ? text.includes(q) : true;
    return statusOk && queryOk;
  });

  const selected = filteredRows.find(
    (row) => row.accountId === accountParam || row.sessionId === accountParam,
  );

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp sessions</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Read-only cross-tenant monitoring of connected account rows and WAPI-side session state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/wa-sessions">Refresh</Link>
          </Button>
          <Link
            href="/admin"
            className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
          >
            ← Overview
          </Link>
        </div>
      </div>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
        Live QR/send/status still depends on Request 05 gateway multi-tenancy.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>
            Filter by tenant, account label, phone, gateway URL, or session status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/wa-sessions" method="get" className="flex flex-wrap gap-3">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search tenant, account, phone, gateway"
              className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <select
              name="status"
              defaultValue={status}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">pending</option>
              <option value="connecting">connecting</option>
              <option value="connected">connected</option>
              <option value="disconnected">disconnected</option>
              <option value="expired">expired</option>
              <option value="error">error</option>
            </select>
            <Button type="submit" size="sm">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected session detail</CardTitle>
            <CardDescription>
              WAPI-side data only. No gateway control actions are exposed here.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Tenant" value={`${selected.tenantName} (/t/${selected.tenantSlug})`} />
            <Detail label="Account" value={`${selected.displayName} (${selected.accountId})`} />
            <Detail label="Session" value={selected.sessionId ?? "No session row"} />
            <Detail label="Status" value={selected.sessionStatus ?? "pending"} />
            <Detail label="Gateway URL" value={selected.gatewayUrl ?? "Default gateway"} />
            <Detail label="Phone" value={selected.phoneNumber ?? "Not paired yet"} />
            <Detail
              label="Last connected"
              value={selected.lastConnectedAt?.toLocaleString() ?? "Not recorded"}
            />
            <Detail label="Last QR" value={selected.lastQrAt?.toLocaleString() ?? "Not recorded"} />
            <Detail label="Auth payload" value={selected.authPayload ? "Present" : "Not stored"} />
            <Detail label="Last error" value="Not stored in schema" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session monitor</CardTitle>
          <CardDescription>
            Accounts without a session row still appear here so support can spot incomplete setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No connected-account rows matched the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium">Gateway</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Last connected</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredRows.map((row) => (
                    <tr key={row.accountId} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-[var(--foreground)]">{row.tenantName}</div>
                        <div className="font-mono text-xs text-[var(--muted-foreground)]">
                          /t/{row.tenantSlug}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-[var(--foreground)]">{row.displayName}</div>
                        <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                          {row.accountId}
                        </div>
                        {!row.isActive ? (
                          <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                            Account row marked inactive
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {row.gatewayUrl ?? "Default gateway"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge>{row.sessionStatus ?? "pending"}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {row.phoneNumber ?? "Not paired yet"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {row.lastConnectedAt?.toLocaleString() ?? "Not recorded"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/admin/wa-sessions?account=${row.accountId}`}>View details</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/t/${row.tenantSlug}/whatsapp`}>Tenant WhatsApp</Link>
                          </Button>
                        </div>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  );
}
