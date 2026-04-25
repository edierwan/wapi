import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { findNavItem } from "@/app/admin/_nav";

/**
 * Reusable shell for `/admin/*` placeholder modules.
 *
 * Renders the page title, description, a "Coming soon" badge, a short
 * paragraph explaining why the module is a placeholder, and a link back
 * to the overview.
 *
 * Pass `href` so the shell can fish the right metadata from `ADMIN_NAV`.
 * Pass `body` for any additional inline note (e.g. "depends on Phase 6").
 */
export function AdminPlaceholder({
  href,
  body,
}: {
  href: string;
  body?: React.ReactNode;
}) {
  const nav = findNavItem(href);
  const Icon = nav?.icon;
  const title = nav?.label ?? href;
  const description = nav?.description ?? "";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="inline-flex size-9 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Icon className="size-5" />
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)]">
            Coming soon
          </Badge>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module not yet shipped</CardTitle>
          <CardDescription>
            This page is a placeholder. The data model is in place for most
            modules, but the operational UI lands in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[var(--muted-foreground)]">
          {body ?? (
            <p>
              Track progress in the project roadmap. Every module here is
              gated behind the same <code>system.admin.access</code>{" "}
              permission, so once a module ships its access control is
              already wired.
            </p>
          )}
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">← Back to overview</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
