"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInAction, type LoginState } from "./actions";

const initial: LoginState = { ok: false };

export function LoginForm({ devEmailLogin }: { devEmailLogin: boolean }) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
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
        <label htmlFor="password" className="text-sm font-medium">
          Password{" "}
          {devEmailLogin && (
            <span className="text-xs text-[var(--muted-foreground)]">
              (optional in dev)
            </span>
          )}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {state.error && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
