import Link from "next/link";
import { Plus, Users } from "lucide-react";
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
import { listContacts, listTags } from "@/server/contacts";
import {
  createContactAction,
  createTagAction,
  deleteTagAction,
} from "./actions";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["none", "new", "warm", "hot", "customer"] as const;

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ q?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = (await searchParams) ?? {};
  const ctx = await requireTenantContext(tenantSlug);
  const search = sp.q?.trim() ?? "";

  const [rows, tags] = await Promise.all([
    listContacts(ctx.tenant.id, { search }),
    listTags(ctx.tenant.id),
  ]);

  const canWrite = ["owner", "admin", "agent"].includes(
    ctx.currentUserRole ?? "",
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Contacts" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            People and businesses in your audience. AI uses these to send
            campaigns and follow-ups, always with consent rules respected.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Search + create */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add contact</CardTitle>
            <CardDescription>
              Manual add. CSV import ships in a later tranche.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createContactAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Phone (E.164)
                </span>
                <input
                  name="phoneE164"
                  required
                  placeholder="+60123456789"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Full name
                </span>
                <input
                  name="fullName"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Email
                </span>
                <input
                  type="email"
                  name="email"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Lead status
                </span>
                <select
                  name="leadStatus"
                  defaultValue="none"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Notes
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={!canWrite}>
                  <Plus className="size-4" /> Add contact
                </Button>
                {!canWrite && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Read-only role — ask an owner/admin to add contacts.
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tags panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
            <CardDescription>
              Reusable labels for segmenting audiences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tags.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                No tags yet.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <li
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 text-xs"
                  >
                    <span>{t.name}</span>
                    {canWrite && (
                      <form action={deleteTagAction}>
                        <input
                          type="hidden"
                          name="tenantSlug"
                          value={ctx.tenant.slug}
                        />
                        <input type="hidden" name="tagId" value={t.id} />
                        <button
                          type="submit"
                          className="text-[var(--muted-foreground)] hover:text-red-500"
                          aria-label={`Delete tag ${t.name}`}
                          title="Delete tag"
                        >
                          ×
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form action={createTagAction} className="flex gap-2">
                <input
                  type="hidden"
                  name="tenantSlug"
                  value={ctx.tenant.slug}
                />
                <input
                  name="name"
                  required
                  placeholder="vip, lead, repeat…"
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                />
                <Button type="submit" size="sm" variant="outline">
                  Add tag
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <form
        method="get"
        className="mb-3 flex gap-2"
        action={`/t/${ctx.tenant.slug}/contacts`}
      >
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name, phone or email…"
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Users className="size-5" />
            </div>
            <CardTitle>
              {search ? "No matches" : "No contacts yet"}
            </CardTitle>
            <CardDescription>
              {search
                ? "Try a different search."
                : "Add your first contact above to start building an audience."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--muted)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Lead</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">{c.fullName ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.phoneE164}</td>
                  <td className="px-4 py-2 text-xs">{c.email ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    <Badge>{c.leadStatus}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c.status === "active" ? (
                      <span>active</span>
                    ) : (
                      <Badge>{c.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/t/${ctx.tenant.slug}/contacts/${c.id}`}
                      >
                        Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
