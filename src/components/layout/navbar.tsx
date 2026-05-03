"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { nav } from "@/config/marketing";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";

export type NavbarUser = { email: string; name: string | null } | null;

export function Navbar({
  user = null,
  showMarketingLinks = true,
}: {
  user?: NavbarUser;
  showMarketingLinks?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--border)]/60 bg-[color-mix(in_oklch,var(--background)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10">
        <Logo />

        {showMarketingLinks && (
          <nav className="hidden items-center gap-8 md:flex">
            {nav.primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <>
              <span className="hidden max-w-[11rem] truncate text-xs text-[var(--muted-foreground)] 2xl:inline">
                {user.email}
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <SignOutButton variant="outline" size="sm" />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--border)] md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-[var(--border)] md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 py-3 sm:px-6 xl:px-10">
          {showMarketingLinks &&
            nav.primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
          {user ? (
            <p className="mt-2 px-1 text-xs text-[var(--muted-foreground)]">
              Signed in as {user.email}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <SignOutButton variant="outline" size="sm" className="w-full flex-1" />
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/register">Register</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
