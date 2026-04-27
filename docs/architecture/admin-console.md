# Admin console (system-level)

WAPI needs an internal console for the team running the SaaS. Separate
from tenant UI.

## Separation

| Surface | Who | Where | Scope |
|---|---|---|---|
| Tenant UI | Tenant members | `/dashboard`, `/t/{slug}/...` | **One tenant only** (the logged-in user's membership) |
| Admin console | WAPI staff | `/admin/...` | **All tenants** (read-mostly, write for support actions) |

Admin is gated by `users.is_system_admin=true` plus a role
(`system_admin`, `support_admin`, `billing_admin`). No tenant member
row grants access.

## Admin roles

| Role | Can do |
|---|---|
| `system_admin` | Everything. Read/write across tenants. Invalidate sessions. Change plans. |
| `support_admin` | Read tenants/users, impersonate-as-support (flagged + audited), reset WA session. |
| `billing_admin` | Read tenants, manage `subscriptions`, `invoices`, refunds. |

Modeled as rows in a `system_roles` table (separate from tenant
`roles`), + `system_role_assignments` linking to `users`.

## Route map (Phase 8)

| Route | Module | Purpose |
|---|---|---|
| `/admin` | overview | KPIs: total tenants, active, trial, MRR, queue lag, error count |
| `/admin/tenants` | tenants | List, filter, view detail, suspend/resume |
| `/admin/tenants/[id]` | tenant detail | Members, WA sessions, campaigns, billing |
| `/admin/users` | users | Global user list, disable account, force logout, **cascade-delete with optional sole-owner workspace removal and storage purge** (see "User cascade delete" below) |
| `/admin/wa-sessions` | WhatsApp | Live session list, status, reset, QR |
| `/admin/jobs` | queues | BullMQ dashboard (read), retry dead jobs |
| `/admin/ai` | AI | AI usage by tenant, provider health, generations log |
| `/admin/billing` | billing | Subscriptions, failed payments, dunning, refunds |
| `/admin/audit` | audit | Filter audit logs across tenants |
| `/admin/webhooks` | webhooks | Webhook delivery log, retry failed |
| `/admin/system-health` | health | DB, Redis, MinIO, Dify, Baileys gateway up/down + latency |
| `/admin/storage` | storage | Bucket health, per-tenant prefix init, DB usage; backed by SeaweedFS shared infra |
| `/admin/abuse` | risk | Flag spammy tenants, mass opt-out spikes, suspect numbers |

## User cascade delete (development test cleanup)

The `/admin/users` page exposes a single guarded delete flow whose cleanup
scope is controlled by two checkboxes presented next to the typed-email
confirmation. The action lives in
`src/app/admin/users/actions.ts::deleteUserAction`.

Always-on (every successful delete):

- Match `confirmEmail` exactly (case-insensitive) against the target's email.
- Refuse self-delete (`session.userId === target.id`).
- Refuse `isSystemAdmin` and protected-role users (`scopeType='system'`).
- Inside one DB transaction: clear `pending_registrations` (by email and by
  phone), clear `phone_verifications` for the target's phone, clear
  `password_reset_sessions`, drop `tenant_members` for the target, then
  delete `users`.

Optional checkbox: **"Also delete workspaces where this user is the sole
owner"**

- Looks up tenants where this user is `role='owner', status='active'` AND no
  other active owner exists. Tenants with another active owner are left in
  place (the user simply loses membership).
- Inside the same transaction, deletes those tenants. The schema's foreign
  keys cascade the rest: `tenant_members`, `connected_accounts`,
  `whatsapp_sessions`, products, services, `ai_provider_configs`,
  `tenant_settings`, `api_keys`, `webhook_endpoints`, `storage_objects`
  rows, etc.

Optional checkbox: **"Also purge object storage prefixes"**

- Only available when the previous checkbox is also ticked.
- Calls `deleteTenantStoragePrefix(tenantId)` for each sole-owner tenant
  before the DB transaction runs (best-effort; failures are reported per
  tenant and do not block the DB delete).
- Disabled in the UI when storage is not configured.
- **Production guardrail**: refuses to run when `NODE_ENV === "production"`
  unless `WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION=true` is set in the
  environment. This is intended for development test workspaces (where the
  same operator email is registered/de-registered repeatedly during QA).

The notice banner after a successful delete summarises which optional steps
ran, the count of sole-owner workspaces removed, and a per-tenant storage
purge summary.

## KPI surfaces

Admin overview dashboard:

- Tenants: total, active, trial, churned this month
- Revenue: MRR, new MRR, churn $, trial→paid conversion rate
- Messaging: messages sent today/7d/30d, failure rate, top 10 tenants by volume
- AI: generations today, tokens, cost (when providers expose it), top tenants
- Queue: lag p50/p95, failed jobs, dead-letter count
- WA gateway: sessions connected/disconnected, ban reports
- Errors: 500s, handled errors, Sentry links (when wired)

## Impersonation (support)

Support admin can "view as tenant owner" on a specific tenant:

1. Request is logged to `audit_logs` (action=`support.impersonate.start`).
2. Session banner shows a red "SUPPORT MODE" strip.
3. All actions taken are double-logged: once as the impersonated user,
   once with `acting_as_support_user_id`.
4. Cannot perform destructive actions even as support (e.g. delete tenant).

## Data safety

- Admin console is **read-first**. Writes require explicit intent (buttons labeled with consequence).
- All admin writes log to `audit_logs` with `tenant_id=NULL` when system-level.
- No raw PII export from admin UI without a ticketed reason + 2-person approval (Phase 10+).

## Phase

- **Phase 3**: block `/admin` at middleware (system admin only). No UI yet.
- **Phase 4 (shipped)**: minimal `/admin` placeholder gated by RBAC,
  System Admin badge, role chips, sign-out — overview-only.
- **Phase 5–7 (shipped)**: full admin console **shell** lands early so
  later phases can plug in modules without further chrome work:
  - `src/app/admin/layout.tsx` — sticky header (env badge, role chip,
    user email, theme toggle, sign-out) + left sidebar with active-route
    highlighting + mobile fallback.
  - `src/app/admin/_nav.ts` — single source of truth for the sidebar and
    the overview tile grid.
  - Placeholder routes for every nav entry: `/admin/tenants`,
    `/admin/users`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`,
    `/admin/billing`, `/admin/audit`, `/admin/system-health`,
    `/admin/abuse`, `/admin/settings`. Each renders the shared
    `AdminPlaceholder` component until its module ships.
  - Access control uses the `system.admin.access` permission (no email
    hardcoding).
- **Phase 8 (partially shipped)**:
  - shipped read-first modules:
    - `/admin/tenants`
    - `/admin/users`
    - `/admin/wa-sessions`
    - `/admin/jobs`
    - `/admin/ai`
    - `/admin/settings`
    - `/admin/system-health`
  - still pending for later admin tranches:
    - `/admin/billing`
    - `/admin/audit`
    - `/admin/abuse`
    - tenant detail pages / audited support mode / destructive support actions
- **Phase 9**: add billing surfaces.
- **Phase 10**: impersonation + abuse/risk dashboard. **TODO**: future
  support mode must let system admins inspect tenant workspaces with
  audit logging + a visible "SUPPORT MODE" banner. Not implemented yet —
  system admins are intentionally NOT routed into tenant onboarding.
