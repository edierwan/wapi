# Request 03 — PostgreSQL credentials

The Coolify instance already runs a PostgreSQL service named
`getouch-postgres` with the database `wapi` and `wapi.dev` visible in
pgAdmin.

## Please confirm / provide

- [ ] **Hostname** used inside the Coolify network: likely `getouch-postgres`
      (service name). Confirm, or provide the private hostname.
- [ ] **Port**: `5432` unless changed.
- [ ] **Username** with read/write access to both `wapi` and `wapi.dev`.
- [ ] **Password** for that user (store in Coolify env, **not** in the repo).
- [ ] **Database `wapi.dev` exists** and is reachable by that user.

## Expected connection strings

```
# production
postgresql://<user>:<password>@getouch-postgres:5432/wapi

# development
postgresql://<user>:<password>@getouch-postgres:5432/wapi.dev
```

These are what go into `DATABASE_URL` in each Coolify app (see
[02-coolify-apps-and-env.md](./02-coolify-apps-and-env.md)).

## Notes

- **Do not** commit credentials to this repo. This file only describes
  the shape — paste the real secrets only into Coolify env.
- If you want a dedicated least-privileged user per DB (recommended
  for Phase 2), create `wapi_app` and `wapi_dev_app` with access
  restricted to each DB.
- Phase 1 does not read from the DB at runtime, so the app will start
  successfully even with an empty or wrong `DATABASE_URL`. Drizzle
  commands (`pnpm db:generate`, `pnpm db:migrate`) do need it.
