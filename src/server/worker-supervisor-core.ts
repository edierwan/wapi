/**
 * Pure helpers for worker supervision and heartbeat parsing.
 *
 * No filesystem, no DB, no process imports. Everything here is
 * deterministic and unit-testable in isolation.
 */

export type WorkerHeartbeat = {
  /** Logical worker name, e.g. "outbound" or "follow-ups". */
  name: string;
  /** OS pid that wrote the heartbeat. */
  pid: number;
  /** "once" = single-shot run; "loop" = supervised loop. */
  runMode: "once" | "loop";
  /** Wall-clock when the supervisor last wrote a tick. */
  lastTickAt: string;
  /** Wall-clock when the supervisor process started. */
  startedAt: string;
  /** Duration of the most recent tick in milliseconds. */
  lastDurationMs: number;
  /** Total ticks completed since process start. */
  totalTicks: number;
  /** Total ticks that threw or returned an error. */
  totalErrors: number;
  /** Last error message captured (truncated). */
  lastError: string | null;
  /** Last per-tick result counts. Free-form, picked by the worker. */
  lastCounts: Record<string, number>;
};

export type WorkerStatus = {
  name: string;
  state: "ok" | "stale" | "missing" | "errored";
  /** Heartbeat content if found, else null. */
  heartbeat: WorkerHeartbeat | null;
  /** Milliseconds since lastTickAt, or null when missing. */
  ageMs: number | null;
  /** Human-readable note, e.g. "no heartbeat file" or "stale > 120s". */
  note: string;
};

/**
 * A heartbeat older than this threshold is considered stale.
 *
 * Keep this conservative: workers typically tick every 15s, so 120s
 * means we missed several ticks before flagging a problem. Operators
 * can override per call if they need a tighter SLO.
 */
export const DEFAULT_STALE_AFTER_MS = 120_000;

/**
 * Validate a parsed JSON object as a WorkerHeartbeat. Returns null when
 * any required field is missing or wrong-typed; the caller treats that
 * as a missing heartbeat rather than a crash.
 */
export function parseHeartbeat(raw: unknown): WorkerHeartbeat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || r.name.length === 0) return null;
  if (typeof r.pid !== "number") return null;
  if (r.runMode !== "once" && r.runMode !== "loop") return null;
  if (typeof r.lastTickAt !== "string") return null;
  if (typeof r.startedAt !== "string") return null;
  if (typeof r.lastDurationMs !== "number") return null;
  if (typeof r.totalTicks !== "number") return null;
  if (typeof r.totalErrors !== "number") return null;
  const lastError =
    r.lastError === null
      ? null
      : typeof r.lastError === "string"
        ? r.lastError
        : null;
  const lastCounts =
    r.lastCounts && typeof r.lastCounts === "object"
      ? Object.fromEntries(
          Object.entries(r.lastCounts as Record<string, unknown>).filter(
            ([, v]) => typeof v === "number",
          ) as [string, number][],
        )
      : {};
  return {
    name: r.name,
    pid: r.pid,
    runMode: r.runMode,
    lastTickAt: r.lastTickAt,
    startedAt: r.startedAt,
    lastDurationMs: r.lastDurationMs,
    totalTicks: r.totalTicks,
    totalErrors: r.totalErrors,
    lastError,
    lastCounts,
  };
}

/**
 * Decide the live state of a worker from its (possibly missing)
 * heartbeat. Pure: takes "now" as input so tests do not need to mock
 * the clock.
 */
export function classifyHeartbeat(
  heartbeat: WorkerHeartbeat | null,
  expectedName: string,
  now: Date,
  staleAfterMs: number = DEFAULT_STALE_AFTER_MS,
): WorkerStatus {
  if (!heartbeat) {
    return {
      name: expectedName,
      state: "missing",
      heartbeat: null,
      ageMs: null,
      note: "no heartbeat file yet — worker has not run in this environment",
    };
  }

  const lastTickMs = Date.parse(heartbeat.lastTickAt);
  const ageMs = Number.isNaN(lastTickMs) ? null : now.getTime() - lastTickMs;

  if (ageMs === null) {
    return {
      name: expectedName,
      state: "errored",
      heartbeat,
      ageMs: null,
      note: "lastTickAt is not a valid timestamp",
    };
  }

  if (ageMs > staleAfterMs) {
    return {
      name: expectedName,
      state: "stale",
      heartbeat,
      ageMs,
      note: `stale: last tick ${formatAge(ageMs)} ago (threshold ${formatAge(staleAfterMs)})`,
    };
  }

  if (heartbeat.lastError) {
    return {
      name: expectedName,
      state: "errored",
      heartbeat,
      ageMs,
      note: `last tick reported error: ${heartbeat.lastError}`,
    };
  }

  return {
    name: expectedName,
    state: "ok",
    heartbeat,
    ageMs,
    note: `ok: last tick ${formatAge(ageMs)} ago`,
  };
}

/** Build a fresh heartbeat object from a tick outcome. Pure. */
export function buildHeartbeat(args: {
  name: string;
  pid: number;
  runMode: "once" | "loop";
  startedAt: Date;
  lastTickAt: Date;
  lastDurationMs: number;
  totalTicks: number;
  totalErrors: number;
  lastError: string | null;
  lastCounts: Record<string, number>;
}): WorkerHeartbeat {
  return {
    name: args.name,
    pid: args.pid,
    runMode: args.runMode,
    startedAt: args.startedAt.toISOString(),
    lastTickAt: args.lastTickAt.toISOString(),
    lastDurationMs: args.lastDurationMs,
    totalTicks: args.totalTicks,
    totalErrors: args.totalErrors,
    lastError: args.lastError ? args.lastError.slice(0, 500) : null,
    lastCounts: args.lastCounts,
  };
}

export function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}
