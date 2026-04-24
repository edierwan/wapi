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

## Phase 3 — Business profile + master-data schema + WhatsApp accounts UI ✅

App-side only (gateway work gated on request 05).

- `tenant_business_profiles` (nature: product | service | hybrid | booking | lead_gen | support | other)
- Onboarding step 1 (business nature) shipped
- Schema: `products`, `product_categories`, `product_prices`, `product_variants`, `product_media`
- Schema: `services`, `service_categories`, `service_packages`, `service_package_items`, `service_availability`
- Schema: `roles`, `permissions`, `role_permissions`, `audit_logs`, `api_keys`, `webhook_endpoints`, `storage_objects`
- UI shells: `/t/{slug}/whatsapp`, `/t/{slug}/products`, `/t/{slug}/services`, `/t/{slug}/settings/business`
- Better Auth swap deferred → Phase 4

## Phase 4 — Registration, identity & authorisation ← **current**

- **User management**: password login (bcrypt), phone added to `users`, `status` column
- **Registration flow**: `/register` + `/verify-phone` with WhatsApp OTP
- OTP provider abstraction → WhatsApp gateway (server-side only)
- `phone_verifications` + `pending_registrations` tables (verified-first)
- **Identity scope model**: `roles.scope_type = system | tenant`, `user_system_roles`
- System roles: `SYSTEM_SUPER_ADMIN` · `SYSTEM_ADMIN` · `SYSTEM_SUPPORT` · `SYSTEM_BILLING`
- Tenant roles keep existing `member_role` enum for MVP and gain optional `role_id` link
- Bootstrap command: `pnpm db:bootstrap:admin` (env-driven, idempotent, no password in code)
- `/admin` page gated by permission `system.admin.access`
- Feature flags: `ENABLE_PUBLIC_REGISTRATION`, `ENABLE_DEV_EMAIL_LOGIN`, `ENABLE_DEV_OTP_FALLBACK`
- **Dark theme toggle** (light + dark, persisted via cookie)
- **Smart Business Setup Wizard** step 1 already shipped in Phase 3 — remaining steps tracked for Phase 5

## Phase 5 — Contacts + real product/service editor + Business Brain + remaining wizard steps

- `contacts`, `contact_lists`, `contact_tags`, `opt_outs`
- CSV import, bulk tagging
- Product / service create/edit UI (forms bound to Phase 3 schema)
- Business Memory editor (FAQ, hours, payment, policy)
- Wizard steps 3–7: WhatsApp · products/services · business memory · campaign goal · AI first-campaign draft
- **AI Readiness Score** widget on dashboard
- MinIO-backed media uploads (`storage_objects`)

## Phase 6 — WhatsApp gateway integration + send test message

- Consume `wa.getouch.co` per [request #05](../request/05-wa-gateway-multitenancy.md)
- QR connect flow, session health
- Test-send from UI (single recipient)
- `whatsapp_sessions` lifecycle wired

## Phase 7 — Campaign composer + AI draft + Safety Assistant + queue send

- `campaigns`, `campaign_audiences`, `campaign_messages`, `campaign_events`
- `campaign_safety_reviews` (internal checks + auto-fixes + user summary)
- AI drafter reads Business Brain + products/services
- **Smart Message Variation Engine** (A/B/C/D variants, grounded)
- **Reply-First Campaign Mode**
- **Campaign Safety Assistant** (auto-optimise; user sees summary, not checklist)
- Human approval UI (draft → pending_approval → approved → scheduled)
- BullMQ (or pg-boss) queue for scheduled + safe-send
- Per-number rate limit + warm-up mode
- Basic campaign KPIs

**End of MVP**

---

## Phase 8 — Smart inbox + realtime + reply-to-action

- `inbox_threads`, `inbox_messages`, `message_events`, `ai_suggested_replies`, `assignments`
- Inbound → Postgres LISTEN/NOTIFY → SSE to browser
- **Hot Lead Detection** classifier (Dify agent)
- **Follow-up Engine** (suggest-and-create tasks)
- Reply Funnel / Conversation Funnel analytics
- Agent assignment, timelines, per-agent metrics

## Phase 9 — Analytics + admin console v1 + audit + abuse monitor

- Tenant KPI dashboard
- Full `/admin` modules: tenants, users, WA sessions, queues, AI usage, error logs, audit logs
- **Admin abuse / risk monitor** (tenant-level send risk signals)
- Full `audit_logs` coverage
- Webhook event log viewer

## Phase 10 — Billing + plan enforcement

- `plans`, `subscriptions`, `invoices`, `payments`, `usage_counters`, `tenant_limits`, `billing_events`
- Stripe (international) + Billplz/ToyyibPay/SenangPay/iPay88 (MY)
- Plan-gated feature toggles
- Trial expiry flow

## Phase 11 — Industry template library + Business Memory Import + landing pages

- **Campaign Template Library by Industry** (clinic, salon, car dealer, property, F&B, training, retail, contractor)
- **Business Memory Import** (paste price list / FAQ → AI extract → human review → save)
- **Landing Page Builder** (template-based, public `/lp/{slug}`, form submissions → CRM)

## Phase 12 — MCP tools + dedicated Dify per premium tenant + advanced agents

- Internal MCP server exposing tenant-scoped read/draft tools (never send autonomously)
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
