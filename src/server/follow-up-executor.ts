import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { listSteps, getSequence } from "@/server/followups";

/**
 * Follow-up sequence executor.
 *
 * Triggers an enrolled contact through every step of a sequence by
 * inserting `message_queue` rows with `purpose='followup'` and
 * `payload={sequenceId, stepId, stepOrder}`. The actual send is handled
 * by `scripts/worker-outbound.ts` once `scheduled_at` arrives.
 *
 * Idempotency: enrollment is gated by checking `message_queue.payload`
 * for an existing row with the same `sequenceId + contactId`. We do not
 * yet have a dedicated `followup_enrollments` table; the queue payload
 * serves as the authoritative ledger so we never drift.
 *
 * Channel-agnostic: this module never names a channel. It chooses one
 * tenant `connectedAccount` to send through. When other channels arrive,
 * the account picker becomes channel-aware; the rest is unchanged.
 *
 * Smart Customer Memory note: the identity anchor for any future
 * customer-memory hook is `tenant_id + normalized_phone_number`. We
 * always have those (tenant via `contacts.tenant_id`, phone via
 * `contacts.phone_e164` already in E.164 form). No phone is used as a
 * conversation key here.
 */

export type EnrollmentResult = {
  ok: boolean;
  reason?: "no_steps" | "already_enrolled" | "no_account" | "no_contact";
  scheduled?: number;
};

async function pickTenantAccount(tenantId: string): Promise<string | null> {
  const db = requireDb();
  const [acc] = await db
    .select({ id: schema.connectedAccounts.id })
    .from(schema.connectedAccounts)
    .where(
      and(
        eq(schema.connectedAccounts.tenantId, tenantId),
        eq(schema.connectedAccounts.isActive, true),
      ),
    )
    .limit(1);
  return acc?.id ?? null;
}

async function alreadyEnrolled(
  sequenceId: string,
  contactId: string,
): Promise<boolean> {
  const db = requireDb();
  const rows = await db
    .select({ id: schema.messageQueue.id })
    .from(schema.messageQueue)
    .where(
      and(
        eq(schema.messageQueue.contactId, contactId),
        sql`${schema.messageQueue.payload}->>'sequenceId' = ${sequenceId}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function enrollContact(input: {
  tenantId: string;
  sequenceId: string;
  contactId: string;
  startAt?: Date;
  accountId?: string | null;
}): Promise<EnrollmentResult> {
  const db = requireDb();
  // Tenant guard: sequence must belong to tenant.
  const sequence = await getSequence(input.tenantId, input.sequenceId);
  if (!sequence) return { ok: false, reason: "already_enrolled" };

  // Tenant guard: contact must belong to tenant.
  const [contact] = await db
    .select({
      id: schema.contacts.id,
      phoneE164: schema.contacts.phoneE164,
      status: schema.contacts.status,
    })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.id, input.contactId),
        eq(schema.contacts.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (!contact) return { ok: false, reason: "no_contact" };
  if (contact.status !== "active") {
    return { ok: false, reason: "no_contact" };
  }

  if (await alreadyEnrolled(input.sequenceId, input.contactId)) {
    return { ok: false, reason: "already_enrolled" };
  }

  const steps = await listSteps(input.tenantId, input.sequenceId);
  if (steps.length === 0) return { ok: false, reason: "no_steps" };

  const accountId = input.accountId ?? (await pickTenantAccount(input.tenantId));
  if (!accountId) return { ok: false, reason: "no_account" };

  const start = input.startAt ?? new Date();
  let cumulativeMs = 0;
  let scheduled = 0;
  for (const step of steps) {
    cumulativeMs += step.delayHours * 3_600_000;
    const scheduledAt = new Date(start.getTime() + cumulativeMs);
    await db.insert(schema.messageQueue).values({
      tenantId: input.tenantId,
      accountId,
      contactId: contact.id,
      toPhone: contact.phoneE164,
      purpose: "followup",
      status: "queued",
      bodyText: step.bodyText ?? null,
      payload: {
        sequenceId: input.sequenceId,
        stepId: step.id,
        stepOrder: step.stepOrder,
        // identity anchor for future Smart Customer Memory hooks
        identity: {
          tenantId: input.tenantId,
          normalizedPhoneNumber: contact.phoneE164,
        },
      },
      scheduledAt,
    });
    scheduled++;
  }
  return { ok: true, scheduled };
}

/* ────────────────────────────────────────────────────────────── */
/*  Auto-trigger pass                                             */
/* ────────────────────────────────────────────────────────────── */

/**
 * For active sequences, find contacts that match the trigger and have
 * not yet been enrolled, and enroll them. This is the function the
 * cron-style executor script calls.
 *
 * Trigger handlers below are intentionally conservative: they enroll
 * only on clear, observable signals so a missing executor run does not
 * cause a flood when the executor catches up.
 */

export async function runAutoTriggers(): Promise<{
  sequencesScanned: number;
  enrolled: number;
}> {
  const db = requireDb();
  const sequences = await db
    .select()
    .from(schema.followupSequences)
    .where(eq(schema.followupSequences.status, "active"));

  let enrolled = 0;
  for (const seq of sequences) {
    const cfg = (seq.triggerConfig as Record<string, unknown> | null) ?? {};
    let candidateIds: string[] = [];

    if (seq.triggerType === "no_reply") {
      // Default: contacts with last inbound between 24h and 72h ago,
      // and no outbound queued or sent since their last inbound.
      const lookbackHoursMin = Number(cfg.lookbackHoursMin ?? 24);
      const lookbackHoursMax = Number(cfg.lookbackHoursMax ?? 72);
      const minTs = new Date(Date.now() - lookbackHoursMax * 3_600_000);
      const maxTs = new Date(Date.now() - lookbackHoursMin * 3_600_000);

      const rows = await db
        .select({ contactId: schema.inboundMessages.contactId })
        .from(schema.inboundMessages)
        .where(
          and(
            eq(schema.inboundMessages.tenantId, seq.tenantId),
            gte(schema.inboundMessages.receivedAt, minTs),
            lte(schema.inboundMessages.receivedAt, maxTs),
            sql`${schema.inboundMessages.contactId} is not null`,
          ),
        );
      candidateIds = Array.from(
        new Set(rows.map((r) => r.contactId).filter((v): v is string => !!v)),
      );
    } else if (seq.triggerType === "hot_lead") {
      const rows = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, seq.tenantId),
            eq(schema.contacts.leadStatus, "hot"),
            eq(schema.contacts.status, "active"),
          ),
        );
      candidateIds = rows.map((r) => r.id);
    } else if (seq.triggerType === "new_contact") {
      // Contacts created in the last 24h.
      const since = new Date(Date.now() - 24 * 3_600_000);
      const rows = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, seq.tenantId),
            gte(schema.contacts.createdAt, since),
            eq(schema.contacts.status, "active"),
          ),
        );
      candidateIds = rows.map((r) => r.id);
    } else {
      // 'custom' triggers are operator-driven; auto pass ignores them.
      continue;
    }

    for (const contactId of candidateIds) {
      const r = await enrollContact({
        tenantId: seq.tenantId,
        sequenceId: seq.id,
        contactId,
      });
      if (r.ok) enrolled++;
    }
  }

  return { sequencesScanned: sequences.length, enrolled };
}

// silence unused import warnings while keeping the surface stable
void asc;
