# Requests to the repo owner

Each file in this folder is a concrete action that **only you** can do
(usually in Cloudflare, Coolify, DNS, or secret stores). The code agent
cannot perform these and will not proceed until they are complete or
explicitly deferred.

## Open items

| # | File | Blocker? | Summary |
|---|------|----------|---------|
| 01 | [01-cloudflare-ssl-wildcard.md](./01-cloudflare-ssl-wildcard.md) | Blocks subdomain tenants | Decide ACM vs DNS-01, provision wildcard cert for `*.wapi.getouch.co`. |
| 02 | [02-coolify-apps-and-env.md](./02-coolify-apps-and-env.md) | Blocks dev deploy | Create `wapi` + `wapi-dev` Coolify apps and paste the env vars. |
| 03 | [03-postgres-credentials.md](./03-postgres-credentials.md) | Blocks DB features (Phase 2) | Confirm DB user, password, hostname, and that DB `wapi.dev` exists. |

Mark an item as "done" by moving the file to `docs/request/done/` or
deleting it once confirmed in infra.
