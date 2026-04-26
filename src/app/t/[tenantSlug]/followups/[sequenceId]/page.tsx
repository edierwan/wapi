import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
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
import { getSequence, listSteps } from "@/server/followups";
import {
  deleteSequenceAction,
  deleteStepAction,
  updateSequenceAction,
  upsertStepAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SequenceDetail({
  params,
}: {
  params: Promise<{ tenantSlug: string; sequenceId: string }>;
}) {
  const { tenantSlug, sequenceId } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const sequence = await getSequence(ctx.tenant.id, sequenceId);
  if (!sequence) notFound();
  const steps = await listSteps(ctx.tenant.id, sequence.id);
  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Campaigns" />

      <div className="mb-2">
        <Link
          href={`/t/${ctx.tenant.slug}/followups`}
          className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:underline"
        >
          <ArrowLeft className="size-3" />
          All sequences
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sequence.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Trigger: {sequence.triggerType}
          </p>
        </div>
        <Badge>{sequence.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateSequenceAction} className="grid gap-3 text-sm">
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <input type="hidden" name="sequenceId" value={sequence.id} />
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Name
                </span>
                <input
                  name="name"
                  defaultValue={sequence.name}
                  required
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Trigger
                </span>
                <select
                  name="triggerType"
                  defaultValue={sequence.triggerType}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="no_reply">No reply</option>
                  <option value="hot_lead">Hot lead</option>
                  <option value="new_contact">New contact</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={sequence.status}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              {canWrite ? (
                <Button type="submit" variant="outline" size="sm">
                  Save
                </Button>
              ) : null}
            </form>
            {canWrite ? (
              <form action={deleteSequenceAction} className="mt-3">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="sequenceId" value={sequence.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Delete sequence
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Steps</CardTitle>
            <CardDescription>
              Step order is per-sequence. Delay is hours after the previous step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {steps.length === 0 ? (
              <p className="text-[var(--muted-foreground)]">No steps yet.</p>
            ) : (
              <ul className="space-y-2">
                {steps.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                      <span>
                        Step {s.stepOrder} · +{s.delayHours}h
                      </span>
                      {canWrite ? (
                        <form action={deleteStepAction}>
                          <input
                            type="hidden"
                            name="tenantSlug"
                            value={ctx.tenant.slug}
                          />
                          <input
                            type="hidden"
                            name="sequenceId"
                            value={sequence.id}
                          />
                          <input type="hidden" name="stepId" value={s.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            aria-label="Delete step"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">
                      {s.bodyText ?? (
                        <span className="italic text-[var(--muted-foreground)]">
                          AI will draft at run time
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <form action={upsertStepAction} className="grid gap-2">
                <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                <input type="hidden" name="sequenceId" value={sequence.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Order
                    </span>
                    <input
                      name="stepOrder"
                      type="number"
                      min={1}
                      max={50}
                      required
                      defaultValue={steps.length + 1}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      Delay hours
                    </span>
                    <input
                      name="delayHours"
                      type="number"
                      min={0}
                      max={720}
                      required
                      defaultValue={24}
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    />
                  </label>
                </div>
                <textarea
                  name="bodyText"
                  rows={3}
                  maxLength={2000}
                  placeholder="Optional. Leave blank to draft via AI at run time."
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
                <Button type="submit" variant="outline" size="sm">
                  Add step
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
