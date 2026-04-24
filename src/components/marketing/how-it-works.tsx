import { howItWorks } from "@/config/marketing";
import { SectionHeader } from "@/components/marketing/section-header";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-[var(--border)] bg-[var(--muted)]/50"
    >
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="How it works"
          title="Up and sending in three steps."
          subtitle="No long onboarding. No setup calls required."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {howItWorks.map((s, i) => (
            <div
              key={s.step}
              className="relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]">
                  {i + 1}
                </span>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                  {s.step}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
