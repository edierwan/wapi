import { Check } from "lucide-react";
import { benefits } from "@/config/marketing";
import { SectionHeader } from "@/components/marketing/section-header";

export function Benefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Why WAPI"
        title="Built for teams that take messaging seriously."
        subtitle="The calm alternative to spreadsheets, group chats, and half-finished tools."
      />

      <ul className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map((b) => (
          <li key={b.title} className="flex gap-4">
            <span className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_15%,transparent)] text-[var(--primary)]">
              <Check className="size-4" />
            </span>
            <div>
              <h3 className="font-medium">{b.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                {b.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
