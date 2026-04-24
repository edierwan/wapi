"use server";

import { redirect } from "next/navigation";
import {
  signInWithEmail,
  signInWithPassword,
  signOut as authSignOut,
} from "@/server/auth";

export type LoginState = { ok: boolean; error?: string };

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  try {
    if (password) {
      await signInWithPassword({ email, password });
    } else if (process.env.ENABLE_DEV_EMAIL_LOGIN === "true") {
      await signInWithEmail({ email, name });
    } else {
      return { ok: false, error: "Please enter your password." };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Login failed." };
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  await authSignOut();
  redirect("/login");
}
