# Migration log

This is a human log of every SQL migration file in `drizzle/` and
whether it has been applied to each WAPI database.

Databases (on `getouch-postgres` container inside `100.84.14.93`):

- **wapi** (production) — owner `getouch`
- **wapi.dev** (development) — owner `admin@getouch.co`

Both share the same physical Postgres instance. Schema must match.

| # | File | Generated | Applied to `wapi` | Applied to `wapi.dev` | Notes |
|---|---|---|---|---|---|
| 0000 | `drizzle/0000_parallel_mole_man.sql` | Phase 2 | ✅ | ✅ | Initial schema: users, sessions, tenants, tenant_members, tenant_settings, connected_accounts, whatsapp_sessions, ai_provider_configs, tenant_ai_settings. |
| 0001 | `drizzle/0001_friendly_doomsday.sql` | Phase 3 | ✅ | ✅ | Adds tenant_business_profiles, products / product_categories / product_variants / product_prices / product_media / price_lists, services / service_categories / service_packages / service_package_items / service_availability, roles / permissions / role_permissions, audit_logs, api_keys, webhook_endpoints, storage_objects. |
| 0002 | `drizzle/0002_special_mentor.sql` | Phase 4 | ✅ | ✅ | Identity: adds `users.phone`, `users.password_hash`, `users.status`, `users.phone_verified`, `roles.scope_type`. Creates `user_system_roles`, `phone_verifications`, `pending_registrations`. 31 tables total. |
| RBAC-1 | `scripts/sql/0001_bootstrap_system_rbac.sql` | Phase 4 | ✅ | ✅ | Idempotent seed: 19 system permissions, 4 system roles (`SYSTEM_SUPER_ADMIN`/`ADMIN`/`SUPPORT`/`BILLING`), role↔permission mappings. Re-runnable. Applied via `docker exec ... psql -f`. |
| ADMIN-1 | (one-shot, not tracked) | Phase 4 | — | ✅ wapi.dev only | Bootstrapped `admin@getouch.co` (Getouch Admin) with bcrypt password hash and `SYSTEM_SUPER_ADMIN` role. SQL composed from local env via `pnpm db:bootstrap:admin` flow (password never committed). Run on production via Coolify exec: `BOOTSTRAP_SUPER_ADMIN_EMAIL=… BOOTSTRAP_SUPER_ADMIN_PASSWORD=… pnpm db:bootstrap:admin`. |

## How to apply a new migration

The agent runs this itself via SSH. Do not run by hand unless needed.

```bash
# from local workspace
sshpass -p '<pw>' scp drizzle/000X_*.sql deploy@100.84.14.93:/tmp/wapi_000X.sql
sshpass -p '<pw>' ssh deploy@100.84.14.93 \
  'docker cp /tmp/wapi_000X.sql getouch-postgres:/tmp/ && \
   for db in wapi "wapi.dev"; do \
     docker exec getouch-postgres psql -U getouch -d "$db" -v ON_ERROR_STOP=1 -f /tmp/wapi_000X.sql; \
   done'
```

After a successful run, update this table.

## Rollbacks

Drizzle does not generate down-migrations. Rollbacks are **manual** SQL.
If a migration fails mid-way, the transaction-per-statement nature of
Drizzle migrations means the DB may be in a half-state — always run with
`-v ON_ERROR_STOP=1` and inspect the error before retrying.

For destructive recovery, restore from the Coolify Postgres backup.
