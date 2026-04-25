"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "@/app/admin/_nav";

/**
 * Admin sidebar — desktop and mobile.
 *
 * Active item is highlighted by exact match for `/admin` (overview) and
 * by `startsWith` for nested routes so e.g. `/admin/tenants/123` still
 * highlights the "Tenants" parent.
 */
export function AdminSidebar() {
  const pathname = usePathname() ?? "/admin";

  return (
    <nav
      aria-label="Admin navigation"
      className="flex flex-col gap-0.5 p-3 text-sm"
    >
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 transition",
              active
                ? "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.status === "placeholder" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  active
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)] group-hover:bg-[var(--background)]",
                )}
              >
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
