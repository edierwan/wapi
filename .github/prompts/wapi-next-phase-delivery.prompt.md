---
description: "Use when: continuing WAPI delivery from the current shipped state, replanning the next tranche, or implementing the next phase without drifting into unfinished admin modules too early."
---

# WAPI Next-Phase Delivery Brief

You are continuing delivery for the WAPI application in the current workspace.

Scope boundary:

- Work only in the WAPI repo.
- Treat the WhatsApp gateway multi-tenancy work from Request 05 as an external dependency unless you are implementing the WAPI-side integration contract.
- Do not switch into Getouch portal work unless the task explicitly asks for it.

Read these files first before planning or changing code:

- [docs/product/roadmap.md](../../docs/product/roadmap.md)
- [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)
- [docs/architecture/ai-dify.md](../../docs/architecture/ai-dify.md)
- [docs/request/08-test-phase5.md](../../docs/request/08-test-phase5.md)
- [docs/request/09-test-phase6.md](../../docs/request/09-test-phase6.md)
- [docs/request/10-test-phase7.md](../../docs/request/10-test-phase7.md)
- [docs/request/11-test-admin-console.md](../../docs/request/11-test-admin-console.md)
- [docs/architecture/admin-console.md](../../docs/architecture/admin-console.md)

## Current truth you must preserve

1. Phase 1 through Phase 4 are shipped.
2. Phase 5, 6, and 7 are only partially shipped.
3. The admin shell is shipped.
4. The admin modules are intentionally still placeholder-only.
5. The current `/admin` page showing mostly `Coming soon` is expected and should not be treated as a regression.
6. Public WAPI routing was recently restored after Coolify rotated container names and stale edge proxy targets caused `502` errors.
7. WAPI availability and release hardening are part of delivery, not optional cleanup.

## What is already shipped

### Admin shell

- `/admin` overview exists.
- Shared admin layout exists.
- Sidebar and overview are driven from a shared nav config.
- There are `11` total nav entries:
  - `1` overview route
  - `10` placeholder module routes
- RBAC gate uses `system.admin.access` server-side.

### Phase 5 foundation

- reference/master data schema is landed
- onboarding redesign is landed
- contacts/business-memory/AI-readiness schema is landed
- build and route surfaces are healthy
- tenant UI tranche 1 is already shipped:
   - contacts CRUD + tag assignment
   - Business Brain CRUD
   - AI Readiness card + recompute/save
   - minimal product / service create flow

### Phase 6 foundation

- `message_queue` schema is landed
- `inbound_messages` schema is landed
- OTP still uses the gateway path
- Phase 6 contract-ready WAPI surface is already shipped:
   - gateway client wrapper
   - HMAC-verified webhook receivers
   - tenant-scoped session helpers
   - owner/admin WhatsApp connect/reset/disconnect UI
   - outbound worker skeleton
   - first Dify runtime foundation

### Phase 7 foundation

- `campaigns`
- `campaign_variants`
- `campaign_safety_reviews`
- `campaign_recipients`
- `followup_sequences`
- `followup_steps`

## What is not shipped yet

### Do not misclassify these

- Missing full admin modules is not a bug for the current stage.
- Missing live gateway behavior is still expected while Request 05 remains externally blocked.
- Missing Phase 7 app query/UI surfaces is expected because that phase is still at schema-foundation stage.

### Actual pending work

- interactive validation for shipped Phase 5 and Phase 6 work
- Phase 7 campaign UI and worker-driven behavior
- omnichannel architecture prep for future inbox/channel rollout
- release hardening and operational close-out

## Delivery priority for the next round

Follow this order unless the user explicitly changes priority:

1. Complete the remaining interactive validation for shipped Phase 5 and Phase 6 contract-ready work where credentials, browser interaction, or live secrets are still needed.
2. Implement the functional Phase 7 tranche.
3. Update architecture and plan docs so future inbox/campaign work can grow into Facebook, Instagram, Shopee, Lazada, and TikTok without redoing tenant or AI isolation.
4. Keep release hardening and blocker tracking visible.
5. Keep full admin modules for a later dedicated tranche.

## Required next tranche

### Tranche 1 — close out Phase 5 validation only

Goal:

- confirm the already shipped Phase 5 tenant tranche in interactive flows and document any real gaps

Deliverables:

1. Run the remaining interactive checks from the latest Phase 5 test doc.
2. Fix only defects actually found during that pass.
3. Update docs and progress ledger with verified versus still-manual status.

Acceptance bar for Tranche 1:

- shipped Phase 5 tranche 1 is either confirmed or any real defect is fixed
- progress docs clearly separate automated versus interactive validation

### Tranche 2 — functional Phase 7 + omnichannel-safe planning

Do this after Tranche 1 validation unless the user explicitly reprioritizes.

Goal:

- turn the campaign schema into real tenant-facing behavior while preserving an upgrade path to omnichannel inbox and channel adapters

Deliverables:

1. campaign composer
2. variant editor
3. safety review presentation
4. follow-up sequence UI
5. tenant-scoped campaign query surfaces
6. worker/state behavior only where realistic and grounded by the shipped queue model
7. omnichannel-safe design updates in docs
   - identify where inbox/campaign abstractions must stay channel-agnostic
   - preserve WhatsApp-first runtime as the first adapter, not the final universal model
   - note rollout intent for Facebook, Instagram, Shopee, Lazada, and TikTok
8. doc and progress updates

Important constraint:

- Do not re-open shipped Phase 6/Dify foundation code unless validation finds a real defect.
- Preserve the existing Dify tenant-isolation rules while Phase 7 grows.
- Do not let new inbox/campaign concepts assume WhatsApp-only identities or webhook payload shapes.
- Marketplace channels such as Shopee, Lazada, and TikTok may require commerce-aware modeling beyond plain chat messages.

Acceptance bar for Tranche 2:

- campaign draft flow works
- tenant isolation is explicit in query paths
- docs and tests are updated to match shipped functionality
- omnichannel direction is documented without pretending those connectors are already shipped

## Admin-module rule

Do not use the next round to fully implement:

- `/admin/tenants`
- `/admin/users`
- `/admin/wa-sessions`
- `/admin/jobs`
- `/admin/ai`
- `/admin/billing`
- `/admin/audit`
- `/admin/system-health`
- `/admin/abuse`
- `/admin/settings`

unless the user explicitly says to reprioritize into the admin-module tranche.

Right now those routes are supposed to be placeholders.

## Required plan enhancements

As you work, maintain these delivery rules:

1. Separate `schema shipped`, `shell shipped`, and `functional phase complete`.
2. Keep release hardening visible in the plan.
3. Keep doc alignment current after every meaningful tranche.
4. Do not mark WAPI WhatsApp readiness green while Request 05 remains externally blocked.
5. Preserve multi-tenant Dify isolation: WAPI resolves tenant ownership first; Dify does not.
6. Treat tenant-dedicated Dify as a later upgrade path, not the first implementation.
7. Keep future inbox/campaign abstractions compatible with later connectors for Facebook, Instagram, Shopee, Lazada, and TikTok.

## Required documentation updates after each tranche

Always update:

- [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)

Update when scope changes materially:

- [docs/product/roadmap.md](../../docs/product/roadmap.md)
- relevant request test docs under [docs/request](../../docs/request)
- relevant architecture docs when implementation meaningfully changes behavior or expectations

## Validation expectations

After each substantive edit set, prefer this validation order:

1. the narrowest relevant behavior check
2. affected request-doc test flow if available
3. `pnpm typecheck`
4. `pnpm build`

When a feature is interactive and cannot be fully verified automatically:

- complete the non-interactive checks yourself
- document exactly what still needs manual verification
- update `delivery-progress.md` with verified versus pending status

## Non-goals for this round

- rewriting the auth model
- building full billing
- building full admin modules by default
- pretending the external gateway blocker is already solved
- treating Dify as a cross-tenant shared memory store
- implementing tenant-dedicated Dify infrastructure before the shared-runtime tenant-safe layer exists
- prematurely implementing full omnichannel connectors before the shared inbox model and channel abstractions are planned
- large speculative refactors without user-facing delivery value

## Definition of success for the next round

Success means:

1. the next functional tranche is delivered in real WAPI behavior, not only schema
2. the admin shell remains stable and correctly treated as complete for its current scope
3. docs reflect actual shipped state
4. remaining blockers are explicit, especially Request 05
5. WAPI is closer to end delivery without drifting into lower-priority work