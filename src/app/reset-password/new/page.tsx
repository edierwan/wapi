import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { getActivePasswordResetSession } from "@/server/password-reset";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = {
  title: "Create new password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPasswordPage() {
  const session = await getActivePasswordResetSession();
  if (!session) redirect("/forgot-password");

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-20%] h-[420px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_60%)]" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link href="/login" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            Back to login
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Create new password</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Set a new password for {session.email}. You&apos;ll sign in again after saving.
          </p>

          <NewPasswordForm />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          Need help?{" "}
          <a href={`mailto:${appConfig.support.email}`} className="text-[var(--foreground)] hover:underline">
            {appConfig.support.email}
          </a>
        </p>
      </div>
    </div>
  );
}