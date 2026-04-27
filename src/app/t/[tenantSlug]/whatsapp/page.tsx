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
import { getTenantPageSectionLabel } from "@/components/tenant/tenant-nav-items";
import { TenantPage, TenantPageHeader } from "@/components/tenant/tenant-page";
import { requireTenantContext } from "@/server/tenant-guard";
import { getDb, schema } from "@/db/client";
import { isGatewayConfigured } from "@/server/wa-gateway";
import { env } from "@/lib/env";
import {
  connectSessionAction,
  createAccountAction,
  disconnectSessionAction,
  resetSessionAction,
} from "./actions";

export const dynamic = "force-dynamic";

const WRITE_ROLES = new Set(["owner", "admin"]);

type SessionRow = typeof schema.whatsappSessions.$inferSelect;

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
  const sessions = db
    ? await db
        .select()
        .from(schema.whatsappSessions)
        .where(eq(schema.whatsappSessions.tenantId, ctx.tenant.id))
    : [];
  const sessionByAccount = new Map<string, SessionRow>(
    sessions.map((s) => [s.accountId, s]),
  );

  const canWrite = WRITE_ROLES.has(ctx.currentUserRole ?? "");
  const gatewayReady = isGatewayConfigured();

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("WhatsApp")}
        title="WhatsApp"
        description={`Each row is one WhatsApp number = one Baileys session on ${env.WA_GATEWAY_URL || env.WA_GATEWAY_DEFAULT_URL || "wa.getouch.co"}.`}
      />

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a WhatsApp number</CardTitle>
            <CardDescription>
              Creates an account row plus a pending session. Connecting to the
              gateway requires Request 05 to be live; until then the row stays
              in <code>pending</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAccountAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--muted-foreground)]">Display name</span>
                <input
                  required
                  name="displayName"
                  placeholder="Sales line"
                  className="w-64 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </label>
              <Button type="submit">
                <Plus className="size-4" /> Add account
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

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
              . The WAPI-side contract (gateway client wrapper, webhooks,
              session state) is already shipped and waiting.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const sess = sessionByAccount.get(a.id);
            const status = sess?.status ?? "pending";
            return (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {a.displayName}
                    <Badge>{status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {a.phoneNumber ?? "Not paired yet"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-[var(--muted-foreground)]">
                  <div>
                    Gateway:{" "}
                    {a.gatewayUrl ?? env.WA_GATEWAY_URL ?? env.WA_GATEWAY_DEFAULT_URL ?? "—"}
                  </div>
                  {sess?.lastConnectedAt ? (
                    <div>
                      Last connected:{" "}
                      {new Date(sess.lastConnectedAt).toLocaleString()}
                    </div>
                  ) : null}
                  {sess?.lastQrAt ? (
                    <div>Last QR: {new Date(sess.lastQrAt).toLocaleString()}</div>
                  ) : null}
                  {!gatewayReady ? (
                    <div className="rounded-md border border-dashed border-[var(--border)] p-2 text-[11px]">
                      Gateway not configured (<code>WA_GATEWAY_URL</code>).
                      Buttons will not call the gateway, but session state
                      still updates locally for testing.
                    </div>
                  ) : null}

                  {canWrite ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <form action={connectSessionAction}>
                        <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                        <input type="hidden" name="accountId" value={a.id} />
                        <Button type="submit" size="sm">
                          Connect
                        </Button>
                      </form>
                      <form action={resetSessionAction}>
                        <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                        <input type="hidden" name="accountId" value={a.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Reset
                        </Button>
                      </form>
                      <form action={disconnectSessionAction}>
                        <input type="hidden" name="tenantSlug" value={ctx.tenant.slug} />
                        <input type="hidden" name="accountId" value={a.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Disconnect
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </TenantPage>
  );
}
