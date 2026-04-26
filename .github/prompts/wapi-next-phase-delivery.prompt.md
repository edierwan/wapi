---
description: "Use when: continuing WAPI delivery from the current shipped state with a single live progress ledger and without drifting into lower-priority admin or future-channel work too early."
---

# WAPI Next-Phase Delivery Brief

You are continuing delivery for the WAPI application in the current workspace.

Scope boundary:

- Work only in the WAPI repo.
- Treat the WhatsApp gateway multi-tenancy work from Request 05 as an external dependency unless you are implementing the WAPI-side integration contract.
- Do not switch into Getouch portal work unless the task explicitly asks for it.

Read these files first before planning or changing code:

- [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)
- [docs/product/roadmap.md](../../docs/product/roadmap.md)
- [docs/architecture/ai-dify.md](../../docs/architecture/ai-dify.md)
- [docs/architecture/customer-memory-core.md](../../docs/architecture/customer-memory-core.md)
- [docs/request/13-test-phase6-contract-ready.md](../../docs/request/13-test-phase6-contract-ready.md)
- [docs/request/14-test-phase7-campaigns.md](../../docs/request/14-test-phase7-campaigns.md)
- [docs/request/08-test-phase5.md](../../docs/request/08-test-phase5.md)
- [docs/request/11-test-admin-console.md](../../docs/request/11-test-admin-console.md)
- [docs/architecture/admin-console.md](../../docs/architecture/admin-console.md)

## Source-of-truth rule

Treat [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md) as the only live progress ledger.

- Do not restate or fork its delivery truth into new brief files.
- Update that file after each meaningful delivery or validation step.
- Use [docs/product/roadmap.md](../../docs/product/roadmap.md) only for stable phase direction and future sequencing.
- By default, update only [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md).
- Only update request test docs or roadmap/architecture files when the current phase work or validation result genuinely changes those documents.

## Required guardrails

1. Preserve the current shipped truth from [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md).
2. Treat missing full admin modules as expected until the admin-module tranche is explicitly chosen.
3. Keep Request 05 explicit as the external blocker for live WhatsApp behavior.
4. Preserve multi-tenant Dify isolation: WAPI resolves tenant ownership first, then passes tenant-scoped context to Dify.
5. Keep future inbox, campaign, and follow-up abstractions compatible with omnichannel rollout and Smart Customer Memory.

## Default next-round priority

Unless the user explicitly reprioritizes, follow the active next actions and priority order recorded in [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md).

Execution order for the round:

1. deliver the active phase work or defect fixes
2. run the relevant phase test scripts and validation flows after the delivery work
3. record the results, blockers, and remaining manual checks back into [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)
4. report back what shipped, what passed, what is still blocked, and what the next phase should be

## Required documentation updates after each tranche

Always update:

- [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)

Update when scope changes materially:

- [docs/product/roadmap.md](../../docs/product/roadmap.md)
- relevant request test docs under [docs/request](../../docs/request)
- relevant architecture docs when implementation meaningfully changes behavior or expectations

Avoid creating extra handoff files unless the user explicitly asks for a new durable document.

Do not create a new summary file just to report test outcomes.

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

1. the active work follows the status and next actions recorded in [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)
2. the admin shell remains correctly treated as complete for its current scope
3. docs reflect actual shipped state without duplicated handoff drift
4. remaining blockers stay explicit, especially Request 05
5. the relevant phase test scripts are executed after delivery work and their results are written back to [docs/product/delivery-progress.md](../../docs/product/delivery-progress.md)
6. WAPI moves toward delivery without drifting into lower-priority work
