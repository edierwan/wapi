# Tenant routing strategy

## Summary

WAPI will serve multi-tenant traffic. There are two common shapes:

1. **Path-based** — `https://wapi.getouch.co/t/{tenant}/...`
2. **Subdomain-based** — `https://{tenant}.wapi.getouch.co/...`

Subdomain is the long-term goal. Path-based is the pragmatic starting
point because subdomain-based requires wildcard SSL at a
sub-subdomain level (`*.wapi.getouch.co`) — see
[`../deployment/wildcard-ssl.md`](../deployment/wildcard-ssl.md).

## Phase plan

| Phase | Tenant shape | What ships |
|-------|--------------|-----------|
| 1 (now) | none | Landing only, no tenants. |
| 2 | **path-based** `/t/{tenant}` | Tenant resolution in middleware, dashboard behind auth. |
| 3 | **subdomain** `{tenant}.wapi.getouch.co` | Flip a flag; path-based redirects to subdomain. |

## Code shape (Phase 2)

We will add a single `middleware.ts` at the app root that:

1. Reads the request — either `host` header (subdomain mode) or the first
   path segment `/t/{slug}` (path mode).
2. Resolves a tenant record from the DB.
3. Writes `x-tenant-id` / `x-tenant-slug` headers to the request before
   it reaches route handlers and server components.
4. Rejects unknown tenants with a clean 404.

A tiny helper `getTenantFromRequest(req)` lives in `src/server/tenant.ts`
and is the only place that has to change when we flip mode path → subdomain.

## Reserved routes

Certain hostnames/paths must **never** be treated as tenants:

- `www`, `app`, `api`, `admin`, `docs`, `status`, `health`
- `assets`, `_next`, `static`, `cdn`

This list lives in `src/config/tenants.ts` (to be added in Phase 2).

## Recommendation (locked for MVP)

**Path-based, no ACM.** We explicitly decided not to buy Cloudflare
Advanced Certificate Manager (~USD 10/month) for MVP validation.
Universal SSL covers `*.getouch.co` (so `wapi.getouch.co` works for
free) but does **not** cover `*.wapi.getouch.co`. Until we are paying
for ACM — or wire up DNS-01 Let's Encrypt — every tenant lives at
`wapi.getouch.co/t/{slug}`.

The flip to subdomain is a one-liner env change
(`TENANT_ROUTING_MODE=subdomain`) plus ACM/DNS work. No app code change.

## Why not start with subdomain?

- Requires a paid Cloudflare ACM cert or DNS-01 Let's Encrypt wiring _today_.
- Local development with subdomains is annoying (hosts file edits, `.localhost` caveats).
- Path-based lets us ship sooner and learn product shape first.
