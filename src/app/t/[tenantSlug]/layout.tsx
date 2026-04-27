import { TenantSidebar } from "@/components/tenant/tenant-sidebar";
import { requireTenantContext } from "@/server/tenant-guard";

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

  return (
    <div className="flex w-full">
      <TenantSidebar
        slug={tenantSlug}
        displayName={ctx.tenant.name?.trim() || ctx.tenant.slug}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
