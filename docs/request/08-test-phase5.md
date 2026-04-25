# 08 — Test plan: Phase 5 (master data + onboarding redesign + contacts + business brain + AI readiness)

> Phase 5 introduces structured **reference / master data** so the onboarding
> page (and every form that follows) uses dropdowns backed by FK columns
> instead of free-text. It also lays the groundwork for **contacts**,
> **business brain memory**, and the **AI readiness score** that powers
> Phase 7 campaigns.
>
> Backwards compatibility: legacy free-text columns on
> `tenant_business_profiles` (`industry`, `business_nature`, `default_currency`,
> `default_language`, `timezone`, `primary_country`, `brand_voice`) remain
> populated alongside the new FK columns, so any older client/code keeps
> working until it is migrated.

## 0 · Where to test

| Env | URL | DB |
|---|---|---|
| Development | `https://wapi-dev.getouch.co` | `wapi.dev` |
| Production  | `https://wapi.getouch.co`     | `wapi`     |

## 1 · Pre-flight

Confirm migrations + seed have been applied:

```sh
# from your laptop, against either DB:
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_countries;'         # 14
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_currencies;'        # 15
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_languages;'         # 10
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_timezones;'         # 15
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_industries;'        # 18
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_business_natures;'  # 7
psql "$DATABASE_URL" -tAc 'SELECT count(*) FROM ref_brand_voices;'      # 10
```

To re-run the seed locally:

```sh
pnpm db:seed:reference
```

The seed is idempotent — `INSERT ... ON CONFLICT (code) DO UPDATE`, so running
it twice is safe.

## 2 · New ref tables — data model checks

For each `ref_*` table verify:

- `id uuid` PK
- A unique business key (`code` for most, `iso2_code` for countries,
  `name` for timezones)
- `status text DEFAULT 'active'` — only rows with `status = 'active'` are
  surfaced in dropdowns. Mark a row inactive and confirm it disappears
  from the onboarding UI:

  ```sql
  UPDATE ref_industries SET status = 'inactive' WHERE code = 'other';
  ```

  Reload `/t/<slug>/onboarding` — "Other" should no longer appear in the
  industry dropdown. Restore with `UPDATE ... SET status='active'`.

- `sort_order int` — controls dropdown order. Lower numbers appear first.

`ref_countries` extras:

- `default_currency_code` / `default_language_code` / `default_timezone`
  — these drive the **auto-fill cascade** on the onboarding page.

`ref_brand_voices.prompt_instruction` — this is the system prompt
fragment AI orchestrators (Phase 6/7) will inject when drafting messages.

## 3 · Onboarding UI redesign

Open `/t/<your-tenant-slug>/onboarding`.

### 3.1 · Visual check

- **Business nature** card — no more hard-coded "Product / Service / Hybrid /
  ..." radios. Instead, radios are populated from `ref_business_natures`
  (active rows), each with a description.
- **Basics** card — `Industry`, `Primary country`, `Default currency`,
  `Default language`, `Timezone` are all `<select>` dropdowns. Phone /
  email / website are still text fields.
- **Brand voice** card — preset cards from `ref_brand_voices` plus a free
  textarea for custom notes. A "No preset" radio lets users skip the
  preset entirely and rely only on their custom notes.

### 3.2 · Auto-fill cascade

1. Change **Primary country** to `Singapore (SG)`.
   - Default currency should switch to `SGD — Singapore Dollar`.
   - Default language should switch to `English` (SG default lang code is `en`).
   - Timezone should switch to `Singapore (UTC+08:00)`.
2. Change to `Indonesia (ID)`.
   - Currency → `IDR`, language → `Indonesian — Bahasa Indonesia`,
     timezone → `Jakarta (UTC+07:00)`.
3. After the cascade, you can still **manually override** any of the three.
   Manual changes should not be re-overridden until you change the country
   again.

### 3.3 · Save & reload

1. Submit the form.
2. Expect redirect to `/t/<slug>` with onboarding flagged as complete.
3. Reload `/t/<slug>/onboarding`.
4. Every dropdown should be **pre-selected** with the values you saved
   (loaded from the FK columns, not from the old text columns).

### 3.4 · DB sanity

```sql
SELECT
  industry_id, country_id, currency_id, language_id, timezone_id,
  business_nature_id, brand_voice_id, brand_voice_custom,
  -- legacy back-compat:
  industry, primary_country, default_currency, default_language, timezone,
  business_nature, brand_voice
FROM tenant_business_profiles
WHERE tenant_id = '<your tenant id>';
```

- Both the `*_id` columns and the legacy text columns should be populated.
- The text columns should match the resolved code from the FK row
  (e.g. `country_id` → `'SG'` ↔ `primary_country = 'SG'`).

### 3.5 · Server-side validation

If a malicious client sends a `industryId` that doesn't exist or whose
`status != 'active'`, the server action must reject the submission with
`Invalid reference IDs: industryId`. Test by tampering via DevTools:

1. Inspect the hidden `<input name="industryId">` and replace its value
   with a bogus UUID (e.g. `00000000-0000-0000-0000-000000000000`).
2. Submit. Expect a server error response (form does not save).

## 4 · Contacts (schema-level smoke)

Phase 5 adds the following tables (UI lands in Phase 6/7 — for now we just
verify schema):

- `contacts` — tenant-scoped phone book. Unique `(tenant_id, phone_e164)`.
- `contact_tags` — tenant-scoped tags.
- `contact_tag_assignments` — many-to-many.
- `contact_consents` — per-contact consent records (channel + type).

Schema sanity:

```sql
INSERT INTO contacts (tenant_id, phone_e164, full_name, email, source)
VALUES ('<tenant id>', '+60123456789', 'Acceptance Test', '[email protected]', 'manual')
RETURNING id;

-- Re-insert same tenant + phone → must violate the unique index:
INSERT INTO contacts (tenant_id, phone_e164, full_name, source)
VALUES ('<tenant id>', '+60123456789', 'Duplicate', 'manual');
-- ERROR: duplicate key value violates unique constraint "contacts_tenant_phone_uq"

-- Cleanup:
DELETE FROM contacts WHERE phone_e164 = '+60123456789' AND tenant_id = '<tenant id>';
```

## 5 · Business brain (schema-level smoke)

`business_memory_items` stores tenant-level facts the AI can ground on
(FAQs, policies, brand statements, offers, warnings).

```sql
INSERT INTO business_memory_items (tenant_id, kind, title, body, source)
VALUES (
  '<tenant id>',
  'faq',
  'Operating hours',
  'Mon–Fri 9am–6pm. Closed public holidays.',
  'manual'
)
RETURNING id;

SELECT kind, title FROM business_memory_items WHERE tenant_id = '<tenant id>';
```

## 6 · AI readiness score (schema-level smoke)

`ai_readiness_scores` snapshot table — Phase 7 will populate it from a
recompute job. For now verify it accepts inserts:

```sql
INSERT INTO ai_readiness_scores (tenant_id, overall_score, band_label, components)
VALUES (
  '<tenant id>',
  72,
  'good',
  '{"businessProfile": 90, "products": 60, "memory": 50, "contacts": 80}'::jsonb
)
RETURNING id, overall_score, band_label;
```

## 7 · Regression checklist (must still pass)

- Phase 4 registration + OTP + login flow unchanged.
- Existing tenants whose `tenant_business_profiles` rows have only the
  legacy text columns populated still load `/t/<slug>/onboarding` without
  errors. Their dropdowns will start unselected — that's expected.
- `/admin` still gates by system role and shows the placeholder tiles.

## 8 · Acceptance

Phase 5 acceptance is met when:

1. All seven `ref_*` tables exist and are seeded on both `wapi.dev` and
   `wapi`.
2. `/t/<slug>/onboarding` renders dropdowns from active ref data.
3. Country auto-fill cascade works.
4. Submitting the form populates both the FK columns AND the legacy text
   columns.
5. Server rejects unknown / inactive ref IDs.
6. `contacts`, `business_memory_items`, `ai_readiness_scores` schemas accept
   the smoke INSERTs above.
