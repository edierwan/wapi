"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { signInAction, type LoginState } from "./actions";

const initial: LoginState = { ok: false };

export function LoginForm({ devEmailLogin }: { devEmailLogin: boolean }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (typeof state.identifier === "string") {
      setIdentifier(state.identifier);
    }
    if (state.error) {
      setPassword("");
    }
  }, [state.error, state.identifier]);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="identifier" className="text-sm font-medium">
          Email or Phone
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          inputMode="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Enter your email or phone"
          className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
        />
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
          Use your registered email or phone number.
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium">
            Password{" "}
            {devEmailLogin && (
              <span className="text-xs text-[var(--muted-foreground)]">
                (optional in dev)
              </span>
            )}
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          className="mt-1.5"
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
