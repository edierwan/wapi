import { eq } from "drizzle-orm";
import { Plus, Package } from "lucide-react";
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

export default async function ProductsPage({
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
        .from(schema.products)
        .where(eq(schema.products.tenantId, ctx.tenant.id))
        .limit(50)
    : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Products" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Master data for every physical, digital, or bundle product.
            AI reads this when a customer asks about price or availability.
          </p>
        </div>
        <Button disabled title="Product editor ships in Phase 4">
          <Plus className="size-4" /> Add product
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Package className="size-5" />
            </div>
            <CardTitle>No products yet</CardTitle>
            <CardDescription>
              Phase 3 ships the schema (products, variants, price lists,
              categories, media). Phase 4 ships the editor UI and media upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            You can still insert rows via SQL for testing. The AI layer (Phase 5+)
            will already read whatever is in these tables.
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
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs">{p.productCode}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-xs capitalize">{p.productType}</td>
                  <td className="px-4 py-2 text-right">
                    {p.defaultPrice
                      ? `${p.currency} ${Number(p.defaultPrice).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge className="capitalize">{p.status}</Badge>
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
