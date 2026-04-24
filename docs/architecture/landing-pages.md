# Landing Pages (planned — Phase 11)

Template-based landing pages for ads funnels that end in WhatsApp.

## Flow

```
Facebook / IG Ads
        ↓
  WAPI Landing Page         (/lp/{slug} — public)
        ↓
  WhatsApp CTA / Lead form
        ↓
  WAPI CRM / Inbox
        ↓
  Follow-up Campaign
```

## Scope decision

- **MVP**: template-based (hero / offer / FAQ / WhatsApp CTA / form).
- **Post-MVP**: drag-and-drop builder.
- AI **generates copy** from the tenant's product/service master data and
  business memory. AI **must not invent prices**.

## Routes

| Kind | Path |
|---|---|
| Public (visitor) | `/lp/{pageSlug}` |
| Tenant list | `/t/{tenant}/landing-pages` |
| Tenant create | `/t/{tenant}/landing-pages/new` |
| Tenant edit | `/t/{tenant}/landing-pages/{id}` |

Alternative public path `/p/{slug}` is reserved if `/lp` collides.

## Tables

### `landing_pages`

| column | type |
|---|---|
| id | uuid pk |
| tenant_id | uuid fk tenants |
| campaign_id | uuid fk campaigns (nullable) |
| title | text |
| slug | text (unique per tenant; globally unique for public URL resolution) |
| status | text (`draft` \| `published` \| `archived`) |
| page_type | text (`lead_form` \| `product_offer` \| `service_booking` \| `event` \| `whatsapp_cta`) |
| content_json | jsonb |
| seo_title | text |
| seo_description | text |
| created_by_user_id | uuid |
| published_at | timestamptz |
| created_at | timestamptz |
| updated_at | timestamptz |

### `landing_page_blocks`

| column | type |
|---|---|
| id | uuid pk |
| tenant_id | uuid fk |
| landing_page_id | uuid fk |
| block_type | text |
| sort_order | integer |
| config_json | jsonb |

### `landing_page_submissions`

| column | type |
|---|---|
| id | uuid pk |
| tenant_id | uuid fk |
| landing_page_id | uuid fk |
| campaign_id | uuid fk (nullable) |
| contact_id | uuid fk (nullable) |
| name | text |
| phone | text |
| email | text (nullable) |
| message | text (nullable) |
| payload_json | jsonb |
| source | text |
| utm_source | text |
| utm_medium | text |
| utm_campaign | text |
| created_at | timestamptz |

## Initial block types

- Hero
- Offer details
- Product / service card
- Benefits
- FAQ
- Testimonial
- Lead form
- WhatsApp CTA
- Map / location
- Terms / disclaimer

## AI integration

- Generate landing page copy from `products` + `services` + business memory.
- Generate FAQ from `faq_entries` (future table).
- Generate the WhatsApp prefilled-text CTA message
  (`https://wa.me/{number}?text={encoded}`).
- **Do not invent prices.** If pricing missing → copy says "Enquire via
  WhatsApp."

## Tracking

- Page views
- Form submissions
- WhatsApp CTA clicks
- Conversion rate
- UTM attribution → campaigns

## Security

- Public pages are read-only and tenant-scoped by slug → tenant_id.
- Submissions tenant-scoped; contacts auto-created / deduped by normalised phone.
- Rate-limit per IP per slug.
- All submissions cleared through the same opt-out registry used by campaigns.
