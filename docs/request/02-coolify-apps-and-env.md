# Request 02 — Coolify apps + environment variables

We need **two** Coolify applications for this repo.

## App 1 — `wapi` (production)

- Repository: `edierwan/wapi`
- Branch: `main`
- Domain: `wapi.getouch.co`
- Build provider: Nixpacks (auto)
- Healthcheck: `GET /api/health`, port `3000`, expect `200`

### Environment Variables (production)

```
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=WAPI
NEXT_PUBLIC_APP_URL=https://wapi.getouch.co
NEXT_PUBLIC_APP_ENV=production
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@getouch-postgres:5432/wapi
NIXPACKS_NODE_VERSION=22
```

Replace `POSTGRES_USER` and `POSTGRES_PASSWORD` with the real
credentials for the `getouch-postgres` service (see
[03-postgres-credentials.md](./03-postgres-credentials.md)).

---

## App 2 — `wapi-dev` (development)

- Repository: `edierwan/wapi`
- Branch: `develop`
- Domain:
  - **Recommended short-term:** `wapi-dev.getouch.co`  (first-level subdomain, covered by Universal SSL, works today)
  - **Long-term:** `dev.wapi.getouch.co`  (needs wildcard SSL — see [01-cloudflare-ssl-wildcard.md](./01-cloudflare-ssl-wildcard.md))
- Build provider: Nixpacks (auto)
- Healthcheck: `GET /api/health`

### Environment Variables (development)

```
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=WAPI
NEXT_PUBLIC_APP_URL=https://wapi-dev.getouch.co
NEXT_PUBLIC_APP_ENV=development
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@getouch-postgres:5432/wapi.dev
NIXPACKS_NODE_VERSION=22
```

> `NODE_ENV=production` is intentional — it tells Next.js to serve the
> optimized build. Use `NEXT_PUBLIC_APP_ENV=development` for
> application-level env decisions.

> The DB name `wapi.dev` (with a dot) is **valid** inside a URL
> connection string. Coolify will pass it through unchanged.

## Confirmation checklist

- [ ] `wapi` app created on `main`, domain `wapi.getouch.co` set.
- [ ] `wapi-dev` app created on `develop`, domain set.
- [ ] Env vars pasted into both apps.
- [ ] Initial deploy succeeds on both.
- [ ] `curl -i https://wapi.getouch.co/api/health` returns 200 with `"environment":"production"`.
- [ ] `curl -i https://wapi-dev.getouch.co/api/health` returns 200 with `"environment":"development"`.
