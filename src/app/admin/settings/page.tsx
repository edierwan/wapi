import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { appConfig } from "@/config/app";

export const dynamic = "force-dynamic";

export default function Page() {
  const featureFlags = [
    ["ENABLE_PUBLIC_REGISTRATION", env.ENABLE_PUBLIC_REGISTRATION ? "true" : "false"],
    ["ENABLE_DEV_EMAIL_LOGIN", env.ENABLE_DEV_EMAIL_LOGIN ? "true" : "false"],
    ["ENABLE_DEV_OTP_FALLBACK", env.ENABLE_DEV_OTP_FALLBACK ? "true" : "false"],
  ] as const;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Read-only environment and feature configuration. Secrets remain hidden.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-[var(--muted-foreground)] underline-offset-2 hover:underline"
        >
          ← Overview
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application</CardTitle>
          <CardDescription>
            Public URLs and runtime posture for the current deployment target.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="App name" value={appConfig.name} />
          <Detail label="Environment" value={env.APP_ENV} />
          <Detail label="App URL" value={env.APP_URL} />
          <Detail label="Tenant routing mode" value={env.TENANT_ROUTING_MODE} />
          <Detail label="WhatsApp gateway URL" value={env.WA_GATEWAY_URL || "Not set"} />
          <Detail label="Default WA gateway" value={env.WA_GATEWAY_DEFAULT_URL || "Not set"} />
          <Detail label="Dify default base URL" value={env.DIFY_DEFAULT_BASE_URL || "Not set"} />
          <Detail label="Commit SHA" value="Not exposed by runtime env" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
          <CardDescription>
            Booleans only. No secret values are rendered in this module.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {featureFlags.map(([name, value]) => (
            <div key={name} className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2">
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{name}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
      <div className="mt-1 break-all text-sm font-medium">{value}</div>
    </div>
  );
}
