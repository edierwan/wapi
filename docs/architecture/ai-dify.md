# AI integration — multi-tenant Dify + Ollama

## Goal

Every tenant can use AI assistance for grounded business tasks:

- draft replies
- summarize inbound conversations
- answer product / service / policy questions
- support campaign drafting and follow-up suggestions

The target architecture is **multi-tenant from day one**.

- MVP uses a **shared Dify runtime**.
- Premium later can use a **tenant-dedicated Dify app and dataset**.
- WAPI remains the source of truth for tenancy, access control, contact
  ownership, and WhatsApp session ownership.

## Current reality in WAPI

What already exists in code and schema:

- `ai_provider_configs` and `tenant_ai_settings` are already in the DB schema.
- `connected_accounts` and `whatsapp_sessions` already model tenant-owned
  WhatsApp numbers / sessions.
- `business_memory_items` already stores tenant-scoped business knowledge.
- `ai_readiness_scores` already measures whether a tenant has enough data to
  benefit from AI.
- `message_queue` and `inbound_messages` already exist as later integration
  foundations.
- the seed flow can already create a global `system-dify` provider row when
  `DIFY_DEFAULT_BASE_URL` is present.

What does **not** exist yet in app runtime:

- no provider-resolution service
- no Dify client wrapper
- no tenant knowledge sync into Dify
- no AI execution path from inbound WhatsApp or UI actions
- no `/t/{slug}/settings/ai` management UI
- no conversation isolation contract implemented in code yet

This distinction matters: the schema is ready, but the multi-tenant Dify
runtime is still a planned delivery slice.

## Data model

### `ai_provider_configs`

- `id`, `tenant_id` (nullable; `null` = system/global default)
- `name` (for example `system-dify`, `acme-dify-private`)
- `kind` enum: `dify | ollama | openai_compatible`
- `base_url`
- `api_key_ref` as a secret pointer, never the real secret
- `config` jsonb for provider-specific settings
- `is_default`

### `tenant_ai_settings`

- `tenant_id`
- `default_provider_id`
- `tone`
- `language`

### Existing grounding sources

These are the sources the AI layer should read before calling Dify:

- `tenant_settings`
- `tenant_business_profiles`
- `products`, `services`, and related catalog tables
- `business_memory_items`
- later: campaign history, consent signals, inbound conversation summaries

## Provider resolution rule

When WAPI needs an AI call for a tenant:

```text
1. If tenant_ai_settings.default_provider_id is set, use that provider.
2. Else, use the tenant-owned ai_provider_configs row where is_default=true.
3. Else, fall back to the global ai_provider_configs row where:
   tenant_id IS NULL AND is_default=true.
```

This is the correct MVP shape because it lets all tenants share one Dify
deployment first, while preserving a clean upgrade path to dedicated
tenant providers later without changing business logic.

## Secrets

Secrets must not live in Postgres.

- In MVP, `api_key_ref` can be an env var name such as `DIFY_DEFAULT_API_KEY`.
- Later, `api_key_ref` can point to Coolify secrets or Vault.
- The runtime resolver is responsible for converting `api_key_ref` into the
  actual secret at call time.

## Multi-tenant isolation contract

This is the most important rule set for Dify integration.

### 1. WAPI owns tenant resolution, not Dify

Dify must never be trusted to decide which tenant a request belongs to.
WAPI resolves the tenant first, then sends a tenant-scoped AI request.

### 2. WhatsApp number ownership is tenant-owned

The canonical route is:

```text
sessionId -> whatsapp_sessions.id
          -> whatsapp_sessions.account_id
          -> connected_accounts.id
          -> connected_accounts.tenant_id
```

Inbound gateway events must resolve tenant context through the session or
account relationship, not by guessing from phone number text alone.

### 3. Every AI request carries a tenant-scoped context envelope

Minimum envelope:

```json
{
  "tenantId": "uuid",
  "tenantSlug": "acme",
  "accountId": "uuid",
  "sessionId": "uuid",
  "contactId": "uuid",
  "channel": "whatsapp",
  "purpose": "reply_draft"
}
```

WAPI generates this. It is not user-editable.

### 4. Shared Dify must not mix tenant knowledge

For MVP, do **not** rely on one shared Dify dataset containing all tenant
knowledge unless the dataset itself is strongly partitioned and access is
provably scoped per request.

Safer order of preference:

1. WAPI retrieves tenant knowledge from Postgres and sends it as structured
   prompt inputs / context to a shared Dify app.
2. If using Dify knowledge bases, maintain a separate dataset or collection
   per tenant and pass only that tenant's dataset identifiers.
3. Tenant-dedicated Dify apps are the premium / later-stage isolation model.

### 5. Conversation identifiers must be namespaced

When using Dify chat or conversation state, the external user / session key
must be namespaced, for example:

```text
tenant:{tenantId}:account:{accountId}:contact:{contactId}
```

Never use a bare phone number as the only conversation identifier.

### 6. Tenant data stays tenant-scoped before and after AI

- retrieval queries must filter by `tenant_id`
- prompt assembly must use only that tenant's records
- outputs stored back into WAPI must retain `tenant_id`
- logs, audit, and safety review rows must also retain `tenant_id`

## Recommended MVP architecture

### Shared Dify runtime, WAPI-owned retrieval

For the first real delivery slice:

- one shared Dify deployment is acceptable
- WAPI remains responsible for retrieval and tenant scoping
- Dify acts mainly as the LLM orchestration layer, not the tenancy boundary

Recommended flow:

```text
1. WAPI receives an AI-triggering event or UI action.
2. WAPI resolves tenant, account, session, and contact.
3. WAPI resolves the provider config.
4. WAPI loads tenant-scoped grounding inputs:
   - business profile
   - products / services
   - business_memory_items
   - optional recent conversation summary
5. WAPI sends those inputs to Dify.
6. Dify returns a draft / summary / classification.
7. WAPI stores the result with tenant ownership and applies approval rules.
```

This is safer than pushing all tenant knowledge into one shared Dify dataset
too early.

## Dify specifics

For `kind='dify'`, expected `config` shape:

```json
{
  "appId": "...",
  "workspaceId": "...",
  "appMode": "chat",
  "inputsTemplate": {},
  "datasetId": "optional-for-tenant-dataset",
  "responseMode": "blocking"
}
```

Calls go to `{baseUrl}/v1/chat-messages` with:

- `Authorization: Bearer <resolved secret>`
- a stable namespaced user key
- structured `inputs` that include WAPI tenant context

Suggested `inputs` contract:

```json
{
  "tenant_id": "uuid",
  "tenant_name": "Acme",
  "contact_name": "Jane",
  "contact_phone": "+6012...",
  "tone": "friendly",
  "language": "en",
  "business_profile": "...",
  "products_context": "...",
  "services_context": "...",
  "business_memory_context": "...",
  "latest_customer_message": "...",
  "task": "draft_reply"
}
```

## Ollama specifics

For `kind='ollama'`, `config` may be `{ model, options? }`.
This remains useful for internal tools or lower-cost drafts, but the same
tenant resolution and grounding contract still applies.

## How Dify should connect to WAPI features

### 1. Business Brain

`business_memory_items` should be the first grounding source because it is
already tenant-scoped, editable, and designed for facts / FAQ / policy /
brand / offer / warning data.

Initial strategy:

- do not sync automatically on every edit yet
- first build runtime prompt assembly directly from WAPI data
- later add optional async sync into tenant Dify datasets

### 2. AI Readiness

Use `ai_readiness_scores` as a feature gate and UX guidance layer.

- low-readiness tenants still can use AI, but the UI should warn that answers
  may be thin
- higher-readiness tenants unlock better grounding and better draft quality

### 3. WhatsApp inbox / inbound messages

When inbound WhatsApp events are wired:

- gateway webhook -> WAPI resolves session/account/tenant
- WAPI stores inbound message with `tenant_id`
- optional AI action runs for that same tenant only
- result becomes draft / suggestion, not autonomous send

### 4. Campaign drafting

Campaign draft generation should read:

- business profile
- products / services
- business memory
- campaign objective
- audience segment summary

The output should be saved into campaign draft tables and go through human
approval plus safety review.

## Phased delivery plan

### Phase A — runtime foundation

Ship these first:

1. `src/server/ai/providers.ts` or equivalent provider resolver
2. `src/server/ai/secrets.ts` secret lookup by `api_key_ref`
3. `src/server/ai/dify-client.ts` minimal typed Dify wrapper
4. `src/server/ai/context.ts` tenant-scoped prompt assembly from WAPI data
5. server actions / route handlers for one narrow use case

First use case recommendation:

- tenant overview or Business Brain page manual action: `Generate suggested reply`
  or `Summarize business context`

This proves provider resolution and tenant-safe grounding before touching live
WhatsApp automation.

### Phase B — tenant AI settings UI

Add `/t/{slug}/settings/ai`:

- show resolved provider
- allow owner/admin to set tone and language
- optionally allow enterprise tenants to select their own provider row
- show readiness score and grounding coverage

### Phase C — WhatsApp-assisted reply flow

After Request 05 gateway work and WAPI Phase 6 wiring exist:

1. gateway webhook delivers `sessionId`
2. WAPI resolves tenant from `whatsapp_sessions`
3. WAPI stores inbound message
4. WAPI calls AI for a tenant-safe reply draft
5. user reviews draft before sending

This should stay human-in-the-loop for MVP.

### Phase D — campaign drafting and summaries

Extend the same provider layer into:

- campaign draft generation
- follow-up suggestions
- conversation summarization
- hot-lead signal enrichment

### Phase E — tenant datasets and dedicated Dify

Only after the shared-runtime pattern is stable:

- optional per-tenant Dify dataset sync jobs
- optional per-tenant dedicated Dify app / workspace
- premium tenant-specific API keys and base URLs via `ai_provider_configs`

## Recommended execution order

For current WAPI delivery priorities, do **not** start with tenant-dedicated
Dify infrastructure.

Correct order:

1. finish WAPI provider resolution and Dify client foundation
2. use WAPI-owned tenant retrieval from existing tables
3. expose one manual AI-assisted flow
4. wire AI into inbound WhatsApp once Phase 6 gateway integration lands
5. add tenant dataset sync only after the first shared-runtime flow proves safe
6. add dedicated Dify-per-tenant as a premium / later phase

## Guardrails for Coder AI

Coder AI should preserve these truths:

- WAPI already has the schema foundation for multi-tenant AI.
- WAPI does **not** yet have live Dify runtime integration.
- shared Dify is acceptable for MVP only if WAPI remains the tenancy boundary.
- phone number alone is not the tenant key; session/account ownership is.
- human approval remains required before customer-facing sends.
- tenant-dedicated Dify is a later upgrade path, not the first implementation.
