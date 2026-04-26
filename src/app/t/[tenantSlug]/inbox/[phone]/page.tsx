import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import {
  getConversation,
  getConversationTimeline,
} from "@/server/inbox";

export const dynamic = "force-dynamic";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; phone: string }>;
}) {
  const { tenantSlug, phone } = await params;
  const ctx = await requireTenantContext(tenantSlug);

  // The route segment is URL-encoded. The normalized phone in our schema
  // is E.164 (e.g. "+60123456789"); the leading "+" arrives encoded as
  // "%2B".
  const normalizedPhone = decodeURIComponent(phone);

  const [summary, events] = await Promise.all([
    getConversation(ctx.tenant.id, normalizedPhone),
    getConversationTimeline(ctx.tenant.id, normalizedPhone, { limit: 200 }),
  ]);

  if (!summary) {
    notFound();
  }

  // Render oldest → newest in the timeline so the latest reads at the
  // bottom (chat-like). The query returns newest-first; reverse here.
  const ordered = [...events].reverse();

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Inbox" />

      <div className="mb-4">
        <Link
          href={`/t/${ctx.tenant.slug}/inbox`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to inbox
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            {summary.contactName ?? summary.normalizedPhone}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{summary.normalizedPhone}</span>
            <span className="rounded bg-[var(--muted)] px-1.5 py-px text-[10px] uppercase tracking-wide">
              {summary.channel}
            </span>
            {summary.contactLeadStatus &&
            summary.contactLeadStatus !== "none" ? (
              <span className="rounded bg-[var(--muted)] px-1.5 py-px text-[10px] uppercase tracking-wide">
                {summary.contactLeadStatus}
              </span>
            ) : null}
            {summary.contactStatus ? (
              <span className="rounded bg-[var(--muted)] px-1.5 py-px text-[10px] uppercase tracking-wide">
                {summary.contactStatus}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-[var(--muted-foreground)]">
          <div className="flex flex-wrap gap-3">
            <span>Inbound: {summary.inboundCount}</span>
            <span>Outbound: {summary.outboundCount}</span>
            {summary.awaitingReplyCount > 0 ? (
              <span className="font-medium text-[var(--foreground)]">
                Awaiting reply: {summary.awaitingReplyCount}
              </span>
            ) : null}
            {summary.contactId ? (
              <Link
                href={`/t/${ctx.tenant.slug}/contacts/${summary.contactId}`}
                className="underline-offset-2 hover:underline"
              >
                Open contact
              </Link>
            ) : (
              <span>Not linked to a contact yet</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
          <CardDescription>
            Read-only merged view of inbound messages and outbound queue
            entries (excluding OTPs). Most recent at the bottom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              No messages on file for this number yet.
            </p>
          ) : (
            <ol className="space-y-3">
              {ordered.map((e) => {
                const isInbound = e.direction === "inbound";
                return (
                  <li
                    key={`${e.direction}-${e.id}`}
                    className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isInbound
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--primary)]/15"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                        <span>{isInbound ? "Inbound" : "Outbound"}</span>
                        <span>·</span>
                        <span>{e.occurredAt.toLocaleString()}</span>
                        {e.purpose ? (
                          <>
                            <span>·</span>
                            <span>{e.purpose}</span>
                          </>
                        ) : null}
                        {e.status ? (
                          <>
                            <span>·</span>
                            <span>{e.status}</span>
                          </>
                        ) : null}
                        {e.intent ? (
                          <>
                            <span>·</span>
                            <span>intent: {e.intent}</span>
                          </>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap break-words">
                        {e.bodyText ?? "(no body)"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
