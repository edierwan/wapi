"use server";

import { redirect } from "next/navigation";
import { clearPasswordResetCookie, completePasswordReset } from "@/server/password-reset";

export type ResetPasswordState = {
  ok: boolean;
  error?: string;
};

export async function saveNewPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const result = await completePasswordReset({ password, confirmPassword });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await clearPasswordResetCookie();
  redirect("/login?notice=Password%20updated.%20Please%20sign%20in.");
}