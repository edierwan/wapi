import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireCurrentUser } from "@/server/auth";
import {
  getUserSystemRoleCodes,
  userHasSystemPermission,
} from "@/server/permissions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { appConfig } from "@/config/app";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: "System admin", template: "%s · System admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Layout for every `/admin/**` route.
 *
 * Access control: requires the `system.admin.access` permission via any
 * active system role. Email-based hardcoding is forbidden — RBAC only.
 *
 * The user is redirected to `/login` if anonymous and to
 * `/access-denied?reason=admin` if signed in but lacking the permission.
 *
 * NOTE on future support mode: system admins should *not* be silently
 * dropped into a tenant workspace. Cross-tenant inspection has to flow
 * through an explicit, audited support/impersonation surface (Phase 10).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireCurrentUser("/login");

  const canAccess = await userHasSystemPermission(me.id, "system.admin.access");
  if (!canAccess) {
    redirect("/access-denied?reason=admin");
  }
  const codes = await getUserSystemRoleCodes(me.id);
  const primaryRole = codes[0] ?? "SYSTEM_USER";
  const envLabel = env.APP_ENV === "production" ? "production" : "development";

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]">
              <ShieldCheck className="size-4" />
            </span>
            <span>{appConfig.name} · System Admin</span>
          </Link>
          <Badge
            className={
              envLabel === "production"
                ? "border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }
          >
            {envLabel}
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            <Badge className="font-mono text-[10px]">{primaryRole}</Badge>
            <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
              {me.email}
            </span>
            <ThemeToggle />
            <SignOutButton variant="ghost" size="sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl">
        <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] md:block">
          <div className="sticky top-14">
            <AdminSidebar />
            <div className="border-t border-[var(--border)] p-3 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Full admin modules ship progressively. This console now
              mixes live operational modules with clearly-staged placeholders.
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile nav (stacked, scrollable horizontally) */}
          <div className="border-b border-[var(--border)] bg-[var(--card)] md:hidden">
            <div className="overflow-x-auto px-2 py-2">
              <AdminSidebar />
            </div>
          </div>
          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
