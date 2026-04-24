# Coolify deployment

Target server: `100.84.14.93` (Coolify host).
App type: Next.js (Nixpacks).

## 1. Application setup (per environment)

Create two Coolify applications pointing at the same repo:

| App name          | Git branch | Domain                      | DB name    |
|-------------------|------------|-----------------------------|------------|
| `wapi` (prod)     | `main`     | `wapi.getouch.co`           | `wapi`     |
| `wapi-dev` (dev)  | `develop`  | `wapi-dev.getouch.co` or `dev.wapi.getouch.co` | `wapi.dev` |

> Pick one dev hostname. `dev.wapi.getouch.co` is a **sub-subdomain** and
> will need the wildcard SSL work described in
> [wildcard-ssl.md](./wildcard-ssl.md). If you want to avoid that until
> later, temporarily use `wapi-dev.getouch.co` (first-level subdomain,
> covered by Universal SSL).

## 2. Build / run

Coolify's Nixpacks provider auto-detects Next.js. Confirm:

- **Install command**: `pnpm install --frozen-lockfile`
- **Build command**:  `pnpm build`
- **Start command**:  `pnpm start`
- **Port**: `3000`
- **Healthcheck path**: `/api/health`  (expected 200)

## 3. Environment variables

Coolify already sets `NIXPACKS_NODE_VERSION=22`. Keep it.

### Production (`wapi`)

```env
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=WAPI
NEXT_PUBLIC_APP_URL=https://wapi.getouch.co
NEXT_PUBLIC_APP_ENV=production
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@getouch-postgres:5432/wapi
NIXPACKS_NODE_VERSION=22
```

### Development (`wapi-dev`)

```env
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=WAPI
NEXT_PUBLIC_APP_URL=https://wapi-dev.getouch.co
NEXT_PUBLIC_APP_ENV=development
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@getouch-postgres:5432/wapi.dev
NIXPACKS_NODE_VERSION=22
SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
```

Replace `POSTGRES_USER` / `POSTGRES_PASSWORD` with the credentials from
the `getouch-postgres` service you already run in Coolify. The database
name `wapi.dev` is valid inside a URL connection string — no quoting
needed there. (If you ever run raw `psql`, quote it.)

If either the database username or password contains `@`, URL-encode it
inside `DATABASE_URL`. Example:

```env
DATABASE_URL=postgresql://admin%40getouch.co:Turun%402020@getouch-postgres:5432/wapi.dev
```

> `NODE_ENV=production` in the dev deployment is intentional — it tells
> Next.js to serve the optimized build. The _application-level_
> environment (used for copy like "Development" badges, toggles, etc.)
> comes from `NEXT_PUBLIC_APP_ENV=development`.

## 3.5 Required DB bootstrap before first login

The WAPI app does not create Phase 2 tables automatically on first run.
Before testing `/login`, apply the migration to the target database and
seed a demo user/workspace.

Example for `wapi.dev`:

```bash
psql "$DATABASE_URL" -f drizzle/0000_parallel_mole_man.sql
pnpm db:seed [email protected]
```

Minimum tables that must exist before `/login` works:

- `users`
- `sessions`
- `tenants`
- `tenant_members`
- `tenant_settings`

If these are missing, `/login` can crash with Postgres error
`relation "users" does not exist`.

## 4. Healthcheck

Coolify "Healthcheck" tab:

- Enabled: ✅
- Path: `/api/health`
- Method: `GET`
- Port: `3000`
- Expected status: `200`

## 5. Post-deploy verification

```bash
curl -i https://wapi.getouch.co/api/health
# → 200, JSON body: { status: "ok", app: "WAPI", environment: "production", ... }

curl -i https://wapi-dev.getouch.co/api/health
# → 200, JSON body: { status: "ok", app: "WAPI", environment: "development", ... }
```

## 6. Logs

Use the Coolify "Logs" tab. The app does not write logs to disk.
