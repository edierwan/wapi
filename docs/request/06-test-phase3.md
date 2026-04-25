# Phase 3 — Test Script

> Validates: tenant business profile onboarding flow, master-data tables (products/services) schema, tenant sub-nav, and settings/business view. Run after deploying this branch and running the seed.

## 2026-04-25 Live retest notes (`wapi-dev`)

- Verified on deployed `wapi-dev` and `wapi` after fixing the edge proxy upstream drift and restarting `caddy`.
- Confirmed healthy routes:
  - `https://wapi-dev.getouch.co/api/health` returns `200`
  - `https://wapi.getouch.co/api/health` returns `200`
- Confirmed demo tenant rendering on `wapi-dev` in a real browser session as the seeded viewer:
  - `/t/demo/products` shows `SKU-001`
  - `/t/demo/services` shows `SVC-001`
  - `/t/demo/settings/business` renders the business profile state
  - `/t/demo/onboarding` redirects back to `/t/demo` for a non-owner
- Confirmed fresh-tenant onboarding in a real browser session after a code fix:
  - `/t/phase3china1777138295` redirects to `/t/phase3china1777138295/onboarding`
  - submit now succeeds and redirects back to `/t/phase3china1777138295`
  - DB spot-check confirms `onboarding_completed_at` is set and `business_nature='service'`
- Root cause of the onboarding crash was identified and fixed in repo:
  - `app/t/[tenantSlug]/onboarding/page.tsx` passed `ref={refData}` into a client component
  - React/Next treats `ref` as a reserved prop, so server serialization failed with digest `2544332889`
  - the prop was renamed to `refData` in both the page and `onboarding-form.tsx`
- Seed reproducibility fix applied in repo:
  - `scripts/seed.ts` now loads `.env.local` explicitly for local `pnpm db:seed ...` runs
  - `scripts/seed.ts` now seeds password hashes for the demo owner and demo viewer accounts
  - rerunning the seed with `SEED_PASSWORD` / `SEED_MEMBER_PASSWORD` now resets those hashes deterministically
- Database spot-checks on both `wapi.dev` and `wapi` now report `52` public tables, not `28`.
- Request #05 remains the functional blocker for real WhatsApp session orchestration, but the Phase 3 UI/business-profile scope is now passing.

## 0. Prereqs

- Migration `0001_friendly_doomsday.sql` already applied to both `wapi` and `wapi.dev` (see [docs/deployment/migration-log.md](../deployment/migration-log.md)).
- Deployed commit includes `scripts/seed.ts` Phase-3 additions.

## 1. Seed (or re-seed) the demo tenant

On the server:

```bash
# prod
pnpm db:seed [email protected]

# dev
DATABASE_URL="postgres://getouch:...@host:5432/wapi.dev" pnpm db:seed [email protected]
```

Expected new log lines:

```
  ✓ created viewer user ...
  ✓ created viewer membership
  ✓ created tenant_business_profiles (onboarded)
  ✓ created sample product SKU-001
  ✓ created sample service SVC-001
```

Re-running the seed should show `• ... already seeded` (idempotent).

For reproducible browser checks, the seed now also supports:

```bash
SEED_PASSWORD='OwnerPassword123'
SEED_MEMBER_PASSWORD='ViewerPassword123'
pnpm db:seed
```

## 2. Existing tenant (demo) — onboarding is already complete

1. Sign in as `[email protected]`.
2. Hit `/t/demo`.
3. ✅ Should render the tenant overview with the new sub-nav (Overview, WhatsApp, Contacts[soon], Products, Services, Campaigns[soon], Inbox[soon], AI[soon], Analytics[soon], Settings).
4. ✅ Should NOT redirect to `/t/demo/onboarding` because `onboarding_completed_at` is set.

## 3. New tenant — onboarding is forced

Create a second tenant via SQL so we can see the redirect:

```sql
-- as getouch superuser
insert into tenants (slug, name, status)
values ('acme', 'Acme Test', 'active')
returning id;

-- take the returned uuid and attach owner
insert into tenant_members (tenant_id, user_id, role, status)
select t.id, u.id, 'owner', 'active'
from tenants t, users u
where t.slug='acme' and u.email='[email protected]';
```

Now visit `/t/acme`.

- ✅ Should redirect to `/t/acme/onboarding`.
- ✅ The onboarding form renders with 7 business-nature radios, basics grid, and brand-voice textarea.
- Pick `Service-based`, industry `Dental clinic`, leave defaults. Submit.
- ✅ Redirects to `/t/acme`.
- ✅ `select * from tenant_business_profiles where tenant_id=(select id from tenants where slug='acme');` returns one row with `business_nature='service'`, `onboarding_completed_at` not null.
- ✅ Re-visiting `/t/acme` no longer bounces to onboarding.

## 4. Sub-pages render

While signed in on `/t/demo`:

- `/t/demo/whatsapp` → empty state card. "Connect number" button is disabled. Link to request #05 is present.
- `/t/demo/products` → one row (SKU-001, Hair Serum 50ml, MYR 49.00, active).
- `/t/demo/services` → one row (SVC-001, Hair Wash & Blow, 45 min, MYR 35.00, booking required).
- `/t/demo/settings/business` → view-mode card showing business nature `hybrid`, `Onboarding: Complete` badge, `Edit` button goes to onboarding form (prefilled).

## 5. Permission check

Sign in as `Demo Member` (seeded as a `viewer`, not owner/admin) on the demo tenant:

- `/t/demo/onboarding` ✅ redirects to `/t/demo` (guard in page).
- Manually POST-ing to the onboarding action as a non-owner ✅ also redirects without writing (guard in action).

## 6. Database spot checks

```sql
-- counts
select count(*) from tenant_business_profiles;   -- ≥ 1
select count(*) from products where tenant_id=(select id from tenants where slug='demo'); -- = 1
select count(*) from services where tenant_id=(select id from tenants where slug='demo'); -- = 1

-- total tables
select count(*) from pg_tables where schemaname='public';  -- = 52
```

## 7. Known NOT in this phase (documented only)

- Better Auth swap (still HMAC cookie bridge) — see [docs/architecture/security.md](../architecture/security.md).
- MinIO upload API — schema only, no route yet — see [docs/architecture/storage.md](../architecture/storage.md).
- Postgres LISTEN/NOTIFY realtime — see [docs/architecture/realtime.md](../architecture/realtime.md).
- Multi-gateway WA routing — see [docs/request/05-wa-gateway-multitenancy.md](./05-wa-gateway-multitenancy.md).
- Product/service editor UI — Phase 4.

## 8. Sign-off checklist

- [ ] Onboarding redirect works for a fresh tenant.
- [ ] Onboarding form submit writes `tenant_business_profiles` and redirects back.
- [ ] Seeded demo tenant skips onboarding.
- [ ] Products/services list pages show seeded row.
- [ ] Settings → Business prefills form in edit mode.
- [ ] Non-owner cannot edit business profile.
- [ ] `pnpm typecheck` and `pnpm build` clean on the deployed branch.

Current live status on `wapi-dev` after the 2026-04-25 retest:

- `[x]` Seeded demo tenant skips onboarding.
- `[x]` Products/services list pages show seeded row.
- `[x]` Settings → Business view shows the seeded profile state.
- `[x]` Fresh tenant redirects to onboarding.
- `[x]` Onboarding form submit writes and redirects back.
- `[x]` Non-owner cannot edit business profile.
- `[x]` `pnpm typecheck` and `pnpm build` are clean locally and in the rebuilt app containers.
