# Phase 2 test script

How to manually verify Phase 2 (multi-tenant foundation) on both local
dev and the Coolify-deployed `wapi.getouch.co`.

## Pre-flight

```bash
# 1. DB reachable + env wired
psql "$DATABASE_URL" -c "select 1;"

# 2. Apply the generated migration once (first time only, or after schema changes)
# Recommended when running from a machine that already has DATABASE_URL exported:
pnpm db:migrate

# Alternative direct SQL path (useful from pgAdmin / psql / remote box):
psql "$DATABASE_URL" -f drizzle/0000_parallel_mole_man.sql

# 3. Seed demo tenant + owner user
pnpm db:seed [email protected]
```

If your DB credentials contain `@`, URL-encode them in `DATABASE_URL`.
Example:

```bash
export DATABASE_URL='postgresql://admin%40getouch.co:Turun%402020@getouch-postgres:5432/wapi.dev'
```

The seed is idempotent. It creates:

- user `[email protected]`
- tenant **Demo Company** slug `demo`
- owner membership
- default tenant_settings
- system-default `ai_provider_configs` row (only if `DIFY_DEFAULT_BASE_URL` is set)

## Health

```bash
curl -sS http://localhost:3000/api/health | jq .
curl -sS https://wapi.getouch.co/api/health | jq .
curl -sS https://wapi-dev.getouch.co/api/health | jq .
```

Expect: `{ "status": "ok", ... }`.

## UI flow — happy path

1. Visit `/` → click **Start Free Trial** (or any Sign in link).
2. On `/login`, enter `[email protected]` (name optional). Submit.
3. You are redirected to `/dashboard`. Because this user has **exactly
   one** active membership, the dashboard auto-forwards to `/t/demo`.
4. You see the **Demo Company** workspace shell with six "Coming soon"
   cards.

## UI flow — error paths

Test each of these while signed in as `[email protected]`:

| URL you visit | Expected destination | Why |
|---|---|---|
| `/t/demo` | renders workspace | active member |
| `/t/nonexistent` | `/workspace-not-found?slug=nonexistent` | unknown tenant |
| `/t/admin` | `/workspace-not-found?slug=admin` | reserved slug |
| `/t/UPPER` | `/workspace-not-found?slug=upper` | invalid slug (uppercase) |
| `/t/-leading` | `/workspace-not-found?slug=-leading` | invalid slug |

Now sign out (the form on `/dashboard`), then sign in as a different
email, e.g. `[email protected]`:

| URL you visit | Expected destination |
|---|---|
| `/dashboard` | empty state + "Create workspace" card |
| `/t/demo` | `/access-denied?slug=demo` |

## DB spot-checks

```sql
-- must exist before /login works
select to_regclass('public.users');
select to_regclass('public.sessions');
select to_regclass('public.tenants');
select to_regclass('public.tenant_members');
select to_regclass('public.tenant_settings');

-- users
select id, email, is_system_admin, created_at from users order by created_at desc;

-- tenants
select id, name, slug, status, plan from tenants;

-- memberships
select tm.role, tm.status, u.email, t.slug
from tenant_members tm
join users u on u.id = tm.user_id
join tenants t on t.id = tm.tenant_id;

-- ai defaults
select id, tenant_id, kind, is_default, base_url from ai_provider_configs;
```

## Build checks

```bash
pnpm typecheck          # must pass with no errors
pnpm build              # must produce routes: /, /login, /dashboard, /t/[tenantSlug],
                        # /workspace-not-found, /access-denied, /api/health, /health
pnpm lint               # informational
```

## Known limitations (expected)

- Login accepts any email (bridge auth). This is intentional for MVP.
- No tenant creation from UI — use seed script or SQL for now.
- Workspace cards are placeholders, no WhatsApp/AI logic yet.
- `TENANT_ROUTING_MODE=subdomain` is wired but not enabled; we use `path` until we pay for Cloudflare ACM.

## Troubleshooting

- **`Application error` on `/login` with digest / Postgres `42P01`** → the
  Phase 2 migration was not applied to that database yet. Run:

  ```bash
  psql "$DATABASE_URL" -f drizzle/0000_parallel_mole_man.sql
  pnpm db:seed [email protected]
  ```

  Then restart/redeploy the app.

- **Redirect loop on `/dashboard`** → `SESSION_SECRET` mismatch between
  Next.js server processes. Restart the app after setting it.
- **`access-denied` when you expect success** → membership row has
  `status != 'active'`, or wrong user. Check `tenant_members`.
- **`workspace-not-found` with status=suspended** → tenant row has
  `status='suspended'`. Set back to `active` with
  `update tenants set status='active' where slug='demo';`.
