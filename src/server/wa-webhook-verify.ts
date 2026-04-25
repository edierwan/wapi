import "server-only";
import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * HMAC verification for inbound gateway webhooks.
 *
 * Contract:
 *  - The gateway computes `HMAC_SHA256(WA_GATEWAY_SECRET, rawBody)` and
 *    sends the hex digest in `x-wapi-signature`.
 *  - WAPI must verify this against the EXACT raw body bytes.
 *  - Comparison must be timing-safe.
 *
 * Returns `true` only when the secret is configured AND the signature
 * matches. Returning `false` in dev when secret is unset is intentional —
 * we do NOT silently accept unauthenticated webhooks even in dev.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): { ok: boolean; reason?: string } {
  const secret = env.WA_GATEWAY_SECRET;
  if (!secret) return { ok: false, reason: "gateway secret not configured" };
  if (!signatureHeader) return { ok: false, reason: "missing signature" };

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Strip optional `sha256=` prefix that some gateways prepend.
  const provided = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const expectedBuf = Buffer.from(expected, "hex");
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(provided, "hex");
  } catch {
    return { ok: false, reason: "malformed signature" };
  }
  if (providedBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "length mismatch" };
  }
  const match = crypto.timingSafeEqual(expectedBuf, providedBuf);
  return match ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

export const WEBHOOK_SIGNATURE_HEADER = "x-wapi-signature";
