import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { getCurrentUser } from "@/server/auth";
import { signInAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${appConfig.name}.`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const me = await getCurrentUser().catch(() => null);
  if (me) redirect("/dashboard");

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

          <form action={signInAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-xs text-[var(--muted-foreground)]">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Ada Lovelace"
                className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>

            <Button type="submit" className="w-full">
              Continue
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)]">
              MVP sign-in: email only. Better Auth (password, OAuth, magic
              link) arrives in Phase 2.
            </p>
          </form>
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
