import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { appConfig } from "@/config/app";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: appConfig.name,
      environment: env.APP_ENV,
      time: new Date().toISOString(),
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
