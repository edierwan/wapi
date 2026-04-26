/**
 * Worker supervisor: thin process-side wrapper around a tick function.
 *
 * Responsibilities:
 *   - run a tick function once or in a supervised loop
 *   - write a heartbeat JSON file after each tick (success or failure)
 *   - handle SIGTERM / SIGINT cleanly so heartbeats stay accurate
 *   - keep the tick function tenant-safe by NOT touching its arguments
 *
 * Non-goals:
 *   - this is not a queue scheduler
 *   - this does not replace the existing tick logic in either worker
 *   - this does not assume a multi-channel worker model
 */

import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  buildHeartbeat,
  parseHeartbeat,
  type WorkerHeartbeat,
} from "./worker-supervisor-core";

export type TickResult = {
  /** Free-form numeric counts, e.g. { claimed, sent, failed }. */
  counts: Record<string, number>;
};

export type TickFn = () => Promise<TickResult>;

export type SupervisedRunOptions = {
  name: string;
  tick: TickFn;
  /** "once" exits after a single tick. "loop" runs until SIG{INT,TERM}. */
  runMode?: "once" | "loop";
  /** Loop interval in ms. Ignored in "once" mode. Defaults to 15s. */
  intervalMs?: number;
  /** Heartbeat directory. Defaults to env or os tmpdir. */
  heartbeatDir?: string;
};

const DEFAULT_INTERVAL_MS = 15_000;

export function getHeartbeatDir(override?: string): string {
  if (override) return override;
  const fromEnv = process.env.WAPI_WORKER_HEARTBEAT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return path.join(os.tmpdir(), "wapi-workers");
}

function heartbeatPath(dir: string, name: string): string {
  return path.join(dir, `${name}.json`);
}

async function writeHeartbeatFile(
  dir: string,
  hb: WorkerHeartbeat,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const tmp = heartbeatPath(dir, hb.name) + ".tmp";
  await writeFile(tmp, JSON.stringify(hb, null, 2), "utf8");
  // Best-effort atomic move via rename. If rename is unavailable on
  // the platform, the .tmp leftover is harmless and overwritten next
  // tick.
  const { rename } = await import("node:fs/promises");
  await rename(tmp, heartbeatPath(dir, hb.name));
}

/**
 * Read all heartbeats from the configured directory. Missing
 * directory or unparseable files are tolerated — the system-health
 * surface treats missing entries as "missing", not as crash.
 */
export async function readAllHeartbeats(
  dir?: string,
): Promise<WorkerHeartbeat[]> {
  const target = getHeartbeatDir(dir);
  let entries: string[];
  try {
    entries = await readdir(target);
  } catch {
    return [];
  }
  const results: WorkerHeartbeat[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(target, name), "utf8");
      const parsed = parseHeartbeat(JSON.parse(raw));
      if (parsed) results.push(parsed);
    } catch {
      // ignore corrupt or partially-written files; next tick fixes it
    }
  }
  return results;
}

/**
 * Run a tick once. Always writes a heartbeat (success or failure).
 * Throws upstream errors so the caller (e.g. cron / systemd / Coolify)
 * can react via exit code.
 */
export async function runOnce(opts: SupervisedRunOptions): Promise<void> {
  const dir = getHeartbeatDir(opts.heartbeatDir);
  const startedAt = new Date();
  let totalTicks = 0;
  let totalErrors = 0;
  let lastError: string | null = null;
  let lastCounts: Record<string, number> = {};
  const tickStart = Date.now();
  try {
    const result = await opts.tick();
    lastCounts = result.counts;
    totalTicks = 1;
  } catch (err) {
    totalErrors = 1;
    lastError = err instanceof Error ? err.message : String(err);
    totalTicks = 1;
    await writeHeartbeatFile(
      dir,
      buildHeartbeat({
        name: opts.name,
        pid: process.pid,
        runMode: "once",
        startedAt,
        lastTickAt: new Date(),
        lastDurationMs: Date.now() - tickStart,
        totalTicks,
        totalErrors,
        lastError,
        lastCounts,
      }),
    );
    throw err;
  }
  await writeHeartbeatFile(
    dir,
    buildHeartbeat({
      name: opts.name,
      pid: process.pid,
      runMode: "once",
      startedAt,
      lastTickAt: new Date(),
      lastDurationMs: Date.now() - tickStart,
      totalTicks,
      totalErrors,
      lastError,
      lastCounts,
    }),
  );
}

/**
 * Run the tick in a supervised loop. Exits cleanly on SIGINT/SIGTERM.
 * Errors inside a tick are recorded in the heartbeat but do NOT crash
 * the loop — that is the whole point of supervision.
 */
export async function runSupervised(opts: SupervisedRunOptions): Promise<void> {
  const runMode = opts.runMode ?? "loop";
  if (runMode === "once") {
    await runOnce(opts);
    return;
  }

  const dir = getHeartbeatDir(opts.heartbeatDir);
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const startedAt = new Date();
  let totalTicks = 0;
  let totalErrors = 0;
  let lastError: string | null = null;
  let lastCounts: Record<string, number> = {};

  let stopRequested = false;
  const stop = (signal: string) => () => {
    if (stopRequested) return;
    stopRequested = true;
    console.log(`[worker-supervisor:${opts.name}] received ${signal}, stopping after current tick`);
  };
  process.on("SIGINT", stop("SIGINT"));
  process.on("SIGTERM", stop("SIGTERM"));

  console.log(
    `[worker-supervisor:${opts.name}] starting supervised loop pid=${process.pid} interval=${intervalMs}ms heartbeatDir=${dir}`,
  );

  while (!stopRequested) {
    const tickStart = Date.now();
    try {
      const result = await opts.tick();
      lastCounts = result.counts;
      lastError = null;
    } catch (err) {
      totalErrors += 1;
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[worker-supervisor:${opts.name}] tick error:`, err);
    }
    totalTicks += 1;
    const lastDurationMs = Date.now() - tickStart;

    try {
      await writeHeartbeatFile(
        dir,
        buildHeartbeat({
          name: opts.name,
          pid: process.pid,
          runMode: "loop",
          startedAt,
          lastTickAt: new Date(),
          lastDurationMs,
          totalTicks,
          totalErrors,
          lastError,
          lastCounts,
        }),
      );
    } catch (err) {
      console.error(
        `[worker-supervisor:${opts.name}] failed to write heartbeat:`,
        err,
      );
    }

    if (stopRequested) break;
    // Sleep with cooperative cancellation.
    const remaining = Math.max(0, intervalMs - lastDurationMs);
    if (remaining > 0) {
      await sleepInterruptible(remaining, () => stopRequested);
    }
  }

  console.log(
    `[worker-supervisor:${opts.name}] stopped after ${totalTicks} tick(s), ${totalErrors} error(s)`,
  );
}

async function sleepInterruptible(
  ms: number,
  shouldStop: () => boolean,
): Promise<void> {
  const step = 250;
  let elapsed = 0;
  while (elapsed < ms) {
    if (shouldStop()) return;
    const wait = Math.min(step, ms - elapsed);
    await new Promise((r) => setTimeout(r, wait));
    elapsed += wait;
  }
}
