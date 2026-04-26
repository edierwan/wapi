/**
 * Outbound message worker.
 *
 * Run modes (Phase 8b):
 *   pnpm worker:outbound           # one-shot tick (default)
 *   WAPI_WORKER_MODE=loop pnpm worker:outbound
 *                                  # supervised loop with heartbeat
 *   pnpm worker:outbound:loop      # convenience for the above
 *
 * Loop responsibilities:
 *   1. SELECT message_queue rows where status='queued' AND scheduled_at <= now()
 *      with a small batch size and FOR UPDATE SKIP LOCKED-style discipline
 *      (Drizzle does not expose row locks portably; we rely on a
 *      transactional `UPDATE … RETURNING` pattern below).
 *   2. For each row, dispatch via `wa-gateway.ts#sendText` using accountId
 *      as the gateway session id.
 *   3. On success, mark status='sending' and let the gateway's status
 *      webhook (`/api/wa/webhooks/status`) advance to sent/delivered/read.
 *   4. On failure, increment attempts; mark failed when attempts>=max.
 *
 * Safety:
 *   - Tenant scoping is implicit: every row already carries tenant_id +
 *     account_id, and accountId fully determines the gateway session.
 *   - We NEVER read or write rows for a different tenant than the row owns.
 *   - We do NOT mutate connected_accounts or whatsapp_sessions here.
 *
 * Live-send is still gated by Request 05 (gateway multi-tenancy). Until
 * that lands, ticks no-op against an empty queue and the heartbeat is
 * still useful for ops visibility.
 */

import { and, eq, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { sendText } from "@/server/wa-gateway";
import { checkAndReserve } from "@/server/outbound-rate-limit";
import { runSupervised } from "@/server/worker-supervisor";

const BATCH_SIZE = 10;

type Row = typeof schema.messageQueue.$inferSelect;

async function claimBatch(): Promise<Row[]> {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  // Peek at queued rows whose schedule has arrived. We do NOT flip the
  // status until rate-limit reservation passes, so a throttled row stays
  // queued and is retried on the next worker tick.
  const candidates = await db
    .select()
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.status, "queued"),
        lte(schema.messageQueue.scheduledAt, sql`now()`),
      ),
    )
    .limit(BATCH_SIZE * 4);

  const claimed: Row[] = [];
  // Track per-account remaining minute budget across this batch so we
  // do not over-issue when many candidates share an account.
  const remainingByAccount = new Map<string, number>();

  for (const row of candidates) {
    if (claimed.length >= BATCH_SIZE) break;
    if (!row.accountId) {
      // A row without an account cannot pass tenant/account guard later.
      // Flip it to sending so dispatchOne records the deterministic
      // "no accountId" failure (preserves existing behavior).
      const [bumped] = await db
        .update(schema.messageQueue)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(schema.messageQueue.id, row.id))
        .returning();
      if (bumped) claimed.push(bumped);
      continue;
    }

    let remaining = remainingByAccount.get(row.accountId);
    if (remaining === undefined) {
      const decision = await checkAndReserve(row.accountId);
      if (!decision.ok) {
        remainingByAccount.set(row.accountId, 0);
        continue;
      }
      remaining = decision.remainingMinute;
    }
    if (remaining <= 0) continue;
    remainingByAccount.set(row.accountId, remaining - 1);

    const [bumped] = await db
      .update(schema.messageQueue)
      .set({ status: "sending", updatedAt: new Date() })
      .where(
        and(
          eq(schema.messageQueue.id, row.id),
          eq(schema.messageQueue.status, "queued"),
        ),
      )
      .returning();
    if (bumped) claimed.push(bumped);
  }

  return claimed;
}

async function dispatchOne(row: Row) {
  const db = getDb();
  if (!db) throw new Error("DB not available");

  if (!row.accountId) {
    await db
      .update(schema.messageQueue)
      .set({
        status: "failed",
        failedAt: new Date(),
        failureReason: "no accountId on queue row",
        updatedAt: new Date(),
      })
      .where(eq(schema.messageQueue.id, row.id));
    return;
  }

  // Per-account gateway override (tenants on a different gateway shard).
  const [acc] = await db
    .select({
      gatewayUrl: schema.connectedAccounts.gatewayUrl,
      tenantId: schema.connectedAccounts.tenantId,
    })
    .from(schema.connectedAccounts)
    .where(eq(schema.connectedAccounts.id, row.accountId))
    .limit(1);

  // Tenant invariant: the account must belong to the same tenant as the queue row.
  if (!acc || acc.tenantId !== row.tenantId) {
    await db
      .update(schema.messageQueue)
      .set({
        status: "failed",
        failedAt: new Date(),
        failureReason: "tenant/account mismatch",
        updatedAt: new Date(),
      })
      .where(eq(schema.messageQueue.id, row.id));
    return;
  }

  const result = await sendText({
    accountId: row.accountId,
    gatewayUrl: acc.gatewayUrl,
    toPhone: row.toPhone,
    text: row.bodyText ?? "",
    purpose: row.purpose,
    externalRef: row.id,
  });

  if (!result.ok) {
    const nextAttempts = row.attempts + 1;
    const finalFail = nextAttempts >= row.maxAttempts;
    await db
      .update(schema.messageQueue)
      .set({
        status: finalFail ? "failed" : "queued",
        attempts: nextAttempts,
        failureReason: result.error.slice(0, 500),
        failedAt: finalFail ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.messageQueue.id, row.id));
  }
  // On success: leave status='sending'. Status webhook will advance it.
}

async function tick() {
  const rows = await claimBatch();
  if (rows.length === 0) {
    console.log("[worker-outbound] nothing to do");
    return { counts: { claimed: 0, dispatched: 0, errored: 0 } };
  }
  console.log(`[worker-outbound] dispatching ${rows.length} message(s)`);
  let errored = 0;
  for (const row of rows) {
    try {
      await dispatchOne(row);
    } catch (err) {
      errored += 1;
      console.error(`[worker-outbound] row ${row.id} failed:`, err);
    }
  }
  return { counts: { claimed: rows.length, dispatched: rows.length - errored, errored } };
}

if (require.main === module) {
  const runMode = process.env.WAPI_WORKER_MODE === "loop" ? "loop" : "once";
  const intervalMs = Number.parseInt(
    process.env.WAPI_WORKER_INTERVAL_MS ?? "15000",
    10,
  );
  runSupervised({
    name: "outbound",
    tick,
    runMode,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 15_000,
  }).then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
