import { TenantSidebar } from "@/components/tenant/tenant-sidebar";
import { requireTenantContext } from "@/server/tenant-guard";
import { getEnabledTenantModuleCodes } from "@/server/tenant-modules";

export const dynamic = "force-dynamic";

export default async function TenantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const enabledModules = await getEnabledTenantModuleCodes(ctx.tenant.id);

  return (
    <div className="flex w-full">
      <TenantSidebar
        slug={tenantSlug}
        displayName={ctx.tenant.name?.trim() || ctx.tenant.slug}
        enabledModules={enabledModules}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
