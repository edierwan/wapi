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
import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import { getDb, schema } from "@/db/client";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const db = getDb();
  const rows = db
    ? await db
        .select()
        .from(schema.services)
        .where(eq(schema.services.tenantId, ctx.tenant.id))
        .limit(50)
    : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Services" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Appointments, consultations, repairs, subscription packages. Each
            row can carry duration, booking, and deposit requirements.
          </p>
        </div>
        <Button disabled title="Service editor ships in Phase 4">
          <Plus className="size-4" /> Add service
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Wrench className="size-5" />
            </div>
            <CardTitle>No services yet</CardTitle>
            <CardDescription>
              Phase 3 ships the schema (services, service_categories,
              service_packages, service_package_items, service_availability).
              Phase 4 ships the editor UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            You can seed rows via SQL for testing. AI and the future booking
            module will read directly from these tables.
          </CardContent>
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
    </section>
  );
}
