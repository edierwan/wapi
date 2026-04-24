import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Building2,
  Users as UsersIcon,
  Smartphone,
  Cpu,
  ListChecks,
  CreditCard,
  ScrollText,
  Activity,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/server/auth";
import {
  getUserSystemRoleCodes,
  userHasAnySystemRole,
} from "@/server/permissions";
import { signOutAction } from "@/app/login/actions";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "System admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TILES = [
  { icon: Building2, title: "Tenants", desc: "All workspaces, status, plan, owners." },
  { icon: UsersIcon, title: "Users", desc: "Global user directory, system roles." },
  { icon: Smartphone, title: "WhatsApp sessions", desc: "Connected numbers, session health." },
  { icon: ListChecks, title: "Jobs / queue", desc: "Send queue, failures, warm-up state." },
  { icon: Cpu, title: "AI providers", desc: "Shared Dify / Ollama defaults, per-tenant overrides." },
  { icon: CreditCard, title: "Billing", desc: "Plans, subscriptions, payments." },
  { icon: ScrollText, title: "Audit logs", desc: "Every admin action, every tenant change." },
  { icon: Activity, title: "System health", desc: "DB, gateway, worker, realtime." },
  { icon: ShieldAlert, title: "Abuse monitor", desc: "Tenant-level risk signals (Phase 9)." },
];

export default async function AdminPage() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) redirect("/login?next=/admin");

  const hasSystemRole = await userHasAnySystemRole(me.id);
  if (!hasSystemRole) {
    redirect("/access-denied?reason=admin");
  }
  const codes = await getUserSystemRoleCodes(me.id);

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Badge className="bg-[var(--primary)] text-[var(--primary-foreground)]">
              System Admin
            </Badge>
            <span className="text-sm text-[var(--muted-foreground)]">
              {appConfig.name} · {process.env.NEXT_PUBLIC_APP_ENV || "development"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--muted-foreground)]">{me.email}</span>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {me.name || me.email.split("@")[0]}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Your system roles:{" "}
            {codes.length ? (
              codes.map((c) => (
                <Badge key={c} className="mr-1 font-mono text-xs">
                  {c}
                </Badge>
              ))
            ) : (
              <em>none</em>
            )}
          </p>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            Full admin modules ship progressively. Phase 8 lands the first wave
            (tenants, users, audit, system health). For now, these tiles show
            what&apos;s coming.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <Card key={t.title} className="opacity-80">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                  <t.icon className="size-5" />
                </div>
                <CardTitle className="flex items-center justify-between text-base">
                  {t.title}
                  <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)]">
                    Coming soon
                  </Badge>
                </CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-[var(--muted-foreground)]">
                Placeholder tile — see{" "}
                <Link
                  className="underline"
                  href="https://github.com/edierwan/wapi/blob/develop/docs/architecture/admin-console.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  admin-console.md
                </Link>
                .
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
