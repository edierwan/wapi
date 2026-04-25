"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import { upsertBusinessProfile } from "@/server/business-profile";
import { validateActiveRefIds } from "@/server/reference-data";

// Legacy enum kept for backward-compat with the existing
// `tenant_business_profiles.business_nature` text column.
const BusinessNatureEnum = z.enum([
  "product",
  "service",
  "hybrid",
  "booking",
  "lead_gen",
  "support",
  "other",
]);

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));

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
  industryId: optionalUuid,
  countryId: optionalUuid,
  currencyId: optionalUuid,
  languageId: optionalUuid,
  timezoneId: optionalUuid,
  businessNatureId: optionalUuid,
  brandVoiceId: optionalUuid,
  brandVoiceCustom: z.string().max(2000).optional().default(""),
  completeOnboarding: z.union([z.literal("1"), z.literal("0")]).optional(),
});

export async function saveBusinessProfileAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
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
  if (!["owner", "admin"].includes(tenantRes.currentUserRole ?? "")) {
    redirect(`/t/${data.tenantSlug}`);
  }

  const v = await validateActiveRefIds({
    countryId: data.countryId,
    currencyId: data.currencyId,
    languageId: data.languageId,
    timezoneId: data.timezoneId,
    industryId: data.industryId,
    businessNatureId: data.businessNatureId,
    brandVoiceId: data.brandVoiceId,
  });
  if (!v.ok) {
    throw new Error(`Invalid reference IDs: ${v.invalid.join(", ")}`);
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
    industryId: data.industryId ?? null,
    countryId: data.countryId ?? null,
    currencyId: data.currencyId ?? null,
    languageId: data.languageId ?? null,
    timezoneId: data.timezoneId ?? null,
    businessNatureId: data.businessNatureId ?? null,
    brandVoiceId: data.brandVoiceId ?? null,
    brandVoiceCustom: data.brandVoiceCustom || null,
    completeOnboarding: data.completeOnboarding === "1",
  });

  revalidatePath(`/t/${data.tenantSlug}`, "layout");
  redirect(`/t/${data.tenantSlug}`);
}
