import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/**
 * Per-account outbound rate limit + warm-up.
 *
 * Tiered warm-up by account age (account.createdAt):
 *   day 0–2  : 5  / minute, 100  / day
 *   day 3–6  : 15 / minute, 500  / day
 *   day 7–13 : 30 / minute, 2000 / day
 *   day 14+  : 60 / minute, 10000 / day
 *
 * Env overrides (optional):
 *   WA_RATE_LIMIT_PER_MINUTE  — global ceiling
 *   WA_RATE_LIMIT_PER_DAY     — global ceiling
 *
 * Channel-agnostic in spirit: the worker calls this helper with an
 * `accountId` that is tenant-scoped. When other channels arrive they
 * either add their own account-equivalent table and call a sibling
 * helper, or this helper grows a `channel` parameter. The shape of the
 * return value stays the same.
 */

export type RateBudget = {
  perMinute: number;
  perDay: number;
};

export function warmUpBudget(accountAgeDays: number): RateBudget {
  if (accountAgeDays < 3) return { perMinute: 5, perDay: 100 };
  if (accountAgeDays < 7) return { perMinute: 15, perDay: 500 };
  if (accountAgeDays < 14) return { perMinute: 30, perDay: 2000 };
  return { perMinute: 60, perDay: 10000 };
}

function envCap(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function effectiveBudget(
  accountId: string,
): Promise<RateBudget | null> {
  const db = requireDb();
  const [acc] = await db
    .select({ createdAt: schema.connectedAccounts.createdAt })
    .from(schema.connectedAccounts)
    .where(eq(schema.connectedAccounts.id, accountId))
    .limit(1);
  if (!acc) return null;
  const ageMs = Date.now() - new Date(acc.createdAt).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / 86_400_000));
  const base = warmUpBudget(ageDays);
  const minuteCap = envCap("WA_RATE_LIMIT_PER_MINUTE");
  const dayCap = envCap("WA_RATE_LIMIT_PER_DAY");
  return {
    perMinute: minuteCap ? Math.min(base.perMinute, minuteCap) : base.perMinute,
    perDay: dayCap ? Math.min(base.perDay, dayCap) : base.perDay,
  };
}

export type RateConsumption = {
  lastMinute: number;
  lastDay: number;
};

export async function consumedBy(accountId: string): Promise<RateConsumption> {
  const db = requireDb();
  // Count rows whose lifecycle indicates "we already attempted a send".
  // We treat 'sending', 'sent', 'delivered', 'read' as consumed so that
  // a status webhook flap does not cause double-counting.
  const minuteAgo = new Date(Date.now() - 60_000);
  const dayAgo = new Date(Date.now() - 86_400_000);
  const [{ c: lastMinute }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.accountId, accountId),
        gte(schema.messageQueue.updatedAt, minuteAgo),
        sql`${schema.messageQueue.status} in ('sending','sent','delivered','read')`,
      ),
    );
  const [{ c: lastDay }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.accountId, accountId),
        gte(schema.messageQueue.updatedAt, dayAgo),
        sql`${schema.messageQueue.status} in ('sending','sent','delivered','read')`,
      ),
    );
  return { lastMinute: Number(lastMinute), lastDay: Number(lastDay) };
}

export type RateDecision =
  | { ok: true; budget: RateBudget; consumed: RateConsumption; remainingMinute: number }
  | { ok: false; reason: "no_account" | "minute_exceeded" | "day_exceeded"; budget?: RateBudget };

export async function checkAndReserve(accountId: string): Promise<RateDecision> {
  const budget = await effectiveBudget(accountId);
  if (!budget) return { ok: false, reason: "no_account" };
  const consumed = await consumedBy(accountId);
  if (consumed.lastDay >= budget.perDay) {
    return { ok: false, reason: "day_exceeded", budget };
  }
  if (consumed.lastMinute >= budget.perMinute) {
    return { ok: false, reason: "minute_exceeded", budget };
  }
  return {
    ok: true,
    budget,
    consumed,
    remainingMinute: Math.max(0, budget.perMinute - consumed.lastMinute),
  };
}
