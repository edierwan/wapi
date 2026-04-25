"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  MEMORY_KINDS,
  createMemoryItem,
  deleteMemoryItem,
  updateMemoryItem,
} from "@/server/business-memory";

const writeRoles = new Set(["owner", "admin", "agent"]);

async function authForWrite(tenantSlug: string) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const ctx = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    redirect(`/t/${tenantSlug}/brain`);
  }
  return ctx;
}

const createSchema = z.object({
  tenantSlug: z.string(),
  kind: z.enum(MEMORY_KINDS),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  weight: z.coerce.number().int().min(0).max(10).default(1),
});

export async function createMemoryAction(formData: FormData) {
  const data = createSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await createMemoryItem({
    tenantId: ctx.tenant.id,
    kind: data.kind,
    title: data.title,
    body: data.body,
    weight: data.weight,
    source: "manual",
  });
  revalidatePath(`/t/${data.tenantSlug}/brain`);
  redirect(`/t/${data.tenantSlug}/brain`);
}

const updateSchema = createSchema.extend({
  itemId: z.string().uuid(),
  status: z.enum(["active", "archived"]).optional().default("active"),
});

export async function updateMemoryAction(formData: FormData) {
  const data = updateSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await updateMemoryItem({
    tenantId: ctx.tenant.id,
    itemId: data.itemId,
    kind: data.kind,
    title: data.title,
    body: data.body,
    weight: data.weight,
    status: data.status,
  });
  revalidatePath(`/t/${data.tenantSlug}/brain`);
  redirect(`/t/${data.tenantSlug}/brain`);
}

const deleteSchema = z.object({
  tenantSlug: z.string(),
  itemId: z.string().uuid(),
});

export async function deleteMemoryAction(formData: FormData) {
  const data = deleteSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await deleteMemoryItem(ctx.tenant.id, data.itemId);
  revalidatePath(`/t/${data.tenantSlug}/brain`);
  redirect(`/t/${data.tenantSlug}/brain`);
}
