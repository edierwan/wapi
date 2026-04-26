/**
 * Follow-up sequence auto-trigger pass (cron-style, manual run).
 *
 * Run manually:
 *   pnpm tsx scripts/follow-up-executor.ts
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
 *
 * This script is intentionally not wired into a long-running daemon
 * yet. Operators run it manually until the live worker harness lands.
 */

import { runAutoTriggers } from "@/server/follow-up-executor";

async function main() {
  const result = await runAutoTriggers();
  console.log(
    `[follow-up-executor] scanned ${result.sequencesScanned} sequence(s), enrolled ${result.enrolled} contact(s)`,
  );
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
