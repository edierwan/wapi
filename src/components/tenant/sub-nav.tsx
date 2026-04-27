/**
 * Deprecated horizontal tenant nav.
 *
 * The tenant workspace now uses a left sidebar provided by
 * `src/app/t/[tenantSlug]/layout.tsx` (component
 * `src/components/tenant/tenant-sidebar.tsx`).
 *
 * This file is intentionally kept as a no-op so existing pages that still
 * import `TenantSubNav` continue to compile while we phase out the imports.
 */

export function TenantSubNav(_props: { slug: string; active: string }) {
  void _props;
  return null;
}
