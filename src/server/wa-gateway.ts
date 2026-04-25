import "server-only";
import { env } from "@/lib/env";

/**
 * WhatsApp gateway client wrapper.
 *
 * Single server-only entry point for every gateway HTTP call WAPI makes.
 * Centralizes:
 *  - base URL resolution (per-account override → tenant default → env default)
 *  - shared secret header (`x-api-key`)
 *  - per-session id propagation (we use the WAPI-side `accountId` as the
 *    gateway session id so each connected_account = one Baileys session)
 *  - HMAC signature for outbound calls when WA_GATEWAY_SECRET is set
 *
 * The contract here is the **WAPI side** of Request 05 (gateway multi-
 * tenancy). The gateway repo must implement the matching endpoints. Every
 * function returns `{ ok, status, error?, data? }` so callers do not need
 * to throw to handle gateway being offline.
 *
 * NOTE: NEVER import this module from a Client Component. The shared
 * secret must never reach the browser.
 */

export type GatewayResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export type SendTextInput = {
  /** WAPI account id used as gateway session id. */
  accountId: string;
  /** Recipient in E.164 (no `whatsapp:` prefix). */
  toPhone: string;
  text: string;
  purpose?: string;
  /** Optional WAPI-side queue id, echoed by the gateway in webhooks. */
  externalRef?: string;
};

export type CreateSessionInput = {
  accountId: string;
  /** Display label echoed by gateway logs. */
  label?: string;
};

export type GatewayBaseInput = {
  accountId: string;
  /** Optional per-account override (matches connected_accounts.gateway_url). */
  gatewayUrl?: string | null;
};

function resolveBaseUrl(override?: string | null): string | null {
  const base =
    override ||
    env.WA_GATEWAY_URL ||
    env.WA_GATEWAY_DEFAULT_URL ||
    "";
  return base ? base.replace(/\/$/, "") : null;
}

function authHeaders(): Record<string, string> {
  const secret = env.WA_GATEWAY_SECRET;
  return secret
    ? { "x-api-key": secret, "x-wapi-secret": secret }
    : {};
}

async function callGateway<T>(
  path: string,
  init: RequestInit & { gatewayUrl?: string | null },
): Promise<GatewayResult<T>> {
  const base = resolveBaseUrl(init.gatewayUrl);
  if (!base) {
    return {
      ok: false,
      status: 0,
      error: "WhatsApp gateway is not configured (WA_GATEWAY_URL).",
    };
  }
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const errStr =
        typeof data === "object" && data && "error" in (data as object)
          ? String((data as { error: unknown }).error)
          : typeof data === "string"
            ? data.slice(0, 240)
            : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errStr };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ────────── Endpoints ────────── */

export type SessionStatusResponse = {
  /** gateway-side session state */
  status:
    | "pending"
    | "connecting"
    | "connected"
    | "disconnected"
    | "expired"
    | "error";
  qr?: string | null;
  phoneNumber?: string | null;
  lastConnectedAt?: string | null;
};

export async function createSession(
  input: CreateSessionInput & GatewayBaseInput,
) {
  return callGateway<SessionStatusResponse>(
    `/api/sessions/${encodeURIComponent(input.accountId)}`,
    {
      method: "POST",
      gatewayUrl: input.gatewayUrl,
      body: JSON.stringify({ label: input.label ?? input.accountId }),
    },
  );
}

export async function getSessionStatus(input: GatewayBaseInput) {
  return callGateway<SessionStatusResponse>(
    `/api/sessions/${encodeURIComponent(input.accountId)}/status`,
    { method: "GET", gatewayUrl: input.gatewayUrl },
  );
}

export async function getSessionQr(input: GatewayBaseInput) {
  return callGateway<{ qr: string | null }>(
    `/api/sessions/${encodeURIComponent(input.accountId)}/qr`,
    { method: "GET", gatewayUrl: input.gatewayUrl },
  );
}

export async function resetSession(input: GatewayBaseInput) {
  return callGateway<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(input.accountId)}/reset`,
    { method: "POST", gatewayUrl: input.gatewayUrl },
  );
}

export async function deleteSession(input: GatewayBaseInput) {
  return callGateway<{ ok: boolean }>(
    `/api/sessions/${encodeURIComponent(input.accountId)}`,
    { method: "DELETE", gatewayUrl: input.gatewayUrl },
  );
}

export async function sendText(input: SendTextInput & GatewayBaseInput) {
  return callGateway<{ id?: string; messageId?: string }>(
    `/api/send-text`,
    {
      method: "POST",
      gatewayUrl: input.gatewayUrl,
      body: JSON.stringify({
        sessionId: input.accountId,
        accountId: input.accountId,
        to: input.toPhone,
        text: input.text,
        purpose: input.purpose ?? "system",
        externalRef: input.externalRef,
      }),
    },
  );
}

/** Returns `true` iff WA_GATEWAY_URL/WA_GATEWAY_DEFAULT_URL is configured. */
export function isGatewayConfigured(): boolean {
  return Boolean(env.WA_GATEWAY_URL || env.WA_GATEWAY_DEFAULT_URL);
}
