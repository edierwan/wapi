"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  createCampaign,
  deleteCampaign,
  deleteVariant,
  materializeRecipients,
  setCampaignStatus,
  updateCampaign,
  upsertVariant,
  type AudienceFilter,
  type CampaignSendMode,
} from "@/server/campaigns";
import {
  recordSafetyReview,
  reviewCampaign,
} from "@/server/campaign-safety";
import { dispatchCampaign } from "@/server/campaign-dispatcher";
import { suggestVariant } from "@/server/campaign-ai";

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
    redirect(`/t/${tenantSlug}/campaigns`);
  }
  return ctx;
}

/* ── create ─────────────────────────────────────────────────── */

const createSchema = z.object({
  tenantSlug: z.string(),
  name: z.string().min(2).max(120),
  objective: z
    .enum(["promo", "event", "re_engage", "survey", "followup", "other"])
    .optional()
    .default("promo"),
  sendMode: z.enum(["standard", "reply_first"]).optional().default("standard"),
});

export async function createCampaignAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);
  const me = await getCurrentUser();
  const row = await createCampaign({
    tenantId: ctx.tenant.id,
    name: data.name,
    objective: data.objective,
    sendMode: data.sendMode as CampaignSendMode,
    createdByUserId: me?.id ?? null,
  });
  revalidatePath(`/t/${data.tenantSlug}/campaigns`);
  redirect(`/t/${data.tenantSlug}/campaigns/${row.id}`);
}

/* ── update settings ────────────────────────────────────────── */

const updateSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
  name: z.string().min(2).max(120),
  objective: z.enum([
    "promo",
    "event",
    "re_engage",
    "survey",
    "followup",
    "other",
  ]),
  sendMode: z.enum(["standard", "reply_first"]),
  // audience JSON shipped as comma-separated lists per field
  audienceTagIds: z.string().optional().default(""),
  audienceLeadStatuses: z.string().optional().default(""),
  audienceStatuses: z.string().optional().default("active"),
  scheduledAt: z.string().optional().default(""),
});

function csvList(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function updateCampaignAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);

  const audience: AudienceFilter = {
    tagIds: csvList(data.audienceTagIds),
    leadStatuses: csvList(data.audienceLeadStatuses),
    statuses: csvList(data.audienceStatuses),
  };

  let scheduledAt: Date | null = null;
  if (data.scheduledAt) {
    const d = new Date(data.scheduledAt);
    if (!Number.isNaN(d.getTime())) scheduledAt = d;
  }

  await updateCampaign({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
    name: data.name,
    objective: data.objective,
    sendMode: data.sendMode as CampaignSendMode,
    audienceFilter: audience,
    scheduledAt,
  });
  revalidatePath(`/t/${data.tenantSlug}/campaigns/${data.campaignId}`);
}

/* ── delete ─────────────────────────────────────────────────── */

const idsSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
});

export async function deleteCampaignAction(formData: FormData) {
  const parsed = idsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await deleteCampaign(ctx.tenant.id, parsed.data.campaignId);
  revalidatePath(`/t/${parsed.data.tenantSlug}/campaigns`);
  redirect(`/t/${parsed.data.tenantSlug}/campaigns`);
}

/* ── variants ───────────────────────────────────────────────── */

const variantSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
  variantId: z.string().uuid().optional().or(z.literal("")).default(""),
  label: z.string().min(1).max(8),
  bodyText: z.string().min(1).max(2000),
  languageCode: z.string().max(8).optional().default(""),
  weight: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export async function upsertVariantAction(formData: FormData) {
  const parsed = variantSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);
  await upsertVariant({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
    variantId: data.variantId || null,
    label: data.label,
    bodyText: data.bodyText,
    languageCode: data.languageCode || null,
    weight: data.weight,
    isAiGenerated: false,
  });
  revalidatePath(`/t/${data.tenantSlug}/campaigns/${data.campaignId}`);
}

const deleteVariantSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
  variantId: z.string().uuid(),
});

export async function deleteVariantAction(formData: FormData) {
  const parsed = deleteVariantSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await deleteVariant({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    variantId: parsed.data.variantId,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/campaigns/${parsed.data.campaignId}`);
}

/* ── AI variant suggestion (Dify HITL) ───────────────────────── */

const suggestSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
  prompt: z.string().max(1000).optional().default(""),
});

export async function suggestVariantAction(formData: FormData) {
  const parsed = suggestSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);

  const result = await suggestVariant({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    prompt: parsed.data.prompt || undefined,
  });

  if (!result.ok) {
    // Surface friendly error via thrown Error; the form does not show
    // it inline yet (we don't have a useActionState wrapper here), so
    // the user sees the platform error toast. Acceptable for HITL
    // first-cut; a richer surface comes with the next UI pass.
    throw new Error(
      result.reason === "not_configured"
        ? "No AI provider configured for this tenant. Set one up in tenant AI settings first."
        : result.reason === "no_base_url"
          ? "Tenant AI provider has no base URL configured."
          : result.reason === "provider_error"
            ? `AI provider error: ${result.error ?? "unknown"}`
            : "AI variant suggestion is unavailable.",
    );
  }

  // Persist as a draft variant marked is_ai_generated=true. The human
  // reviews / edits / deletes via the existing variant editor before
  // scheduling. This is the HITL boundary.
  const trimmed = result.suggestion.slice(0, 2000);
  await upsertVariant({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    variantId: null,
    label: `AI ${new Date().toISOString().slice(11, 19)}`,
    bodyText: trimmed,
    languageCode: null,
    weight: 1,
    isAiGenerated: true,
  });

  revalidatePath(
    `/t/${parsed.data.tenantSlug}/campaigns/${parsed.data.campaignId}`,
  );
}

/* ── safety review ──────────────────────────────────────────── */

export async function runSafetyReviewAction(formData: FormData) {
  const parsed = idsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const me = await getCurrentUser();
  const result = await reviewCampaign({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
  });
  await recordSafetyReview({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    reviewedByUserId: me?.id ?? null,
    result,
  });
  await setCampaignStatus({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    status: "safety_review",
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/campaigns/${parsed.data.campaignId}`);
}

/* ── materialize + schedule + dispatch ──────────────────────── */

const scheduleSchema = z.object({
  tenantSlug: z.string(),
  campaignId: z.string().uuid(),
  accountId: z.string().uuid(),
  scheduledAt: z.string().optional().default(""),
});

export async function scheduleCampaignAction(formData: FormData) {
  const parsed = scheduleSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;
  const ctx = await authForWrite(data.tenantSlug);

  const review = await reviewCampaign({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
  });
  if (review.overallStatus === "high_risk") {
    throw new Error(
      `Cannot schedule: ${review.summary} Run safety review and fix blockers first.`,
    );
  }

  const { total } = await materializeRecipients({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
  });
  if (total === 0) {
    throw new Error("Audience is empty. Adjust filters and try again.");
  }

  let scheduledAt: Date | null = null;
  if (data.scheduledAt) {
    const d = new Date(data.scheduledAt);
    if (!Number.isNaN(d.getTime())) scheduledAt = d;
  }

  await setCampaignStatus({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
    status: "scheduled",
    scheduledAt,
  });
  await dispatchCampaign({
    tenantId: ctx.tenant.id,
    campaignId: data.campaignId,
    accountId: data.accountId,
    scheduledAt,
  });
  revalidatePath(`/t/${data.tenantSlug}/campaigns/${data.campaignId}`);
}

export async function cancelCampaignAction(formData: FormData) {
  const parsed = idsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  await setCampaignStatus({
    tenantId: ctx.tenant.id,
    campaignId: parsed.data.campaignId,
    status: "cancelled",
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/campaigns/${parsed.data.campaignId}`);
}
