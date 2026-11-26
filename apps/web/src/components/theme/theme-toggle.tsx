"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "kd-theme";

function apply(theme: Theme): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { readonly className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
    apply(stored);
  }, []);

  const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? "Dark theme" : theme === "light" ? "Light theme" : "System theme";

  return (
    <button
      type="button"
      aria-label={`${label}. Switch to ${next[theme]} theme.`}
      title={`${label} — click for ${next[theme]}`}
      onClick={() => {
        const value = next[theme];
        setTheme(value);
        localStorage.setItem(STORAGE_KEY, value);
        apply(value);
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink-900/5 hover:text-ink-900",
        !mounted && "opacity-0",
        className,
      )}
    >
      <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden />
    </button>
  );
}
