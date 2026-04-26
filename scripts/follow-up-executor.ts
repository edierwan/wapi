/**
 * Follow-up sequence auto-trigger pass.
 *
 * Run modes (Phase 8b):
 *   pnpm worker:followups          # one-shot tick (default)
 *   WAPI_WORKER_MODE=loop pnpm worker:followups
 *                                  # supervised loop with heartbeat
 *   pnpm worker:followups:loop     # convenience for the above
 *
 * Behavior:
 *   - Scans every active follow-up sequence across all tenants.
 *   - For each sequence, finds eligible contacts based on trigger:
 *       no_reply    : inbound in [24h, 72h] window, not yet enrolled
 *       hot_lead    : contacts.lead_status='hot'
 *       new_contact : contacts created in the last 24h
 *       custom      : operator-driven (no auto enrollment)
 *   - For each eligible contact, enrolls into the sequence (idempotent
 *     via message_queue.payload->>sequenceId check).
 *
 * Tenant safety:
 *   - The executor calls tenant-scoped helpers; it never queries across
 *     tenants without a `tenant_id` filter.
 *   - Each sequence already carries its tenant_id, so iteration is
 *     naturally tenant-bounded.
 */

import { runAutoTriggers } from "@/server/follow-up-executor";
import { runSupervised } from "@/server/worker-supervisor";

async function tick() {
  const result = await runAutoTriggers();
  console.log(
    `[follow-up-executor] scanned ${result.sequencesScanned} sequence(s), enrolled ${result.enrolled} contact(s)`,
  );
  return {
    counts: {
      sequencesScanned: result.sequencesScanned,
      enrolled: result.enrolled,
    },
  };
}

if (require.main === module) {
  const runMode = process.env.WAPI_WORKER_MODE === "loop" ? "loop" : "once";
  const intervalMs = Number.parseInt(
    process.env.WAPI_WORKER_INTERVAL_MS ?? "60000",
    10,
  );
  runSupervised({
    name: "follow-ups",
    tick,
    runMode,
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60_000,
  }).then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
