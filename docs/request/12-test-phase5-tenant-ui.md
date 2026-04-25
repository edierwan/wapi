# 12 — Test plan: Phase 5 tenant UI (tranche 1)

> Validates the first functional Phase 5 tenant tranche:
> Contacts UI, Business Brain UI, AI Readiness card, and the minimal
> product/service create flow. Tenant scoping is the most important
> invariant — every query must include `tenant_id`.

## 0 · Where to test

| Env | URL | Tenant slug |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` | use any active tenant |
| Production | `https://wapi.getouch.co` | use any active tenant |

A tenant member with role `owner`, `admin` or `agent` is required for
write actions (contacts, brain). Only `owner` / `admin` can create
products and services.

## 1 · Pre-flight (DB)

```sh
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM contacts;"
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM business_memory_items;"
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM ai_readiness_scores;"
```

Capture these counts so you can confirm the deltas after the pass.

## 2 · Contacts — list + create

1. Sign in. Open `/t/<slug>/contacts`.
2. Page shows: search bar, "Add contact" form, "Tags" panel, then list.
3. Submit a new contact:
   - Phone: `+60123456000`
   - Full name: `Test One`
   - Email: `[email protected]`
   - Lead status: `new`
4. Expected: redirect back to `/t/<slug>/contacts`, the row appears at
   the top of the list, phone is normalized to `+60123456000`.
5. Repeat with `60123456001` (no `+`) — should be normalized to
   `+60123456001`.
6. Try to add the same phone twice → expect a server error toast or
   thrown error (`contacts_tenant_phone_uq` unique violation).

## 3 · Contacts — search

1. Type a partial name in the search box, submit.
2. URL becomes `/t/<slug>/contacts?q=...` and only matching rows show.
3. Empty search returns full list again.

## 4 · Contacts — tags

1. In the Tags panel, add `vip`, then `lead`, then a duplicate `vip`.
2. Expected: `vip` and `lead` show; duplicate is silently ignored.
3. Click `×` on a tag → tag disappears.
4. Open a contact's detail page (`Open` button on the row).
5. Tags panel on detail page: click `Add` next to `vip` → button
   switches to `Remove`. Refresh → state persists.
6. Click `Remove` → switches back. Refresh persists.

## 5 · Contacts — edit + delete

1. On `/t/<slug>/contacts/<id>`:
   - Change full name, lead status, status, notes → Save.
   - Page refreshes; values persist.
2. Click "Delete contact" → row vanishes from list.

## 6 · Tenant scoping audit (very important)

While impersonating tenant A:

1. Note a contact id from tenant B (or just a random UUID).
2. Manually craft `/t/<slugA>/contacts/<UUID-from-B>` → expect 404.
3. From the browser, edit the hidden `tenantSlug` form field on the
   contacts page to a slug you don't belong to and submit → expect a
   redirect to `/dashboard` (auth gate) rather than a write.

Optional grep audit:

```sh
rg -n "tenantId|tenant_id" src/server/contacts.ts src/server/business-memory.ts src/server/ai-readiness.ts
```

Every read/write helper must include `eq(...tenantId, tenantId)` in the
where clause. There are no exceptions.

## 7 · Business Brain

Open `/t/<slug>/brain`.

1. Page header shows the brain icon + description.
2. Add an item of each kind: `fact`, `faq`, `policy`, `brand`, `offer`,
   `warning`. Use weight `5` for one, leave the rest at `1`.
3. Each item appears under its kind header in the list.
4. Click `View / edit` → form pre-fills with current values; change the
   body and save → updated body persists.
5. Toggle `status` to `archived` → badge flips to `archived` in the
   list.
6. Click `Delete` → item disappears.

## 8 · AI Readiness card

Open `/t/<slug>/` (tenant overview).

1. Card shows: overall score (0–100), band badge (`Not ready` / `Basic`
   / `Good` / `Excellent`), four component bars (business profile,
   catalog, contacts, business brain), recommendations, and a
   `Recompute & save` button (owners/admins/agents only).
2. With a fresh tenant: score should reflect onboarding only (~25).
3. Add a product, a service, a contact, and 3 distinct memory kinds.
4. Click `Recompute & save`. Score climbs. Footer shows the new
   timestamp, e.g. `Last saved snapshot: 2026-04-26 09:12 UTC`.
5. Verify a row was inserted:

   ```sh
   psql "$DATABASE_URL" -tAc \
     "SELECT overall_score, band_label, computed_at FROM ai_readiness_scores ORDER BY computed_at DESC LIMIT 3;"
   ```

## 9 · Products + Services minimal create

1. `/t/<slug>/products` shows an "Add product" card. As an `owner` or
   `admin`:
   - Code: `SKU-T01`, Name: `Test product`, Type: `physical`,
     Price: `49.90`, Currency: `MYR`, Unit: `pc` → submit.
2. Row appears in the table.
3. As role `agent` or `member`: form button is disabled with a
   "Only owners/admins can add products" hint.
4. Same for `/t/<slug>/services` (Code: `SVC-T01`, Type: `consultation`,
   Duration: `30`, Price: `120.00`).

## 10 · Sub-nav

The tenant sub-navigation now contains:

- Overview, WhatsApp, Contacts, Products, Services, **Brain**,
  Campaigns (`soon`), Inbox (`soon`), AI (`soon`), Analytics (`soon`),
  Settings.

Active tab tracks the current route on every Phase 5 page.

## 11 · Build / typecheck

```sh
pnpm typecheck
pnpm build
```

Expected new routes in the build output:

```
/t/[tenantSlug]/brain
/t/[tenantSlug]/contacts
/t/[tenantSlug]/contacts/[contactId]
```

## 12 · Acceptance

Acceptance is met when:

1. Contacts CRUD, tag CRUD, and per-contact tag toggle all persist
   correctly with explicit tenant scoping.
2. Business Brain CRUD works across all six kinds with weight + status
   updates.
3. AI Readiness card renders, recomputes, and persists snapshots.
4. Minimal product / service create flow persists rows respecting RBAC.
5. Cross-tenant access attempts are blocked.
6. Build + typecheck pass.
