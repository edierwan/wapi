import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  permissions,
  rolePermissions,
  roles,
  userSystemRoles,
} from "@/db/schema";

/** True if the user has the given system permission via any active system role. */
export async function userHasSystemPermission(
  userId: string,
  code: string,
): Promise<boolean> {
  const db = requireDb();
  // Join: user_system_roles (active) → roles (scope=system) → role_permissions → permissions(code)
  const rows = await db
    .select({ id: permissions.id })
    .from(userSystemRoles)
    .innerJoin(roles, eq(roles.id, userSystemRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(userSystemRoles.userId, userId),
        eq(userSystemRoles.status, "active"),
        eq(roles.scopeType, "system"),
        eq(permissions.code, code),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Any active system role (cheaper than permission check). */
export async function userHasAnySystemRole(userId: string): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .select({ id: userSystemRoles.id })
    .from(userSystemRoles)
    .innerJoin(roles, eq(roles.id, userSystemRoles.roleId))
    .where(
      and(
        eq(userSystemRoles.userId, userId),
        eq(userSystemRoles.status, "active"),
        eq(roles.scopeType, "system"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Returns all active system role codes for a user. */
export async function getUserSystemRoleCodes(userId: string): Promise<string[]> {
  const db = requireDb();
  const rows = await db
    .select({ code: roles.code })
    .from(userSystemRoles)
    .innerJoin(roles, eq(roles.id, userSystemRoles.roleId))
    .where(
      and(
        eq(userSystemRoles.userId, userId),
        eq(userSystemRoles.status, "active"),
        eq(roles.scopeType, "system"),
      ),
    );
  return rows.map((r) => r.code);
}

export const SYSTEM_ROLE_CODES = [
  "SYSTEM_SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "SYSTEM_SUPPORT",
  "SYSTEM_BILLING",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

/** Utility used by some callers that just need "is there any system role?". */
export async function userIsSystemAdmin(userId: string): Promise<boolean> {
  return userHasAnySystemRole(userId);
}

export { inArray };
