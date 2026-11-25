"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Administration"
      className="no-scrollbar overflow-x-auto border-b border-line bg-surface px-3 sm:px-5 lg:hidden"
    >
      <ul className="flex w-max gap-1.5 py-2.5">
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
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.75rem] font-medium",
                  active
                    ? "bg-ink-900 text-white"
                    : "text-muted ring-1 ring-inset ring-line hover:text-ink-900",
                )}
              >
                <item.icon className="size-3.5" strokeWidth={1.9} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
