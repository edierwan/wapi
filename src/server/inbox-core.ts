export type ConversationBucket = {
  phone: string;
  inboundCount: number;
  outboundCount: number;
  lastInboundAt: Date | null;
  lastOutboundAt: Date | null;
};

export type LastMessage = {
  body: string | null;
  at: Date;
};

export type ContactSummary = {
  id: string;
  fullName: string | null;
  status: string | null;
  leadStatus: string | null;
};

export type ConversationSummary = {
  tenantId: string;
  normalizedPhone: string;
  channel: "whatsapp";
  contactId: string | null;
  contactName: string | null;
  contactStatus: string | null;
  contactLeadStatus: string | null;
  lastActivityAt: Date;
  lastMessagePreview: string | null;
  lastDirection: "inbound" | "outbound";
  inboundCount: number;
  outboundCount: number;
  awaitingReplyCount: number;
};

export type TimelineEvent = {
  id: string;
  direction: "inbound" | "outbound";
  channel: "whatsapp";
  occurredAt: Date;
  bodyText: string | null;
  status: string | null;
  providerMessageId: string | null;
  purpose: string | null;
  intent: string | null;
};

export type InboundTimelineRow = {
  id: string;
  bodyText: string | null;
  receivedAt: Date;
  providerMessageId: string | null;
  intent: string | null;
};

export type OutboundTimelineRow = {
  id: string;
  bodyText: string | null;
  sentAt: Date | null;
  createdAt: Date;
  status: string | null;
  providerMessageId: string | null;
  purpose: string | null;
};

export function mergeConversationSummaries(params: {
  tenantId: string;
  buckets: Iterable<ConversationBucket>;
  lastInboundByPhone: ReadonlyMap<string, LastMessage>;
  lastOutboundByPhone: ReadonlyMap<string, LastMessage>;
  awaitingByPhone: ReadonlyMap<string, number>;
  contactByPhone: ReadonlyMap<string, ContactSummary>;
  limit: number;
}): ConversationSummary[] {
  const result: ConversationSummary[] = [];

  for (const bucket of params.buckets) {
    const lastIn = params.lastInboundByPhone.get(bucket.phone);
    const lastOut = params.lastOutboundByPhone.get(bucket.phone);
    const lastActivityAt =
      lastIn && lastOut
        ? lastIn.at > lastOut.at
          ? lastIn.at
          : lastOut.at
        : (lastIn?.at ?? lastOut?.at ?? new Date(0));
    const lastDirection: "inbound" | "outbound" =
      lastIn && lastOut
        ? lastIn.at >= lastOut.at
          ? "inbound"
          : "outbound"
        : lastIn
          ? "inbound"
          : "outbound";
    const lastMessagePreview = (
      lastDirection === "inbound" ? lastIn?.body : lastOut?.body
    )?.slice(0, 160) ?? null;
    const contact = params.contactByPhone.get(bucket.phone);

    result.push({
      tenantId: params.tenantId,
      normalizedPhone: bucket.phone,
      channel: "whatsapp",
      contactId: contact?.id ?? null,
      contactName: contact?.fullName ?? null,
      contactStatus: contact?.status ?? null,
      contactLeadStatus: contact?.leadStatus ?? null,
      lastActivityAt,
      lastMessagePreview,
      lastDirection,
      inboundCount: bucket.inboundCount,
      outboundCount: bucket.outboundCount,
      awaitingReplyCount: params.awaitingByPhone.get(bucket.phone) ?? 0,
    });
  }

  result.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  return result.slice(0, params.limit);
}

export function mergeTimelineEvents(params: {
  inbound: InboundTimelineRow[];
  outbound: OutboundTimelineRow[];
  limit: number;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...params.inbound.map((row) => ({
      id: row.id,
      direction: "inbound" as const,
      channel: "whatsapp" as const,
      occurredAt: new Date(row.receivedAt),
      bodyText: row.bodyText ?? null,
      status: null,
      providerMessageId: row.providerMessageId ?? null,
      purpose: null,
      intent: row.intent ?? null,
    })),
    ...params.outbound.map((row) => ({
      id: row.id,
      direction: "outbound" as const,
      channel: "whatsapp" as const,
      occurredAt: new Date(row.sentAt ?? row.createdAt),
      bodyText: row.bodyText ?? null,
      status: row.status,
      providerMessageId: row.providerMessageId ?? null,
      purpose: row.purpose,
      intent: null,
    })),
  ];

  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return events.slice(0, params.limit);
}