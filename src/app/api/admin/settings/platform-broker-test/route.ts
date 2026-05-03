import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { userHasSystemPermission } from "@/server/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function platformEnv() {
  const apiUrl =
    process.env.PLATFORM_API_URL?.trim() ||
    process.env.GETOUCH_PLATFORM_API_URL?.trim() ||
    "";
  const appKey =
    process.env.PLATFORM_APP_KEY?.trim() ||
    process.env.GETOUCH_PLATFORM_APP_KEY?.trim() ||
    "";

  return {
    apiUrl,
    appKey,
    configured: Boolean(apiUrl && appKey),
  };
}

function safeStatus(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  return fallback;
}

export async function POST() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        status: "Authentication required.",
      },
      { status: 401 },
    );
  }

  const canAccess = await userHasSystemPermission(me.id, "system.admin.access").catch(
    () => false,
  );
  if (!canAccess) {
    return NextResponse.json(
      {
        configured: false,
        connected: false,
        status: "Admin access required.",
      },
      { status: 403 },
    );
  }

  const { apiUrl, appKey, configured } = platformEnv();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      status: "Platform broker env is not configured.",
    });
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/check`, {
      method: "POST",
      headers: {
        "x-platform-app-key": appKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || data?.ok !== true) {
      return NextResponse.json({
        configured: true,
        connected: false,
        status: safeStatus(data, `Broker auth failed (${res.status}).`),
      });
    }

    return NextResponse.json({
      configured: true,
      connected: true,
      status: "Broker auth passed.",
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      status: error instanceof Error ? error.message : "Broker auth request failed.",
    });
  }
}