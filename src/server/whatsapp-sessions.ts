import "server-only";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";

/**
 * WhatsApp session state helpers.
 *
 * Single tenant-scoped surface for reading and mutating
 * `whatsapp_sessions`. Every mutation here is paired with a write
 * coming from a verified gateway webhook OR an authenticated tenant
 * action; this module never trusts the request body alone.
 */

export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const SESSION_STATUSES = [
  "pending",
  "connecting",
  "connected",
  "disconnected",
  "expired",
  "error",
] as const;

export async function getSessionByAccount(accountId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.whatsappSessions)
    .where(eq(schema.whatsappSessions.accountId, accountId))
    .limit(1);
  return row ?? null;
}

export async function getSessionForTenant(tenantId: string, accountId: string) {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.whatsappSessions)
    .where(
      and(
        eq(schema.whatsappSessions.tenantId, tenantId),
        eq(schema.whatsappSessions.accountId, accountId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getOrCreateSession(input: {
  tenantId: string;
  accountId: string;
}) {
  const existing = await getSessionForTenant(input.tenantId, input.accountId);
  if (existing) return existing;
  const db = requireDb();
  const [row] = await db
    .insert(schema.whatsappSessions)
    .values({
      tenantId: input.tenantId,
      accountId: input.accountId,
      status: "pending",
    })
    .returning();
  return row;
}

export async function setSessionStatus(input: {
  accountId: string;
  status: SessionStatus;
  authPayload?: unknown;
}) {
  const db = requireDb();
  const patch: Record<string, unknown> = {
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.status === "connected") {
    patch.lastConnectedAt = new Date();
  }
  if (input.authPayload !== undefined) {
    patch.authPayload = input.authPayload;
  }
  const [row] = await db
    .update(schema.whatsappSessions)
    .set(patch)
    .where(eq(schema.whatsappSessions.accountId, input.accountId))
    .returning();
  return row ?? null;
}

export async function recordQr(accountId: string) {
  const db = requireDb();
  const [row] = await db
    .update(schema.whatsappSessions)
    .set({
      status: "connecting",
      lastQrAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.whatsappSessions.accountId, accountId))
    .returning();
  return row ?? null;
}

/** Resolve tenant ownership from a gateway-side accountId. */
export async function resolveTenantByAccount(accountId: string) {
  const db = requireDb();
  const [acc] = await db
    .select({
      id: schema.connectedAccounts.id,
      tenantId: schema.connectedAccounts.tenantId,
      gatewayUrl: schema.connectedAccounts.gatewayUrl,
      displayName: schema.connectedAccounts.displayName,
      phoneNumber: schema.connectedAccounts.phoneNumber,
    })
    .from(schema.connectedAccounts)
    .where(eq(schema.connectedAccounts.id, accountId))
    .limit(1);
  return acc ?? null;
}
