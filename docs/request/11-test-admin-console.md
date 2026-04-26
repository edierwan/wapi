# 11 — Test plan: Admin console reconciliation + delivered modules

> Validates the admin console after the reconciliation pass that turned
> key routes into real operational modules.
> Scope: shell + RBAC + shipped modules (`users`, `tenants`,
> `wa-sessions`, `jobs`, `ai`, `settings`, `system-health`).

## 0 · Where to test

| Env | URL | DB |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` | `wapi.dev` |
| Production  | `https://wapi.getouch.co`     | `wapi`     |

The development DB has a working super-admin already:

- Email: `admin@getouch.co`
- Password: provided to the agent at bootstrap time (not in this doc).

## 1 · Pre-flight

1. Confirm RBAC seed is in place:

   ```sh
   psql "$DATABASE_URL" -tAc "SELECT count(*) FROM permissions WHERE code='system.admin.access';"
   # expect: 1
   ```

2. Confirm `admin@getouch.co` has at least one active system role on the
   target DB:

   ```sql
   SELECT r.code
   FROM user_system_roles usr
   JOIN users u  ON u.id = usr.user_id
   JOIN roles r  ON r.id = usr.role_id
   WHERE u.email = '[email protected]' AND usr.status='active' AND r.scope_type='system';
   -- expected: at least 'SYSTEM_SUPER_ADMIN'
   ```

3. Confirm the role grants `system.admin.access`:

   ```sql
   SELECT 1 FROM permissions p
   JOIN role_permissions rp ON rp.permission_id = p.id
   JOIN roles r  ON r.id = rp.role_id
   WHERE p.code='system.admin.access' AND r.code='SYSTEM_SUPER_ADMIN';
   ```

## 2 · Admin user happy path

1. Sign out if you have a session. Visit `/login`.
2. Log in as `admin@getouch.co`.
3. **Expected**: redirect to `/admin` (NOT `/dashboard`, NOT
   `/t/<slug>/onboarding`).
4. The header shows:
   - WAPI · System Admin brand on the left.
   - Environment badge — **amber `development`** on `wapi.dev`,
     **red `production`** on `wapi`.
   - `SYSTEM_SUPER_ADMIN` role chip.
   - Your email (`admin@getouch.co`).
   - Theme toggle + Sign out.
5. The sidebar lists exactly 11 entries in this order:

   - Overview · Tenants · Users · WhatsApp Sessions · Jobs / Queue ·
     AI Providers · Billing · Audit Logs · System Health ·
     Abuse Monitor · Settings.

6. **Overview** is highlighted (active), and the cards in the main
   content match the sidebar.
7. Badge truth must match delivered state:

   - `Ready`: Tenants, Users, WhatsApp Sessions, Jobs / Queue,
     AI Providers, System Health, Settings.
   - `Coming soon`: Billing, Audit Logs, Abuse Monitor.

## 3 · Sub-route navigation

For each shipped route, click the sidebar link OR the matching tile on
the overview:

| Click | Expected URL | Expected highlight | Expected state |
|---|---|---|---|
| Tenants            | `/admin/tenants`        | Tenants            | real module |
| Users              | `/admin/users`          | Users              | real module |
| WhatsApp Sessions  | `/admin/wa-sessions`    | WhatsApp Sessions  | real module |
| Jobs / Queue       | `/admin/jobs`           | Jobs / Queue       | real module |
| AI Providers       | `/admin/ai`             | AI Providers       | real module |
| Billing            | `/admin/billing`        | Billing            | placeholder |
| Audit Logs         | `/admin/audit`          | Audit Logs         | placeholder |
| System Health      | `/admin/system-health`  | System Health      | real module |
| Abuse Monitor      | `/admin/abuse`          | Abuse Monitor      | placeholder |
| Settings           | `/admin/settings`       | Settings           | real module |

Expected behavior by route:

- Real modules render useful operational UI or an explicit empty state.
- Placeholder modules still render the shared `AdminPlaceholder` shell.
- Nav status badges must match the actual page state.

## 3 · Real module checks

### `/admin/users`

- Page renders a user directory, not `AdminPlaceholder`.
- Search box exists.
- Each row shows email, name or fallback, phone, memberships, system roles, created date.
- Current admin row is visibly protected from deletion.
- Protected system-admin accounts cannot be deleted.
- Reset action is visible.
- Delete action requires typed email confirmation.

### Admin Users — test tenant registration reset flow

1. Register a test tenant/user.
2. Confirm the user appears in `/admin/users`.
3. Confirm tenant membership appears.
4. Use the admin reset/delete action.
5. Confirm pending registration and OTP rows are cleared.
6. Confirm the same email/phone can register again.
7. Confirm the current admin cannot delete itself.
8. Confirm non-admin cannot access `/admin/users`.

### `/admin/tenants`

- Page renders a tenant directory, not `AdminPlaceholder`.
- Search/filter controls exist.
- Each row shows name, slug, plan/status, member counts, and workspace link.
- Empty-state text is clear if there are no rows.

### `/admin/wa-sessions`

- Page renders session/account monitoring UI, not `AdminPlaceholder`.
- Request 05 blocker banner is visible.
- Rows show tenant, account, gateway, status, phone, and last-connected data when present.
- `View details` opens a details card on the page.
- `Tenant WhatsApp` link points to `/t/{slug}/whatsapp`.
- No destructive gateway control is exposed.

### `/admin/jobs`

- Page shows queue counts and worker summary.
- Page links to `/admin/system-health`.
- Recent failures list does not expose secrets.

### `/admin/ai`

- Page shows provider counts and provider registry.
- Secret mode is shown as `env ref` / `literal ref` / `custom ref` / `none`.
- No raw secret values are shown.

### `/admin/settings`

- Page shows environment, app URL, routing mode, public gateway URLs, and feature flags.
- No secrets are shown.

## 4 · Active-route highlight (deep route stub)

Manually visit `/admin/tenants/anything-here`. (No matching route — the
parent prefix should still highlight when we add detail pages later.)

For now, expect Next.js 404 on the unknown segment. This test will move
to "must show Tenants highlighted on detail pages" once `/admin/tenants/[id]`
ships in Phase 8.

## 4 · Mobile / narrow-viewport check

Resize the window below ~768 px. Expected:

- Sidebar moves under the header into a horizontally-scrollable strip.
- All nav items are still reachable.
- Active highlight still tracks the route.

## 5 · Theme persistence

1. Click the moon/sun toggle in the header — page switches theme.
2. Reload — theme persists (cookie `wapi_theme=dark|light`).
3. Navigate Overview → Tenants → Overview — theme remains stable.

## 6 · Access control — non-admin user

1. Sign out. Register or sign in as a **normal tenant user** (any user
   without a `user_system_roles` row).
2. Visit `/admin` directly.
3. **Expected**: redirect to `/access-denied?reason=admin`.
4. Try `/admin/users`, `/admin/tenants`, `/admin/wa-sessions`, `/admin/system-health`, `/admin/anything`.
   Expected: same redirect — every nested route is protected by the
   layout.
5. The user's tenant-side flow (`/dashboard`, `/t/<slug>/...`) must
   still work — no regression.

## 7 · Access control — anonymous user

1. Sign out. Visit `/admin`.
2. **Expected**: redirect to `/login?next=/admin`.
3. Sign in as a normal user → bounced to `/access-denied?reason=admin`.
4. Sign in as `admin@getouch.co` → land on `/admin`.

## 8 · Access control — server-side enforcement

Permission check is enforced in `src/app/admin/layout.tsx`. Verify there
is no client-only gate that could be bypassed:

```sh
rg -n "system.admin.access" src/app src/server src/components
# Should reference layout.tsx (server) — never a client component.
```

## 9 · Login redirect rule

- Admin user → `/admin`.
- Non-admin user with at least one tenant membership → `/dashboard`.
- Non-admin user without a tenant → `/dashboard` (the existing dashboard
  page renders the empty state and prompts to register a workspace).

System admins must NOT be auto-redirected into `/t/<slug>/onboarding`
even if they happen to own/belong to a tenant. Verify by:

1. Add `admin@getouch.co` as a member of the demo tenant temporarily
   (if not already):

   ```sql
   INSERT INTO tenant_members (tenant_id, user_id, role, status)
   SELECT t.id, u.id, 'admin', 'active'
   FROM tenants t, users u
   WHERE t.slug='demo' AND u.email='[email protected]'
   ON CONFLICT DO NOTHING;
   ```

2. Sign out, sign in as admin → still lands on `/admin`.
3. Cleanup: remove the membership row if it wasn't there before.

## 10 · Phase 3 + Phase 4 regression spot checks

The console rework should be additive. Re-run the most critical paths
from `06-test-phase3.md` + `07-test-phase4.md`:

- Public registration → OTP → tenant created → onboarding form → tenant
  workspace.
- Demo tenant `/t/demo`, `/t/demo/products`, `/t/demo/services`,
  `/t/demo/settings/business` all render.
- Non-owner blocked from onboarding writes.
- Theme toggle works on both tenant pages and admin pages.

## 11 · Build / typecheck

From a fresh checkout:

```sh
pnpm install
pnpm typecheck   # must exit 0
pnpm build       # must complete; expect /admin/* routes in the route table
```

Expected route table (excerpt):

```
ƒ /admin
ƒ /admin/abuse
ƒ /admin/ai
ƒ /admin/audit
ƒ /admin/billing
ƒ /admin/jobs
ƒ /admin/settings
ƒ /admin/system-health
ƒ /admin/tenants
ƒ /admin/users
ƒ /admin/wa-sessions
```

## 12 · Acceptance

Acceptance is met when:

1. Admin login lands on `/admin`.
2. Sidebar + header render with environment badge, role chip, email,
   theme toggle, sign-out.
3. Shipped modules render real operational UI on:
   `/admin/users`, `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`,
   `/admin/ai`, `/admin/settings`, `/admin/system-health`.
4. Remaining staged modules (`billing`, `audit`, `abuse`) still render
   `AdminPlaceholder` and keep their Coming-soon badge.
5. Active-route highlighting works for both exact and prefix matches.
6. Non-admin users hit `/access-denied?reason=admin` on every
   `/admin/**` route.
7. The `/admin/users` tenant-registration reset flow works safely.
8. No secrets are shown in `/admin/ai` or `/admin/settings`.
9. The Request 05 blocker banner is visible in `/admin/wa-sessions`.
10. Phase 3 + Phase 4 regression checks still pass.
11. typecheck + build succeed.
