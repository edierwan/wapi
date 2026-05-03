import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Inbox,
  MessagesSquare,
  Package,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantPageSectionLabel } from "@/components/tenant/tenant-nav-items";
import { TenantPage, TenantPageHeader } from "@/components/tenant/tenant-page";
import { ReadinessCard } from "@/components/tenant/readiness-card";
import { requireTenantContext } from "@/server/tenant-guard";
import { isOnboardingComplete } from "@/server/business-profile";

export const dynamic = "force-dynamic";

export default async function TenantWorkspacePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const ctx = await requireTenantContext(tenantSlug);

  if (!(await isOnboardingComplete(ctx.tenant.id))) {
    redirect(`/t/${ctx.tenant.slug}/onboarding`);
  }

  const { tenant, currentUserRole } = ctx;

  const tiles = [
    {
      title: "WhatsApp Accounts",
      description: "Connect one or more numbers. Each maps to a Baileys session.",
      href: `/t/${tenant.slug}/whatsapp`,
      Icon: Smartphone,
    },
    {
      title: "Products",
      description: "Master data your AI uses when quoting prices.",
      href: `/t/${tenant.slug}/products`,
      Icon: Package,
    },
    {
      title: "Services",
      description: "Appointments, packages, subscriptions.",
      href: `/t/${tenant.slug}/services`,
      Icon: Wrench,
    },
    {
      title: "Contacts",
      description: "Import, tag, and segment your audience.",
      href: `/t/${tenant.slug}/contacts`,
      Icon: Users,
    },
    {
      title: "Campaigns",
      description: "Draft with AI, approve, schedule, send safely.",
      href: `/t/${tenant.slug}/campaigns`,
      Icon: MessagesSquare,
      soon: true,
    },
    {
      title: "Inbox",
      description: "Shared inbox, AI-suggested replies, assignments.",
      href: `/t/${tenant.slug}/inbox`,
      Icon: Inbox,
      soon: true,
    },
    {
      title: "AI Assistant",
      description: "Business Brain-powered drafts. Human approves before send.",
      href: `/t/${tenant.slug}/ai`,
      Icon: Sparkles,
      soon: true,
    },
    {
      title: "Analytics",
      description: "Delivery, reply, hot leads, opt-outs.",
      href: `/t/${tenant.slug}/analytics`,
      Icon: BarChart3,
      soon: true,
    },
  ];

  return (
    <TenantPage>
      <TenantPageHeader
        sectionLabel={getTenantPageSectionLabel("Overview")}
        title={tenant.name}
        description="Overview of your workspace readiness, channels, and next steps."
        actions={
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/dashboard">Switch workspace</Link>
          </Button>
        }
        meta={
          <>
            <Badge className="uppercase">{tenant.status}</Badge>
            <span>·</span>
            <span>
              Role:{" "}
              <span className="font-medium capitalize text-[var(--foreground)]">
                {currentUserRole}
              </span>
            </span>
            {tenant.plan ? (
              <>
                <span>·</span>
                <span>Plan: {tenant.plan}</span>
              </>
            ) : null}
          </>
        }
      />

      <div>
        <ReadinessCard
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          canWrite={["owner", "admin", "agent"].includes(currentUserRole ?? "")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.Icon;
          const card = (
            <Card className={t.soon ? "h-full opacity-90" : "h-full transition hover:border-[var(--primary)]/40"}>
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="flex items-center justify-between gap-2">
                  {t.title}
                  {t.soon && <Badge className="text-[10px]">Coming soon</Badge>}
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  {t.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
          return t.soon ? (
            <div key={t.title}>{card}</div>
          ) : (
            <Link key={t.title} href={t.href} className="block">
              {card}
            </Link>
          );
        })}
      </div>
    </TenantPage>
  );
}
