# AI integration — multi-tenant Dify + Ollama

## Goal

Every tenant can use AI assistance (draft messages, summarize threads,
route replies). Phase 1 of the AI story uses a **shared** Dify instance.
Later, premium tenants run their **own** Dify app with their own dataset.

## Data model

Two tables (already in schema):

### `ai_provider_configs`

- `id`, `tenant_id` (nullable — null = **global / system default**)
- `name` (e.g. `system-dify`, `acme-dify-private`)
- `kind` enum: `dify | ollama | openai_compatible`
- `base_url` (HTTP endpoint)
- `api_key_ref` (**reference** to a secret, e.g. `DIFY_DEFAULT_API_KEY`
  env var name or a Vault path — the actual secret is not stored here)
- `config` jsonb (`{ appId, workspaceId, model, temperature, … }`)
- `is_default` boolean

### `tenant_ai_settings`

- `id`, `tenant_id`
- `default_provider_id` (points at a row in `ai_provider_configs`)
- `tone`, `language`

## Resolution rule (per request)

When WAPI needs an AI call for a tenant:

```
1. If tenant_ai_settings.default_provider_id is set → use that config.
2. Else, pick the tenant's ai_provider_configs row where is_default=true.
3. Else, fall back to the **global** ai_provider_configs row
   (tenant_id IS NULL AND is_default=true).  ← the shared Dify.
```

This keeps MVP simple (every tenant falls through to the system row)
while allowing upgrade to a dedicated Dify with **zero code changes** —
just an `INSERT` into `ai_provider_configs` with the tenant's ID.

## Secrets

Secrets **must not** live in the DB. `api_key_ref` is a *pointer*:

- In MVP: the string is the name of an env var (e.g. `DIFY_DEFAULT_API_KEY`).
  The server reads `process.env[row.apiKeyRef]` at call time.
- Later: the string is a Vault/Coolify-Secrets path; same abstraction.

## Dify specifics

For `kind='dify'`, expected `config` shape:

```json
{
  "appId": "…",
  "workspaceId": "…",
  "appMode": "chat",
  "inputsTemplate": {}
}
```

Calls go to `{baseUrl}/v1/chat-messages` with
`Authorization: Bearer {api_key_ref → env}`.

## Ollama specifics

For `kind='ollama'`, `config` = `{ model, options? }`.
Calls go to `{baseUrl}/api/chat`. No API key required by default.

## Recommendation

- **MVP**: seed a single `ai_provider_configs` row with
  `tenant_id=NULL`, `kind='dify'`, `is_default=true`,
  `base_url=$DIFY_DEFAULT_BASE_URL`, `api_key_ref='DIFY_DEFAULT_API_KEY'`.
  Seed script does this automatically when `DIFY_DEFAULT_BASE_URL` is set.
- **Phase 3**: add a UI under `/t/{slug}/settings/ai` where owners can
  plug in their own Dify app (enterprise tier).
- **Phase 4**: self-hosted Dify-per-tenant containers orchestrated by
  Coolify, with per-tenant datasets.
