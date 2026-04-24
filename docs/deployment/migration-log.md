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
