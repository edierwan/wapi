# 13 — Test plan: Phase 6 contract-ready (WAPI side) + Dify foundation

This is the **WAPI-side** validation of Phase 6. The corresponding gateway
behavior (live QR, live message send, live status webhooks) is gated by
[Request 05](./05-wa-gateway-multitenancy.md) and is intentionally out of
scope here.

The tranche shipped:

- `src/server/wa-gateway.ts` — single server-only HTTP wrapper for the
  shared WhatsApp gateway.
- `src/server/whatsapp-sessions.ts` — tenant-scoped session-state helpers.
- `src/server/wa-webhook-verify.ts` + `wa-webhook-handler.ts` — HMAC SHA256
  signature verification (timing-safe) for inbound webhooks.
- `src/app/api/wa/webhooks/{qr,connected,disconnected,inbound,status}/route.ts`
  — verified webhook receivers.
- `src/app/t/[slug]/whatsapp/{page,actions}.tsx` — owner/admin UI for add
  account, connect, reset, disconnect.
- `scripts/worker-outbound.ts` — outbound queue skeleton (NOT running in
  production yet).
- `src/server/ai-providers.ts` — provider resolution +
  `api_key_ref` indirection resolver.
- `src/server/dify-client.ts` — minimal Dify chat wrapper + namespaced
  conversation key builder.
- `src/server/ai-context.ts` — tenant-scoped context assembly.
- `src/app/t/[slug]/ai/draft/{page,actions,draft-reply-form}.tsx` — manual
  HITL draft assistant.

## Pre-flight

1. `pnpm typecheck` — must pass.
2. `pnpm build` — must pass.
3. DB has `connected_accounts`, `whatsapp_sessions`, `message_queue`,
   `inbound_messages`, `ai_provider_configs`, `tenant_ai_settings`,
   `tenant_business_profiles`, `business_memory_items`, `products`,
   `services`, `contacts`. (All 52 tables present.)

## A. WhatsApp UI tranche (no gateway needed)

1. Sign in as a tenant **owner** at `/t/{slug}/whatsapp`.
2. Add a new account:
   - Form `Display name = "Sales line"` → submit.
   - Expect a new card with status badge `pending`.
   - Verify in DB:
     `select status from whatsapp_sessions where account_id = (select id from connected_accounts order by created_at desc limit 1);`
     → `pending`.
3. Click **Connect**.
   - With `WA_GATEWAY_URL` unset: status flips to `pending` (no gateway
     call), the dashed warning box is shown.
   - With `WA_GATEWAY_URL` set but pointing to a non-listening host: the
     server action throws `Gateway: …` and the session is marked `error`.
4. Click **Reset** → status returns to `pending`, `auth_payload` cleared.
5. Click **Disconnect** → status flips to `disconnected`.
6. Sign in as a tenant **viewer** → buttons are hidden, the form is hidden.

## B. Webhook contract (HMAC verify)

The gateway must compute `HMAC_SHA256(WA_GATEWAY_SECRET, rawBody)` (hex)
and pass it in `x-wapi-signature`. Optional `sha256=` prefix is accepted.

1. POST any webhook without `x-wapi-signature` → expect 401
   `{ "ok": false, "error": "missing signature" }`.
2. POST with a wrong signature → expect 401 `signature mismatch`.
3. POST a `qr` webhook with a valid signature for a known `accountId`:
   ```bash
   ACC=<connected_accounts.id>
   BODY='{"accountId":"'$ACC'"}'
   SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WA_GATEWAY_SECRET" -hex | awk '{print $2}')
   curl -sX POST http://localhost:3000/api/wa/webhooks/qr \
     -H "content-type: application/json" \
     -H "x-wapi-signature: $SIG" \
     -d "$BODY"
   ```
   → 200 `{ "ok": true }`. Verify
   `select status, last_qr_at from whatsapp_sessions where account_id = '$ACC';`
   → status `connecting`, `last_qr_at` recent.
4. Repeat for `connected` (status → `connected`, `last_connected_at` set,
   `phoneNumber` backfilled if provided) and `disconnected`
   (status → `disconnected`).
5. POST to `/api/wa/webhooks/inbound` with `accountId, fromPhone, bodyText`
   → row appears in `inbound_messages`, `tenant_id` set, `contact_id` set
   when a contact with that phone exists for the tenant.
6. POST to `/api/wa/webhooks/status` with `accountId, externalRef, status:
   "delivered"`:
   - When `externalRef` references a `message_queue.id` whose tenant
     matches the resolved account: 200, the row's `status='delivered'`,
     `delivered_at` set.
   - When the queue row belongs to a different tenant: 404
     `queue row not found for tenant` (this is the cross-tenant guard).

## C. Outbound worker dry-run

The worker is a skeleton. Validate it does not blow up:

1. Insert one queue row:
   ```sql
   insert into message_queue (tenant_id, account_id, to_phone, body_text, purpose, status)
   values ('<tenant>', '<account>', '+60123', 'hello', 'system', 'queued');
   ```
2. `pnpm tsx scripts/worker-outbound.ts`
3. Expect log `dispatching 1 message(s)`. Without a live gateway, the row
   moves to `failed` with `failure_reason` set; this is the documented
   behavior.

## D. Dify provider resolution

1. Resolution order is `tenant_ai_settings → tenant default → global default`.
2. With no provider rows: `/t/{slug}/ai/draft` shows "No provider resolved".
3. Insert a global default:
   ```sql
   insert into ai_provider_configs (tenant_id, name, kind, base_url, api_key_ref, is_default)
   values (null, 'system-dify', 'dify', 'https://api.dify.ai', 'env:DIFY_DEFAULT_API_KEY', true);
   ```
   - Reload `/t/{slug}/ai/draft`. Provider card shows `system-dify`,
     `kind=dify`, `Scope=global default`.
4. Insert a tenant-owned default:
   ```sql
   insert into ai_provider_configs (tenant_id, name, kind, base_url, api_key_ref, is_default)
   values ('<tenant>', 'tenant-dify', 'dify', 'https://api.dify.ai', 'env:DIFY_TENANT_KEY', true);
   ```
   - Reload. Provider card now shows `tenant-dify`, `Scope=tenant-owned`.
5. Set `tenant_ai_settings.default_provider_id` to the global row id.
   Reload. Provider card flips back to `system-dify`.
6. **Cross-tenant guard**: set
   `tenant_ai_settings.default_provider_id` to a *different* tenant's
   provider id. The resolver must IGNORE it and fall through to the
   tenant-owned default. (Verify by re-reading the page.)

## E. Secret resolver

1. `apiKeyRef = "env:DIFY_DEFAULT_API_KEY"` and the env var is set →
   `getTenantProviderWithSecret` returns the secret.
2. Env var unset → returns `null`. The Draft form shows "No AI provider
   configured".
3. `apiKeyRef = "literal:abc"` in development → resolves to `"abc"`.
4. `apiKeyRef = "literal:abc"` with `APP_ENV=production` → resolves to
   `null` (production refuses literal secrets).

## F. HITL draft action

1. With provider configured and reachable, on `/t/{slug}/ai/draft`:
   - Paste a customer message, click `Generate draft`.
   - Network call: `POST {baseUrl}/v1/chat-messages` with header
     `Authorization: Bearer <resolved secret>`.
   - Response renders in a draft card with provider name, conversation key,
     and latency.
2. **Conversation-key invariants**:
   - The displayed key must look like `tenant:<uuid>:hitl:<userId>`.
   - It must NEVER look like a phone number.
   - `isValidConversationKey` rejects `tenant:+60123:phone:foo`.
3. **Tenant scoping**: the `inputs.tenant_id` field equals the current
   tenant id. The Dify-side prompt should hard-fail when `tenant_id` is
   missing.
4. **No persistence**: nothing is written to `business_memory_items`,
   `inbound_messages`, or `message_queue` by this action. Verify via SQL
   row counts before/after.

## G. Tenancy guardrails (regression suite)

Re-confirm before sign-off — these MUST hold:

- WAPI resolves tenant from `connected_accounts.tenant_id`, never from
  request body fields.
- Cross-tenant queue updates via the `status` webhook return 404, not 200.
- Cross-tenant default-provider id is silently dropped by the resolver.
- The Dify client refuses to call when the conversation key is not
  WAPI-namespaced.
- `assembleTenantContext` queries are all `eq(tenant_id, …)`.
- `wa-gateway.ts` is `server-only`; no client component imports it.

## Out of scope (NOT validated here)

- Live gateway behavior (QR scan, real send) → blocked on Request 05.
- Tenant-dedicated Dify infra → premium tier, future tranche.
- Auto-reply on inbound → never in this tranche; HITL only.
- Outbound worker as a long-running process → skeleton only.
