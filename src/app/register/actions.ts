"use server";

import { redirect } from "next/navigation";
import {
  resendRegistrationOtp,
  startRegistration,
  verifyOtpAndCreateAccount,
} from "@/server/registration";

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

export type RegisterFormState = {
  ok: boolean;
  error?: string;
  field?: string;
  debugCode?: string;
};

export async function registerAction(
  _prev: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const res = await startRegistration({
    businessName: s(formData.get("businessName")),
    fullName: s(formData.get("fullName")),
    email: s(formData.get("email")),
    phoneCountryCode: s(formData.get("phoneCountryCode")) || "+60",
    phoneNumber: s(formData.get("phoneNumber")),
    password: s(formData.get("password")),
    confirmPassword: s(formData.get("confirmPassword")),
    businessNature: s(formData.get("businessNature")) || null,
    numberOfAgents: formData.get("numberOfAgents")
      ? Number(formData.get("numberOfAgents"))
      : null,
  });

  if (!res.ok) {
    return { ok: false, error: res.error, field: res.field };
  }

  // Carry the debug code via query (only set in dev when ENABLE_DEV_OTP_FALLBACK=true).
  const qs = new URLSearchParams({ pr: res.pendingId });
  if (res.debugCode) qs.set("dev", res.debugCode);
  redirect(`/verify-phone?${qs.toString()}`);
}

export type VerifyFormState = {
  ok: boolean;
  error?: string;
};

export async function verifyAction(
  _prev: VerifyFormState,
  formData: FormData,
): Promise<VerifyFormState> {
  const pendingId = s(formData.get("pendingId"));
  const code = s(formData.get("code"));
  if (!pendingId || !code) {
    return { ok: false, error: "Missing code." };
  }
  const res = await verifyOtpAndCreateAccount({ pendingId, code });
  if (!res.ok) return { ok: false, error: res.error };
  redirect(`/t/${res.tenantSlug}`);
}

export type ResendState = { ok: boolean; error?: string; debugCode?: string };

export async function resendAction(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const pendingId = s(formData.get("pendingId"));
  if (!pendingId) return { ok: false, error: "Missing registration id." };
  const res = await resendRegistrationOtp(pendingId);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, debugCode: res.debugCode };
}
