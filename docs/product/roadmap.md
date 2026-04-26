# WAPI roadmap

High-level phasing. Each phase ends with a shippable slice. Times are
intentionally **not** dated — we move when a phase is genuinely done.

## Document rule

- This file is the stable phase map and future-direction document.
- Live delivery status, blockers, validation state, and the next active tranche must be maintained only in [delivery-progress.md](./delivery-progress.md).
- Do not create additional progress handoff docs unless explicitly requested.

## MVP cut line

MVP = Phase 1 → Phase 6 (end of safe queued sending).
Everything after is post-MVP.

## Current execution state

- Phase 1 through Phase 4 are shipped.
- Phase 5 foundation is partially shipped:
	- reference/master data schema
	- onboarding redesign data model and live form flow
	- contacts/business-memory/AI-readiness schema
	- admin shell and placeholder admin routes
- Phase 5 tenant UI tranche **1 is shipped**:
	- contacts list + create + edit + delete (tenant-scoped)
	- contact tags CRUD + per-contact toggle
	- Business Brain CRUD (`business_memory_items`) on `/t/{slug}/brain`
	- AI Readiness card on the tenant overview with components, recommendations, and `Recompute & save` action
	- guided product master editor on `/t/{slug}/products`
	- minimal service create flow on `/t/{slug}/services`
- Phase 5 remaining work for later tranches: CSV import, MinIO media uploads, full wizard steps 3–7
- Phase 6 contract-ready WAPI surface is shipped (gateway client wrapper, HMAC-verified webhook receivers, `whatsapp_sessions` lifecycle, owner/admin connect UI, outbound worker skeleton, Dify provider resolution, secret resolver, Dify client, tenant-scoped context assembly, manual HITL draft action). Live gateway behavior is still gated on [Request 05](../request/05-wa-gateway-multitenancy.md).
- Phase 7 functional tranche is shipped on 2026-04-28, including the remaining slice: composer, variant editor, consent-aware safety review, follow-up sequence UI, queue-backed dispatcher, reply-first runtime gating, per-account warm-up/rate-limit support, long-running follow-up executor, Dify HITL variant suggestion, and campaign KPIs.
- Omnichannel expansion is planned after MVP; Phase 6 remains intentionally WhatsApp-first while shared inbox and campaign abstractions should be designed to expand later.

This distinction matters:

- shipped schema or shell does not mean the full phase is done
- the initial admin-module tranche is now partially shipped; only billing, audit, and abuse remain placeholder-only
- gateway multi-tenancy remains the main external blocker for true WhatsApp platform readiness

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

## Phase 4 — Registration, identity & authorisation ✅

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
- Minimal `/admin` placeholder gate shipped first here; the full admin shell expanded in later phases

## Phase 5 — Master data + onboarding redesign + contacts / business brain foundation ◐

Already shipped in this phase:

- reference/master tables:
	- `ref_countries`
	- `ref_currencies`
	- `ref_languages`
	- `ref_timezones`
	- `ref_industries`
	- `ref_business_natures`
	- `ref_brand_voices`
- onboarding redesign:
	- dropdown-backed business profile form
	- country-driven currency/language/timezone cascade
	- brand-voice presets + custom notes
	- backward-compatible legacy text-column hydration
- schema landed for:
	- `contacts`
	- `contact_tags`
	- `contact_tag_assignments`
	- `contact_consents`
	- `business_memory_items`
	- `ai_readiness_scores`
- admin shell landed early so later modules can plug into stable chrome:
	- `/admin` overview
	- shared admin layout
	- 10 placeholder module routes

Still pending to complete the functional Phase 5 tranche:

- CSV import, bulk tagging, opt-out workflows (`opt_outs`)
- Product / service editor follow-through: product variants, service packages, service availability, MinIO-backed media uploads
- Wizard steps 3–7: WhatsApp · products/services · business memory · campaign goal · AI first-campaign draft
- richer AI Readiness signals (gateway connection, opt-in coverage, send history)

Shipped in tranche 1 of the functional Phase 5 work:

- contacts UI (list + create + edit + delete, tag CRUD, per-contact toggle)
- Business Brain UI (CRUD on `business_memory_items`)
- AI Readiness card on the tenant overview, with `Recompute & save` action persisting to `ai_readiness_scores`
- guided product master editor plus minimal service create flow

## Phase 6 — WhatsApp gateway integration + send test message ◐

Already shipped in this phase:

- schema foundation:
	- `message_queue`
	- `inbound_messages`
- WAPI still uses the gateway for OTP delivery
- Dify multi-tenant schema foundation already exists from earlier phases:
	- `ai_provider_configs`
	- `tenant_ai_settings`
- **WAPI-side Phase 6 contract-ready (shipped)**:
	- `src/server/wa-gateway.ts` single server-only HTTP wrapper
	- `src/server/whatsapp-sessions.ts` tenant-scoped session helpers
	- `src/server/wa-webhook-verify.ts` HMAC SHA256 timing-safe verification
	- `/api/wa/webhooks/{qr,connected,disconnected,inbound,status}` receivers
	- `/t/{slug}/whatsapp` connect / reset / disconnect UI (owner/admin only)
	- `scripts/worker-outbound.ts` outbound worker skeleton (manual run only; not yet long-running in production)
- **Dify runtime foundation (shipped)**:
	- `src/server/ai-providers.ts` provider resolution (tenant_ai_settings → tenant default → global default), with cross-tenant guard
	- `apiKeyRef` indirection resolver (`env:NAME` always; `literal:` dev-only, refused in production)
	- `src/server/dify-client.ts` minimal `chat-messages` wrapper + namespaced conversation key builder (refuses bare-phone keys)
	- `src/server/ai-context.ts` tenant-scoped context assembly from business profile, products, services, business memory, contact stats
	- `/t/{slug}/ai/draft` manual HITL draft assistant — reads tenant context, calls Dify, returns a draft, never persists

Still pending to complete the functional Phase 6 tranche:

- Consume `wa.getouch.co` per [request #05](../request/05-wa-gateway-multitenancy.md) (live gateway behavior)
- Test-send from UI (single recipient)
- Long-running outbound worker process (current code is a skeleton)

Important guardrail for this phase:

- shared Dify is acceptable for MVP only if WAPI remains the tenancy boundary
- tenant resolution must come from WAPI ownership (`tenant_id`, account, session, contact), not from Dify
- tenant-dedicated Dify stays a later upgrade path

## Phase 7 — Campaign composer + AI draft + Safety Assistant + queue send ◐

Already shipped in this phase:

- schema foundation:
	- `campaigns`
	- `campaign_variants`
	- `campaign_safety_reviews`
	- `campaign_recipients`
	- `followup_sequences`
	- `followup_steps`
- functional tranche (2026-04-28):
	- tenant-scoped server module `src/server/campaigns.ts` (list, get, create,
	  update, delete, status transitions, audience preview, recipients
	  materialization)
	- internal safety rule engine `src/server/campaign-safety.ts` (length,
	  prohibited words from `tenant_business_profiles.prohibited_words`,
	  opt-out hint, all-caps shout) producing one-line summary + findings
	- dispatcher `src/server/campaign-dispatcher.ts` that inserts
	  `message_queue` rows with `purpose='campaign'` and never invents a
	  parallel queue
	- follow-up sequences server module `src/server/followups.ts`
	- tenant pages `/t/[slug]/campaigns`, `/t/[slug]/campaigns/[id]`,
	  `/t/[slug]/followups`, `/t/[slug]/followups/[id]`
	- status webhook now mirrors lifecycle into `campaign_recipients` via
	  `queue_id`
	- composer covers draft → safety_review → scheduled → sending → cancelled
	  with owner/admin RBAC
	- Campaigns nav entry de-`soon`-ed

Still pending to complete the functional Phase 7 tranche:

- interactive tester validation from [14-test-phase7-campaigns.md](../request/14-test-phase7-campaigns.md)
- production operationalization of the manual worker scripts (`worker:outbound`, `worker:followups`) if/when you want them supervised continuously
- live WhatsApp behavior remains externally gated by [Request 05](../request/05-wa-gateway-multitenancy.md)

Phase 7 implementation guardrail after shipment:

- treat follow-on work here as validation, hardening, and operationalization
- do not reopen shipped campaign/follow-up surfaces unless validation finds a real defect

**End of MVP**

---

## Phase 8 — Omnichannel inbox + realtime + reply-to-action

Already shipped in the admin tranche during this phase:

- `/admin/users` — test-ops user directory with reset/delete safeguards
- `/admin/tenants` — workspace directory
- `/admin/wa-sessions` — WAPI-side WhatsApp session monitor
- `/admin/jobs` — queue and worker status snapshot
- `/admin/ai` — AI provider registry/status
- `/admin/settings` — read-only runtime/config summary

Still pending later in the admin roadmap:

- `/admin/billing`
- `/admin/audit`
- `/admin/abuse`
- deeper tenant detail pages and audited support-mode flows

- `inbox_threads`, `inbox_messages`, `message_events`, `ai_suggested_replies`, `assignments`
- Inbound → Postgres LISTEN/NOTIFY → SSE to browser
- channel-agnostic inbox/domain model so shared surfaces do not assume WhatsApp-only identity or webhook shapes
- connector / adapter pattern for future channels
- foundation for WAPI Customer Memory Core: customer identity, conversation continuity, and memory-backed follow-up
- **Hot Lead Detection** classifier (Dify agent)
- **Follow-up Engine** (suggest-and-create tasks)
- Reply Funnel / Conversation Funnel analytics
- Agent assignment, timelines, per-agent metrics

Planned channel rollout after MVP:

- Wave 1: WhatsApp hardening, Facebook Messenger, Instagram
- Wave 2: website live chat, email, LINE OA
- Wave 3: TikTok, Shopee, Lazada with marketplace-aware modeling where needed

Important guardrail for omnichannel expansion:

- do not overload `whatsapp_sessions` into a fake universal channel table
- keep WAPI tenant ownership and AI isolation rules identical across all channels
- marketplace connectors may need order/comment semantics beyond plain chat threads

## Planned enhancement — WAPI Customer Memory Core

Preferred product-facing name: **Smart Customer Memory**

This enhancement turns WAPI from only WhatsApp blast + AI automation into a
tenant-owned memory platform where each business can remember customers,
continue conversations naturally, and follow up with context.

Planning anchors:

- customer identity is scoped by `tenant_id + normalized_phone_number`
- tenant knowledge memory remains separate from customer memory
- conversation memory uses recent messages + compressed summary rather than
	full raw chat replay every time
- WAPI builds the context and owns the memory records before calling Dify
- Dify is the workflow / agent layer, not the memory system of record
- privacy controls must later support delete, export, tenant disable, and
	per-customer disable

Future tables and flows are documented in:

- [customer-memory-core.md](../architecture/customer-memory-core.md)

Recommended placement:

- start foundation work with the inbox / conversation model in Phase 8
- deepen into tenant CRM memory surfaces and lifecycle controls in later phases

## Phase 9 — Analytics + admin console v1 + audit + abuse monitor

- Tenant KPI dashboard
- Full `/admin` modules: tenants, users, WA sessions, queues, AI usage, error logs, audit logs
- **Admin abuse / risk monitor** (tenant-level send risk signals)
- Full `audit_logs` coverage
- Webhook event log viewer

Admin expectation before this phase:

- `/admin` is expected to show mostly `Coming soon` modules
- the shell, layout, nav, RBAC gate, theme toggle, and placeholder routes are already shipped
- Coder AI should not treat placeholder admin cards as regressions unless the work is explicitly moved into this phase

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
- Omnichannel inbox beyond the current WhatsApp-first foundation (IG / Messenger / web chat / marketplace connectors)

These are real demands — they are just later.

---

## Release hardening gate

Before final delivery is considered complete, the plan also needs an operational close-out pass:

- permanent public-routing stability for WAPI environments
- deployment health checks and post-deploy smoke verification
- regression sweep across the active request docs
- doc alignment between shipped behavior, request docs, and architecture docs
- runbook coverage for recurring incidents such as edge proxy drift

This is not a separate product phase, but it is part of the release bar and should not be skipped.
