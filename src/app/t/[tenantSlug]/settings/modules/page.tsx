import { AlertTriangle, CheckCircle2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantPageSectionLabel } from "@/components/tenant/tenant-nav-items";
import { TenantPage, TenantPageHeader } from "@/components/tenant/tenant-page";
import { getBusinessProfile } from "@/server/business-profile";
import { requireTenantContext } from "@/server/tenant-guard";
import { listTenantModules } from "@/server/tenant-modules";
import {
  applyIndustryPresetAction,
  toggleTenantModuleAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ModulesSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { tenantSlug } = await params;
  const query = (await searchParams) ?? {};
  const ctx = await requireTenantContext(tenantSlug);
  const canEdit = ["owner", "admin"].includes(ctx.currentUserRole ?? "");
  const [profile, modules] = await Promise.all([
    getBusinessProfile(ctx.tenant.id),
    listTenantModules(ctx.tenant.id),
  ]);
  const disabledModule = firstValue(query.disabled);

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Modules")}
        title="Workspace modules"
        description="Choose which functional modules appear in this tenant workspace. Industry defaults are applied automatically and can be overridden here."
        actions={
          canEdit ? (
            <form action={applyIndustryPresetAction}>
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <Button type="submit" size="sm" variant="outline">
                Apply industry defaults
              </Button>
            </form>
          ) : null
        }
      />

      {disabledModule ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              The {disabledModule} module is currently turned off for this workspace.
              Re-enable it here to restore the page and sidebar entry.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module access</CardTitle>
          <CardDescription>
            {profile?.industry
              ? `Current industry: ${profile.industry}.`
              : "Set an industry in onboarding or Business profile to receive preset recommendations."}{" "}
            Modules hidden here are removed from the tenant sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.map((module) => {
            const enabled = module.enabled;
            return (
              <div
                key={module.code}
                className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                    {enabled ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="size-4 text-[var(--muted-foreground)]" />
                    )}
                    {module.name}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {module.description || "No description yet."}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    {module.source === "manual" ? "Manually overridden" : "Industry preset"}
                  </p>
                </div>

                {canEdit ? (
                  <form action={toggleTenantModuleAction}>
                    <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                    <input type="hidden" name="moduleCode" value={module.code} />
                    <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
                    <Button type="submit" variant={enabled ? "outline" : "default"}>
                      {enabled ? (
                        <>
                          <ToggleLeft className="size-4" />
                          Disable
                        </>
                      ) : (
                        <>
                          <ToggleRight className="size-4" />
                          Enable
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {enabled ? "Enabled" : "Disabled"}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TenantPage>
  );
}