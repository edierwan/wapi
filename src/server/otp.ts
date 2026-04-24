import "server-only";
import crypto from "node:crypto";

export type OtpSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  /**
   * In development, when ENABLE_DEV_OTP_FALLBACK=true, we echo the raw code
   * back to the server caller so it can surface it to the dev UI. NEVER set
   * in production.
   */
  debugCode?: string;
  error?: string;
};

export async function sendOtpViaProvider(input: {
  phone: string;
  code: string;
  purpose?: string;
}): Promise<OtpSendResult> {
  const provider = process.env.OTP_PROVIDER || "whatsapp_gateway";
  const devFallback = process.env.ENABLE_DEV_OTP_FALLBACK === "true";

  const text =
    `Your WAPI verification code is ${input.code}. ` +
    `It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. ` +
    `Do not share this code.`;

  if (provider === "whatsapp_gateway") {
    const base = process.env.WA_GATEWAY_URL || process.env.WA_GATEWAY_DEFAULT_URL;
    if (!base) {
      // Gateway not configured → dev fallback or hard fail.
      if (devFallback) {
        return {
          ok: true,
          providerMessageId: null,
          debugCode: input.code,
        };
      }
      return {
        ok: false,
        providerMessageId: null,
        error: "WhatsApp gateway is not configured.",
      };
    }

    const secret = process.env.WA_GATEWAY_SECRET || "";
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-wapi-secret": secret } : {}),
        },
        body: JSON.stringify({
          to: input.phone,
          text,
          purpose: input.purpose || "otp",
        }),
        // Reasonable timeout for server-to-server
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          providerMessageId: null,
          error: `Gateway responded ${res.status}: ${body.slice(0, 200)}`,
          debugCode: devFallback ? input.code : undefined,
        };
      }
      let providerMessageId: string | null = null;
      try {
        const json = (await res.json()) as Record<string, unknown>;
        providerMessageId =
          (json.id as string) ??
          (json.messageId as string) ??
          (json.message_id as string) ??
          null;
      } catch {
        /* gateway returned non-JSON; that's ok */
      }
      return {
        ok: true,
        providerMessageId,
        debugCode: devFallback ? input.code : undefined,
      };
    } catch (err) {
      return {
        ok: false,
        providerMessageId: null,
        error: err instanceof Error ? err.message : String(err),
        debugCode: devFallback ? input.code : undefined,
      };
    }
  }

  if (provider === "dev_console") {
    // Never prints the code; only acknowledges.
    if (devFallback) {
      return { ok: true, providerMessageId: null, debugCode: input.code };
    }
    return {
      ok: false,
      providerMessageId: null,
      error: "dev_console provider requires ENABLE_DEV_OTP_FALLBACK=true.",
    };
  }

  return {
    ok: false,
    providerMessageId: null,
    error: `Unknown OTP provider: ${provider}`,
  };
}

export function generateOtpCode(): string {
  // 4-digit numeric. Using crypto so it's not predictable.
  const n = crypto.randomInt(0, 10_000);
  return String(n).padStart(4, "0");
}

export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
