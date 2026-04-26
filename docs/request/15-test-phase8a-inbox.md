# Phase 8a — Shared inbox view (read-only first slice)

This is a manual-test script for the human tester to confirm the Phase 8a
shared inbox slice end-to-end. Automated parts (typecheck, build, route
registration) are confirmed by the build output.

## Pre-requisites

- Logged in as a tenant member (any role can read). Owner/admin not
  required for the read-only slice.
- At least one connected WhatsApp account. Live gateway behavior is
  still gated by [Request 05](./05-wa-gateway-multitenancy.md), but the
  inbox read model works against any rows that already exist in
  `inbound_messages` and `message_queue`.
- Optional: at least one row in each of `inbound_messages` and
  `message_queue` (any non-`otp` purpose) for a recognizable phone
  number that may or may not have a `contacts` row.

## A. Tenant scoping (must be confirmed first)

1. Sign in as Tenant A member.
2. `GET /t/{slugA}/inbox` — must list only Tenant A conversations.
3. Pick one phone from the list and copy it.
4. Sign out, sign in as Tenant B member.
5. Visit `/t/{slugB}/inbox/{encoded-phone-from-A}` — must show 404.

If Tenant B can read Tenant A's conversation timeline, **stop** and file
a security defect.

## B. List grouping

1. Open `/t/{slug}/inbox`.
2. Expect one row per unique phone number that has at least one
   `inbound_messages` or non-OTP `message_queue` entry for the tenant.
3. Each row should show:
   - the contact's full name when a `contacts` row exists for that phone
     in this tenant; otherwise the raw E.164 phone
   - the most recent message preview (first 160 chars)
   - the inbound vs outbound counters
   - the channel chip (`whatsapp` for now)
   - relative time of last activity
   - an `+N new` chip when there are inbound messages received after the
     latest outbound

## C. Conversation detail

1. Click a conversation in the list.
2. Expect `/t/{slug}/inbox/{encoded-E.164-phone}`.
3. Header shows contact name (or phone), lead status, contact status,
   inbound/outbound counts, and `Open contact` link when the phone is
   bound to a contact.
4. Timeline shows merged inbound (`inbound_messages`) and outbound
   (`message_queue`) entries, oldest at top, newest at bottom.
5. OTP outbound rows must NOT appear (filtered server-side).
6. Each timeline entry shows direction, timestamp, purpose (outbound),
   status (outbound), and intent (inbound) when present.

## D. Identity invariants

1. Choose a phone number that has rows but no `contacts` row.
2. The list still shows that conversation, with phone as the title and
   "Not linked to a contact yet" in the detail view.
3. Choose a phone number that has the same E.164 string in two tenants
   (if your seed allows). Each tenant's inbox must show only its own
   tenant's rows. The phone is never a global identity key.

## E. Smart Customer Memory compatibility

This is a code-audit step, not a UI flow:

- `src/server/inbox.ts` should never import or reach into
  `whatsapp_sessions` for identity.
- The conversation key must always be the tuple
  `(tenant_id, normalized_phone_number)`.
- The `channel` field on returned summaries should be a string literal
  (currently `whatsapp`), not derived from session state.

## Out of scope for Phase 8a

- Composing or replying from the inbox (that lands in a later slice).
- Marking-as-read / unread state (no schema yet; the `awaitingReplyCount`
  is a derived proxy until a real read-marker model lands).
- AI summary or rolling conversation memory (those land with Smart
  Customer Memory in Phase 8c).
- Cross-channel rollouts (Facebook / Instagram / Shopee / Lazada /
  TikTok). The query layer is shaped to expand later, but no other
  channel is wired up yet.
- Long-running ingest / supervised worker run mode (Phase 8b).
