import Link from "next/link";
import { and, desc, eq, ne, sql } from "drizzle-orm";
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
import { getDb, schema } from "@/db/client";
import { requireTenantContext } from "@/server/tenant-guard";

export const dynamic = "force-dynamic";

const FRIENDLY_CATEGORIES = [
  {
    name: "Product images",
    description: "Images used in product master data and campaign content.",
    value: "product_image" as const,
  },
  {
    name: "Service images",
    description: "Images shown with services, offers, and booking flows.",
    value: "service_image" as const,
  },
  {
    name: "Campaign media",
    description: "Assets prepared for outbound campaigns and promos.",
    value: "campaign_attachment" as const,
  },
  {
    name: "Contact imports",
    description: "CSV files used to bring contacts into your workspace.",
    value: null,
  },
  {
    name: "Business documents",
    description: "Reference files and internal documents for your workspace.",
    value: null,
  },
  {
    name: "Message attachments",
    description: "Files shared in customer conversations and inbox threads.",
    value: "messages" as const,
  },
  {
    name: "Exports",
    description: "Generated exports and downloadable workspace files.",
    value: "export" as const,
  },
] as const;

export default async function TenantStorageSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const db = getDb();

  const aggregateRows = db
    ? await db
        .select({
          kind: schema.storageObjects.kind,
          count: sql<number>`count(*)::int`,
          size: sql<number>`coalesce(sum(${schema.storageObjects.sizeBytes}), 0)::bigint`,
        })
        .from(schema.storageObjects)
        .where(
          and(
            eq(schema.storageObjects.tenantId, ctx.tenant.id),
            ne(schema.storageObjects.status, "deleted"),
          ),
        )
        .groupBy(schema.storageObjects.kind)
    : [];

  const recentFiles = db
    ? await db
        .select({
          id: schema.storageObjects.id,
          kind: schema.storageObjects.kind,
          contentType: schema.storageObjects.contentType,
          sizeBytes: schema.storageObjects.sizeBytes,
          storageKey: schema.storageObjects.storageKey,
          metadata: schema.storageObjects.metadata,
          createdAt: schema.storageObjects.createdAt,
          uploadedByName: sql<string>`coalesce(${schema.users.name}, ${schema.users.email}, 'Workspace user')`,
        })
        .from(schema.storageObjects)
        .leftJoin(schema.users, eq(schema.storageObjects.uploadedByUserId, schema.users.id))
        .where(
          and(
            eq(schema.storageObjects.tenantId, ctx.tenant.id),
            ne(schema.storageObjects.status, "deleted"),
          ),
        )
        .orderBy(desc(schema.storageObjects.createdAt))
        .limit(10)
    : [];

  const statsByKind = new Map(
    aggregateRows.map((row) => [row.kind, { count: row.count, size: Number(row.size) }]),
  );
  const getCount = (kind: (typeof schema.storageObjects.kind.enumValues)[number]) =>
    statsByKind.get(kind)?.count ?? 0;
  const totalFiles = aggregateRows.reduce((sum, row) => sum + row.count, 0);
  const totalBytes = aggregateRows.reduce((sum, row) => sum + Number(row.size), 0);
  const mediaCount =
    getCount("product_image") +
    getCount("service_image") +
    getCount("campaign_attachment") +
    getCount("chat_media_inbound") +
    getCount("chat_media_outbound");

  const recentRows = recentFiles.map((file) => ({
    id: file.id,
    name: getDisplayFileName(file.storageKey, file.metadata),
    category: getFriendlyCategoryLabel(file.kind),
    type: file.contentType,
    size: formatBytes(file.sizeBytes),
    uploadedBy: file.uploadedByName,
    date: file.createdAt.toLocaleDateString(),
  }));

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Storage")}
        title="Files & Media"
        description="Manage images, documents, imports, and campaign media for this workspace."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Storage used"
          value={totalFiles > 0 ? formatUsage(totalBytes) : "Not calculated yet"}
          description={totalFiles > 0 ? "Tracked from files already uploaded to this workspace." : "Usage tracking arrives soon."}
        />
        <SummaryCard
          title="Files"
          value={`${totalFiles} ${totalFiles === 1 ? "file" : "files"}`}
          description="All files currently linked to this workspace."
        />
        <SummaryCard
          title="Media"
          value={`${mediaCount} ${mediaCount === 1 ? "item" : "items"}`}
          description="Images, videos, and campaign assets stored for customer-facing use."
        />
        <SummaryCard
          title="Imports"
          value="Coming soon"
          description="Import file tracking lands with upload workflows."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
            <CardDescription>
              Organize files by the business area they support.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {FRIENDLY_CATEGORIES.map((category) => (
              <div key={category.name} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-[var(--foreground)]">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                      {category.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                    {category.value === null
                      ? "Coming soon"
                      : category.value === "messages"
                        ? `${getCount("chat_media_inbound") + getCount("chat_media_outbound")} files`
                        : `${getCount(category.value)} files`}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload files</CardTitle>
            <CardDescription>
              Upload product images, documents, CSV imports, and campaign media.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" disabled className="w-full sm:w-auto">
              Upload file
            </Button>
            <p className="text-sm text-[var(--muted-foreground)]">
              Supported later: JPG, PNG, PDF, CSV. Max file size depends on your plan.
            </p>
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-4 text-sm text-[var(--muted-foreground)]">
              Uploads are not enabled yet for tenant workspaces. This section stays visible so your team knows where file management will live.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent files</CardTitle>
          <CardDescription>
            Review the latest files added to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/20 p-6 text-sm text-[var(--muted-foreground)]">
              No files uploaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">File name</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Uploaded by</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((file) => (
                    <tr key={file.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-3 font-medium text-[var(--foreground)]">{file.name}</td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">{file.category}</td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">{file.type}</td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">{file.size}</td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">{file.uploadedBy}</td>
                      <td className="px-3 py-3 text-[var(--muted-foreground)]">{file.date}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" disabled>
                            Preview
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled>
                            Download
                          </Button>
                          <Button type="button" size="sm" variant="ghost" disabled>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy &amp; retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <p>Your workspace files are private. Other workspaces cannot access them.</p>
          <p>Deleted files are removed according to the workspace retention policy.</p>
          <p className="text-xs">
            Reference:{" "}
            <Link className="underline-offset-2 hover:underline" href="/docs">
              docs/architecture/storage.md
            </Link>
          </p>
        </CardContent>
      </Card>
    </TenantPage>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-[var(--muted-foreground)]">
        {description}
      </CardContent>
    </Card>
  );
}

function getFriendlyCategoryLabel(
  kind: (typeof schema.storageObjects.kind.enumValues)[number],
) {
  switch (kind) {
    case "product_image":
      return "Product images";
    case "service_image":
      return "Service images";
    case "campaign_attachment":
      return "Campaign media";
    case "chat_media_inbound":
    case "chat_media_outbound":
      return "Message attachments";
    case "export":
      return "Exports";
    default:
      return "Files";
  }
}

function getDisplayFileName(storageKey: string, metadata: unknown) {
  if (metadata && typeof metadata === "object" && "originalFilename" in metadata) {
    const originalFilename = metadata.originalFilename;
    if (typeof originalFilename === "string" && originalFilename.trim()) {
      return originalFilename;
    }
  }

  const parts = storageKey.split("/").filter(Boolean);
  return parts.at(-1) ?? "Untitled file";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUsage(bytes: number) {
  if (bytes <= 0) return "0 MB stored";
  return `${formatBytes(bytes)} stored`;
}
