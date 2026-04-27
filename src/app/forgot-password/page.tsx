import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { ForgotPasswordForm } from "./request-form";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-20%] h-[420px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_60%)]" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <ArrowLeft />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Enter your registered email or phone number. If the account exists, we&apos;ll send a verification code to its registered WhatsApp phone.
          </p>

          <ForgotPasswordForm />
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