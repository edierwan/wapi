import "server-only";

import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { getBusinessProfile } from "@/server/business-profile";

export const DEFAULT_MODULE_CODES = [
  "whatsapp",
  "contacts",
  "products",
  "services",
  "brain",
  "campaigns",
  "ai_assistant",
] as const;

export type TenantModuleCode = (typeof DEFAULT_MODULE_CODES)[number] | "analytics";

export type TenantModuleRow = {
  moduleId: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  source: string | null;
  sortOrder: number;
};

export async function syncTenantModulesFromProfile(tenantId: string) {
  const db = requireDb();
  const profile = await getBusinessProfile(tenantId);
  if (!profile?.industryId) return [] as TenantModuleRow[];

  const presetRows = await db
    .select({
      moduleId: schema.modules.id,
      code: schema.modules.code,
      enabled: schema.industryModulePresets.enabled,
    })
    .from(schema.industryModulePresets)
    .innerJoin(schema.modules, eq(schema.modules.id, schema.industryModulePresets.moduleId))
    .where(eq(schema.industryModulePresets.industryId, profile.industryId))
    .orderBy(asc(schema.industryModulePresets.sortOrder), asc(schema.modules.sortOrder));

  if (!presetRows.length) return listTenantModules(tenantId, { skipSync: true });

  const presetModuleIds = new Set(presetRows.map((row) => row.moduleId));
  const existingRows = await db
    .select({
      id: schema.tenantModules.id,
      moduleId: schema.tenantModules.moduleId,
      enabled: schema.tenantModules.enabled,
      source: schema.tenantModules.source,
    })
    .from(schema.tenantModules)
    .where(eq(schema.tenantModules.tenantId, tenantId));

  const existingByModuleId = new Map(existingRows.map((row) => [row.moduleId, row]));
  const now = new Date();

  for (const preset of presetRows) {
    const existing = existingByModuleId.get(preset.moduleId);
    if (!existing) {
      await db.insert(schema.tenantModules).values({
        tenantId,
        moduleId: preset.moduleId,
        enabled: preset.enabled,
        source: "preset",
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    if (existing.source === "preset" && existing.enabled !== preset.enabled) {
      await db
        .update(schema.tenantModules)
        .set({ enabled: preset.enabled, updatedAt: now })
        .where(eq(schema.tenantModules.id, existing.id));
    }
  }

  const stalePresetRows = existingRows.filter(
    (row) => row.source === "preset" && !presetModuleIds.has(row.moduleId),
  );
  for (const row of stalePresetRows) {
    if (!row.enabled) continue;
    await db
      .update(schema.tenantModules)
      .set({ enabled: false, updatedAt: now })
      .where(eq(schema.tenantModules.id, row.id));
  }

  return listTenantModules(tenantId, { skipSync: true });
}

export async function listTenantModules(
  tenantId: string,
  options?: { skipSync?: boolean },
): Promise<TenantModuleRow[]> {
  if (!options?.skipSync) {
    await syncTenantModulesFromProfile(tenantId);
  }

  const db = requireDb();
  const rows = await db
    .select({
      moduleId: schema.modules.id,
      code: schema.modules.code,
      name: schema.modules.name,
      description: schema.modules.description,
      enabled: sql<boolean>`coalesce(${schema.tenantModules.enabled}, false)`,
      source: schema.tenantModules.source,
      sortOrder: schema.modules.sortOrder,
    })
    .from(schema.modules)
    .leftJoin(
      schema.tenantModules,
      and(
        eq(schema.tenantModules.moduleId, schema.modules.id),
        eq(schema.tenantModules.tenantId, tenantId),
      ),
    )
    .where(eq(schema.modules.status, "active"))
    .orderBy(asc(schema.modules.sortOrder), asc(schema.modules.name));

  return rows;
}

export async function getEnabledTenantModuleCodes(tenantId: string) {
  const rows = await listTenantModules(tenantId);
  return rows.filter((row) => row.enabled).map((row) => row.code);
}

export async function isTenantModuleEnabled(tenantId: string, moduleCode: TenantModuleCode) {
  const db = requireDb();
  await syncTenantModulesFromProfile(tenantId);

  const [row] = await db
    .select({ enabled: schema.tenantModules.enabled })
    .from(schema.tenantModules)
    .innerJoin(schema.modules, eq(schema.modules.id, schema.tenantModules.moduleId))
    .where(
      and(
        eq(schema.tenantModules.tenantId, tenantId),
        eq(schema.modules.code, moduleCode),
      ),
    )
    .limit(1);

  return Boolean(row?.enabled);
}

export async function setTenantModuleEnabled(input: {
  tenantId: string;
  moduleCode: TenantModuleCode;
  enabled: boolean;
}) {
  const db = requireDb();
  const [moduleRow] = await db
    .select({ id: schema.modules.id })
    .from(schema.modules)
    .where(and(eq(schema.modules.code, input.moduleCode), eq(schema.modules.status, "active")))
    .limit(1);

  if (!moduleRow) {
    throw new Error(`Unknown module: ${input.moduleCode}`);
  }

  const now = new Date();
  const [existing] = await db
    .select({ id: schema.tenantModules.id })
    .from(schema.tenantModules)
    .where(
      and(
        eq(schema.tenantModules.tenantId, input.tenantId),
        eq(schema.tenantModules.moduleId, moduleRow.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.tenantModules)
      .set({ enabled: input.enabled, source: "manual", updatedAt: now })
      .where(eq(schema.tenantModules.id, existing.id));
    return;
  }

  await db.insert(schema.tenantModules).values({
    tenantId: input.tenantId,
    moduleId: moduleRow.id,
    enabled: input.enabled,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  });
}

export async function requireTenantModuleEnabled(input: {
  tenantId: string;
  tenantSlug: string;
  moduleCode: TenantModuleCode;
}) {
  const enabled = await isTenantModuleEnabled(input.tenantId, input.moduleCode);
  if (!enabled) {
    redirect(
      `/t/${input.tenantSlug}/settings/modules?disabled=${encodeURIComponent(input.moduleCode)}`,
    );
  }
}