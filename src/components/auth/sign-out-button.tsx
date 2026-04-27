"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { signOutAction } from "@/app/login/actions";

type SignOutButtonProps = Omit<ButtonProps, "children"> & {
  label?: string;
  redirectTo?: string;
};

export function SignOutButton({
  label = "Sign out",
  redirectTo = "/login",
  ...props
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      {...props}
      onClick={() => {
        startTransition(async () => {
          await signOutAction();
          router.replace(redirectTo);
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out..." : label}
    </Button>
  );
}