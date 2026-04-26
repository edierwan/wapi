# Phase 8b — Supervised worker run mode + system-health data hook

This is the manual-test script for the human tester to confirm the
Phase 8b supervised-run path and the new admin system-health page.
Automated parts (`pnpm test:unit`, `pnpm typecheck`, `pnpm build`,
route registration) are confirmed by build output.

## Pre-requisites

- Local checkout with `.env.local` providing `DATABASE_URL`. (Same
  requirement as `pnpm db:seed`.)
- Logged-in `SYSTEM_SUPER_ADMIN` for the `/admin/system-health` browser
  pass.
- Live multi-tenant WhatsApp send is still gated by
  [Request 05](./05-wa-gateway-multitenancy.md). The supervisor and
  health hook are validated independently of that.

## A. One-shot worker run (default mode)

1. `pnpm worker:outbound`
2. Expect:
   - `[worker-outbound] nothing to do` (or a dispatch line if rows are
     queued)
   - process exits with code 0
   - a file appears at `${WAPI_WORKER_HEARTBEAT_DIR:-/tmp/wapi-workers}/outbound.json`
3. `cat` the file. It must contain:
   - `"runMode": "once"`
   - `"totalTicks": 1`
   - a recent `lastTickAt`
4. Repeat for `pnpm worker:followups` → `follow-ups.json` with
   `runMode: once`.

## B. Supervised loop run mode

1. `pnpm worker:outbound:loop` (or
   `WAPI_WORKER_MODE=loop pnpm worker:outbound`).
2. Expect a startup log:
   `[worker-supervisor:outbound] starting supervised loop pid=… interval=15000ms heartbeatDir=…`
3. Watch the heartbeat file every few seconds; `lastTickAt` advances and
   `totalTicks` grows.
4. `Ctrl+C` (SIGINT). Expect:
   `[worker-supervisor:outbound] received SIGINT, stopping after current tick`
   then a clean exit and a final updated heartbeat.
5. Repeat for follow-ups (`pnpm worker:followups:loop`, default
   interval 60s).

## C. Error visibility

1. Temporarily break the worker (e.g. unset `DATABASE_URL`) and run
   `pnpm worker:outbound`.
2. Expect the script to exit with a non-zero code, and the heartbeat
   file to contain `"lastError"` populated and `"totalErrors": 1`.
3. Restore the env. The next successful tick clears `lastError` back to
   `null`.

## D. Admin system-health page

1. Sign in as a system admin and visit `/admin/system-health`.
2. Confirm the page renders (no longer the "Coming soon" placeholder)
   and shows two worker rows: `outbound`, `follow-ups`.
3. Each worker row must show one of:
   - **OK** badge with last-tick age, mode, pid, ticks, errors
   - **STALE** badge when the heartbeat is older than the threshold
     (default 120s)
   - **MISSING** badge when no heartbeat file is present
   - **ERRORED** badge with the recent error in the red callout below
4. The "Outbound queue" card shows live counts read from
   `message_queue` (queued, sending, failed-24h, oldest-queued age).
   When DB is unreachable the card states "Database not reachable in
   this environment" and shows zeros.

## E. Tenant isolation invariant

- `/admin/system-health` is layout-gated by `system.admin.access` in
  `src/app/admin/layout.tsx`. Tenant users must NOT see it.
- The supervisor itself is tenant-agnostic; tenant scoping continues to
  live inside the tick functions (`message_queue` rows already carry
  `tenant_id`, `runAutoTriggers` already iterates tenant-bounded
  sequences). Phase 8b adds no cross-tenant code path.

## F. Smart Customer Memory compatibility (code audit, no UI)

- The supervisor never reads or writes
  `inbound_messages`, `message_queue`, or `customer_memory_*` outside
  the tick functions.
- Heartbeat filesystem layout is keyed on worker name only — no tenant
  identity, no phone number — so future Phase 8c writers can plug in
  via the existing tenant-scoped helpers without supervision changes.

## Out of scope for Phase 8b

- Replacing `message_queue` with a different queue model.
- A multi-channel worker (other channels reuse the supervisor as-is
  when they ship).
- Real production process manager (the supervised loop is intended for
  systemd / Coolify scheduled command / `nohup`-style placement; the
  WAPI repo does not bundle a process supervisor).
- Live multi-tenant WhatsApp send (Request 05).
- Smart Customer Memory writes (Phase 8c).
