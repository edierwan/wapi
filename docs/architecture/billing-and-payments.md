# Billing & payments

Plans, subscriptions, invoices, usage, enforcement. Ships Phase 9.

## Goals

1. Sell tiers (Starter / Business / Agency / Enterprise).
2. Meter usage (messages, AI generations, connected WA accounts, contacts).
3. Enforce limits gracefully (warn → throttle → block).
4. Support **international + Malaysian** payments from day one of Phase 9.

## Provider strategy

Abstracted behind a `PaymentProvider` interface. One tenant can have **one**
active provider.

| Provider | Scope | Use for |
|---|---|---|
| Stripe | International | Cards, SEPA, Link, checkout. Default. |
| Billplz | Malaysia | FPX (online banking) — SME preference. |
| ToyyibPay | Malaysia | FPX alternative, lower fees. |
| SenangPay | Malaysia | Backup. |
| iPay88 | Malaysia | Enterprise preference. |
| Manual | — | Offline bank-in (we mark invoices paid). |

Implementation: `src/server/payments/providers/{stripe,billplz,manual}.ts`.
Each implements `createCheckout`, `cancelSubscription`, `handleWebhook`, `refund`.

## Plans (initial)

| Plan | Target | WA accounts | Contacts | Messages/mo | AI generations/mo | Price (MYR/mo indicative) |
|---|---|---|---|---|---|---|
| **Starter** | Solo owner | 1 | 1,000 | 5,000 | 200 | 49 |
| **Business** | 2–5 staff | 3 | 10,000 | 30,000 | 2,000 | 199 |
| **Agency** | Multi-client | 10 | 50,000 | 150,000 | 10,000 | 599 |
| **Enterprise** | Custom | custom | custom | custom | custom | quote |

Prices are placeholders — set during Phase 9 pricing exercise.

## Schema

### `plans`

- `id`, `code` (`starter`, `business`, …), `name`, `description`
- `is_public` boolean (hidden plans for enterprise/deal-specific)
- `billing_interval` enum `monthly|yearly`
- `currency`, `amount` numeric(18,4)
- `features` jsonb
- `limits` jsonb (structured: `{ wa_accounts: 1, contacts: 1000, messages: 5000, ai_generations: 200 }`)
- `status` enum `active|retired`

### `subscriptions`

- `id`, `tenant_id` (unique active constraint: tenant has ≤ 1 active)
- `plan_id`
- `provider` enum
- `provider_subscription_id` text
- `status` enum `trialing|active|past_due|canceled|paused|expired`
- `current_period_start`, `current_period_end`
- `cancel_at` nullable
- `trial_ends_at` nullable
- `created_at`, `updated_at`

### `invoices`

- `id`, `tenant_id`, `subscription_id`
- `invoice_no` (human-friendly, per-tenant sequence)
- `status` enum `draft|open|paid|void|uncollectible`
- `currency`, `subtotal`, `tax_total`, `grand_total`
- `issued_at`, `due_at`, `paid_at`
- `provider_invoice_id` text

### `invoice_items`

- `id`, `tenant_id`, `invoice_id`
- `description`, `quantity`, `unit_price`, `amount`
- `meter_code` (link to usage_counter)

### `payments`

- `id`, `tenant_id`, `invoice_id`
- `provider`, `provider_payment_id`
- `amount`, `currency`
- `status` enum `pending|succeeded|failed|refunded`
- `method` text (`card`, `fpx`, `bank_transfer`)
- `paid_at`

### `usage_counters`

- `(tenant_id, meter_code, period_start)` unique
- `meter_code`: `messages_sent`, `ai_generations`, `wa_accounts_active`, `contacts_stored`, `storage_bytes`
- `quantity` bigint
- `updated_at`

Counters are incremented transactionally with the underlying action.

### `tenant_limits`

- `(tenant_id, meter_code)` unique
- `hard_limit` bigint (null = inherit from plan)
- `soft_limit_pct` smallint default 80
- `overage_action` enum `warn|throttle|block`

Tenant-specific overrides take precedence over `plans.limits`.

### `billing_events`

- Append-only event log: provider webhooks, subscription changes, refunds.
- `id`, `tenant_id`, `subscription_id?`, `kind`, `payload` jsonb, `created_at`.

## Enforcement flow

Before a sendable action (campaign send, AI generation, WA account add):

```
  current = usage_counters.quantity for (tenant, meter, this period)
  limit   = tenant_limits || plan.limits[meter]
  pct     = current / limit
  if pct >= 1.0  → deny (overage_action=block) or throttle
  if pct >= soft → surface warning banner, still allow
  else           → allow
```

Warning banners link to `/t/{slug}/settings/billing`.

## Trial

- New tenants start on `trialing` against the Business plan for 14 days.
- Day 10: email + in-app nudge.
- Day 14: `trial_ends_at` reached → `status=past_due`, messaging is blocked, reads still work.
- Day 21: auto-suspend tenant (status=`suspended`) unless payment captured.

## Webhooks

Every provider webhook:
1. Verify signature.
2. Insert into `billing_events` (idempotent by provider_event_id).
3. Project state onto `subscriptions` / `invoices` / `payments`.
4. Fire internal events for notifications (email, in-app).

## Malaysia-specific

- Display prices inclusive of SST (6%) where applicable.
- Invoices tagged with business registration number from `tenant_business_profiles`.
- FPX payments are redirect-based; keep `status=pending` until webhook.

## Open decisions

- Do we meter tokens for AI (closer to cost) or generations (simpler)?
- Annual discount: standard 2 months free vs 20%?
- Refund window: 7 days pro-rata?
