# Campaign Safety Assistant

> User-friendly framing of the internal spam/ban-risk engine. Tenants see a
> short summary and approve; technical detail lives in admin/audit only.

## Why

SME users should not need to understand WhatsApp ban risk. They should see:

> "WAPI optimised this campaign for safer sending."

…and approve. The platform does the hard work behind the scenes.

## Design rule

**Never** show a long technical checklist to the normal tenant user.

- Tenant user view: **simple summary + badges + one action.**
- Admin/audit view: raw checks + every auto-fix applied + scores.

## Internal checks (hidden from user)

- message similarity across variants
- missing variation for large audiences
- send volume too high for number age
- new / unwarmed WhatsApp number
- too many links
- suspicious / shortened links
- excessive emojis / uppercase
- missing opt-out instruction
- duplicate recipients
- opted-out contacts included
- previous failure-rate / block-rate high
- daily cap would be exceeded
- message too promotional / hard-sell

## Auto-fixes WAPI attempts

1. Generate multiple natural message variants (ties to Variation Engine)
2. Add or suggest opt-out text ("Balas STOP untuk berhenti")
3. Remove duplicate recipients
4. Exclude opted-out contacts
5. Recommend or auto-set safe send speed
6. Recommend or auto-set batch sending window
7. Reduce excessive uppercase
8. Reduce excessive emojis
9. Warn about shortened links
10. Suggest softer conversation-first wording
11. Suggest reply-first campaign variant
12. Adjust schedule so daily cap is not exceeded
13. Pause/hold the campaign if risk is too high

## User-facing summary

Card block shown before the campaign can be scheduled:

```
Safety status        Good · Needs review · High risk
Message variants     6 generated
Excluded contacts    23 duplicates/opt-outs removed
Send mode            Gradual · est. 2 hours
Follow-up mode       enabled / disabled
```

Actions:
- **Preview optimised messages**
- **Regenerate variations**
- **Edit manually**
- **Approve & Schedule**

If risk is **high**, show **one** clear reason + **one** recommended action:

> "This campaign looks too repetitive for a large audience.
> WAPI generated safer message variations. Please review before scheduling."

## Data model — `campaign_safety_reviews`

| column | type |
|---|---|
| id | uuid pk |
| tenant_id | uuid fk tenants |
| campaign_id | uuid fk campaigns |
| risk_level | text (`low` \| `medium` \| `high`) |
| score_internal | integer 0–100 |
| checks_json | jsonb — full internal check list |
| autofixes_json | jsonb — every auto-fix applied |
| user_visible_summary | jsonb — exactly what the user sees |
| status | text (`optimized` \| `needs_review` \| `blocked` \| `approved`) |
| reviewed_by_user_id | uuid nullable |
| reviewed_at | timestamptz nullable |
| created_at | timestamptz |
| updated_at | timestamptz |

## Where in the product

| Surface | What shows |
|---|---|
| Tenant Campaign editor | summary block + Approve & Schedule |
| Tenant Campaign preview | variants list (AI-generated) |
| `/admin` → Campaigns | full checks + auto-fixes + risk score |
| `/admin` → Abuse Monitor | cross-tenant rollups |
| `audit_logs` | every approve / edit / block / override |

## Important caveat

The assistant **reduces** spam-like behaviour and improves sending hygiene.
It does **not** guarantee WhatsApp will not ban a number. This must be
stated plainly in the UI copy and the ToS.

## Phase

- Schema: Phase 7 (campaign module)
- MVP UX: Phase 7
- Admin view: Phase 9
- Tenant-level abuse rollups: Phase 9

## Related

- [Smart Message Variation](../product/differentiators.md#14-smart-message-variation-engine)
- [Reply-First Campaign Mode](../product/differentiators.md#15-reply-first-campaign-mode)
- [Admin abuse monitor](../product/differentiators.md#27-admin-abuse--risk-monitor)
- [AI Readiness Score](../product/differentiators.md#12-ai-readiness-score)
