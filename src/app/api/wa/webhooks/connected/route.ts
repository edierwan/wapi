import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { verifyAndParseWebhook } from "@/server/wa-webhook-handler";
import {
  resolveTenantByAccount,
  setSessionStatus,
} from "@/server/whatsapp-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound: gateway confirms a session is fully connected.
 * Body: { accountId, phoneNumber? }
 */
export async function POST(req: NextRequest) {
  const v = await verifyAndParseWebhook<{
    accountId?: string;
    sessionId?: string;
    phoneNumber?: string | null;
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

  await setSessionStatus({ accountId: acc.id, status: "connected" });

  // Optionally backfill the bound phone number on the connected_account row.
  if (v.body.phoneNumber && !acc.phoneNumber) {
    const db = requireDb();
    await db
      .update(schema.connectedAccounts)
      .set({ phoneNumber: v.body.phoneNumber, updatedAt: new Date() })
      .where(eq(schema.connectedAccounts.id, acc.id));
  }

  return NextResponse.json({ ok: true });
}
