import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${appConfig.name}.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect("/dashboard");
  const { notice } = await searchParams;

  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-0 top-[-20%] h-[420px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_60%)]" />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Sign in to your {appConfig.name} workspace.
          </p>

          {notice ? (
            <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          <LoginForm devEmailLogin={process.env.ENABLE_DEV_EMAIL_LOGIN === "true"} />

          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-[var(--foreground)] hover:underline">
              Register
            </Link>
          </p>
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
