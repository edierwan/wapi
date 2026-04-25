"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  assembleTenantContext,
  contextToDifyInputs,
} from "@/server/ai-context";
import { getTenantProviderWithSecret } from "@/server/ai-providers";
import {
  buildConversationKey,
  chatCompletion,
} from "@/server/dify-client";

const writeRoles = new Set(["owner", "admin", "agent"]);

const draftSchema = z.object({
  tenantSlug: z.string(),
  customerMessage: z.string().min(1).max(4000),
  task: z
    .enum(["draft_reply", "summarize", "classify_intent"])
    .optional()
    .default("draft_reply"),
});

export type DraftReplyState = {
  ok: boolean;
  error?: string;
  draft?: string;
  /** safe metadata for the UI */
  meta?: {
    providerName: string;
    conversationKey: string;
    latencyMs: number;
  };
};

/**
 * Manual HITL action: assemble tenant-scoped context, call the resolved
 * Dify provider, and return a draft reply. NEVER persists. The user must
 * copy the draft into a real reply / message.
 *
 * Conversation key uses `tenant:<id>:hitl:<userId>` so this never mixes
 * with contact-level Dify conversations.
 */
export async function draftReplyAction(
  _prev: DraftReplyState | undefined,
  formData: FormData,
): Promise<DraftReplyState> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const parsed = draftSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const ctx = await resolveTenantBySlug({
    slug: data.tenantSlug,
    currentUserId: me.id,
  });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    return { ok: false, error: "You do not have permission to use AI drafts." };
  }

  const provider = await getTenantProviderWithSecret(ctx.tenant.id);
  if (!provider) {
    return {
      ok: false,
      error:
        "No AI provider configured for this tenant. Set up tenant_ai_settings or a default ai_provider_configs row first.",
    };
  }
  if (provider.kind !== "dify") {
    return {
      ok: false,
      error: `Provider kind '${provider.kind}' is not yet wired in this tranche.`,
    };
  }
  if (!provider.baseUrl) {
    return { ok: false, error: "Provider has no base_url configured." };
  }

  const tenantCtx = await assembleTenantContext(ctx.tenant.id);
  const conversationKey = buildConversationKey({
    tenantId: ctx.tenant.id,
    hitlUserId: me.id,
  });

  const start = Date.now();
  const result = await chatCompletion({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    user: conversationKey,
    query: data.customerMessage,
    inputs: contextToDifyInputs(tenantCtx, {
      task: data.task,
      latest_customer_message: data.customerMessage,
    }),
    responseMode: "blocking",
  });
  const latencyMs = Date.now() - start;

  if (!result.ok) {
    return {
      ok: false,
      error: `Dify error (${result.status}): ${result.error}`,
    };
  }

  return {
    ok: true,
    draft: result.answer,
    meta: {
      providerName: provider.name,
      conversationKey,
      latencyMs,
    },
  };
}
