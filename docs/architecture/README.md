# Architecture notes

- [tenant-routing.md](./tenant-routing.md) — path vs subdomain; MVP decision (no ACM).
- [auth.md](./auth.md) — MVP bridge auth + migration path to Better Auth.
- [whatsapp-gateway.md](./whatsapp-gateway.md) — multi-tenant Baileys
  gateway contract; shared `wa.getouch.co` + per-tenant `gateway_url`.
- [ai-dify.md](./ai-dify.md) — shared Dify default with per-tenant override.

More notes will land here as the app grows (queue topology, rate limits,
analytics, etc.).
