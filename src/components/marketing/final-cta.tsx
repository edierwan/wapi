import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finalCta } from "@/config/marketing";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 sm:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        >
          <div className="absolute -top-20 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]" />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {finalCta.title}
          </h2>
          <p className="mt-3 text-[var(--muted-foreground)] sm:text-lg">
            {finalCta.subtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={finalCta.primary.href}>
                {finalCta.primary.label}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={finalCta.secondary.href}>
                {finalCta.secondary.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
