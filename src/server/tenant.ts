/**
 * Central tenant resolver.
 *
 * Today: path-based mode — `/t/{tenantSlug}`.
 * Future: flip TENANT_ROUTING_MODE=subdomain to resolve from the request host
 *         (e.g. `acme.wapi.getouch.co`). No caller needs to change.
 */

import "server-only";
import { and, eq } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  tenantMembers,
  tenants,
  type MemberRole,
  type Tenant,
  type TenantStatus,
} from "@/db/schema";
import { RESERVED_SLUGS, validateSlug } from "@/lib/slug";

export type TenantRoutingMode = "path" | "subdomain";

export function getRoutingMode(): TenantRoutingMode {
  return process.env.TENANT_ROUTING_MODE === "subdomain" ? "subdomain" : "path";
}

export type TenantResolveError =
  | { kind: "invalid-slug"; reason: string }
  | { kind: "reserved-slug" }
  | { kind: "not-found" }
  | { kind: "suspended"; status: TenantStatus }
  | { kind: "disabled"; status: TenantStatus }
  | { kind: "forbidden" }; // authenticated user, but not a member

export type TenantContext = {
  mode: TenantRoutingMode;
  tenant: Tenant;
  /** null = viewer is not signed in (public tenant page handling is up to caller). */
  currentUserId: string | null;
  /** null when not a member; set when membership is active. */
  currentUserRole: MemberRole | null;
};

export type TenantResolveResult =
  | ({ ok: true } & TenantContext)
  | { ok: false; error: TenantResolveError; mode: TenantRoutingMode };

/** Resolve a tenant by slug and, optionally, verify the user's membership. */
export async function resolveTenantBySlug(params: {
  slug: string;
  currentUserId: string | null;
}): Promise<TenantResolveResult> {
  const mode = getRoutingMode();
  const check = validateSlug(params.slug);
  if (!check.ok) {
    const reserved = RESERVED_SLUGS.has(params.slug.toLowerCase());
    return {
      ok: false,
      mode,
      error: reserved
        ? { kind: "reserved-slug" }
        : { kind: "invalid-slug", reason: check.reason },
    };
  }

  const db = requireDb();

  const row = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, check.slug))
    .limit(1);

  const tenant = row[0];
  if (!tenant) return { ok: false, mode, error: { kind: "not-found" } };

  if (tenant.status === "disabled")
    return { ok: false, mode, error: { kind: "disabled", status: tenant.status } };
  if (tenant.status === "suspended")
    return { ok: false, mode, error: { kind: "suspended", status: tenant.status } };

  let currentUserRole: MemberRole | null = null;
  if (params.currentUserId) {
    const m = await db
      .select()
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenant.id),
          eq(tenantMembers.userId, params.currentUserId),
          eq(tenantMembers.status, "active"),
        ),
      )
      .limit(1);
    const membership = m[0];
    if (!membership)
      return { ok: false, mode, error: { kind: "forbidden" } };
    currentUserRole = membership.role;
  } else {
    // No signed-in user → treat as forbidden for a tenant workspace.
    return { ok: false, mode, error: { kind: "forbidden" } };
  }

  return {
    ok: true,
    mode,
    tenant,
    currentUserId: params.currentUserId,
    currentUserRole,
  };
}

/** List the tenants a user is a member of (for /dashboard). */
export async function listUserTenants(userId: string) {
  const db = requireDb();
  const rows = await db
    .select({
      tenant: tenants,
      role: tenantMembers.role,
      status: tenantMembers.status,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.status, "active"),
      ),
    );
  return rows;
}
