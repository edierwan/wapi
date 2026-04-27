# WAPI — WhatsApp-first SaaS Platform

Production: https://wapi.getouch.co
Future tenant pattern: https://{tenant}.wapi.getouch.co

WAPI is a WhatsApp-first SaaS for business messaging, marketing, inbox and
automation. This repository contains the Next.js 15 application that powers the
marketing site, authenticated dashboard (Phase 2), and initial API routes.

---

## 1. Goals of this repository

This repo is the **single Next.js application** for WAPI during Phase 1. It is
structured so that, later, parts of it (API, worker, WhatsApp session service)
can be extracted into separate services without rewriting the frontend.

| Area | Phase 1 (now) | Phase 2 | Phase 3+ |
|------|---------------|---------|----------|
| Marketing site | ✅ Landing, /login stub, /health | Keep | Keep |
| Auth | Placeholder UI only | Better Auth | Better Auth + SSO |
| Multi-tenant | Routing scaffold + docs | Path-based `/t/{tenant}` | Subdomain `{tenant}.wapi.getouch.co` |
| DB | Drizzle config + placeholder schema | Full schemas, migrations | Sharding/read replicas |
| Queue | Not yet | Redis + BullMQ | Dedicated worker service |
| WhatsApp | Not yet | Baileys session service | Multi-number orchestration |
| AI | Not yet | Dify / Ollama integration | — |

---

## 2. Technical stack (confirmed)

- **Framework**: Next.js 15 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui (Radix primitives) + lucide-react
- **Database**: PostgreSQL (prod: `wapi`, dev: `wapi.dev`)
- **ORM**: Drizzle ORM + drizzle-kit
- **Auth**: Better Auth (planned, not wired in Phase 1)
- **Queue**: Redis + BullMQ (planned)
- **WhatsApp**: Baileys (planned, in a future worker)
- **AI**: Dify / Ollama integration (planned)
- **Package manager**: pnpm
- **Node**: 22.x (matches Coolify `NIXPACKS_NODE_VERSION=22`)
- **Deployment**: Coolify via Nixpacks (Dockerfile also compatible)

---

## 3. Project structure

```
src/
  app/                 Next.js routes (App Router)
    (marketing)/       Public marketing routes (landing)
    login/             Auth placeholder
    health/            Healthcheck route (HTML)
    api/health/        JSON healthcheck endpoint
  components/
    ui/                shadcn/ui primitives
    marketing/         Landing page sections
    layout/            Navbar, Footer
  config/              App + marketing content (single source of truth)
  lib/                 Small utilities (cn, env, etc.)
  server/              Server-only helpers (reserved for Phase 2)
  db/                  Drizzle client + schema placeholder
  features/            Domain features (reserved for Phase 2+)
docs/
  architecture/        Architecture + tenant routing notes
  deployment/          Coolify, SSL, Cloudflare notes
  request/             Action items for the repo owner
```

---

## 4. Phase 1 deliverables (this task)

- Clean Next.js 15 + TS + Tailwind + shadcn/ui scaffold
- Professional landing page at `/` (Hero, Features, How it works, Benefits,
  Pricing teaser, FAQ, Final CTA, Footer)
- `/login` placeholder page
- `/health` HTML page + `/api/health` JSON endpoint
- Responsive navbar + footer, no broken links
- SEO metadata, favicon, Open Graph
- `.env.example` for prod + dev
- Drizzle skeleton wired to env
- Wildcard SSL / tenant assessment in `docs/deployment/`
- Tenant routing strategy in `docs/architecture/`
- Coolify deployment notes
- Requests for the repo owner in `docs/request/`

### Acceptance criteria

1. `pnpm build` passes with **no TypeScript or lint errors**.
2. `/`, `/login`, `/health`, `/api/health` all render correctly.
3. Design feels modern, minimal, premium SaaS.
4. Fully responsive on mobile.
5. Code is ready for Phase 2 (auth + tenant) without rework.

---

## 5. Running locally

```bash
pnpm install
cp .env.example .env.local
# fill DATABASE_URL for wapi.dev if you want the DB client to connect
pnpm dev
# open http://localhost:3000
```

### Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Next dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm lint` | Next/ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Drizzle: generate SQL from schema |
| `pnpm db:migrate` | Drizzle: apply migrations |
| `pnpm db:studio` | Drizzle Studio |

---

## 6. Environment variables

See [.env.example](.env.example). Short summary:

| Variable | Prod | Dev | Notes |
|----------|------|-----|-------|
| `NODE_ENV` | `production` | `development` | |
| `NEXT_PUBLIC_APP_URL` | `https://wapi.getouch.co` | `http://localhost:3000` | |
| `NEXT_PUBLIC_APP_ENV` | `production` | `development` | Shown on `/health` |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/wapi` | `postgresql://USER:PASS@HOST:5432/wapi.dev` | |
| `NIXPACKS_NODE_VERSION` | `22` | `22` | Already set in Coolify |
| `BETTER_AUTH_SECRET` | — | — | Phase 2 |
| `REDIS_URL` | — | — | Phase 2 |

> ⚠️ The dev database name is `wapi.dev` (contains a dot). In a URL connection
> string the database name can be used as-is. Any raw `psql` command must
> quote it: `psql "host=... dbname=wapi.dev user=..."`.

---

## 7. Branching

- `main` → production (deploys to `https://wapi.getouch.co`)
- `develop` → development (Coolify dev deployment)

Work lands on `develop` first, then is promoted to `main` via PR.

---

## 8. Deployment (Coolify)

Coolify uses Nixpacks. The repo is compatible as-is.

- `NIXPACKS_NODE_VERSION=22` (already set in Coolify)
- Install: `pnpm install --frozen-lockfile`
- Build:   `pnpm build`
- Start:   `pnpm start`
- Healthcheck path: `/api/health`
- Port: `3000`

See [docs/deployment/coolify.md](docs/deployment/coolify.md) and
[docs/deployment/wildcard-ssl.md](docs/deployment/wildcard-ssl.md).

### SSH access reference

Internal server access currently uses the shared deploy account below.

```bash
ssh deploy@100.84.14.93
```

- User: `deploy`
- Host: `100.84.14.93`
- Password: `Turun@2020`

Use this only for internal WAPI deployment and operator tasks. Rotate the
credential if repository access broadens.

---

## 9. Multi-tenant strategy (summary)

Phase 2 ships **path-based tenants first** (`/t/{tenant}`), then migrates to
subdomain tenants (`{tenant}.wapi.getouch.co`) once wildcard SSL is provisioned.
See [docs/architecture/tenant-routing.md](docs/architecture/tenant-routing.md).

---

## 10. Not in this repo yet (intentionally)

- Campaign / inbox business logic
- WhatsApp session management (Baileys)
- Queue workers (BullMQ)
- Real auth flows (Better Auth)
- Billing
- Tenant admin UI

The code structure already reserves space for them (`src/features/`,
`src/server/`).
