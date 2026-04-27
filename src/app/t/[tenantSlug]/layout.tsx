import { TenantSidebar } from "@/components/tenant/tenant-sidebar";

export const dynamic = "force-dynamic";

export default async function TenantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <div className="flex w-full">
      <TenantSidebar slug={tenantSlug} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
