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

### Phase 6 foundation

- `message_queue` schema is landed
- `inbound_messages` schema is landed
- OTP still uses the gateway path

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
- Missing Phase 6 and 7 app query/UI surfaces is expected because those phases are at schema-foundation stage only.

### Actual pending work

- Phase 5 functional tenant UI completion
- Phase 6 WAPI-side gateway integration
- Phase 7 campaign UI and worker-driven behavior
- release hardening and operational close-out

## Delivery priority for the next round

Follow this order unless the user explicitly changes priority:

1. Finish the functional Phase 5 tranche.
2. Prepare and implement the WAPI-side Phase 6 tranche.
3. Implement the functional Phase 7 tranche.
4. Keep full admin modules for a later dedicated tranche.

## Required next tranche

### Tranche 1 — complete functional Phase 5

Goal:

- turn the Phase 5 foundation into real tenant-facing capability

Deliverables:

1. Contacts UI
   - list page
   - create/manual add flow
   - basic edit flow
   - tags display and assignment support where realistic
   - clear tenant scoping on all queries
2. Business Brain UI
   - CRUD for `business_memory_items`
   - support at least the core kinds already modeled in schema
   - clear save, edit, delete flows
3. AI Readiness surface
   - dashboard or tenant surface showing the current readiness snapshot
   - sensible empty state if no score exists yet
4. Product/service editor follow-through if still missing in the shipped tenant UI
   - bind to existing schema
   - avoid widening into media/upload work unless required for core completion
5. Update docs and progress ledger after implementation and validation

Acceptance bar for Tranche 1:

- tenant-facing Phase 5 UI works in dev
- tenant scoping is explicit in query paths
- build and typecheck stay clean
- progress and roadmap docs reflect what was actually shipped

### Tranche 2 — WAPI-side Phase 6 integration

Do this only after Tranche 1 is in a good state, unless the user explicitly wants gateway integration first.

Goal:

- make WAPI structurally ready to consume the future multi-session gateway contract

Deliverables:

1. gateway client wrapper
   - single server-side client module
   - centralize URL, auth, shared-secret usage
2. session-aware WAPI integration surface
   - session status reads
   - QR retrieval
   - reset/disconnect primitives
3. webhook receivers
   - qr
   - connected
   - disconnected
   - message.inbound
   - message.status
   - verify signatures server-side
4. outbound queue worker
   - drain `message_queue`
   - update send state transitions
5. tenant WhatsApp UI
   - connect / QR / reset / disconnect state
   - server actions only for secret-bearing operations
6. doc and progress updates

Important constraint:

- If Request 05 gateway behavior is still not delivered externally, implement only the WAPI-side contract-ready pieces that can be done safely without pretending end-to-end readiness exists.

Acceptance bar for Tranche 2:

- WAPI code structure is ready for multi-session gateway integration
- no client exposure of gateway secret
- queue and webhook flows are server-side
- docs clearly state what is complete versus blocked by the external gateway

### Tranche 3 — functional Phase 7

Goal:

- turn the campaign schema into real product behavior

Deliverables:

1. campaign composer
2. variant editor
3. safety review presentation
4. follow-up sequence UI
5. tenant-scoped campaign query surfaces
6. worker/state behavior only where realistic and grounded by the actual shipped queue model

Acceptance bar for Tranche 3:

- campaign draft flow works
- tenant isolation is explicit in query paths
- docs and tests are updated to match shipped functionality

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
- large speculative refactors without user-facing delivery value

## Definition of success for the next round

Success means:

1. the next functional tranche is delivered in real WAPI behavior, not only schema
2. the admin shell remains stable and correctly treated as complete for its current scope
3. docs reflect actual shipped state
4. remaining blockers are explicit, especially Request 05
5. WAPI is closer to end delivery without drifting into lower-priority work