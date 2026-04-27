import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Eye, Package, PencilLine, Sparkles } from "lucide-react";
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
import { getDb, schema } from "@/db/client";
import { requireTenantModuleEnabled } from "@/server/tenant-modules";
import { requireTenantContext } from "@/server/tenant-guard";
import { listActiveCurrencies, listActiveUnits } from "@/server/reference-data";
import { ProductEditorForm } from "./product-editor-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(currency: string | null, amount: string | null) {
  if (!amount) return "No default price";
  return `${currency ?? "MYR"} ${Number(amount).toFixed(2)}`;
}

function productReadiness(product: {
  categoryName: string | null;
  shortDescription: string | null;
  aiSellingNotes: string | null;
  aiFaqNotes: string | null;
  mediaUrl?: string | null;
}) {
  const missing: string[] = [];
  if (!product.categoryName) missing.push("category");
  if (!product.shortDescription) missing.push("summary");
  if (!product.aiSellingNotes) missing.push("AI selling notes");
  if (!product.aiFaqNotes) missing.push("AI FAQ notes");
  if (!product.mediaUrl) missing.push("image");
  return missing;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-700"
      : status === "draft"
        ? "bg-amber-100 text-amber-700"
        : status === "inactive"
          ? "bg-slate-200 text-slate-700"
          : "bg-rose-100 text-rose-700";
  return <Badge className={tone}>{status}</Badge>;
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { tenantSlug } = await params;
  const query = (await searchParams) ?? {};
  const ctx = await requireTenantContext(tenantSlug);
  await requireTenantModuleEnabled({
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    moduleCode: "products",
  });
  const db = getDb();
  const canWrite = ["owner", "admin"].includes(ctx.currentUserRole ?? "");
  const notice = firstValue(query.notice);
  const editId = firstValue(query.edit);
  const viewId = firstValue(query.view);

  const [rows, categories, currencies, units] = await Promise.all([
    db
      ? db
          .select({
            id: schema.products.id,
            productCode: schema.products.productCode,
            sku: schema.products.sku,
            name: schema.products.name,
            shortDescription: schema.products.shortDescription,
            longDescription: schema.products.longDescription,
            productType: schema.products.productType,
            status: schema.products.status,
            brand: schema.products.brand,
            defaultPrice: schema.products.defaultPrice,
            compareAtPrice: schema.products.compareAtPrice,
            currency: schema.products.currency,
            unitOfMeasure: schema.products.unitOfMeasure,
            trackInventory: schema.products.trackInventory,
            aiSellingNotes: schema.products.aiSellingNotes,
            aiFaqNotes: schema.products.aiFaqNotes,
            tags: schema.products.tags,
            taxCode: schema.products.taxCode,
            barcode: schema.products.barcode,
            categoryId: schema.products.categoryId,
            categoryName: schema.productCategories.name,
            updatedAt: schema.products.updatedAt,
          })
          .from(schema.products)
          .leftJoin(
            schema.productCategories,
            eq(schema.products.categoryId, schema.productCategories.id),
          )
          .where(eq(schema.products.tenantId, ctx.tenant.id))
          .orderBy(desc(schema.products.updatedAt))
          .limit(200)
      : [],
    db
      ? db
          .select({
            id: schema.productCategories.id,
            code: schema.productCategories.code,
            name: schema.productCategories.name,
          })
          .from(schema.productCategories)
          .where(eq(schema.productCategories.tenantId, ctx.tenant.id))
          .orderBy(desc(schema.productCategories.updatedAt))
      : [],
    listActiveCurrencies(),
    listActiveUnits(),
  ]);

  const selectedId = editId ?? viewId;
  const productIds = rows.map((product) => product.id);
  const mediaRows =
    db && productIds.length > 0
      ? await db
          .select({
            productId: schema.productMedia.productId,
            url: schema.productMedia.url,
            altText: schema.productMedia.altText,
          })
          .from(schema.productMedia)
          .where(inArray(schema.productMedia.productId, productIds))
          .orderBy(schema.productMedia.sortOrder)
      : [];
  const mediaByProduct = new Map<string, (typeof mediaRows)[number]>();
  for (const row of mediaRows) {
    if (!mediaByProduct.has(row.productId)) {
      mediaByProduct.set(row.productId, row);
    }
  }

  const selectedProduct = selectedId
    ? rows.find((product) => product.id === selectedId) ?? null
    : null;
  const selectedMediaRow = selectedId ? mediaByProduct.get(selectedId) ?? null : null;

  const initialValues = selectedProduct
    ? {
        productId: selectedProduct.id,
        tenantSlug: ctx.tenant.slug,
        categoryId: selectedProduct.categoryId ?? undefined,
        productCode: selectedProduct.productCode,
        sku: selectedProduct.sku ?? undefined,
        barcode: selectedProduct.barcode ?? undefined,
        name: selectedProduct.name,
        shortDescription: selectedProduct.shortDescription ?? undefined,
        longDescription: selectedProduct.longDescription ?? undefined,
        productType: selectedProduct.productType,
        status: selectedProduct.status,
        brand: selectedProduct.brand ?? undefined,
        defaultPrice: selectedProduct.defaultPrice ?? "",
        compareAtPrice: selectedProduct.compareAtPrice ?? undefined,
        currency: selectedProduct.currency,
        unitOfMeasure: selectedProduct.unitOfMeasure,
        mediaUrl: selectedMediaRow?.url ?? undefined,
        mediaAltText: selectedMediaRow?.altText ?? undefined,
        aiSellingNotes: selectedProduct.aiSellingNotes ?? undefined,
        aiFaqNotes: selectedProduct.aiFaqNotes ?? undefined,
        tags: Array.isArray(selectedProduct.tags)
          ? selectedProduct.tags.join(", ")
          : undefined,
        taxCode: selectedProduct.taxCode ?? undefined,
        trackInventory: selectedProduct.trackInventory,
      }
    : {
        tenantSlug: ctx.tenant.slug,
        productCode: "",
        name: "",
        productType: "physical",
        status: "draft",
        defaultPrice: "",
        currency: currencies[0]?.code ?? "MYR",
        unitOfMeasure: units[0]?.code ?? "pc",
        trackInventory: false,
      };

  const aiReadyCount = rows.filter(
    (product) => productReadiness({ ...product }).length === 0,
  ).length;

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Products")}
        title="Products"
        description="One product source of truth for humans, AI assistants, WhatsApp campaigns, landing pages, and future marketplace sync. Keep the form simple, but store enough detail so the system never has to guess."
      />

      {!canWrite ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You can view products, but only tenant owners and admins can change the product master.
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total products</CardDescription>
            <CardTitle className="text-3xl">{rows.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            All tenant-scoped products across physical, digital, bundle, and consumable types.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Categories</CardDescription>
            <CardTitle className="text-3xl">{categories.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Reusable product groups for catalog navigation, reporting, and future channel exports.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>AI-ready products</CardDescription>
            <CardTitle className="text-3xl">{aiReadyCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Sparkles className="size-4 text-[var(--foreground)]" />
            Products with category, summary, image, and AI guidance already filled in.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {rows.length === 0 ? (
            <Card>
              <CardHeader>
                <div className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                  <Package className="size-5" />
                </div>
                <CardTitle>No products yet</CardTitle>
                <CardDescription>
                  You have not added any products yet. Start by creating your first product with code, name, category, price, and AI notes.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product list</CardTitle>
                <CardDescription>
                  Edit the master record here first. Other modules should read from this source instead of duplicating product details.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-0">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--muted)]/60 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-5 py-3 text-left">Product</th>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-left">Type</th>
                      <th className="px-5 py-3 text-left">Price</th>
                      <th className="px-5 py-3 text-left">AI readiness</th>
                      <th className="px-5 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => {
                      const missing = productReadiness({
                        ...product,
                        mediaUrl: mediaByProduct.get(product.id)?.url ?? null,
                      });
                      return (
                        <tr key={product.id} className="border-t border-[var(--border)] align-top">
                          <td className="px-5 py-4">
                            <div className="font-medium text-[var(--foreground)]">{product.name}</div>
                            <div className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
                              {product.productCode}
                              {product.sku ? ` · ${product.sku}` : ""}
                            </div>
                            <div className="mt-2">
                              <StatusBadge status={product.status} />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-[var(--muted-foreground)]">
                            {product.categoryName ?? "Uncategorized"}
                          </td>
                          <td className="px-5 py-4 capitalize text-[var(--muted-foreground)]">
                            {product.productType}
                          </td>
                          <td className="px-5 py-4 text-[var(--muted-foreground)]">
                            {formatMoney(product.currency, product.defaultPrice)}
                          </td>
                          <td className="px-5 py-4">
                            {missing.length === 0 ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Ready
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                Missing {missing.slice(0, 2).join(", ")}
                                {missing.length > 2 ? "..." : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/t/${ctx.tenant.slug}/products?view=${product.id}`}>
                                  <Eye className="size-4" /> View
                                </Link>
                              </Button>
                              {canWrite ? (
                                <Button asChild size="sm">
                                  <Link href={`/t/${ctx.tenant.slug}/products?edit=${product.id}`}>
                                    <PencilLine className="size-4" /> Edit
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {selectedProduct ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product detail</CardTitle>
                <CardDescription>
                  Current source-of-truth values for {selectedProduct.name}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Master record</div>
                    <div className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                      <div>Code: {selectedProduct.productCode}</div>
                      <div>SKU: {selectedProduct.sku ?? "—"}</div>
                      <div>Category: {selectedProduct.categoryName ?? "Uncategorized"}</div>
                      <div>Type: {selectedProduct.productType}</div>
                      <div>Price: {formatMoney(selectedProduct.currency, selectedProduct.defaultPrice)}</div>
                      <div>Compare-at: {selectedProduct.compareAtPrice ? formatMoney(selectedProduct.currency, selectedProduct.compareAtPrice) : "—"}</div>
                      <div>Unit: {selectedProduct.unitOfMeasure}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Descriptions</div>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {selectedProduct.shortDescription ?? "No short description yet."}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {selectedProduct.longDescription ?? "No long description yet."}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">AI notes</div>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {selectedProduct.aiSellingNotes ?? "No AI selling notes yet."}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {selectedProduct.aiFaqNotes ?? "No AI FAQ notes yet."}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Media</div>
                    {selectedMediaRow?.url ? (
                      <a
                        href={selectedMediaRow.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-sm text-[var(--primary)] underline-offset-4 hover:underline"
                      >
                        {selectedMediaRow.url}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">No primary image yet.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div>
          {canWrite ? (
            <ProductEditorForm
              tenantSlug={ctx.tenant.slug}
              categories={categories}
              currencies={currencies.map((currency) => ({
                code: currency.code,
                name: currency.name,
              }))}
              units={units.map((unit) => ({ code: unit.code, name: unit.name }))}
              initialValues={initialValues}
            />
          ) : null}
        </div>
      </div>
    </TenantPage>
  );
}
