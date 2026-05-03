"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BrokerAuthState =
  | "not_configured"
  | "not_tested"
  | "testing"
  | "connected"
  | "failed";

type BrokerAuthResponse = {
  configured?: boolean;
  connected?: boolean;
  status?: string;
};

type StatusTone = "good" | "neutral" | "warning" | "muted" | "danger";

export function PlatformRuntimePanels({
  platformApiConfigured,
  platformAppKeyConfigured,
  registryAppCode,
  hasLegacyCompatibilityConfig,
  hasEvolutionSignal,
}: {
  platformApiConfigured: boolean;
  platformAppKeyConfigured: boolean;
  registryAppCode: string;
  hasLegacyCompatibilityConfig: boolean;
  hasEvolutionSignal: boolean;
}) {
  const brokerConfigured = platformApiConfigured && platformAppKeyConfigured;
  const [brokerAuthState, setBrokerAuthState] = useState<BrokerAuthState>(
    brokerConfigured ? "not_tested" : "not_configured",
  );
  const [statusMessage, setStatusMessage] = useState(
    brokerConfigured
      ? "Paste env values into Coolify, redeploy WAPI, then run broker auth test."
      : "Platform broker env is not configured.",
  );

  const brokerAuthLabel = brokerAuthStateLabel(brokerAuthState);
  const brokerAuthToneValue = toneForBrokerAuthState(brokerAuthState);
  const serviceRows = buildServiceRows({
    brokerConfigured,
    brokerAuthState,
    hasEvolutionSignal,
  });

  async function handleBrokerAuthTest() {
    if (!brokerConfigured) {
      setBrokerAuthState("not_configured");
      setStatusMessage("Platform broker env is not configured.");
      return;
    }

    setBrokerAuthState("testing");
    setStatusMessage("Running broker auth test…");

    try {
      const res = await fetch("/api/admin/settings/platform-broker-test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      });

      const json = (await res.json().catch(() => null)) as BrokerAuthResponse | null;
      const nextMessage =
        typeof json?.status === "string" && json.status.trim()
          ? json.status.trim()
          : "Broker auth request failed.";

      if (!res.ok && (res.status === 401 || res.status === 403)) {
        setBrokerAuthState("failed");
        setStatusMessage(nextMessage);
        return;
      }

      if (!json?.configured) {
        setBrokerAuthState("not_configured");
        setStatusMessage(nextMessage);
        return;
      }

      setBrokerAuthState(json.connected ? "connected" : "failed");
      setStatusMessage(nextMessage);
    } catch (error) {
      setBrokerAuthState("failed");
      setStatusMessage(
        error instanceof Error ? error.message : "Broker auth request failed.",
      );
    }
  }

  return (
    <>
      <Card className="border-[var(--border)] shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="text-base">Platform Access</CardTitle>
          <CardDescription>
            WAPI connects to the shared platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <DetailStatusRow
              label="Platform API URL"
              value={platformApiConfigured ? "Configured" : "Not configured"}
              trailing={
                <StatusPill tone={platformApiConfigured ? "neutral" : "muted"}>
                  {platformApiConfigured ? "Configured" : "Not configured"}
                </StatusPill>
              }
            />
            <DetailStatusRow
              label="Platform App Key"
              value={platformAppKeyConfigured ? "Configured" : "Not configured"}
              trailing={
                <StatusPill tone={platformAppKeyConfigured ? "neutral" : "muted"}>
                  {platformAppKeyConfigured ? "Configured" : "Not configured"}
                </StatusPill>
              }
            />
            <DetailStatusRow
              label="Registry app code"
              value={registryAppCode}
            />
            <DetailStatusRow
              label="Broker auth"
              value={brokerAuthLabel}
              className="border-b-0"
              trailing={<StatusPill tone={brokerAuthToneValue}>{brokerAuthLabel}</StatusPill>}
            />
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-[var(--muted-foreground)]">
            To connect WAPI to the shared GetTouch platform, copy the WAPI Runtime Setup env block from portal.getouch.co, paste it into the WAPI Coolify environment variables, redeploy WAPI, then run broker auth test.
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleBrokerAuthTest()}
                disabled={!brokerConfigured || brokerAuthState === "testing"}
              >
                {brokerAuthState === "testing" ? "Testing…" : "Test Broker Auth"}
              </Button>
              <span className="text-xs text-[var(--muted-foreground)]">
                {statusMessage}
              </span>
            </div>
          </div>

          {hasLegacyCompatibilityConfig ? (
            <p className="text-xs leading-6 text-[var(--muted-foreground)]">
              Legacy direct gateway env detected. WAPI can still run, but platform broker mode is preferred.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-[var(--border)] shadow-sm shadow-black/5">
        <CardHeader>
          <CardTitle className="text-base">Service Routing</CardTitle>
          <CardDescription>
            Platform-managed service endpoints and status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            {serviceRows.map((service) => (
              <ServiceRow
                key={service.label}
                label={service.label}
                provider={service.provider}
                status={service.status}
                tone={service.tone}
              />
            ))}
          </div>
          <p className="text-xs leading-6 text-[var(--muted-foreground)]">
            Service-specific credentials are managed outside WAPI.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function buildServiceRows(input: {
  brokerConfigured: boolean;
  brokerAuthState: BrokerAuthState;
  hasEvolutionSignal: boolean;
}) {
  const sharedStatus = statusForPlatformManagedService(input);
  const whatsappStatus = statusForWhatsappService(input);
  const qdrantStatus = statusForQdrant(input);

  return [
    {
      label: "WhatsApp delivery",
      provider: "Evolution Gateway",
      status: whatsappStatus.status,
      tone: whatsappStatus.tone,
    },
    {
      label: "AI chat / model routing",
      provider: "LiteLLM / vLLM",
      status: sharedStatus.status,
      tone: sharedStatus.tone,
    },
    {
      label: "Knowledge / workflow",
      provider: "Dify",
      status: sharedStatus.status,
      tone: sharedStatus.tone,
    },
    {
      label: "Customer inbox",
      provider: "Chatwoot",
      status: sharedStatus.status,
      tone: sharedStatus.tone,
    },
    {
      label: "Tracing / observability",
      provider: "Langfuse",
      status: sharedStatus.status,
      tone: sharedStatus.tone,
    },
    {
      label: "Vector memory",
      provider: "Qdrant",
      status: qdrantStatus.status,
      tone: qdrantStatus.tone,
    },
  ] as const;
}

function statusForPlatformManagedService(input: {
  brokerConfigured: boolean;
  brokerAuthState: BrokerAuthState;
}): { status: string; tone: StatusTone } {
  if (!input.brokerConfigured) {
    return { status: "Not configured", tone: "muted" };
  }

  switch (input.brokerAuthState) {
    case "connected":
      return { status: "Available", tone: "neutral" };
    case "failed":
      return { status: "Failed", tone: "danger" };
    case "testing":
      return { status: "Testing…", tone: "warning" };
    default:
      return { status: "Not tested yet", tone: "warning" };
  }
}

function statusForWhatsappService(input: {
  brokerConfigured: boolean;
  brokerAuthState: BrokerAuthState;
  hasEvolutionSignal: boolean;
}): { status: string; tone: StatusTone } {
  if (!input.brokerConfigured) {
    return { status: "Not configured", tone: "muted" };
  }

  switch (input.brokerAuthState) {
    case "connected":
      return {
        status: input.hasEvolutionSignal ? "Connected" : "Available",
        tone: input.hasEvolutionSignal ? "good" : "neutral",
      };
    case "failed":
      return { status: "Failed", tone: "danger" };
    case "testing":
      return { status: "Testing…", tone: "warning" };
    default:
      return { status: "Not tested yet", tone: "warning" };
  }
}

function statusForQdrant(input: {
  brokerConfigured: boolean;
  brokerAuthState: BrokerAuthState;
}): { status: string; tone: StatusTone } {
  if (!input.brokerConfigured) {
    return { status: "Optional", tone: "warning" };
  }

  if (input.brokerAuthState === "connected") {
    return { status: "Available", tone: "neutral" };
  }

  return { status: "Optional", tone: "warning" };
}

function brokerAuthStateLabel(value: BrokerAuthState): string {
  switch (value) {
    case "connected":
      return "Connected";
    case "failed":
      return "Failed";
    case "testing":
      return "Testing…";
    case "not_configured":
      return "Not configured";
    default:
      return "Not tested yet";
  }
}

function toneForBrokerAuthState(value: BrokerAuthState): StatusTone {
  switch (value) {
    case "connected":
      return "good";
    case "failed":
      return "danger";
    case "testing":
    case "not_tested":
      return "warning";
    default:
      return "muted";
  }
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: StatusTone;
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "neutral"
        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
        : tone === "warning"
          ? "border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
          : tone === "danger"
            ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]";

  return <Badge className={toneClass}>{children}</Badge>;
}

function DetailStatusRow({
  label,
  value,
  trailing,
  className,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 ${className ?? ""}`}
    >
      <div className="min-w-0">
        <div className="text-xs text-[var(--muted-foreground)]">{label}</div>
        <div className="mt-1 break-all text-sm font-medium text-[var(--foreground)]">
          {value}
        </div>
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
  tone: StatusTone;
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