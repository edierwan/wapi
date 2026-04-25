"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import { requireDb, schema } from "@/db/client";
import {
  createSession,
  deleteSession as gatewayDeleteSession,
  isGatewayConfigured,
  resetSession as gatewayResetSession,
} from "@/server/wa-gateway";
import {
  getOrCreateSession,
  setSessionStatus,
} from "@/server/whatsapp-sessions";

const writeRoles = new Set(["owner", "admin"]);

async function authForWrite(tenantSlug: string) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const ctx = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    redirect(`/t/${tenantSlug}/whatsapp`);
  }
  return ctx;
}

async function loadAccountForTenant(tenantId: string, accountId: string) {
  const db = requireDb();
  const [acc] = await db
    .select()
    .from(schema.connectedAccounts)
    .where(
      and(
        eq(schema.connectedAccounts.id, accountId),
        eq(schema.connectedAccounts.tenantId, tenantId),
      ),
    )
    .limit(1);
  return acc ?? null;
}

const createAccountSchema = z.object({
  tenantSlug: z.string(),
  displayName: z.string().min(1).max(120),
});

export async function createAccountAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createAccountSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const db = requireDb();
  const [row] = await db
    .insert(schema.connectedAccounts)
    .values({
      tenantId: ctx.tenant.id,
      displayName: parsed.data.displayName,
      isActive: true,
    })
    .returning();
  // Pre-create session row in pending state.
  await getOrCreateSession({ tenantId: ctx.tenant.id, accountId: row.id });
  revalidatePath(`/t/${parsed.data.tenantSlug}/whatsapp`);
}

const accountActionSchema = z.object({
  tenantSlug: z.string(),
  accountId: z.string().uuid(),
});

/**
 * Connect: create the gateway-side session and ensure a pending session row.
 * The gateway will then push a `qr` webhook that updates this row.
 *
 * If the gateway is not configured, we still flip the WAPI-side row to
 * `pending`/`connecting` so the UI can show the right state.
 */
export async function connectSessionAction(formData: FormData) {
  const parsed = accountActionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) throw new Error("Invalid input");
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const acc = await loadAccountForTenant(ctx.tenant.id, parsed.data.accountId);
  if (!acc) throw new Error("Account not found");

  await getOrCreateSession({
    tenantId: ctx.tenant.id,
    accountId: acc.id,
  });

  if (isGatewayConfigured()) {
    const result = await createSession({
      accountId: acc.id,
      gatewayUrl: acc.gatewayUrl,
      label: acc.displayName,
    });
    if (!result.ok) {
      await setSessionStatus({ accountId: acc.id, status: "error" });
      throw new Error(`Gateway: ${result.error}`);
    }
    await setSessionStatus({ accountId: acc.id, status: "connecting" });
  }

  revalidatePath(`/t/${parsed.data.tenantSlug}/whatsapp`);
}

export async function resetSessionAction(formData: FormData) {
  const parsed = accountActionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) throw new Error("Invalid input");
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const acc = await loadAccountForTenant(ctx.tenant.id, parsed.data.accountId);
  if (!acc) throw new Error("Account not found");

  if (isGatewayConfigured()) {
    const result = await gatewayResetSession({
      accountId: acc.id,
      gatewayUrl: acc.gatewayUrl,
    });
    if (!result.ok) {
      throw new Error(`Gateway: ${result.error}`);
    }
  }
  await setSessionStatus({
    accountId: acc.id,
    status: "pending",
    authPayload: null,
  });
  revalidatePath(`/t/${parsed.data.tenantSlug}/whatsapp`);
}

export async function disconnectSessionAction(formData: FormData) {
  const parsed = accountActionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) throw new Error("Invalid input");
  const ctx = await authForWrite(parsed.data.tenantSlug);
  const acc = await loadAccountForTenant(ctx.tenant.id, parsed.data.accountId);
  if (!acc) throw new Error("Account not found");

  if (isGatewayConfigured()) {
    await gatewayDeleteSession({
      accountId: acc.id,
      gatewayUrl: acc.gatewayUrl,
    });
  }
  await setSessionStatus({ accountId: acc.id, status: "disconnected" });
  revalidatePath(`/t/${parsed.data.tenantSlug}/whatsapp`);
}
