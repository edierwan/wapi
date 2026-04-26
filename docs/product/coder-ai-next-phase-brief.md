# Coder AI Next Phase Brief

Use the workspace prompt at:

- [wapi-next-phase-delivery.prompt.md](../../.github/prompts/wapi-next-phase-delivery.prompt.md)

Required companion docs:

- [roadmap.md](./roadmap.md)
- [delivery-progress.md](./delivery-progress.md)

Short instruction:

- Continue WAPI delivery from the current shipped state.
- Do not treat the current admin page as broken.
- Treat Phase 5 tenant UI tranche 1 and Phase 6 contract-ready plus Dify foundation as already shipped; validate them and fix only real defects.
- Then move to functional Phase 7.
- While doing that, keep the architecture compatible with later omnichannel rollout for Facebook, Instagram, Shopee, Lazada, and TikTok.
- Preserve the current Dify multi-tenant guardrails: WAPI resolves tenant ownership first, then calls Dify with tenant-scoped context.
- Do not use a shared mixed-tenant dataset as the tenancy boundary.
- Keep tenant-dedicated Dify and full omnichannel connectors as later roadmap work, not this immediate tranche.
- Keep full admin modules for a separate later tranche unless explicitly reprioritized.
