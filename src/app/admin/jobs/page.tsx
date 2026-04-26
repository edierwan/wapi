import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDb } from "@/db/client";
import { messageQueue } from "@/db/schema";
import { getSystemHealthSnapshot } from "@/server/system-health";
import { formatAge } from "@/server/worker-supervisor-core";

export const dynamic = "force-dynamic";

export default async function Page() {
  const snapshot = await getSystemHealthSnapshot();
  const db = requireDb();
  const recentFailures = await db
    .select({
      id: messageQueue.id,
      tenantId: messageQueue.tenantId,
      toPhone: messageQueue.toPhone,
      purpose: messageQueue.purpose,
      failureReason: messageQueue.failureReason,
      failedAt: messageQueue.failedAt,
    })
    .from(messageQueue)
    .where(eq(messageQueue.status, "failed"))
    .orderBy(desc(messageQueue.failedAt))
    .limit(10);

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Jobs / Queue</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Operational queue visibility backed by `message_queue` and worker heartbeats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/system-health">Open system health</Link>
          </Button>
          <Link
            href="/admin"
            className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
          >
            ← Overview
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue health</CardTitle>
          <CardDescription>
            Cross-tenant read-only view. No retry or mutation controls in this tranche.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Queued" value={snapshot.queue.queuedCount} />
          <Stat label="Sending" value={snapshot.queue.sendingCount} />
          <Stat label="Failed (24h)" value={snapshot.queue.failedLast24hCount} />
          <Stat
            label="Oldest queued"
            value={
              snapshot.queue.oldestQueuedAgeMs === null
                ? "—"
                : formatAge(snapshot.queue.oldestQueuedAgeMs)
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Worker summary</CardTitle>
          <CardDescription>
            Mirrors the same worker snapshot that feeds `/admin/system-health`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {snapshot.workers.map((worker) => (
            <div key={worker.name} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] px-3 py-2">
              <div className="font-medium">{worker.name}</div>
              <div className="text-[var(--muted-foreground)]">
                {worker.heartbeat
                  ? `${worker.state} · ticks ${worker.heartbeat.totalTicks} · errors ${worker.heartbeat.totalErrors}`
                  : worker.note}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent failures</CardTitle>
          <CardDescription>
            Latest failed queue rows across all tenants. Failure mutation stays out of scope here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentFailures.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No failed jobs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">Queue row</th>
                    <th className="px-3 py-2 font-medium">Purpose</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Failed at</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recentFailures.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-3 font-mono text-[11px] text-[var(--muted-foreground)]">
                        {row.id}
                      </td>
                      <td className="px-3 py-3">{row.purpose}</td>
                      <td className="px-3 py-3">{row.toPhone}</td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {row.failedAt?.toLocaleString() ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                        {row.failureReason ?? "No failure reason recorded"}
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
