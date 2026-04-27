import {
  Activity,
  Building2,
  CreditCard,
  Cpu,
  HardDrive,
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
 * a placeholder and exposes useful operational UI.
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
    status: "ready",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: UsersIcon,
    description: "Global user directory, system roles.",
    status: "ready",
  },
  {
    href: "/admin/wa-sessions",
    label: "WhatsApp Sessions",
    icon: Smartphone,
    description: "Connected numbers, session health.",
    status: "ready",
  },
  {
    href: "/admin/jobs",
    label: "Jobs / Queue",
    icon: ListChecks,
    description: "Send queue, failures, warm-up state.",
    status: "ready",
  },
  {
    href: "/admin/ai",
    label: "AI Providers",
    icon: Cpu,
    description: "Shared Dify / Ollama defaults, per-tenant overrides.",
    status: "ready",
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
    href: "/admin/storage",
    label: "Object Storage",
    icon: HardDrive,
    description: "Tenant prefixes, bucket usage, init status (SeaweedFS).",
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
    status: "ready",
  },
];

export function findNavItem(href: string): AdminNavItem | undefined {
  return ADMIN_NAV.find((n) => n.href === href);
}
