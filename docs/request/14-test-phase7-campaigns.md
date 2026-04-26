# Phase 7 — Campaign composer & follow-up sequences (functional tranche)

This is a manual-test script for the human tester to confirm the Phase 7
functional tranche end-to-end. Automated parts (typecheck, build, route
registration) are already confirmed by the build output.

## Pre-requisites

- Logged in as a tenant `owner` or `admin`. Agents/managers are read-only
  for campaigns by design.
- At least one connected WhatsApp account in the workspace (gateway
  connection itself is gated by Request 05; the UI works regardless).
- A handful of contacts with varied `status`, `lead_status`, and tags.

## A. Tenant scoping (must be confirmed first)

1. Sign in as Tenant A owner.
2. `GET /t/{slugA}/campaigns` — should list only Tenant A campaigns.
3. Create a campaign in Tenant A; copy its `campaignId` from the URL.
4. Sign out, sign in as Tenant B owner.
5. Visit `/t/{slugB}/campaigns/{campaignId-from-A}` — must show 404.
6. Repeat for `/t/{slugB}/followups/{sequenceId-from-A}`.

If either tenant can read the other's campaign or sequence, **stop** and
file a security defect.

## B. Composer happy path

1. From `/t/{slug}/campaigns`, create a draft named "Manual test".
2. On the detail page, set:
   - Lead statuses: `warm,hot`
   - Contact statuses: `active`
   - Audience tag IDs: leave empty
   - Save.
3. Audience preview should show a non-zero number; the sample list should
   show contacts you recognize, all from this tenant.
4. Add two variants A and B with different bodies. Confirm the inline
   "Reply STOP to opt out" reminder is included in at least one variant
   so the safety review doesn't block.

## C. Safety review

1. Click **Run safety review**.
2. Confirm the campaign status flips to `safety_review`.
3. The latest review card should show one of `good` / `needs_review` /
   `high_risk` plus a single-line summary.
4. Edit a variant to include a prohibited word from the tenant business
   profile. Re-run review. Expect `high_risk` with the prohibited-words
   finding.
5. Fix the variant. Re-run review. Expect `good` or `needs_review`.

## D. Schedule and dispatch

1. With status `good` or `needs_review`, pick an account from the
   Schedule & dispatch card, leave "Send at" blank, click
   **Schedule and queue**.
2. Status flips to `scheduled`. Recipient stats card shows the queued
   total matching the audience preview.
3. Inspect `message_queue` rows for this `campaign_id`:
   - `tenant_id` matches your tenant
   - `purpose='campaign'`
   - `status='queued'`
   - `to_phone` matches each contact
4. Inspect `campaign_recipients` rows: each has a `queue_id` and a
   `variant_id`.

## E. Worker and webhook lifecycle

1. Run `pnpm tsx scripts/worker-outbound.ts` once. Rows for your campaign
   flip to `sending` (gateway permitting).
2. Simulate a status webhook for one of the queued message ids
   (`externalRef` = `message_queue.id`). The corresponding
   `campaign_recipients.status` should advance in lock-step.
3. Tenant invariant: replay the webhook with a wrong `accountId`
   belonging to a different tenant — must return 404.

## F. Cancel + delete

1. From a `scheduled` campaign, click **Cancel campaign** — status flips
   to `cancelled`.
2. New drafts can be deleted via **Delete draft**. Non-draft campaigns
   should not show a delete button.

## G. Follow-up sequences

1. Visit `/t/{slug}/followups`.
2. Create a sequence with trigger `no_reply`.
3. On the detail page, add three steps with delays 1h / 24h / 72h. Step 2
   leaves body blank (will be AI-drafted later); steps 1 and 3 have manual
   bodies.
4. Confirm step ordering, edit a step's delay, delete a step.
5. Toggle status to `paused`, then `archived`, then back to `active`.

## Out of scope for this tranche (do not file as defects)

- Tenant-dedicated Dify infrastructure (Phase 8+).
- Long-running follow-up executor / runtime scheduler (later tranche).
- Channel selection beyond WhatsApp (Phase 8 omnichannel).
- AI-drafted campaign variants from Dify (next tranche; the manual editor
  is fully functional today).
- Consent rule integration (`contact_consents`) inside the safety review;
  the current rule set covers prohibited words, length, opt-out hint, and
  caps-shouting. Consent integration ships once the consent UI lands.

## H. Phase 7 remaining slice (shipped tranche 4)

### H1. Consent-aware safety review

1. As an `owner`, ensure the campaign objective is `promo` (or omit, which
   defaults to a marketing-style objective).
2. Run safety review on a campaign whose audience has zero
   `contact_consents` rows with `consent_type='marketing'` and
   `granted=true`.
3. The review should now contain a `no_marketing_consent` finding marked
   `high_risk`.
4. Grant marketing consent for at least 50% of the audience and re-run.
   The finding should switch to `marketing_consent_ok` (`good`).
5. Switch the objective to `followup` (or `survey`) and re-run. The
   marketing-consent rule should be skipped (different consent type
   applies).

### H2. Reply-first runtime gating

1. Create a campaign with `send_mode='reply_first'` and an audience that
   includes one contact with at least one `inbound_messages` row and one
   contact with none.
2. Schedule and dispatch.
3. The contact without prior inbound should appear as
   `campaign_recipients.status='excluded'` with
   `excluded_reason='reply_first:no_prior_inbound'`.
4. The contact with prior inbound should be queued normally.

### H3. Per-number rate limit / warm-up

1. Use a recently-created `connected_accounts` row (warm-up tier 1: 5/min,
   100/day).
2. Materialize ≥ 10 recipients on a campaign for that account and
   dispatch.
3. Run `pnpm worker:outbound`. At most 5 rows should flip to `sending`
   per worker pass for that account; remaining rows stay `queued`.
4. Wait one minute and re-run. The next 5 rows should now flip.
5. Override caps with `WA_RATE_LIMIT_PER_MINUTE=2` and observe that no
   more than 2 send per minute even on a mature account.

### H4. Long-running follow-up executor

1. Create a follow-up sequence with `trigger_type='no_reply'` and three
   steps with delays `1h`, `24h`, `72h`.
2. Ensure at least one contact has an inbound message between 24h and 72h
   ago, plus an active `connected_accounts` row.
3. Run `pnpm worker:followups`.
4. The script should report the contact as enrolled and three rows
   should appear in `message_queue` with `purpose='followup'`,
   `payload->>sequenceId` matching the sequence id, and `scheduled_at`
   spaced by 1h / 25h / 97h from `now()`.
5. Re-run the script. The contact should NOT be re-enrolled (idempotent
   via `payload->>sequenceId`).

### H5. AI variant suggestion via Dify HITL

1. As an `owner` or `admin`, configure the tenant AI provider (kind
   `dify`, valid base URL, valid API key).
2. Open a campaign detail page. Submit the "Suggest variant via AI" form
   with an optional steering prompt.
3. A new variant labeled `AI HH:MM:SS` should be created with
   `is_ai_generated=true`.
4. Edit or delete the AI variant via the existing variant editor before
   scheduling. Confirm scheduling does not auto-send the AI variant
   without human review.
5. With no provider configured, submitting the form should surface a
   "No AI provider configured" error and not create a variant.

### H6. KPIs panel on campaign detail

1. Materialize and dispatch a campaign so several recipients land in
   `pending`, `sent`, `delivered`, `read`, `replied`, `failed`,
   `excluded`.
2. Visit the campaign detail page.
3. The "Performance" card should show 7 status tiles with absolute
   counts and percentages, plus a reach rate (sent + delivered + read +
   replied) summary line.
4. Counts should match `recipientStats` for the same campaign id.

## Out of scope for this tranche (still)

- Tenant-dedicated Dify infrastructure (Phase 8+).
- Channel selection beyond WhatsApp (Phase 8 omnichannel).
- Smart Customer Memory live integration (architecture only — identity
  anchor `tenant_id + normalized_phone_number` is preserved in payloads
  but no runtime hook is wired yet).
