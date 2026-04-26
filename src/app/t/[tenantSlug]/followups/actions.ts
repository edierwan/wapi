"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  createSequence,
  deleteSequence,
  deleteStep,
  updateSequence,
  upsertStep,
  type FollowupTrigger,
} from "@/server/followups";

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
    redirect(`/t/${tenantSlug}/followups`);
  }
  return ctx;
}

const triggerEnum = z.enum(["no_reply", "hot_lead", "new_contact", "custom"]);

const createSeqSchema = z.object({
  tenantSlug: z.string(),
  name: z.string().min(2).max(120),
  triggerType: triggerEnum,
});

export async function createSequenceAction(formData: FormData) {
  const parsed = createSeqSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const row = await createSequence({
    tenantId: ctx.tenant.id,
    name: parsed.data.name,
    triggerType: parsed.data.triggerType as FollowupTrigger,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/followups`);
  redirect(`/t/${parsed.data.tenantSlug}/followups/${row.id}`);
}

const updateSeqSchema = z.object({
  tenantSlug: z.string(),
  sequenceId: z.string().uuid(),
  name: z.string().min(2).max(120),
  triggerType: triggerEnum,
  status: z.enum(["active", "paused", "archived"]).optional().default("active"),
});

export async function updateSequenceAction(formData: FormData) {
  const parsed = updateSeqSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await updateSequence({
    tenantId: ctx.tenant.id,
    sequenceId: parsed.data.sequenceId,
    name: parsed.data.name,
    triggerType: parsed.data.triggerType as FollowupTrigger,
    status: parsed.data.status,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/followups/${parsed.data.sequenceId}`);
}

const deleteSeqSchema = z.object({
  tenantSlug: z.string(),
  sequenceId: z.string().uuid(),
});

export async function deleteSequenceAction(formData: FormData) {
  const parsed = deleteSeqSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await deleteSequence(ctx.tenant.id, parsed.data.sequenceId);
  revalidatePath(`/t/${parsed.data.tenantSlug}/followups`);
  redirect(`/t/${parsed.data.tenantSlug}/followups`);
}

const stepSchema = z.object({
  tenantSlug: z.string(),
  sequenceId: z.string().uuid(),
  stepId: z.string().uuid().optional().or(z.literal("")).default(""),
  stepOrder: z.coerce.number().int().min(1).max(50),
  delayHours: z.coerce.number().int().min(0).max(720),
  bodyText: z.string().max(2000).optional().default(""),
});

export async function upsertStepAction(formData: FormData) {
  const parsed = stepSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await upsertStep({
    tenantId: ctx.tenant.id,
    sequenceId: parsed.data.sequenceId,
    stepId: parsed.data.stepId || null,
    stepOrder: parsed.data.stepOrder,
    delayHours: parsed.data.delayHours,
    bodyText: parsed.data.bodyText || null,
    isAiGenerated: false,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/followups/${parsed.data.sequenceId}`);
}

const deleteStepSchema = z.object({
  tenantSlug: z.string(),
  sequenceId: z.string().uuid(),
  stepId: z.string().uuid(),
});

export async function deleteStepAction(formData: FormData) {
  const parsed = deleteStepSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await deleteStep({
    tenantId: ctx.tenant.id,
    sequenceId: parsed.data.sequenceId,
    stepId: parsed.data.stepId,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/followups/${parsed.data.sequenceId}`);
}
