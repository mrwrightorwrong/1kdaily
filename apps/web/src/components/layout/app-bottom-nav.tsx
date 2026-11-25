"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PiggyBank, HandCoins, User } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { label: "Home", href: "/app", icon: LayoutDashboard },
  { label: "Savings", href: "/app/savings", icon: PiggyBank },
  { label: "Loans", href: "/app/loans", icon: HandCoins },
  { label: "Profile", href: "/app/profile", icon: User },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-5 items-end px-2 pb-1.5 pt-2">
        {ITEMS.slice(0, 2).map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <li className="flex justify-center">
          <Link
            href="/app/plans"
            aria-label="Start a savings plan"
            className="-mt-5 grid size-13 place-items-center rounded-full bg-brand-600 text-white shadow-[0_10px_24px_-8px_rgba(22,163,74,0.65)] ring-4 ring-canvas transition-transform active:scale-95"
          >
            <span className="text-xl font-medium leading-none">+</span>
          </Link>
        </li>

        {ITEMS.slice(2).map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </ul>
    </nav>
  );
}

function BottomLink({
  item,
  active,
}: {
  readonly item: (typeof ITEMS)[number];
  readonly active: boolean;
}) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.5625rem] font-medium",
          active ? "text-brand-700" : "text-subtle",
        )}
      >
        <item.icon className="size-5" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}
