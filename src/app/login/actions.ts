"use server";

import { redirect } from "next/navigation";
import { signInWithEmail, signOut as authSignOut } from "@/server/auth";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  await signInWithEmail({ email, name });
  redirect("/dashboard");
}

export async function signOutAction() {
  await authSignOut();
  redirect("/login");
}
