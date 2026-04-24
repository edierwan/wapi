import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { features } from "@/config/marketing";
import { SectionHeader } from "@/components/marketing/section-header";

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <SectionHeader
        eyebrow="Features"
        title="Everything you need to run WhatsApp properly."
        subtitle="A focused toolkit for campaigns, conversations, and the insights you need to grow — without the noise."
      />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <Card
              key={f.title}
              className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {f.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
