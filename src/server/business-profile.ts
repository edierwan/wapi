import "server-only";
import { and, eq } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  tenantBusinessProfiles,
  type BusinessNature,
  type TenantBusinessProfile,
} from "@/db/schema";

export async function getBusinessProfile(
  tenantId: string,
): Promise<TenantBusinessProfile | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(tenantBusinessProfiles)
    .where(eq(tenantBusinessProfiles.tenantId, tenantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function isOnboardingComplete(tenantId: string): Promise<boolean> {
  const p = await getBusinessProfile(tenantId);
  return Boolean(p?.onboardingCompletedAt);
}

export type UpsertBusinessProfileInput = {
  tenantId: string;
  businessNature: BusinessNature;
  industry?: string | null;
  defaultCurrency?: string | null;
  defaultLanguage?: string | null;
  timezone?: string | null;
  primaryCountry?: string | null;
  primaryPhone?: string | null;
  supportEmail?: string | null;
  websiteUrl?: string | null;
  brandVoice?: string | null;
  completeOnboarding?: boolean;
};

export async function upsertBusinessProfile(input: UpsertBusinessProfileInput) {
  const db = requireDb();
  const existing = await getBusinessProfile(input.tenantId);
  const now = new Date();
  const patch = {
    businessNature: input.businessNature,
    industry: input.industry ?? null,
    defaultCurrency: input.defaultCurrency ?? "MYR",
    defaultLanguage: input.defaultLanguage ?? "en",
    timezone: input.timezone ?? "Asia/Kuala_Lumpur",
    primaryCountry: input.primaryCountry ?? "MY",
    primaryPhone: input.primaryPhone ?? null,
    supportEmail: input.supportEmail ?? null,
    websiteUrl: input.websiteUrl ?? null,
    brandVoice: input.brandVoice ?? null,
    updatedAt: now,
    ...(input.completeOnboarding ? { onboardingCompletedAt: now } : {}),
  };
  if (existing) {
    await db
      .update(tenantBusinessProfiles)
      .set(patch)
      .where(
        and(
          eq(tenantBusinessProfiles.tenantId, input.tenantId),
          eq(tenantBusinessProfiles.id, existing.id),
        ),
      );
    return existing.id;
  }
  const inserted = await db
    .insert(tenantBusinessProfiles)
    .values({ tenantId: input.tenantId, ...patch })
    .returning({ id: tenantBusinessProfiles.id });
  return inserted[0]!.id;
}
