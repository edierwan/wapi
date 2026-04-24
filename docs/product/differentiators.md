# WAPI differentiators

What makes WAPI different from generic WhatsApp blast tools.

## 1. Phone-first onboarding

- Sign-up flow starts with **business WhatsApp number**, not a form.
- System creates a tenant/workspace from the phone onboarding flow.
- Phone is **never** a primary key. We keep:
  - `tenants.id` as UUID
  - `tenants.primary_phone` (business owner phone)
  - `connected_accounts.phone_number` (one row per connected WA number)
- A tenant can have many connected WA numbers over time.

## 2. AI Business Memory ("Business Brain")

Every tenant has a structured memory the AI reads before every generation:

- business_name, business_type, industry
- products / services / price list
- FAQ
- opening hours, locations
- brand voice, tone, default language
- prohibited words, compliance notes
- payment methods
- delivery / booking rules

Technical realization: `tenant_business_profiles` + `products` +
`services` + `tenant_settings` + (later) tenant Dify knowledge base.
See [master-data.md](../architecture/master-data.md).

## 3. Tenant-scoped knowledge (private by default)

| Phase | Knowledge source |
|---|---|
| MVP | Structured tenant profile + products/services tables injected into prompts |
| Phase 7+ | Shared Dify app with metadata-filtered datasets (risk: prompt leakage) |
| Premium | **Dedicated Dify app + dataset per tenant** (recommended for private data) |

We **prefer dedicated datasets for private business data** even if shared
metadata-filtered datasets are cheaper.

## 4. Smart Campaign Flow (not blast)

Campaign lifecycle:

```
 AI draft → human approval → schedule →
 safe queue send → reply tracking → auto-segment →
 follow-up journey
```

Auto-segmentation examples:
- replied "interested" → `hot_lead`
- asked price → auto-send price list (from product master)
- no reply in 48h → follow-up journey
- complaint → route to support agent
- booking intent → create appointment task

## 5. Reply-to-action automation

Inbound classifier tags each message with one of:
`price_inquiry | booking_request | order_intent | complaint |
 location_request | payment_question | hot_lead | support_required`

Then the inbox suggests **next action**:
reply / create follow-up / tag customer / assign agent /
send product info / draft order / draft booking.

## 6. Safe-send / anti-ban engine

Baked-in controls per connected account:

- per-account send rate limits
- queue-based sending only (never direct-send from UI)
- randomized jitter between sends
- warm-up mode (progressive daily cap for new numbers)
- daily send cap
- opt-out list enforcement
- duplicate-to-same-number prevention
- failed-send retry with backoff
- campaign safety score (spammy-text detector) shown pre-approval

## 7. Human approval before AI sending (MVP)

- AI always drafts. Never sends on its own.
- Approval UI shows draft + safety score + audience preview.
- Only after Phase 7+, optional auto-reply on narrow safe intents
  (opening hours, location, simple FAQ), opt-in per tenant, logged.

## 8. Smart Inbox / Mini CRM

Per customer:
phone, name, tags, last_contacted, campaign_history, reply_history,
lead_status, assigned_agent, follow_up_date, opt_out, notes.

Auto-tags: `hot_lead | asked_price | interested | existing_customer |
complaint | needs_follow_up`.

## 9. Industry templates

Template packs we ship for first-run experience:
clinic, beauty salon, car dealer, property agent, restaurant/cafe,
training centre, retail shop, service contractor.

Each pack seeds:
- campaign templates
- reply templates
- FAQ starter pack
- suggested Business Memory fields
- suggested product/service master data skeleton

## 10. WhatsApp number health dashboard

Per connected account, always-visible:
connected/disconnected, QR required, messages sent today, failure rate,
reply rate, queue backlog, last inbound message, risk level,
session health score, per-number daily cap.

---

These 10 together make WAPI hard to copy from a generic blast tool.
Everything else is table stakes.
