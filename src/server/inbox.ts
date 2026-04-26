import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import {
  mergeConversationSummaries,
  mergeTimelineEvents,
  type ConversationSummary,
  type TimelineEvent,
} from "@/server/inbox-core";

/**
 * Phase 8a — Shared inbox read model.
 *
 * Tenant-scoped, channel-agnostic in shape (WhatsApp-only in current
 * runtime). The conversation identity anchor is the Smart Customer
 * Memory key:
 *
 *   (tenant_id, normalized_phone_number)
 *
 * Rationale (see docs/architecture/customer-memory-core.md):
 *   - phone numbers in `inbound_messages.from_phone` and
 *     `message_queue.to_phone` are already E.164-normalized by the
 *     gateway / form layer. We treat them as the canonical normalized
 *     phone and never re-derive identity from them globally — the
 *     tenant_id is always co-keyed.
 *   - we deliberately do NOT introduce a new `conversations` table.
 *     The read model derives groupings by phone+tenant directly from
 *     existing rows. This stays compatible with Phase 8c when
 *     `customer_memory_facts` lands.
 *
 * Channel-agnostic posture:
 *   - the `channel` column on the returned rows is a string literal
 *     'whatsapp' today, but the function signature exposes it so
 *     future channels (Facebook / Instagram / Shopee / Lazada / TikTok)
 *     can plug in by adding their own inbound + outbound tables and
 *     unioning into the same CTEs.
 *   - we never reach into `whatsapp_sessions` to derive identity.
 */

export type { ConversationSummary, TimelineEvent } from "@/server/inbox-core";

/**
 * List all conversations for a tenant.
 *
 * The grouping key is the normalized phone string. We pull a per-key
 * aggregate from inbound_messages and message_queue separately, then
 * merge in the app process. This keeps the SQL simple and lets us
 * reuse the same shape when more channels arrive — each new channel
 * contributes another small aggregate query that merges into the same
 * map.
 */
export async function listConversations(
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<ConversationSummary[]> {
  const db = requireDb();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  // Inbound aggregate per phone.
  const inboundAgg = await db
    .select({
      phone: schema.inboundMessages.fromPhone,
      count: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${schema.inboundMessages.receivedAt})`,
    })
    .from(schema.inboundMessages)
    .where(eq(schema.inboundMessages.tenantId, tenantId))
    .groupBy(schema.inboundMessages.fromPhone);

  // Outbound aggregate per phone. We exclude OTP so the inbox does not
  // surface verification noise; OTPs are not a "conversation".
  const outboundAgg = await db
    .select({
      phone: schema.messageQueue.toPhone,
      count: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(coalesce(${schema.messageQueue.sentAt}, ${schema.messageQueue.createdAt}))`,
    })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.tenantId, tenantId),
        sql`${schema.messageQueue.purpose} <> 'otp'`,
      ),
    )
    .groupBy(schema.messageQueue.toPhone);

  type Bucket = {
    phone: string;
    inboundCount: number;
    outboundCount: number;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
  };
  const byPhone = new Map<string, Bucket>();
  const ensure = (phone: string): Bucket => {
    let b = byPhone.get(phone);
    if (!b) {
      b = {
        phone,
        inboundCount: 0,
        outboundCount: 0,
        lastInboundAt: null,
        lastOutboundAt: null,
      };
      byPhone.set(phone, b);
    }
    return b;
  };
  for (const r of inboundAgg) {
    if (!r.phone) continue;
    const b = ensure(r.phone);
    b.inboundCount = Number(r.count);
    b.lastInboundAt = r.lastAt ? new Date(r.lastAt) : null;
  }
  for (const r of outboundAgg) {
    if (!r.phone) continue;
    const b = ensure(r.phone);
    b.outboundCount = Number(r.count);
    b.lastOutboundAt = r.lastAt ? new Date(r.lastAt) : null;
  }

  if (byPhone.size === 0) return [];

  // Latest message per direction (for preview + last direction).
  // We pull the single most recent message body per phone for inbound and
  // outbound separately, then choose the newer one.
  const phones = Array.from(byPhone.keys());

  const lastInbound = await db
    .select({
      phone: schema.inboundMessages.fromPhone,
      bodyText: schema.inboundMessages.bodyText,
      receivedAt: schema.inboundMessages.receivedAt,
    })
    .from(schema.inboundMessages)
    .where(
      and(
        eq(schema.inboundMessages.tenantId, tenantId),
        sql`${schema.inboundMessages.fromPhone} = any(${phones})`,
        sql`${schema.inboundMessages.receivedAt} = (
          select max(i2.received_at) from inbound_messages i2
          where i2.tenant_id = ${tenantId}
            and i2.from_phone = ${schema.inboundMessages.fromPhone}
        )`,
      ),
    );

  const lastOutbound = await db
    .select({
      phone: schema.messageQueue.toPhone,
      bodyText: schema.messageQueue.bodyText,
      sentAt: schema.messageQueue.sentAt,
      createdAt: schema.messageQueue.createdAt,
    })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.tenantId, tenantId),
        sql`${schema.messageQueue.purpose} <> 'otp'`,
        sql`${schema.messageQueue.toPhone} = any(${phones})`,
        sql`coalesce(${schema.messageQueue.sentAt}, ${schema.messageQueue.createdAt}) = (
          select max(coalesce(q2.sent_at, q2.created_at)) from message_queue q2
          where q2.tenant_id = ${tenantId}
            and q2.to_phone = ${schema.messageQueue.toPhone}
            and q2.purpose <> 'otp'
        )`,
      ),
    );

  const lastInboundByPhone = new Map<string, { body: string | null; at: Date }>();
  for (const r of lastInbound) {
    if (!r.phone || !r.receivedAt) continue;
    lastInboundByPhone.set(r.phone, {
      body: r.bodyText ?? null,
      at: new Date(r.receivedAt),
    });
  }
  const lastOutboundByPhone = new Map<string, { body: string | null; at: Date }>();
  for (const r of lastOutbound) {
    if (!r.phone) continue;
    const at = r.sentAt ?? r.createdAt;
    if (!at) continue;
    lastOutboundByPhone.set(r.phone, {
      body: r.bodyText ?? null,
      at: new Date(at),
    });
  }

  // Awaiting-reply count: inbound after lastOutbound. Computed in SQL
  // for efficiency once we have the lastOutbound map per phone.
  const awaitingByPhone = new Map<string, number>();
  if (phones.length > 0) {
    // Single query: for each phone, count inbound rows where
    // received_at > last_outbound_at (or there is no outbound at all).
    const rows = await db.execute<{ phone: string; awaiting: number }>(sql`
      select i.from_phone as phone, count(*)::int as awaiting
      from inbound_messages i
      where i.tenant_id = ${tenantId}
        and i.from_phone = any(${phones})
        and i.received_at > coalesce(
          (select max(coalesce(q.sent_at, q.created_at)) from message_queue q
            where q.tenant_id = ${tenantId}
              and q.to_phone = i.from_phone
              and q.purpose <> 'otp'),
          'epoch'::timestamptz)
      group by i.from_phone
    `);
    // drizzle's pg execute returns { rows } on node-postgres; postgres-js
    // returns the array directly. Normalize.
    const list = Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows;
    for (const row of list as Array<{ phone: string; awaiting: number }>) {
      awaitingByPhone.set(row.phone, Number(row.awaiting));
    }
  }

  // Contact join. We accept both contact_id-linked and phone-only
  // conversations. A phone with no contact row is still a real
  // conversation (e.g. inbound from a non-imported number).
  const contactRows = await db
    .select({
      id: schema.contacts.id,
      phoneE164: schema.contacts.phoneE164,
      fullName: schema.contacts.fullName,
      status: schema.contacts.status,
      leadStatus: schema.contacts.leadStatus,
    })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        sql`${schema.contacts.phoneE164} = any(${phones})`,
      ),
    );
  const contactByPhone = new Map<string, (typeof contactRows)[number]>();
  for (const c of contactRows) contactByPhone.set(c.phoneE164, c);

  return mergeConversationSummaries({
    tenantId,
    buckets: byPhone.values(),
    lastInboundByPhone,
    lastOutboundByPhone,
    awaitingByPhone,
    contactByPhone,
    limit,
  });
}

/**
 * Look up a single conversation summary for a tenant + normalized phone.
 * Returns null when the tenant has zero rows for that phone. This is the
 * read-only entry point used by the conversation detail page; it never
 * creates rows.
 */
export async function getConversation(
  tenantId: string,
  normalizedPhone: string,
): Promise<ConversationSummary | null> {
  // Cheaper than re-listing: list with a small limit and find the match.
  // For first-cut we lean on listConversations to keep aggregation logic
  // in one place. Optimize later if profiling shows it matters.
  const all = await listConversations(tenantId, { limit: 500 });
  return all.find((c) => c.normalizedPhone === normalizedPhone) ?? null;
}

/**
 * Read the merged inbound + outbound timeline for a single conversation.
 * Read-only. Tenant-scoped. Phone-keyed.
 */
export async function getConversationTimeline(
  tenantId: string,
  normalizedPhone: string,
  opts: { limit?: number } = {},
): Promise<TimelineEvent[]> {
  const db = requireDb();
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);

  const inbound = await db
    .select({
      id: schema.inboundMessages.id,
      bodyText: schema.inboundMessages.bodyText,
      receivedAt: schema.inboundMessages.receivedAt,
      providerMessageId: schema.inboundMessages.providerMessageId,
      intent: schema.inboundMessages.intent,
    })
    .from(schema.inboundMessages)
    .where(
      and(
        eq(schema.inboundMessages.tenantId, tenantId),
        eq(schema.inboundMessages.fromPhone, normalizedPhone),
      ),
    )
    .orderBy(desc(schema.inboundMessages.receivedAt))
    .limit(limit);

  const outbound = await db
    .select({
      id: schema.messageQueue.id,
      bodyText: schema.messageQueue.bodyText,
      sentAt: schema.messageQueue.sentAt,
      createdAt: schema.messageQueue.createdAt,
      status: schema.messageQueue.status,
      providerMessageId: schema.messageQueue.providerMessageId,
      purpose: schema.messageQueue.purpose,
    })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.tenantId, tenantId),
        eq(schema.messageQueue.toPhone, normalizedPhone),
        sql`${schema.messageQueue.purpose} <> 'otp'`,
      ),
    )
    .orderBy(
      desc(sql`coalesce(${schema.messageQueue.sentAt}, ${schema.messageQueue.createdAt})`),
    )
    .limit(limit);

  return mergeTimelineEvents({
    inbound: inbound.map((r) => ({
      id: r.id,
      bodyText: r.bodyText ?? null,
      receivedAt: new Date(r.receivedAt),
      providerMessageId: r.providerMessageId ?? null,
      intent: r.intent ?? null,
    })),
    outbound: outbound.map((r) => ({
      id: r.id,
      bodyText: r.bodyText ?? null,
      sentAt: r.sentAt ? new Date(r.sentAt) : null,
      createdAt: new Date(r.createdAt),
      status: r.status,
      providerMessageId: r.providerMessageId ?? null,
      purpose: r.purpose,
    })),
    limit,
  });
}
