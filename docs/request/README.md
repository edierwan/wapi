# Requests to the repo owner

Each file in this folder is a concrete action that **only you** can do
(usually in Cloudflare, Coolify, DNS, or secret stores). The code agent
cannot perform these and will not proceed until they are complete or
explicitly deferred.

## Open items

| # | File | Blocker? | Summary |
|---|------|----------|---------|
| 01 | [01-cloudflare-ssl-wildcard.md](./01-cloudflare-ssl-wildcard.md) | Not for MVP | Wildcard `*.wapi.getouch.co`. **Deferred** — MVP uses path-based tenants (no ACM). |
| 02 | [02-coolify-apps-and-env.md](./02-coolify-apps-and-env.md) | Blocks dev deploy | Create `wapi` + `wapi-dev` Coolify apps and paste the env vars. |
| 03 | [03-postgres-credentials.md](./03-postgres-credentials.md) | Blocks DB features (Phase 2) | Confirm DB user, password, hostname, and that DB `wapi.dev` exists. |
| 04 | [04-test-phase2.md](./04-test-phase2.md) | Test doc | Manual test script for Phase 2 (seed, UI flow, DB spot-checks). |
| 05 | [05-wa-gateway-multitenancy.md](./05-wa-gateway-multitenancy.md) | Blocks Phase 3 | Changes required to `wa.getouch.co` so it becomes tenant-aware. |

Mark an item as "done" by moving the file to `docs/request/done/` or
deleting it once confirmed in infra.
