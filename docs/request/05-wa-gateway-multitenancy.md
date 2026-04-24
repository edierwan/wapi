# Request #05 — make `wa.getouch.co` multi-tenant

> **To:** owner/maintainer of `wa.getouch.co` (our Baileys WhatsApp gateway).
> **From:** WAPI application.
> **Status:** required before WAPI Phase 3 can send/receive WhatsApp traffic.

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
