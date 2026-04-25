import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { verifyAndParseWebhook } from "@/server/wa-webhook-handler";
import { resolveTenantByAccount } from "@/server/whatsapp-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Outbound message status webhook.
 *
 * Body: {
 *   accountId,
 *   externalRef,           // message_queue.id (echoed by sendText())
 *   providerMessageId?,
 *   status: "sent" | "delivered" | "read" | "failed",
 *   failureReason?
 * }
 */
type Body = {
  accountId?: string;
  sessionId?: string;
  externalRef?: string;
  providerMessageId?: string | null;
  status?: "sent" | "delivered" | "read" | "failed";
  failureReason?: string | null;
};

export async function POST(req: NextRequest) {
  const v = await verifyAndParseWebhook<Body>(req);
  if (!v.ok) return v.response;

  const { externalRef, providerMessageId, status, failureReason } = v.body;
  const accountId = v.body.accountId ?? v.body.sessionId;
  if (!accountId || !externalRef || !status) {
    return NextResponse.json(
      { ok: false, error: "missing accountId, externalRef, or status" },
      { status: 400 },
    );
  }

  const acc = await resolveTenantByAccount(accountId);
  if (!acc) {
    return NextResponse.json(
      { ok: false, error: "unknown account" },
      { status: 404 },
    );
  }

  const db = requireDb();
  // Tenant-scoped guard: the queue row must belong to the same tenant as
  // the resolved account. We do NOT trust the gateway to honor tenancy.
  const [row] = await db
    .select({
      id: schema.messageQueue.id,
      tenantId: schema.messageQueue.tenantId,
    })
    .from(schema.messageQueue)
    .where(eq(schema.messageQueue.id, externalRef))
    .limit(1);

  if (!row || row.tenantId !== acc.tenantId) {
    return NextResponse.json(
      { ok: false, error: "queue row not found for tenant" },
      { status: 404 },
    );
  }

  const patch: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (providerMessageId) patch.providerMessageId = providerMessageId;
  if (status === "sent") patch.sentAt = new Date();
  if (status === "delivered") patch.deliveredAt = new Date();
  if (status === "read") patch.readAt = new Date();
  if (status === "failed") {
    patch.failedAt = new Date();
    if (failureReason) patch.failureReason = failureReason;
  }

  await db
    .update(schema.messageQueue)
    .set(patch)
    .where(eq(schema.messageQueue.id, externalRef));

  return NextResponse.json({ ok: true });
}
