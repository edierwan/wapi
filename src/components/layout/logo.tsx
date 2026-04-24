import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { appConfig } from "@/config/app";

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={appConfig.name}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span className="grid size-8 place-items-center rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
        <MessageCircle className="size-4" />
      </span>
      {withText && <span className="text-base">{appConfig.name}</span>}
    </Link>
  );
}
