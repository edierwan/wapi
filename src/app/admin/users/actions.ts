"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  pendingRegistrations,
  phoneVerifications,
  roles,
  tenantMembers,
  userSystemRoles,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { userHasSystemPermission } from "@/server/permissions";

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

    await tx.delete(tenantMembers).where(eq(tenantMembers.userId, target.id));

    await tx.delete(users).where(eq(users.id, target.id));
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  bounce("/admin/users", "notice", `Deleted user ${target.email}.`);
}