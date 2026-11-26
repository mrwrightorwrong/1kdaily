"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ADMIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:bg-ink-900">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo tone="dark" size="sm" href="/admin" />
      </div>

      <nav aria-label="Administration" className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        <p className="px-3 pb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-white/35">
          Operations
        </p>
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                    active
                      ? "bg-white/10 text-white ring-1 ring-inset ring-white/10"
                      : "text-white/55 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
          <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-white/40">
            Phase 2
          </p>
          <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-white/50">
            Identity verification is live. Savings and finance modules arrive in later phases.
          </p>
          <Link
            href="/app"
            className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-300 hover:underline"
          >
            Consumer app
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}
