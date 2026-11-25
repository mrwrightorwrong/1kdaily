"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Plans", href: "/#plans" },
  { label: "Eligibility", href: "/#eligibility" },
  { label: "Security", href: "/#security" },
  { label: "FAQ", href: "/#faq" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Logo size="md" />

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Sign in
          </Link>
          <Link href="/app" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
            Preview dashboard
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-900 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-line bg-surface px-5 pb-6 pt-3 md:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-line/70 py-3 text-[0.9375rem] font-medium text-body last:border-0"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
          >
            Preview dashboard
          </Link>
          <Link
            href="/sign-in"
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "w-full")}
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
