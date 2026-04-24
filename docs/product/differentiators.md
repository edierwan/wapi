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

## Differentiation statement

> Most WhatsApp tools help businesses **send** messages.
> WAPI helps businesses **understand replies, detect leads, personalise
> follow-ups, and turn WhatsApp conversations into sales actions.**

---

## Expanded differentiators (Apr 2026 — phased)

### 11. Smart Business Setup Wizard

Signup → first useful campaign in 5–10 minutes.

7 steps: business nature → profile → WhatsApp → products/services
→ business memory (FAQ, hours, payment, policy) → first campaign goal
→ AI-generated first-campaign draft.

The user is never dropped on an empty dashboard. Each step is skippable
but impacts the **AI Readiness Score** (#12). See [modules.md](../architecture/modules.md) §Onboarding.

### 12. AI Readiness Score

Per tenant, computed (not stored) from existing tables. Raises tenant
awareness that AI quality depends on data quality.

Checklist:
- business profile complete
- default language / tone set
- at least one product or service
- ≥ 5 FAQ entries
- business hours set
- payment method set
- WhatsApp account connected
- AI provider configured

UI: overall % + missing items + one recommended next action. CTA
copy: "Complete your Business Brain to improve AI accuracy."

### 13. Campaign Safety Assistant (user-friendly framing)

**Important UX rule**: SME users do **not** see a long spam-risk
checklist. Instead, WAPI analyses behind the scenes and auto-fixes
what it safely can.

Internal checks (hidden from user): message similarity, missing
variation, send volume, new/unwarmed WA number, too many links,
suspicious links, excessive emojis/uppercase, missing opt-out,
duplicate recipients, opted-out contacts, previous failure rate,
daily cap, hard-sell tone.

Auto-fixes WAPI attempts:
1. Generate multiple natural message variants
2. Add/suggest opt-out text
3. Remove duplicate recipients
4. Exclude opted-out contacts
5. Recommend or auto-set safe send speed and batch size
6. Reduce excessive uppercase / emojis
7. Warn about shortened links
8. Suggest softer conversation-first wording
9. Suggest reply-first campaign variant (#15)
10. Adjust schedule if daily cap would be exceeded
11. Pause/hold campaign if risk is too high

User-facing summary:
- Safety status badge: **Good / Needs review / High risk**
- "6 message variants generated"
- "23 duplicate/opt-out contacts excluded"
- "Send mode: Gradual — est. 2 hours"
- Actions: Preview / Regenerate / Edit / **Approve & Schedule**

If high risk, show **one** clear reason and **one** recommended
action. The full checklist lives in the admin/audit view only.

Data: `campaign_safety_reviews` (campaign_id, risk_level, score_internal,
checks_json, autofixes_json, user_visible_summary, status).

Important caveat: the assistant **reduces** spam-like behaviour; it
does not guarantee no WhatsApp ban.

### 14. Smart Message Variation Engine

Auto-generated natural variants (A/B/C/D…) + personalisation slots:
`{name} {product} {city} {last_purchase} {agent_name}`.

Rules:
- variation never changes offer or price
- AI must not invent product/service information (grounded in master data)
- all variants require approval before send
- similarity check across variants
- minimum variant count enforced for audience > N

### 15. Reply-First Campaign Mode

Soft openers instead of "PROMO BESAR! BELI SEKARANG!":

> "Hi {name}, kami ada promo untuk {service} minggu ini. Nak saya share detail?"

Flow: light opener → if interested → send details → ask price →
send price list → no reply → schedule follow-up.

Materially better reply-rate on cold lists and less ban-prone than pure blast.

### 16. Reply Funnel / Conversation Funnel

Campaign analytics beyond sent/delivered:

`queued → sent → delivered → failed → replied → interested →
hot_lead → follow_up_scheduled → converted_later`

### 17. Hot Lead Detection

AI classifies inbound replies as:
`hot_lead | asked_price | booking_intent | order_intent |
interested | not_interested | complaint | support_required |
payment_ready | needs_follow_up`.

Dashboard widgets: Today's Hot Leads · Follow-ups Due ·
Unanswered Questions · New Booking Requests · Complaints.

### 18. Follow-up Engine

When a reply suggests "not ready yet", WAPI offers to create a
follow-up task. Example: "Nanti saya fikir dulu" → "Create
follow-up in 2 days?".

MVP row shape: `follow_ups(id, tenant_id, contact_id, thread_id,
campaign_id nullable, due_at, assigned_user_id, status, notes)`.

Future: automated follow-up journeys with consent rules.

### 19. Product/Service-aware AI replies

AI replies are grounded in master data. If a service/product is
missing, AI says so rather than inventing a price.

### 20. Campaign Template Library by Industry

Template packs per industry (clinic, beauty salon, car dealer,
property, restaurant, training, retail, contractor). Each pack
ships: campaign objective, copy variants, landing-page copy,
follow-up copy, reply templates, FAQ starter, recommended KPIs.

### 21. Customer Timeline / Mini CRM

Per contact: imported → campaign received → sent → replied →
AI suggested reply → agent replied → tagged hot lead →
follow-up scheduled → order/booking draft → opt-out.

### 22. Agent Performance

For team tenants: conversations handled, avg response time,
unresolved conversations, hot leads handled, follow-ups
completed, campaign replies handled.

### 23. Opt-out & Consent Handling

Every campaign ships opt-out. Auto-detect STOP/unsubscribe
keywords; mark `contacts.opted_out_at`; audit source.

Consent sources: imported_list · landing_page_form · manual_add ·
wa_inbound · existing_customer.

### 24. AI Brand Voice Lock

Tenant-defined tone (friendly · professional · Malay casual · formal
corporate · short-direct · no-hard-sell · premium · playful-respectful)
applied consistently to campaigns, replies, landing pages, follow-ups.

### 25. Campaign Approval Workflow

For team tenants: draft → pending_approval → approved → scheduled →
sending → completed / paused / cancelled. Campaigns cannot send
until approved when workflow is enabled.

### 26. MCP as business action layer

Safe action layer for the WAPI AI agent. Example request:
*"Buat campaign untuk whitening package, target customer interested,
schedule esok 9 pagi."*

MCP flow: search product → get price → find contacts by tag →
create draft → generate variants → calculate safety score →
**request user approval** → schedule only after approval.

MCP tools **never** send WhatsApp autonomously in MVP.

### 27. Admin abuse / risk monitor

System admin surface (not tenant-visible): tenants sending too fast,
high failed-send rate, high opt-out rate, suspicious content,
repeated WA disconnect, many rejected messages, cold-list blast.

Protects the WAPI platform and reduces WhatsApp ban exposure.

### 28. One-Minute Campaign

Flagship UX: select product/service → select audience → AI
generates variants → safety score → approve → schedule. Under one
minute once business memory is complete.

### 29. Business Memory Import

Tenant pastes/uploads price list, FAQ, product/service list,
opening hours, policies. AI extracts structured data into the
right tables. **Human review is required before saving.**

### 30. Campaign Landing Page Builder (future)

Ads funnel: Facebook/IG Ads → WAPI landing page →
WhatsApp CTA / lead form → WAPI CRM/inbox → follow-up campaign.

MVP = template-based pages, not full drag-and-drop.

Public routes: `/lp/{pageSlug}` (or `/p/{pageSlug}`).
Tenant routes: `/t/{tenant}/landing-pages[...]`.

Suggested tables: `landing_pages`, `landing_page_blocks`,
`landing_page_submissions`. See [landing-pages.md](../architecture/landing-pages.md).

---

## MVP vs later

| MVP | Later |
|---|---|
| Smart Business Setup Wizard | Full landing page builder |
| Business Memory | Full MCP automation |
| Product/service master (basic) | Autonomous AI reply |
| AI Campaign Writer | Dedicated Dify per tenant |
| Smart Message Variation | Complex billing |
| Campaign Safety Assistant | Advanced workflow automation |
| Safe queued sending | Custom tenant subdomains |
| Basic Inbox | |
| AI Suggested Reply | |
| Hot Lead Detection (basic) | |
| Basic Campaign KPI | |

---

## Open risks / questions

- WhatsApp ban risk is never zero — set tenant expectations.
- Variation engine cost (LLM calls per campaign) — cache by product+tone.
- Grounded AI needs fresh master data; ingestion UX is critical.
- Multi-language tone accuracy (Malay / mixed-language) needs eval harness.
- MCP must not have send permission without human approval, ever, in MVP.
- Shared gateway multi-tenancy is a hard blocker — see [docs/request/05](../request/05-wa-gateway-multitenancy.md).

