import { eq } from "drizzle-orm";
import { Plus, Wrench } from "lucide-react";
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
import { requireTenantModuleEnabled } from "@/server/tenant-modules";
import { getDb, schema } from "@/db/client";
import { createServiceAction } from "../_catalog-actions";

export const dynamic = "force-dynamic";

const SERVICE_TYPES = [
  "consultation",
  "appointment",
  "package",
  "subscription",
  "repair",
  "delivery",
  "other",
] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  await requireTenantModuleEnabled({
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    moduleCode: "services",
  });
  const db = getDb();
  const rows = db
    ? await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.tenantId, ctx.tenant.id))
        .limit(100)
    : [];

  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Services")}
        title="Services"
        description="Appointments, consultations, repairs, subscription packages. Each row can carry duration and booking requirements."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add service</CardTitle>
          <CardDescription>
            Minimal create flow. Packages and availability slots ship later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createServiceAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Code
              </span>
              <input
                name="serviceCode"
                required
                placeholder="SVC-0001"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Name
              </span>
              <input
                name="name"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-3">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Short description
              </span>
              <input
                name="shortDescription"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Type
              </span>
              <select
                name="serviceType"
                defaultValue="consultation"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Duration (min)
              </span>
              <input
                name="durationMinutes"
                type="number"
                min={0}
                placeholder="30"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Default price
              </span>
              <input
                name="defaultPrice"
                inputMode="decimal"
                placeholder="120.00"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Currency
              </span>
              <input
                name="currency"
                defaultValue={"MYR"}
                maxLength={3}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm uppercase"
              />
            </label>
            <label className="text-sm flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                name="requiresBooking"
                className="size-4"
              />
              <span>Requires booking</span>
            </label>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!canWrite}>
                <Plus className="size-4" /> Add service
              </Button>
              {!canWrite && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Only owners/admins can add services.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Wrench className="size-5" />
            </div>
            <CardTitle>No services yet</CardTitle>
            <CardDescription>
              Add your first service above. AI will use it when customers ask
              about availability or duration.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--muted)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Duration</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-left">Booking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs">{s.serviceCode}</td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-xs capitalize">{s.serviceType}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {s.durationMinutes ? `${s.durationMinutes} min` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.defaultPrice
                      ? `${s.currency} ${Number(s.defaultPrice).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {s.requiresBooking ? <Badge>required</Badge> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TenantPage>
  );
}
