# Master data & transactional schema

This is the deep doc for how we model the **business stuff** inside a tenant.
Focus: keep the foundation SAP-material-master-grade, but SME-simple.

## Tenant business profile

Drives onboarding branching and AI context.

Current onboarding rule: the initial setup is intentionally minimal.
Users choose industry and country, optionally add support email and website,
and WAPI infers the starting `business_nature`, currency, timezone, fallback
language, and default AI tone. Fine-tuning still happens later in Settings.

### `tenant_business_profiles`

- `id` uuid pk
- `tenant_id` uuid fk → tenants (unique)
- `business_nature` enum: `product | service | hybrid | booking | lead_gen | support | other`
- `industry` text (free text + curated suggestions later)
- `business_registration_no` text null
- `tax_id` text null
- `default_currency` text (ISO 4217, e.g. `MYR`)
- `default_language` text (`en`, `ms`, `zh`, `id`, …)
- `timezone` text (IANA, e.g. `Asia/Kuala_Lumpur`)
- `primary_country` text (ISO 3166-1 alpha-2)
- `primary_phone` text
- `support_email` text
- `website_url` text
- `created_at`, `updated_at`

The `business_nature` value is now primarily an inferred routing signal for
workspace modules and future setup suggestions rather than a mandatory user
decision in the first-run flow.

## Product master

Designed ERP-compatible. SME tenants see a guided master-data editor; the
schema is ready for variants, price lists, bundles, channel mapping, and inventory.

Detailed design: [product-master-data.md](./product-master-data.md)

### `product_categories`

- `id`, `tenant_id`, `parent_id` (self fk, null), `code`, `name`,
  `description`, `status`, `sort_order`, timestamps

### `products`

- `id`, `tenant_id`, `category_id` (null)
- `product_code` (tenant-unique), `sku`, `barcode`
- `name`, `slug`, `short_description`, `long_description`
- `product_type` enum: `physical | digital | bundle | consumable | other`
- `status` enum: `draft | active | inactive | archived`
- `brand`
- `unit_of_measure` (`pc`, `kg`, `pack`, …)
- `default_price` numeric(18,4), `compare_at_price` numeric(18,4), `currency`
- `cost_price` numeric(18,4) null
- `tax_code` text null
- `track_inventory` boolean
- `ai_selling_notes`, `ai_faq_notes`
- `tags` jsonb
- `metadata` jsonb (loose fields)
- timestamps

### `product_variants`

- per-SKU row for size/colour/flavour etc.
- `attributes` jsonb (e.g. `{ "size": "M", "colour": "red" }`)

### `price_lists` / `product_prices`

- `price_lists` define named lists (retail, wholesale, promo)
- `product_prices` = (product, variant?, price_list?, currency,
  amount, compare_at, effective_from/to)
- MVP: every tenant has one implicit "default" list — no UI needed,
  but schema ready for segmented pricing.

### `product_media`

- (product|variant, media_type, url, storage_key, alt_text, sort_order)
- `storage_key` references MinIO object — see [storage.md](./storage.md)

### `product_bundles`

- parent product ⇄ child product/variant + quantity. Enables combo/package SKUs.

### `product_channel_mappings`

- future bridge to Shopee, Lazada, TikTok Shop, Shopify, WooCommerce, Facebook/Instagram shops, and custom channels
- stores external ids, channel title/url/status, sync state, sync errors, and last-sync timing

### `inventory_locations` / `inventory_balances`

- For multi-branch stock tracking. MVP ignores UI; schema there so
  `track_inventory=true` products can join later.

## Service master

First-class, not a "type=service" on products. Services have duration,
availability, and booking semantics products don't.

### `service_categories`

- parallel shape to product_categories.

### `services`

- `id`, `tenant_id`, `category_id` (null)
- `service_code`, `name`, descriptions
- `service_type` enum: `consultation | appointment | package | subscription | repair | delivery | other`
- `duration_minutes` null
- `default_price` null, `currency`, `tax_code`
- `requires_booking` boolean
- `requires_deposit` boolean
- `status`
- `metadata` jsonb
- timestamps

### `service_packages` / `service_package_items`

- Bundled services. `validity_days` for subscription-like packs.

### `service_availability`

- (service, branch?, day_of_week, start_time, end_time, capacity)
- Feeds booking UI + AI "when are you open?" queries.

## Branches, hours, payments

Cross-cutting master data used by both products and services.

- `branches` — `(id, tenant_id, code, name, address, phone, timezone, status)`
- `business_hours` — `(tenant_id, branch_id?, day_of_week, open_time, close_time)`
- `payment_methods` — `(tenant_id, kind: cash|bank_transfer|fpx|stripe|billplz|..., label, config jsonb, status)`

## Contacts / CRM

### `contacts`

- `id`, `tenant_id`
- `phone` (E.164), `name`, `email`
- `lead_status` enum: `new | engaged | hot | customer | churned | opted_out`
- `lifetime_value` numeric null
- `last_contacted_at`, `last_replied_at`
- `assigned_user_id` null
- `follow_up_at` null
- `notes` text
- `metadata` jsonb
- timestamps
- **unique(tenant_id, phone)**

### `contact_lists` / `contact_list_members`

- Lists are persistent segments (e.g. "KL customers", "hot leads March").
- Membership rows are cheap to add/remove.

### `contact_tags`

- Normalized tag catalog per tenant.
- `contact_tag_assignments` many-to-many.

### `opt_outs`

- `(tenant_id, phone, reason, opted_out_at)` unique on `(tenant_id, phone)`.
- Sending must hard-block any recipient row that exists here.

## Transactional pattern (future)

All transactional modules must be header + items.

### Orders (future, not Phase 3)

- `orders` header: `order_no`, `customer_id`, `status`, `source_channel`,
  totals, timestamps.
- `order_items` detail: `product_id | variant_id | service_id`,
  `description`, `quantity`, `unit_price`, `discount`, `tax`, `line_total`.

### Bookings (future)

- `bookings` header: `booking_no`, `customer_id`, `branch_id`, `status`,
  `scheduled_at`, `notes`.
- `booking_items`: `service_id`, `assigned_user_id`, `start_at`, `end_at`, `status`.

### Campaigns (Phase 6)

- `campaigns` header: name, channel, status, audience selector, schedule_at.
- `campaign_audiences`: resolved contact list snapshot at schedule time.
- `campaign_messages`: per-recipient material (variables filled in).
- `campaign_events`: sent/delivered/read/replied/failed rows.

## AI usage of master data

- Every AI generation call **must** receive a tenant-scoped context
  payload assembled from: `tenant_business_profiles`, top N relevant
  `products` / `services`, active `business_hours`, and the prompt
  intent.
- AI must **never** invent prices or availability. MCP tool layer is
  the single way for agents to read master data
  (`getProductPrice`, `getServiceAvailability`, …).
- See [mcp-tools.md](./mcp-tools.md) and [ai-dify.md](./ai-dify.md).

## Phasing

| Table group | Created in schema | UI shipped |
|---|---|---|
| `tenant_business_profiles` | **Phase 3 (now)** | Phase 3 onboarding |
| `products`, `product_categories`, `product_prices`, `product_variants`, `product_media` | **Phase 3 (now)** | Phase 5 guided editor |
| `services`, `service_categories`, `service_packages`, `service_package_items`, `service_availability` | **Phase 3 (now)** | Phase 4 |
| `price_lists`, `product_bundles`, `inventory_locations`, `inventory_balances` | Phase 4 | Phase 4+ |
| `branches`, `business_hours`, `payment_methods` | Phase 4 | Phase 4 |
| `contacts`, `contact_lists`, `contact_tags`, `opt_outs` | Phase 4 | Phase 4 |
| `campaigns` + children | Phase 6 | Phase 6 |
| `orders`, `bookings` + children | Phase 10+ (when revenue modules land) | — |
