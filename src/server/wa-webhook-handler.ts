import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/server/wa-webhook-verify";

/**
 * Verifies the HMAC signature on a gateway webhook and returns the parsed
 * JSON body. Returns a 401 NextResponse on any verification failure.
 *
 * Usage (in route handlers):
 *
 *   const v = await verifyAndParseWebhook(req);
 *   if (!v.ok) return v.response;
 *   const payload = v.body;
 */
export async function verifyAndParseWebhook<T = unknown>(
  req: NextRequest,
): Promise<
  | { ok: true; body: T; rawBody: string }
  | { ok: false; response: NextResponse }
> {
  const rawBody = await req.text();
  const sig = req.headers.get(WEBHOOK_SIGNATURE_HEADER);
  const verdict = verifyWebhookSignature(rawBody, sig);
  if (!verdict.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: verdict.reason ?? "invalid signature" },
        { status: 401 },
      ),
    };
  }
  let body: T;
  try {
    body = rawBody ? (JSON.parse(rawBody) as T) : ({} as T);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "invalid json" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, body, rawBody };
}
