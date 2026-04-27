import Link from "next/link";
import { Inbox } from "lucide-react";
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
import { listConversations } from "@/server/inbox";

export const dynamic = "force-dynamic";

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default async function InboxPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const conversations = await listConversations(ctx.tenant.id, { limit: 200 });

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Inbox")}
        title="Inbox"
        description="Tenant-scoped conversations across WhatsApp. Identity is keyed on tenant and normalized phone number, ready to expand to other channels later."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversations</CardTitle>
          <CardDescription>
            {conversations.length === 0
              ? "No inbound or outbound messages yet for this tenant."
              : `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}, sorted by most recent activity.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Once your connected WhatsApp account starts sending and receiving
              messages, conversations will appear here grouped by phone number.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]/60">
              {conversations.map((c) => (
                <li key={c.normalizedPhone}>
                  <Link
                    href={`/t/${ctx.tenant.slug}/inbox/${encodeURIComponent(c.normalizedPhone)}`}
                    className="flex flex-wrap items-start justify-between gap-2 py-3 hover:bg-[var(--accent)]/40 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">
                          {c.contactName ?? c.normalizedPhone}
                        </span>
                        {c.contactName ? (
                          <span className="font-mono text-xs text-[var(--muted-foreground)]">
                            {c.normalizedPhone}
                          </span>
                        ) : null}
                        {c.contactLeadStatus &&
                        c.contactLeadStatus !== "none" ? (
                          <span className="rounded bg-[var(--muted)] px-1.5 py-px text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                            {c.contactLeadStatus}
                          </span>
                        ) : null}
                        <span className="rounded bg-[var(--muted)] px-1.5 py-px text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                          {c.channel}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-[var(--muted-foreground)]">
                        <span className="mr-1 text-[10px] uppercase tracking-wide">
                          {c.lastDirection === "inbound" ? "in" : "out"}
                        </span>
                        {c.lastMessagePreview ?? "(no message body)"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatRelative(c.lastActivityAt)}
                      </span>
                      <div className="flex gap-1 text-[10px] text-[var(--muted-foreground)]">
                        <span title="Inbound count">↘ {c.inboundCount}</span>
                        <span title="Outbound count">↗ {c.outboundCount}</span>
                        {c.awaitingReplyCount > 0 ? (
                          <span
                            title="Inbound after the latest outbound"
                            className="rounded bg-[var(--primary)]/15 px-1 font-medium text-[var(--foreground)]"
                          >
                            +{c.awaitingReplyCount} new
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </TenantPage>
  );
}
