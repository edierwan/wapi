"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";
import {
  setTenantModuleEnabled,
  syncTenantModulesFromProfile,
  type TenantModuleCode,
} from "@/server/tenant-modules";

const writeRoles = new Set(["owner", "admin"]);

const toggleSchema = z.object({
  tenantSlug: z.string().min(1),
  moduleCode: z.string().min(1),
  enabled: z.union([z.literal("1"), z.literal("0")]),
});

async function requireSettingsWrite(tenantSlug: string) {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/t/${tenantSlug}/settings/modules`);

  const ctx = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });
  if (!ctx.ok) redirect("/dashboard");
  if (!writeRoles.has(ctx.currentUserRole ?? "")) {
    redirect(`/t/${tenantSlug}/settings/modules`);
  }
  return ctx;
}

export async function toggleTenantModuleAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const data = toggleSchema.parse(raw);
  const ctx = await requireSettingsWrite(data.tenantSlug);

  await setTenantModuleEnabled({
    tenantId: ctx.tenant.id,
    moduleCode: data.moduleCode as TenantModuleCode,
    enabled: data.enabled === "1",
  });

  revalidatePath(`/t/${data.tenantSlug}`, "layout");
  revalidatePath(`/t/${data.tenantSlug}/settings/modules`);
}

export async function applyIndustryPresetAction(formData: FormData) {
  const tenantSlug = z.string().min(1).parse(formData.get("tenantSlug"));
  const ctx = await requireSettingsWrite(tenantSlug);
  await syncTenantModulesFromProfile(ctx.tenant.id);
  revalidatePath(`/t/${tenantSlug}`, "layout");
  revalidatePath(`/t/${tenantSlug}/settings/modules`);
}