import type { Metadata } from "next";
import { env } from "@/lib/env";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "Health",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function HealthPage() {
  const data = {
    status: "ok" as const,
    app: appConfig.name,
    environment: env.APP_ENV,
    time: new Date().toISOString(),
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4">
      <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex size-2.5 rounded-full bg-[var(--primary)]" />
          <span className="text-sm font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Healthcheck
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">OK</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          This instance is up and serving requests.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-6 text-sm">
          <div>
            <dt className="text-xs uppercase text-[var(--muted-foreground)]">App</dt>
            <dd className="mt-1 font-medium">{data.app}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--muted-foreground)]">Env</dt>
            <dd className="mt-1 font-medium">{data.environment}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-[var(--muted-foreground)]">Time</dt>
            <dd className="mt-1 font-mono text-xs">{data.time}</dd>
          </div>
        </dl>

        <p className="mt-6 text-xs text-[var(--muted-foreground)]">
          JSON endpoint:{" "}
          <a href="/api/health" className="font-mono underline">
            /api/health
          </a>
        </p>
      </div>
    </main>
  );
}
