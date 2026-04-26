import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { getCampaign, listVariants } from "@/server/campaigns";

/**
 * Campaign dispatcher.
 *
 * Inserts `message_queue` rows for the campaign's pending recipients.
 * The actual send is performed by `scripts/worker-outbound.ts` (or any
 * future long-running worker) — this module never talks to a gateway
 * directly.
 *
 * Channel note: today every connected account is WhatsApp via the shared
 * gateway, so the active account is selected from `connected_accounts`.
 * When other channels arrive, the account picker becomes channel-aware.
 * The queue itself is already channel-agnostic (it stores `to_phone` and
 * `payload`); FB/IG/marketplace channels would add their own routing
 * fields, not replace this table.
 */

export async function dispatchCampaign(input: {
  tenantId: string;
  campaignId: string;
  accountId: string;
  scheduledAt?: Date | null;
}): Promise<{ queued: number; skipped: number }> {
  const db = requireDb();

  // Tenant guard: campaign must belong to tenant.
  const campaign = await getCampaign(input.tenantId, input.campaignId);
  if (!campaign) throw new Error("campaign not found for tenant");

  // Tenant guard: account must belong to tenant.
  const [account] = await db
    .select()
    .from(schema.connectedAccounts)
    .where(
      and(
        eq(schema.connectedAccounts.id, input.accountId),
        eq(schema.connectedAccounts.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (!account) throw new Error("account not found for tenant");

  const variants = await listVariants(input.tenantId, input.campaignId);
  if (variants.length === 0) throw new Error("campaign has no variants");
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const fallbackVariant = variants[0]!;

  // Pull pending recipients (un-queued only).
  const pending = await db
    .select({
      id: schema.campaignRecipients.id,
      contactId: schema.campaignRecipients.contactId,
      variantId: schema.campaignRecipients.variantId,
      contactPhone: schema.contacts.phoneE164,
      contactStatus: schema.contacts.status,
    })
    .from(schema.campaignRecipients)
    .innerJoin(
      schema.contacts,
      eq(schema.campaignRecipients.contactId, schema.contacts.id),
    )
    .innerJoin(
      schema.campaigns,
      eq(schema.campaignRecipients.campaignId, schema.campaigns.id),
    )
    .where(
      and(
        eq(schema.campaigns.tenantId, input.tenantId),
        eq(schema.campaignRecipients.campaignId, input.campaignId),
        eq(schema.campaignRecipients.status, "pending"),
        isNull(schema.campaignRecipients.queueId),
      ),
    );

  const scheduled = input.scheduledAt ?? new Date();
  let queued = 0;
  let skipped = 0;

  for (const r of pending) {
    if (r.contactStatus !== "active") {
      await db
        .update(schema.campaignRecipients)
        .set({
          status: "excluded",
          excludedReason: `contact_status:${r.contactStatus}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaignRecipients.id, r.id));
      skipped++;
      continue;
    }
    const variant = (r.variantId ? variantById.get(r.variantId) : null) ?? fallbackVariant;
    const [queueRow] = await db
      .insert(schema.messageQueue)
      .values({
        tenantId: input.tenantId,
        accountId: input.accountId,
        contactId: r.contactId,
        campaignId: input.campaignId,
        toPhone: r.contactPhone,
        purpose: "campaign",
        status: "queued",
        bodyText: variant.bodyText,
        scheduledAt: scheduled,
      })
      .returning({ id: schema.messageQueue.id });

    await db
      .update(schema.campaignRecipients)
      .set({
        queueId: queueRow!.id,
        variantId: variant.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaignRecipients.id, r.id));
    queued++;
  }

  return { queued, skipped };
}
