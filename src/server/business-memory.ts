import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/** Tenant-scoped Business Brain (business_memory_items) data layer. */

export const MEMORY_KINDS = [
  "fact",
  "faq",
  "policy",
  "brand",
  "offer",
  "warning",
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  fact: "Fact",
  faq: "FAQ",
  policy: "Policy",
  brand: "Brand",
  offer: "Offer",
  warning: "Warning",
};

export type MemoryItem = typeof schema.businessMemoryItems.$inferSelect;

export async function listMemoryItems(tenantId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.businessMemoryItems)
    .where(eq(schema.businessMemoryItems.tenantId, tenantId))
    .orderBy(
      schema.businessMemoryItems.kind,
      desc(schema.businessMemoryItems.weight),
      schema.businessMemoryItems.title,
    );
}

export async function getMemoryItem(tenantId: string, itemId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.businessMemoryItems)
    .where(
      and(
        eq(schema.businessMemoryItems.tenantId, tenantId),
        eq(schema.businessMemoryItems.id, itemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createMemoryItem(input: {
  tenantId: string;
  kind: MemoryKind;
  title: string;
  body: string;
  weight?: number;
  source?: string;
}) {
  const db = requireDb();
  const [row] = await db
    .insert(schema.businessMemoryItems)
    .values({
      tenantId: input.tenantId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      weight: input.weight ?? 1,
      source: input.source ?? "manual",
    })
    .returning();
  return row;
}

export async function updateMemoryItem(input: {
  tenantId: string;
  itemId: string;
  kind?: MemoryKind;
  title?: string;
  body?: string;
  weight?: number;
  status?: string;
}) {
  const db = requireDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.weight !== undefined) patch.weight = input.weight;
  if (input.status !== undefined) patch.status = input.status;

  const [row] = await db
    .update(schema.businessMemoryItems)
    .set(patch)
    .where(
      and(
        eq(schema.businessMemoryItems.tenantId, input.tenantId),
        eq(schema.businessMemoryItems.id, input.itemId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteMemoryItem(tenantId: string, itemId: string) {
  const db = requireDb();
  await db
    .delete(schema.businessMemoryItems)
    .where(
      and(
        eq(schema.businessMemoryItems.tenantId, tenantId),
        eq(schema.businessMemoryItems.id, itemId),
      ),
    );
}

export async function memoryItemCount(tenantId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.businessMemoryItems)
    .where(eq(schema.businessMemoryItems.tenantId, tenantId));
  return row?.count ?? 0;
}
