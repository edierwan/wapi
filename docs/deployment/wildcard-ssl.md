# Wildcard SSL / Cloudflare / Coolify assessment

_Status: **action required on your side** before subdomain tenants can ship._

This document answers:

1. What is required to serve `https://{tenant}.wapi.getouch.co` (e.g.
   `acme.wapi.getouch.co`, `demo.wapi.getouch.co`, `api.wapi.getouch.co`).
2. Why things may fail with the **default Cloudflare Universal SSL** setup.
3. What to change to properly support wildcard sub-subdomains.
4. Whether we should temporarily use **path-based tenants** (`/t/{tenant}`).
5. Practical recommendation.

---

## 1. The domain shape

- Apex: `getouch.co`
- Product domain: `wapi.getouch.co` ← this is itself a subdomain of `getouch.co`
- Tenant pattern we want later: `{tenant}.wapi.getouch.co`
  → e.g. `acme.wapi.getouch.co`, `api.wapi.getouch.co`, `demo.wapi.getouch.co`

Because `wapi.getouch.co` is already a subdomain, tenants live one level
deeper. That is a **sub-subdomain** (a.k.a. second-level wildcard).

---

## 2. Why Cloudflare Universal SSL is NOT enough

Cloudflare's free **Universal SSL** covers:

- The apex (`getouch.co`)
- The first-level wildcard (`*.getouch.co`)

It does **NOT** cover **sub-subdomains** like `*.wapi.getouch.co`.

Concretely:

| URL                             | Covered by free Universal SSL? |
|---------------------------------|--------------------------------|
| `getouch.co`                    | ✅ |
| `wapi.getouch.co`               | ✅ (matches `*.getouch.co`) |
| `foo.getouch.co`                | ✅ |
| `acme.wapi.getouch.co`          | ❌ (needs `*.wapi.getouch.co`) |
| `api.wapi.getouch.co`           | ❌ (same) |
| `demo.wapi.getouch.co`          | ❌ (same) |

So the moment we try to open `https://demo.wapi.getouch.co`, the browser
will show an SSL error (certificate common-name mismatch) unless we
provision an additional cert for `*.wapi.getouch.co`.

---

## 3. What is actually required

Three viable options. Pick one.

### Option A — Cloudflare **Advanced Certificate Manager** (ACM)

- Paid add-on from Cloudflare ($10/month at the time of writing).
- Lets you request a certificate covering **`wapi.getouch.co` + `*.wapi.getouch.co`** explicitly.
- Zero server-side changes. Traffic continues through Cloudflare proxy.
- **Recommended for production.**

Steps (you do these in Cloudflare dashboard):
1. `SSL/TLS → Edge Certificates → Advanced Certificate Manager → Order`.
2. Hostnames: `wapi.getouch.co`, `*.wapi.getouch.co`.
3. Validation: HTTP (fastest) or TXT — Cloudflare handles it.
4. Wait for "Active" state (usually minutes).
5. In `DNS`, add a wildcard record: `CNAME  *.wapi  →  <coolify app hostname>`  (Proxy = Proxied / orange cloud).

After that, every `{tenant}.wapi.getouch.co` resolves to Coolify with a
valid certificate.

### Option B — Let's Encrypt wildcard on the origin (Coolify/Traefik)

- Free. Works if Cloudflare is set to **DNS only (grey cloud)** for
  `*.wapi.getouch.co`, OR if Coolify's Traefik obtains a cert via
  **DNS-01 challenge** using a Cloudflare API token.
- Requires:
  - A Cloudflare API token (`Zone.DNS: Edit` for `getouch.co`).
  - Coolify configured with Let's Encrypt + DNS-01 + Cloudflare provider.
- Works, but operationally heavier than ACM.
- Good fallback if you don't want to pay Cloudflare.

Trade-off: if you leave Cloudflare **Proxied** and use Let's Encrypt on
origin only, browsers talk to Cloudflare's edge cert (which needs ACM).
Either buy ACM, or set the wildcard DNS record to **DNS only (grey cloud)**
so browsers hit the origin directly. Grey cloud = no Cloudflare caching or
DDoS for that hostname.

### Option C — Cloudflare for SaaS (custom hostnames)

- Different model: each tenant brings their **own domain**
  (e.g. `chat.acme.com`) and Cloudflare issues a cert per hostname.
- **Not what we want** for `{tenant}.wapi.getouch.co`. Skip unless we
  later need a vanity-domain feature.

---

## 4. Temporary path-based tenants (recommended for Phase 2 start)

While we wait for Option A or B to be arranged, ship tenants as a **path prefix**:

```
https://wapi.getouch.co/t/acme
https://wapi.getouch.co/t/demo
```

Advantages:
- Works immediately with the existing `wapi.getouch.co` cert.
- No DNS or SSL changes required.
- Trivial to migrate to subdomains later — tenant resolution is isolated
  to one middleware.

See [`../architecture/tenant-routing.md`](../architecture/tenant-routing.md)
for the code strategy.

---

## 5. Recommendation

**Immediate practical path (Phase 2 start):**
1. Ship tenants as `/t/{tenant}` path-based.
2. Purchase Cloudflare ACM in parallel (cheap, ~$10/mo).

**Future ideal path (Phase 2 mid → Phase 3):**
1. Once ACM cert is active for `wapi.getouch.co` + `*.wapi.getouch.co`.
2. Add wildcard DNS `*.wapi → <coolify hostname>` (Proxied).
3. Flip a flag in the app (`TENANT_ROUTING=subdomain`) — middleware
   starts resolving tenant from subdomain instead of path.
4. Keep `/t/{tenant}` working as a redirect for backwards compatibility.

---

## 6. Checklist of things you (repo owner) must do

These are **not** things the code can automate:

- [ ] Decide between **Cloudflare ACM (Option A)** or **Let's Encrypt DNS-01 (Option B)**.
- [ ] If Option A: purchase ACM, request cert for `wapi.getouch.co` + `*.wapi.getouch.co`.
- [ ] If Option B: create Cloudflare API token with `Zone.DNS: Edit` for `getouch.co`, hand it to Coolify.
- [ ] Add DNS: `CNAME *.wapi.getouch.co → <coolify hostname>` (only when ready).
- [ ] In Coolify, for the WAPI app, enable **wildcard domain**: `*.wapi.getouch.co`.
- [ ] Confirm `https://demo.wapi.getouch.co` loads without SSL warning.

A formal copy of this checklist lives at
[`/docs/request/01-cloudflare-ssl-wildcard.md`](../request/01-cloudflare-ssl-wildcard.md).
