# Object storage (MinIO / S3-compatible)

WAPI stores media (product images, campaign attachments, chat media,
exports) in a self-hosted S3-compatible bucket.

## Target

- Endpoint: `https://s3.getouch.co` (MinIO, already provisioned).
- One bucket per environment: `wapi-prod`, `wapi-dev`.
- All objects stored with key prefix `t/{tenantId}/...` so even if
  signing broke, enumeration stays tenant-scoped.

## Why self-hosted MinIO

- No per-GB egress surprises.
- Data residency (Asia) controllable.
- S3 API compatibility — we can swap to Cloudflare R2 / AWS S3 later
  with zero app code changes.

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
S3_ENDPOINT=https://s3.getouch.co
S3_REGION=us-east-1        # MinIO default
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PROD=wapi-prod
S3_BUCKET_DEV=wapi-dev
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

App code uses AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`).

## Quota

`usage_counters.storage_bytes` incremented per successful upload and
decremented on delete. Enforced against `plans.limits.storage_bytes`.

## Phase

- Phase 3: create `storage_objects` table, don't ship upload UI yet.
- Phase 4: wire product/service image upload.
- Phase 5+: chat media, campaign attachments.
- Phase 8: exports + virus scan + CDN.
