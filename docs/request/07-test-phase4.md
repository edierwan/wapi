# 07 — Test plan: Phase 4 (registration, OTP, /admin, dark theme)

> Phase 4 ships full registration, WhatsApp OTP verification, scope-aware
> roles & permissions, the `/admin` console gate, and a dark theme toggle.
> Phase 3 features (business profile / products / services) remain
> available and should keep working.

## 2026-04-25 Live status

- Public routing for both app envs was restored by updating the edge Caddy upstreams to the current Coolify container names and restarting `caddy`.
- Confirmed healthy routes:
   - `https://wapi-dev.getouch.co/api/health` returns `200`
   - `https://wapi.getouch.co/api/health` returns `200`
- Confirmed `/admin` in real browser sessions:
   - `wapi-dev`: `admin@getouch.co` reaches `/admin`, sees the **System Admin** badge, and the `SYSTEM_SUPER_ADMIN` role chip
   - `wapi`: `admin@getouch.co` reaches `/admin`, sees the same admin markers
   - `wapi-dev`: non-admin viewer reaches `/access-denied?reason=admin`
- Confirmed dark theme persistence on `wapi-dev`: clicking the theme toggle writes `wapi_theme=dark`, and the page reloads in dark mode.
- Confirmed Phase 3 regression coverage on `wapi-dev` after the onboarding fix:
   - onboarding page renders and submits for a fresh tenant
   - products/services/settings business pages still render
- Build and type checks are clean: `pnpm typecheck` and `pnpm build` both pass.
- DB spot-checks now report `52` public tables in both `wapi.dev` and `wapi`, and RBAC seed counts remain `4` system roles and `19` system permissions.
- Remaining limitation: OTP delivery was not fully validated end-to-end from this session because that requires a real WhatsApp number/device controlled by the tester.
- Current live production config has `ENABLE_PUBLIC_REGISTRATION=true`, so `https://wapi.getouch.co/register` is open by configuration right now.

## 0 · Where to test

| Env | URL | DB |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` (or local) | `wapi.dev` |
| Production  | `https://wapi.getouch.co`                | `wapi`     |

The development DB has a working super-admin already:

- Email: `admin@getouch.co`
- Password: (the one provided to the agent at bootstrap time — not in this doc)

If you need to reset it, see §6.

## 1 · Pre-flight

Set these env vars in Coolify (or `.env.local` for local dev):

```
ENABLE_PUBLIC_REGISTRATION=true     # opens /register
ENABLE_DEV_OTP_FALLBACK=false       # keep false when validating the real WhatsApp OTP path
ENABLE_DEV_EMAIL_LOGIN=false        # production-safe
WA_GATEWAY_URL=https://wa.getouch.co
WA_GATEWAY_SECRET=<gateway secret>
```

Production is config-dependent. If you want public sign-up closed, set:

```
ENABLE_PUBLIC_REGISTRATION=false
ENABLE_DEV_OTP_FALLBACK=false
ENABLE_DEV_EMAIL_LOGIN=false
```

## 2 · Visual checks

1. Navigate to `/`. The navbar should show **Sign in** and **Register** for
   anonymous visitors. The hero CTA should link to `/register`.
2. Click the **moon / sun** icon in the navbar — page switches to dark
   theme; reload — theme persists (cookie `wapi_theme=dark`).

## 3 · Registration happy path

1. Visit `/register`. Fill the form with a real WhatsApp number you can
   receive on:
   - Business name: `Klinik Test`
   - Your name: `Test Owner`
   - Email: a fresh address you control
   - Country: `+60` (or your country)
   - WhatsApp number: digits only, e.g. `123456789`
   - Password: at least 8 chars (e.g. `Test1234!`)
   - Confirm password: same
   - Business nature: `Service-based`
   - Team size: `1`
2. Submit. You should be redirected to `/verify-phone?pr=<uuid>` (and in
   dev with `ENABLE_DEV_OTP_FALLBACK=true`, a `&dev=NNNN` query is
   present and the page shows the code in an amber banner).
3. You should also receive a WhatsApp message **from the configured
   gateway number** containing the same 4-digit code and the wording
   `Your WAPI verification code is NNNN. It expires in 10 minutes…`.
4. Enter the code → **Verify & create workspace**. You should be
   redirected to `/t/<your-slug>` (the tenant home), already signed in.
5. Verify the tenant has the business profile prefilled — go to
   `/t/<slug>/settings/business` and confirm `businessNature` and the
   primary phone match what you registered with.

### SQL spot-check

```sql
SELECT id, email, status, phone, phone_verified
FROM users
WHERE lower(email) = lower('YOUR_TEST_EMAIL');

SELECT t.slug, t.name, t.status,
       tm.role, tm.status AS member_status
FROM tenants t
JOIN tenant_members tm ON tm.tenant_id = t.id
JOIN users u ON u.id = tm.user_id
WHERE lower(u.email) = lower('YOUR_TEST_EMAIL');

SELECT business_nature, primary_phone
FROM tenant_business_profiles
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'YOUR_SLUG');
```

Expected: 1 user (`status=active`, `phone_verified=true`), 1 tenant with
1 owner, business profile populated.

## 4 · Registration error paths

- **Wrong code** (3×): each attempt should show "Invalid code" and
  increment `attempts`. After 5, you must request a new code.
- **Expired code**: wait >10 min, then submit. Should show
  "Code expired".
- **Resend cooldown**: click *Resend code* twice within 60 seconds — the
  second click should fail with a cooldown error.
- **Duplicate email**: try to register with `admin@getouch.co` (already
  exists). Form should reject with "Email already in use".
- **Invalid phone**: leave the digits empty / put letters → form rejects.
- **Weak password**: `1234567` (7 chars) → rejected.
- **Mismatched confirm**: passwords differ → rejected.
- **Production registration gate**: behavior follows the live
   `ENABLE_PUBLIC_REGISTRATION` value. With `false`, `/register` should show the
   *"Registration is not open yet."* card and no form. With `true`, the form is
   expected to render.

## 5 · Login

1. Visit `/login`. Submit your registered email + password → redirected
   to `/dashboard`.
2. Submit wrong password → "Invalid email or password" (no enumeration).
3. With `ENABLE_DEV_EMAIL_LOGIN=true` in dev only, submitting just an
   email (no password) should also work — used by Phase 1/2 demo flows.
   Set this to **false** in production.

## 6 · Super-admin / `/admin`

### Bootstrap the super-admin

If you ever lose access, set in your local shell:

```bash
export BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@getouch.co
export BOOTSTRAP_SUPER_ADMIN_PASSWORD='<choose a strong password>'
export BOOTSTRAP_SUPER_ADMIN_NAME='Getouch Admin'
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/wapi.dev'   # or wapi
pnpm db:bootstrap:admin
```

Output ends with `✅ Bootstrap complete.` The script is **idempotent**
and updates the password hash on every run.

> The Postgres host is not exposed publicly. From a workstation, either
> open a temporary SSH tunnel (`ssh -L 15432:localhost:5432`) and use
> `127.0.0.1:15432`, or run the script inside a Coolify-managed
> container that has DB network access.

### Verify

1. Sign in as `admin@getouch.co`.
2. Visit `/admin`. You should see:
   - A **System Admin** badge in the header
   - Your email + sign-out button
   - A list of role chips containing `SYSTEM_SUPER_ADMIN`
   - 9 placeholder tiles (Tenants, Users, WhatsApp sessions, Jobs, AI
     providers, Billing, Audit logs, System health, Abuse monitor) all
     marked *Coming soon*.
3. Sign out, sign in as a **non-admin** user (any registered tenant
   owner). Visit `/admin` → redirected to
   `/access-denied?reason=admin` with the admin-specific message.

### SQL spot-check

```sql
SELECT u.email, r.code AS system_role, usr.status
FROM users u
JOIN user_system_roles usr ON usr.user_id = u.id
JOIN roles r ON r.id = usr.role_id
WHERE r.scope_type = 'system'
ORDER BY u.email, r.code;

-- Permissions wired to SUPER_ADMIN
SELECT p.code
FROM permissions p
JOIN role_permissions rp ON rp.permission_id = p.id
JOIN roles r ON r.id = rp.role_id
WHERE r.code = 'SYSTEM_SUPER_ADMIN' AND r.scope_type = 'system'
ORDER BY p.code;
```

Expect 19 system permissions linked to `SYSTEM_SUPER_ADMIN`.

## 7 · Build + types

```bash
pnpm typecheck   # tsc --noEmit, must be clean
pnpm build       # Next build, must succeed
```

Both must finish with no errors. The build output should list:
`/admin`, `/register`, `/verify-phone`, `/login` as `ƒ (Dynamic)`.

## 8 · Phase 3 regression

Phase 4 must not regress Phase 3:

- `/t/<slug>/onboarding` still works.
- Products / services pages still render.
- `/t/<slug>/settings/business` still works.
- Existing pre-Phase-4 users (created via dev email login) still log in
  via dev email login (when the flag is set in dev).

## 9 · Sign-off checklist

- [ ] Register → OTP → land on tenant home, signed in
- [ ] Wrong / expired / cooldown OTP behave correctly
- [ ] `/admin` reachable for super-admin only
- [ ] Non-admin gets `/access-denied?reason=admin`
- [ ] Dark theme toggle persists across reload
- [ ] `pnpm typecheck && pnpm build` clean
- [ ] Both `wapi` and `wapi.dev` still report **52 tables**
- [ ] Both DBs have the 4 system roles + 19 permissions seeded
- [ ] No password / OTP secret committed to git
