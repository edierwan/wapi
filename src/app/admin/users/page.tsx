import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireDb } from "@/db/client";
import { roles, tenantMembers, tenants, userSystemRoles, users } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { storageEnabled } from "@/server/storage";
import { deleteUserAction, resetUserForTestingAction } from "./actions";

export const dynamic = "force-dynamic";

function looksLikeSeededDemoUser(
  user: { name: string | null; email: string | null; phone: string | null },
  memberships: Array<{ tenantName: string; tenantSlug: string }>,
) {
  const name = (user.name ?? "").toLowerCase();
  const email = (user.email ?? "").toLowerCase();
  const phone = (user.phone ?? "").replace(/\D+/g, "");

  if (name.includes("demo") || email.includes("demo") || email.includes("local.invalid")) {
    return true;
  }

  if (phone.endsWith("60192277233") || phone.endsWith("0192277233")) {
    return true;
  }

  return memberships.some((membership) => {
    const tenantName = membership.tenantName.toLowerCase();
    const tenantSlug = membership.tenantSlug.toLowerCase();
    return (
      tenantName.includes("demo") ||
      tenantName.includes("phase 3") ||
      tenantSlug.includes("demo") ||
      tenantSlug.startsWith("phase3")
    );
  });
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const db = requireDb();
  const me = await getCurrentUser().catch(() => null);
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const notice = typeof params.notice === "string" ? params.notice : "";
  const error = typeof params.error === "string" ? params.error : "";

  const userWhere = q
    ? or(
        ilike(users.email, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(users.phone, `%${q}%`),
      )
    : undefined;

  const userRowsQuery = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      status: users.status,
      isSystemAdmin: users.isSystemAdmin,
      emailVerified: users.emailVerified,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const userRows = userWhere ? await userRowsQuery.where(userWhere) : await userRowsQuery;

  const membershipRows = await db
    .select({
      userId: tenantMembers.userId,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: tenantMembers.role,
      status: tenantMembers.status,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId));

  const systemRoleRows = await db
    .select({
      userId: userSystemRoles.userId,
      code: roles.code,
      name: roles.name,
      status: userSystemRoles.status,
    })
    .from(userSystemRoles)
    .innerJoin(roles, eq(roles.id, userSystemRoles.roleId))
    .where(and(eq(userSystemRoles.status, "active"), eq(roles.scopeType, "system")));

  const membershipsByUser = new Map<string, typeof membershipRows>();
  for (const row of membershipRows) {
    const list = membershipsByUser.get(row.userId) ?? [];
    list.push(row);
    membershipsByUser.set(row.userId, list);
  }

  const systemRolesByUser = new Map<string, typeof systemRoleRows>();
  for (const row of systemRoleRows) {
    const list = systemRolesByUser.get(row.userId) ?? [];
    list.push(row);
    systemRolesByUser.set(row.userId, list);
  }

  const verifiedPhones = userRows.filter((user) => user.phoneVerified).length;
  const withMemberships = userRows.filter(
    (user) => (membershipsByUser.get(user.id)?.length ?? 0) > 0,
  ).length;

  const storageActive = storageEnabled();
  const isProductionPurgeBlocked =
    (process.env.NODE_ENV ?? "").toLowerCase() === "production" &&
    (process.env.WAPI_ALLOW_STORAGE_PURGE_IN_PRODUCTION ?? "").toLowerCase() !== "true";

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Global user directory for registration cleanup, tenant membership checks,
            and system-role visibility.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      {notice ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={String(userRows.length)} />
        <StatCard label="Phone verified" value={String(verifiedPhones)} />
        <StatCard label="In a workspace" value={String(withMemberships)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
          <CardDescription>
            Filter by email, display name, or phone before running cleanup actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" action="/admin/users" method="get">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search email, name, phone"
              className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">Search</Button>
            {q ? (
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/admin/users">Clear</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>
            Cleanup clears pending registration and OTP rows for the same email or phone.
            Delete removes the user only after typed email confirmation and is blocked for accounts with active system roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userRows.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Verification</th>
                    <th className="px-3 py-2 font-medium">Tenant memberships</th>
                    <th className="px-3 py-2 font-medium">System roles</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {userRows.map((user) => {
                    const memberships = membershipsByUser.get(user.id) ?? [];
                    const systemRoles = systemRolesByUser.get(user.id) ?? [];
                    const isCurrentUser = user.id === me?.id;
                    const hasProtectedSystemRole = systemRoles.length > 0;
                    const protectionReason = hasProtectedSystemRole
                      ? "Protected because system role"
                      : user.isSystemAdmin
                        ? looksLikeSeededDemoUser(user, memberships)
                          ? "Seeded demo account"
                          : "Legacy admin flag"
                        : null;
                    const deleteBlocked = isCurrentUser || hasProtectedSystemRole;

                    return (
                      <tr key={user.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-[var(--foreground)]">
                            {user.name || "Unnamed user"}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {user.email}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {user.phone || "No phone"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge>{user.status}</Badge>
                            {protectionReason ? <Badge>{protectionReason}</Badge> : null}
                            {isCurrentUser ? <Badge>Current session</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          <div>{user.emailVerified ? "Email verified" : "Email pending"}</div>
                          <div className="mt-1">
                            {user.phoneVerified ? "Phone verified" : "Phone pending"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {memberships.length === 0 ? (
                            <span>No active memberships</span>
                          ) : (
                            <ul className="space-y-1">
                              {memberships.map((membership) => (
                                <li key={`${user.id}-${membership.tenantId}`}>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {membership.tenantName}
                                  </span>{" "}
                                  <span className="font-mono text-[11px]">
                                    /t/{membership.tenantSlug}
                                  </span>{" "}
                                  <span className="capitalize">· {membership.role}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {systemRoles.length === 0 ? (
                            <span>No system role</span>
                          ) : (
                            <ul className="space-y-1">
                              {systemRoles.map((role) => (
                                <li key={`${user.id}-${role.code}`}>
                                  <span className="font-medium text-[var(--foreground)]">
                                    {role.name}
                                  </span>{" "}
                                  <span className="font-mono text-[11px]">{role.code}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                          {user.createdAt.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex min-w-72 flex-col items-stretch gap-2">
                            <form action={resetUserForTestingAction}>
                              <input type="hidden" name="userId" value={user.id} />
                              <Button type="submit" variant="ghost" size="sm" className="w-full">
                                Clear registration artifacts
                              </Button>
                            </form>
                            <form action={deleteUserAction} className="space-y-2 rounded-md border border-red-500/20 bg-red-500/5 p-2">
                              <input type="hidden" name="userId" value={user.id} />
                              <input
                                type="text"
                                name="confirmEmail"
                                placeholder={`Type ${user.email}`}
                                disabled={deleteBlocked}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs"
                              />
                              <label className="flex items-start gap-2 text-left text-[11px] text-[var(--muted-foreground)]">
                                <input
                                  type="checkbox"
                                  name="alsoDeleteOwnedTenants"
                                  disabled={deleteBlocked}
                                  className="mt-0.5"
                                />
                                <span>
                                  Also delete workspaces where this user is the
                                  sole owner (cascades to all tenant data).
                                </span>
                              </label>
                              <label className="flex items-start gap-2 text-left text-[11px] text-[var(--muted-foreground)]">
                                <input
                                  type="checkbox"
                                  name="alsoPurgeStorage"
                                  disabled={
                                    deleteBlocked || !storageActive
                                  }
                                  className="mt-0.5"
                                />
                                <span>
                                  Also purge object-storage prefixes for those
                                  workspaces.{" "}
                                  {!storageActive
                                    ? "(Storage not configured.)"
                                    : isProductionPurgeBlocked
                                      ? "(Disabled in production.)"
                                      : "Dev-only by default."}
                                </span>
                              </label>
                              <p className="text-left text-[11px] text-[var(--muted-foreground)]">
                                Without checkboxes: clears OTPs/pending rows,
                                drops memberships, deletes the user only.
                              </p>
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                disabled={deleteBlocked}
                                className="w-full border-red-500/30 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300"
                              >
                                Delete user
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
