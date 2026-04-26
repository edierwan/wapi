import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/server/auth";
import { getUserSystemRoleCodes } from "@/server/permissions";
import { ADMIN_NAV } from "./_nav";

export const dynamic = "force-dynamic";

/**
 * /admin overview dashboard.
 *
 * The layout has already done auth + RBAC, so this page can render the
 * welcome chrome plus the navigation tiles.
 *
 * Tiles are derived from the same `ADMIN_NAV` list the sidebar uses, so
 * the two views never drift.
 */
export default async function AdminOverviewPage() {
  const me = (await getCurrentUser())!;
  const codes = await getUserSystemRoleCodes(me.id);

  // Skip the "Overview" entry — that's the page we're on.
  const tiles = ADMIN_NAV.filter((n) => n.href !== "/admin");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {me.name || me.email.split("@")[0]}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your system roles:{" "}
          {codes.length ? (
            codes.map((c) => (
              <Badge key={c} className="mr-1 font-mono text-xs">
                {c}
              </Badge>
            ))
          ) : (
            <em>none</em>
          )}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Use the sidebar to jump to a module. Tiles below mirror the
          sidebar so you can scan from one screen. The admin console is
          now partially operational: shipped modules show <em>Ready</em>,
          while later tranches remain explicitly staged.
        </p>
      </header>

      <section
        aria-label="Admin modules"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="block rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <Card className="h-full transition hover:border-[var(--primary)]/40">
                <CardHeader>
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-base">
                    {t.label}
                    {t.status === "placeholder" ? (
                      <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)]">
                        Coming soon
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Ready
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-[var(--muted-foreground)]">
                  Open module →
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
