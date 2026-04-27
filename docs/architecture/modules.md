# WAPI modules

Top-level modules and how they relate. Each module has its own doc for
deeper schema.

The first dynamic-module slice is now live in the app model:

- `modules` is the global catalog of tenant-visible workspace modules.
- `industry_module_presets` maps an industry starter pack to default module visibility.
- `tenant_modules` stores each workspace override and drives the tenant sidebar.

Implementation rule: route labels, icons, and matchers still live in code,
but visibility is data-driven from `tenant_modules`. This keeps UI metadata
local to the app while making tenant workspaces configurable.

```
┌─────────────── Tenant / Workspace ────────────────┐
│  tenants · tenant_members · tenant_settings       │
│  tenant_business_profiles · tenant_ai_settings    │
└──────────────────────┬─────────────────────────────┘
                       │ owns
     ┌─────────────────┼─────────────────┬──────────────┬─────────────┐
     ▼                 ▼                 ▼              ▼             ▼
 WhatsApp           Master Data      Contacts/CRM   Campaigns      Inbox
 connected_accounts products         contacts       campaigns      inbox_threads
 whatsapp_sessions  services         contact_lists  campaign_*     inbox_messages
                    price_lists      opt_outs                      ai_suggested_replies
                    branches                                       assignments
                    business_hours
                    payment_methods
     ▲                 ▲                 ▲              ▲             ▲
     └────────── feeds prompts ────── AI + MCP layer ──────────────────┘
                                      ai_provider_configs · ai_generations
                       ┌──────────────────┴──────────────────┐
                       ▼                                      ▼
                  Admin / System                       Billing
                  audit_logs · api_keys                plans · subscriptions
                  webhook_endpoints · roles            invoices · payments
                  permissions                          usage_counters
```

## Module list

| Module | Purpose | Phase | Detail doc |
|---|---|---|---|
| A. Tenant / Workspace | Multi-tenant root, memberships, business profile | 2–3 | [master-data.md](./master-data.md#tenant-business-profile) |
| B. Auth & Security | Users, sessions, roles, permissions, audit | 2, deepen 8 | [auth.md](./auth.md), [security.md](./security.md) |
| C. WhatsApp Accounts | Connected numbers + Baileys sessions | 3, deepen 5 | [whatsapp-gateway.md](./whatsapp-gateway.md) |
| D. Contacts / CRM | Contacts, lists, tags, opt-outs, lead status | 4 | [master-data.md](./master-data.md#contacts-crm) |
| E. Product master | ERP-lite product catalog with AI-ready fields and future channel sync support | 3 schema, 5 guided UI | [product-master-data.md](./product-master-data.md) |
| F. Service master | Appointment/package/subscription services | 3 schema, 4 UI | [master-data.md](./master-data.md#service-master) |
| G. Campaigns | Header/item campaign model | 6 | — (Phase 6) |
| H. Inbox | Thread/message/event model + realtime | 7 | [realtime.md](./realtime.md) |
| I. AI | Providers, tenant AI settings, generations log | 2 schema, deepen 5–7 | [ai-dify.md](./ai-dify.md) |
| J. MCP tools | Internal AI tool layer | 10 | [mcp-tools.md](./mcp-tools.md) |
| K. Admin Console | System/support/billing admin | 8 | [admin-console.md](./admin-console.md) |
| L. Billing & Payments | Plans, subs, invoices, usage | 9 | [billing-and-payments.md](./billing-and-payments.md) |
| M. Storage (objects) | MinIO/S3 media storage | 4 | [storage.md](./storage.md) |
| N. Audit / Compliance | Audit logs, consent, data export | 8 | [security.md](./security.md#audit--compliance) |
| O. Reporting / KPI | Tenant + admin KPI views | 8 | — (Phase 8) |
| P. Customer Memory Core | Tenant knowledge + customer memory + conversation memory + follow-up context | 8+, deepen later | [customer-memory-core.md](./customer-memory-core.md) |

## Dynamic workspace modules

Current shipped module codes:

- `whatsapp`
- `contacts`
- `products`
- `services`
- `brain`
- `campaigns`
- `ai_assistant`
- `analytics` (cataloged, not enabled by presets yet)

Preset source of truth:

- `industry_module_presets` is keyed by `ref_industries.code`
- onboarding writes the business profile first, then syncs `tenant_modules`
- existing tenants are lazily backfilled when the tenant layout or module settings page loads

Manual override rule:

- preset-driven rows use `tenant_modules.source='preset'`
- any toggle from Settings → Modules flips the row to `source='manual'`
- later industry changes only auto-update rows still owned by the preset source

### Sidebar behavior

- Overview and Settings stay always visible.
- Module-backed links appear only when their `tenant_modules.enabled` value is true.
- The first guarded routes are `Products` and `Services`; more routes can adopt the same guard incrementally.

## Transactional pattern

All transactional modules (campaigns, orders, bookings, quotes, invoices, payments)
follow a **header + items** shape:

| Header | Items/events |
|---|---|
| `campaigns` | `campaign_audiences`, `campaign_messages`, `campaign_events` |
| `orders` (future) | `order_items`, `order_events` |
| `bookings` (future) | `booking_items`, `booking_events` |
| `quotes` (future) | `quote_items` |
| `invoices` (billing) | `invoice_items`, `payments` |

Rule: never shove details into a `jsonb` column on the header when the
detail might be queried, reported on, or referenced by a foreign key.
`jsonb` is fine for free-form metadata (`products.metadata`), not for
line items.

## Tenant isolation rule

Every row in every non-global table carries `tenant_id`. Every query
filters by `tenant_id`. Exceptions (allowed to have NULL tenant_id):

- `users` (users can belong to many tenants)
- `ai_provider_configs` when `tenant_id IS NULL` → system default
- `roles` when `tenant_id IS NULL` → system-supplied role template
- `plans` (global pricing catalog)
- `permissions` (global catalog)

All MCP tools and all server actions resolve `tenant_id` from the
authenticated context — **never** from client input.
