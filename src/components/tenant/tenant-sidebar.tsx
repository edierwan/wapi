"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  filterTenantNavSections,
  isTenantNavItemActive,
} from "./tenant-nav-items";

export function TenantSidebar({
  slug,
  displayName,
  enabledModules,
}: {
  slug: string;
  displayName?: string;
  enabledModules: string[];
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const sections = filterTenantNavSections(enabledModules);

  return (
    <>
      {/* Mobile / tablet trigger */}
      <button
        type="button"
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)]/90 text-[var(--foreground)] shadow-md backdrop-blur lg:hidden"
        aria-label={open ? "Close workspace menu" : "Open workspace menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile / tablet drawer scrim */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "z-30 w-[17rem] max-w-[85vw] shrink-0 border-r border-[var(--border)]/60 bg-[var(--background)]",
          // Desktop: sticky alongside main content.
          "lg:sticky lg:top-0 lg:block lg:h-[100dvh] lg:w-60 lg:max-w-none",
          // Mobile: slide-in drawer.
          "fixed inset-y-0 left-0 transition-transform duration-200 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Tenant workspace navigation"
      >
        <div className="flex h-full flex-col overflow-y-auto px-3 py-4">
          <div className="mb-3 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Workspace
            </p>
            <p className="truncate text-sm font-medium text-[var(--foreground)]">
              {displayName?.trim() || slug}
            </p>
          </div>

          <nav className="flex-1 space-y-4">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const href = `/t/${slug}${item.path}`;
                    const active = isTenantNavItemActive(item, slug, pathname);
                    const Icon = item.Icon;
                    return (
                      <li key={item.key}>
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-[var(--accent)] font-medium text-[var(--foreground)]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/60 hover:text-[var(--foreground)]",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.soon && (
                            <span className="ml-auto rounded bg-[var(--muted)] px-1 py-px text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">
                              soon
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
