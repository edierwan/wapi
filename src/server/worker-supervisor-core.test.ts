import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHeartbeat,
  classifyHeartbeat,
  buildHeartbeat,
  formatAge,
  DEFAULT_STALE_AFTER_MS,
} from "@/server/worker-supervisor-core";

test("parseHeartbeat rejects garbage and accepts a well-formed object", () => {
  assert.equal(parseHeartbeat(null), null);
  assert.equal(parseHeartbeat({}), null);
  assert.equal(parseHeartbeat({ name: "x" }), null);
  assert.equal(
    parseHeartbeat({
      name: "outbound",
      pid: 1,
      runMode: "loop",
      lastTickAt: "2026-04-26T10:00:00.000Z",
      startedAt: "2026-04-26T09:00:00.000Z",
      lastDurationMs: 10,
      totalTicks: 0,
      totalErrors: 0,
      lastError: null,
      lastCounts: { claimed: "not-a-number", sent: 3 },
    })?.lastCounts.sent,
    3,
    "non-numeric counts are dropped, numeric kept",
  );
  assert.equal(
    parseHeartbeat({
      name: "outbound",
      pid: 1,
      runMode: "bogus",
      lastTickAt: "x",
      startedAt: "x",
      lastDurationMs: 0,
      totalTicks: 0,
      totalErrors: 0,
    }),
    null,
    "rejects invalid runMode",
  );
});

test("classifyHeartbeat marks missing as missing", () => {
  const status = classifyHeartbeat(null, "outbound", new Date());
  assert.equal(status.state, "missing");
  assert.equal(status.heartbeat, null);
  assert.equal(status.ageMs, null);
});

test("classifyHeartbeat marks fresh heartbeat as ok", () => {
  const now = new Date("2026-04-26T10:00:00.000Z");
  const hb = buildHeartbeat({
    name: "outbound",
    pid: 1,
    runMode: "loop",
    startedAt: new Date(now.getTime() - 60_000),
    lastTickAt: new Date(now.getTime() - 5_000),
    lastDurationMs: 12,
    totalTicks: 4,
    totalErrors: 0,
    lastError: null,
    lastCounts: { claimed: 0 },
  });
  const status = classifyHeartbeat(hb, "outbound", now);
  assert.equal(status.state, "ok");
  assert.equal(status.ageMs, 5_000);
});

test("classifyHeartbeat marks stale heartbeat as stale based on threshold", () => {
  const now = new Date("2026-04-26T10:00:00.000Z");
  const hb = buildHeartbeat({
    name: "outbound",
    pid: 1,
    runMode: "loop",
    startedAt: new Date(now.getTime() - 600_000),
    lastTickAt: new Date(now.getTime() - (DEFAULT_STALE_AFTER_MS + 1_000)),
    lastDurationMs: 12,
    totalTicks: 4,
    totalErrors: 0,
    lastError: null,
    lastCounts: {},
  });
  const status = classifyHeartbeat(hb, "outbound", now);
  assert.equal(status.state, "stale");
  assert.ok((status.ageMs ?? 0) > DEFAULT_STALE_AFTER_MS);
});

test("classifyHeartbeat surfaces a recent error before stale check", () => {
  const now = new Date("2026-04-26T10:00:00.000Z");
  const hb = buildHeartbeat({
    name: "follow-ups",
    pid: 9,
    runMode: "loop",
    startedAt: new Date(now.getTime() - 60_000),
    lastTickAt: new Date(now.getTime() - 5_000),
    lastDurationMs: 12,
    totalTicks: 1,
    totalErrors: 1,
    lastError: "boom",
    lastCounts: {},
  });
  const status = classifyHeartbeat(hb, "follow-ups", now);
  assert.equal(status.state, "errored");
  assert.match(status.note, /boom/);
});

test("classifyHeartbeat tolerates a custom expectedName even if heartbeat name differs", () => {
  // Identity is anchored on the caller's expected name; a misnamed
  // heartbeat (e.g. an old worker file) should not impersonate it.
  const now = new Date("2026-04-26T10:00:00.000Z");
  const hb = buildHeartbeat({
    name: "totally-different",
    pid: 1,
    runMode: "loop",
    startedAt: new Date(now.getTime() - 60_000),
    lastTickAt: new Date(now.getTime() - 1_000),
    lastDurationMs: 12,
    totalTicks: 1,
    totalErrors: 0,
    lastError: null,
    lastCounts: {},
  });
  const status = classifyHeartbeat(hb, "outbound", now);
  assert.equal(status.name, "outbound");
});

test("buildHeartbeat truncates oversized error strings", () => {
  const hb = buildHeartbeat({
    name: "outbound",
    pid: 1,
    runMode: "once",
    startedAt: new Date(),
    lastTickAt: new Date(),
    lastDurationMs: 1,
    totalTicks: 1,
    totalErrors: 1,
    lastError: "x".repeat(5_000),
    lastCounts: {},
  });
  assert.equal(hb.lastError?.length, 500);
});

test("formatAge produces stable human-readable strings", () => {
  assert.equal(formatAge(500), "500ms");
  assert.equal(formatAge(5_000), "5s");
  assert.equal(formatAge(120_000), "2m");
  assert.equal(formatAge(60 * 60 * 1000 * 3), "3h");
});
