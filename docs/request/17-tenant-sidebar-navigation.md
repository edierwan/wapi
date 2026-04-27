# Request 17 — Tenant Sidebar Navigation

Status: SHIPPED 2026-04-27.

Update 2026-04-28: the sidebar is no longer purely hardcoded at runtime.
Route metadata still lives in code, but visible items are now filtered by the
tenant's enabled modules from `tenant_modules`, with defaults coming from
`industry_module_presets` and user overrides managed at Settings → Modules.

## Problem

Tenant workspace pages under `/t/[tenantSlug]` were using a horizontal top
sub-nav (`TenantSubNav`) that wraps onto multiple lines on narrow screens and
buries the active workspace section. The user requested a left sidebar
similar to the system admin sidebar, kept distinct from `/admin`.

## What changed

- **New centralized config** — `src/components/tenant/tenant-nav-items.ts`
  defines section groupings (Workspace / Communication / Catalog / AI &
  Growth / Settings) and the active-state matcher
  `isTenantNavItemActive(item, slug, pathname)` so nested detail routes
  highlight the correct parent. Each module-backed item now also carries a
  stable `moduleCode` so the tenant layout can hide or show it dynamically.
- **New sidebar component** — `src/components/tenant/tenant-sidebar.tsx`
  renders the sticky desktop sidebar. On `lg` and up it docks alongside the
  main content; below `lg` it collapses into a slide-in drawer triggered by
  a floating menu button so forms and tables remain usable on narrow
  viewports without horizontal overflow.
- **New tenant layout** —
  `src/app/t/[tenantSlug]/layout.tsx` wraps every tenant page with the
  sidebar + main flex container and now passes the enabled tenant modules to
  the client sidebar. The shared root tenant layout
  (`src/app/t/layout.tsx`) — which provides the WAPI navbar (logo, theme,
  user, Dashboard link, Sign out) and footer — is unchanged.
- **Tenant module settings** — `/t/{slug}/settings/modules` lets owners/admins
  toggle modules on or off. The setting writes `tenant_modules.source='manual'`
  so later industry re-syncs do not overwrite explicit workspace choices.
- **Horizontal nav neutralized** — `src/components/tenant/sub-nav.tsx`
  is now a no-op (`TenantSubNav` returns `null`). Existing pages that still
  import it continue to compile; the sidebar in the layout drives all
  navigation. Pages will be cleaned up incrementally in a follow-up.

### Sidebar sections

```
Workspace
  Overview                     /t/{slug}
Communication
  WhatsApp                     /t/{slug}/whatsapp
  Inbox                        /t/{slug}/inbox    (+ /inbox/[phone])
  Contacts                     /t/{slug}/contacts (+ /contacts/[id])
Catalog
  Products                     /t/{slug}/products
  Services                     /t/{slug}/services
AI & Growth
  Brain                        /t/{slug}/brain
  Campaigns                    /t/{slug}/campaigns (+ /[id], /followups)
  AI                           /t/{slug}/ai/draft  (+ /ai/*)
  Analytics  (Soon)            /t/{slug}/analytics
Settings
  Settings                     /t/{slug}/settings/business (+ /settings/*)
  Storage                      /t/{slug}/settings/storage
```

### Active-state rules

- Exact-path match always wins.
- `Settings` claims any `/settings/...` route except `/settings/storage`,
  which is owned by the `Storage` item.
- `Inbox`, `Contacts`, `Campaigns`, and `AI` use prefix matchers so detail
  pages (e.g. `/contacts/{id}`, `/campaigns/{id}`, `/inbox/{phone}`,
  `/ai/draft`) highlight their parent group.

## Admin sidebar untouched

`/admin/*` continues to use `src/components/admin/_nav.ts` and its existing
admin layout. The new tenant sidebar config is a separate file under
`src/components/tenant/`, so admin behavior is not affected.

## Validation (2026-04-27)

```
pnpm test:unit   -> 16/16 pass
pnpm typecheck   -> clean
pnpm build       -> clean; all /t/[tenantSlug]/* routes compile
```

## Live URLs to test

- https://wapi-dev.getouch.co/t/chinavaape-3
- https://wapi-dev.getouch.co/t/chinavaape-3/products
- https://wapi-dev.getouch.co/t/chinavaape-3/contacts
- https://wapi-dev.getouch.co/t/chinavaape-3/whatsapp
- https://wapi-dev.getouch.co/t/chinavaape-3/inbox
- https://wapi-dev.getouch.co/t/chinavaape-3/settings/business
- https://wapi-dev.getouch.co/t/chinavaape-3/settings/storage

## Follow-ups (not blocking)

- Remove the now-dead `<TenantSubNav>` import lines from individual page
  files in the next routine sweep.
- Add a unit test covering `isTenantNavItemActive` once we have a vitest
  or node:test harness for client utilities.
