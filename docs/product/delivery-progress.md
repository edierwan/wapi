# WAPI Delivery Progress

Last updated: 2026-04-28

## Current status

- Public WAPI availability restored for both environments after another Coolify container-name rotation broke the edge proxy targets.
- `wapi-dev.getouch.co` health is back to `200`.
- `wapi.getouch.co` health is back to `200`.
- A host-side sync helper now updates the Caddy upstreams against the current Coolify WAPI containers.
- A recurring VPS cron now runs that sync helper every 5 minutes to reduce future `502` windows after WAPI redeploys.
- **Phase 5 tenant UI tranche 1 is shipped** (contacts, Business Brain, AI Readiness card, minimal product/service create).
- **Phase 6 contract-ready WAPI surface is shipped** alongside the **Dify runtime foundation** (provider resolution, secret resolver, Dify client, tenant-scoped context assembly, manual HITL draft action). Live gateway behavior remains gated on Request 05.
- **Phase 7 functional tranche is shipped** (campaign composer, safety review, follow-up sequence UI, queue-backed dispatcher, tenant-scoped campaign surfaces).
- **Phase 7 remaining slice is shipped** (consent-aware safety review, reply-first runtime gating in the dispatcher, per-account warm-up + rate limit honored by the outbound worker, long-running follow-up auto-trigger executor, AI variant suggestion via Dify HITL, KPI panel on campaign detail).
- The Dify multi-tenant architecture plan is now updated to reflect actual shipped schema versus missing runtime integration.
- Omnichannel expansion has been reviewed as a later roadmap track; current shipped transport integration remains WhatsApp-first and should not be mistaken for the final channel model.

## Admin page status

- The current admin page is expected to be mostly `Coming soon`.
- The screenshot provided by the tester matches the intended shipped state:
  - admin layout rendered
  - `development` environment badge visible
  - `SYSTEM_SUPER_ADMIN` role chip visible
  - signed-in admin email visible
  - overview route active
  - sidebar rendered
  - placeholder module cards rendered
- This is not an incomplete bug for the current stage.
- It becomes missing functionality only when the plan explicitly moves into the admin-module tranche.

Interpretation for the next Coder AI round:

- do not spend the next round turning every admin card into a full module by default
- treat the admin shell as complete for now
- only build full admin modules if we explicitly choose to advance that phase

## Verified in this pass

### Availability and routing

- Dev health endpoint: `200`
- Prod health endpoint: `200`
- Anonymous `/admin` on dev redirects to `/login?next=/admin`
- Anonymous `/admin` on prod redirects to `/login?next=/admin`
- Anonymous `/admin/users` on dev redirects to `/login?next=/admin`

### Local build validation

- `pnpm typecheck` passes.
- `pnpm build` passes.
- Build output includes:
  - `/admin`
  - `/admin/abuse`
  - `/admin/ai`
  - `/admin/audit`
  - `/admin/billing`
  - `/admin/jobs`
  - `/admin/settings`
  - `/admin/system-health`
  - `/admin/tenants`
  - `/admin/users`
  - `/admin/wa-sessions`

### Live DB smoke checks

Both `wapi.dev` and `wapi` currently report:

- reference-data counts: `14|15|10|15|18|7|10`
  - `ref_countries = 14`
  - `ref_currencies = 15`
  - `ref_languages = 10`
  - `ref_timezones = 15`
  - `ref_industries = 18`
  - `ref_business_natures = 7`
  - `ref_brand_voices = 10`
- Phase 6 schema tables present: `2`
  - `message_queue`
  - `inbound_messages`
- Phase 7 schema tables present: `6`
  - `campaigns`
  - `campaign_variants`
  - `campaign_safety_reviews`
  - `campaign_recipients`
  - `followup_sequences`
  - `followup_steps`
- `permissions.code='system.admin.access'`: `1`
- total public tables: `52`

### Code-audit checks

- Admin permission usage is server-side and present in the expected WAPI surfaces:
  - `src/app/admin/layout.tsx`
  - `src/app/login/actions.ts`
- Phase 5 functional tenant UI shipped (tranche 1) with explicit tenant scoping on every query:
  - `src/server/contacts.ts`
  - `src/server/business-memory.ts`
  - `src/server/ai-readiness.ts`
  - `src/app/t/[tenantSlug]/contacts/{page,actions}.tsx` and `[contactId]/page.tsx`
  - `src/app/t/[tenantSlug]/brain/{page,actions}.tsx`
  - `src/app/t/[tenantSlug]/_catalog-actions.ts` (used by `products` and `services` pages)
  - `src/components/tenant/readiness-card.tsx` mounted on `/t/{slug}`
- Phase 6 contract-ready WAPI surface shipped (tranche 2):
  - `src/server/wa-gateway.ts` — single server-only HTTP wrapper for the shared gateway (createSession, getSessionStatus, getSessionQr, resetSession, deleteSession, sendText)
  - `src/server/whatsapp-sessions.ts` — tenant-scoped state helpers; `resolveTenantByAccount` is the canonical accountId→tenantId resolver
  - `src/server/wa-webhook-verify.ts` + `wa-webhook-handler.ts` — HMAC SHA256 timing-safe verification of `x-wapi-signature` against the raw body
  - `src/app/api/wa/webhooks/{qr,connected,disconnected,inbound,status}/route.ts` — verified receivers; `status` rejects cross-tenant queue updates with 404
  - `src/app/t/[tenantSlug]/whatsapp/{page,actions}.tsx` — owner/admin connect / reset / disconnect, falls back gracefully when `WA_GATEWAY_URL` is unset
  - `scripts/worker-outbound.ts` — outbound queue skeleton; documented as not yet long-running in production
- Dify runtime foundation shipped (tranche 2):
  - `src/server/ai-providers.ts` — provider resolution `tenant_ai_settings → tenant default → global default`, with cross-tenant guard; `resolveSecret` honors `env:NAME` indirection (and `literal:` only outside production)
  - `src/server/dify-client.ts` — `chatCompletion` wrapper for `POST /v1/chat-messages`; `buildConversationKey` enforces `tenant:<id>:hitl:<userId>` / `tenant:<id>:contact:<id>` and refuses bare phones
  - `src/server/ai-context.ts` — tenant-scoped context assembly from `tenant_business_profiles`, `products`, `services`, `business_memory_items`, contact stats; produces `inputs` envelope with `tenant_id` always present
  - `/t/[tenantSlug]/ai/draft/{page,actions,draft-reply-form}.tsx` — manual HITL draft assistant; never persists, never auto-replies
- Phase 7 functional tranche shipped (tranche 3, 2026-04-28):
  - `src/server/campaigns.ts` — tenant-scoped CRUD; audience preview filtered by tags + lead status + status; recipients materialization that honors the `(campaignId, contactId)` unique index; status transitions `draft → safety_review → scheduled → sending → completed/cancelled/failed`.
  - `src/server/campaign-safety.ts` — internal safety rule engine (length, prohibited words from `tenant_business_profiles.prohibited_words`, opt-out hint, all-caps shout) producing one-line summary + findings; `recordSafetyReview` persists snapshot.
  - `src/server/campaign-dispatcher.ts` — inserts `message_queue` rows with `purpose='campaign'` and links them back to `campaign_recipients.queueId`. Never invents a parallel queue. Skips inactive contacts as `excluded`.
  - `src/server/followups.ts` — sequence + steps CRUD, tenant-scoped via parent sequence.
  - tenant pages `/t/[slug]/campaigns`, `/t/[slug]/campaigns/[id]`, `/t/[slug]/followups`, `/t/[slug]/followups/[id]`.
  - status webhook now mirrors lifecycle into `campaign_recipients` via `queue_id` (still tenant-guarded by the existing webhook check).
  - Campaigns nav entry de-`soon`-ed.
  - Channel-agnostic where reasonable: campaigns do not encode WhatsApp specifics. Channel selection is implicit via the chosen account; future channels would add their own account-equivalent table without changing the campaigns API. The `message_queue` table already supports `purpose` and `payload`, so future channel rows do not need a parallel queue.

Interpretation:

- Phase 6 contract-ready WAPI side is now functional (HMAC verify, session lifecycle, owner/admin UI, Dify resolution + HITL draft).
- Live WhatsApp gateway behavior (real QR + real send + real status webhooks) still depends on Request 05.
- Phase 7 functional tranche is shipped, but it still has a follow-on tranche for AI variants, reply-first gating, worker hardening, KPIs, and consent-aware safety checks.
- The next real product tranche should not rebuild shipped Phase 6 or shipped Phase 7 foundations; it should validate them, then finish the remaining Phase 7 slice and keep omnichannel / Smart Customer Memory compatibility intact.

## Test-script result summary

### 08 — Phase 5

Tranche 1 functional UI shipped; partially verified.

Verified (automated):

- reference tables exist with expected seeded counts on both DBs
- onboarding reference-data backend exists in code
- build and route surfaces are healthy
- new tenant UI routes register in the build:
  - `/t/[tenantSlug]/contacts`
  - `/t/[tenantSlug]/contacts/[contactId]`
  - `/t/[tenantSlug]/brain`
- `pnpm typecheck` and `pnpm build` pass after the tranche

Not completed in this pass (needs interactive verification):

- end-to-end browser pass for contacts list/create/edit/delete + tag toggle
- Business Brain CRUD across the six kinds in a browser session
- `Recompute & save` button persists a row in `ai_readiness_scores`
- product / service create form persists rows
- hidden-field tamper validation through the live forms

### 09 — Phase 6 (contract-ready)

Schema verified earlier. WAPI-side contract surface now shipped and validated by `pnpm typecheck` + `pnpm build`.

Verified:

- `message_queue` and `inbound_messages` exist on both DBs.
- New routes register in the build output:
  - `/api/wa/webhooks/qr`
  - `/api/wa/webhooks/connected`
  - `/api/wa/webhooks/disconnected`
  - `/api/wa/webhooks/inbound`
  - `/api/wa/webhooks/status`
  - `/t/[tenantSlug]/ai/draft`
- HMAC SHA256 timing-safe verification implemented in `src/server/wa-webhook-verify.ts`.
- Cross-tenant guard in `/api/wa/webhooks/status`: a queue row whose tenant differs from the resolved account returns 404.
- Dify provider resolver drops a `default_provider_id` that points to a different tenant's row.
- Dify client refuses bare-phone conversation keys.

Not completed in this pass (needs interactive verification — see `docs/request/13-test-phase6-contract-ready.md`):

- end-to-end browser pass for connect / reset / disconnect on `/t/{slug}/whatsapp`
- live curl-driven webhook signature exercise (qr/connected/disconnected/inbound/status)
- live Dify call with a real `DIFY_DEFAULT_API_KEY`
- outbound worker dry-run with a queued row

### 10 — Phase 7

Schema verified. Functional tranche shipped (tranche 3).

Verified (automated):

- all six Phase 7 tables exist on both DBs
- new tenant routes register in the build:
  - `/t/[tenantSlug]/campaigns`
  - `/t/[tenantSlug]/campaigns/[campaignId]`
  - `/t/[tenantSlug]/followups`
  - `/t/[tenantSlug]/followups/[sequenceId]`
- every server function in `campaigns.ts`, `campaign-safety.ts`,
  `campaign-dispatcher.ts`, and `followups.ts` filters by `tenant_id`
  (variants/steps go through their tenant-scoped parent)
- `campaign-dispatcher.ts` inserts into the existing `message_queue` with
  `purpose='campaign'`; it does not create a parallel queue
- status webhook mirrors lifecycle into `campaign_recipients`
- `pnpm typecheck` and `pnpm build` pass after the tranche

Not completed in this pass (needs interactive verification — see
`docs/request/14-test-phase7-campaigns.md`):

- end-to-end browser pass for composer / safety review / schedule
- cross-tenant URL probe for campaign and sequence detail
- worker dry-run with a campaign-queued row, then status-webhook replay

### 11 — Admin console shell

Partially verified.

Verified:

- `/admin` shell routes are built
- placeholder admin sub-routes are built
- anonymous access redirects to `/login?next=/admin`
- admin permission enforcement is server-side in `src/app/admin/layout.tsx`
- tester-provided signed-in screenshot matches the expected placeholder shell state

Not completed in this pass:

- authenticated super-admin happy-path browser pass
- placeholder tile click-through as a signed-in admin
- non-admin signed-in redirect to `/access-denied?reason=admin`
- mobile/narrow viewport visual check

## Interactive validation status (this round)

The interactive checks listed below remain owned by the human tester. Each
request doc is now in one of three states:

- **automated-verifiable parts: confirmed by Coder AI** in the current
  build (typecheck, build, route registration, server-side guard logic,
  signature verification, cross-tenant guards, conversation-key invariants).
- **interactive parts: pending tester pass** (browser sessions, live curl
  webhook calls, live Dify call with a real `DIFY_DEFAULT_API_KEY`, mobile
  viewport check, super-admin happy-path).
- **out of scope here**: anything blocked by Request 05 stays explicitly
  blocked.

### Test 08 — Phase 5 tenant UI tranche 1

- Automated-verifiable: confirmed (build/typecheck pass; routes registered;
  every server module filters by `tenant_id`).
- Interactive: pending tester pass for contact CRUD + tag toggle, Business
  Brain CRUD, `Recompute & save`, product/service create form, and
  hidden-field tamper.
- No real defects found in this round; Phase 5 tranche 1 stays shipped.

### Test 13 — Phase 6 contract-ready

- Automated-verifiable: confirmed. HMAC verify is timing-safe; cross-tenant
  guards (`status` webhook + Dify provider resolver) are in place;
  `wa-gateway.ts` is `server-only`; `isValidConversationKey` rejects bare
  phones; `assembleTenantContext` filters every query by `tenant_id`.
- Interactive: pending tester pass for the connect/reset/disconnect flow,
  curl-driven webhook signature exercise, live Dify call with a real key,
  outbound-worker dry-run.
- No real defects found in this round; Phase 6 contract-ready stays shipped.

### Test 11 — Admin console shell

- Automated-verifiable: confirmed. All 11 admin routes register; layout
  RBAC gate is server-side via `system.admin.access`.
- Interactive: pending tester pass for super-admin happy path and tile
  click-through. Placeholder `Coming soon` modules are expected and are
  NOT regressions.
- No real defects found in this round.

## Local environment note

- `pnpm db:seed` exiting with code `1` in one local run was caused by a missing local `.env.local`, not by an application defect in the shipped Phase 5/6/7 work.

## Blockers and limits in this pass

- I do not have the current super-admin password in this conversation, so I could not complete the signed-in admin browser checks from Test 11.
- I could not perform the fully interactive onboarding/browser checks from Test 08 without a prepared login session and test-tenant flow in this pass.
- OTP is already confirmed working by the human tester, so I did not reopen that path.
- Request 05 remains the external gateway blocker for true multi-tenant WhatsApp readiness.

## External dependency status

### Request 05 — gateway multi-tenancy

Still blocked externally.

- WAPI Phase 6 schema is ready to receive gateway integration.
- WAPI contract-ready app-side integration is shipped.
- The remaining blocker is live external gateway behavior: real QR, real send, and real session-scoped webhook traffic.
- The gateway itself is still the controlling external dependency for session-scoped WhatsApp readiness.

## Recommended next tranche for Coder AI

Coder AI should use this file as the current-state source of truth and update it after each meaningful validation or delivery step.

Workspace prompt prepared for the next round:

- [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md)
- short handoff pointer: [coder-ai-next-phase-brief.md](./coder-ai-next-phase-brief.md)

### Immediate next actions

1. Complete the remaining interactive checks for Test 08, Test 11, Test 13 contract-ready, and Test 14 Phase 7 campaigns.
2. Continue the remaining Phase 7 tranche instead of rebuilding shipped Phase 6/Dify or already-landed campaign surfaces.
3. Prioritize the unfinished Phase 7 items:
  - AI variant suggestion via Dify HITL
  - reply-first runtime gating
  - per-number rate limit / warm-up
  - long-running follow-up executor
  - KPIs panel
  - consent integration inside the safety review
4. Keep Request 05 as the external blocker for live WhatsApp behavior.
5. Preserve omnichannel and Smart Customer Memory compatibility while extending inbox, campaign, and follow-up abstractions.
6. Keep this file updated as the live progress ledger.

### Planning guardrail for the next round

Coder AI should split the next work into two choices instead of mixing them:

1. finish the functional Phase 5, 6, and 7 tranches that directly improve tenant-facing behavior and WhatsApp readiness
2. separately schedule the full admin-module tranche later

Recommended priority:

1. interactive validation and defect close-out for shipped Phase 5, Phase 6 contract-ready, and Phase 7 functional work
2. remaining Phase 7 tranche items
3. omnichannel architecture and roadmap prep for future inbox/channel expansion
4. Smart Customer Memory compatibility while shaping inbox/follow-up work
5. release hardening and blocker tracking
6. only then full admin modules unless business priorities change

### Specific corrections to prior planning

1. The admin shell is shipped and real now.
2. The admin nav shape is `11` total entries: `1` overview route plus `10` placeholder module routes.
3. Phase 6 is functional contract-ready and Phase 7 already has a shipped functional tranche; remaining work is follow-on tranche work, not a reset.
4. WAPI release-readiness should be separated from later roadmap tranches like full admin modules and campaign UI.
5. The current admin screenshot should be treated as a pass for the shell state, not evidence that the shell failed.
6. Dify in WAPI is no longer only schema-and-architecture ready; the first runtime foundation is now shipped.
7. Shared Dify is acceptable for MVP only if WAPI remains the tenancy boundary and tenant context is resolved in WAPI first.
8. Tenant-dedicated Dify is a later upgrade path, not the first implementation target.
9. Omnichannel support is not part of MVP, but future inbox/campaign work should avoid hard-coding WhatsApp-only assumptions into shared abstractions.
10. Smart Customer Memory is planning-approved and future inbox/customer/follow-up work should not block `tenant_id + normalized_phone_number` memory identity.

## Suggested plan enhancement

The roadmap needed one explicit addition so Coder AI does not miss release work that is neither pure product UI nor pure external dependency:

- release hardening and operational close-out

That includes:

- deploy-health verification
- outage/runbook coverage
- doc alignment
- regression execution against the active request docs

This matters because WAPI availability was already impacted more than once by edge-proxy drift even while app code was healthy.

## Operational note

The `502 Bad Gateway` incident on `wapi-dev.getouch.co` and `wapi.getouch.co` was caused by stale Caddy upstream names after Coolify rotated the app containers again.

Permanent mitigation now applied on the VPS:

- `/home/deploy/apps/getouch.co/scripts/sync-wapi-caddy-upstreams.sh`
- cron every 5 minutes to refresh WAPI upstreams and restart Caddy only when targets change

This is not a WAPI app-code defect, but it directly affects WAPI availability and therefore belongs in the delivery ledger.