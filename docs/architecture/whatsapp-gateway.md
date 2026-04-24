# WhatsApp gateway — multi-tenant design

## Context

The existing `wa.getouch.co` service (screenshot we currently have) is a
**Baileys-based WhatsApp gateway**. Today it appears to manage a single
session (one QR, one inbox, one test-send form). For WAPI to use it as
our production gateway, the gateway must become **multi-tenant-aware**.

This document describes:

1. The target gateway contract.
2. The data model we already have (`connected_accounts`, `whatsapp_sessions`).
3. What the existing `wa.getouch.co` service needs to change.
4. The migration path (dedicated gateway per tenant later).

---

## Entities in this repo

- `connected_accounts` — logical WhatsApp account owned by a tenant.
  - `tenant_id` (required)
  - `display_name`, `phone_number`
  - `gateway_url` — override the default gateway for this tenant/account;
    `null` means use the system default (`WA_GATEWAY_DEFAULT_URL`).
- `whatsapp_sessions` — 1:1 with a connected account. Holds Baileys
  session status and (opaque) auth payload.
  - `tenant_id`, `account_id` (unique), `status`, `auth_payload`.

Invariants:

- Every account belongs to exactly one tenant.
- One account ↔ one Baileys session.
- One tenant may have many accounts (= many numbers).
- All WAPI queries against WhatsApp data **must** filter by `tenant_id`.

---

## Required gateway contract

The gateway must accept a **session identifier** that is tenant-scoped.
Recommendation: the `whatsapp_sessions.id` (UUID) is the canonical
session key. The gateway treats it as opaque.

Minimum HTTP surface (all requests carry `X-Session-Id: <uuid>` and a
shared API secret header `X-WAPI-Secret`):

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/sessions` | Create a new session. Body: `{ sessionId }`. |
| GET    | `/sessions/:id` | Status (`pending`, `connecting`, `connected`, …). |
| GET    | `/sessions/:id/qr` | Current QR (base64 PNG or data URL), refreshed every ~20s. |
| DELETE | `/sessions/:id` | Logout & destroy. |
| POST   | `/sessions/:id/messages` | Send `{ to, type, text|media }`. |
| POST   | `/sessions/:id/reset` | Reset (keep record, re-pair). |
| GET    | `/health` | `{ status: "ok" }`. |

Webhooks back to WAPI:

- `POST {WAPI_WEBHOOK_URL}/api/wa/events` with `{ sessionId, type, payload, signature }`.
- Events at minimum: `qr`, `connected`, `disconnected`, `message.inbound`, `message.status`.

Security:

- Mutual shared-secret header (`X-WAPI-Secret`) for now.
- HMAC-signed webhook body so WAPI can verify gateway origin.
- Session auth payload lives on the gateway disk; WAPI stores only
  status + opaque JSON if we want hot-failover later.

---

## How WAPI resolves the gateway URL

```
gatewayUrl = connectedAccount.gatewayUrl ?? env.WA_GATEWAY_DEFAULT_URL
```

So:

- MVP: every tenant shares `wa.getouch.co` (set
  `WA_GATEWAY_DEFAULT_URL=https://wa.getouch.co` in Coolify).
- Premium tenant: set `gatewayUrl` on the `connected_accounts` row →
  their traffic goes to a dedicated gateway instance.

---

## What `wa.getouch.co` needs to change

The current UI hints that it is a single-session admin console. To serve
as WAPI's shared gateway we need:

1. **Multiple concurrent sessions**, keyed by UUID (not by global state).
2. **Session-scoped storage** on disk, e.g. `./sessions/<uuid>/auth.json`.
3. **A plain HTTP contract** (see table above) rather than UI-only controls.
4. **Webhook out** to `https://wapi.getouch.co/api/wa/events`.
5. **API auth** via shared secret (`WAPI_SECRET`).
6. The existing admin UI can remain for **debugging only**, but must
   never leak data across sessions.

A dedicated request file captures this as action: see
[`/docs/request/05-wa-gateway-multitenancy.md`](../request/05-wa-gateway-multitenancy.md).

---

## WAPI-side worker (Phase 3+)

Later we extract a `wapi-worker` service that:

- Owns the HTTP calls into the gateway(s).
- Consumes a BullMQ queue for outgoing messages.
- Writes inbound messages / status into `messages` / `message_events`
  tables (Phase 3 schema).
- Updates `whatsapp_sessions.status` in response to webhook events.

For now, Phase 2 only ships the DB tables + UI placeholders. No gateway
calls yet.

---

## Migration path

| Stage | What | Who |
|-------|------|-----|
| 1 (MVP) | Shared `wa.getouch.co`, all tenants | DevOps + WA gateway owner |
| 2 | Per-tenant `gateway_url` override | App |
| 3 | Dedicated gateway containers per big tenant | DevOps |
| 4 | Auto-provision gateway on tenant creation | App + DevOps |
