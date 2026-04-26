"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireDb, schema } from "@/db/client";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";

const writeRoles = new Set(["owner", "admin"]);

type ProductValues = {
  productId?: string;
  tenantSlug: string;
  categoryId?: string;
  newCategoryName?: string;
  productCode: string;
  sku?: string;
  barcode?: string;
  name: string;
  shortDescription?: string;
  longDescription?: string;
  productType: string;
  status: string;
  brand?: string;
  defaultPrice: string;
  compareAtPrice?: string;
  currency: string;
  unitOfMeasure: string;
  mediaUrl?: string;
  mediaAltText?: string;
  aiSellingNotes?: string;
  aiFaqNotes?: string;
  tags?: string;
  taxCode?: string;
  trackInventory?: boolean;
};

export type ProductEditorState = {
  ok: boolean;
  error?: string;
  field?: string;
  values: ProductValues;
};

const emptyValues: ProductValues = {
  tenantSlug: "",
  productCode: "",
  name: "",
  productType: "physical",
  status: "draft",
  defaultPrice: "",
  currency: "MYR",
  unitOfMeasure: "pc",
  trackInventory: false,
};

export const initialProductEditorState: ProductEditorState = {
  ok: false,
  values: emptyValues,
};

const productInputSchema = z.object({
  productId: z.string().optional(),
  tenantSlug: z.string().min(1),
  categoryId: z.string().optional(),
  newCategoryName: z.string().optional(),
  productCode: z.string().min(1).max(60),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  name: z.string().min(1).max(200),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  productType: z.enum(["physical", "digital", "bundle", "consumable", "other"]),
  status: z.enum(["draft", "active", "inactive", "archived"]),
  brand: z.string().optional(),
  defaultPrice: z.string().min(1),
  compareAtPrice: z.string().optional(),
  currency: z.string().length(3),
  unitOfMeasure: z.string().min(1).max(20),
  mediaUrl: z.string().optional(),
  mediaAltText: z.string().optional(),
  aiSellingNotes: z.string().optional(),
  aiFaqNotes: z.string().optional(),
  tags: z.string().optional(),
  taxCode: z.string().optional(),
  trackInventory: z.boolean().optional(),
});

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : "";
}

function collectValues(formData: FormData): ProductValues {
  return {
    productId: value(formData, "productId") || undefined,
    tenantSlug: value(formData, "tenantSlug"),
    categoryId: value(formData, "categoryId") || undefined,
    newCategoryName: value(formData, "newCategoryName") || undefined,
    productCode: value(formData, "productCode"),
    sku: value(formData, "sku") || undefined,
    barcode: value(formData, "barcode") || undefined,
    name: value(formData, "name"),
    shortDescription: value(formData, "shortDescription") || undefined,
    longDescription: value(formData, "longDescription") || undefined,
    productType: value(formData, "productType") || "physical",
    status: value(formData, "status") || "draft",
    brand: value(formData, "brand") || undefined,
    defaultPrice: value(formData, "defaultPrice"),
    compareAtPrice: value(formData, "compareAtPrice") || undefined,
    currency: value(formData, "currency") || "MYR",
    unitOfMeasure: value(formData, "unitOfMeasure") || "pc",
    mediaUrl: value(formData, "mediaUrl") || undefined,
    mediaAltText: value(formData, "mediaAltText") || undefined,
    aiSellingNotes: value(formData, "aiSellingNotes") || undefined,
    aiFaqNotes: value(formData, "aiFaqNotes") || undefined,
    tags: value(formData, "tags") || undefined,
    taxCode: value(formData, "taxCode") || undefined,
    trackInventory: formData.get("trackInventory") === "on",
  };
}

async function requireProductWriteContext(tenantSlug: string) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) redirect(`/login?next=/t/${tenantSlug}/products`);

  const ctx = await resolveTenantBySlug({ slug: tenantSlug, currentUserId: me.id });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    redirect(`/t/${tenantSlug}/products`);
  }
  return ctx;
}

function normalizeCode(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63);
}

function parseMoney(raw: string, field: string) {
  const value = raw.trim();
  if (!value) return { ok: false as const, error: `${field} is required.` };
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    return { ok: false as const, error: `${field} must be a valid amount.` };
  }
  if (Number(value) < 0) {
    return { ok: false as const, error: `${field} cannot be negative.` };
  }
  return { ok: true as const, value };
}

function parseOptionalMoney(raw?: string) {
  const value = raw?.trim();
  if (!value) return { ok: true as const, value: null };
  if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
    return { ok: false as const, error: "Compare-at price must be a valid amount." };
  }
  if (Number(value) < 0) {
    return { ok: false as const, error: "Compare-at price cannot be negative." };
  }
  return { ok: true as const, value };
}

function parseTags(raw?: string) {
  return (raw ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

async function ensureCurrencyCode(code: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: schema.refCurrencies.id })
    .from(schema.refCurrencies)
    .where(and(eq(schema.refCurrencies.code, code), eq(schema.refCurrencies.status, "active")))
    .limit(1);
  return Boolean(row);
}

async function ensureUnitCode(code: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: schema.refUnits.id })
    .from(schema.refUnits)
    .where(and(eq(schema.refUnits.code, code), eq(schema.refUnits.status, "active")))
    .limit(1);
  return Boolean(row);
}

async function ensureCategoryBelongsToTenant(categoryId: string, tenantId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: schema.productCategories.id })
    .from(schema.productCategories)
    .where(
      and(
        eq(schema.productCategories.id, categoryId),
        eq(schema.productCategories.tenantId, tenantId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function nextCategoryCode(tenantId: string, name: string) {
  const db = requireDb();
  const base = normalizeCode(name).slice(0, 24) || "CATEGORY";
  let candidate = base;
  let index = 2;

  // Small bounded loop for tenant-local code generation.
  while (index < 100) {
    const [existing] = await db
      .select({ id: schema.productCategories.id })
      .from(schema.productCategories)
      .where(
        and(
          eq(schema.productCategories.tenantId, tenantId),
          eq(schema.productCategories.code, candidate),
        ),
      )
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${index}`.slice(0, 32);
    index += 1;
  }

  return `${base}-${Date.now().toString().slice(-4)}`.slice(0, 32);
}

async function syncPrimaryMedia(input: {
  tenantId: string;
  productId: string;
  url?: string;
  altText?: string;
}) {
  const db = requireDb();
  const existing = await db
    .select({ id: schema.productMedia.id })
    .from(schema.productMedia)
    .where(
      and(
        eq(schema.productMedia.tenantId, input.tenantId),
        eq(schema.productMedia.productId, input.productId),
        eq(schema.productMedia.sortOrder, 0),
      ),
    )
    .limit(1);

  if (!input.url) {
    if (existing[0]) {
      await db.delete(schema.productMedia).where(eq(schema.productMedia.id, existing[0].id));
    }
    return;
  }

  if (existing[0]) {
    await db
      .update(schema.productMedia)
      .set({ url: input.url, altText: input.altText || null })
      .where(eq(schema.productMedia.id, existing[0].id));
    return;
  }

  await db.insert(schema.productMedia).values({
    tenantId: input.tenantId,
    productId: input.productId,
    mediaType: "image",
    url: input.url,
    altText: input.altText || null,
    sortOrder: 0,
  });
}

async function syncDefaultPriceRow(input: {
  tenantId: string;
  productId: string;
  currency: string;
  amount: string;
  compareAtAmount: string | null;
}) {
  const db = requireDb();
  const existing = await db
    .select({ id: schema.productPrices.id })
    .from(schema.productPrices)
    .where(
      and(
        eq(schema.productPrices.tenantId, input.tenantId),
        eq(schema.productPrices.productId, input.productId),
        sql`${schema.productPrices.priceListId} is null`,
        sql`${schema.productPrices.variantId} is null`,
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.productPrices)
      .set({
        currency: input.currency,
        amount: input.amount,
        compareAtAmount: input.compareAtAmount,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(schema.productPrices.id, existing[0].id));
    return;
  }

  await db.insert(schema.productPrices).values({
    tenantId: input.tenantId,
    productId: input.productId,
    currency: input.currency,
    amount: input.amount,
    compareAtAmount: input.compareAtAmount,
    status: "active",
  });
}

async function loadExistingProduct(productId: string, tenantId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function saveProductAction(
  _prev: ProductEditorState,
  formData: FormData,
): Promise<ProductEditorState> {
  const values = collectValues(formData);
  const parsed = productInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Please check the product form.",
      values,
    };
  }

  const ctx = await requireProductWriteContext(parsed.data.tenantSlug);
  const db = requireDb();
  const productCode = normalizeCode(parsed.data.productCode);
  if (!productCode) {
    return { ok: false, error: "Product code is required.", field: "productCode", values };
  }

  const slug = normalizeSlug(parsed.data.name || productCode) || productCode.toLowerCase();
  const defaultPrice = parseMoney(parsed.data.defaultPrice, "Default price");
  if (!defaultPrice.ok) {
    return { ok: false, error: defaultPrice.error, field: "defaultPrice", values };
  }

  const compareAt = parseOptionalMoney(parsed.data.compareAtPrice);
  if (!compareAt.ok) {
    return { ok: false, error: compareAt.error, field: "compareAtPrice", values };
  }
  if (compareAt.value && Number(compareAt.value) < Number(defaultPrice.value)) {
    return {
      ok: false,
      error: "Compare-at price should be greater than or equal to the default price.",
      field: "compareAtPrice",
      values,
    };
  }

  const currency = parsed.data.currency.trim().toUpperCase();
  if (!(await ensureCurrencyCode(currency))) {
    return { ok: false, error: `Unknown currency code ${currency}.`, field: "currency", values };
  }

  const unitOfMeasure = parsed.data.unitOfMeasure.trim().toLowerCase();
  if (!(await ensureUnitCode(unitOfMeasure))) {
    return {
      ok: false,
      error: `Unknown unit of measure ${unitOfMeasure}.`,
      field: "unitOfMeasure",
      values,
    };
  }

  let categoryId = parsed.data.categoryId?.trim() || null;
  const newCategoryName = parsed.data.newCategoryName?.trim();
  if (categoryId && !(await ensureCategoryBelongsToTenant(categoryId, ctx.tenant.id))) {
    return { ok: false, error: "Selected category does not belong to this workspace.", field: "categoryId", values };
  }
  if (!categoryId && newCategoryName) {
    const [category] = await db
      .insert(schema.productCategories)
      .values({
        tenantId: ctx.tenant.id,
        code: await nextCategoryCode(ctx.tenant.id, newCategoryName),
        name: newCategoryName,
        status: "active",
      })
      .returning({ id: schema.productCategories.id });
    categoryId = category.id;
  }

  const duplicateWhere = parsed.data.productId
    ? and(
        eq(schema.products.tenantId, ctx.tenant.id),
        eq(schema.products.productCode, productCode),
        ne(schema.products.id, parsed.data.productId),
      )
    : and(eq(schema.products.tenantId, ctx.tenant.id), eq(schema.products.productCode, productCode));
  const duplicateCode = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(duplicateWhere)
    .limit(1);
  if (duplicateCode[0]) {
    return { ok: false, error: `Product code ${productCode} already exists in this workspace.`, field: "productCode", values };
  }

  const sku = parsed.data.sku?.trim() || null;
  if (sku) {
    const duplicateSkuWhere = parsed.data.productId
      ? and(
          eq(schema.products.tenantId, ctx.tenant.id),
          eq(schema.products.sku, sku),
          ne(schema.products.id, parsed.data.productId),
        )
      : and(eq(schema.products.tenantId, ctx.tenant.id), eq(schema.products.sku, sku));
    const duplicateSku = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(duplicateSkuWhere)
      .limit(1);
    if (duplicateSku[0]) {
      return { ok: false, error: `SKU ${sku} already exists in this workspace.`, field: "sku", values };
    }
  }

  const payload = {
    tenantId: ctx.tenant.id,
    categoryId,
    productCode,
    sku,
    barcode: parsed.data.barcode?.trim() || null,
    name: parsed.data.name.trim(),
    slug,
    shortDescription: parsed.data.shortDescription?.trim() || null,
    longDescription: parsed.data.longDescription?.trim() || null,
    productType: parsed.data.productType,
    status: parsed.data.status,
    brand: parsed.data.brand?.trim() || null,
    unitOfMeasure,
    defaultPrice: defaultPrice.value,
    compareAtPrice: compareAt.value,
    currency,
    costPrice: null,
    taxCode: parsed.data.taxCode?.trim() || null,
    trackInventory: Boolean(parsed.data.trackInventory),
    aiSellingNotes: parsed.data.aiSellingNotes?.trim() || null,
    aiFaqNotes: parsed.data.aiFaqNotes?.trim() || null,
    tags: parseTags(parsed.data.tags),
    metadata: {
      marketplaceReady: false,
      uiVersion: 2,
    },
    updatedAt: new Date(),
  };

  let productId = parsed.data.productId?.trim() || "";
  if (productId) {
    const existing = await loadExistingProduct(productId, ctx.tenant.id);
    if (!existing) {
      return { ok: false, error: "Product not found in this workspace.", values };
    }
    await db.update(schema.products).set(payload).where(eq(schema.products.id, productId));
  } else {
    const [created] = await db.insert(schema.products).values(payload).returning({ id: schema.products.id });
    productId = created.id;
  }

  await syncPrimaryMedia({
    tenantId: ctx.tenant.id,
    productId,
    url: parsed.data.mediaUrl?.trim() || undefined,
    altText: parsed.data.mediaAltText?.trim() || undefined,
  });
  await syncDefaultPriceRow({
    tenantId: ctx.tenant.id,
    productId,
    currency,
    amount: defaultPrice.value,
    compareAtAmount: compareAt.value,
  });

  revalidatePath(`/t/${ctx.tenant.slug}/products`);
  const notice = parsed.data.productId
    ? `Updated product ${parsed.data.name.trim()}.`
    : `Created product ${parsed.data.name.trim()}.`;
  redirect(`/t/${ctx.tenant.slug}/products?notice=${encodeURIComponent(notice)}&view=${productId}`);
}