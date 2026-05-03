import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { appConfig } from "@/config/app";
import { PlatformRuntimePanels } from "./PlatformRuntimePanels";

export const dynamic = "force-dynamic";

export default async function Page() {
  const checkedAt = new Date();
  const registrationUrl = buildRegistrationUrl(env.APP_URL);
  const platformConfigured = Boolean(env.PLATFORM_API_URL && env.PLATFORM_APP_KEY);
  const hasLegacyCompatibilityConfig = Boolean(
    env.WA_GATEWAY_URL ||
      env.WA_GATEWAY_DEFAULT_URL ||
      env.WA_PUBLIC_URL ||
      env.WA_API_KEY ||
      env.DIFY_BASE_URL ||
      env.DIFY_DEFAULT_BASE_URL ||
      env.DIFY_APP_API_KEY,
  );
  const hasEvolutionSignal =
    env.USE_PLATFORM_BROKER ||
    /evo|evolution/i.test(
      [env.WA_GATEWAY_URL, env.WA_GATEWAY_DEFAULT_URL, env.WA_PUBLIC_URL].join(" "),
    );

  const featureFlags = [
    ["ENABLE_PUBLIC_REGISTRATION", env.ENABLE_PUBLIC_REGISTRATION ? "true" : "false"],
    ["ENABLE_DEV_EMAIL_LOGIN", env.ENABLE_DEV_EMAIL_LOGIN ? "true" : "false"],
    ["ENABLE_DEV_OTP_FALLBACK", env.ENABLE_DEV_OTP_FALLBACK ? "true" : "false"],
    ["USE_PLATFORM_BROKER", env.USE_PLATFORM_BROKER ? "true" : "false"],
    ["REQUIRE_PLATFORM_APP_KEY", env.REQUIRE_PLATFORM_APP_KEY ? "true" : "false"],
  ] as const;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Runtime connections and platform-managed service access. Secrets stay hidden.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr_0.95fr]">
        <Card className="border-[var(--border)] shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
            <CardDescription>
              Core application identity and public runtime endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <DetailRow label="App name" value={appConfig.name} />
            <DetailRow label="Environment" value={env.APP_ENV} />
            <DetailRow label="App URL" value={env.APP_URL} href={env.APP_URL} />
            <DetailRow label="Tenant routing mode" value={env.TENANT_ROUTING_MODE} badge />
            <DetailRow label="Registration URL" value={registrationUrl} href={registrationUrl} />
            <DetailRow
              label="Commit SHA"
              value={env.RUNTIME_COMMIT_SHA || "Not exposed by runtime env"}
              className="border-b-0"
            />
          </CardContent>
        </Card>

        <PlatformRuntimePanels
          platformApiConfigured={Boolean(env.PLATFORM_API_URL)}
          platformAppKeyConfigured={Boolean(env.PLATFORM_APP_KEY)}
          registryAppCode={env.PLATFORM_APP_CODE || "wapi"}
          hasLegacyCompatibilityConfig={hasLegacyCompatibilityConfig}
          hasEvolutionSignal={hasEvolutionSignal}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-[var(--border)] shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-base">Feature Flags</CardTitle>
            <CardDescription>
              Boolean configuration toggles.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            {featureFlags.map(([name, value], index) => (
              <div
                key={name}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  index === featureFlags.length - 1 ? "" : "border-b border-[var(--border)]"
                }`}
              >
                <span className="font-mono text-xs text-[var(--muted-foreground)]">
                  {name}
                </span>
                <StatusPill tone={value === "true" ? "good" : "muted"}>{value}</StatusPill>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[var(--border)] shadow-sm shadow-black/5">
          <CardHeader>
            <CardTitle className="text-base">Security &amp; Secrets</CardTitle>
            <CardDescription>
              Read-only security posture and secret management.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <DetailRow label="Visibility" value="Raw service API keys are not shown here." />
              <DetailRow label="Secret handling" value="Secrets are managed centrally." />
              <DetailRow
                label="Last sync status"
                value={platformConfigured ? "Not tested yet" : "Not configured"}
                trailing={
                  <StatusPill tone={platformConfigured ? "warning" : "muted"}>
                    {platformConfigured ? "Not tested yet" : "Not configured"}
                  </StatusPill>
                }
              />
              <DetailRow
                label="Last checked"
                value={checkedAt.toLocaleString()}
                className="border-b-0"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function buildRegistrationUrl(appUrl: string): string {
  try {
    return new URL("/register", appUrl).toString();
  } catch {
    return `${appUrl.replace(/\/$/, "")}/register`;
  }
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "neutral" | "warning" | "muted";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "neutral"
        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
        : tone === "warning"
          ? "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]";

  return <Badge className={toneClass}>{children}</Badge>;
}

function DetailRow({
  label,
  value,
  href,
  badge,
  trailing,
  className,
}: {
  label: string;
  value: string;
  href?: string;
  badge?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const content = href ? (
    <a href={href} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
      {value}
    </a>
  ) : badge ? (
    <StatusPill tone="muted">{value}</StatusPill>
  ) : (
    <div className="break-all text-sm font-medium text-[var(--foreground)]">{value}</div>
  );

  return (
    <div className={`flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 ${className ?? ""}`}>
      <div className="min-w-0">
        <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
        <div className="mt-1">{content}</div>
      </div>
      {trailing}
    </div>
  );
}

function ServiceRow({
  label,
  provider,
  status,
  tone,
}: {
  label: string;
  provider: string;
  status: string;
  tone: "good" | "neutral" | "warning" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[var(--foreground)]">{label}</div>
        <div className="mt-1 text-xs text-[var(--muted-foreground)]">{provider}</div>
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
    </div>
  );
}
