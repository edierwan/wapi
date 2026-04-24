import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pricing } from "@/config/marketing";
import { SectionHeader } from "@/components/marketing/section-header";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="border-y border-[var(--border)] bg-[var(--muted)]/50"
    >
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple plans that grow with you."
          subtitle="Start free. Upgrade when your team is ready. No surprise fees."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {pricing.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-xl border bg-[var(--card)] p-7 transition-all",
                p.featured
                  ? "border-[var(--primary)] shadow-lg shadow-[color-mix(in_oklch,var(--primary)_20%,transparent)] ring-1 ring-[var(--primary)]"
                  : "border-[var(--border)] hover:shadow-md",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-1 text-xs font-medium text-[var(--primary-foreground)]">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {p.description}
              </p>

              <p className="mt-6 text-3xl font-semibold tracking-tight">
                {p.price}
              </p>

              <ul className="mt-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  asChild
                  className="w-full"
                  variant={p.featured ? "default" : "outline"}
                >
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
