import "server-only";
import { getCampaign } from "@/server/campaigns";
import { assembleTenantContext, contextToDifyInputs } from "@/server/ai-context";
import { getTenantProviderWithSecret } from "@/server/ai-providers";
import { buildConversationKey, chatCompletion } from "@/server/dify-client";

/**
 * AI-assisted variant suggestion for campaigns (HITL).
 *
 * The flow: WAPI assembles tenant-scoped context, asks the tenant's
 * configured Dify app for a draft variant body, and returns the text
 * to the caller. The caller decides whether to persist it as a draft
 * `campaign_variants` row (`is_ai_generated=true`) for human review,
 * edit, or deletion before scheduling. Nothing is sent automatically.
 *
 * Critical invariants:
 *   - Conversation key is `tenant:<id>:scope:campaign:<id>:variant`.
 *     Never a bare phone, never cross-tenant.
 *   - Tenant context is always tenant-scoped (`assembleTenantContext`
 *     filters by `tenant_id`); Dify receives no other tenant's data.
 *   - If the tenant has no provider configured, returns a structured
 *     "not_configured" error rather than throwing.
 */

export type SuggestVariantResult =
  | { ok: true; suggestion: string; conversationId: string | null }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "no_base_url"
        | "no_campaign"
        | "provider_error";
      error?: string;
    };

export async function suggestVariant(input: {
  tenantId: string;
  campaignId: string;
  prompt?: string;
}): Promise<SuggestVariantResult> {
  const campaign = await getCampaign(input.tenantId, input.campaignId);
  if (!campaign) return { ok: false, reason: "no_campaign" };

  const provider = await getTenantProviderWithSecret(input.tenantId);
  if (!provider) return { ok: false, reason: "not_configured" };
  if (!provider.baseUrl) return { ok: false, reason: "no_base_url" };
  if (provider.kind !== "dify") {
    // Future: route to other providers. For now only Dify is supported
    // for variant suggestions.
    return { ok: false, reason: "not_configured" };
  }

  const ctx = await assembleTenantContext(input.tenantId);
  const inputs = contextToDifyInputs(ctx, {
    campaign_name: campaign.name,
    campaign_objective: campaign.objective ?? "promo",
    send_mode: campaign.sendMode,
  });

  const userPrompt =
    input.prompt?.trim() ||
    `Draft a single short outbound message for the campaign "${campaign.name}". ` +
      `Objective: ${campaign.objective ?? "promo"}. ` +
      `Keep it under 600 characters, friendly, and include a clear next step. ` +
      `End with a one-line opt-out instruction (e.g. reply STOP).`;

  const conversationKey = buildConversationKey({
    tenantId: input.tenantId,
    scope: `campaign:${input.campaignId}:variant`,
  });

  const result = await chatCompletion({
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    user: conversationKey,
    query: userPrompt,
    inputs,
    responseMode: "blocking",
  });

  if (!result.ok) {
    return { ok: false, reason: "provider_error", error: result.error };
  }
  return {
    ok: true,
    suggestion: result.answer.trim(),
    conversationId: result.conversationId,
  };
}
