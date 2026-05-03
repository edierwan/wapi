import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireCurrentUser } from "@/server/auth";
import { listUserTenants } from "@/server/tenant";
import { userHasSystemPermission } from "@/server/permissions";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireCurrentUser("/login");

  // System admins go to /admin (they have no normal tenant flow).
  if (await userHasSystemPermission(user.id, "system.admin.access").catch(() => false)) {
    redirect("/admin");
  }

  const memberships = await listUserTenants(user.id);

  if (memberships.length === 1) {
    const only = memberships[0]!;
    redirect(`/t/${only.tenant.slug}`);
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Signed in as <span className="font-medium text-[var(--foreground)]">{user.email}</span>
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Choose a workspace
          </h1>
          <p className="mt-1 text-[var(--muted-foreground)]">
            Pick the workspace you want to open. You can switch anytime.
          </p>
        </div>

        <SignOutButton variant="ghost" size="sm" />
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {memberships.map(({ tenant, role }) => (
          <Link key={tenant.id} href={`/t/${tenant.slug}`} className="group">
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{tenant.name}</CardTitle>
                    <CardDescription className="mt-1 font-mono text-xs">
                      /t/{tenant.slug}
                    </CardDescription>
                  </div>
                  <Badge className="uppercase">{tenant.status}</Badge>
                </div>
                <div className="mt-6 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">Role</span>
                  <span className="font-medium capitalize">{role}</span>
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
                  Open workspace <ArrowRight className="size-4" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Plus className="size-4" />
              Create a workspace
            </CardTitle>
            <CardDescription>
              Workspace creation lands in Phase 2 alongside billing. Contact
              support to provision a new tenant in the meantime.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {memberships.length === 0 && (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted-foreground)]">
            You are signed in but do not belong to any workspace yet. Ask an
            owner to invite you, or contact support.
          </p>
        </div>
      )}
    </section>
  );
}
