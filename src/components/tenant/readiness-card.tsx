import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  computeReadiness,
  getLatestReadiness,
  type ReadinessBand,
  type ReadinessSnapshot,
} from "@/server/ai-readiness";
import { recomputeReadinessAction } from "@/app/t/[tenantSlug]/contacts/actions";

const BAND_LABEL: Record<ReadinessBand, string> = {
  not_ready: "Not ready",
  basic: "Basic",
  good: "Good",
  excellent: "Excellent",
};

const BAND_TONE: Record<ReadinessBand, string> = {
  not_ready:
    "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  basic:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  good:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  excellent:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const COMPONENT_LABEL: Record<keyof ReadinessSnapshot["components"], string> = {
  businessProfile: "Business profile",
  catalog: "Catalog",
  contacts: "Contacts",
  businessBrain: "Business Brain",
};

export async function ReadinessCard({
  tenantId,
  tenantSlug,
  canWrite,
}: {
  tenantId: string;
  tenantSlug: string;
  canWrite: boolean;
}) {
  // Always compute live, but show last-persisted snapshot timestamp if any.
  const [snapshot, persisted] = await Promise.all([
    computeReadiness(tenantId),
    getLatestReadiness(tenantId),
  ]);

  return (
    <Card className="border-[color-mix(in_oklch,var(--primary)_25%,transparent)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">AI Readiness</CardTitle>
              <CardDescription>
                How prepared your workspace is for AI-grounded campaigns and
                replies.
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold leading-none">
              {snapshot.overallScore}
              <span className="text-sm font-normal text-[var(--muted-foreground)]">
                {" "}
                / 100
              </span>
            </div>
            <Badge className={`mt-1 border ${BAND_TONE[snapshot.bandLabel]}`}>
              {BAND_LABEL[snapshot.bandLabel]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {(
            Object.keys(snapshot.components) as Array<
              keyof ReadinessSnapshot["components"]
            >
          ).map((key) => {
            const value = snapshot.components[key];
            const pct = Math.max(0, Math.min(100, (value / 25) * 100));
            return (
              <li key={key} className="rounded-md border border-[var(--border)] p-2">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{COMPONENT_LABEL[key]}</span>
                  <span className="font-medium">{value}/25</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {snapshot.recommendations.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Next steps
            </h3>
            <ul className="space-y-1.5 text-sm">
              {snapshot.recommendations.slice(0, 4).map((r) => (
                <li
                  key={r.code}
                  className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2"
                >
                  <span className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                  <span>{r.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]">
          <span>
            {persisted
              ? `Last saved snapshot: ${persisted.computedAt
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 16)} UTC`
              : "No saved snapshot yet."}
          </span>
          {canWrite && (
            <form action={recomputeReadinessAction}>
              <input type="hidden" name="tenantSlug" value={tenantSlug} />
              <Button type="submit" size="sm" variant="outline">
                Recompute &amp; save
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
