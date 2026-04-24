"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  resendAction,
  verifyAction,
  type ResendState,
  type VerifyFormState,
} from "../register/actions";

const verifyInit: VerifyFormState = { ok: false };
const resendInit: ResendState = { ok: false };

export function VerifyForm({ pendingId }: { pendingId: string }) {
  const [vState, verify, verifying] = useActionState(verifyAction, verifyInit);
  const [rState, resend, resending] = useActionState(resendAction, resendInit);

  return (
    <>
      <form action={verify} className="mt-6 space-y-4">
        <input type="hidden" name="pendingId" value={pendingId} />
        <div>
          <label htmlFor="code" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
            4-digit code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
            autoComplete="one-time-code"
            placeholder="1234"
            className="block h-12 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        {vState.error && (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
            {vState.error}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={verifying}>
          {verifying ? "Verifying…" : "Verify & create workspace"}
        </Button>
      </form>

      <form action={resend} className="mt-4 text-center">
        <input type="hidden" name="pendingId" value={pendingId} />
        <button
          type="submit"
          className="text-xs text-[var(--muted-foreground)] underline underline-offset-4 hover:text-[var(--foreground)]"
          disabled={resending}
        >
          {resending ? "Resending…" : "Resend code"}
        </button>
        {rState.error && (
          <p className="mt-2 text-xs text-[var(--destructive)]">{rState.error}</p>
        )}
        {rState.ok && (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            New code sent.
            {rState.debugCode && (
              <>
                {" "}
                Dev code: <strong>{rState.debugCode}</strong>
              </>
            )}
          </p>
        )}
      </form>
    </>
  );
}
