import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { appConfig } from "@/config/app";
import { nav } from "@/config/marketing";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-[var(--muted-foreground)]">
              {appConfig.description}
            </p>
          </div>

          <FooterColumn title="Product" items={nav.footer.product} />
          <FooterColumn title="Company" items={nav.footer.company} />
          <FooterColumn title="Legal" items={nav.footer.legal} />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {appConfig.name}. All rights reserved.
          </p>
          <p>
            Need help?{" "}
            <a
              href={`mailto:${appConfig.support.email}`}
              className="text-[var(--foreground)] hover:underline"
            >
              {appConfig.support.email}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
