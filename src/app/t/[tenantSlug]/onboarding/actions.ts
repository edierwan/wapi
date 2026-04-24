"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import { upsertBusinessProfile } from "@/server/business-profile";

const BusinessNatureEnum = z.enum([
  "product",
  "service",
  "hybrid",
  "booking",
  "lead_gen",
  "support",
  "other",
]);

const schema = z.object({
  tenantSlug: z.string(),
  businessNature: BusinessNatureEnum,
  industry: z.string().max(120).optional().default(""),
  defaultCurrency: z.string().length(3).default("MYR"),
  defaultLanguage: z.string().min(2).max(5).default("en"),
  timezone: z.string().default("Asia/Kuala_Lumpur"),
  primaryCountry: z.string().length(2).default("MY"),
  primaryPhone: z.string().max(32).optional().default(""),
  supportEmail: z.string().email().optional().or(z.literal("")).default(""),
  websiteUrl: z.string().url().optional().or(z.literal("")).default(""),
  brandVoice: z.string().max(400).optional().default(""),
  completeOnboarding: z.union([z.literal("1"), z.literal("0")]).optional(),
});

export async function saveBusinessProfileAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Surface the first error — UI reloads with default values.
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    throw new Error(msg);
  }
  const data = parsed.data;

  const tenantRes = await resolveTenantBySlug({
    slug: data.tenantSlug,
    currentUserId: me.id,
  });
  if (!tenantRes.ok) {
    redirect("/dashboard");
  }

  // Only owner/admin can edit business profile.
  if (!["owner", "admin"].includes(tenantRes.currentUserRole ?? "")) {
    redirect(`/t/${data.tenantSlug}`);
  }

  await upsertBusinessProfile({
    tenantId: tenantRes.tenant.id,
    businessNature: data.businessNature,
    industry: data.industry || null,
    defaultCurrency: data.defaultCurrency,
    defaultLanguage: data.defaultLanguage,
    timezone: data.timezone,
    primaryCountry: data.primaryCountry,
    primaryPhone: data.primaryPhone || null,
    supportEmail: data.supportEmail || null,
    websiteUrl: data.websiteUrl || null,
    brandVoice: data.brandVoice || null,
    completeOnboarding: data.completeOnboarding === "1",
  });

  revalidatePath(`/t/${data.tenantSlug}`, "layout");
  redirect(`/t/${data.tenantSlug}`);
}
