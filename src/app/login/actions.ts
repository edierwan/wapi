"use server";

import { redirect } from "next/navigation";
import {
  signInWithEmail,
  signInWithPassword,
  signOut as authSignOut,
} from "@/server/auth";
import { userHasSystemPermission } from "@/server/permissions";

export type LoginState = { ok: boolean; error?: string };

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  let userId: string;
  try {
    if (password) {
      const u = await signInWithPassword({ email, password });
      userId = u.id;
    } else if (process.env.ENABLE_DEV_EMAIL_LOGIN === "true") {
      const u = await signInWithEmail({ email, name });
      userId = u.id;
    } else {
      return { ok: false, error: "Please enter your password." };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Login failed." };
  }

  // System admins (anyone with system.admin.access) always land on /admin.
  const isAdmin = await userHasSystemPermission(userId, "system.admin.access").catch(
    () => false,
  );
  redirect(isAdmin ? "/admin" : "/dashboard");
}

export async function signOutAction() {
  await authSignOut();
  redirect("/login");
}
