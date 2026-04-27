"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/server/password-reset";

export type ForgotPasswordState = {
  ok: boolean;
  error?: string;
  identifier?: string;
};

export async function requestPasswordResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) {
    return { ok: false, error: "Email or phone number is required.", identifier };
  }

  const result = await requestPasswordReset(identifier);
  const qs = new URLSearchParams({
    identifier,
    notice: result.message,
  });
  if (result.debugCode) qs.set("dev", result.debugCode);
  redirect(`/forgot-password/verify?${qs.toString()}`);
}