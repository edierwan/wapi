import Link from "next/link";
import { MessagesSquare, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantPageSectionLabel } from "@/components/tenant/tenant-nav-items";
import { TenantPage, TenantPageHeader } from "@/components/tenant/tenant-page";
import { requireTenantContext } from "@/server/tenant-guard";
import { listCampaigns } from "@/server/campaigns";
import { createCampaignAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const campaigns = await listCampaigns(ctx.tenant.id);
  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Campaigns")}
        title="Campaigns"
        description="Plan a message, draft variants, run safety review, then schedule. Sends go through the same outbound queue as everything else, with consent and tenant rules enforced."
        actions={
          <Link
            href={`/t/${ctx.tenant.slug}/followups`}
            className="text-xs underline underline-offset-2"
          >
            Follow-up sequences →
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All campaigns</CardTitle>
            <CardDescription>
              Tenant-scoped. Drafts only count once you add a variant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No campaigns yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/t/${ctx.tenant.slug}/campaigns/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {(c.objective ?? "—")} · updated{" "}
                        {new Date(c.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {canWrite ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New campaign</CardTitle>
              <CardDescription>Starts as a draft.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createCampaignAction} className="grid gap-3">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Name
                  </span>
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Eid promo April"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Objective
                  </span>
                  <select
                    name="objective"
                    defaultValue="promo"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="promo">Promo</option>
                    <option value="event">Event</option>
                    <option value="re_engage">Re-engage</option>
                    <option value="survey">Survey</option>
                    <option value="followup">Follow-up</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Send mode
                  </span>
                  <select
                    name="sendMode"
                    defaultValue="standard"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="standard">Standard (one-off blast)</option>
                    <option value="reply_first">Reply-first (await prior reply)</option>
                  </select>
                </label>
                <Button type="submit">
                  <Plus className="size-4" />
                  Create draft
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">View only</CardTitle>
              <CardDescription>
                Only owner and admin can create or edit campaigns in this
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted-foreground)]">
              <MessagesSquare className="size-4" />
            </CardContent>
          </Card>
        )}
      </div>
    </TenantPage>
  );
}
