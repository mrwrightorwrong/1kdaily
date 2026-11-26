"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
const STORAGE_KEY = "kd-theme";

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({ className }: { readonly className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "light";
    setTheme(stored);
    setMounted(true);
    apply(stored);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={`${theme === "dark" ? "Dark" : "Light"} mode. Switch to ${next} mode.`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        setTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
        apply(next);
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
