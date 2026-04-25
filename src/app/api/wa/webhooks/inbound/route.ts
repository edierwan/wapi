import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { verifyAndParseWebhook } from "@/server/wa-webhook-handler";
import { resolveTenantByAccount } from "@/server/whatsapp-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound message webhook.
 *
 * Body shape (see docs/architecture/whatsapp-gateway.md):
 *   {
 *     accountId,            // gateway session id == WAPI connected_account id
 *     fromPhone,            // E.164
 *     bodyText,
 *     providerMessageId,
 *     receivedAt?,
 *     payload?              // attachments / template
 *   }
 *
 * Tenancy contract (do NOT change without reading docs/architecture/ai-dify.md
 * §2 "WhatsApp number ownership is tenant-owned"):
 *   sessionId -> accountId -> connected_accounts.tenant_id
 * We never trust phone-number-to-tenant mapping from the request body.
 */
export async function POST(req: NextRequest) {
  const v = await verifyAndParseWebhook<{
    accountId?: string;
    sessionId?: string;
    fromPhone?: string;
    bodyText?: string | null;
    providerMessageId?: string | null;
    receivedAt?: string;
    payload?: unknown;
  }>(req);
  if (!v.ok) return v.response;

  const { fromPhone, bodyText, providerMessageId, receivedAt, payload } = v.body;
  const accountId = v.body.accountId ?? v.body.sessionId;
  if (!accountId || !fromPhone) {
    return NextResponse.json(
      { ok: false, error: "missing accountId or fromPhone" },
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

  // Best-effort contact match by tenant + phone (do NOT auto-create here;
  // contact creation is owned by the contacts module + explicit flows).
  const phoneNorm = String(fromPhone).trim();
  const [contact] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, acc.tenantId),
        eq(schema.contacts.phoneE164, phoneNorm),
      ),
    )
    .limit(1);

  await db.insert(schema.inboundMessages).values({
    tenantId: acc.tenantId,
    accountId: acc.id,
    contactId: contact?.id ?? null,
    fromPhone: phoneNorm,
    bodyText: bodyText ?? null,
    providerMessageId: providerMessageId ?? null,
    receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    payload: (payload as Record<string, unknown>) ?? null,
  });

  return NextResponse.json({ ok: true });
}
