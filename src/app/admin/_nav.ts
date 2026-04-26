import {
  Activity,
  Building2,
  CreditCard,
  Cpu,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  ShieldAlert,
  Smartphone,
  Users as UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  status: "ready" | "placeholder";
};

/**
 * Single source of truth for admin navigation. Imported by the layout
 * sidebar and the /admin overview tiles so the two stay in sync.
 *
 * Mark `status: 'ready'` only when the underlying module ships beyond
 * a placeholder. Currently every module is `placeholder` per the
 * Phase 5–7 acceptance scope; full modules ship progressively in
 * Phase 8 onwards.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    description: "KPIs, jump-off, recent activity.",
    status: "ready",
  },
  {
    href: "/admin/tenants",
    label: "Tenants",
    icon: Building2,
    description: "All workspaces, status, plan, owners.",
    status: "placeholder",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: UsersIcon,
    description: "Global user directory, system roles.",
    status: "placeholder",
  },
  {
    href: "/admin/wa-sessions",
    label: "WhatsApp Sessions",
    icon: Smartphone,
    description: "Connected numbers, session health.",
    status: "placeholder",
  },
  {
    href: "/admin/jobs",
    label: "Jobs / Queue",
    icon: ListChecks,
    description: "Send queue, failures, warm-up state.",
    status: "placeholder",
  },
  {
    href: "/admin/ai",
    label: "AI Providers",
    icon: Cpu,
    description: "Shared Dify / Ollama defaults, per-tenant overrides.",
    status: "placeholder",
  },
  {
    href: "/admin/billing",
    label: "Billing",
    icon: CreditCard,
    description: "Plans, subscriptions, payments.",
    status: "placeholder",
  },
  {
    href: "/admin/audit",
    label: "Audit Logs",
    icon: ScrollText,
    description: "Every admin action, every tenant change.",
    status: "placeholder",
  },
  {
    href: "/admin/system-health",
    label: "System Health",
    icon: Activity,
    description: "DB, gateway, worker, realtime.",
    status: "ready",
  },
  {
    href: "/admin/abuse",
    label: "Abuse Monitor",
    icon: ShieldAlert,
    description: "Tenant-level risk signals (Phase 9).",
    status: "placeholder",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    description: "Platform settings, feature flags, defaults.",
    status: "placeholder",
  },
];

export function findNavItem(href: string): AdminNavItem | undefined {
  return ADMIN_NAV.find((n) => n.href === href);
}
