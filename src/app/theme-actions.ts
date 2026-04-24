"use server";

import { cookies } from "next/headers";

export async function setThemeAction(theme: "light" | "dark") {
  const c = await cookies();
  c.set("wapi_theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
