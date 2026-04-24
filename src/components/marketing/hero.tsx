import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hero } from "@/config/marketing";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-0 top-[-10%] h-[480px] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mx-auto">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--primary)]" />
            {hero.eyebrow}
          </Badge>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {hero.title}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-[var(--muted-foreground)] sm:text-lg">
            {hero.subtitle}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={hero.primaryCta.href}>
                {hero.primaryCta.label}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--muted-foreground)] sm:text-sm">
            {hero.trustBadges.map((b) => (
              <li key={b} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[var(--primary)]" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual placeholder */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl shadow-black/5">
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                <span className="size-2.5 rounded-full bg-[oklch(0.72_0.18_25)]" />
                <span className="size-2.5 rounded-full bg-[oklch(0.8_0.15_80)]" />
                <span className="size-2.5 rounded-full bg-[oklch(0.72_0.16_155)]" />
                <span className="ml-3 text-xs text-[var(--muted-foreground)]">
                  app.wapi.getouch.co
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 bg-[var(--background)] p-6 md:grid-cols-3">
                <PreviewCard label="Active campaigns" value="12" trend="+3 this week" />
                <PreviewCard label="Messages delivered" value="48,291" trend="98.2% delivery" />
                <PreviewCard label="Open inbox threads" value="27" trend="4 urgent" />
                <div className="col-span-full rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
                  <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Campaign: Ramadan Promo</span>
                    <span>Scheduled · 9:00 AM</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <div className="h-full w-[72%] rounded-full bg-[var(--primary)]" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--muted-foreground)]">72% delivered</span>
                    <span className="text-[var(--primary)]">Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{trend}</p>
    </div>
  );
}
