import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TenantSubNav } from "@/components/tenant/sub-nav";
import { requireTenantContext } from "@/server/tenant-guard";
import { getBusinessProfile } from "@/server/business-profile";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const profile = await getBusinessProfile(ctx.tenant.id);

  const canEdit = ["owner", "admin"].includes(ctx.currentUserRole ?? "");

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="Settings" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business profile</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            The foundation of your tenant&apos;s &quot;Business Brain&quot;. AI reads this on every
            generation.
          </p>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/t/${ctx.tenant.slug}/onboarding`}>Edit</Link>
          </Button>
        )}
      </div>

      {!profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Not set up yet</CardTitle>
            <CardDescription>
              Complete onboarding to configure your business profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/t/${ctx.tenant.slug}/onboarding`}>Start onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
            <Row label="Business nature">
              <Badge className="uppercase">{profile.businessNature}</Badge>
            </Row>
            <Row label="Industry">{profile.industry || "—"}</Row>
            <Row label="Country">{profile.primaryCountry}</Row>
            <Row label="Currency">{profile.defaultCurrency}</Row>
            <Row label="Language">{profile.defaultLanguage}</Row>
            <Row label="Timezone">{profile.timezone}</Row>
            <Row label="Primary phone">{profile.primaryPhone || "—"}</Row>
            <Row label="Support email">{profile.supportEmail || "—"}</Row>
            <Row label="Website">{profile.websiteUrl || "—"}</Row>
            <Row label="Onboarding">
              {profile.onboardingCompletedAt ? (
                <Badge>Complete</Badge>
              ) : (
                <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)]">
                  Pending
                </Badge>
              )}
            </Row>
            <div className="sm:col-span-2">
              <Row label="Brand voice">
                <span className="whitespace-pre-wrap">
                  {profile.brandVoice || "— (AI will use a friendly neutral tone)"}
                </span>
              </Row>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-1 text-[var(--foreground)]">{children}</div>
    </div>
  );
}
