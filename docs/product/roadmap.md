# WAPI roadmap

High-level phasing. Each phase ends with a shippable slice. Times are
intentionally **not** dated — we move when a phase is genuinely done.

## MVP cut line

MVP = Phase 1 → Phase 6 (end of safe queued sending).
Everything after is post-MVP.

---

## Phase 1 — Foundation ✅

Landing site, health routes, Coolify deploy, docs skeleton. Done.

## Phase 2 — Tenant foundation ✅

Auth bridge + Better Auth plan, `/t/{slug}`, dashboard, membership
guards, schema for tenants/members/settings/AI, first-pass docs,
drizzle migration 0000. Done.

## Phase 3 — Business profile + master-data schema + WhatsApp accounts UI  ← **next**

App-side only (gateway work gated on request 05).

- `tenant_business_profiles` (nature: product | service | hybrid | booking | lead_gen | support | other)
- Onboarding step: ask business nature + seed correct modules
- Schema: `products`, `product_categories`, `product_prices`, `product_variants`, `product_media`
- Schema: `services`, `service_categories`, `service_packages`, `service_package_items`, `service_availability`
- Schema: `roles`, `permissions`, `role_permissions`, `audit_logs`, `api_keys`, `webhook_endpoints`, `storage_objects`
- UI shells: `/t/{slug}/whatsapp`, `/t/{slug}/products`, `/t/{slug}/services`, `/t/{slug}/settings/business`
- Real Better Auth swap (email + Google OAuth)

## Phase 4 — Contacts + real product/service editor + Business Brain

- `contacts`, `contact_lists`, `contact_tags`, `opt_outs`
- CSV import, bulk tagging
- Product / service create/edit UI (forms bound to Phase 3 schema)
- Business Memory editor (tone, FAQ, prohibited words)
- MinIO-backed media uploads (`storage_objects`)

## Phase 5 — WhatsApp gateway integration + send test message

- Consume `wa.getouch.co` per [request #05](../request/05-wa-gateway-multitenancy.md)
- QR connect flow, session health
- Test-send from UI (single recipient)
- `whatsapp_sessions` lifecycle wired

## Phase 6 — Campaign composer + AI draft + approval + queue send

- `campaigns`, `campaign_audiences`, `campaign_messages`, `campaign_events`
- AI drafter reads Business Brain + products/services
- Human approval UI + safety score
- BullMQ (or pg-boss) queue for scheduled + safe-send
- Per-number rate limit + warm-up mode
- Basic KPIs per campaign

**End of MVP**

---

## Phase 7 — Smart inbox + realtime + reply-to-action

- `inbox_threads`, `inbox_messages`, `message_events`, `ai_suggested_replies`, `assignments`
- Inbound → Postgres LISTEN/NOTIFY → SSE to browser
- Intent classifier (Dify agent)
- Next-best-action buttons
- Agent assignment + read receipts

## Phase 8 — Analytics + admin console v1 + audit

- Tenant KPI dashboard
- `/admin` console for system admins: tenants, users, WA sessions, queues, AI usage, error logs, audit logs
- Full `audit_logs` coverage
- Webhook event log viewer

## Phase 9 — Billing + plan enforcement

- `plans`, `subscriptions`, `invoices`, `payments`, `usage_counters`, `tenant_limits`, `billing_events`
- Stripe (international) + Billplz/ToyyibPay (MY)
- Plan-gated feature toggles
- Trial expiry flow

## Phase 10 — MCP tools + dedicated Dify per premium tenant + advanced agents

- Internal MCP server exposing tenant-scoped read/draft tools
- Dedicated Dify app provisioning per paid tenant
- Agent workflows: outbound-sequence AI, follow-up AI, lead-scoring AI
- Cloud API provider as alternate gateway

---

## What MVP does NOT include

- Autonomous AI sending
- Subdomain tenant routing (requires Cloudflare ACM)
- Full enterprise billing (taxation, dunning, revenue recognition)
- Dedicated Dify per tenant
- Full MCP automation
- Accounting / GL
- Multi-channel (IG / Messenger / web chat)

These are real demands — they are just later.
