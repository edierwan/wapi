"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { registerAction, type RegisterFormState } from "./actions";

const initial: RegisterFormState = { ok: false };

const NATURES = [
  { value: "", label: "— optional —" },
  { value: "product", label: "Product-based" },
  { value: "service", label: "Service-based" },
  { value: "hybrid", label: "Hybrid (product + service)" },
  { value: "booking", label: "Booking / appointment" },
  { value: "lead_gen", label: "Lead generation" },
  { value: "support", label: "Support / helpdesk" },
  { value: "other", label: "Other" },
];

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field name="businessName" label="Business name" placeholder="Klinik ABC Sdn Bhd" required />
      <Field name="fullName" label="Your full name" placeholder="Ada Lovelace" required autoComplete="name" />
      <Field name="email" label="Email" type="email" placeholder="you@company.com" required autoComplete="email" />

      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div>
          <label htmlFor="cc" className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
            Code
          </label>
          <select
            id="cc"
            name="phoneCountryCode"
            defaultValue="+60"
            className="h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm focus:ring-2 focus:ring-[var(--ring)]"
          >
            <option value="+60">+60 MY</option>
            <option value="+65">+65 SG</option>
            <option value="+62">+62 ID</option>
            <option value="+66">+66 TH</option>
            <option value="+1">+1 US</option>
          </select>
        </div>
        <Field
          name="phoneNumber"
          label="WhatsApp number"
          placeholder="123456789"
          inputMode="numeric"
          required
          autoComplete="tel-national"
        />
      </div>

      <Field
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="new-password"
        hint="Min 8 characters."
      />
      <Field
        name="confirmPassword"
        label="Confirm password"
        type="password"
        required
        autoComplete="new-password"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="businessNature"
            className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]"
          >
            Business nature
          </label>
          <select
            id="businessNature"
            name="businessNature"
            className="h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-sm focus:ring-2 focus:ring-[var(--ring)]"
          >
            {NATURES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <Field
          name="numberOfAgents"
          label="Team size"
          type="number"
          placeholder="1"
          min={1}
        />
      </div>

      {state.error && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
          {state.error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending OTP…" : "Send WhatsApp OTP"}
      </Button>

      <p className="text-center text-xs text-[var(--muted-foreground)]">
        By registering you agree to the{" "}
        <a href="/terms" className="underline">
          terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className="block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
        {...rest}
      />
      {hint && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>
      )}
    </div>
  );
}
