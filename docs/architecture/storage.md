# Object storage (shared SeaweedFS / S3-compatible)

WAPI stores media (product images, campaign attachments, chat media,
exports) in the **shared getouch.co S3-compatible storage**.

## Shared infra (authoritative)

The full deployment, identity model, bucket strategy, and verification status
for the shared object store live in:

- [getouch.co/docs/s3-object-storage-2026-04-26.md](../../../getouch.co/docs/s3-object-storage-2026-04-26.md)

That is the single source of truth. WAPI must not duplicate the deployment
details here. This file only documents WAPI-specific use of that shared
service.

## Target (WAPI use)

- API endpoint: `https://s3api.getouch.co` (external) or
  `http://seaweed-s3:8333` (in-cluster on `getouch-edge`).
- Backend: SeaweedFS (S3-compatible). NOT MinIO. The earlier doc text was
  outdated; SDK behaviour is identical because both speak S3 v4.
- Buckets:
  - `wapi-assets`  — private tenant uploads (default).
  - `wapi-public`  — optional public-mirror per tenant flag (Phase 8+).
- Object keys MUST start with `tenants/{tenantId}/...` so even if signing or
  permission logic regressed, enumeration stays tenant-scoped.
- Default region string: `us-east-1` (SeaweedFS ignores it; AWS SDK requires
  some region to sign requests).
- `S3_FORCE_PATH_STYLE=true` is required.

## Why shared self-hosted

- No per-GB egress surprises.
- Data residency (Asia) controllable.
- S3 API compatibility — we can swap to Cloudflare R2 / AWS S3 later
  with zero app code changes.
- One disk pool serves news.getouch.co, openclaw, portal, and WAPI — fewer
  moving parts to operate.

## Identity

WAPI gets a dedicated least-privilege identity (`wapi-app`) scoped to
`Read|Write|List|Tagging:wapi-assets` (and `:wapi-public` once Phase 8 lands).
WAPI never holds the SeaweedFS `admin` key. Provisioning procedure: see
§5.1 of the shared doc above.

**Status (2026-04-27)**: the `wapi-app` identity has been provisioned, the
`wapi-assets` bucket has been created, and a smoke test using the new
least-privilege key passed (PUT/GET/LIST/DEL with sha-256 byte-for-byte match;
cross-bucket access correctly denied). The access key and secret are stored on
the host at `/home/deploy/.secrets/wapi-s3-{access,secret}key` (mode 600,
owner `deploy`). Wiring WAPI's Coolify env (`S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT` / `S3_BUCKET` / `S3_REGION` /
`S3_FORCE_PATH_STYLE`) is the remaining manual step before WAPI talks to live
storage.

## Server module

`src/server/storage.ts` is the only WAPI entry point that talks to S3.

- Loads the AWS SDK via dynamic import so the module is safe to import even
  when `@aws-sdk/client-s3` is not installed; in that case `storageEnabled()`
  returns `false` and admin/tenant pages render a "not configured" state
  instead of crashing.
- `storageEnabled()`: true only when all required env vars are present.
- `getStoragePublicConfig()`: returns a non-secret summary safe to render in
  admin UI (endpoint, bucket, region, access-key prefix, never the secret).
- `buildTenantPrefix(tenantId)`: validates tenantId is a UUID and returns
  `tenants/{tenantId}/`.
- `buildTenantObjectKey(tenantId, category, entityId, filename)`: enforces a
  whitelist of categories (`_meta`, `products`, `services`, `media`,
  `exports`, `imports`, `campaigns`, `messages`) and rejects path traversal in
  the filename or entityId.
- `initializeTenantStorage(tenantId, metadata)`: writes / refreshes
  `tenants/{tenantId}/_meta/storage.json` (idempotent; bumps `version`).
- `getTenantStorageSummary(tenantId)`: live S3 head — initialized flag,
  object count sample, version.
- `listTenantStorageObjects(tenantId, opts)`: best-effort first-page list.
- `deleteTenantStoragePrefix(tenantId, opts)`: hard-destructive prefix purge,
  paginated. Refuses unless the caller passes `confirmTenantId === tenantId`.
  Production guardrail: refuses to run when `NODE_ENV === "production"`
  unless `WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION=true` is set in env (or the
  caller passes `allowInProduction: true`).

## Admin and tenant UI

- `/admin/storage` (system admins only): technical backend view for provider
  status, bucket health, per-tenant prefix layout, DB row count + size from
  `storage_objects`, and live S3 init status from `_meta/storage.json`.
  Renders a "not configured" banner when env is unset.
- `/t/{tenantSlug}/settings/storage` (tenant members): business-facing
  "Files & Media" view with friendly storage summary cards, readable
  categories, upload placeholders, recent files, and simple privacy wording.
  Tenant users must not see provider names, bucket names, tenant UUID
  prefixes, or raw internal object paths.

Internally, tenant files are still isolated by `tenants/{tenantId}/...`
prefixes and the provider remains swappable (SeaweedFS today, MinIO / S3 / R2
later). That implementation detail belongs in admin and architecture docs, not
in the normal tenant workspace UI.

## Schema: `storage_objects`

Every uploaded object is a row, so we can list/enumerate/garbage-collect
per tenant.

- `id` uuid pk
- `tenant_id` uuid fk
- `kind` enum: `product_image | service_image | campaign_attachment | chat_media_inbound | chat_media_outbound | export | other`
- `owner_type` text (e.g. `products`, `services`, `campaigns`)
- `owner_id` uuid null (FK is logical, not enforced — avoids cascades across modules)
- `bucket` text
- `storage_key` text (the S3 key)
- `content_type` text
- `size_bytes` bigint
- `checksum` text (SHA-256 hex)
- `uploaded_by_user_id` uuid null
- `status` enum `uploading | ready | quarantined | deleted`
- `metadata` jsonb (original filename, EXIF-stripped flag, image dims)
- `created_at`, `updated_at`

Indexes:
- `(tenant_id, kind)` — listing by type
- `(owner_type, owner_id)` — "all media for this product"
- unique `(bucket, storage_key)`

## Upload flow (signed PUT)

1. Browser calls server action `startUpload({ kind, ownerType, ownerId, contentType, sizeBytes })`.
2. Server:
   - checks permission (e.g. `products.write` for `kind=product_image`)
   - validates `contentType` + `sizeBytes` against caps
   - inserts `storage_objects` row with `status='uploading'`
   - returns a **presigned PUT URL** (valid 5 min) scoped to the exact key
3. Browser PUTs the file directly to MinIO.
4. Browser calls `completeUpload({ storageObjectId, checksum })`.
5. Server verifies via HEAD (size + content-type), sets `status='ready'`.
6. Orphan uploads (`status='uploading'` > 30 min) are garbage-collected nightly.

## Serving

Default: **private bucket + short-lived signed GETs** (15 min TTL).
Public product images for marketing site: optional per-tenant flag to
mirror to a public bucket with a CDN (Phase 8+).

## Size & type caps

| Kind | Max size | Allowed types |
|---|---|---|
| `product_image` | 8 MB | `image/jpeg,png,webp` |
| `service_image` | 8 MB | `image/jpeg,png,webp` |
| `campaign_attachment` | 16 MB | images + `application/pdf` |
| `chat_media_*` | 64 MB | WhatsApp limits mirrored |
| `export` | 500 MB | `application/zip,json,csv` |

## Virus/content checks

Phase 8: optional ClamAV sidecar on upload completion. Before then:
content-type sniffing + magic-byte validation + EXIF stripping on images.

## Env

```
S3_ENDPOINT=https://s3api.getouch.co        # cross-host
# or, when WAPI runs in the same getouch-edge Docker network:
# S3_ENDPOINT=http://seaweed-s3:8333
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_BUCKET=wapi-assets                       # primary, private
S3_PUBLIC_BUCKET=wapi-public                # optional, Phase 8+
S3_ACCESS_KEY_ID=...                        # provisioned per environment by operator
S3_SECRET_ACCESS_KEY=...                    # never committed; secret-store only
```

App code uses AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).

Dev / staging / prod separate by **WAPI environment**, not by S3 bucket: a
single `wapi-assets` bucket holds all environments because tenant id is a UUID
and cannot collide across envs in practice. If isolation between dev/prod
becomes a hard requirement later, switch to `wapi-assets-prod` /
`wapi-assets-dev` and update `S3_BUCKET` per env.

## Quota

`usage_counters.storage_bytes` incremented per successful upload and
decremented on delete. Enforced against `plans.limits.storage_bytes`.

## Phase

- Phase 3: create `storage_objects` table, don't ship upload UI yet.
- Phase 4: wire product/service image upload.
- Phase 5+: chat media, campaign attachments.
- Phase 8: exports + virus scan + CDN.
