import { eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Smartphone } from "lucide-react";
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
import { getDb, schema } from "@/db/client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function WhatsAppAccountsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);
  const db = getDb();
  const accounts = db
    ? await db
        .select()
        .from(schema.connectedAccounts)
        .where(eq(schema.connectedAccounts.tenantId, ctx.tenant.id))
    : [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <TenantSubNav slug={ctx.tenant.slug} active="WhatsApp" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp accounts</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Each row is one WhatsApp number = one Baileys session on{" "}
            <code className="text-xs">
              {env.WA_GATEWAY_DEFAULT_URL || "wa.getouch.co"}
            </code>
            .
          </p>
        </div>
        <Button disabled title="Available once gateway multi-tenancy is live (request #05)">
          <Plus className="size-4" /> Connect number
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
              <Smartphone className="size-5" />
            </div>
            <CardTitle>No numbers connected yet</CardTitle>
            <CardDescription>
              Connecting a number requires the shared WhatsApp gateway to be
              upgraded for multi-tenancy. See{" "}
              <Link
                href="https://github.com/edierwan/wapi/blob/develop/docs/request/05-wa-gateway-multitenancy.md"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                request #05
              </Link>
              . Until then, the row is pre-seeded via SQL for testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted-foreground)]">
            Phase 5 ships: QR pairing, session health, test send. Phase 6 ships:
            campaign sending via safe queue.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  {a.displayName}
                  <Badge>{a.isActive ? "active" : "inactive"}</Badge>
                </CardTitle>
                <CardDescription>
                  {a.phoneNumber ?? "Not paired yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-[var(--muted-foreground)]">
                Gateway: {a.gatewayUrl ?? env.WA_GATEWAY_DEFAULT_URL ?? "—"}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
