import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import { listSequences } from "@/server/followups";
import { createSequenceAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function FollowupsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const sequences = await listSequences(ctx.tenant.id);
  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Campaigns" />

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Follow-up sequences
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Trigger-driven message chains. The dispatcher and runtime executor
            land in a later tranche; UI is wired now so you can prepare content.
          </p>
        </div>
        <Link
          href={`/t/${ctx.tenant.slug}/campaigns`}
          className="text-xs underline"
        >
          Back to campaigns
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All sequences</CardTitle>
          </CardHeader>
          <CardContent>
            {sequences.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No sequences yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {sequences.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <Link
                        href={`/t/${ctx.tenant.slug}/followups/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Trigger: {s.triggerType}
                      </p>
                    </div>
                    <Badge>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New sequence</CardTitle>
              <CardDescription>Tenant-scoped.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createSequenceAction} className="grid gap-3 text-sm">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Name
                  </span>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="No-reply nudge"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Trigger
                  </span>
                  <select
                    name="triggerType"
                    defaultValue="no_reply"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  >
                    <option value="no_reply">No reply</option>
                    <option value="hot_lead">Hot lead</option>
                    <option value="new_contact">New contact</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <Button type="submit">
                  <Plus className="size-4" />
                  Create sequence
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
