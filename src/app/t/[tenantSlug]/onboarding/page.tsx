import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireTenantContext } from "@/server/tenant-guard";
import { getBusinessProfile } from "@/server/business-profile";
import { saveBusinessProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const NATURES = [
  {
    value: "product",
    label: "Product-based",
    hint: "You sell physical or digital products (retail, f&b, e-commerce).",
  },
  {
    value: "service",
    label: "Service-based",
    hint: "You sell services by time or package (clinic, salon, training).",
  },
  {
    value: "hybrid",
    label: "Hybrid (products + services)",
    hint: "You sell both (car workshop, beauty shop with retail, etc.).",
  },
  {
    value: "booking",
    label: "Booking / appointment",
    hint: "Your main flow is scheduled appointments (dental, tours, venues).",
  },
  {
    value: "lead_gen",
    label: "Lead generation",
    hint: "You capture leads and follow up (property, insurance, education).",
  },
  {
    value: "support",
    label: "Support / helpdesk",
    hint: "You primarily support existing customers over WhatsApp.",
  },
  {
    value: "other",
    label: "Other",
    hint: "Doesn't fit above. You can refine later.",
  },
] as const;

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

  const existing = await getBusinessProfile(ctx.tenant.id);

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business nature</CardTitle>
            <CardDescription>
              Pick the closest match. Gates which setup modules appear.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {NATURES.map((n, i) => (
              <label
                key={n.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 transition hover:border-[var(--primary)]/50 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]"
              >
                <input
                  type="radio"
                  name="businessNature"
                  value={n.value}
                  required
                  defaultChecked={
                    existing
                      ? existing.businessNature === n.value
                      : i === 0
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{n.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    {n.hint}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basics</CardTitle>
            <CardDescription>
              Used for AI tone, number formatting, and default language.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Industry"
              name="industry"
              placeholder="e.g. Dental clinic"
              defaultValue={existing?.industry ?? ""}
            />
            <Field
              label="Primary country (ISO-2)"
              name="primaryCountry"
              placeholder="MY"
              defaultValue={existing?.primaryCountry ?? "MY"}
            />
            <Field
              label="Default currency (ISO-4217)"
              name="defaultCurrency"
              placeholder="MYR"
              defaultValue={existing?.defaultCurrency ?? "MYR"}
            />
            <Field
              label="Default language"
              name="defaultLanguage"
              placeholder="en"
              defaultValue={existing?.defaultLanguage ?? "en"}
            />
            <Field
              label="Timezone (IANA)"
              name="timezone"
              placeholder="Asia/Kuala_Lumpur"
              defaultValue={existing?.timezone ?? "Asia/Kuala_Lumpur"}
            />
            <Field
              label="Primary phone"
              name="primaryPhone"
              placeholder="+60..."
              defaultValue={existing?.primaryPhone ?? ""}
            />
            <Field
              label="Support email"
              name="supportEmail"
              type="email"
              placeholder="[email protected]"
              defaultValue={existing?.supportEmail ?? ""}
            />
            <Field
              label="Website URL"
              name="websiteUrl"
              type="url"
              placeholder="https://..."
              defaultValue={existing?.websiteUrl ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand voice (optional)</CardTitle>
            <CardDescription>
              One or two sentences describing your tone. AI uses this when
              drafting campaigns and replies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              name="brandVoice"
              rows={3}
              defaultValue={existing?.brandVoice ?? ""}
              placeholder="Friendly, direct, uses Malay mixed with English. No slang. Always polite sign-off."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </CardContent>
        </Card>

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

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
      />
    </label>
  );
}
