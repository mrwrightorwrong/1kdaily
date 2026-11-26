"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/server/actions/auth";
import { SIDEBAR_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  displayName,
  email,
  initials,
  isAdmin,
}: {
  readonly displayName: string;
  readonly email: string;
  readonly initials: string;
  readonly isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[15.5rem] lg:flex-col lg:border-r lg:border-line lg:bg-surface">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Logo size="md" href="/app" />
      </div>

      <nav aria-label="Application" className="flex-1 overflow-y-auto px-3 py-5 no-scrollbar">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.title} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-subtle">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                        active
                          ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100"
                          : "text-muted hover:bg-canvas hover:text-ink-900",
                      )}
                    >
                      <item.icon
                        className={cn("size-4 shrink-0", active ? "text-brand-700" : "text-subtle")}
                        strokeWidth={active ? 2.1 : 1.8}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                      {item.phase > 2 ? (
                        <span
                          className="ml-auto rounded-full bg-canvas px-1.5 py-0.5 text-[0.5rem] font-semibold text-subtle ring-1 ring-line"
                          title={`Enabled in Phase ${item.phase}`}
                        >
                          P{item.phase}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isAdmin ? (
          <div className="mt-2 border-t border-line pt-4">
            <Link
              href="/admin"
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium text-ink-900 hover:bg-canvas"
            >
              <ShieldCheck className="size-4 text-accent-600" strokeWidth={1.9} aria-hidden />
              Operations console
            </Link>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-xl p-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-[0.625rem] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-semibold text-ink-900">{displayName}</p>
            <p className="truncate text-[0.625rem] text-subtle">{email}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid size-7 place-items-center rounded-lg text-subtle transition-colors hover:bg-canvas hover:text-ink-900"
            >
              <LogOut className="size-3.5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
