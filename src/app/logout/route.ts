import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/server/auth";

export async function GET(request: Request) {
  await signOut();
  return NextResponse.redirect(await loginUrl(request));
}

export async function POST(request: Request) {
  await signOut();
  return NextResponse.redirect(await loginUrl(request));
}

async function loginUrl(request: Request) {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto =
    process.env.NODE_ENV === "production"
      ? "https"
      : hdrs.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? new URL("/login", `${proto}://${host}`) : new URL("/login", request.url);
}