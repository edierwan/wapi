import { Brain, Plus } from "lucide-react";
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
import {
  MEMORY_KINDS,
  MEMORY_KIND_LABEL,
  type MemoryKind,
  listMemoryItems,
} from "@/server/business-memory";
import {
  createMemoryAction,
  deleteMemoryAction,
  updateMemoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function BusinessBrainPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const items = await listMemoryItems(ctx.tenant.id);

  const canWrite = ["owner", "admin", "agent"].includes(
    ctx.currentUserRole ?? "",
  );

  // Group by kind for display.
  const grouped = new Map<MemoryKind, typeof items>();
  for (const k of MEMORY_KINDS) grouped.set(k, []);
  for (const it of items) {
    const k = it.kind as MemoryKind;
    if (grouped.has(k)) grouped.get(k)!.push(it);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Brain" />

      <div className="mb-6 flex items-start gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
          <Brain className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Business Brain
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Facts, FAQs, policies, brand voice and offers your AI uses to
            ground every reply and campaign. Stored per tenant; never shared
            across workspaces.
          </p>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Add a memory item</CardTitle>
          <CardDescription>
            Short, factual entries beat long essays. AI weights items by the
            value below (0–10).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createMemoryAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Kind
              </span>
              <select
                name="kind"
                defaultValue="faq"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {MEMORY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {MEMORY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Title
              </span>
              <input
                name="title"
                required
                placeholder="What are your operating hours?"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Body
              </span>
              <textarea
                name="body"
                required
                rows={4}
                placeholder="Mon–Fri 9am–6pm, closed on public holidays."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Weight
              </span>
              <input
                name="weight"
                type="number"
                min={0}
                max={10}
                defaultValue={1}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!canWrite}>
                <Plus className="size-4" /> Save entry
              </Button>
              {!canWrite && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Read-only role.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Empty Business Brain</CardTitle>
            <CardDescription>
              Start with one FAQ and one brand note. Score climbs as kinds
              expand.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8">
          {MEMORY_KINDS.map((kind) => {
            const list = grouped.get(kind) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={kind}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {MEMORY_KIND_LABEL[kind]}
                  <span className="text-xs font-normal normal-case">
                    ({list.length})
                  </span>
                </h2>
                <div className="grid gap-3">
                  {list.map((it) => (
                    <Card key={it.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">
                              {it.title}
                            </CardTitle>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                              <Badge>{MEMORY_KIND_LABEL[kind]}</Badge>
                              <Badge>weight {it.weight}</Badge>
                              <Badge>{it.status}</Badge>
                              <span>
                                · updated{" "}
                                {it.updatedAt.toISOString().slice(0, 10)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <details>
                          <summary className="cursor-pointer text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                            View / edit
                          </summary>
                          <form
                            action={updateMemoryAction}
                            className="mt-3 grid gap-3 sm:grid-cols-3"
                          >
                            <input
                              type="hidden"
                              name="tenantSlug"
                              value={ctx.tenant.slug}
                            />
                            <input
                              type="hidden"
                              name="itemId"
                              value={it.id}
                            />
                            <label className="text-sm">
                              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                Kind
                              </span>
                              <select
                                name="kind"
                                defaultValue={it.kind}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              >
                                {MEMORY_KINDS.map((k) => (
                                  <option key={k} value={k}>
                                    {MEMORY_KIND_LABEL[k]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-sm sm:col-span-2">
                              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                Title
                              </span>
                              <input
                                name="title"
                                required
                                defaultValue={it.title}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="text-sm sm:col-span-3">
                              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                Body
                              </span>
                              <textarea
                                name="body"
                                required
                                rows={4}
                                defaultValue={it.body}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="text-sm">
                              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                Weight
                              </span>
                              <input
                                name="weight"
                                type="number"
                                min={0}
                                max={10}
                                defaultValue={it.weight}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="text-sm">
                              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                Status
                              </span>
                              <select
                                name="status"
                                defaultValue={it.status}
                                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                              >
                                <option value="active">active</option>
                                <option value="archived">archived</option>
                              </select>
                            </label>
                            <div className="sm:col-span-3 flex flex-wrap gap-2">
                              <Button type="submit" disabled={!canWrite}>
                                Save
                              </Button>
                            </div>
                          </form>

                          {canWrite && (
                            <form
                              action={deleteMemoryAction}
                              className="mt-3 border-t border-[var(--border)] pt-3"
                            >
                              <input
                                type="hidden"
                                name="tenantSlug"
                                value={ctx.tenant.slug}
                              />
                              <input
                                type="hidden"
                                name="itemId"
                                value={it.id}
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-500/10"
                              >
                                Delete
                              </Button>
                            </form>
                          )}
                        </details>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
