/**
 * Outbound message worker (skeleton — NOT YET RUNNING IN PRODUCTION).
 *
 * Run manually:
 *   pnpm tsx scripts/worker-outbound.ts
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
 * This file is intentionally not wired into a long-running process yet.
 * The live operator (Phase 6 live behavior) is gated by Request 05
 * (gateway multi-tenancy) and Phase 7 (campaign/safety controls).
 */

import { and, eq, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { sendText } from "@/server/wa-gateway";
import { checkAndReserve } from "@/server/outbound-rate-limit";

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

async function main() {
  const rows = await claimBatch();
  if (rows.length === 0) {
    console.log("[worker-outbound] nothing to do");
    return;
  }
  console.log(`[worker-outbound] dispatching ${rows.length} message(s)`);
  for (const row of rows) {
    try {
      await dispatchOne(row);
    } catch (err) {
      console.error(`[worker-outbound] row ${row.id} failed:`, err);
    }
  }
}

if (require.main === module) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
