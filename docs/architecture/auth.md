# Auth strategy

## MVP (now) — dev bridge auth

- Email-only sign-in (no password).
- On submit we upsert into `users`, create a `sessions` row, and set a
  signed cookie `wapi_session` (HMAC, 30 days).
- Lives at [src/server/auth.ts](../../src/server/auth.ts).
- Tables (`users`, `sessions`) already match the Better Auth default
  schema so we **do not migrate data** when we flip.

Known limits (acceptable for MVP validation, explicitly not for GA):

- No password, no magic link, no OAuth.
- Anyone who types an email becomes that user.
- `SESSION_SECRET` must be set to a strong random string in production
  (Coolify env) — otherwise a dev fallback is used and cookies are
  predictable.

## Phase 2 — Better Auth

Swap `src/server/auth.ts` for Better Auth handlers:

- Keep `getCurrentUser()` as the single public API so nothing else
  changes.
- Add OAuth providers (Google, GitHub), email + password, magic link.
- Better Auth will own `users` and `sessions`; our current tables are
  compatible in shape.

## Membership & authorization

Regardless of auth backend, tenant access is always checked by:

```ts
await resolveTenantBySlug({ slug, currentUserId });
```

which verifies a row in `tenant_members` with `status='active'`. The
client **never** sends a `tenantId`; the server always derives it from
the URL + the session.

## Roles

- `owner` — full control, including billing and deleting tenant.
- `admin` — manage members, WA accounts, settings.
- `agent` — work in inbox, send campaigns.
- `viewer` — read-only.

Role checks are centralized in `resolveTenantBySlug` which returns
`currentUserRole`. Feature flags like "can create campaign" are pure
functions of that role.
