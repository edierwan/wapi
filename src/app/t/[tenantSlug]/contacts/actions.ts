"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  assignTag,
  createContact,
  createTag,
  deleteContact,
  deleteTag,
  unassignTag,
  updateContact,
} from "@/server/contacts";
import { recomputeReadiness } from "@/server/ai-readiness";

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
    redirect(`/t/${tenantSlug}/contacts`);
  }
  return ctx;
}

// Loose phone validator: digits, spaces, +, -, parens; we normalize to E.164-ish.
const phoneSchema = z
  .string()
  .min(5)
  .max(32)
  .regex(/^[+]?[\d\s\-()]+$/, "Phone must contain digits and optional + - ( )");

function normalizePhone(raw: string) {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/^0+/, "")}`;
}

const createSchema = z.object({
  tenantSlug: z.string(),
  phoneE164: phoneSchema,
  fullName: z.string().max(200).optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  leadStatus: z
    .enum(["none", "new", "warm", "hot", "customer"])
    .optional()
    .default("none"),
  notes: z.string().max(2000).optional().default(""),
});

export async function createContactAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);

  await createContact({
    tenantId: ctx.tenant.id,
    phoneE164: normalizePhone(data.phoneE164),
    fullName: data.fullName || null,
    email: data.email || null,
    leadStatus: data.leadStatus,
    notes: data.notes || null,
    source: "manual",
  });

  revalidatePath(`/t/${data.tenantSlug}/contacts`);
  redirect(`/t/${data.tenantSlug}/contacts`);
}

const updateSchema = createSchema.extend({
  contactId: z.string().uuid(),
  status: z
    .enum(["active", "unsubscribed", "blocked", "bounced"])
    .optional()
    .default("active"),
});

export async function updateContactAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);

  await updateContact({
    tenantId: ctx.tenant.id,
    contactId: data.contactId,
    phoneE164: normalizePhone(data.phoneE164),
    fullName: data.fullName || null,
    email: data.email || null,
    leadStatus: data.leadStatus,
    status: data.status,
    notes: data.notes || null,
  });

  revalidatePath(`/t/${data.tenantSlug}/contacts`);
  revalidatePath(`/t/${data.tenantSlug}/contacts/${data.contactId}`);
  redirect(`/t/${data.tenantSlug}/contacts/${data.contactId}`);
}

const deleteSchema = z.object({
  tenantSlug: z.string(),
  contactId: z.string().uuid(),
});

export async function deleteContactAction(formData: FormData) {
  const data = deleteSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await deleteContact(ctx.tenant.id, data.contactId);
  revalidatePath(`/t/${data.tenantSlug}/contacts`);
  redirect(`/t/${data.tenantSlug}/contacts`);
}

const tagCreateSchema = z.object({
  tenantSlug: z.string(),
  name: z.string().min(1).max(60),
  color: z.string().max(20).optional().default(""),
});

export async function createTagAction(formData: FormData) {
  const data = tagCreateSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await createTag(ctx.tenant.id, data.name.trim(), data.color || null);
  revalidatePath(`/t/${data.tenantSlug}/contacts`);
}

const tagDeleteSchema = z.object({
  tenantSlug: z.string(),
  tagId: z.string().uuid(),
});

export async function deleteTagAction(formData: FormData) {
  const data = tagDeleteSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  await deleteTag(ctx.tenant.id, data.tagId);
  revalidatePath(`/t/${data.tenantSlug}/contacts`);
}

const tagAssignSchema = z.object({
  tenantSlug: z.string(),
  contactId: z.string().uuid(),
  tagId: z.string().uuid(),
  mode: z.enum(["add", "remove"]),
});

export async function toggleTagAction(formData: FormData) {
  const data = tagAssignSchema.parse(Object.fromEntries(formData.entries()));
  const ctx = await authForWrite(data.tenantSlug);
  if (data.mode === "add") {
    await assignTag(ctx.tenant.id, data.contactId, data.tagId);
  } else {
    await unassignTag(ctx.tenant.id, data.contactId, data.tagId);
  }
  revalidatePath(`/t/${data.tenantSlug}/contacts/${data.contactId}`);
}

export async function recomputeReadinessAction(formData: FormData) {
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  if (!tenantSlug) throw new Error("Missing tenantSlug");
  const ctx = await authForWrite(tenantSlug);
  await recomputeReadiness(ctx.tenant.id);
  revalidatePath(`/t/${tenantSlug}`);
  revalidatePath(`/t/${tenantSlug}/contacts`);
  redirect(`/t/${tenantSlug}`);
}
