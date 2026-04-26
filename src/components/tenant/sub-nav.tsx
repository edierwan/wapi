import Link from "next/link";
import {
  BarChart3,
  Brain,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: (slug: string) => string;
  label: string;
  Icon: typeof LayoutDashboard;
  soon?: boolean;
};

const ITEMS: Item[] = [
  { href: (s) => `/t/${s}`, label: "Overview", Icon: LayoutDashboard },
  { href: (s) => `/t/${s}/whatsapp`, label: "WhatsApp", Icon: Smartphone },
  { href: (s) => `/t/${s}/contacts`, label: "Contacts", Icon: Users },
  { href: (s) => `/t/${s}/products`, label: "Products", Icon: Package },
  { href: (s) => `/t/${s}/services`, label: "Services", Icon: Wrench },
  { href: (s) => `/t/${s}/brain`, label: "Brain", Icon: Brain },
  { href: (s) => `/t/${s}/campaigns`, label: "Campaigns", Icon: MessagesSquare },
  { href: (s) => `/t/${s}/inbox`, label: "Inbox", Icon: Inbox, soon: true },
  { href: (s) => `/t/${s}/ai/draft`, label: "AI", Icon: Sparkles },
  { href: (s) => `/t/${s}/analytics`, label: "Analytics", Icon: BarChart3, soon: true },
  { href: (s) => `/t/${s}/settings/business`, label: "Settings", Icon: Settings },
];

export function TenantSubNav({
  slug,
  active,
}: {
  slug: string;
  active: string;
}) {
  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-[var(--border)]/60 pb-2">
      {ITEMS.map(({ href, label, Icon, soon }) => {
        const isActive = active === label;
        return (
          <Link
            key={label}
            href={href(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-[var(--accent)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-3.5" />
            {label}
            {soon && (
              <span className="ml-1 rounded bg-[var(--muted)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">
                soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
