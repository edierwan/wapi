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
