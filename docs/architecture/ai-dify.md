# AI integration - multi-tenant Dify + Ollama

## Goal

Every tenant can use AI assistance for grounded business tasks:

- draft replies
- summarize inbound conversations
- answer product or service or policy questions
- support campaign drafting and follow-up suggestions

WAPI remains the tenancy boundary.

- tenants do not log into Dify directly
- tenants configure AI and knowledge from WAPI UI
- Dify is the backend AI engine and workflow layer
- WAPI resolves tenant ownership first, then calls Dify with tenant-scoped context

## Current reality in WAPI

What already exists in code and schema:

- `ai_provider_configs` and `tenant_ai_settings` already exist in the DB schema
- `connected_accounts` and `whatsapp_sessions` already model tenant-owned WhatsApp numbers and sessions
- `business_memory_items` already stores tenant-scoped business knowledge
- `ai_readiness_scores` already measures whether a tenant has enough data to benefit from AI
- `message_queue` and `inbound_messages` already exist as later integration foundations
- `src/server/ai-providers.ts` already resolves a tenant-safe provider and secret reference
- `src/server/dify-client.ts` already wraps Dify `chat-messages` and enforces namespaced conversation keys
- `src/server/ai-context.ts` already assembles tenant-scoped business profile, product, service, and Business Brain context
- `src/app/t/[tenantSlug]/ai/draft/actions.ts` already provides a manual HITL draft flow using tenant-scoped context

What is not complete yet:

- tenant dataset or knowledge-base sync into Dify is not implemented yet
- no tenant-facing WAPI AI or knowledge management UI is complete yet
- inbound WhatsApp to AI runtime is not complete yet
- automated tenant dataset provisioning and mapping is not complete yet
- cross-tenant knowledge-isolation tests for Dify dataset retrieval are not complete yet

This distinction matters: WAPI has a real tenant-safe runtime foundation, but the Dify multi-tenant knowledge architecture is not fully delivered yet.

## Multi-tenant Dify architecture

### 1. Principle

- WAPI is the tenancy boundary.
- Dify must not be treated as the tenant source of truth.
- Tenants do not access `dify.getouch.co` directly.
- Tenant configuration happens in WAPI UI.
- WAPI resolves `tenant_id` first before any Dify call.

Tenant resolution must come from WAPI-owned context such as:

- authenticated tenant route (`/t/{slug}`)
- connected WhatsApp account ownership
- `whatsapp_sessions`
- tenant-scoped contact or campaign ownership

Dify receives tenant-scoped inputs from WAPI. It does not decide who the tenant is.

### 2. MVP decision

For MVP, use:

- one shared Dify app or workflow for the WAPI AI assistant or receptionist
- one Dify dataset or knowledge base per WAPI tenant

For MVP, do not use:

- one shared dataset for all tenants unless strict metadata enforcement and retrieval controls are proven safe
- app-per-tenant as the default model
- Dify workspace-per-tenant for normal tenants

### 3. Why shared app plus per-tenant dataset

Shared app plus per-tenant dataset is the correct MVP shape because it:

- avoids creating hundreds of duplicated Dify apps
- keeps prompt and workflow versioning centralized for Getouch operators
- keeps knowledge separated by tenant dataset
- lets WAPI remain the isolation and authorization layer
- keeps the upgrade path open for selected enterprise tenants later

This gives WAPI a clean operating model:

- one shared assistant workflow to maintain
- many tenant datasets to isolate knowledge
- one WAPI-owned routing layer deciding which tenant dataset is allowed for each request

### 4. Tenant knowledge flow

Tenant knowledge originates in WAPI, not in Dify.

Tenant adds knowledge in WAPI:

- business profile
- products
- services
- FAQ
- Business Brain notes
- policies
- operating hours
- brand voice
- prohibited words

WAPI then:

- stores those records in the WAPI database with `tenant_id`
- creates or finds one Dify dataset for that tenant
- syncs only that tenant's documents into that tenant dataset
- stores `dify_dataset_id` or equivalent mapping in `tenant_ai_settings` or a related mapping record
- never lets Tenant A content enter Tenant B dataset

The source of truth remains:

```text
WAPI database with tenant_id on every tenant-owned row
```

The Dify dataset is a retrieval surface, not the system of record.

### 5. Runtime call flow

Inbound message or AI draft request flow:

1. WAPI identifies tenant from account, session, route, or other WAPI-owned context.
2. WAPI loads tenant-scoped context from the WAPI database.
3. WAPI resolves the tenant's Dify dataset mapping.
4. WAPI calls the shared Dify app or workflow.
5. WAPI passes tenant-scoped inputs, retrieval settings, and a safe conversation key.

Minimum runtime inputs should include:

- `tenant_id`
- `tenant_slug`
- business profile summary
- products, services, and Business Brain context
- `dify_dataset_id` or equivalent retrieval configuration if supported by the chosen Dify integration mode
- a safe conversation key

Conversation key rule:

- do not use a bare phone number
- use a tenant-scoped key such as `tenant:{tenantId}:contact:{normalizedPhone}` or an equivalent tenant-safe format

Examples:

```text
tenant:{tenantId}:contact:{normalizedPhone}
tenant:{tenantId}:hitl:{userId}
tenant:{tenantId}:campaign:{campaignId}
```

### 6. Admin and operator Dify UI

`dify.getouch.co` is for Getouch admin and operator use only.

Expected operator view:

- Dify Studio may show one shared app such as `Getouch Receptionist Bot`
- Dify Knowledge may show many datasets such as:
  - `tenant-clinic-getouch-test`
  - `tenant-{slug}`

Tenants should not use Dify pages directly.

Tenants should use WAPI pages for:

- AI enablement
- knowledge management
- brand and tone configuration
- Business Brain editing
- product and service grounding data
- future AI dataset sync visibility

### 7. Future upgrade paths

Planned progression:

- Phase 1 or MVP: shared Dify app plus WAPI-owned tenant context
- Phase 2: shared Dify app plus per-tenant Dify dataset sync
- Phase 3: dedicated Dify app, dataset, and API key for selected enterprise tenants
- optional later: workspace-per-tenant only when strict operational or legal isolation is required

Enterprise dedicated mode is a later upgrade path, not the default MVP model.

### 8. Security rules

Hard rules:

- no cross-tenant dataset retrieval
- no bare-phone conversation IDs
- no Dify secret or API key exposed to the tenant browser
- WAPI calls Dify server-side only
- Dify API keys are stored via secret reference, not plaintext tenant UI fields
- tenant metadata must be included in audit and logs without exposing secrets

Additional isolation rules:

- retrieval queries inside WAPI must filter by `tenant_id`
- prompt assembly must use only that tenant's records
- any saved AI outputs must keep tenant ownership
- Dify configuration chosen for a tenant must belong either to that tenant or to the approved global default

## Provider model

### `ai_provider_configs`

- `id`, `tenant_id` (nullable; `null` means system or global default)
- `name`
- `kind`: `dify | ollama | openai_compatible`
- `base_url`
- `api_key_ref` as a secret pointer, never a raw secret value
- `config` jsonb for provider-specific settings
- `is_default`

### `tenant_ai_settings`

Current schema intent already supports tenant-level AI settings and should be extended to hold Dify mapping fields for the chosen mode.

### Provider resolution rule

When WAPI needs an AI call for a tenant:

```text
1. If tenant_ai_settings.default_provider_id is set, use that provider.
2. Else, use the tenant-owned ai_provider_configs row where is_default=true.
3. Else, fall back to the global ai_provider_configs row where tenant_id IS NULL and is_default=true.
```

This is valid for MVP because WAPI still decides which provider and which tenant dataset are allowed.

## Existing grounding sources

These are the sources the AI layer should read before calling Dify:

- `tenant_settings`
- `tenant_business_profiles`
- `products`, `services`, and related catalog tables
  - especially product descriptions, AI notes, category data, and price rows
- `business_memory_items`
- later: operating hours, policies, campaign history, consent signals, inbound conversation summaries, and customer memory

## Product master grounding rule

The product master is one of the most important AI grounding sources.

- AI may quote a product price only when the product record exists and the stored price is available.
- AI should prefer product descriptions and stored AI notes before creating new marketing language.
- If product facts are incomplete, AI should ask for clarification or route to a human instead of inventing details.

## Dify specifics

For `kind='dify'`, expected `config` shape can include:

```json
{
  "appId": "shared-getouch-receptionist",
  "workspaceId": "internal-operator-workspace",
  "appMode": "chat",
  "inputsTemplate": {},
  "datasetId": "optional-default-dataset-ref",
  "responseMode": "blocking"
}
```

Calls go to `{baseUrl}/v1/chat-messages` with:

- `Authorization: Bearer <resolved secret>`
- a stable tenant-safe user key
- structured `inputs` including WAPI tenant context

Suggested `inputs` contract:

```json
{
  "tenant_id": "uuid",
  "tenant_slug": "clinic-demo",
  "tenant_name": "Clinic Demo",
  "dify_dataset_id": "dataset_abc",
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

If dataset retrieval is handled outside the `inputs` contract for a specific Dify integration mode, WAPI must still resolve and enforce the tenant dataset before the call.

## Ollama specifics

For `kind='ollama'`, `config` may be `{ model, options? }`.

The same WAPI tenant-resolution and server-side secret rules still apply. Ollama does not change the tenancy model.

## How Dify should connect to WAPI features

### 1. Business Brain

`business_memory_items` is already tenant-scoped, editable, and suitable for facts, FAQ, policy, brand, offer, and warning data.

Near-term rule:

- WAPI reads Business Brain directly as a grounding source
- later, WAPI may sync those records into the tenant's Dify dataset

### 2. AI Readiness

`ai_readiness_scores` should remain a guidance layer, not the tenancy boundary.

- low-readiness tenants may still use AI, but WAPI should warn that grounding is weak
- higher-readiness tenants should get better retrieval quality and better draft quality

### 3. WhatsApp inbox and inbound messages

When inbound WhatsApp events are wired into AI flows:

- gateway webhook -> WAPI resolves session, account, and tenant
- WAPI stores inbound messages with tenant ownership
- WAPI resolves the tenant's Dify dataset
- WAPI calls the shared Dify app with tenant-safe context only
- AI returns a draft or suggestion, not an autonomous send by default

### 4. Campaign drafting

Campaign drafting should read:

- business profile
- products and services
- Business Brain
- campaign objective
- audience segment summary

Outputs should be saved into WAPI-owned campaign draft tables and still go through safety review and human approval.

## Implementation TODO

Required future implementation records:

- create or extend `tenant_ai_settings` mapping for:
  - provider
  - mode: `shared_app_per_tenant_dataset`
  - `dify_app_id` or app reference
  - `dify_dataset_id`
  - `api_key_ref`
  - `enabled`
- create a tenant knowledge sync service
- add or extend tenant WAPI UI for knowledge management where missing
- add tests proving Tenant A cannot retrieve Tenant B knowledge
- add an admin view showing tenant AI and Dify mapping without exposing secrets

## Recommended execution order

Correct order for future implementation:

1. preserve WAPI as the tenancy boundary
2. extend tenant AI settings with shared-app plus per-tenant-dataset mapping
3. add tenant dataset provisioning and knowledge sync
4. expose tenant-facing WAPI knowledge management UI
5. add explicit cross-tenant isolation tests
6. consider enterprise dedicated mode only after the shared-app model is stable

## Guardrails for future delivery

Before AI, Dify, or knowledge work:

- read this file first
- do not expose Dify directly to tenants
- do not default to app-per-tenant
- do not treat one shared dataset as safe without strict isolation controls
- use shared Dify app plus per-tenant dataset unless the request explicitly chooses enterprise dedicated mode
- keep WAPI as the system of record for tenant knowledge and customer memory
