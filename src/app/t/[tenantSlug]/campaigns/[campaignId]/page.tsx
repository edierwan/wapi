import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { eq } from "drizzle-orm";
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
import { requireDb, schema } from "@/db/client";
import {
  getCampaign,
  listVariants,
  previewAudience,
  recipientStats,
  getLatestSafetyReview,
  type AudienceFilter,
} from "@/server/campaigns";
import { listTags } from "@/server/contacts";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  deleteVariantAction,
  runSafetyReviewAction,
  scheduleCampaignAction,
  suggestVariantAction,
  updateCampaignAction,
  upsertVariantAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CampaignDetail({
  params,
}: {
  params: Promise<{ tenantSlug: string; campaignId: string }>;
}) {
  const { tenantSlug, campaignId } = await params;
  const ctx = await requireTenantContext(tenantSlug);

  const campaign = await getCampaign(ctx.tenant.id, campaignId);
  if (!campaign) notFound();

  const [variants, tags, latestReview, stats] = await Promise.all([
    listVariants(ctx.tenant.id, campaign.id),
    listTags(ctx.tenant.id),
    getLatestSafetyReview(ctx.tenant.id, campaign.id),
    recipientStats(ctx.tenant.id, campaign.id),
  ]);

  const filter = (campaign.audienceFilter as AudienceFilter | null) ?? {};
  const audience = await previewAudience(ctx.tenant.id, filter);

  // Tenant-scoped accounts for sending. The dropdown below is intentionally
  // simple; future channels will appear here once their account tables exist.
  const db = requireDb();
  const accounts = await db
    .select({
      id: schema.connectedAccounts.id,
      displayName: schema.connectedAccounts.displayName,
      phoneNumber: schema.connectedAccounts.phoneNumber,
      isActive: schema.connectedAccounts.isActive,
    })
    .from(schema.connectedAccounts)
    .where(eq(schema.connectedAccounts.tenantId, ctx.tenant.id));

  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");
  const isFinal = ["completed", "cancelled", "failed"].includes(campaign.status);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Campaigns" />

      <div className="mb-2">
        <Link
          href={`/t/${ctx.tenant.slug}/campaigns`}
          className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:underline"
        >
          <ArrowLeft className="size-3" />
          Back to campaigns
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Updated {new Date(campaign.updatedAt).toLocaleString()}
          </p>
        </div>
        <Badge>{campaign.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings + audience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings & audience</CardTitle>
            <CardDescription>
              Audience filters use any-of semantics. All filters are tenant-scoped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCampaignAction} className="grid gap-3 text-sm">
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <input type="hidden" name="campaignId" value={campaign.id} />
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Name
                </span>
                <input
                  name="name"
                  defaultValue={campaign.name}
                  required
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Objective
                  </span>
                  <select
                    name="objective"
                    defaultValue={campaign.objective ?? "promo"}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  >
                    <option value="promo">Promo</option>
                    <option value="event">Event</option>
                    <option value="re_engage">Re-engage</option>
                    <option value="survey">Survey</option>
                    <option value="followup">Follow-up</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Send mode
                  </span>
                  <select
                    name="sendMode"
                    defaultValue={campaign.sendMode}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  >
                    <option value="standard">Standard</option>
                    <option value="reply_first">Reply-first</option>
                  </select>
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Tag IDs (any-of, comma-separated)
                </span>
                <input
                  name="audienceTagIds"
                  defaultValue={(filter.tagIds ?? []).join(",")}
                  placeholder="leave empty to skip tag filter"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                />
                {tags.length > 0 ? (
                  <span className="mt-1 block text-[10px] text-[var(--muted-foreground)]">
                    Available tags:{" "}
                    {tags.map((t) => `${t.name}=${t.id.slice(0, 8)}…`).join(" · ")}
                  </span>
                ) : null}
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Lead statuses (any-of)
                  </span>
                  <input
                    name="audienceLeadStatuses"
                    defaultValue={(filter.leadStatuses ?? []).join(",")}
                    placeholder="warm,hot,customer"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Contact statuses (any-of)
                  </span>
                  <input
                    name="audienceStatuses"
                    defaultValue={(filter.statuses ?? ["active"]).join(",")}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Scheduled at (optional ISO)
                </span>
                <input
                  name="scheduledAt"
                  defaultValue={
                    campaign.scheduledAt
                      ? new Date(campaign.scheduledAt).toISOString()
                      : ""
                  }
                  placeholder="2026-05-01T09:00:00Z"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                />
              </label>
              {canWrite && !isFinal ? (
                <Button type="submit" variant="outline" size="sm">
                  Save settings
                </Button>
              ) : null}
            </form>

            <div className="mt-4 rounded-md border border-[var(--border)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">Audience preview</span>
                <Badge>{audience.total} contacts</Badge>
              </div>
              {audience.sample.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {audience.sample.slice(0, 8).map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between gap-2 text-[var(--muted-foreground)]"
                    >
                      <span className="truncate">{c.fullName ?? "—"}</span>
                      <span className="font-mono">{c.phoneE164}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[var(--muted-foreground)]">
                  No matching contacts. Adjust filters above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Variants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Message variants</CardTitle>
            <CardDescription>
              Recipients are split across variants by relative weight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No variants yet. Add at least one before scheduling.
              </p>
            ) : (
              <ul className="space-y-3">
                {variants.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-md border border-[var(--border)] p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {v.label}{" "}
                        <span className="text-xs text-[var(--muted-foreground)]">
                          weight {v.weight}
                          {v.languageCode ? ` · ${v.languageCode}` : ""}
                          {v.isAiGenerated ? " · AI draft" : ""}
                        </span>
                      </span>
                      {canWrite && !isFinal ? (
                        <form action={deleteVariantAction}>
                          <input
                            type="hidden"
                            name="tenantSlug"
                            value={ctx.tenant.slug}
                          />
                          <input type="hidden" name="campaignId" value={campaign.id} />
                          <input type="hidden" name="variantId" value={v.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete variant"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-[var(--muted-foreground)]">
                      {v.bodyText}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {canWrite && !isFinal ? (
              <form action={upsertVariantAction} className="grid gap-2 text-sm">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <div className="grid gap-2 sm:grid-cols-[80px_1fr_120px]">
                  <input
                    name="label"
                    required
                    placeholder="A"
                    maxLength={8}
                    defaultValue={String.fromCharCode(65 + variants.length)}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                  <input
                    name="languageCode"
                    placeholder="en / ms / zh"
                    maxLength={8}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                  <input
                    name="weight"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={1}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </div>
                <textarea
                  name="bodyText"
                  required
                  rows={4}
                  maxLength={2000}
                  placeholder="Hi {{first_name}}, our Eid promo … Reply STOP to opt out."
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
                <Button type="submit" size="sm" variant="outline">
                  Add variant
                </Button>
              </form>
            ) : null}

            {canWrite && !isFinal ? (
              <form
                action={suggestVariantAction}
                className="mt-3 grid gap-2 rounded-md border border-dashed border-[var(--border)] p-3 text-sm"
              >
                <div className="text-xs text-[var(--muted-foreground)]">
                  AI variant suggestion (Dify, HITL). Saves a draft variant
                  flagged <code>is_ai_generated</code>; review or delete
                  before scheduling.
                </div>
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <textarea
                  name="prompt"
                  rows={2}
                  maxLength={1000}
                  placeholder="Optional steering, e.g. 'Friendly, focus on free shipping, in Bahasa Malaysia.'"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
                <Button type="submit" size="sm" variant="outline">
                  Suggest variant via AI
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Safety + schedule */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Safety review</CardTitle>
            <CardDescription>
              Internal pre-send check. Re-run after each variant edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {latestReview ? (
              <div className="rounded-md border border-[var(--border)] p-3">
                <div className="flex items-center justify-between">
                  <Badge>{latestReview.overallStatus}</Badge>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {new Date(latestReview.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2">{latestReview.summaryText}</p>
                {Array.isArray(latestReview.checks) &&
                latestReview.checks.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                    {(latestReview.checks as Array<Record<string, unknown>>).map(
                      (f, i) => (
                        <li key={i}>
                          <span className="font-mono">{String(f.code)}</span>{" "}
                          [{String(f.status)}] {String(f.message)}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-[var(--muted-foreground)]">
                No safety review yet.
              </p>
            )}
            {canWrite && !isFinal ? (
              <form action={runSafetyReviewAction}>
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" size="sm" variant="outline">
                  Run safety review
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
            <CardDescription>
              Live counts from <code className="font-mono text-xs">campaign_recipients</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {stats.total === 0 ? (
              <p className="text-[var(--muted-foreground)]">
                No recipients materialized yet.
              </p>
            ) : (
              (() => {
                const map = new Map<string, number>();
                for (const r of stats.byStatus) map.set(r.status, Number(r.count));
                const get = (k: string) => map.get(k) ?? 0;
                const total = stats.total;
                const sentish = get("sent") + get("delivered") + get("read") + get("replied");
                const pct = (n: number) =>
                  total === 0 ? "0%" : `${Math.round((n / total) * 1000) / 10}%`;
                const cells: { label: string; value: number; rate: string }[] = [
                  { label: "Pending", value: get("pending"), rate: pct(get("pending")) },
                  { label: "Sent", value: get("sent"), rate: pct(get("sent")) },
                  { label: "Delivered", value: get("delivered"), rate: pct(get("delivered")) },
                  { label: "Read", value: get("read"), rate: pct(get("read")) },
                  { label: "Replied", value: get("replied"), rate: pct(get("replied")) },
                  { label: "Failed", value: get("failed"), rate: pct(get("failed")) },
                  { label: "Excluded", value: get("excluded"), rate: pct(get("excluded")) },
                ];
                const reachRate = pct(sentish);
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {cells.map((c) => (
                        <div
                          key={c.label}
                          className="rounded-md border border-[var(--border)] p-2"
                        >
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {c.label}
                          </div>
                          <div className="text-lg font-semibold">{c.value}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {c.rate}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Total: {total} · Reach (sent+delivered+read+replied): {reachRate}
                    </p>
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedule & dispatch</CardTitle>
            <CardDescription>
              Materializes recipients and queues messages with{" "}
              <code className="font-mono text-xs">purpose=campaign</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-[var(--muted-foreground)]">
              Queued: {stats.total}.{" "}
              {stats.byStatus
                .map((s) => `${s.status}:${s.count}`)
                .join(" · ") || "no recipients yet"}
            </p>

            {accounts.length === 0 ? (
              <p className="text-[var(--muted-foreground)]">
                No connected accounts. Add one in WhatsApp settings.
              </p>
            ) : null}

            {canWrite &&
            !isFinal &&
            campaign.status !== "scheduled" &&
            campaign.status !== "sending" ? (
              <form action={scheduleCampaignAction} className="grid gap-2">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Account
                  </span>
                  <select
                    name="accountId"
                    required
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName} {a.phoneNumber ? `(${a.phoneNumber})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Send at (ISO; blank = now)
                  </span>
                  <input
                    name="scheduledAt"
                    defaultValue={
                      campaign.scheduledAt
                        ? new Date(campaign.scheduledAt).toISOString()
                        : ""
                    }
                    placeholder="2026-05-01T09:00:00Z"
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
                  />
                </label>
                <Button type="submit" size="sm">
                  Schedule and queue
                </Button>
              </form>
            ) : null}

            {canWrite &&
            (campaign.status === "scheduled" ||
              campaign.status === "sending" ||
              campaign.status === "paused") ? (
              <form action={cancelCampaignAction}>
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" size="sm" variant="outline">
                  Cancel campaign
                </Button>
              </form>
            ) : null}

            {canWrite && campaign.status === "draft" ? (
              <form action={deleteCampaignAction}>
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="campaignId" value={campaign.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Delete draft
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
