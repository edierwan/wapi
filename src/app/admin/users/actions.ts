"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  pendingRegistrations,
  passwordResetSessions,
  phoneVerifications,
  roles,
  tenantMembers,
  tenants,
  userSystemRoles,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { userHasSystemPermission } from "@/server/permissions";
import { deleteTenantStoragePrefix, storageEnabled } from "@/server/storage";

type AdminTarget = {
  id: string;
  email: string;
  phone: string | null;
  isSystemAdmin: boolean;
};

async function requireAdminUser() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) redirect("/login?next=/admin/users");

  const canAccess = await userHasSystemPermission(me.id, "system.admin.access").catch(
    () => false,
  );
  if (!canAccess) redirect("/access-denied?reason=admin");

  return me;
}

function bounce(path: string, kind: "notice" | "error", message: string): never {
  const qs = new URLSearchParams({ [kind]: message });
  redirect(`${path}?${qs.toString()}`);
}

async function loadTarget(userId: string): Promise<AdminTarget | null> {
  const db = requireDb();
  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      isSystemAdmin: users.isSystemAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return target ?? null;
}

async function hasProtectedSystemRole(userId: string): Promise<boolean> {
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
    )
    .limit(1);
  return rows.length > 0;
}

async function cleanupTestingArtifacts(target: AdminTarget) {
  const db = requireDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(pendingRegistrations)
      .where(sql`lower(${pendingRegistrations.email}) = ${target.email.toLowerCase()}`);

    if (target.phone) {
      await tx
        .delete(phoneVerifications)
        .where(eq(phoneVerifications.phone, target.phone));

      await tx
        .delete(pendingRegistrations)
        .where(eq(pendingRegistrations.phone, target.phone));
    }

    await tx
      .delete(passwordResetSessions)
      .where(eq(passwordResetSessions.userId, target.id));
  });
}

export async function resetUserForTestingAction(formData: FormData) {
  await requireAdminUser();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    bounce("/admin/users", "error", "User id is required.");
  }

  const target = await loadTarget(userId);
  if (!target) {
    revalidatePath("/admin/users");
    return;
  }

  await cleanupTestingArtifacts(target);
  revalidatePath("/admin/users");
  bounce(
    "/admin/users",
    "notice",
    `Cleared pending registration and OTP rows for ${target.email}.`,
  );
}

export async function deleteUserAction(formData: FormData) {
  const me = await requireAdminUser();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) {
    bounce("/admin/users", "error", "User id is required.");
  }
  if (userId === me.id) {
    bounce("/admin/users", "error", "You cannot delete your own account.");
  }

  const confirmEmail = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  const alsoDeleteOwnedTenants =
    String(formData.get("alsoDeleteOwnedTenants") ?? "") === "on";
  const alsoPurgeStorage =
    String(formData.get("alsoPurgeStorage") ?? "") === "on";

  const target = await loadTarget(userId);
  if (!target) {
    revalidatePath("/admin/users");
    return;
  }

  if (confirmEmail !== target.email.toLowerCase()) {
    bounce(
      "/admin/users",
      "error",
      `Typed confirmation must exactly match ${target.email}.`,
    );
  }

  if (target.isSystemAdmin || (await hasProtectedSystemRole(target.id))) {
    bounce(
      "/admin/users",
      "error",
      `Protected system admin accounts cannot be deleted from this page (${target.email}).`,
    );
  }

  // Storage purge is only meaningful when we are also deleting owned tenants.
  if (alsoPurgeStorage && !alsoDeleteOwnedTenants) {
    bounce(
      "/admin/users",
      "error",
      "Object storage purge requires the 'also delete owned workspaces' option.",
    );
  }

  // Production guardrail for storage purge.
  const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const purgeOverride =
    (process.env.WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION ?? "").toLowerCase() === "true";
  if (alsoPurgeStorage && isProd && !purgeOverride) {
    bounce(
      "/admin/users",
      "error",
      "Object storage purge is disabled in production. Set WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION=true to override.",
    );
  }

  const db = requireDb();

  // Identify tenants where this user is the sole active owner.
  const soleOwnerTenants = alsoDeleteOwnedTenants
    ? await findSoleOwnerTenants(target.id)
    : [];

  // Phase 1: storage purge (best-effort, before DB so a failure here does not
  // leave dangling DB-with-objects state). Each tenant is purged independently
  // so one failure does not abort the rest.
  const purgeResults: Array<{ tenantId: string; ok: boolean; reason?: string; deleted?: number }> = [];
  if (alsoPurgeStorage && storageEnabled() && soleOwnerTenants.length > 0) {
    for (const t of soleOwnerTenants) {
      try {
        const r = await deleteTenantStoragePrefix(t.id, {
          confirmTenantId: t.id,
          allowInProduction: purgeOverride,
        });
        purgeResults.push(
          r.ok
            ? { tenantId: t.id, ok: true, deleted: r.deleted }
            : { tenantId: t.id, ok: false, reason: r.reason },
        );
      } catch (err) {
        purgeResults.push({
          tenantId: t.id,
          ok: false,
          reason: err instanceof Error ? err.message : "purge_failed",
        });
      }
    }
  }

  // Phase 2: DB cleanup, all in a single transaction.
  await db.transaction(async (tx) => {
    await tx
      .delete(pendingRegistrations)
      .where(sql`lower(${pendingRegistrations.email}) = ${target.email.toLowerCase()}`);

    if (target.phone) {
      await tx
        .delete(phoneVerifications)
        .where(eq(phoneVerifications.phone, target.phone));

      await tx
        .delete(pendingRegistrations)
        .where(eq(pendingRegistrations.phone, target.phone));
    }

    await tx
      .delete(passwordResetSessions)
      .where(eq(passwordResetSessions.userId, target.id));

    await tx.delete(tenantMembers).where(eq(tenantMembers.userId, target.id));

    if (alsoDeleteOwnedTenants && soleOwnerTenants.length > 0) {
      // FK cascade on tenants(id) wipes members, sessions, products, services,
      // ai configs, storage_objects rows, etc. Object storage purge above
      // (if enabled) handled the actual S3 prefix.
      for (const t of soleOwnerTenants) {
        await tx.delete(tenants).where(eq(tenants.id, t.id));
      }
    }

    await tx.delete(users).where(eq(users.id, target.id));
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");

  const parts: string[] = [`Deleted user ${target.email}.`];
  if (alsoDeleteOwnedTenants && soleOwnerTenants.length > 0) {
    parts.push(
      `Removed ${soleOwnerTenants.length} sole-owner workspace${soleOwnerTenants.length === 1 ? "" : "s"} (${soleOwnerTenants.map((t) => t.slug).join(", ")}).`,
    );
  }
  if (alsoPurgeStorage) {
    const okCount = purgeResults.filter((r) => r.ok).length;
    const failed = purgeResults.filter((r) => !r.ok);
    parts.push(`Storage purge: ${okCount}/${purgeResults.length} ok.`);
    if (failed.length > 0) {
      parts.push(
        `Purge failures: ${failed.map((f) => `${f.tenantId.slice(0, 8)}=${f.reason}`).join(" ")}`,
      );
    }
  }
  bounce("/admin/users", "notice", parts.join(" "));
}

/**
 * Tenants where `userId` is the only currently active owner. Deleting the
 * user without first transferring ownership would leave these tenants
 * orphaned, so the cascade flow lets the operator opt to delete them.
 */
async function findSoleOwnerTenants(
  userId: string,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const db = requireDb();
  const owned = await db
    .select({
      id: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.role, "owner"),
        eq(tenantMembers.status, "active"),
      ),
    );
  if (owned.length === 0) return [];
  const result: Array<{ id: string; slug: string; name: string }> = [];
  for (const t of owned) {
    const otherOwners = await db
      .select({ id: tenantMembers.id })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, t.id),
          eq(tenantMembers.role, "owner"),
          eq(tenantMembers.status, "active"),
          ne(tenantMembers.userId, userId),
        ),
      )
      .limit(1);
    if (otherOwners.length === 0) result.push(t);
  }
  return result;
}

/** Read-only preview helper for the admin UI. Safe to call from server components. */
export async function previewUserDeletion(userId: string): Promise<{
  userId: string;
  soleOwnerTenants: Array<{ id: string; slug: string; name: string }>;
  storageEnabled: boolean;
  isProductionPurgeBlocked: boolean;
}> {
  const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  const overridden =
    (process.env.WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION ?? "").toLowerCase() === "true";
  return {
    userId,
    soleOwnerTenants: await findSoleOwnerTenants(userId),
    storageEnabled: storageEnabled(),
    isProductionPurgeBlocked: isProd && !overridden,
  };
}