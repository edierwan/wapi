# Request 15 — Product master data validation

This document records the validation scope and observed results for the richer product-master-data tranche delivered on 2026-04-26.

## Scope

This tranche covers three user-facing issues:

1. registration should preserve already-entered non-password fields when password validation fails
2. `/t/{slug}/products` should move from a minimal create form to a guided product master-data editor with future-ready schema support
3. `/admin/users` should use production-style wording instead of development-only "test user" copy

## Local validation

Expected checks:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`

Observed result:

- all three passed before branch promotion

## Database rollout

### `wapi.dev`

Expected:

- `drizzle/0004_breezy_scarecrow.sql` applies cleanly
- `scripts/sql/0002_seed_reference_data.sql` reseeds reference data including `ref_units`
- new schema objects exist:
  - `product_bundles`
  - `product_channel_mappings`
  - `ref_units`
- new `products` columns exist:
  - `slug`
  - `compare_at_price`
  - `ai_selling_notes`
  - `ai_faq_notes`
  - `tags`

Observed:

- migration applied cleanly
- reference seed applied cleanly
- `ref_units = 11`
- new tables present
- expected new `products` columns present

### `wapi`

Expected:

- same migration and seed flow as `wapi.dev`
- schema remains aligned between dev and prod

Observed:

- migration applied cleanly
- reference seed applied cleanly

## Live deployment smoke checks

### Development

Expected:

- `https://wapi-dev.getouch.co/api/health` returns `200`
- `https://wapi-dev.getouch.co/register` returns `200`
- anonymous `https://wapi-dev.getouch.co/admin/users` redirects to login
- anonymous `https://wapi-dev.getouch.co/t/demo/products` redirects to login

Observed:

- deployment completed for commit `64579f5`
- public edge briefly returned `502` after Coolify rotated the app container name
- host-side Caddy sync helper repaired the upstream
- health returned `200`
- register returned `200`
- admin users redirected to login
- tenant products redirected to login

### Production

Expected:

- `https://wapi.getouch.co/api/health` returns `200`
- anonymous `https://wapi.getouch.co/admin/users` redirects to login
- anonymous `https://wapi.getouch.co/t/demo/products` redirects to login or protected auth entry

Observed:

- deployment completed for commit `68ba144`
- public edge briefly returned `502` after Coolify rotated the prod app container name
- host-side Caddy sync helper repaired the upstream
- health returned `200`
- admin users redirected to login
- tenant products redirected to login

## Notes

- The richer product master UI currently ships category quick-create, reference-backed pricing/unit validation, primary media URL handling, AI notes, and view/edit flows.
- Variants, bundle UI, price-list UI, channel-sync UI, and MinIO uploads remain intentionally deferred.
