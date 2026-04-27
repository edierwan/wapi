import {
  BarChart3,
  Brain,
  Database,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type TenantNavItem = {
  /** Stable key, also used as label match for backwards compat. */
  key: string;
  label: string;
  /** Path suffix appended to /t/{slug}. Empty string is the workspace root. */
  path: string;
  Icon: LucideIcon;
  soon?: boolean;
  /**
   * Additional URL path segments (suffix after /t/{slug}) that should also
   * activate this item. Used to highlight parent for nested detail routes.
   */
  matchPrefixes?: string[];
};

export type TenantNavSection = {
  label: string;
  items: TenantNavItem[];
};

export const TENANT_NAV_SECTIONS: TenantNavSection[] = [
  {
    label: "Workspace",
    items: [
      { key: "Overview", label: "Overview", path: "", Icon: LayoutDashboard },
    ],
  },
  {
    label: "Communication",
    items: [
      { key: "WhatsApp", label: "WhatsApp", path: "/whatsapp", Icon: Smartphone },
      {
        key: "Inbox",
        label: "Inbox",
        path: "/inbox",
        Icon: Inbox,
        matchPrefixes: ["/inbox/"],
      },
      {
        key: "Contacts",
        label: "Contacts",
        path: "/contacts",
        Icon: Users,
        matchPrefixes: ["/contacts/"],
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      { key: "Products", label: "Products", path: "/products", Icon: Package },
      { key: "Services", label: "Services", path: "/services", Icon: Wrench },
    ],
  },
  {
    label: "AI & Growth",
    items: [
      { key: "Brain", label: "Brain", path: "/brain", Icon: Brain },
      {
        key: "Campaigns",
        label: "Campaigns",
        path: "/campaigns",
        Icon: MessagesSquare,
        matchPrefixes: ["/campaigns/", "/followups", "/followups/"],
      },
      {
        key: "AI",
        label: "AI",
        path: "/ai/draft",
        Icon: Sparkles,
        matchPrefixes: ["/ai/", "/ai"],
      },
      {
        key: "Analytics",
        label: "Analytics",
        path: "/analytics",
        Icon: BarChart3,
        soon: true,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        key: "Settings",
        label: "Settings",
        path: "/settings/business",
        Icon: Settings,
        matchPrefixes: ["/settings", "/settings/"],
      },
      {
        key: "Storage",
        label: "Files & Media",
        path: "/settings/storage",
        Icon: Database,
      },
    ],
  },
];

/**
 * Determine if a given pathname (e.g. /t/acme/products/123) is currently
 * activating the supplied nav item.
 */
export function isTenantNavItemActive(
  item: TenantNavItem,
  slug: string,
  pathname: string,
): boolean {
  const root = `/t/${slug}`;
  const itemFull = `${root}${item.path}`;

  // Exact match always wins.
  if (pathname === itemFull) return true;

  // Storage is a child of /settings — keep its activation strictly exact so
  // it does not steal the active state from the generic Settings item.
  if (item.key === "Storage") return false;

  // For Settings, match all /settings/* except /settings/storage which is
  // owned by the Storage item above.
  if (item.key === "Settings") {
    if (pathname === `${root}/settings/storage`) return false;
    return pathname === `${root}/settings` || pathname.startsWith(`${root}/settings/`);
  }

  // Prefix matches for nested detail routes (e.g. /products/[id]).
  if (item.path && pathname.startsWith(`${itemFull}/`)) return true;

  if (item.matchPrefixes) {
    for (const prefix of item.matchPrefixes) {
      if (pathname === `${root}${prefix}`) return true;
      if (pathname.startsWith(`${root}${prefix}`)) return true;
    }
  }

  return false;
}

export function getTenantPageSectionLabel(
  itemKey: string,
  titleOverride?: string,
): string {
  for (const section of TENANT_NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.key === itemKey);
    if (item) {
      return `${section.label} | ${titleOverride ?? item.label}`;
    }
  }

  return titleOverride ?? itemKey;
}
