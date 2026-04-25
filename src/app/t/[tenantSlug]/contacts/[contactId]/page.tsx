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
import {
  getContact,
  listContactTagAssignments,
  listTags,
} from "@/server/contacts";
import {
  deleteContactAction,
  toggleTagAction,
  updateContactAction,
} from "../actions";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["none", "new", "warm", "hot", "customer"] as const;
const STATUSES = ["active", "unsubscribed", "blocked", "bounced"] as const;

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; contactId: string }>;
}) {
  const { tenantSlug, contactId } = await params;
  const ctx = await requireTenantContext(tenantSlug);

  const contact = await getContact(ctx.tenant.id, contactId);
  if (!contact) notFound();

  const [tags, assigned] = await Promise.all([
    listTags(ctx.tenant.id),
    listContactTagAssignments(ctx.tenant.id, contact.id),
  ]);
  const assignedIds = new Set(assigned.map((a) => a.tagId));

  const canWrite = ["owner", "admin", "agent"].includes(
    ctx.currentUserRole ?? "",
  );

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Contacts" />

      <Link
        href={`/t/${ctx.tenant.slug}/contacts`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4" /> Back to contacts
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {contact.fullName ?? contact.phoneE164}
          </h1>
          <p className="font-mono text-sm text-[var(--muted-foreground)]">
            {contact.phoneE164}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge>{contact.leadStatus}</Badge>
          <Badge>{contact.status}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit contact</CardTitle>
            <CardDescription>
              Source: {contact.source ?? "manual"} · Created{" "}
              {contact.createdAt.toISOString().slice(0, 10)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={updateContactAction}
              className="grid gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <input type="hidden" name="contactId" value={contact.id} />
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Phone (E.164)
                </span>
                <input
                  name="phoneE164"
                  required
                  defaultValue={contact.phoneE164}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Full name
                </span>
                <input
                  name="fullName"
                  defaultValue={contact.fullName ?? ""}
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
                  defaultValue={contact.email ?? ""}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  Lead status
                </span>
                <select
                  name="leadStatus"
                  defaultValue={contact.leadStatus}
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
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={contact.status}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
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
                  rows={3}
                  defaultValue={contact.notes ?? ""}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button type="submit" disabled={!canWrite}>
                  Save changes
                </Button>
              </div>
            </form>

            {canWrite && (
              <form
                action={deleteContactAction}
                className="mt-6 border-t border-[var(--border)] pt-4"
              >
                <input
                  type="hidden"
                  name="tenantSlug"
                  value={ctx.tenant.slug}
                />
                <input type="hidden" name="contactId" value={contact.id} />
                <Button
                  type="submit"
                  variant="outline"
                  className="text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="size-4" /> Delete contact
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
            <CardDescription>
              Toggle to add or remove a tag for this contact.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Create tags on the{" "}
                <Link
                  href={`/t/${ctx.tenant.slug}/contacts`}
                  className="underline"
                >
                  contacts page
                </Link>{" "}
                first.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {tags.map((t) => {
                  const on = assignedIds.has(t.id);
                  return (
                    <li key={t.id} className="flex items-center justify-between">
                      <span className="text-sm">{t.name}</span>
                      <form action={toggleTagAction}>
                        <input
                          type="hidden"
                          name="tenantSlug"
                          value={ctx.tenant.slug}
                        />
                        <input
                          type="hidden"
                          name="contactId"
                          value={contact.id}
                        />
                        <input type="hidden" name="tagId" value={t.id} />
                        <input
                          type="hidden"
                          name="mode"
                          value={on ? "remove" : "add"}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant={on ? "default" : "outline"}
                          disabled={!canWrite}
                        >
                          {on ? "Remove" : "Add"}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
