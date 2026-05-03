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

function resolvePlatformBrokerConfig() {
  const baseUrl =
    process.env.PLATFORM_API_URL?.trim() ||
    process.env.GETOUCH_PLATFORM_API_URL?.trim() ||
    "";
  const platformAppKey =
    process.env.PLATFORM_APP_KEY?.trim() ||
    process.env.GETOUCH_PLATFORM_APP_KEY?.trim() ||
    "";

  return {
    baseUrl,
    platformAppKey,
    configured: Boolean(baseUrl && platformAppKey),
  };
}

export function isPlatformBrokerConfigured(): boolean {
  return resolvePlatformBrokerConfig().configured;
}

function formatPlatformBrokerError(status: number, detail: string): string {
  if (status === 401 || status === 403) {
    return "Platform broker auth failed. Check WAPI Coolify env and portal app key.";
  }
  if (detail) {
    return `Platform broker send failed. ${detail}`;
  }
  return `Platform broker send failed (HTTP ${status}).`;
}

export async function sendOtpViaProvider(input: {
  phone: string;
  code: string;
  purpose?: string;
  businessName?: string;
}): Promise<OtpSendResult> {
  const provider = process.env.OTP_PROVIDER || "whatsapp_gateway";
  const devFallback = process.env.ENABLE_DEV_OTP_FALLBACK === "true";
  const usePlatformBroker = process.env.USE_PLATFORM_BROKER === "true";
  const requirePlatformAppKey = process.env.REQUIRE_PLATFORM_APP_KEY === "true";
  const brokerConfig = resolvePlatformBrokerConfig();

  const text =
    input.purpose === "password_reset"
      ? `Your WAPI password reset code is ${input.code}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. Do not share this code.`
      : `Your WAPI verification code is ${input.code}. It expires in ${process.env.OTP_EXPIRES_MINUTES || 10} minutes. Do not share this code.`;

  if (brokerConfig.configured) {
    const { baseUrl, platformAppKey } = brokerConfig;

    const endpoint = input.purpose === "password_reset"
      ? "/whatsapp/send-message"
      : "/whatsapp/send-otp";

    const requestBody = input.purpose === "password_reset"
      ? {
          to: input.phone,
          message: text,
          purpose: input.purpose || "otp",
        }
      : {
          to: input.phone,
          code: input.code,
          business_name: input.businessName || "WAPI",
        };

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-platform-app-key": platformAppKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(10_000),
      });

      const rawBody = await res.text().catch(() => "");
      let jsonBody: Record<string, unknown> | null = null;
      if (rawBody) {
        try {
          jsonBody = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          jsonBody = null;
        }
      }

      if (!res.ok) {
        const detail = jsonBody && typeof jsonBody.message === "string"
          ? jsonBody.message
          : jsonBody && typeof jsonBody.error === "string"
            ? jsonBody.error
            : rawBody.slice(0, 200);
        return {
          ok: devFallback && !requirePlatformAppKey,
          providerMessageId: null,
          error: formatPlatformBrokerError(res.status, detail),
          debugCode: devFallback && !requirePlatformAppKey ? input.code : undefined,
        };
      }

      const providerMessageId = jsonBody
        ? (jsonBody.message_id as string) ?? (jsonBody.messageId as string) ?? (jsonBody.id as string) ?? null
        : null;

      return {
        ok: true,
        providerMessageId,
        debugCode: devFallback ? input.code : undefined,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: devFallback && !requirePlatformAppKey,
        providerMessageId: null,
        error: formatPlatformBrokerError(0, detail),
        debugCode: devFallback && !requirePlatformAppKey ? input.code : undefined,
      };
    }
  }

  if (provider === "whatsapp_gateway" || usePlatformBroker) {
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
        error: "WhatsApp delivery is not configured.",
      };
    }

    const secret = process.env.WA_GATEWAY_SECRET || "";
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/send-text`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-api-key": secret } : {}),
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
          ok: devFallback,
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
        ok: devFallback,
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
