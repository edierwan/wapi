import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { verifyAndParseWebhook } from "@/server/wa-webhook-handler";
import {
  recordQr,
  resolveTenantByAccount,
} from "@/server/whatsapp-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound: gateway emitted a fresh QR for an account session.
 *
 * Body: { accountId, qr } where `qr` is the QR data string (we do NOT
 * persist QR bodies; clients must poll the gateway for the latest QR).
 */
export async function POST(req: NextRequest) {
  const v = await verifyAndParseWebhook<{
    accountId?: string;
    sessionId?: string;
  }>(req);
  if (!v.ok) return v.response;

  const accountId = v.body.accountId ?? v.body.sessionId;
  if (!accountId)
    return NextResponse.json(
      { ok: false, error: "missing accountId" },
      { status: 400 },
    );

  const acc = await resolveTenantByAccount(accountId);
  if (!acc)
    return NextResponse.json(
      { ok: false, error: "unknown account" },
      { status: 404 },
    );

  // Ensure session row exists, then mark as connecting + lastQrAt=now.
  const db = requireDb();
  const [existing] = await db
    .select()
    .from(schema.whatsappSessions)
    .where(
      and(
        eq(schema.whatsappSessions.tenantId, acc.tenantId),
        eq(schema.whatsappSessions.accountId, acc.id),
      ),
    )
    .limit(1);
  if (!existing) {
    await db.insert(schema.whatsappSessions).values({
      tenantId: acc.tenantId,
      accountId: acc.id,
      status: "connecting",
      lastQrAt: new Date(),
    });
  } else {
    await recordQr(acc.id);
  }
  return NextResponse.json({ ok: true });
}
