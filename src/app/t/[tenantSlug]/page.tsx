import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Inbox,
  MessagesSquare,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth";
import { resolveTenantBySlug } from "@/server/tenant";

export const dynamic = "force-dynamic";

export default async function TenantWorkspacePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const res = await resolveTenantBySlug({
    slug: tenantSlug,
    currentUserId: me.id,
  });

  if (!res.ok) {
    switch (res.error.kind) {
      case "forbidden":
        redirect(`/access-denied?slug=${encodeURIComponent(tenantSlug)}`);
      case "suspended":
      case "disabled":
        redirect(
          `/workspace-not-found?slug=${encodeURIComponent(
            tenantSlug,
          )}&status=${res.error.status}`,
        );
      case "not-found":
      case "invalid-slug":
      case "reserved-slug":
      default:
        redirect(`/workspace-not-found?slug=${encodeURIComponent(tenantSlug)}`);
    }
  }

  const { tenant, currentUserRole } = res;

  const placeholders = [
    {
      title: "WhatsApp Accounts",
      description: "Connect one or more numbers. Each maps to a Baileys session.",
      icon: Smartphone,
    },
    {
      title: "Contacts",
      description: "Import, tag, and segment your audience.",
      icon: Users,
    },
    {
      title: "Campaigns",
      description: "Create, schedule, and measure broadcasts.",
      icon: MessagesSquare,
    },
    {
      title: "Inbox",
      description: "Shared inbox for team replies and assignments.",
      icon: Inbox,
    },
    {
      title: "AI Assistant",
      description: "On-brand drafts powered by your tenant's AI provider.",
      icon: Sparkles,
    },
    {
      title: "Analytics",
      description: "Delivery, reply, and conversion insights.",
      icon: BarChart3,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Link href="/dashboard" className="hover:text-[var(--foreground)]">
              Workspaces
            </Link>
            <span>/</span>
            <span className="font-mono">/t/{tenant.slug}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{tenant.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Badge className="uppercase">{tenant.status}</Badge>
            <span>·</span>
            <span>
              Role:{" "}
              <span className="font-medium capitalize text-[var(--foreground)]">
                {currentUserRole}
              </span>
            </span>
            {tenant.plan && (
              <>
                <span>·</span>
                <span>Plan: {tenant.plan}</span>
              </>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Switch workspace</Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholders.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.title} className="opacity-90">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="flex items-center justify-between gap-2">
                  {p.title}
                  <Badge className="text-[10px]">Coming soon</Badge>
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  {p.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
