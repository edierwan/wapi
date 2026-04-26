/**
 * System-health data hook.
 *
 * Phase 8b deliverable: a small, admin-side read model that combines
 * worker heartbeats (filesystem-backed) with queue depth signals
 * (database-backed) into one snapshot the admin UI can render.
 *
 * Tenant scoping note: this surface is intentionally cross-tenant. It
 * is gated by the `/admin/**` layout, which already requires the
 * `system.admin.access` permission. Tenants never see this data.
 *
 * Future-channel note: queue depth is computed from `message_queue`,
 * which is the existing single transport queue. If/when other channels
 * land their own queues, each gets its own depth probe and merges into
 * `queueSignals`. We do not pre-create a fake multi-channel abstraction
 * here.
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import {
  classifyHeartbeat,
  type WorkerStatus,
} from "./worker-supervisor-core";
import { readAllHeartbeats } from "./worker-supervisor";

export const EXPECTED_WORKERS = ["outbound", "follow-ups"] as const;
export type ExpectedWorkerName = (typeof EXPECTED_WORKERS)[number];

export type QueueSignals = {
  queuedCount: number;
  sendingCount: number;
  failedLast24hCount: number;
  oldestQueuedAgeMs: number | null;
};

export type SystemHealthSnapshot = {
  capturedAt: Date;
  workers: WorkerStatus[];
  queue: QueueSignals;
  /** True when DB is available and queue signals were read live. */
  dbAvailable: boolean;
};

/**
 * Build the admin-side health snapshot. Safe to call from a server
 * component on the admin page; never throws — degraded environments
 * (no DB / no heartbeat dir) just produce a snapshot with `missing`
 * worker entries and zeroed queue signals.
 */
export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const now = new Date();
  const heartbeats = await readAllHeartbeats().catch(() => []);
  const byName = new Map(heartbeats.map((h) => [h.name, h] as const));
  const workers: WorkerStatus[] = EXPECTED_WORKERS.map((name) =>
    classifyHeartbeat(byName.get(name) ?? null, name, now),
  );

  const queue = await readQueueSignals();

  return {
    capturedAt: now,
    workers,
    queue: queue.signals,
    dbAvailable: queue.dbAvailable,
  };
}

async function readQueueSignals(): Promise<{
  signals: QueueSignals;
  dbAvailable: boolean;
}> {
  const db = getDb();
  if (!db) {
    return {
      dbAvailable: false,
      signals: {
        queuedCount: 0,
        sendingCount: 0,
        failedLast24hCount: 0,
        oldestQueuedAgeMs: null,
      },
    };
  }

  try {
    const rowsResult = await db.execute<{
      queued_count: string | number;
      sending_count: string | number;
      failed_24h_count: string | number;
      oldest_queued_at: string | null;
    }>(sql`
      select
        count(*) filter (where status = 'queued')::bigint as queued_count,
        count(*) filter (where status = 'sending')::bigint as sending_count,
        count(*) filter (
          where status = 'failed' and failed_at > now() - interval '24 hours'
        )::bigint as failed_24h_count,
        min(scheduled_at) filter (where status = 'queued') as oldest_queued_at
      from ${schema.messageQueue}
    `);

    const rows = Array.isArray(rowsResult)
      ? (rowsResult as { queued_count: string | number; sending_count: string | number; failed_24h_count: string | number; oldest_queued_at: string | null }[])
      : ((rowsResult as { rows: { queued_count: string | number; sending_count: string | number; failed_24h_count: string | number; oldest_queued_at: string | null }[] }).rows ?? []);
    const r = rows[0];
    if (!r) {
      return {
        dbAvailable: true,
        signals: {
          queuedCount: 0,
          sendingCount: 0,
          failedLast24hCount: 0,
          oldestQueuedAgeMs: null,
        },
      };
    }

    const oldest = r.oldest_queued_at ? new Date(r.oldest_queued_at) : null;
    const oldestQueuedAgeMs = oldest
      ? Math.max(0, Date.now() - oldest.getTime())
      : null;

    return {
      dbAvailable: true,
      signals: {
        queuedCount: Number(r.queued_count) || 0,
        sendingCount: Number(r.sending_count) || 0,
        failedLast24hCount: Number(r.failed_24h_count) || 0,
        oldestQueuedAgeMs,
      },
    };
  } catch (err) {
    console.error("[system-health] queue probe failed:", err);
    return {
      dbAvailable: false,
      signals: {
        queuedCount: 0,
        sendingCount: 0,
        failedLast24hCount: 0,
        oldestQueuedAgeMs: null,
      },
    };
  }
}

// Avoid the unused-import warning for `and` / `eq` if the helper is
// trimmed in the future. They are imported alongside `sql` for symmetry
// with other admin readers in this repo and may be needed if the query
// gains tenant-aware filters later.
void and;
void eq;
