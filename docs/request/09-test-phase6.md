# 09 — Test plan: Phase 6 (WhatsApp gateway integration — multi-tenant)

> Phase 6 wires the `wa.getouch.co` gateway into the multi-tenant data model.
> The user-facing surfaces still ship over later phases, but Phase 6
> establishes the **outbound queue**, the **inbound message log**, and the
> contracts the gateway and the workers will use.

## 0 · Where to test

| Env | URL | DB |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` | `wapi.dev` |
| Production  | `https://wapi.getouch.co`     | `wapi`     |

Gateway: `wa.getouch.co` (auth via `x-wapi-secret` header).
Server-only access lives in `src/server/otp.ts` (do not expose to the client).

## 1 · Pre-flight

```sh
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables
                           WHERE table_schema='public'
                             AND table_name IN ('message_queue','inbound_messages');"
# expect: 2
```

Required env (Coolify):

```
WA_GATEWAY_URL=https://wa.getouch.co
WA_GATEWAY_SECRET=<gateway secret>
```

## 2 · Outbound queue — schema

Table `message_queue`:

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `tenant_id` | FK → tenants (cascade) |
| `account_id` | FK → connected_accounts (set null) — which WA number sends |
| `contact_id` | FK → contacts (set null) — recipient as a contact, optional |
| `campaign_id` | uuid — soft FK to `campaigns.id` (Phase 7) |
| `to_phone` | E.164, always required |
| `purpose` | `campaign \| reply \| otp \| followup \| broadcast \| system` |
| `status` | `queued \| sending \| sent \| delivered \| read \| failed \| cancelled` |
| `body_text` | rendered message body (after variant + variable substitution) |
| `payload` | jsonb — attachments / template params |
| `attempts` / `max_attempts` | retry counters |
| `scheduled_at` | when the worker may pick it up |
| `sent_at`, `delivered_at`, `read_at`, `failed_at` | timestamps |
| `failure_reason` | last error message |
| `provider_message_id` | gateway-assigned id used for delivery callbacks |

### 2.1 · Smoke insert

```sql
INSERT INTO message_queue
  (tenant_id, account_id, to_phone, purpose, body_text, scheduled_at)
VALUES
  ('<tenant id>', NULL, '+60123456789', 'system', 'hello from queue', now())
RETURNING id, status, attempts;
```

Expected: `status='queued'`, `attempts=0`.

### 2.2 · Index sanity

```sql
EXPLAIN
SELECT id FROM message_queue
WHERE status = 'queued' AND scheduled_at <= now()
ORDER BY scheduled_at
LIMIT 50;
```

Plan should reference `message_queue_status_idx`.

## 3 · Inbound messages — schema

Table `inbound_messages`:

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `tenant_id` | FK → tenants (cascade) |
| `account_id` | FK → connected_accounts (set null) |
| `contact_id` | FK → contacts (set null) — auto-resolved by phone |
| `from_phone` | E.164 |
| `body_text` | message text |
| `payload` | jsonb — media references, gateway envelope |
| `provider_message_id` | gateway message id |
| `received_at` | time the gateway received it |
| `intent`, `sentiment` | AI classifications (filled by Phase 7 workers) |
| `handled_by_ai` | boolean |
| `ai_reply_message_id` | uuid — soft link to the auto-reply queue row |

### 3.1 · Smoke insert

```sql
INSERT INTO inbound_messages
  (tenant_id, from_phone, body_text, received_at)
VALUES
  ('<tenant id>', '+60198765432', 'how much is the haircut?', now())
RETURNING id, intent, handled_by_ai;
```

Expected: `intent` is NULL until the classifier runs; `handled_by_ai=false`.

## 4 · Gateway connectivity (manual)

> This section is "smoke only" — the gateway is shared infra and we don't
> drive automated traffic against it from the test plan.

1. From a server shell with `WA_GATEWAY_URL` + `WA_GATEWAY_SECRET` set,
   `curl -H "x-wapi-secret: $WA_GATEWAY_SECRET" $WA_GATEWAY_URL/health`
   — expect `200 OK`.
2. Use the existing OTP path (Phase 4 registration) — sending an OTP
   exercises the gateway end-to-end and is the safest live check.

## 5 · Multi-tenant isolation

Critical invariant: **a tenant must never see another tenant's queue or
inbound rows**. Verify with two tenants `T1` and `T2`:

```sql
-- as T1
SELECT count(*) FROM message_queue WHERE tenant_id = '<T2 id>';
-- expected at app-layer: NEVER returned. The DB doesn't enforce row-level
-- security yet — every server query MUST filter by tenant_id. Audit
-- code under src/server/** for any query that touches message_queue
-- or inbound_messages without a tenant_id predicate.
```

A grep target you can run on every PR:

```sh
rg -n "from\(messageQueue\)|from\(inboundMessages\)" src/server src/app \
  | rg -v "tenantId"
# Output should be empty. Every query against these tables must include
# `eq(table.tenantId, ...)` (or a join through a tenant-scoped row).
```

## 6 · Connected account → queue linkage

`message_queue.account_id` references `connected_accounts.id`. When a
connected account is deleted (tenant disconnects a number), queue rows
must NOT cascade-delete — they retain history with `account_id = NULL`:

```sql
-- create a temporary connected_account, queue a row, delete the account,
-- assert the queue row survives:
WITH ca AS (
  INSERT INTO connected_accounts (tenant_id, provider, label, phone_e164, status)
  VALUES ('<tenant id>', 'wa-gateway', 'temp', '+60100000000', 'active')
  RETURNING id
)
INSERT INTO message_queue (tenant_id, account_id, to_phone, purpose, body_text, scheduled_at)
SELECT '<tenant id>', ca.id, '+60111111111', 'system', 'isolation test', now() FROM ca
RETURNING id, account_id;

-- now delete the account:
DELETE FROM connected_accounts WHERE label = 'temp' AND tenant_id = '<tenant id>';

-- queue row should still exist with account_id = NULL:
SELECT id, account_id FROM message_queue
WHERE to_phone = '+60111111111' AND tenant_id = '<tenant id>';
```

Cleanup:

```sql
DELETE FROM message_queue WHERE to_phone IN ('+60123456789','+60111111111');
DELETE FROM inbound_messages WHERE from_phone = '+60198765432';
```

## 7 · Acceptance

Phase 6 acceptance is met when:

1. `message_queue` and `inbound_messages` exist on both DBs with all
   indexes (`message_queue_status_idx`, `message_queue_tenant_idx`,
   `message_queue_campaign_idx`, `inbound_messages_tenant_idx`,
   `inbound_messages_contact_idx`, `inbound_messages_intent_idx`).
2. Smoke INSERTs in §§2.1, 3.1 succeed.
3. Connected-account deletion preserves queue history (FK is `set null`).
4. The grep audit in §5 returns no rows that bypass tenant scoping.
5. Existing OTP delivery (Phase 4) still works through the gateway.
