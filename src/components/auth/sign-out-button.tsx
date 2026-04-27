"use client";

import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

type SignOutButtonProps = Omit<ButtonProps, "children"> & {
  label?: string;
};

export function SignOutButton({
  label = "Sign out",
  ...props
}: SignOutButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      {...props}
      onClick={() => {
        startTransition(async () => {
          window.location.assign("/logout");
        });
      }}
    >
      {pending ? "Signing out..." : label}
    </Button>
  );
}