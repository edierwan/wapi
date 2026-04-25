"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import { requireDb, schema } from "@/db/client";

const writeRoles = new Set(["owner", "admin"]);

async function authForWrite(tenantSlug: string) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const ctx = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    redirect(`/t/${tenantSlug}/products`);
  }
  return ctx;
}

const productSchema = z.object({
  tenantSlug: z.string(),
  productCode: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(500).optional().default(""),
  productType: z
    .enum(["physical", "digital", "bundle", "consumable", "other"])
    .default("physical"),
  defaultPrice: z.string().optional().default(""),
  currency: z.string().length(3).default("MYR"),
  unitOfMeasure: z.string().min(1).max(20).default("pc"),
});

export async function createProductAction(formData: FormData) {
  const data = productSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  const db = requireDb();

  const price = data.defaultPrice.trim();
  await db.insert(schema.products).values({
    tenantId: ctx.tenant.id,
    productCode: data.productCode.trim(),
    name: data.name.trim(),
    shortDescription: data.shortDescription || null,
    productType: data.productType,
    unitOfMeasure: data.unitOfMeasure,
    defaultPrice: price ? price : null,
    currency: data.currency,
  });

  revalidatePath(`/t/${data.tenantSlug}/products`);
  redirect(`/t/${data.tenantSlug}/products`);
}

const serviceSchema = z.object({
  tenantSlug: z.string(),
  serviceCode: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(500).optional().default(""),
  serviceType: z
    .enum([
      "consultation",
      "appointment",
      "package",
      "subscription",
      "repair",
      "delivery",
      "other",
    ])
    .default("consultation"),
  durationMinutes: z.coerce.number().int().min(0).max(60 * 24).optional(),
  defaultPrice: z.string().optional().default(""),
  currency: z.string().length(3).default("MYR"),
  requiresBooking: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function createServiceAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = serviceSchema.parse(raw);
  const ctx = await authForWrite(data.tenantSlug);
  const db = requireDb();

  const price = data.defaultPrice.trim();
  await db.insert(schema.services).values({
    tenantId: ctx.tenant.id,
    serviceCode: data.serviceCode.trim(),
    name: data.name.trim(),
    shortDescription: data.shortDescription || null,
    serviceType: data.serviceType,
    durationMinutes: data.durationMinutes ?? null,
    defaultPrice: price ? price : null,
    currency: data.currency,
    requiresBooking: data.requiresBooking === "on",
  });

  revalidatePath(`/t/${data.tenantSlug}/services`);
  redirect(`/t/${data.tenantSlug}/services`);
}
