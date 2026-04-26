# Request #05 — make `wa.getouch.co` multi-tenant

> **To:** owner/maintainer of `wa.getouch.co` (our Baileys WhatsApp gateway).
> **From:** WAPI application.
> **Status:** required before WAPI Phase 3 can send/receive WhatsApp traffic.

## 2026-04-26 Gateway Implementation Attempt

This section tracks the in-flight refactor of `getouch.co/services/wa` from a
single-session Baileys runtime into a real multi-session gateway. WAPI side
contract is already shipped; no further WAPI-side fallback patches are
planned in this round unless a real contract mismatch is discovered during
validation.

### Current blocker

- `getouch.co/services/wa/server.mjs` still owns runtime as one global
  Baileys socket (`let sock = null`), one shared `WA_AUTH_DIR`, and one
  set of module-scoped state variables (`connectionState`, `qrDataUrl`,
  `pairedPhone`, `reconnectTimer`, `authClearing`, `starting`,
  `socketReadyPromise`).
- All `/api/*` endpoints (`/api/status`, `/api/qr-code`,
  `/api/pairing-code`, `/api/send-text`, `/api/send-image`,
  `/api/send-document`, `/api/logout`, `/api/reset`) operate on that one
  global socket.
- Dify auto-reply (`maybeRunDifyAutoReply`) reads the module-level `sock`
  directly.
- Result: starting/resetting/deleting one tenant session would tear down
  every other tenant session sharing the container.

### Goal of this implementation

- Replace module-scoped socket/auth state with a per-session `SessionManager`
  that owns a `Map<sessionId, SessionRuntime>`.
- Each `SessionRuntime` owns its own Baileys socket, auth directory,
  status, QR cache, paired phone, reconnect timer, last error, message
  counters, and recent event ring buffer.
- Add WAPI-compatible `/api/sessions/:id/*` routes guarded by
  `X-WAPI-Secret`.
- Keep legacy `/api/*` endpoints temporarily by routing them through
  `DEFAULT_SESSION_ID` (no hidden global socket).
- Add a signed outbound webhook dispatcher to WAPI for `qr`, `connected`,
  `disconnected`, `message.inbound`, `message.status`.
- Update the admin console so it stops presenting the gateway as a single
  global WhatsApp identity.

### Planned code files to change

- [x] `getouch.co/services/wa/session-manager.mjs` — new. `SessionManager`
      + `SessionRuntime` class. Owns all per-session Baileys state.
- [x] `getouch.co/services/wa/webhook-dispatcher.mjs` — new. HMAC-SHA256
      signed dispatch to `WAPI_WEBHOOK_URL` with in-memory retry queue,
      exponential backoff, 24h drop window.
- [x] `getouch.co/services/wa/server.mjs` — refactored. Removes global
      `sock` / `connectionState` / `pairedPhone` / `qrDataUrl` etc. Routes
      delegate to `SessionManager`. Dify auto-reply now takes
      `(msg, sock, sessionId)` and is per-session.
- [x] `getouch.co/services/wa/ui.mjs` — admin console updated for
      multi-session table + per-session detail.
- [x] `getouch.co/services/wa/.env.example` — new env vars.

### Planned API routes

WAPI session routes (require `X-WAPI-Secret` header):

- [x] `POST   /api/sessions/:id` — start or ensure session, returns
      `{ sessionId, status, qr? }`.
- [x] `GET    /api/sessions/:id/status` — `{ sessionId, status,
      phoneNumber, lastSeenAt, lastError }`.
- [x] `GET    /api/sessions/:id/qr` — `{ sessionId, qr|null, status }`.
- [x] `POST   /api/sessions/:id/reset` — stop, clear only this session's
      auth dir, restart fresh.
- [x] `DELETE /api/sessions/:id` — logout if possible, close socket,
      delete only this session directory.
- [x] `POST   /api/sessions/:id/messages` — send `{ to, type, text|media }`
      using only this session's socket.
- [x] `GET    /api/sessions` — list all sessions for admin/observability.

Aliases (also `X-WAPI-Secret`):

- [x] `POST   /sessions`, `GET /sessions/:id`, `GET /sessions/:id/qr`,
      `POST /sessions/:id/reset`, `DELETE /sessions/:id`,
      `POST /sessions/:id/messages`.
- [x] `GET    /health` — public, returns `{ status: "ok", sessions: <n> }`.

Legacy endpoints (kept; pinned to `DEFAULT_SESSION_ID`, not a hidden
global):

- [x] `/api/status`, `/api/qr-code`, `/api/pairing-code`,
      `/api/send-text`, `/api/send-image`, `/api/send-document`,
      `/api/logout`, `/api/reset` — all wrapped over
      `SessionManager.getOrCreate(DEFAULT_SESSION_ID)`.

### Planned admin UI changes

- [x] Overview: total sessions / connected / pending QR / disconnected /
      messages 24h / webhook failures / default session ID / health.
- [x] Sessions: replace the single global card with a sessions table.
      Columns: `sessionId`, `status`, `phoneNumber`, `lastSeenAt`,
      `messages24h`, `lastError`, `actions`. Actions: view, refresh,
      QR, send test, reset, logout/delete.
- [x] Messages and Events: include `sessionId` column and filter.
- [x] Tools: API docs split into "New multi-session WAPI endpoints" and
      "Legacy single-session endpoints (deprecated)". Curl examples
      include `X-WAPI-Secret`.
- [x] Integrations: show webhook URL, signing enabled, retry queue size,
      last success/failure timestamp.
- [x] Settings: show non-secret config (`SESSIONS_DIR`,
      `DEFAULT_SESSION_ID`, `MAX_CONCURRENT_SESSIONS`, `WAPI_WEBHOOK_URL`).
      `WAPI_SECRET` value never rendered.

### Planned validation commands

Local (no live WhatsApp required):

```bash
# inside getouch.co/services/wa
node --check session-manager.mjs
node --check webhook-dispatcher.mjs
node --check server.mjs
PORT=3099 SESSIONS_DIR=$(mktemp -d) WAPI_SECRET=local-test \
  node server.mjs &
sleep 2
curl -s http://127.0.0.1:3099/health
curl -s -i http://127.0.0.1:3099/api/sessions/test/status   # 401 without secret
curl -s -i -H "X-WAPI-Secret: local-test" \
  -X POST http://127.0.0.1:3099/api/sessions/A
curl -s -i -H "X-WAPI-Secret: local-test" \
  -X POST http://127.0.0.1:3099/api/sessions/B
ls "$SESSIONS_DIR"   # expect A and B subdirectories
curl -s -i -H "X-WAPI-Secret: local-test" \
  -X POST http://127.0.0.1:3099/api/sessions/A/reset
ls "$SESSIONS_DIR"   # B still present
curl -s -i -H "X-WAPI-Secret: local-test" \
  -X DELETE http://127.0.0.1:3099/api/sessions/A
ls "$SESSIONS_DIR"   # B still present, A gone
```

Live (after deploy to `wa.getouch.co`):

```bash
curl https://wa.getouch.co/health
curl -i https://wa.getouch.co/api/sessions/test-session/status \
  -H "X-WAPI-Secret: $WAPI_SECRET"
curl -X POST https://wa.getouch.co/api/sessions/test-session \
  -H "X-WAPI-Secret: $WAPI_SECRET"
curl -X POST https://wa.getouch.co/api/sessions/test-session/reset \
  -H "X-WAPI-Secret: $WAPI_SECRET"
curl -X DELETE https://wa.getouch.co/api/sessions/test-session \
  -H "X-WAPI-Secret: $WAPI_SECRET"
```

### Risks and manual test limits

- Only one real test WhatsApp number is currently available, so a true
  concurrent two-number live test is **pending**. Session isolation,
  per-session directories, secret auth, route routing, UI monitoring,
  and webhook signing are validated without a second live number.
- Persistent retry queue for webhook delivery is **not** implemented in
  this round; the dispatcher uses an in-memory queue with exponential
  backoff and 24h drop window. This is documented as pending.
- `AUTO_START_SESSIONS` defaults to `false` to avoid surprise
  reconnection storms after a container restart. Operators can opt in
  via env. Sessions discovered on disk are listed by the admin UI even
  when not auto-started.
- Legacy `/api/*` endpoints are intentionally kept and pinned to
  `DEFAULT_SESSION_ID=default`. They are marked deprecated in the admin
  Tools page but remain functional so the existing single-tenant
  installation does not break during migration.

### Checklist (this attempt)

- [x] SessionManager + SessionRuntime exists.
- [x] Per-session auth directory under `${SESSIONS_DIR}/${sessionId}` with
      sanitization to block path traversal.
- [x] Reset of session A does not touch session B's files.
- [x] Delete of session A does not touch session B's files.
- [x] `/api/sessions/:id/*` routes implemented with `X-WAPI-Secret` auth.
- [x] `/sessions/:id/*` aliases implemented.
- [x] Legacy `/api/*` endpoints route through `DEFAULT_SESSION_ID`.
- [x] Webhook dispatcher signs each delivery with `X-WA-Signature`.
- [x] Admin UI shows multi-session table.
- [x] Local validation (no live WA): see commands above.
- [~] Live deploy validation: depends on Coolify push.
- [ ] Full concurrent two-number live WhatsApp test (single number on
      hand; explicitly pending).
- [ ] Persistent (disk-backed) webhook retry queue.

### Local validation results (2026-04-26)

Boot command:

```
PORT=3099 SESSIONS_DIR=/tmp/wa-test-sessions WAPI_SECRET=local-test \
  AUTO_START_DEFAULT_SESSION=false AUTO_START_SESSIONS=false \
  WA_API_KEY=test-api-key WA_ADMIN_KEY=test-admin DATABASE_URL= \
  node services/wa/server.mjs
```

Verified:

- `GET /health` returns `200` with `sessions`, `defaultSessionId`,
  `webhook` snapshot, and the legacy `whatsapp` field for backward
  compatibility.
- `GET /api/sessions/abc/status` without `X-WAPI-Secret` → `401`
  `{ error: { code: "UNAUTHORIZED", message: "Missing or invalid WAPI
  secret" } }`.
- Same with a wrong secret → `401`.
- `POST /api/sessions/sess-A` → `200`,
  `{ sessionId: "sess-A", status: "pending", qr: null }`.
  `POST /api/sessions/sess-B` → `200`.
  `ls /tmp/wa-test-sessions` → `default`, `sess-A`, `sess-B`.
- `POST /api/sessions/sess-A/reset` → `200`. After reset:
  `default`, `sess-A`, `sess-B` still present (only sess-A's contents
  cleared).
- `DELETE /api/sessions/sess-A` → `200 { ok: true, existed: true }`.
  After delete: only `default` and `sess-B` remain.
- Legacy `GET /api/status` (with `X-API-Key`) returns the default
  session's view, with `sessionId: "default"`, `deprecated: true`,
  and a `deprecationNote` pointing operators to
  `/api/sessions/:id/status`.
- Path-traversal probe `POST /api/sessions/..%2Fevil` → `400`
  `{ error: { code: "BAD_REQUEST", message: "Invalid sessionId format" } }`.
- `POST /api/sessions/sess-B/messages` while not connected → `503`
  `{ error: { code: "NOT_CONNECTED", message: "Session not connected" } }`.
- HMAC-SHA256 of canonical body
  `{"sessionId":"A","type":"qr","payload":{},"timestamp":"2026-04-26T00:00:00Z"}`
  with secret `local-test` is
  `5fbb468d0d5e53c5557db289244cc64d765ea50aa9a9cbbd75d58b529ade49a1`
  (matches WAPI's verification rule of HMAC over the exact raw body).

### Files changed in this round

- `getouch.co/services/wa/session-manager.mjs` — new
- `getouch.co/services/wa/webhook-dispatcher.mjs` — new
- `getouch.co/services/wa/server.mjs` — refactored to use SessionManager;
  legacy `/api/*` routes pinned to `DEFAULT_SESSION_ID`; new admin
  endpoints `/admin/sessions[...]` and `/admin/settings-public`.
- `getouch.co/services/wa/ui.mjs` — new "Multi-tenant Sessions" panel
  with table + actions, summary chips, and 5s auto-refresh.
- `getouch.co/services/wa/.env.example` — documents
  `WAPI_SECRET`, `WAPI_WEBHOOK_URL`, `SESSIONS_DIR`,
  `DEFAULT_SESSION_ID`, `MAX_CONCURRENT_SESSIONS`,
  `AUTO_START_DEFAULT_SESSION`, `AUTO_START_SESSIONS`.
- `getouch.co/compose.yaml` — wires the new env vars; `SESSIONS_DIR`
  defaults to `/app/data/sessions` so the existing
  `/data/getouch/wa:/app/data` Coolify volume keeps working without
  a volume change. The existing `/app/data/auth` content is auto-migrated
  into `/app/data/sessions/default` on first boot to preserve the
  current single-tenant pairing.

### Deployment / Coolify notes

- Set `WAPI_SECRET` and `WAPI_WEBHOOK_URL` in Coolify env. Without
  `WAPI_SECRET` the gateway returns `503 NOT_CONFIGURED` for every
  `/api/sessions/*` request — by design, so the gateway never silently
  accepts unauthenticated multi-session traffic.
- The existing persistent volume (`/data/getouch/wa:/app/data`) remains
  the canonical session store. `SESSIONS_DIR` is set to
  `/app/data/sessions` via compose; the literal `/data/sessions` path
  from the Request 05 spec is supported for greenfield deploys via the
  env override.
- Auto-start of the default session is on by default to keep current
  single-tenant operation working. Set
  `AUTO_START_DEFAULT_SESSION=false` to opt out.
- Auto-start of every session discovered on disk is **off** by default
  to avoid a reconnect storm after a container restart. Set
  `AUTO_START_SESSIONS=true` to opt in.

### 2026-04-26 Live deployment fix (round 2)

After the first push (commit `22988ed` on `getouch.co` `main`),
`https://wa.getouch.co` was still serving the old single-session UI and
`/api/sessions/*` routes returned `404`. Investigation found the root
cause was **not** missing code — it was the deployment topology:

1. `wa.getouch.co` is **not** managed by Coolify. Coolify on the same
   host builds the Next.js app at `getouch.co` only. The WA gateway is
   deployed via a manual `docker compose` project at
   `/home/deploy/apps/getouch.co/compose.yaml` on `100.84.14.93`.
2. That manual checkout was on `main` but stuck at commit `36ecee3`,
   with significant un-pushed local hotfixes to `services/wa/server.mjs`
   (+541 LoC) and `services/wa/db.mjs` (+186 LoC).
3. Even after fetching `origin/main` and replacing the WA service files,
   the `services/wa/Dockerfile` only copied
   `server.mjs db.mjs ui.mjs` into the image — so the new
   `session-manager.mjs` and `webhook-dispatcher.mjs` were silently
   excluded from the build.

Fix steps applied on `100.84.14.93`:

- Backup of pre-change WA files saved to
  `/home/deploy/backups/wa-pre-multisession-20260426-155326/`
  (includes `server.mjs.diff` and `db.mjs.diff` of the local hotfixes
  for traceability).
- `git fetch origin && git checkout origin/main -- services/wa/server.mjs
  services/wa/.env.example services/wa/ui.mjs
  services/wa/session-manager.mjs services/wa/webhook-dispatcher.mjs`.
- `services/wa/db.mjs` left at the server-local revision (still
  contains the un-pushed db hotfixes; the new `server.mjs` only imports
  symbols already exported by that file).
- `services/wa/Dockerfile` patched to also COPY `session-manager.mjs`
  and `webhook-dispatcher.mjs`.
- `compose.yaml` patched in-place to add the new env block under the
  `wa` service (kept `SESSIONS_DIR=/app/data/sessions` so the existing
  `/data/getouch/wa:/app/data` volume keeps working).
- `.env` extended with a freshly generated 64-hex `WAPI_SECRET`,
  `WAPI_WEBHOOK_URL=https://wapi.getouch.co/api/wa/events`, and the
  matching `SESSIONS_DIR / DEFAULT_SESSION_ID / MAX_CONCURRENT_SESSIONS
  / AUTO_START_DEFAULT_SESSION / AUTO_START_SESSIONS` values.
- `docker compose build --no-cache wa && docker compose up -d
  --force-recreate wa`. New image
  `sha256:b947901ddf59…` started cleanly.
- The new server logged
  `Migrated legacy auth dir from /app/data/auth to /app/data/sessions/default`
  and the `default` session reconnected as `60192277233` without
  re-pairing. Confirmed live phone unaffected.

The local Dockerfile fix is also applied in the `getouch.co` git repo so
future builds on any host include the new files.

### Live validation against `wa.getouch.co` (2026-04-26, post-deploy)

All checks executed against the public origin
(Cloudflare → Caddy → `getouch-wa:3001`), not via container shortcut.

```
GET /health
  HTTP 200
  body: {"status":"ok","sessions":2,"defaultSessionId":"default",
         "defaultStatus":"connected","defaultPhone":"60192277233",
         "whatsapp":"connected","webhook":{...}}

GET /api/sessions/default/status   (no header)
  HTTP 401  {"error":{"code":"UNAUTHORIZED",
                      "message":"Missing or invalid WAPI secret"}}

GET /api/sessions/default/status   (X-WAPI-Secret: <wrong>)
  HTTP 401  same error body

GET /api/sessions/default/status   (X-WAPI-Secret: <correct>)
  HTTP 200  {sessionId:"default", status:"connected",
             phoneNumber:"60192277233", messages24h:{...}, ...}

POST /api/sessions/test-live       (X-WAPI-Secret: <correct>)
  HTTP 200  {sessionId:"test-live", status:"connecting",
             qr:"data:image/png;base64,iVBORw0…"}

POST /api/sessions/..%2Fevil       (X-WAPI-Secret: <correct>)
  HTTP 400  {"error":{"code":"BAD_REQUEST",
                      "message":"Invalid sessionId format"}}

DELETE /api/sessions/test-live     (X-WAPI-Secret: <correct>)
  HTTP 200  {"ok":true,"existed":true}
```

Admin UI:

- `GET https://wa.getouch.co/` returns ~85 KB HTML containing
  `Multi-tenant Sessions` panel header, the `loadSessions()` JS,
  and 18 multi-session related markers.
- Operator can now browse sessions, view per-session QR, reset, and
  delete from the admin console.

### Status after live fix

- `default` session: connected (phone `60192277233`).
- `test-live` second session: created, reached `connecting` and emitted
  a real QR data URL (proving the per-session Baileys socket boot path
  works on prod). Then deleted cleanly without disturbing `default`.
- Webhook dispatcher: enabled and pointing at
  `https://wapi.getouch.co/api/wa/events`. **WAPI must mirror
  `WAPI_SECRET`** (the secret is in `/home/deploy/apps/getouch.co/.env`
  on the deploy host) so it can verify `X-WA-Signature` HMACs.

### Still pending after this fix

- Full concurrent two-real-number live test (only one paired number on
  hand). The second slot has been proven via the `test-live` QR scan
  path but no second real number was paired during this round.
- Persistent disk-backed webhook retry queue. The dispatcher still
  retries in-memory only (5 s → 1 h, drop after 24 h). Out of scope
  for this round to keep the live fix small and reversible.
- Wire `WAPI_SECRET` into the WAPI app environment so `wa-gateway.ts`
  presents the matching header when calling
  `/api/sessions/:accountId/*`.

## 2026-04-26 Implementation Plan / Status

- Status: still blocked at the gateway layer.
- Verified against local gateway source: `getouch.co/services/wa/server.mjs` still runs one module-scoped Baileys socket (`let sock = null`) and one shared auth directory (`WA_AUTH_DIR` / `AUTH_DIR`).
- Result: the WAPI-side contract is already in place, but `wa.getouch.co` still cannot safely host multiple tenant/account sessions concurrently.

### Already delivered on WAPI side

- Per-account gateway client contract in `src/server/wa-gateway.ts` using session-scoped endpoints:
  - `POST /api/sessions/:accountId`
  - `GET /api/sessions/:accountId/status`
  - `GET /api/sessions/:accountId/qr`
  - `POST /api/sessions/:accountId/reset`
  - `DELETE /api/sessions/:accountId`
- Tenant-owned `connected_accounts` and `whatsapp_sessions` rows already exist.
- Gateway webhook receivers already exist for `qr`, `connected`, and `disconnected` events.
- Tenant WhatsApp UI already handles gateway errors without crashing.

### Missing on gateway side

- Session manager keyed by `sessionId` / WAPI `accountId`, not one global socket.
- Per-session auth storage, e.g. `/data/sessions/<sessionId>/...`.
- WAPI-compatible `/api/sessions/*` endpoints.
- Session-scoped send routes that require `sessionId` instead of using one global connection.
- Webhook dispatcher back into WAPI with shared-secret/HMAC verification.
- Admin console update so operators can inspect many sessions without cross-session confusion.

### Required implementation order in `wa.getouch.co`

- 1. Extract a `SessionManager` inside `services/wa`.
  - Maintain `Map<sessionId, SessionRuntime>`.
  - Each runtime owns its own socket, connection state, QR cache, paired phone, auth directory, reconnect timer, and event history.
- 2. Move shared globals into per-session runtime state.
  - Replace global `sock`, `connectionState`, `pairedPhone`, `qrDataUrl`, reconnect timers, and auth-clearing flags.
- 3. Add new WAPI contract routes.
  - `POST /api/sessions/:id`
  - `GET /api/sessions/:id/status`
  - `GET /api/sessions/:id/qr`
  - `POST /api/sessions/:id/reset`
  - `DELETE /api/sessions/:id`
  - `POST /api/sessions/:id/messages`
- 4. Keep legacy single-session routes temporarily as compatibility wrappers.
  - `/api/status`, `/api/qr-code`, `/api/pairing-code`, `/api/send-text`, `/api/logout`, `/api/reset`
  - Mark them deprecated and pin them to one explicit default session only.
- 5. Add webhook fan-out into WAPI.
  - `qr`
  - `connected`
  - `disconnected`
  - `message.inbound`
  - `message.status`
- 6. Update the admin UI.
  - Add a sessions list and session detail view.
  - Stop presenting the gateway as if it owns one global WhatsApp identity.

### Current execution note

- This request is still the controlling blocker for real tenant WhatsApp connection tests on `wapi-dev`.
- WAPI admin/testing support can continue in parallel, but real connect/send/receive across multiple tenant-owned numbers cannot be called complete until the gateway code above is shipped and deployed.

## 2026-04-25 Live assessment

- Status: hard fail, not green.
- The deployed gateway at `wa.getouch.co` is still single-session:
  - module-scoped connection state and one shared Baileys socket
  - one shared auth directory rather than per-session storage
  - no `/sessions/*` API surface
  - no `X-WAPI-Secret` shared-secret contract
  - no webhook delivery back into WAPI
- The current admin console and `/api/*` endpoints are still useful for one number,
  but they do not satisfy the multi-tenant contract this request requires.
- Result: WAPI Phase 3/4 platform checks can proceed for UI/auth/business-profile work,
  but WhatsApp session orchestration is still blocked on this request.

## Why

The current gateway UI appears to manage **one** WhatsApp session
globally. WAPI is multi-tenant — many tenants, each with potentially
many WhatsApp numbers — so the gateway must scope every operation to a
**session ID** provided by WAPI.

Design reference: [`/docs/architecture/whatsapp-gateway.md`](../architecture/whatsapp-gateway.md).

## Actions requested

Please deliver the following, in order:

### 1. Session-scoped storage

- Each session gets its own Baileys auth state, e.g. `./sessions/<sessionId>/auth.json`.
- Starting/stopping one session never touches another.
- No shared globals — in particular no single `sock` at module scope.

### 2. HTTP API (JSON, shared secret)

Accept header `X-WAPI-Secret: <long random string>` on all endpoints.

| Method | Path | Body / Notes |
|--------|------|--------------|
| POST   | `/sessions`          | `{ sessionId }` — start a new session (returns `{ status, qr? }`). |
| GET    | `/sessions/:id`      | `{ sessionId, status, phoneNumber?, lastSeenAt? }` |
| GET    | `/sessions/:id/qr`   | `{ qr: "data:image/png;base64,..." }` while pending |
| DELETE | `/sessions/:id`      | Logout + destroy session files |
| POST   | `/sessions/:id/reset`| Keep row, clear auth, show new QR |
| POST   | `/sessions/:id/messages` | `{ to, type: "text"|"image"|"document", text?, media? }` |
| GET    | `/health`            | `{ status: "ok" }` |

All responses JSON. Non-2xx = error object `{ error: { code, message } }`.

### 3. Webhook out to WAPI

- Target: `POST https://wapi.getouch.co/api/wa/events` (we will add this route).
- Body: `{ sessionId, type, payload, timestamp }`.
- Header: `X-WA-Signature: <hmac-sha256 of body using WAPI_SECRET>`.
- Events required: `qr`, `connected`, `disconnected`, `message.inbound`, `message.status`.
- Retry with exponential backoff; drop after 24h.

### 4. Admin UI (optional, internal only)

- Existing UI may remain for debugging, but must also require the
  shared secret to be useful.
- UI should list sessions by UUID — **not** show data across sessions on
  a single dashboard to humans by default.

### 5. Config

Expose via env:

- `WAPI_SECRET` (shared secret, set matching value in WAPI's Coolify env).
- `WAPI_WEBHOOK_URL=https://wapi.getouch.co/api/wa/events`
- `SESSIONS_DIR=/data/sessions` (persistent volume).
- Optional: `MAX_CONCURRENT_SESSIONS`.

### 6. Hosting note

For MVP, one `wa.getouch.co` container serves **all** tenants. On
Coolify, make sure the sessions directory is a **persistent volume**
so QR pairings survive restarts.

## What WAPI will do on our side

- Store `sessionId` (= `whatsapp_sessions.id`) and `gateway_url` per
  connected account. Default gateway URL is `https://wa.getouch.co`.
- Call the gateway only via a server-side worker.
- Verify webhook HMAC before acting on events.

## Timeline

Not required for Phase 2 ship (Phase 2 is schema + UI shells only).
Required before Phase 3 ("inbox + send message") begins.
