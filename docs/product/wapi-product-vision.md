# WAPI product vision

> Status: living document. Update when positioning shifts.

## Positioning (one-liner)

**WAPI is an AI WhatsApp Growth Platform for SMEs.**
Not a blast tool. Not a CRM bolt-on. A tenant-aware SaaS where SMEs
connect WhatsApp, teach the system about their business, generate and
approve campaigns, send safely, manage replies, detect hot leads, and
automate follow-up — with AI as the default co-pilot, not the autopilot.

## Who it is for

Primary persona: **SME owner / marketing manager / admin** who already
uses WhatsApp for sales + support but outgrows copy-paste. 1–20 staff,
handling 50–10,000 chats/month, selling products and/or services.

Vertical starters we will ship industry packs for (see
[differentiators.md](./differentiators.md#9-industry-templates)):
clinics, beauty salons, car dealers, property agents, restaurants,
training centres, retail shops, service contractors.

## Core promise

In one dashboard, a tenant can:

1. **Connect** one or more WhatsApp numbers (Baileys today, Cloud API later).
2. **Teach WAPI about their business** — business profile, products, services, prices, FAQ, tone, policies ("Business Brain").
3. **Generate campaigns** with AI using that brain.
4. **Approve + schedule** safely (human-in-the-loop).
5. **Send through a safe queue** with anti-ban controls.
6. **Read replies in a smart inbox** with intent classification.
7. **Act on replies** — reply, tag, follow-up, draft order/booking.
8. **See KPIs** — reply rate, hot leads, opt-outs, deliverability.

## What WAPI explicitly is NOT (for MVP)

- Not an autonomous AI sender. AI drafts, humans approve.
- Not a full ERP. We design product/service master data to be
  ERP-compatible later, but we do not ship accounting, full inventory,
  or GL.
- Not a Meta WhatsApp Business Solution Provider today. We run on
  Baileys (unofficial). See
  [risks](#risks--open-decisions).
- Not a generic multi-channel suite. WhatsApp-first. Other channels
  (IG DM, Messenger) are post-v1.

## Scope anchors

| Dimension | MVP | Post-MVP |
|---|---|---|
| Tenancy | Path `/t/{slug}` | Subdomain after ACM |
| Auth | Better Auth (email + OAuth) | SSO/SAML for enterprise |
| AI | Shared Dify + Ollama fallback | Dedicated Dify per premium tenant |
| Sending | Baileys via `wa.getouch.co` | + Cloud API provider |
| Storage | MinIO / S3-compatible (`s3.getouch.co`) | CDN + signed URLs |
| Realtime | Postgres LISTEN/NOTIFY + SSE | Redis pub/sub + WebSocket |
| Billing | Stripe + local MY gateway (Billplz/ToyyibPay) | More regions |

## Key differentiators

Full breakdown in [differentiators.md](./differentiators.md). Top 5:

1. **Business Brain** — tenant-scoped business memory that grounds every AI call.
2. **Human-approved AI sending** — AI drafts, never auto-sends (MVP).
3. **Reply-to-action classifier** — not just reply tracking; next-best-action.
4. **Safe-send engine** — per-number caps, warm-up, randomized delays, campaign safety score.
5. **Industry template packs** — zero-to-first-campaign in minutes.

## Risks & open decisions

- **Baileys is unofficial.** Meta may ban numbers. Mitigations: safe-send controls, warm-up mode, per-number daily caps, clear user consent. Roadmap includes WhatsApp Cloud API as an additional gateway (see [whatsapp-gateway.md](../architecture/whatsapp-gateway.md)).
- **AI hallucination on prices.** Mitigation: AI must read from `products` / `services` master data tables, never free-guess prices. Enforced at MCP-tool layer.
- **Data residency.** MinIO self-hosted at `s3.getouch.co`. Document per-tenant export/delete in compliance phase.
- **ACM ($10/mo) deferred.** Path-based routing is good enough for MVP.
- **MCP scope creep.** MVP MCP tools are read/draft only — never send.

## Success metrics (company)

- Time-to-first-campaign < 15 min from sign-up.
- % tenants that send ≥ 1 approved campaign in week 1 > 40%.
- Reply rate ≥ 10% on AI-drafted campaigns.
- ≤ 2% WhatsApp number ban rate across fleet.
- NPS from SME owners ≥ 40.

See [roadmap.md](./roadmap.md) for phasing.
