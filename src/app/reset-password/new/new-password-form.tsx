"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { saveNewPasswordAction, type ResetPasswordState } from "./actions";

const initial: ResetPasswordState = { ok: false };

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(saveNewPasswordAction, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="••••••••"
          className="mt-1.5"
          required
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm password
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="••••••••"
          className="mt-1.5"
          required
        />
      </div>

      {state.error ? (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving password…" : "Save new password"}
      </Button>
    </form>
  );
}