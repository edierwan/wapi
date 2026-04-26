# Coder AI Next Round Message

Copy-paste this exactly for the next Coder AI run.

```text
Work only in the WAPI repo.

Before changing code, read these files first and treat them as the source of truth:
- docs/product/roadmap.md
- docs/product/delivery-progress.md
- docs/product/coder-ai-next-phase-brief.md
- docs/architecture/ai-dify.md
- docs/architecture/admin-console.md
- docs/request/08-test-phase5.md
- docs/request/11-test-admin-console.md
- docs/request/13-test-phase6-contract-ready.md

Current truths to preserve:
- Phase 5 tenant UI tranche 1 is already shipped.
- Phase 6 contract-ready WAPI work is already shipped.
- The first Dify runtime foundation is already shipped.
- Request 05 is still the external blocker for live WhatsApp gateway behavior.
- The admin shell is shipped, but the admin modules are intentionally still placeholder-only.
- Screens like /admin/settings showing Coming soon are expected right now and are NOT regressions.

What I want next:

1. First close out interactive validation only.
   - Run or prepare the remaining validation for:
     - Phase 5 interactive checks
     - Phase 6 contract-ready checks from docs/request/13-test-phase6-contract-ready.md
     - Admin shell checks
   - Fix only real defects you actually find.
   - Do not reopen shipped Phase 6 or Dify work unless validation exposes a real bug.

2. Then move straight into functional Phase 7.
   - Build real tenant-facing campaign behavior from the shipped schema.
   - Prioritize:
     - campaign composer
     - variant editor
     - safety review presentation
     - follow-up sequence UI
     - tenant-scoped campaign query surfaces
     - worker/state behavior only where grounded by the existing queue model

3. Keep Dify multi-tenant rules exactly intact.
   - WAPI resolves tenant ownership first.
   - Dify receives tenant-scoped context only.
   - Do not use a shared mixed-tenant dataset as the tenancy boundary.
   - Do not use bare phone numbers as conversation keys.
   - Do not implement tenant-dedicated Dify infra in this tranche.

4. Keep omnichannel expansion compatible, but do not build full connectors yet.
   - Future targets are Facebook, Instagram, Shopee, Lazada, and TikTok.
   - While implementing Phase 7, do not hard-code inbox/campaign abstractions to WhatsApp-only assumptions.
   - Do not abuse whatsapp_sessions as a fake universal channel table.
   - If a marketplace channel needs different semantics later, leave room for that in the design.

5. Do NOT spend this round building full admin modules unless I explicitly reprioritize.
   - /admin/tenants
   - /admin/users
   - /admin/wa-sessions
   - /admin/jobs
   - /admin/ai
   - /admin/billing
   - /admin/audit
   - /admin/system-health
   - /admin/abuse
   - /admin/settings

Acceptance bar for this round:
- interactive validation status is updated clearly
- any real defects found in shipped Phase 5/6 are fixed
- Phase 7 functional tranche materially advances
- docs stay aligned with shipped truth
- blockers remain explicit, especially Request 05

Always update after meaningful work:
- docs/product/delivery-progress.md
- docs/product/roadmap.md if scope meaningfully changes
- relevant request docs if validation status changes

Validation order after substantive edits:
1. narrowest behavior check
2. affected request-doc test flow
3. pnpm typecheck
4. pnpm build

At the end, report:
- what was shipped
- what was validated
- what is still blocked
- what should happen in the next round
```