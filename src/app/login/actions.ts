"use server";

import { redirect } from "next/navigation";
import {
  signInWithEmail,
  signInWithPassword,
  signOut as authSignOut,
} from "@/server/auth";
import { userHasSystemPermission } from "@/server/permissions";

export type LoginState = { ok: boolean; error?: string; identifier?: string };

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  let userId: string;
  try {
    if (password) {
      const u = await signInWithPassword({ identifier, password });
      userId = u.id;
    } else if (process.env.ENABLE_DEV_EMAIL_LOGIN === "true") {
      const u = await signInWithEmail({ email: identifier, name });
      userId = u.id;
    } else {
      return { ok: false, error: "Please enter your password.", identifier };
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Invalid email/phone or password.",
      identifier,
    };
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
