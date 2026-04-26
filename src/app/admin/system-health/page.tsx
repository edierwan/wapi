import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSystemHealthSnapshot } from "@/server/system-health";
import { formatAge } from "@/server/worker-supervisor-core";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const snapshot = await getSystemHealthSnapshot();

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">System health</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Worker readiness and outbound queue signals. Cross-tenant.
            Captured at {snapshot.capturedAt.toISOString()}.
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
          <CardTitle className="text-base">Workers</CardTitle>
          <CardDescription>
            Heartbeat-backed status for each supervised worker. Workers
            run via <code>pnpm worker:outbound:loop</code> and{" "}
            <code>pnpm worker:followups:loop</code>, or single-shot via{" "}
            <code>pnpm worker:outbound</code> /{" "}
            <code>pnpm worker:followups</code>. Heartbeat directory:{" "}
            <code>$WAPI_WORKER_HEARTBEAT_DIR</code> (default{" "}
            <code>/tmp/wapi-workers</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {snapshot.workers.map((w) => (
              <li
                key={w.name}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{w.name}</span>
                  <StateBadge state={w.state} />
                  {w.heartbeat ? (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      pid {w.heartbeat.pid} · mode {w.heartbeat.runMode} ·
                      ticks {w.heartbeat.totalTicks} · errors{" "}
                      {w.heartbeat.totalErrors}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] sm:text-right">
                  {w.heartbeat ? (
                    <>
                      last tick{" "}
                      {w.ageMs !== null ? `${formatAge(w.ageMs)} ago` : "n/a"}{" "}
                      · last duration {w.heartbeat.lastDurationMs}ms
                    </>
                  ) : (
                    w.note
                  )}
                </div>
              </li>
            ))}
          </ul>
          {snapshot.workers.some((w) => w.heartbeat?.lastError) ? (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs">
              <p className="mb-1 font-medium">Recent worker errors</p>
              <ul className="space-y-1">
                {snapshot.workers
                  .filter((w) => w.heartbeat?.lastError)
                  .map((w) => (
                    <li key={w.name}>
                      <span className="font-mono">{w.name}</span>:{" "}
                      {w.heartbeat?.lastError}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound queue</CardTitle>
          <CardDescription>
            Aggregate signals across all tenants from{" "}
            <code>message_queue</code>.{" "}
            {snapshot.dbAvailable
              ? "Live."
              : "Database not reachable in this environment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Queued" value={snapshot.queue.queuedCount} />
          <Stat label="Sending" value={snapshot.queue.sendingCount} />
          <Stat
            label="Failed (24h)"
            value={snapshot.queue.failedLast24hCount}
          />
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

      <p className="text-xs text-[var(--muted-foreground)]">
        Phase 8b: minimal supervised-run path + system-health data hook.
        Live multi-tenant WhatsApp send remains gated by Request 05.
      </p>
    </section>
  );
}

function StateBadge({ state }: { state: "ok" | "stale" | "missing" | "errored" }) {
  const label = state === "ok" ? "OK" : state.toUpperCase();
  return <Badge className={stateClass(state)}>{label}</Badge>;
}

function stateClass(state: "ok" | "stale" | "missing" | "errored"): string {
  switch (state) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "stale":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "errored":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    case "missing":
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
