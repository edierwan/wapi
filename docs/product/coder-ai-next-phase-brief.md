# Coder AI Next Phase Brief

Use the workspace prompt at:

- [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md)

Required companion docs:

- [roadmap.md](./roadmap.md)
- [delivery-progress.md](./delivery-progress.md)

Short instruction:

- Continue WAPI delivery from the current shipped state.
- Do not treat the current admin page as broken.
- Treat Phase 5 tenant UI tranche 1 as already shipped; only close out remaining interactive validation and fix real defects if found.
- Then move to WAPI-side Phase 6 integration.
- In the same next tranche, implement the first Dify runtime foundation in WAPI.
- Dify must be multi-tenant-safe from day one: WAPI resolves tenant/session/account/contact first, then calls Dify with tenant-scoped context.
- Do not use a shared mixed-tenant dataset as the tenancy boundary.
- Keep tenant-dedicated Dify as a later upgrade path, not the first implementation.
- Then move to functional Phase 7.
- Keep full admin modules for a separate later tranche unless explicitly reprioritized.
