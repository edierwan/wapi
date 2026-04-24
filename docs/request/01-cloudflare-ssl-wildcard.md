# Request 01 — Cloudflare wildcard SSL for `*.wapi.getouch.co`

**Context:** see [`/docs/deployment/wildcard-ssl.md`](../deployment/wildcard-ssl.md).

## Why this is needed

Free Cloudflare Universal SSL covers `*.getouch.co` but **not**
`*.wapi.getouch.co` (sub-subdomains). As soon as we try to serve
`demo.wapi.getouch.co`, `acme.wapi.getouch.co`, or
`api.wapi.getouch.co`, the browser will show a certificate error.

We need a certificate that explicitly covers:

- `wapi.getouch.co`
- `*.wapi.getouch.co`

## Please decide (pick one)

### ☐ Option A — Cloudflare Advanced Certificate Manager (ACM)  ← recommended

1. Cloudflare dashboard → `getouch.co` zone.
2. `SSL/TLS → Edge Certificates → Advanced Certificate Manager → Order`.
3. Hostnames: `wapi.getouch.co`, `*.wapi.getouch.co`.
4. Validation method: **HTTP** (fastest).
5. Wait for **Active** status.
6. Back in `DNS`, add:
   - Type: `CNAME`
   - Name: `*.wapi`
   - Target: _your Coolify app hostname_ (the same target used for `wapi.getouch.co`).
   - Proxy status: **Proxied** (orange cloud).

### ☐ Option B — Let's Encrypt DNS-01 via Coolify/Traefik

1. Create a Cloudflare API token with scope `Zone.DNS: Edit` for `getouch.co`.
2. Hand the token to Coolify (Traefik DNS provider config) — ask me
   for exact Coolify UI steps if needed.
3. In Coolify, set the app's domain to `*.wapi.getouch.co` and enable
   Let's Encrypt with DNS challenge (Cloudflare provider).
4. In Cloudflare DNS, set the wildcard record to **DNS only (grey cloud)**
   OR leave it Proxied only if you will also buy ACM — see the SSL doc.

## Confirmation checklist

- [ ] Cert active (ACM) _or_ Let's Encrypt wildcard issued (Option B).
- [ ] `dig +short acme.wapi.getouch.co` returns the Coolify host.
- [ ] `curl -I https://demo.wapi.getouch.co` returns a 2xx/3xx with no SSL error.
- [ ] Notify in this file (append a "Done on YYYY-MM-DD by …" line, or move to `done/`).

## Notes

- Until this is done, we will **not** enable subdomain tenant routing.
  Phase 2 will use path-based tenants (`/t/{tenant}`) which work over
  the existing `wapi.getouch.co` cert.
