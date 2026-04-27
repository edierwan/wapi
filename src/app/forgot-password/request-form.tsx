"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";

const initial: ForgotPasswordState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  const [identifier, setIdentifier] = useState("");

  useEffect(() => {
    if (typeof state.identifier === "string") {
      setIdentifier(state.identifier);
    }
  }, [state.identifier]);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="identifier" className="text-sm font-medium">
          Email or phone number
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="you@company.com or 60123456789"
          className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {state.error ? (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending verification code…" : "Send verification code"}
      </Button>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login" className="hover:text-[var(--foreground)] hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}