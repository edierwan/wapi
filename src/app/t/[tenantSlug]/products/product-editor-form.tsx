"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialProductEditorState,
  saveProductAction,
  type ProductEditorState,
} from "./actions";

type Option = {
  id: string;
  code: string;
  name: string;
};

type InitialValues = ProductEditorState["values"];

function mergeInitialValues(initialValues: InitialValues): ProductEditorState {
  return {
    ...initialProductEditorState,
    values: {
      ...initialProductEditorState.values,
      ...initialValues,
    },
  };
}

export function ProductEditorForm({
  tenantSlug,
  categories,
  currencies,
  units,
  initialValues,
}: {
  tenantSlug: string;
  categories: Option[];
  currencies: Array<{ code: string; name: string }>;
  units: Array<{ code: string; name: string }>;
  initialValues: InitialValues;
}) {
  const [state, formAction, pending] = useActionState(
    saveProductAction,
    mergeInitialValues({ ...initialValues, tenantSlug }),
  );
  const values = state.values;
  const isEditing = Boolean(values.productId);

  return (
    <form action={formAction} className="space-y-5 rounded-3xl border border-[var(--border)] bg-white/90 p-6 shadow-sm">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="productId" value={values.productId ?? ""} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {isEditing ? "Edit product" : "Add product master"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Keep the MVP simple, but capture the data AI, campaigns, landing pages, and future marketplace sync will need.
          </p>
        </div>
        {isEditing ? (
          <Link
            href={`/t/${tenantSlug}/products`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
          >
            New product
          </Link>
        ) : null}
      </div>

      {state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/20 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Basic info
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Product code, category, type, and stock behavior form the stable master-data layer.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Product code</span>
            <input
              name="productCode"
              defaultValue={values.productCode ?? ""}
              placeholder="SKU-SERUM-50"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">SKU</span>
            <input
              name="sku"
              defaultValue={values.sku ?? ""}
              placeholder="SERUM-50-001"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--foreground)]">Product name</span>
            <input
              name="name"
              defaultValue={values.name ?? ""}
              placeholder="Hair Growth Serum 50ml"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Category</span>
            <select
              name="categoryId"
              defaultValue={values.categoryId ?? ""}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              <option value="">No category yet</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Quick-create category</span>
            <input
              name="newCategoryName"
              defaultValue={values.newCategoryName ?? ""}
              placeholder="Haircare"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
            <span className="block text-xs text-[var(--muted-foreground)]">
              Leave blank unless you want the form to create a new category automatically.
            </span>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Product type</span>
            <select
              name="productType"
              defaultValue={values.productType ?? "physical"}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
              <option value="bundle">Bundle</option>
              <option value="consumable">Consumable</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Status</span>
            <select
              name="status"
              defaultValue={values.status ?? "draft"}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Brand</span>
            <input
              name="brand"
              defaultValue={values.brand ?? ""}
              placeholder="Own brand or supplier brand"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Barcode</span>
            <input
              name="barcode"
              defaultValue={values.barcode ?? ""}
              placeholder="Optional"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm md:col-span-2">
            <input
              type="checkbox"
              name="trackInventory"
              defaultChecked={Boolean(values.trackInventory)}
              className="size-4 rounded border-[var(--border)]"
            />
            <span>
              Track inventory later. Enable this now if this product should connect to stock movement in future inventory modules.
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/20 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Customer description
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            This is the copy humans and AI should quote before improvising anything.
          </p>
        </div>
        <div className="grid gap-4">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Short description</span>
            <textarea
              name="shortDescription"
              defaultValue={values.shortDescription ?? ""}
              rows={3}
              placeholder="One-paragraph summary for listing views, quotes, and quick replies."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Long description</span>
            <textarea
              name="longDescription"
              defaultValue={values.longDescription ?? ""}
              rows={5}
              placeholder="Deeper product story, ingredients/specs, usage flow, or service inclusions."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/20 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Pricing
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Keep a trustworthy default selling price now. Price lists and campaign rules can branch from this later.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Default price</span>
            <input
              name="defaultPrice"
              defaultValue={values.defaultPrice ?? ""}
              placeholder="49.90"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
              required
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Compare-at price</span>
            <input
              name="compareAtPrice"
              defaultValue={values.compareAtPrice ?? ""}
              placeholder="59.90"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Currency</span>
            <select
              name="currency"
              defaultValue={values.currency ?? "MYR"}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Unit of measure</span>
            <select
              name="unitOfMeasure"
              defaultValue={values.unitOfMeasure ?? "pc"}
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            >
              {units.map((unit) => (
                <option key={unit.code} value={unit.code}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/20 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Media and AI notes
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            A clean primary image plus grounded AI notes helps downstream assistants quote the product correctly.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--foreground)]">Primary image URL</span>
            <input
              name="mediaUrl"
              defaultValue={values.mediaUrl ?? ""}
              placeholder="https://..."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--foreground)]">Image alt text</span>
            <input
              name="mediaAltText"
              defaultValue={values.mediaAltText ?? ""}
              placeholder="Short accessible description of the product image"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--foreground)]">AI selling notes</span>
            <textarea
              name="aiSellingNotes"
              defaultValue={values.aiSellingNotes ?? ""}
              rows={4}
              placeholder="Key benefits, who this is for, usage highlights, and safe selling claims."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
            <span className="block text-xs text-[var(--muted-foreground)]">
              Recommended content: key benefits, ideal customer, usage notes, and non-negotiable selling facts.
            </span>
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="font-medium text-[var(--foreground)]">AI FAQ notes</span>
            <textarea
              name="aiFaqNotes"
              defaultValue={values.aiFaqNotes ?? ""}
              rows={4}
              placeholder="Common customer questions, warranty/validity notes, and what the AI should avoid saying."
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
            <span className="block text-xs text-[var(--muted-foreground)]">
              Recommended content: typical objections, refund/warranty rules, expiry guidance, and claims the AI must never invent.
            </span>
          </label>
        </div>
      </section>

      <details className="rounded-2xl border border-[var(--border)]/70 bg-[var(--muted)]/20 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Advanced
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Tags</span>
            <input
              name="tags"
              defaultValue={values.tags ?? ""}
              placeholder="haircare, bestseller, retail"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Tax code</span>
            <input
              name="taxCode"
              defaultValue={values.taxCode ?? ""}
              placeholder="Optional"
              className="w-full rounded-2xl border border-[var(--border)] bg-white px-3 py-2.5"
            />
          </label>
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted-foreground)] md:col-span-2">
            Marketplace/channel mapping is prepared in the backend schema. The tenant UI keeps this hidden for now until channel sync workflows are ready.
          </div>
        </div>
      </details>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border)]/70 pt-4">
        <p className="text-xs text-[var(--muted-foreground)]">
          Fields marked above become the source of truth for AI quoting, campaign copy, and future marketplace mapping.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving..." : isEditing ? "Update product" : "Save product"}
        </button>
      </div>
    </form>
  );
}