import { NextResponse, type NextRequest } from "next/server";
import { verifyAndParseWebhook } from "@/server/wa-webhook-handler";
import {
  resolveTenantByAccount,
  setSessionStatus,
} from "@/server/whatsapp-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound: gateway reports a session has dropped.
 * Body: { accountId, reason? }
 */
export async function POST(req: NextRequest) {
  const v = await verifyAndParseWebhook<{
    accountId?: string;
    sessionId?: string;
    reason?: string;
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

  await setSessionStatus({ accountId: acc.id, status: "disconnected" });
  return NextResponse.json({ ok: true });
}
