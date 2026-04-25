# 10 — Test plan: Phase 7 (campaigns + safety assistant + variations + reply-first + follow-up)

> Phase 7 is where WAPI starts producing **business value** on the AI side:
> users compose campaigns, the **Safety Assistant** reviews them before
> send, **smart variations** prevent ban patterns, **reply-first** mode
> changes the send curve, and a **follow-up sequence** engine handles
> non-responders and hot leads.
>
> This phase introduces five tables: `campaigns`, `campaign_variants`,
> `campaign_safety_reviews`, `campaign_recipients`, `followup_sequences`,
> `followup_steps`.

## 0 · Where to test

| Env | URL | DB |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` | `wapi.dev` |
| Production  | `https://wapi.getouch.co`     | `wapi`     |

## 1 · Pre-flight

```sh
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables
                           WHERE table_schema='public'
                             AND table_name IN (
                               'campaigns','campaign_variants',
                               'campaign_safety_reviews','campaign_recipients',
                               'followup_sequences','followup_steps');"
# expect: 6
```

## 2 · Campaign — happy path (DB-level until UI ships)

```sql
-- 1) create the campaign:
INSERT INTO campaigns
  (tenant_id, name, objective, send_mode, status, audience_filter)
VALUES
  ('<tenant id>',
   'August re-engage',
   're_engage',
   'reply_first',
   'draft',
   '{"tags":["lapsed"], "leadStatus":["warm","cold"]}'::jsonb)
RETURNING id;

-- 2) attach two variants (A/B):
INSERT INTO campaign_variants (campaign_id, label, body_text, weight, language_code)
VALUES
  ('<campaign id>', 'A', 'Hi {{name}}, lama tak dengar! Ada offer 20% untuk {{lastService}}.', 1, 'ms'),
  ('<campaign id>', 'B', 'Hi {{name}}! Long time. We miss you — here is 20% off your next visit.', 1, 'en');

-- 3) request a safety review (Phase 7 worker would normally do this):
INSERT INTO campaign_safety_reviews
  (campaign_id, overall_status, checks, summary_text)
VALUES (
  '<campaign id>',
  'good',
  '[
     {"code":"prohibited_words","status":"pass","message":"none detected"},
     {"code":"variable_resolution","status":"pass","message":"all variables resolvable"},
     {"code":"tone_consistency","status":"pass","message":"matches tenant brand voice"}
   ]'::jsonb,
  'No issues detected. Safe to send.'
);

UPDATE campaigns SET status = 'safety_review' WHERE id = '<campaign id>';
```

## 3 · Safety assistant statuses

`campaign_safety_reviews.overall_status` must be one of:
`pending | good | needs_review | high_risk`. The campaign UI surfaces these
as user-friendly cards (per `docs/architecture/campaign-safety-assistant.md`):

- **Good** → green badge, send button enabled.
- **Needs review** → yellow card listing the failing checks; `auto_fixes_applied`
  jsonb captures any fixes the assistant offered.
- **High risk** → red card, send button disabled until either the user
  acknowledges or the campaign is edited.

Smoke a `needs_review` row:

```sql
INSERT INTO campaign_safety_reviews
  (campaign_id, overall_status, checks, summary_text)
VALUES (
  '<campaign id>',
  'needs_review',
  '[
     {"code":"variable_resolution","status":"warn","message":"3 contacts missing {{lastService}}", "autoFixable": true},
     {"code":"prohibited_words","status":"pass","message":"none detected"}
   ]'::jsonb,
  '3 contacts missing {{lastService}}. Auto-fix: drop variable for those contacts only.'
);
```

The UI (when it ships) should render the per-check list, the summary, and
an **Apply auto-fix** button that copies the fix payload into
`auto_fixes_applied` and re-runs the review.

## 4 · Variants & weighting

`campaign_variants.weight` is a non-negative integer. Send distribution is
proportional. Edge cases to verify:

1. **Single variant** (only A): every recipient receives A.
2. **Two variants weight 1 + 1**: ~50/50 split (statistical, not exact).
3. **Variant with weight 0**: no recipients should be assigned to it.
4. **`is_ai_generated = true`**: marks variants drafted by the Smart
   Variation engine — the UI should label them.

```sql
SELECT label, weight, is_ai_generated
FROM campaign_variants
WHERE campaign_id = '<campaign id>'
ORDER BY label;
```

## 5 · Reply-first mode

When `campaigns.send_mode = 'reply_first'`:

1. Send a small first wave (e.g. 10 recipients).
2. Wait for replies / no-reply timeouts.
3. Use that signal to grade the campaign before opening the floodgates.

The signal lives in `campaign_recipients.status` —
`pending | sent | delivered | read | failed | replied | excluded`.

```sql
SELECT status, count(*) FROM campaign_recipients
WHERE campaign_id = '<campaign id>'
GROUP BY status;
```

Acceptance for the reply-first cohort:

- After the first wave, the worker pauses sending until either
  - a reply rate threshold is reached (configurable), OR
  - the configured cooldown elapses.

## 6 · Excluded recipients

`campaign_recipients.status='excluded'` plus `excluded_reason` records
contacts that the safety assistant or audience filter dropped:

```sql
INSERT INTO campaign_recipients
  (campaign_id, contact_id, status, excluded_reason)
VALUES
  ('<campaign id>', '<contact id>', 'excluded', 'opted_out');

SELECT excluded_reason, count(*) FROM campaign_recipients
WHERE campaign_id = '<campaign id>' AND status = 'excluded'
GROUP BY excluded_reason;
```

UI should display this as: *"Excluded 1 contact (opted_out)"* on the
campaign summary card.

## 7 · Follow-up sequences

`followup_sequences` + `followup_steps` model post-campaign automation
(re-engage non-responders, nurture hot leads, etc.).

```sql
WITH s AS (
  INSERT INTO followup_sequences (tenant_id, name, trigger_type, trigger_config)
  VALUES ('<tenant id>', 'No-reply 48h', 'no_reply',
          '{"campaignId":"<campaign id>","hoursAfterSend":48}'::jsonb)
  RETURNING id
)
INSERT INTO followup_steps (sequence_id, step_order, delay_hours, body_text)
SELECT s.id, 1, 0,  'Hi {{name}}, just checking — still interested in our offer?' FROM s
UNION ALL
SELECT s.id, 2, 72, 'Last chance, {{name}}! Offer ends Friday.' FROM s;
```

Constraints to verify:

- Unique `(sequence_id, step_order)` (`followup_steps_seq_order_uq`).
- `delay_hours >= 0` — enforced at the app layer; 0 means "send
  immediately when the trigger fires".

## 8 · Multi-tenant isolation

Same audit as Phase 6:

```sh
rg -n "from\(campaigns\)|from\(campaignRecipients\)|from\(campaignVariants\)|from\(campaignSafetyReviews\)|from\(followupSequences\)" src/server src/app \
  | rg -v "tenantId|campaignId"
# Output should be empty. Every query that hits a tenant-owned row
# directly must include tenantId; queries scoped via campaignId are
# acceptable as long as the campaign itself was loaded with tenantId.
```

## 9 · Cleanup

```sql
DELETE FROM campaigns WHERE name = 'August re-engage';
-- cascades to campaign_variants, campaign_safety_reviews,
-- campaign_recipients via ON DELETE CASCADE.

DELETE FROM followup_sequences WHERE name = 'No-reply 48h';
-- cascades to followup_steps.
```

## 10 · Acceptance

Phase 7 acceptance is met when:

1. All six tables exist on both DBs with required indexes.
2. Smoke flow §2 succeeds end-to-end.
3. Safety review statuses behave as described in §3.
4. Variant weighting respects 0-weight edge case.
5. Reply-first cohort logic gates the second wave.
6. Excluded recipients are recorded with a reason.
7. Follow-up sequence with two ordered steps inserts cleanly and the
   `(sequence_id, step_order)` uniqueness constraint blocks duplicates.
8. Multi-tenant isolation grep audit returns no leaks.
