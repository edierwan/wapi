# Security & authorization

Covers: users, roles, permissions, API keys, webhooks, audit. Read
together with [auth.md](./auth.md).

## Auth decision: Better Auth

The HMAC cookie bridge built in Phase 2 is a placeholder. Phase 3
swaps it for [Better Auth](https://www.better-auth.com/) with:

- email + password
- email OTP / magic link
- Google OAuth (primary social)
- Apple / GitHub optional
- schema-compatible with our existing `users` and `sessions` tables

Our `src/server/auth.ts` keeps its public surface (`getCurrentUser`,
`signOut`) stable so callers don't change.

## Role & permission model

Simple role enum is not enough long-term. We model:

### `roles`

- `id`, `tenant_id` (nullable — null = system template role)
- `code` (`owner`, `admin`, `agent`, `viewer`, or tenant-defined)
- `name`, `description`
- `is_system_role` boolean

System roles are seeded for every tenant; tenants can clone and
customize.

### `permissions`

Global catalog (no tenant_id), referenced by code.

| code | module | action |
|---|---|---|
| `products.read` | products | read |
| `products.write` | products | write |
| `services.read` | services | read |
| `services.write` | services | write |
| `contacts.read` | contacts | read |
| `contacts.write` | contacts | write |
| `contacts.import` | contacts | write |
| `campaigns.create` | campaigns | write |
| `campaigns.approve` | campaigns | approve |
| `campaigns.send` | campaigns | send |
| `inbox.read` | inbox | read |
| `inbox.reply` | inbox | write |
| `ai.use` | ai | invoke |
| `wa_accounts.manage` | whatsapp | manage |
| `billing.manage` | billing | manage |
| `settings.manage` | settings | manage |
| `members.manage` | tenant | manage |
| `audit.read` | audit | read |

### `role_permissions`

Many-to-many. Default assignments:

| Role | Permissions |
|---|---|
| `owner` | everything |
| `admin` | everything except `billing.manage` |
| `agent` | `contacts.*`, `inbox.*`, `campaigns.create`, `ai.use` |
| `viewer` | `*.read` only |

### `member_permission_overrides` (future)

Per-member `allow`/`deny` override of a specific permission. Lets a
tenant grant one agent `campaigns.approve` without promoting to admin.

## API keys

### `api_keys`

- `id`, `tenant_id`, `name`
- `key_hash` (argon2/bcrypt of the secret)
- `prefix` text (first 8 chars for display — `wapi_live_xxx…`)
- `scopes` jsonb (subset of permission codes)
- `status` enum `active|revoked`
- `last_used_at`
- `expires_at` nullable
- `created_by_user_id`

Secret is shown **once** at creation, never stored plaintext.

## Webhook endpoints

### `webhook_endpoints`

- `id`, `tenant_id`, `url`
- `secret_ref` (env/secret-manager pointer, not the secret itself)
- `events` jsonb (list of event codes)
- `status`

Outbound deliveries go through a queue with retries; failures logged in
`webhook_deliveries` (Phase 8).

## Audit & compliance

### `audit_logs`

- `id`, `tenant_id` null (null = system-level event)
- `actor_user_id` null
- `action` text (`product.create`, `campaign.approve`, …)
- `object_type`, `object_id`
- `before_json`, `after_json` (diffs for mutations)
- `ip_address`, `user_agent`
- `created_at`

Write path: every server action + every MCP tool call logs here. Read
UI lives in admin console + per-tenant Settings → Activity.

### Consent / opt-out

- `opt_outs` table blocks outbound sends (see [master-data.md](./master-data.md#opt_outs)).
- Every campaign send event includes a consent snapshot (message content,
  opt-out mechanism) retained ≥ 2 years.

### Data export / delete

Phase 8 ships:
- `GET /api/tenant/export` → JSON + media bundle for owner.
- `POST /api/tenant/delete` → soft delete tenant; hard delete after 30
  days with job.

## Authorization enforcement checklist

At every server entry point:

1. `getCurrentUser()` — rejects if no session.
2. `resolveTenantBySlug({ slug, currentUserId })` — derives tenantId
   **from URL**, not client input.
3. `requirePermission(currentUserRole, 'products.write')` — centralized
   check built in Phase 3.
4. Mutation → `audit_logs` write inside the same transaction.

No route may accept `tenant_id` from the request body or query.

## Secrets handling

- All provider secrets live in env or Coolify secrets; DB only stores
  `*_ref` pointers (e.g. `api_key_ref='DIFY_DEFAULT_API_KEY'`).
- `SESSION_SECRET` set per-environment; rotate annually.
- Webhook HMACs: per-endpoint random secret, rotatable.
- API key secrets: hashed at rest (argon2id).

## Threat model notes

- **Account takeover**: Better Auth session + optional 2FA (Phase 8).
- **CSRF**: Next.js server actions are POST + origin-checked by default; augment with token for non-action endpoints.
- **IDOR**: absolute rule — tenantId comes from URL/session, never from request body.
- **SSRF** (webhooks, media fetch): outbound HTTP client uses an allowlist + blocks RFC1918 + metadata IPs.
- **Upload malware**: MinIO bucket is private; content-type sniffing + size caps on upload endpoint; link-share via signed URL.
- **Prompt injection in AI**: system prompts pin policy; user content is wrapped in clearly delimited sections; MCP tools gate destructive effects.
