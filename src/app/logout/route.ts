import { NextResponse } from "next/server";
import { signOut } from "@/server/auth";

export async function GET(request: Request) {
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  await signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}