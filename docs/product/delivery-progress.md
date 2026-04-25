# WAPI Delivery Progress

Last updated: 2026-04-26

## Current status

- Public WAPI availability restored for both environments after another Coolify container-name rotation broke the edge proxy targets.
- `wapi-dev.getouch.co` health is back to `200`.
- `wapi.getouch.co` health is back to `200`.
- A host-side sync helper now updates the Caddy upstreams against the current Coolify WAPI containers.
- A recurring VPS cron now runs that sync helper every 5 minutes to reduce future `502` windows after WAPI redeploys.
- **Phase 5 tenant UI tranche 1 is shipped** (contacts, Business Brain, AI Readiness card, minimal product/service create).

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
- No current query surfaces are shipped yet for:
  - `message_queue`
  - `inbound_messages`
  - `campaigns`
  - `campaign_variants`
  - `campaign_safety_reviews`
  - `campaign_recipients`
  - `followup_sequences`

Interpretation:

- Phase 6 and Phase 7 schema are landed.
- WAPI app-side consumer/query/UI surfaces for those tables are still not shipped.
- That matches the current plan state: schema present, functional tranche still pending.

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

### 09 — Phase 6

Schema verified.

Verified:

- `message_queue` exists on both DBs
- `inbound_messages` exists on both DBs
- no app query surfaces are shipped yet, which matches current schema-only status

Not completed in this pass:

- manual insert/delete FK smoke checks
- gateway-authenticated health call using live secret
- end-to-end queue worker behavior, because the worker is not shipped yet in WAPI

### 10 — Phase 7

Schema verified.

Verified:

- all six Phase 7 tables exist on both DBs
- no app query/UI surfaces are shipped yet, which matches current schema-only status

Not completed in this pass:

- manual campaign insert and cleanup smoke flow
- safety-review status exercise in DB
- follow-up sequence uniqueness smoke

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

## Blockers and limits in this pass

- I do not have the current super-admin password in this conversation, so I could not complete the signed-in admin browser checks from Test 11.
- I could not perform the fully interactive onboarding/browser checks from Test 08 without a prepared login session and test-tenant flow in this pass.
- OTP is already confirmed working by the human tester, so I did not reopen that path.
- Request 05 remains the external gateway blocker for true multi-tenant WhatsApp readiness.

## External dependency status

### Request 05 — gateway multi-tenancy

Still blocked externally.

- WAPI Phase 6 schema is ready to receive gateway integration.
- WAPI app-side integration work is still pending.
- The gateway itself is still the controlling external dependency for session-scoped WhatsApp readiness.

## Recommended next tranche for Coder AI

Coder AI should use this file as the current-state source of truth and update it after each meaningful validation or delivery step.

Workspace prompt prepared for the next round:

- [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md)
- short handoff pointer: [coder-ai-next-phase-brief.md](./coder-ai-next-phase-brief.md)

### Immediate next actions

1. Complete the remaining WAPI-interactive checks for Test 08 and Test 11.
2. Do not treat Test 09 and Test 10 as missing UI regressions yet; they are schema-only at the current WAPI stage.
3. Keep Request 05 as an external blocker, but plan the WAPI-side integration tranche now.
4. Add WAPI-side delivery items for:
   - gateway client wrapper
   - webhook receivers
   - outbound queue worker
   - `/t/{slug}/whatsapp` connect / QR / reset / disconnect UI
5. Keep this file updated as the live progress ledger.

### Planning guardrail for the next round

Coder AI should split the next work into two choices instead of mixing them:

1. finish the functional Phase 5, 6, and 7 tranches that directly improve tenant-facing behavior and WhatsApp readiness
2. separately schedule the full admin-module tranche later

Recommended priority:

1. Phase 5 functional tenant UI completion
2. Phase 6 WAPI-side gateway integration
3. Phase 7 campaign UI and worker behavior
4. only then full admin modules unless business priorities change

### Specific corrections to prior planning

1. The admin shell is shipped and real now.
2. The admin nav shape is `11` total entries: `1` overview route plus `10` placeholder module routes.
3. Phase 6 and Phase 7 in WAPI are currently schema-foundation state, not missing-UI regressions.
4. WAPI release-readiness should be separated from later roadmap tranches like full admin modules and campaign UI.
5. The current admin screenshot should be treated as a pass for the shell state, not evidence that the shell failed.

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