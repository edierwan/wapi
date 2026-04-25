# WAPI Delivery Progress

Last updated: 2026-04-27

## Current status

- Public WAPI availability restored for both environments after another Coolify container-name rotation broke the edge proxy targets.
- `wapi-dev.getouch.co` health is back to `200`.
- `wapi.getouch.co` health is back to `200`.
- A host-side sync helper now updates the Caddy upstreams against the current Coolify WAPI containers.
- A recurring VPS cron now runs that sync helper every 5 minutes to reduce future `502` windows after WAPI redeploys.
- **Phase 5 tenant UI tranche 1 is shipped** (contacts, Business Brain, AI Readiness card, minimal product/service create).
- **Phase 6 contract-ready WAPI surface is shipped** alongside the **Dify runtime foundation** (provider resolution, secret resolver, Dify client, tenant-scoped context assembly, manual HITL draft action). Live gateway behavior remains gated on Request 05.
- The Dify multi-tenant architecture plan is now updated to reflect actual shipped schema versus missing runtime integration.

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
- No current query surfaces are shipped yet for:
  - `campaigns`
  - `campaign_variants`
  - `campaign_safety_reviews`
  - `campaign_recipients`
  - `followup_sequences`

Interpretation:

- Phase 6 contract-ready WAPI side is now functional (HMAC verify, session lifecycle, owner/admin UI, Dify resolution + HITL draft).
- Live WhatsApp gateway behavior (real QR + real send + real status webhooks) still depends on Request 05.
- Phase 7 schema is landed; functional tranche still pending.

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
3. Keep Request 05 as an external blocker, but continue the WAPI-side integration tranche now.
4. Add WAPI-side delivery items for:
   - gateway client wrapper
   - webhook receivers
   - outbound queue worker
   - `/t/{slug}/whatsapp` connect / QR / reset / disconnect UI
5. In the same next tranche, add the first WAPI Dify runtime foundation for multi-tenant-safe AI:
  - provider resolution via `tenant_ai_settings` and `ai_provider_configs`
  - `api_key_ref` secret resolution
  - minimal Dify client wrapper
  - tenant-scoped grounding from Business Brain + profile + catalog
  - one narrow human-in-the-loop AI surface before any inbound auto-reply behavior
6. Keep this file updated as the live progress ledger.

### Planning guardrail for the next round

Coder AI should split the next work into two choices instead of mixing them:

1. finish the functional Phase 5, 6, and 7 tranches that directly improve tenant-facing behavior and WhatsApp readiness
2. separately schedule the full admin-module tranche later

Recommended priority:

1. interactive validation and defect close-out for shipped Phase 5 tranche 1
2. Phase 6 WAPI-side gateway integration
3. multi-tenant-safe Dify runtime foundation in WAPI
4. Phase 7 campaign UI and worker behavior
5. only then full admin modules unless business priorities change

### Specific corrections to prior planning

1. The admin shell is shipped and real now.
2. The admin nav shape is `11` total entries: `1` overview route plus `10` placeholder module routes.
3. Phase 6 and Phase 7 in WAPI are currently schema-foundation state, not missing-UI regressions.
4. WAPI release-readiness should be separated from later roadmap tranches like full admin modules and campaign UI.
5. The current admin screenshot should be treated as a pass for the shell state, not evidence that the shell failed.
6. Dify in WAPI is schema-and-architecture ready, but runtime integration is still pending.
7. Shared Dify is acceptable for MVP only if WAPI remains the tenancy boundary and tenant context is resolved in WAPI first.
8. Tenant-dedicated Dify is a later upgrade path, not the first implementation target.

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