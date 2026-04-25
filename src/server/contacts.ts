import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/**
 * Tenant-scoped contact data layer. Every query takes `tenantId` as the
 * first arg and includes it in the WHERE clause. Never call any of these
 * functions without a tenant id resolved from `requireTenantContext`.
 */

export type ContactRow = typeof schema.contacts.$inferSelect;
export type ContactTagRow = typeof schema.contactTags.$inferSelect;

export async function listContacts(
  tenantId: string,
  opts: { search?: string; limit?: number } = {},
) {
  const db = requireDb();
  const search = opts.search?.trim();
  const where = search
    ? and(
        eq(schema.contacts.tenantId, tenantId),
        or(
          ilike(schema.contacts.fullName, `%${search}%`),
          ilike(schema.contacts.phoneE164, `%${search}%`),
          ilike(schema.contacts.email, `%${search}%`),
        ),
      )
    : eq(schema.contacts.tenantId, tenantId);

  return db
    .select()
    .from(schema.contacts)
    .where(where)
    .orderBy(desc(schema.contacts.createdAt))
    .limit(opts.limit ?? 100);
}

export async function getContact(tenantId: string, contactId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        eq(schema.contacts.id, contactId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type CreateContactInput = {
  tenantId: string;
  phoneE164: string;
  fullName?: string | null;
  email?: string | null;
  source?: string | null;
  leadStatus?: string | null;
  notes?: string | null;
};

export async function createContact(input: CreateContactInput) {
  const db = requireDb();
  const [row] = await db
    .insert(schema.contacts)
    .values({
      tenantId: input.tenantId,
      phoneE164: input.phoneE164,
      fullName: input.fullName ?? null,
      email: input.email ?? null,
      source: input.source ?? "manual",
      leadStatus: input.leadStatus ?? "none",
      notes: input.notes ?? null,
    })
    .returning();
  return row;
}

export type UpdateContactInput = {
  tenantId: string;
  contactId: string;
  fullName?: string | null;
  email?: string | null;
  phoneE164?: string;
  leadStatus?: string;
  status?: string;
  notes?: string | null;
};

export async function updateContact(input: UpdateContactInput) {
  const db = requireDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.fullName !== undefined) patch.fullName = input.fullName;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phoneE164 !== undefined) patch.phoneE164 = input.phoneE164;
  if (input.leadStatus !== undefined) patch.leadStatus = input.leadStatus;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  const [row] = await db
    .update(schema.contacts)
    .set(patch)
    .where(
      and(
        eq(schema.contacts.tenantId, input.tenantId),
        eq(schema.contacts.id, input.contactId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function deleteContact(tenantId: string, contactId: string) {
  const db = requireDb();
  await db
    .delete(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        eq(schema.contacts.id, contactId),
      ),
    );
}

export async function listTags(tenantId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.contactTags)
    .where(eq(schema.contactTags.tenantId, tenantId))
    .orderBy(schema.contactTags.name);
}

export async function createTag(
  tenantId: string,
  name: string,
  color: string | null = null,
) {
  const db = requireDb();
  const [row] = await db
    .insert(schema.contactTags)
    .values({ tenantId, name, color })
    .onConflictDoNothing({
      target: [schema.contactTags.tenantId, schema.contactTags.name],
    })
    .returning();
  return row ?? null;
}

export async function deleteTag(tenantId: string, tagId: string) {
  const db = requireDb();
  await db
    .delete(schema.contactTags)
    .where(
      and(
        eq(schema.contactTags.tenantId, tenantId),
        eq(schema.contactTags.id, tagId),
      ),
    );
}

export async function listContactTagAssignments(
  tenantId: string,
  contactId: string,
) {
  const db = requireDb();
  // Join via tags to enforce tenant scoping on the tag side.
  return db
    .select({
      tagId: schema.contactTags.id,
      name: schema.contactTags.name,
      color: schema.contactTags.color,
    })
    .from(schema.contactTagAssignments)
    .innerJoin(
      schema.contactTags,
      eq(schema.contactTags.id, schema.contactTagAssignments.tagId),
    )
    .where(
      and(
        eq(schema.contactTags.tenantId, tenantId),
        eq(schema.contactTagAssignments.contactId, contactId),
      ),
    );
}

export async function assignTag(
  tenantId: string,
  contactId: string,
  tagId: string,
) {
  const db = requireDb();
  // Verify both rows belong to this tenant before linking.
  const [contact] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        eq(schema.contacts.id, contactId),
      ),
    )
    .limit(1);
  const [tag] = await db
    .select({ id: schema.contactTags.id })
    .from(schema.contactTags)
    .where(
      and(
        eq(schema.contactTags.tenantId, tenantId),
        eq(schema.contactTags.id, tagId),
      ),
    )
    .limit(1);
  if (!contact || !tag) return null;

  const [row] = await db
    .insert(schema.contactTagAssignments)
    .values({ contactId, tagId })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function unassignTag(
  tenantId: string,
  contactId: string,
  tagId: string,
) {
  const db = requireDb();
  // Confirm tenant scoping before delete.
  const [contact] = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(
      and(
        eq(schema.contacts.tenantId, tenantId),
        eq(schema.contacts.id, contactId),
      ),
    )
    .limit(1);
  if (!contact) return;

  await db
    .delete(schema.contactTagAssignments)
    .where(
      and(
        eq(schema.contactTagAssignments.contactId, contactId),
        eq(schema.contactTagAssignments.tagId, tagId),
      ),
    );
}

export async function contactCount(tenantId: string) {
  const db = requireDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.contacts)
    .where(eq(schema.contacts.tenantId, tenantId));
  return row?.count ?? 0;
}
