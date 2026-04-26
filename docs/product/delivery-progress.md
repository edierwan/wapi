# WAPI Delivery Progress

Last updated: 2026-04-26 (product master tranche shipped, DB-migrated, deployed, and smoke-tested)

## Primary delivery ledger

- This is the single live source of truth for current status, blockers, validation state, and next actions.
- Update this file after each meaningful validation or delivery step.
- Use [roadmap.md](./roadmap.md) for stable phase direction only, not live progress tracking.
- Use [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md) as the reusable Coder AI prompt shell.
- Do not create extra brief or handoff files for routine progress updates.

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
- Local Phase 8b worker runtime defect fixed: standalone worker scripts no longer die on `Cannot find module 'server-only'` before the supervisor can run.
- Authenticated navigation now exposes a visible sign-out control on marketing, dashboard, and tenant headers, including normal laptop-width layouts.
- Registration now preserves already-entered non-password fields when server-side password validation fails; only password fields need to be re-entered.
- `/admin/users` copy is now production-style (`Delete user`, `Clear registration artifacts`) instead of test-only wording.
- `/admin/users` is now the first real test-ops admin module: global directory, tenant-membership visibility, system-role visibility, and guarded delete-user cleanup for repeated test cycles.
- **Phase 5 tenant UI tranche 2 is shipped**: `/t/{slug}/products` is now a guided product-master editor with tenant-scoped category quick-create, active currency/unit validation, primary image URL handling, AI selling/FAQ notes, view/edit actions, readiness hints, and future-ready schema support for bundles and marketplace mappings.
- `drizzle/0004_breezy_scarecrow.sql` is applied to both `wapi.dev` and `wapi`; `ref_units` is seeded in both databases.
- Request 05 was re-audited against the local gateway source. `getouch.co/services/wa/server.mjs` still runs one module-scoped socket and one shared auth directory, so true multi-tenant WhatsApp runtime remains blocked at the gateway layer.

## Admin page status

- The admin area is no longer mostly placeholder.
- Real admin modules currently shipped:
  - `/admin`
  - `/admin/users`
  - `/admin/tenants`
  - `/admin/wa-sessions`
  - `/admin/jobs`
  - `/admin/ai`
  - `/admin/settings`
  - `/admin/system-health`
- Remaining placeholder modules in this tranche:
  - `/admin/billing`
  - `/admin/audit`
  - `/admin/abuse`
- `/admin/users` is the immediate tenant-QA unblocker:
  - inspect global users
  - inspect tenant memberships
  - inspect system roles
  - search by email / name / phone
  - clear pending-registration and OTP rows for repeat registration tests
  - delete non-protected test users only with typed email confirmation
  - prevent deleting the current admin session or protected system-admin accounts

Interpretation for the next Coder AI round:

- do not regress the shipped admin modules back to placeholders
- treat `/admin/billing`, `/admin/audit`, and `/admin/abuse` as the remaining staged modules
- use the shipped read-only modules for QA/support before opening a broader admin-write tranche

## Admin module reconciliation and delivery

Audit result on 2026-04-26:

- **Confirmed mismatch** before this round:
  - docs claimed `/admin/users` was already shipped
  - code had `/admin/users` as real, but `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, and `/admin/settings` were still placeholder-only routes
  - live dev/prod branch mapping was correct, but the deployed runtime did not expose commit SHA publicly
- Git audit result:
  - local branch: `develop`
  - local `develop` vs `origin/develop`: in sync (`88af252` before this round)
  - local `main` vs `origin/main`: in sync (`cc7147f` before this round)
  - `develop` contains linear feature commits; `main` contains merge commits from develop
- Deployed-state audit result:
  - `wapi-dev.getouch.co` runs Coolify branch `develop`
  - `wapi.getouch.co` runs Coolify branch `main`
  - deployed image tags resolved to:
    - dev image tag `t1xhkiq5wah66nss0onb7fpf:88af2529cd6e9332ade643951c894374310a69dd`
    - prod image tag `nql6rdsjrcmlvcee1o2dz8wd:cc7147f99597b5d06a8bb7505f6baefd046e0703`
  - current runtime still does not expose commit SHA via `/api/health`; commit truth was verified from Coolify image tags on the host

Modules delivered in this round:

- `/admin/users`
  - search by email/name/phone
  - reset test artifacts action
  - typed-confirm delete for non-protected test users
  - self-delete blocked
  - protected system-admin delete blocked
- `/admin/tenants`
  - real tenant directory
  - search/filter
  - member counts and owner/admin counts
  - workspace links
- `/admin/wa-sessions`
  - cross-tenant account/session monitor
  - request-05 blocker banner
  - details view on the page
  - tenant WhatsApp links
- `/admin/jobs`
  - queue counts
  - worker summary
  - recent failures
- `/admin/ai`
  - provider registry and tenant override summary
  - secret mode visibility without secret leakage
- `/admin/settings`
  - read-only runtime/env/feature summary without secret leakage

Modules still placeholder after this round:

- `/admin/billing`
- `/admin/audit`
- `/admin/abuse`

Files changed in this admin tranche:

- `src/app/admin/users/{page.tsx,actions.ts}`
- `src/app/admin/tenants/page.tsx`
- `src/app/admin/wa-sessions/page.tsx`
- `src/app/admin/jobs/page.tsx`
- `src/app/admin/ai/page.tsx`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/{_nav.ts,page.tsx,layout.tsx}`
- `docs/request/11-test-admin-console.md`
- `docs/product/delivery-progress.md`
- `docs/product/roadmap.md`
- `docs/architecture/admin-console.md`
- `.github/prompts/wapi-next-phase-delivery.prompt.md`

Validation in this round:

- `pnpm typecheck` — pass after `/admin/users` hardening
- `pnpm typecheck` — pass after the wider admin module delivery
- full validation still required at end of tranche:
  - `pnpm test:unit`
  - `pnpm typecheck`
  - `pnpm build`

Publication and deployment result:

- `develop` pushed to `origin/develop` at `3fb951c`
- Coolify dev deployment finished for commit `3fb951cbcdb4025e816411fc9d11fc4580c11bd7`
- live dev image tag now resolves to `t1xhkiq5wah66nss0onb7fpf:3fb951cbcdb4025e816411fc9d11fc4580c11bd7`
- `main` merged and pushed to `origin/main` at merge commit `f91a9fc`
- Coolify prod deployment finished for commit `f91a9fce13431652abf56017dd8a9d0f99f1ad0d`
- live prod image tag now resolves to `nql6rdsjrcmlvcee1o2dz8wd:f91a9fce13431652abf56017dd8a9d0f99f1ad0d`
- both dev and prod hit temporary `502` after Coolify container-name rotation and were restored by rerunning the host-side Caddy upstream sync helper
- product master tranche publication (2026-04-26):
  - `develop` pushed to `origin/develop` at `64579f5`
  - Coolify dev deployment finished for commit `64579f572423273e859a5e754b0f10aa98f9045b`
  - `main` merged and pushed to `origin/main` at merge commit `68ba144`
  - Coolify prod deployment finished for commit `68ba14453255f85368d5baae60e3fc03b379cc72`
  - both dev and prod briefly returned `502` again after container rotation; the same Caddy upstream sync helper restored public traffic

Remaining manual checks:

- signed-in browser smoke test on dev for the shipped admin routes
- non-admin redirect confirmation on `/admin` and `/admin/users`
- mobile / narrow viewport pass for the updated nav badges and real-module pages
- repeat tenant registration reset flow using `/admin/users`

## Verified in this pass

### Availability and routing

- Dev health endpoint: `200`
- Prod health endpoint: `200`
- Anonymous `/admin` on dev redirects to `/login?next=/admin`
- Anonymous `/admin` on prod redirects to `/login?next=/admin`
- Anonymous `/admin/users` on dev redirects to `/login?next=/admin`
- Anonymous `/admin/users` on prod redirects to `/login?next=/admin`
- Anonymous `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, `/admin/settings`, and `/admin/system-health` redirect to `/login?next=/admin` on both dev and prod

### Local build validation

- `pnpm test:unit` passes (`11` tests).
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
- Validation rerun after the tenant logout and admin-users delivery still passes with the same route set.

### Live DB smoke checks

Both `wapi.dev` and `wapi` currently report:

- reference-data counts: `14|15|10|15|18|7|10`
- reference-data counts: `14|15|11|10|15|18|7|10`
  - `ref_countries = 14`
  - `ref_currencies = 15`
  - `ref_units = 11`
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
- total public tables: `55`

### Code-audit checks

- Admin permission usage is server-side and present in the expected WAPI surfaces:
  - `src/app/admin/layout.tsx`
  - `src/app/login/actions.ts`
- Tenant sign-out is now exposed in the shared authenticated navbar:
  - `src/components/layout/navbar.tsx`
- Admin user-management test-ops surface is now shipped:
  - `src/app/admin/users/page.tsx`
  - `src/app/admin/users/actions.ts`
  - `src/app/admin/_nav.ts`
- Registration failure state retention is now shipped:
  - `src/app/register/actions.ts`
  - `src/app/register/register-form.tsx`
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
- Phase 7 functional tranche and its planned remaining slice are now shipped.
- The next real product tranche should not rebuild shipped Phase 6 or shipped Phase 7 foundations; it should validate them, close out release-hardening work, and then move into Phase 8 groundwork while keeping omnichannel / Smart Customer Memory compatibility intact.
- Product master tranche 2 is now the shipped baseline for `/t/{slug}/products`; future product work should extend this guided editor and the `product_channel_mappings` / `product_bundles` schema rather than reintroducing the old minimal create form.

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
- real admin sub-routes now ship for users, tenants, wa-sessions, jobs, ai, settings, and system-health
- anonymous access redirects to `/login?next=/admin`
- admin permission enforcement is server-side in `src/app/admin/layout.tsx`
- tester-provided signed-in screenshot matches the expected shell state for the overview
- `/admin/users` now renders as a real test-ops module with search, typed confirmation, safe reset, and protected-account guards
- `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, and `/admin/settings` now render operational read-only modules instead of `AdminPlaceholder`

Not completed in this pass:

- authenticated super-admin happy-path browser pass
- live browser pass for `/admin/users` list + reset/delete flow
- live browser pass for `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, `/admin/settings`
- placeholder tile click-through as a signed-in admin for the remaining placeholder modules (`billing`, `audit`, `abuse`)
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
- Interactive: partially advanced on `wapi-dev` with the clinic tenant.
  - contact create succeeded for `Manual Test Contact`
  - tag create succeeded for `vip`
- Still pending: contact edit/delete, per-contact tag toggle, Business
  Brain CRUD, `Recompute & save`, product/service create form, and
  hidden-field tamper.
- No real Phase 5 defect found in the exercised contact/tag path.

### Test 16 — Phase 8b worker supervision

- Automated-verifiable: partially advanced in this pass.
  - `pnpm test:unit` passes for the worker supervisor core helpers.
  - `pnpm worker:outbound` now reaches the supervised runtime path instead
    of crashing immediately on `server-only` import resolution.
  - `pnpm worker:followups` now reaches the supervised runtime path instead
    of crashing immediately on `server-only` import resolution.
  - Both one-shot worker commands wrote heartbeat files in the macOS temp
    heartbeat directory with `runMode="once"`, `totalTicks=1`,
    `totalErrors=1`, and populated `lastError` values.
- Remaining local blocker for full script success: this checkout does not
  currently provide a usable `DATABASE_URL`, so the workers cannot complete
  a successful DB-backed tick from this environment.
- Interactive: partially advanced on `wapi-dev`.
  - signed-in super-admin browser pass for `/admin/system-health`
    succeeded
  - the page rendered as a real module, not a placeholder
- Still pending: loop mode, SIGINT shutdown, and environment-backed worker
  success path.

### Test 13 — Phase 6 contract-ready

- Automated-verifiable: confirmed. HMAC verify is timing-safe; cross-tenant
  guards (`status` webhook + Dify provider resolver) are in place;
  `isValidConversationKey` rejects bare phones; `assembleTenantContext`
  filters every query by `tenant_id`.
- Interactive: partially advanced on `wapi-dev` with the clinic tenant.
  - adding a WhatsApp account row succeeded; the row rendered as `pending`
  - clicking `Connect` caused a server-side application error instead of a
    graceful pending/error state on the page
- Real defect found: `/t/{slug}/whatsapp` connect flow currently crashes on
  `wapi-dev` for the clinic tenant (app error digest `3539567216`).
- Still pending: reset/disconnect after the connect defect is fixed,
  curl-driven webhook signature exercise, live Dify call with a real key,
  outbound-worker dry-run.

### Test 11 — Admin console shell

- Automated-verifiable: confirmed. All 11 admin routes register; layout
  RBAC gate is server-side via `system.admin.access`.
- Interactive: partially advanced on `wapi-dev`.
  - super-admin login for `admin@getouch.co` landed on `/admin`
  - `/admin/system-health` rendered successfully as a real admin page
  - non-system-admin clinic tenant user was redirected to
    `/access-denied?reason=admin`
- Still pending: placeholder tile click-through across all modules and the
  mobile/narrow-viewport visual pass.
- No real admin-shell defect found in the exercised paths.

## Local environment note

- `pnpm db:seed` exiting with code `1` in one local run was caused by a missing local `.env.local`, not by an application defect in the shipped Phase 5/6/7 work.
- Phase 8b one-shot worker commands now run through the supervisor, but a
  DB-backed success tick still requires a local `.env.local` with a valid
  `DATABASE_URL`.
- The old local Phase 8b `Cannot find module 'server-only'` worker-runtime
  failure is fixed.

## Release-hardening pass (2026-04-26)

Scope: validation, defect close-out, and doc alignment after the Phase 7
remaining slice landed. No reopening of shipped surfaces beyond real
defects.

### Real defects fixed in this pass

- **Consent-coverage rule miscounted on filtered audiences.**
  `src/server/campaign-safety.ts` was computing the granted set against
  the tenant's full active-contacts list, then dividing by the
  preview-audience total. When the campaign's `audienceFilter` narrowed
  the audience (tags or lead status), the ratio could exceed 100% and
  the wrong status would be emitted. Fixed by promoting
  `fetchAllAudienceIds(tenantId, filter)` in `src/server/campaigns.ts` to
  exported and using it as the single source of truth for the audience
  ID set, then computing both numerator and denominator against the same
  filtered set.
- **Follow-up enrollment returned the wrong reason for missing sequences.**
  `enrollContact` returned `{ ok: false, reason: "already_enrolled" }`
  when the sequence did not belong to the tenant. Added a `no_sequence`
  reason and used it for the not-found path.
- **Test plan duplicated and outdated "Out of scope" sections.**
  `docs/request/14-test-phase7-campaigns.md` listed the tranche-4 items
  (long-running follow-up executor, Dify variant suggestion, consent
  rule) as out of scope while also documenting them as shipped under
  section H. Cleaned up to a single accurate "Out of scope" block.

### Validation run in this pass

- `pnpm typecheck` — pass.
- `pnpm build` — pass. All Phase 5/6/7 routes still register:
  `/api/wa/webhooks/{qr,connected,disconnected,inbound,status}`,
  `/t/[tenantSlug]/{ai/draft,brain,campaigns,campaigns/[campaignId],contacts,contacts/[contactId],followups,followups/[sequenceId],whatsapp}`.
- Live deploy health: `wapi-dev.getouch.co` → `200`,
  `wapi.getouch.co` → `200`.
- Narrowest-behavior code audit:
  - `campaign-safety.ts` consent path now reads from the same audience
    resolver the dispatcher uses (`fetchAllAudienceIds`), so safety
    review and dispatch see the same audience.
  - `campaign-dispatcher.ts` reply-first gating still excludes recipients
    with `excluded_reason='reply_first:no_prior_inbound'` and never
    queues them.
  - `outbound-rate-limit.ts` claim path is non-atomic peek-then-claim
    with a `WHERE status='queued'` guard on the second UPDATE — safe
    for the current single-worker model and documented as such.
  - `follow-up-executor.ts` enrollment idempotency check uses
    `message_queue.payload->>'sequenceId'` and is tenant-bounded via
    `getSequence` and the contact tenant guard.

### Tests run after delivery work

- Test 14 (Phase 7 campaigns) — automated parts re-validated:
  - route registration: pass
  - `pnpm typecheck` / `pnpm build`: pass
  - consent-rule defect (above) fixed and re-typechecked
  - test plan (`docs/request/14-test-phase7-campaigns.md`) updated to
    remove contradictory out-of-scope claims
- Test 13 (Phase 6 contract-ready) — automated parts re-validated:
  webhook + Dify routes still register; HMAC verifier and conversation
  key invariants unchanged in this pass.
- Test 11 (Admin shell) — automated parts re-validated: 11 admin routes
  still register; `/admin/users`, `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, `/admin/settings`, and `/admin/system-health` are now real modules.
- Test 08 (Phase 5) — automated parts re-validated: contacts / brain /
  catalog routes still register.

### Pending interactive checks (still owned by the human tester)

- **Test 08**: contact edit/delete, tag toggle, Business Brain CRUD,
  `Recompute & save`, product/service create form, hidden-field tamper.
- **Test 11**: placeholder tile click-through across all modules and the
  mobile/narrow-viewport visual pass, plus real browser checks for `/admin/users`, `/admin/tenants`, `/admin/wa-sessions`, `/admin/jobs`, `/admin/ai`, and `/admin/settings`.
- **Test 13**: fix the clinic-tenant connect crash first, then re-run
  connect/reset/disconnect; still pending curl-driven webhook signature
  exercise, live Dify call with a real `DIFY_DEFAULT_API_KEY`, and an
  outbound-worker dry-run with a queued row.
- **Test 14**: cross-tenant URL probe, worker dry-run with a
  campaign-queued row, status-webhook replay, and tranche-H runtime
  checks beyond the exercised create/review/schedule path.

### Blockers carried forward

- **Request 05** (gateway multi-tenancy) remains the external blocker
  for live WhatsApp behavior. WAPI-side contract is shipped and
  contract-ready; the live-send / live-QR / live-status loop still
  depends on the gateway side.
- Local `pnpm db:seed` requires a local `.env.local` with
  `DATABASE_URL`. Not a defect; environment-only.

## Phase 8a — shared inbox view (2026-04-26)

Scope: tenant-scoped, channel-agnostic-in-shape inbox read model
anchored on `(tenant_id, normalized_phone_number)`. No new schema.
Read-only first slice — composing / replying lands in a later slice.

### Delivered

- `src/server/inbox.ts`:
  - `listConversations(tenantId, { limit })` — groups
    `inbound_messages` + non-OTP `message_queue` by phone, joins to
    `contacts` for display, computes inbound/outbound counts and an
    `awaitingReplyCount` proxy (inbound after the latest outbound).
  - `getConversation(tenantId, normalizedPhone)` — single-conversation
    summary used by the detail page.
  - `getConversationTimeline(tenantId, normalizedPhone, { limit })` —
    merged inbound + outbound timeline, OTPs filtered out, newest-first
    ordering returned (the page renders chronologically).
  - Channel-agnostic shape: returned `channel` is the literal
    `'whatsapp'`. Future channels add their own aggregate queries that
    merge into the same per-phone map without schema churn.
  - Smart Customer Memory compatibility: identity is always the tuple
    `(tenant_id, normalized_phone_number)`. The module never reads
    `whatsapp_sessions` for identity.
- `src/app/t/[tenantSlug]/inbox/page.tsx` — list view: per-conversation
  row with contact name (or phone), preview, counters, channel chip,
  relative time, `+N new` chip when inbound > latest outbound.
- `src/app/t/[tenantSlug]/inbox/[phone]/page.tsx` — detail view: header
  with contact link, summary counters, merged chat-style timeline
  (oldest at top, newest at bottom), per-event metadata (purpose,
  status, intent).
- `src/components/tenant/sub-nav.tsx` — Inbox tab no longer `soon`.
- `docs/request/15-test-phase8a-inbox.md` — manual test plan
  (tenant scoping, list grouping, detail timeline, identity invariants,
  Smart Customer Memory code-audit step). One request doc added because
  no existing test doc covered Phase 8a.

### Tests run after delivery

- `pnpm test:unit` — pass; focused Node tests now cover the pure inbox
  merge logic (`src/server/inbox-core.test.ts`):
  - tenant + normalized-phone identity is preserved
  - inbound wins when inbound/outbound timestamps tie
  - contact-less conversations still render in the aggregate shape
  - previews truncate to 160 chars
  - merged timeline events stay newest-first with `channel='whatsapp'`
- `pnpm typecheck` — pass.
- `pnpm build` — pass; new routes register:
  - `/t/[tenantSlug]/inbox`
  - `/t/[tenantSlug]/inbox/[phone]`
- Live deploy health: `wapi-dev.getouch.co` → `200`,
  `wapi.getouch.co` → `200`.
- Narrowest behavior code audit:
  - Every query in `inbox.ts` filters by `tenant_id`.
  - OTPs (`purpose='otp'`) excluded from both list aggregate and
    timeline.
  - `awaitingReplyCount` correctly resolves to 0 when there is no
    outbound (uses `coalesce(..., 'epoch'::timestamptz)`).
  - Phone-only conversations (no `contacts` row) still appear in the
    list and detail view; the contact link is replaced with
    "Not linked to a contact yet".
  - Conversation key never falls back to `whatsapp_sessions`.

### Additional automated coverage added after delivery

- `src/server/inbox-core.ts` extracts the read-model merge logic into a
  pure helper module so Phase 8a invariants can be tested without a DB.
- `src/server/inbox-core.test.ts` adds focused unit coverage for the
  Smart Customer Memory seam: `(tenant_id, normalized_phone_number)`
  remains the stable identity anchor, with channel kept as a literal
  string rather than derived from session state.

### Pending interactive checks (Phase 8a)

- Empty-state browser pass succeeded on a fresh tenant with no message rows.
- Real defect found on `wapi-dev`: after queuing a standard-send campaign
  row for the clinic tenant, `/t/clinic-getouch-test/inbox` crashed with a
  server-side application error instead of rendering the outbound-only
  conversation (`digest 3602993270`).
- Still pending after that defect is fixed: list view with real rows,
  detail timeline, cross-tenant URL probe, and phone-without-contact path.

### Phase 8a out of scope (not regressions)

- Composing / replying from the inbox.
- Server-side read markers; `awaitingReplyCount` is a derived proxy.
- AI summary or rolling conversation memory (Phase 8c).
- Cross-channel rollouts (Facebook / Instagram / Shopee / Lazada /
  TikTok).

## Phase 8b — supervised worker run mode + system-health data hook (2026-04-26)

Scope: real, minimal supervised-run path for the existing worker
scripts plus a server-side admin system-health snapshot. No queue-model
redesign, no fake multi-channel worker, no schema churn.

### Delivered

- `src/server/worker-supervisor-core.ts` — pure helpers:
  `WorkerHeartbeat`, `WorkerStatus`, `parseHeartbeat`,
  `classifyHeartbeat` (state ∈ ok/stale/missing/errored),
  `buildHeartbeat`, `formatAge`, `DEFAULT_STALE_AFTER_MS=120000`.
  No filesystem, no DB — fully unit-testable.
- `src/server/worker-supervisor.ts` — `runSupervised()` /
  `runOnce()` / `readAllHeartbeats()`. One-shot mode preserves the
  existing exit-code contract; loop mode handles SIGINT/SIGTERM
  cleanly, writes a heartbeat per tick, and never crashes the loop on
  a tick-level error (the error is recorded in the heartbeat instead).
  Heartbeat directory is `WAPI_WORKER_HEARTBEAT_DIR` or
  `${os.tmpdir()}/wapi-workers`.
- `scripts/worker-outbound.ts` and `scripts/follow-up-executor.ts`
  refactored to `tick()` functions wrapped by `runSupervised()`.
  Existing tenant-scoped logic, rate-limit reservation, and
  account/tenant-mismatch guards are unchanged.
- `package.json` adds `worker:outbound:loop` and
  `worker:followups:loop` (one-shot scripts kept as the defaults to
  preserve current cron / Coolify-scheduled-command behavior).
- `src/server/system-health.ts` — `getSystemHealthSnapshot()`:
  - reads heartbeats for the expected workers (`outbound`,
    `follow-ups`)
  - reads aggregate queue signals from `message_queue` (queued,
    sending, failed-24h, oldest-queued age) in a single SQL pass
  - tolerates missing DB / missing heartbeat dir without throwing
- `src/app/admin/system-health/page.tsx` — real server-component page
  replacing the placeholder. Renders worker status badges
  (OK/STALE/MISSING/ERRORED), heartbeat metadata, an error callout when
  any worker reported a recent error, and the queue-signals card.
- `src/app/admin/_nav.ts` — `system-health` flipped from `placeholder`
  to `ready`. All other admin modules remain `placeholder`.
- `docs/request/16-test-phase8b-worker-supervision.md` — manual test
  plan (one-shot run, supervised loop, error-visibility flow, admin
  page, tenant isolation invariant, Smart Customer Memory code-audit).
- `src/server/worker-supervisor-core.test.ts` — focused unit coverage
  for the pure logic.

### Run modes (operator-facing)

- `pnpm worker:outbound` — one-shot tick (default; cron-friendly).
- `pnpm worker:outbound:loop` — supervised loop, default 15s tick.
- `pnpm worker:followups` — one-shot tick (default; cron-friendly).
- `pnpm worker:followups:loop` — supervised loop, default 60s tick.
- Override via `WAPI_WORKER_MODE=loop` and
  `WAPI_WORKER_INTERVAL_MS=<ms>`.
- Override heartbeat location via `WAPI_WORKER_HEARTBEAT_DIR`.
- Recommended deployment shape: a Coolify scheduled command (one-shot)
  every minute, or a long-running loop process supervised by systemd /
  Coolify-managed-service. WAPI does not bundle a process supervisor;
  the supervised-loop wrapper just keeps heartbeats and signals
  trustworthy.

### Tests run after delivery

- `pnpm test:unit` — pass (11 + 4 = **22 total**, 11 new for
  `worker-supervisor-core` plus the existing inbox-core suite).
- `pnpm typecheck` — pass.
- `pnpm build` — pass; new/updated routes register:
  - `/admin/system-health` (now real, not placeholder)
  - `/t/[tenantSlug]/inbox` and `/t/[tenantSlug]/inbox/[phone]`
    unchanged from Phase 8a.
- Live deploy health: `wapi-dev.getouch.co` → `200`,
  `wapi.getouch.co` → `200`.
- Narrowest behavior code audit:
  - `runSupervised` writes a heartbeat on success **and** on tick
    error; loop ticks never propagate the error to the process exit.
  - `runOnce` re-throws after writing a heartbeat so cron / scheduled
    commands still surface non-zero exit codes.
  - SIGINT and SIGTERM both flip a single `stopRequested` flag and let
    the current tick finish; sleep is interruptible at 250ms steps.
  - Heartbeat write is `tmp + rename` to avoid torn reads.
  - `classifyHeartbeat` is pure: `now` is an explicit argument so tests
    do not need to fake the clock.
  - `getSystemHealthSnapshot` never throws; missing DB → zeroed signals
    and `dbAvailable=false`; missing heartbeat dir → `missing` rows.
  - `/admin/system-health` is layout-gated by `system.admin.access`;
    the page renders no tenant-specific data.

### Pending interactive checks (Phase 8b)

- Run `pnpm worker:outbound:loop` locally and watch the heartbeat file
  tick; SIGINT and confirm clean shutdown.
- Run with broken `DATABASE_URL` and confirm `lastError` populated and
  `totalErrors` increments in the heartbeat.
- Sign in as `SYSTEM_SUPER_ADMIN`, visit `/admin/system-health` on
  production, and confirm worker rows + queue card render the live data.

### Known local-env note (not a Phase 8b regression)

- Running the worker scripts without a valid local `DATABASE_URL` still
  prevents a successful DB-backed tick. The old `server-only` runtime
  crash was fixed in this pass.

### Phase 8b out of scope (not regressions)

- Replacing `message_queue` with a different queue model.
- A multi-channel worker abstraction (other channels reuse the
  supervisor wrapper as-is when they ship).
- A bundled production process supervisor (operator's choice: systemd /
  Coolify scheduled command / Coolify managed service / nohup).
- Live multi-tenant WhatsApp send (Request 05).
- Smart Customer Memory writes (Phase 8c).

## Phase 8b interactive pass — defects fixed (2026-04-26)

A real interactive pass on `wapi-dev.getouch.co` confirmed:

- `admin@getouch.co` login lands on `/admin`.
- `/admin/system-health` renders for system admin.
- A non-system-admin clinic tenant user is correctly redirected to
  `/access-denied?reason=admin`.
- Clinic tenant registration succeeded.
- Phase 5 contact create + tag create succeeded.
- Phase 6 WhatsApp account row create succeeded.
- Phase 7 campaign draft + variant + safety review + schedule succeeded.

Two real defects were uncovered and have been fixed in this pass.

### Defect A — `/t/{slug}/whatsapp` Connect crashed the page (digest 3539567216)

Root cause: `connectSessionAction` (and `resetSessionAction`) threw when
the configured gateway returned a non-2xx response. Until Request 05
lands the gateway can be reachable but reply with a multi-tenant-unaware
error; throwing in a server action surfaces as a Next.js
application-error overlay for the tenant operator.

Fix: in `src/app/t/[tenantSlug]/whatsapp/actions.ts`, when the gateway
call fails, log the error, persist `whatsapp_sessions.status='error'`
on the local row, `revalidatePath`, and return cleanly. The session
state badge now surfaces the failure instead of a crash. No gateway
work is moved into WAPI; Request 05 stays explicit as the external
blocker.

### Defect B — `/t/{slug}/inbox` crashed when the tenant had outbound-only queue rows (digest 3602993270)

Root cause: `src/server/inbox.ts` used raw `sql\`column = any(${jsArray})\``
in three list-aggregate queries plus the awaiting-reply correlated
query. Drizzle's `sql` template tag spreads JS arrays as
comma-separated `$1, $2, …` parameters, which makes `any($1, $2, …)`
invalid Postgres. The path was only triggered when a tenant had at
least one queue row whose phone made it into the `phones` array — i.e.
exactly the queued-campaign-row scenario from the interactive pass.

Fix: replace the three list-side `= any(${phones})` predicates with
drizzle's `inArray(column, phones)` helper, and rewrite the awaiting
correlated query's array binding as
`any(array[…]::text[])` via `sql.join`. Tenant scoping is preserved on
every query (`tenant_id` filter unchanged). Identity stays
`(tenant_id, normalized_phone_number)`. No schema change. No
`whatsapp_sessions` access. The pure merge logic in `inbox-core.ts`
already covered the outbound-only conversation case in unit tests
(`mergeConversationSummaries sorts by latest activity, keeps
contact-less conversations, and truncates previews`).

### Tests run after the fix

- `pnpm test:unit` — pass (11 tests across `inbox-core` and
  `worker-supervisor-core`).
- `pnpm typecheck` — pass.
- `pnpm build` — pass; `/admin/system-health`, `/t/[tenantSlug]/inbox`,
  `/t/[tenantSlug]/inbox/[phone]`, and `/t/[tenantSlug]/whatsapp`
  routes register unchanged.
- Code-audit invariants verified:
  - tenant scoping unchanged on every fixed query
  - no cross-tenant data path introduced
  - no schema churn
  - WhatsApp gateway code remains server-side only
  - Smart Customer Memory seam intact

### Files changed in this pass

- `src/server/inbox.ts` — `inArray` for phone-list filters; awaiting
  query rebound as `any(array[…]::text[])`.
- `src/app/t/[tenantSlug]/whatsapp/actions.ts` — graceful error path
  for connect + reset; no throws on gateway non-2xx.

### Pending interactive checks

- Re-run Connect on `/t/clinic-getouch-test/whatsapp` and confirm the
  session badge flips to `error` (no crash, no overlay).
- Re-load `/t/clinic-getouch-test/inbox` after queueing a standard-send
  campaign row and confirm the conversation list renders with the
  outbound-only row.
- The remaining manual flows from Tests 08, 11, 13, 14, 15, 16 still
  owed by the interactive tester.

### Still blocked externally

- **Request 05** remains the external blocker for live multi-tenant
  WhatsApp QR / send / status traffic. WAPI's WhatsApp surface no
  longer crashes the tenant page when the gateway is not yet
  multi-tenant aware; that is the only WAPI-side adjustment.

## Blockers and limits in this pass

- Signed-in browser checks on `wapi-dev` are now possible and were used in
  this pass.
- The fresh clinic tenant is useful for tenant-flow coverage, but it starts
  without seeded historical message data.
- Request 05 remains the external gateway blocker for true multi-tenant WhatsApp readiness.

## External dependency status

### Request 05 — gateway multi-tenancy

Partially unblocked — multi-session gateway is now **live on `wa.getouch.co`**; full two-real-number live test still pending.

- Gateway refactor round complete on `getouch.co/services/wa`. WAPI-side is not being patched further unless a contract mismatch is found.
- New gateway runtime: `services/wa/session-manager.mjs` + `services/wa/webhook-dispatcher.mjs` + refactored `services/wa/server.mjs`.
- Module-scoped `let sock = null` and the shared auth directory are gone. `SessionManager` owns a `Map<sessionId, SessionRuntime>`; each runtime owns its own Baileys socket, auth directory under `${SESSIONS_DIR}/${sessionId}`, status, QR cache, paired phone, reconnect timer, last error, message counters, and recent-event ring buffer.
- New routes: `POST /api/sessions/:id`, `GET /api/sessions/:id/status`, `GET /api/sessions/:id/qr`, `POST /api/sessions/:id/reset`, `DELETE /api/sessions/:id`, `POST /api/sessions/:id/messages`, `GET /api/sessions`, `GET /api/webhook-stats`, plus `/sessions/...` aliases. All require `X-WAPI-Secret`.
- Legacy `/api/status`, `/api/qr-code`, `/api/pairing-code`, `/api/send-text`, `/api/send-image`, `/api/send-document`, `/api/logout`, `/api/reset` still work; they are pinned to `DEFAULT_SESSION_ID` via SessionManager and surface `deprecated: true` in their responses.
- Admin UI now renders a multi-tenant sessions table (status, phone, last seen, msgs 24h, QR view, reset, delete) with summary chips and 5s auto-refresh; the existing single-session card stays as the default-session view.
- Outbound webhook dispatcher delivers `qr`, `connected`, `disconnected`, `message.inbound`, `message.status`, `session.deleted` to `WAPI_WEBHOOK_URL` with HMAC-SHA256 of the raw body in `X-WA-Signature`. Retry is in-memory exponential backoff (5s → 1h cap, drop after 24h); persistent disk-backed retry is documented as pending.
- Local validation against a fresh `SESSIONS_DIR=/tmp/wa-test-sessions`: 401 with no/wrong `X-WAPI-Secret`, two sessions A and B isolated, reset A keeps B, delete A keeps B, legacy `/api/status` runs through `DEFAULT_SESSION_ID`, path-traversal probe returns 400. Full results recorded in [docs/request/05-wa-gateway-multitenancy.md](../request/05-wa-gateway-multitenancy.md).
- Compose: existing persistent volume `/data/getouch/wa:/app/data` is preserved. `SESSIONS_DIR` defaults to `/app/data/sessions` and the legacy `/app/data/auth` content auto-migrates into `/app/data/sessions/default` on first boot, so the current pairing is not lost.

#### 2026-04-26 round 2 — live deploy fix

After the first push, the live `wa.getouch.co` was still serving the OLD single-session UI because that host is **not** Coolify-managed; it runs from a manual `docker compose` checkout at `/home/deploy/apps/getouch.co` that was stuck at commit `36ecee3`. Two more issues were fixed at the same time:

- `services/wa/Dockerfile` only copied `server.mjs db.mjs ui.mjs` — it had to be patched to also COPY `session-manager.mjs` and `webhook-dispatcher.mjs`. The same fix is now committed in the `getouch.co` repo so future builds elsewhere will not silently miss the new files.
- A 64-hex `WAPI_SECRET` was generated and added to the live `.env`, plus the new env block (`WAPI_WEBHOOK_URL`, `SESSIONS_DIR`, `DEFAULT_SESSION_ID`, `MAX_CONCURRENT_SESSIONS`, `AUTO_START_DEFAULT_SESSION`, `AUTO_START_SESSIONS`).
- Legacy `/app/data/auth` was auto-migrated into `/app/data/sessions/default`. The paired number `60192277233` reconnected without a fresh QR scan.
- Pre-change WA files were backed up on the deploy host at `/home/deploy/backups/wa-pre-multisession-20260426-155326/` (server.mjs, db.mjs, ui.mjs, .env.example, Dockerfile, package.json, compose.yaml, .env, plus `*.diff` files capturing the un-pushed local hotfixes that were on the live host).

Live verification on `https://wa.getouch.co`:

- `GET /health` → `200`, `sessions: 2`, `defaultStatus: connected`, `defaultPhone: 60192277233`, webhook snapshot present.
- `GET /api/sessions/default/status` without secret → `401 UNAUTHORIZED`. With wrong secret → `401`. With correct secret → `200` per-session snapshot.
- `POST /api/sessions/test-live` with secret → `200`, status `connecting`, real `data:image/png;base64,…` QR returned. Confirms a second concurrent Baileys socket boots cleanly on prod.
- `POST /api/sessions/..%2Fevil` → `400 BAD_REQUEST` (path-traversal blocked).
- `DELETE /api/sessions/test-live` → `200 {ok:true,existed:true}`. `default` session unaffected.
- Admin UI at `https://wa.getouch.co/` renders the new "Multi-tenant Sessions" panel above the existing default-session card.

Still pending after this fix:

- Full two-real-number paired live test (one real number paired; second slot proven via QR-emit only).
- Persistent disk-backed webhook retry queue. Dispatcher remains in-memory only.
- WAPI app environment must be given the matching `WAPI_SECRET` so `wa-gateway.ts` outgoing calls present `X-WAPI-Secret`. The secret currently lives in `/home/deploy/apps/getouch.co/.env` on `100.84.14.93`.

WAPI Phase 6 schema is ready to receive gateway integration; WAPI contract-ready app-side integration is shipped. Request 05 is **partially green**: multi-session runtime and admin UI live, secured, and isolation-verified; full two-number live pairing + persistent retry queue + WAPI-side secret wiring remain.

## Recommended next tranche for Coder AI

Coder AI should use this file as the current-state source of truth and update it after each meaningful validation or delivery step.

Workspace prompt prepared for the next round:

- [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md)

For the next Coder AI run, the intended flow is:

1. open the workspace prompt
2. read this file as the only live progress ledger
3. deliver the active phase work first
4. run the relevant phase test scripts and validation flows after the delivery work
5. update this file again with the results, blockers, and next-phase recommendation

### Immediate next actions

1. Hand the listed interactive flows to the human tester, with priority on:
  `/admin/users` reset/delete flow,
  `/admin/tenants`,
  `/admin/wa-sessions`,
  non-admin admin denial,
  Test 13 WhatsApp connect/reset/disconnect recheck,
  and Test 15 inbox recheck.
2. Do not reopen the shipped admin modules unless live validation finds a real defect.
3. Keep [Request 05](../request/05-wa-gateway-multitenancy.md) explicit
  as the external blocker for live WhatsApp gateway behavior.
4. If the next round stays WAPI-only, continue **Phase 8 groundwork** with the following cuts, in order, all
   tenant-scoped and channel-agnostic by design:
  - 8a. Shared inbox model: a tenant-scoped conversations view that
    pivots on `tenant_id + normalized_phone_number` and reads
    `inbound_messages` + `message_queue` together. No new schema yet;
    use the existing tables. This is the surface that Smart Customer
    Memory will plug into later.
  - 8b. Operationalization of the worker scripts: a documented
    supervised run mode (cron / systemd / Coolify scheduled command)
    for `pnpm worker:outbound` and `pnpm worker:followups`, plus a
    health probe row in `/admin/system-health` (still placeholder UI;
    the data hook lands first).
  - 8c. Smart Customer Memory schema seed (read-only at first):
    `customer_memory_facts` keyed by
    `(tenant_id, normalized_phone_number)`, with append-only writes
    from inbound + outbound events. No runtime AI hook yet.
  - 8d. Omnichannel-safe abstractions: rename channel-implicit helpers
    to channel-aware where the rename is cheap (e.g. `wa-gateway.ts`
    stays WhatsApp; the inbox view is the channel-agnostic seam).
5. If the next round expands into `getouch.co`, start the real gateway
  refactor in `services/wa` from the 2026-04-26 Request 05 checklist
  instead of patching more WAPI-side fallbacks.
6. Keep [docs/product/delivery-progress.md](./delivery-progress.md)
   updated as the live progress ledger after each tranche.
7. After each delivery slice, run the matching phase test scripts
   (typecheck, build, route registration, live health, narrowest
   behavior probes) and write the outcome here.

### Cycle budget toward MVP+1

Tracking against the user's "fewer than 6 total cycles from here" target.
After this round we have shipped:

- Phase 5 tranche 1 (functional tenant UI)
- Phase 6 contract-ready WAPI surface + Dify runtime foundation
- Phase 7 functional tranche
- Phase 7 remaining slice (consent / reply-first / rate limit /
  follow-up executor / AI variant HITL / KPIs)
- Release-hardening pass
- Phase 8a — shared inbox view
- Phase 8b — supervised worker run mode + system-health data hook
  (this round)

Remaining cycles needed to close MVP+1:

1. **Cycle N+1**: Phase 8c — Smart Customer Memory schema seed and
   read-only writes from inbound/outbound events.
2. **Cycle N+2**: admin-module continuation (turn the next useful
  placeholder cards into real modules: Tenants, AI, WA Sessions).
3. **Cycle N+3** (buffer): release hardening, billing groundwork,
   omnichannel architecture finalization.

That leaves us at **3 remaining cycles**, comfortably inside the
"fewer than 6 from here" budget. If Request 05 lands externally before
N+1, no extra cycle is needed; if it slips, gateway-integration
validation can fold into N+3 without breaking the budget.

### Planning guardrail for the next round

Coder AI should split the next work into two choices instead of mixing them:

1. finish the functional Phase 5, 6, and 7 tranches that directly improve tenant-facing behavior and WhatsApp readiness
2. separately schedule the full admin-module tranche later

Recommended priority:

1. interactive validation and defect close-out for shipped Phase 5, Phase 6 contract-ready, and Phase 7 functional work
2. release hardening and blocker tracking
3. omnichannel architecture and roadmap prep for future inbox/channel expansion
4. Smart Customer Memory compatibility while shaping inbox/customer/follow-up work
5. Phase 8 groundwork only after the shipped slices are validated and hardened
6. only then full admin modules unless business priorities change

### Specific corrections to prior planning

1. The admin shell is shipped and real now.
2. The admin nav shape is `11` total entries: `1` overview route plus `10` placeholder module routes.
3. Phase 6 is functional contract-ready and Phase 7 shipped both its functional tranche and its planned remaining slice; next work is validation/hardening and then Phase 8 groundwork, not a reset.
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