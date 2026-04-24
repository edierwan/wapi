# Authentication & Authorisation (v2)

> Replaces the HMAC-only bridge. Introduces password login, phone OTP,
> system vs tenant role scopes, and a bootstrap-only super admin path.

Status: **Phase 4 — implemented (bridge session, bcrypt password,
WA-OTP register, scope-aware roles, `/admin` permission guard).**

## Principles

1. **Phone is onboarding, never a primary key.** Use `users.id` / `tenants.id`.
2. **Bootstrap credentials never live in code, migrations, docs, or git.**
3. **`/admin` access is permission-checked**, not email-checked.
4. **OTP is delivered server-side** through the WhatsApp gateway; frontend
   never touches the gateway secret.
5. **Verified-first**: a full tenant/user is created only *after* OTP verify.
6. **Public registration is env-flagged** off by default in production.

## Identity scopes

Authorisation has **two scopes**:

### System scope (WAPI / Getouch internal)

Roles: `SYSTEM_SUPER_ADMIN` · `SYSTEM_ADMIN` · `SYSTEM_SUPPORT` · `SYSTEM_BILLING`

Backed by:

- `roles` where `scope_type = 'system'` and `tenant_id IS NULL`
- `user_system_roles(user_id, role_id, status)` links users to system roles

### Tenant scope

Roles (MVP enum): `owner` · `admin` · `agent` · `viewer`

Backed by:

- `tenant_members(tenant_id, user_id, role, status)` — already exists
- `roles` where `scope_type = 'tenant'` (template rows, available to all tenants)
- Later: `tenant_members.role_id` can replace the enum when we need custom
  tenant roles. For MVP both coexist; enum is authoritative.

## Tables

```
users
  id, email, name, phone, password_hash, email_verified,
  is_system_admin (legacy bool, kept for migration; check role instead),
  status, image, created_at, updated_at

sessions
  id, user_id, token, expires_at, ip_address, user_agent, created_at

roles
  id, tenant_id nullable, code, name, description, is_system_role,
  scope_type ('system'|'tenant'), created_at, updated_at

permissions
  id, code unique, module, action, description

role_permissions
  id, role_id, permission_id

user_system_roles
  id, user_id, role_id, status, assigned_by_user_id, created_at, updated_at

tenant_members
  id, tenant_id, user_id, role (enum), status, created_at, updated_at
```

### Phase-4 additions

```
phone_verifications
  id, user_id nullable, phone, code_hash, purpose ('register'|'login'|...),
  expires_at, verified_at, attempts, max_attempts, provider,
  provider_message_id, created_at

pending_registrations
  id, business_name, full_name, email, phone, password_hash,
  business_nature nullable, number_of_agents nullable,
  tenant_slug_candidate, expires_at, verified_at, created_at
```

## Permission catalogue

### System permissions
`system.admin.access` · `tenants.read` · `tenants.manage` ·
`users.read` · `users.manage` · `billing.read` · `billing.manage` ·
`wa_sessions.read` · `wa_sessions.manage` · `ai_providers.read` ·
`ai_providers.manage` · `jobs.read` · `jobs.manage` ·
`audit_logs.read` · `settings.manage`

### Tenant permissions
`tenant.dashboard.read` · `tenant.settings.manage` ·
`members.read` · `members.manage` ·
`contacts.read` · `contacts.write` ·
`products.read` · `products.write` ·
`services.read` · `services.write` ·
`campaigns.read` · `campaigns.create` · `campaigns.approve` · `campaigns.send` ·
`inbox.read` · `inbox.reply` ·
`wa_accounts.read` · `wa_accounts.manage` ·
`ai.use` · `billing.read` · `billing.manage`

## Flows

### Registration (`/register`)

1. User fills: `business_name`, `full_name`, `email`, `phone`,
   `password`, `confirm_password`, optional `business_nature`, `number_of_agents`.
2. Server validates, hashes password (bcrypt), derives slug candidate.
3. Server creates a row in `pending_registrations`.
4. Server creates `phone_verifications` row (hash only, 4-digit, 10-min expiry).
5. Server posts to WhatsApp gateway (server-side) to deliver OTP message.
6. Response redirects to `/verify-phone?pr={id}`.

Message template:

> Your WAPI verification code is **{code}**. It expires in 10 minutes.
> Do not share this code.

### Verify (`/verify-phone`)

1. User enters 4-digit code.
2. Server: compare hash, check attempts < max, check not expired.
3. On success:
   - Resolve a unique slug (append `-2`, `-3`… if taken; fallback `wa{phone}`).
   - Create `users` row (copy `password_hash` from `pending_registrations`).
   - Create `tenants` row.
   - Create `tenant_business_profiles` row (nature from form).
   - Create `tenant_settings` row.
   - Create `tenant_ai_settings` row.
   - Create `tenant_members(role='owner', status='active')`.
   - Mark `pending_registrations.verified_at`, delete `phone_verifications` row.
   - Issue a session cookie.
   - Redirect to `/t/{tenantSlug}`.

### Login (`/login`)

- If `ENABLE_DEV_EMAIL_LOGIN=true` → keep email-only bridge login (dev).
- Otherwise: email + password → bcrypt compare → session.

### `/admin`

Guard: user must have a row in `user_system_roles` with `status='active'`
whose `role` has the permission `system.admin.access`. Simpler interim
rule: user has *any* active `user_system_roles` row whose role has
`code LIKE 'SYSTEM_%'`.

## Bootstrap

```bash
pnpm db:bootstrap:admin
```

Reads **env only** (never args, never code):

```
BOOTSTRAP_SUPER_ADMIN_EMAIL
BOOTSTRAP_SUPER_ADMIN_PASSWORD
BOOTSTRAP_SUPER_ADMIN_NAME
```

Behaviour:

1. Create base system & tenant roles if missing (by `code`).
2. Create base permissions if missing (by `code`).
3. Grant all system permissions to `SYSTEM_SUPER_ADMIN`.
4. Upsert the admin user (bcrypt-hash the env password).
5. Upsert `user_system_roles` row → role = `SYSTEM_SUPER_ADMIN`.
6. Never print the password, never log it, never echo it.
7. Idempotent: safe to rerun.

## Feature flags

| Flag | Default | Purpose |
|---|---|---|
| `ENABLE_PUBLIC_REGISTRATION` | `false` | Gate `/register` in production |
| `ENABLE_DEV_EMAIL_LOGIN` | `false` | Keep email-only bridge login for dev |
| `ENABLE_DEV_OTP_FALLBACK` | `false` | Return the OTP code in the server response (dev only) |

## WhatsApp gateway call

Abstracted behind `sendOtpViaProvider({ phone, code, provider })`.
Provider `whatsapp_gateway`: POST to `${WA_GATEWAY_URL}/send` with header
`x-wapi-secret: ${WA_GATEWAY_SECRET}`, body
`{ to, text, purpose: 'otp' }`. Failures are logged (never include the code).

## Security notes

- Password stored as bcrypt (cost 12).
- OTP stored as SHA-256 hash (we don't need bcrypt for 10-min tokens).
- OTP attempts capped at 5, cooldown 60 s between resends.
- Session cookie is HMAC-signed + httpOnly + Secure in prod.
- Reserved slugs list enforced in `src/lib/slug.ts`.
- CSRF: forms go through Next.js server actions (no cross-origin by default).
- Do not trust `tenant_id` or `role` from client input — always re-resolve.
