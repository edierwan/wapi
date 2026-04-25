import "server-only";

/**
 * Minimal Dify chat client.
 *
 * Wraps `POST {baseUrl}/v1/chat-messages` per docs/architecture/ai-dify.md.
 * Only the fields WAPI uses are typed; passes the rest through.
 *
 * Conversation key contract (CRITICAL — see ai-dify.md §5):
 *   The `user` field MUST be a WAPI-namespaced key, e.g.
 *     - "tenant:<uuid>:contact:<uuid>"  (chat with contact)
 *     - "tenant:<uuid>:hitl:<userId>"   (operator HITL action)
 *   It MUST NEVER be a bare phone number.
 */

export type DifyChatInput = {
  baseUrl: string;
  apiKey: string;
  /**
   * Namespaced conversation key. Use buildConversationKey() to construct.
   */
  user: string;
  /**
   * Existing dify conversation id, or "" to start a new one.
   */
  conversationId?: string;
  query: string;
  inputs?: Record<string, unknown>;
  /**
   * "blocking" | "streaming". WAPI server-side actions use blocking.
   */
  responseMode?: "blocking" | "streaming";
};

export type DifyChatResult =
  | {
      ok: true;
      answer: string;
      conversationId: string | null;
      messageId: string | null;
      raw: unknown;
    }
  | { ok: false; status: number; error: string };

export async function chatCompletion(
  input: DifyChatInput,
): Promise<DifyChatResult> {
  if (!input.baseUrl) return { ok: false, status: 0, error: "baseUrl is empty" };
  if (!input.apiKey) return { ok: false, status: 0, error: "apiKey is empty" };
  if (!isValidConversationKey(input.user)) {
    return {
      ok: false,
      status: 0,
      error: "user key is not WAPI-namespaced (refusing to call Dify)",
    };
  }

  const url = `${input.baseUrl.replace(/\/$/, "")}/v1/chat-messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        inputs: input.inputs ?? {},
        query: input.query,
        response_mode: input.responseMode ?? "blocking",
        user: input.user,
        conversation_id: input.conversationId ?? "",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const errStr =
        parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : typeof parsed === "string"
            ? parsed.slice(0, 240)
            : `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: errStr };
    }
    const obj = (parsed ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      answer: String(obj.answer ?? ""),
      conversationId: (obj.conversation_id as string | null) ?? null,
      messageId: (obj.message_id as string | null) ?? null,
      raw: parsed,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Build a Dify-safe conversation key. NEVER pass a bare phone here.
 */
export function buildConversationKey(input: {
  tenantId: string;
  contactId?: string | null;
  hitlUserId?: string | null;
  scope?: string;
}): string {
  if (!input.tenantId) throw new Error("tenantId required");
  if (input.hitlUserId) {
    return `tenant:${input.tenantId}:hitl:${input.hitlUserId}`;
  }
  if (input.contactId) {
    return `tenant:${input.tenantId}:contact:${input.contactId}`;
  }
  if (input.scope) {
    return `tenant:${input.tenantId}:scope:${input.scope}`;
  }
  throw new Error(
    "buildConversationKey requires hitlUserId, contactId, or scope",
  );
}

export function isValidConversationKey(key: string): boolean {
  // Must start with `tenant:<uuid-ish>:` and have a non-tenant segment.
  // We don't strictly validate uuid; we just refuse bare phones / empty.
  if (!key) return false;
  if (!key.startsWith("tenant:")) return false;
  const parts = key.split(":");
  if (parts.length < 4) return false;
  // refuse e.g. "tenant:+60123:phone:…" / "tenant::…"
  if (!parts[1]) return false;
  // refuse bare phone-looking second segment
  if (/^\+?\d{6,}$/.test(parts[1])) return false;
  return true;
}
