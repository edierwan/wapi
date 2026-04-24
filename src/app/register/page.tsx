import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { getCurrentUser } from "@/server/auth";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Register",
  description: `Create your ${appConfig.name} workspace.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect("/dashboard");

  const publicRegEnabled = process.env.ENABLE_PUBLIC_REGISTRATION === "true";
  const isProd = process.env.NODE_ENV === "production";
  const closed = isProd && !publicRegEnabled;

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-[-20%] h-[420px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_60%)]" />
      </div>

      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Sign in
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your {appConfig.name} workspace
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            We&apos;ll send a 4-digit code to your WhatsApp number to verify it.
          </p>

          {closed ? (
            <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--muted)] p-4 text-sm">
              Registration is not open yet. Please contact{" "}
              <a
                className="underline"
                href={`mailto:${appConfig.support.email}`}
              >
                {appConfig.support.email}
              </a>{" "}
              for early access.
            </div>
          ) : (
            <RegisterForm />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--foreground)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
