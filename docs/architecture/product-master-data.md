# Product master data

This document records the current WAPI product-master design after the 2026-04-26 product tranche.

Goal: keep the tenant UI SME-simple while preserving a backend model that can feed AI, campaigns, landing pages, CRM, inventory, and later marketplace/channel sync.

## Design principles

- One tenant-scoped source of truth for every sellable product.
- Keep the primary UI focused on the master record first: code, name, category, price, unit, descriptions, AI notes, and primary media.
- Variants, bundles, price lists, and channel mappings are schema-ready even if the tenant UI exposes them later.
- AI must read stored product facts, not invent them.
- Downstream modules should reference the product master instead of duplicating product copy and pricing.

## Core tables

### `product_categories`

Tenant-scoped reusable categories.

Current usage:

- picker in `/t/{slug}/products`
- optional quick-create from the product editor
- future use in search, storefront filters, reporting, and marketplace exports

### `products`

Primary product record.

Current important columns:

- `tenant_id`, `category_id`
- `product_code` tenant-unique
- `sku` tenant-unique when present
- `name`, `slug`
- `short_description`, `long_description`
- `product_type`
- `status` with `draft | active | inactive | archived`
- `brand`
- `unit_of_measure`
- `default_price`, `compare_at_price`, `currency`
- `tax_code`
- `track_inventory`
- `ai_selling_notes`
- `ai_faq_notes`
- `tags`
- `metadata`

Why this shape:

- enough for sales teams and AI assistants to answer questions safely
- enough for landing pages and campaigns to reuse product summaries
- enough to bridge into inventory and channel sync later without redesigning the product row

### `product_variants`

Variant-ready table for size, colour, volume, plan tier, and similar SKU children.

Current status:

- schema-ready
- UI intentionally deferred until more tenants need it

### `price_lists` and `product_prices`

Pricing foundation for retail, wholesale, promo, and channel-specific pricing.

Current runtime rule:

- the tenant product editor writes one implicit default price row alongside the canonical price fields on `products`
- later UI can add named price lists without replacing the master-product flow

### `product_media`

Primary media and later gallery assets.

Current runtime rule:

- the tenant product editor manages one primary image URL + alt text
- later we can switch the same table to MinIO-backed uploads without redesigning the product form contract

### `product_bundles`

Bundle/kit structure for parent product -> child product or variant + quantity.

Current status:

- schema-ready for combo/package products
- tenant UI intentionally deferred

### `product_channel_mappings`

Future marketplace/channel bridge.

Current columns support:

- channel enum
- external product / variant ids
- external SKU
- channel title / URL / status
- sync status, last sync time, sync error
- free-form metadata

Current status:

- schema-ready only
- tenant UI intentionally hidden until channel sync workflows exist

## Reference data

### `ref_units`

Global unit-of-measure reference table.

Current seeded set:

- `pc`, `box`, `pack`, `bottle`, `set`
- `kg`, `g`, `litre`, `ml`
- `hour`, `session`

Rule:

- product editor must use an active `ref_units.code`
- free-text unit strings should not be introduced from the UI anymore

## Current tenant UI

Route: `/t/{slug}/products`

Shipped in this tranche:

- product list with category, type, default price, status, AI-readiness hints, and view/edit actions
- guided product editor with sections for:
  - basic info
  - customer description
  - pricing
  - media
  - AI notes
  - advanced fields
- quick-create category from the same form
- validation for tenant scoping, duplicate product code, duplicate SKU, active currency, and active unit
- detail view card so users can audit exactly what the stored product record currently says

Intentionally not shipped yet:

- variant editor
- bundle builder
- multi-image gallery
- MinIO uploads
- price-list manager
- channel-sync UI
- CSV import wizard

## AI grounding contract

Product master data is a first-class AI grounding source.

Required behavior:

- AI may quote `default_price` only when the product record exists and price is populated.
- AI should prefer `short_description`, `long_description`, `ai_selling_notes`, and `ai_faq_notes` before improvising copy.
- If product facts are missing, AI should ask clarifying questions or escalate to a human instead of inventing details.
- Future Dify and MCP tools should read from the same tenant-scoped tables.

## Future extension path

The current design is intentionally ready for:

- inventory balances and stock movement
- richer variants and option matrices
- branch-specific pricing or availability
- WhatsApp quote/cart flows
- landing-page product cards
- marketplace adapters for Shopee, Lazada, TikTok Shop, Shopify, WooCommerce, and custom channels
- import/export jobs and audited sync logs

## Guardrails

- Never accept `tenant_id` from client input.
- Product category validation must remain tenant-scoped.
- Product code uniqueness is per tenant.
- SKU uniqueness is per tenant when SKU is present.
- Reference data such as currency and unit must come from global active reference tables.
- New UI work should extend the current product master, not create a second parallel product schema.
