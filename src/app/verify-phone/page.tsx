import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { getCurrentUser } from "@/server/auth";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = {
  title: "Verify phone",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{ pr?: string; dev?: string }>;
}) {
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect("/dashboard");

  const { pr, dev } = await searchParams;
  if (!pr) redirect("/register");

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-20%] h-[420px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_60%)]" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/register"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Back
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Verify your WhatsApp</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Enter the 4-digit code we sent to your WhatsApp. It expires in
            10 minutes.
          </p>

          {dev && (
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              Dev fallback: your OTP is <strong>{dev}</strong>. (Only shown
              because <code>ENABLE_DEV_OTP_FALLBACK=true</code>.)
            </div>
          )}

          <VerifyForm pendingId={pr} />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          Need help?{" "}
          <a
            href={`mailto:${appConfig.support.email}`}
            className="text-[var(--foreground)] hover:underline"
          >
            {appConfig.support.email}
          </a>
        </p>
      </div>
    </div>
  );
}
