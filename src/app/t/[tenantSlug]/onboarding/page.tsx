import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireTenantContext } from "@/server/tenant-guard";
import { getBusinessProfile } from "@/server/business-profile";
import { loadOnboardingReferenceData } from "@/server/reference-data";
import { saveBusinessProfileAction } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);

  if (!["owner", "admin"].includes(ctx.currentUserRole ?? "")) {
    redirect(`/t/${ctx.tenant.slug}`);
  }

  const [existing, refData] = await Promise.all([
    getBusinessProfile(ctx.tenant.id),
    loadOnboardingReferenceData(),
  ]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          {existing?.onboardingCompletedAt ? "Update business profile" : "Welcome to WAPI"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Tell us about {ctx.tenant.name}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          This shapes your workspace and grounds every AI-drafted message.
          You can edit everything later under Settings → Business.
        </p>
      </div>

      <form action={saveBusinessProfileAction} className="space-y-6">
        <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
        <input type="hidden" name="completeOnboarding" value="1" />

        <OnboardingForm
          ref={refData}
          defaults={{
            countryId: existing?.countryId ?? null,
            currencyId: existing?.currencyId ?? null,
            languageId: existing?.languageId ?? null,
            timezoneId: existing?.timezoneId ?? null,
            industryId: existing?.industryId ?? null,
            businessNatureId: existing?.businessNatureId ?? null,
            brandVoiceId: existing?.brandVoiceId ?? null,
            brandVoiceCustom: existing?.brandVoiceCustom ?? null,
            primaryPhone: existing?.primaryPhone ?? null,
            supportEmail: existing?.supportEmail ?? null,
            websiteUrl: existing?.websiteUrl ?? null,
            industryFreeText: existing?.industry ?? null,
            legacyBusinessNature: existing?.businessNature ?? null,
          }}
        />

        <div className="flex items-center justify-between gap-3">
          {existing?.onboardingCompletedAt ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/t/${ctx.tenant.slug}`}>Cancel</Link>
            </Button>
          ) : (
            <span className="text-xs text-[var(--muted-foreground)]">
              You can change everything later.
            </span>
          )}
          <Button type="submit">Save &amp; continue</Button>
        </div>
      </form>
    </section>
  );
}
