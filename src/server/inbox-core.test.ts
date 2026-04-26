import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeConversationSummaries,
  mergeTimelineEvents,
} from "@/server/inbox-core";

test("mergeConversationSummaries preserves tenant+phone identity and prefers inbound on equal timestamps", () => {
  const at = new Date("2026-04-26T10:00:00.000Z");
  const results = mergeConversationSummaries({
    tenantId: "tenant-a",
    buckets: [
      {
        phone: "+60123456789",
        inboundCount: 2,
        outboundCount: 1,
        lastInboundAt: at,
        lastOutboundAt: at,
      },
    ],
    lastInboundByPhone: new Map([
      [
        "+60123456789",
        {
          body: "Inbound wins on ties",
          at,
        },
      ],
    ]),
    lastOutboundByPhone: new Map([
      [
        "+60123456789",
        {
          body: "Outbound loses on ties",
          at,
        },
      ],
    ]),
    awaitingByPhone: new Map([["+60123456789", 2]]),
    contactByPhone: new Map(),
    limit: 10,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.tenantId, "tenant-a");
  assert.equal(results[0]?.normalizedPhone, "+60123456789");
  assert.equal(results[0]?.lastDirection, "inbound");
  assert.equal(results[0]?.lastMessagePreview, "Inbound wins on ties");
  assert.equal(results[0]?.awaitingReplyCount, 2);
  assert.equal(results[0]?.channel, "whatsapp");
});

test("mergeConversationSummaries sorts by latest activity, keeps contact-less conversations, and truncates previews", () => {
  const preview = "x".repeat(180);
  const results = mergeConversationSummaries({
    tenantId: "tenant-a",
    buckets: [
      {
        phone: "+60111111111",
        inboundCount: 1,
        outboundCount: 0,
        lastInboundAt: new Date("2026-04-26T11:00:00.000Z"),
        lastOutboundAt: null,
      },
      {
        phone: "+60222222222",
        inboundCount: 0,
        outboundCount: 1,
        lastInboundAt: null,
        lastOutboundAt: new Date("2026-04-26T09:00:00.000Z"),
      },
    ],
    lastInboundByPhone: new Map([
      [
        "+60111111111",
        {
          body: preview,
          at: new Date("2026-04-26T11:00:00.000Z"),
        },
      ],
    ]),
    lastOutboundByPhone: new Map([
      [
        "+60222222222",
        {
          body: "Outbound preview",
          at: new Date("2026-04-26T09:00:00.000Z"),
        },
      ],
    ]),
    awaitingByPhone: new Map(),
    contactByPhone: new Map([
      [
        "+60222222222",
        {
          id: "contact-2",
          fullName: "Known Contact",
          status: "active",
          leadStatus: "warm",
        },
      ],
    ]),
    limit: 10,
  });

  assert.equal(results[0]?.normalizedPhone, "+60111111111");
  assert.equal(results[0]?.contactId, null);
  assert.equal(results[0]?.contactName, null);
  assert.equal(results[0]?.lastDirection, "inbound");
  assert.equal(results[0]?.lastMessagePreview?.length, 160);
  assert.equal(results[1]?.normalizedPhone, "+60222222222");
  assert.equal(results[1]?.contactName, "Known Contact");
  assert.equal(results[1]?.channel, "whatsapp");
});

test("mergeTimelineEvents merges inbound and outbound into newest-first whatsapp events", () => {
  const events = mergeTimelineEvents({
    inbound: [
      {
        id: "in-1",
        bodyText: "Inbound message",
        receivedAt: new Date("2026-04-26T10:00:00.000Z"),
        providerMessageId: "provider-in",
        intent: "question",
      },
    ],
    outbound: [
      {
        id: "out-1",
        bodyText: "Outbound message",
        sentAt: new Date("2026-04-26T12:00:00.000Z"),
        createdAt: new Date("2026-04-26T11:00:00.000Z"),
        status: "sent",
        providerMessageId: "provider-out",
        purpose: "reply",
      },
    ],
    limit: 10,
  });

  assert.equal(events[0]?.id, "out-1");
  assert.equal(events[0]?.direction, "outbound");
  assert.equal(events[0]?.purpose, "reply");
  assert.equal(events[0]?.channel, "whatsapp");
  assert.equal(events[1]?.id, "in-1");
  assert.equal(events[1]?.direction, "inbound");
  assert.equal(events[1]?.intent, "question");
});