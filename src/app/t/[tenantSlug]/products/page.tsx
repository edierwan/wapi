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
import { createProductAction } from "../_catalog-actions";

export const dynamic = "force-dynamic";

const PRODUCT_TYPES = [
  "physical",
  "digital",
  "bundle",
  "consumable",
  "other",
] as const;

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
        .limit(100)
    : [];

  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Products" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Master data for every physical, digital, or bundle product.
          AI reads this when a customer asks about price or availability.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Add product</CardTitle>
          <CardDescription>
            Minimal create flow. Variants, media, and inventory ship later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProductAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Code
              </span>
              <input
                name="productCode"
                required
                placeholder="SKU-0001"
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
                name="productType"
                defaultValue="physical"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Default price
              </span>
              <input
                name="defaultPrice"
                inputMode="decimal"
                placeholder="49.90"
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
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                Unit
              </span>
              <input
                name="unitOfMeasure"
                defaultValue="pc"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={!canWrite}>
                <Plus className="size-4" /> Add product
              </Button>
              {!canWrite && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Only owners/admins can add products.
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
              <Package className="size-5" />
            </div>
            <CardTitle>No products yet</CardTitle>
            <CardDescription>
              Add your first product above. AI will use it for pricing and
              availability questions.
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
                  <td className="px-4 py-2 text-xs">
                    <Badge>{p.status}</Badge>
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
