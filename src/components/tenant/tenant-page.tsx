import { cn } from "@/lib/utils";

export function TenantPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8", className)}>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

export function TenantPageHeader({
  sectionLabel,
  title,
  description,
  actions,
  meta,
}: {
  sectionLabel: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 max-w-4xl">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)]">
          {sectionLabel}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}