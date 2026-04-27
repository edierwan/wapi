"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resendResetOtpAction, type ResetVerifyState, verifyResetOtpAction } from "./actions";

const initial: ResetVerifyState = { ok: false };

export function ResetVerifyForm({
  identifier,
  initialDebugCode,
}: {
  identifier: string;
  initialDebugCode?: string;
}) {
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyResetOtpAction, initial);
  const [resendState, resendAction, resendPending] = useActionState(resendResetOtpAction, initial);
  const [currentIdentifier, setCurrentIdentifier] = useState(identifier);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (verifyState.identifier) setCurrentIdentifier(verifyState.identifier);
  }, [verifyState.identifier]);

  useEffect(() => {
    if (resendState.identifier) setCurrentIdentifier(resendState.identifier);
  }, [resendState.identifier]);

  useEffect(() => {
    if (verifyState.error) setCode("");
  }, [verifyState.error]);

  const debugCode = resendState.debugCode ?? initialDebugCode;

  return (
    <div className="mt-6 space-y-4">
      <form action={verifyAction} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="text-sm font-medium">
            Email or phone number
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            value={currentIdentifier}
            onChange={(event) => setCurrentIdentifier(event.target.value)}
            className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        <div>
          <label htmlFor="code" className="text-sm font-medium">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D+/g, "").slice(0, 4))}
            placeholder="1234"
            className="mt-1.5 block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm tracking-[0.35em] outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>

        {verifyState.error ? (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
            {verifyState.error}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={verifyPending}>
          {verifyPending ? "Verifying…" : "Verify code"}
        </Button>
      </form>

      <form action={resendAction} className="space-y-3">
        <input type="hidden" name="identifier" value={currentIdentifier} />
        <Button type="submit" variant="outline" className="w-full" disabled={resendPending}>
          {resendPending ? "Resending…" : "Resend code"}
        </Button>
      </form>

      {resendState.notice ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm text-[var(--muted-foreground)]">
          {resendState.notice}
        </div>
      ) : null}

      {debugCode ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          Dev fallback: your OTP is <strong>{debugCode}</strong>.
        </div>
      ) : null}
    </div>
  );
}