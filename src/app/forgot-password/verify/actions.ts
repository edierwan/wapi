"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset, verifyPasswordResetOtp } from "@/server/password-reset";

export type ResetVerifyState = {
  ok: boolean;
  error?: string;
  notice?: string;
  identifier?: string;
  debugCode?: string;
};

export async function verifyResetOtpAction(
  _prev: ResetVerifyState,
  formData: FormData,
): Promise<ResetVerifyState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();

  if (!identifier || !code) {
    return { ok: false, error: "Identifier and verification code are required.", identifier };
  }

  const result = await verifyPasswordResetOtp({ identifier, code });
  if (!result.ok) {
    return { ok: false, error: result.error, identifier };
  }

  redirect("/reset-password/new");
}

export async function resendResetOtpAction(
  _prev: ResetVerifyState,
  formData: FormData,
): Promise<ResetVerifyState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) {
    return { ok: false, error: "Email or phone number is required.", identifier };
  }

  const result = await requestPasswordReset(identifier);
  return {
    ok: true,
    notice: result.message,
    identifier,
    debugCode: result.debugCode,
  };
}