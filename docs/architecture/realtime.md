# Realtime (inbox + live status)

Where we need push-to-browser:

- Inbox: new inbound messages appear without refresh.
- WhatsApp session: QR / connected / disconnected status.
- Campaign runs: progress bar, send counters.
- Queue health: job state transitions in admin.

## Transport decision

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Postgres LISTEN/NOTIFY → SSE** | No extra infra; transactional (publish in same tx as insert). Simple. | Single-process listener needed per app replica; payload size cap (~8KB). | **MVP (Phase 7)** |
| Redis pub/sub → SSE | Fan-out across replicas; unlimited payloads. | Extra infra dependency. | Phase 9+ when we add Redis for BullMQ |
| WebSocket | Bidirectional. | Heavier infra (sticky sessions, load balancer config, Coolify reverse proxy tweaks). | Only when bidirectional truly needed — Phase 10 for live-collaboration features |
| Polling (10s) | Trivial. | Ugly, wasteful. | Fallback if SSE fails. |

**Decision**: **Postgres LISTEN/NOTIFY + Server-Sent Events** for MVP
realtime. Upgrade to Redis pub/sub when BullMQ lands in Phase 6.

## Pattern

```
 app write (e.g. INSERT inbox_messages) ───┐
        │  same transaction                │
        ▼                                  │
  NOTIFY tenant_{tenantId}, '{"type":"inbox.message.new","id":"..."}'
        │
        ▼
  PG publishes to all listeners
        │
        ▼
  Next.js route /t/{slug}/inbox/stream (SSE endpoint) is subscribed to
  its tenant's channel → forwards events to the browser
        │
        ▼
  Browser receives, patches in-memory store, UI updates
```

## Channel naming

- Per-tenant: `tenant_{tenantId}` — subscribed only after
  membership+permission check. **Never** let a client name their own channel.
- System-wide: `system_health`, `admin_alerts` — admin UI only.

## Payload shape

Keep payloads tiny — under 4KB to stay well within PG 8KB cap. Include
only **IDs + type**. Client fetches full record via REST.

```json
{ "v": 1, "type": "inbox.message.new", "threadId": "uuid", "messageId": "uuid", "at": 1718800000 }
```

Event catalog (v1):

| type | emitted by | payload keys |
|---|---|---|
| `inbox.message.new` | inbox ingest | threadId, messageId |
| `inbox.thread.updated` | assignment, status change | threadId |
| `wa.session.status` | gateway webhook processor | accountId, status |
| `wa.session.qr` | gateway webhook processor | accountId |
| `campaign.progress` | send worker | campaignId, sent, total |
| `campaign.finished` | send worker | campaignId |

## SSE endpoint

`GET /t/{slug}/events` (SSE):
1. `getCurrentUser` + `resolveTenantBySlug` — rejects if no member.
2. Acquires a PG client from a **dedicated LISTEN pool** (the default
   Drizzle pool must not be used; LISTEN holds the connection).
3. `LISTEN tenant_{tenantId}`.
4. Pipes each notification to the SSE stream.
5. Heartbeat comment every 25s to keep proxies happy.
6. On disconnect: `UNLISTEN` + release client.

Client uses `EventSource` in Phase 7; on disconnect, exponential backoff reconnect.

## Coolify / proxy notes

- Nixpacks Next.js server handles SSE out of the box.
- Coolify's Traefik must have `buffering=false` and long read timeouts
  (≥ 300s) on the app's route. Documented in
  [coolify.md](../deployment/coolify.md).

## Failure modes & mitigations

- **PG connection dropped**: client reconnects; on reconnect, client
  asks `GET /t/{slug}/inbox?since=<cursor>` to backfill missed messages.
- **Multiple Next.js replicas**: every replica runs its own LISTEN; PG
  fans out notifications to all. No client affinity needed.
- **Missed NOTIFY due to transaction rollback**: we always emit NOTIFY
  inside the same transaction as the write — if the tx rolls back, the
  NOTIFY never fires. This is correct.

## Phase

- Phase 5: wire a trivial `wa.session.status` notifier (1 channel, no UI subscribe yet).
- Phase 7: real SSE endpoint + inbox wiring.
- Phase 9: Redis pub/sub for BullMQ events, admin console streams.
