# Architecture notes

Start with [modules.md](./modules.md) for the high-level map.

## Foundations
- [modules.md](./modules.md) — module map and tenant isolation rules.
- [tenant-routing.md](./tenant-routing.md) — path vs subdomain; MVP decision (no ACM).
- [auth.md](./auth.md) — bridge auth today → Better Auth.
- [auth-v2.md](./auth-v2.md) — Phase 4 authN/Z: password login, WhatsApp OTP, system vs tenant role scopes, bootstrap admin.
- [security.md](./security.md) — roles, permissions, API keys, audit, threat model.

## Data
- [master-data.md](./master-data.md) — tenant business profile, products, services, contacts, transactional pattern.
- [storage.md](./storage.md) — MinIO / `s3.getouch.co` object storage.

## Integrations
- [whatsapp-gateway.md](./whatsapp-gateway.md) — multi-tenant Baileys gateway contract.
- [ai-dify.md](./ai-dify.md) — shared Dify default with per-tenant override.
- [mcp-tools.md](./mcp-tools.md) — internal AI tool layer (Phase 10).
- [realtime.md](./realtime.md) — Postgres LISTEN/NOTIFY + SSE for inbox.
- [campaign-safety-assistant.md](./campaign-safety-assistant.md) — internal risk engine + auto-fix + user-friendly summary (Phase 7).
- [landing-pages.md](./landing-pages.md) — template-based landing pages for ads funnels (Phase 11).

## Platform
- [admin-console.md](./admin-console.md) — system-level console.
- [billing-and-payments.md](./billing-and-payments.md) — plans, usage, Stripe + MY gateways.
