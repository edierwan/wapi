import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/**
 * Tenant-scoped follow-up sequences + steps.
 *
 * A sequence is a tenant-owned plan triggered by a contact event
 * (`no_reply` / `hot_lead` / `new_contact` / `custom`). Steps are
 * delayed messages. The step body is optional because a step may
 * resolve to an AI-drafted message at run time.
 *
 * Every read and write filters by `tenant_id`. Steps are tenant-checked
 * via their parent sequence.
 */

export type FollowupTrigger = "no_reply" | "hot_lead" | "new_contact" | "custom";

export async function listSequences(tenantId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.followupSequences)
    .where(eq(schema.followupSequences.tenantId, tenantId))
    .orderBy(desc(schema.followupSequences.updatedAt));
}

export async function getSequence(tenantId: string, sequenceId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.followupSequences)
    .where(
      and(
        eq(schema.followupSequences.tenantId, tenantId),
        eq(schema.followupSequences.id, sequenceId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listSteps(tenantId: string, sequenceId: string) {
  const db = requireDb();
  return db
    .select({
      id: schema.followupSteps.id,
      sequenceId: schema.followupSteps.sequenceId,
      stepOrder: schema.followupSteps.stepOrder,
      delayHours: schema.followupSteps.delayHours,
      bodyText: schema.followupSteps.bodyText,
      isAiGenerated: schema.followupSteps.isAiGenerated,
      createdAt: schema.followupSteps.createdAt,
    })
    .from(schema.followupSteps)
    .innerJoin(
      schema.followupSequences,
      eq(schema.followupSteps.sequenceId, schema.followupSequences.id),
    )
    .where(
      and(
        eq(schema.followupSequences.tenantId, tenantId),
        eq(schema.followupSteps.sequenceId, sequenceId),
      ),
    )
    .orderBy(asc(schema.followupSteps.stepOrder));
}

export async function createSequence(input: {
  tenantId: string;
  name: string;
  triggerType: FollowupTrigger;
  triggerConfig?: Record<string, unknown> | null;
}) {
  const db = requireDb();
  const [row] = await db
    .insert(schema.followupSequences)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? null,
      status: "active",
    })
    .returning();
  return row;
}

export async function updateSequence(input: {
  tenantId: string;
  sequenceId: string;
  name?: string;
  triggerType?: FollowupTrigger;
  triggerConfig?: Record<string, unknown> | null;
  status?: string;
}) {
  const db = requireDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.triggerType !== undefined) patch.triggerType = input.triggerType;
  if (input.triggerConfig !== undefined)
    patch.triggerConfig = input.triggerConfig;
  if (input.status !== undefined) patch.status = input.status;
  const [row] = await db
    .update(schema.followupSequences)
    .set(patch)
    .where(
      and(
        eq(schema.followupSequences.tenantId, input.tenantId),
        eq(schema.followupSequences.id, input.sequenceId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteSequence(tenantId: string, sequenceId: string) {
  const db = requireDb();
  await db
    .delete(schema.followupSequences)
    .where(
      and(
        eq(schema.followupSequences.tenantId, tenantId),
        eq(schema.followupSequences.id, sequenceId),
      ),
    );
}

export async function upsertStep(input: {
  tenantId: string;
  sequenceId: string;
  stepId?: string | null;
  stepOrder: number;
  delayHours: number;
  bodyText?: string | null;
  isAiGenerated?: boolean;
}) {
  const db = requireDb();
  const owner = await getSequence(input.tenantId, input.sequenceId);
  if (!owner) throw new Error("sequence not found for tenant");
  if (input.stepId) {
    const [row] = await db
      .update(schema.followupSteps)
      .set({
        stepOrder: input.stepOrder,
        delayHours: input.delayHours,
        bodyText: input.bodyText ?? null,
        isAiGenerated: input.isAiGenerated ?? false,
      })
      .where(
        and(
          eq(schema.followupSteps.id, input.stepId),
          eq(schema.followupSteps.sequenceId, input.sequenceId),
        ),
      )
      .returning();
    return row ?? null;
  }
  const [row] = await db
    .insert(schema.followupSteps)
    .values({
      sequenceId: input.sequenceId,
      stepOrder: input.stepOrder,
      delayHours: input.delayHours,
      bodyText: input.bodyText ?? null,
      isAiGenerated: input.isAiGenerated ?? false,
    })
    .returning();
  return row;
}

export async function deleteStep(input: {
  tenantId: string;
  sequenceId: string;
  stepId: string;
}) {
  const db = requireDb();
  const owner = await getSequence(input.tenantId, input.sequenceId);
  if (!owner) throw new Error("sequence not found for tenant");
  await db
    .delete(schema.followupSteps)
    .where(
      and(
        eq(schema.followupSteps.id, input.stepId),
        eq(schema.followupSteps.sequenceId, input.sequenceId),
      ),
    );
}
