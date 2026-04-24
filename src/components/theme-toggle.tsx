"use client";

import { useEffect, useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/app/theme-actions";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [, start] = useTransition();

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    start(() => {
      void setThemeAction(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={
        "inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] " +
        (className ?? "")
      }
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
