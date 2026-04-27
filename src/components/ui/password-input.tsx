"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className = "", ...props }, ref) {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={className}>
        <div className="relative">
          <input
            ref={ref}
            {...props}
            type={visible ? "text" : "password"}
            className="block h-10 w-full rounded-md border border-[var(--input)] bg-[var(--background)] px-3 pr-11 text-sm outline-none placeholder:text-[var(--muted-foreground)]/70 focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
    );
  },
);