import "server-only";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/server/auth";
import { resolveTenantBySlug, type TenantContext } from "@/server/tenant";

/**
 * Shared guard for every /t/[tenantSlug]/* page. Resolves the tenant,
 * handles redirects for forbidden / missing / suspended. Returns the
 * successful context.
 */
export async function requireTenantContext(
  tenantSlug: string,
): Promise<TenantContext> {
  const me = await requireCurrentUser("/login");

  const res = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });

  if (!res.ok) {
    switch (res.error.kind) {
      case "forbidden":
        redirect(`/access-denied?slug=${encodeURIComponent(tenantSlug)}`);
      case "suspended":
      case "disabled":
        redirect(
          `/workspace-not-found?slug=${encodeURIComponent(
            tenantSlug,
          )}&status=${res.error.status}`,
        );
      default:
        redirect(`/workspace-not-found?slug=${encodeURIComponent(tenantSlug)}`);
    }
  }

  return res;
}
