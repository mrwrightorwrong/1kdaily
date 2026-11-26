"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/brand/logo";
import { SIDEBAR_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/cn";

/**
 * Mobile navigation drawer. The bottom bar only carries primary destinations,
 * so this exposes the full map without forcing a desktop sidebar onto phones.
 *
 * The overlay is portalled to <body>: the sticky header uses backdrop-filter,
 * which would otherwise become the containing block for a fixed child and clip
 * the drawer to the height of the header. AnimatePresence lives *inside* the
 * portal so exit animations still run.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="app-mobile-nav"
        aria-label="Open navigation"
        className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink-900/5 hover:text-ink-900 lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.9} aria-hidden />
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  key="mobile-nav"
                  className="fixed inset-0 z-[90] lg:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                >
                  <div
                    className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                    aria-hidden
                  />

                  <motion.nav
                    id="app-mobile-nav"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Application"
                    className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col bg-surface shadow-2xl"
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex h-16 items-center justify-between border-b border-line px-4">
                      <Logo size="sm" href="/app" />
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close navigation"
                        className="grid size-9 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink-900"
                      >
                        <X className="size-5" strokeWidth={1.9} aria-hidden />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
                      {SIDEBAR_GROUPS.map((group) => (
                        <div key={group.title} className="mb-5 last:mb-0">
                          <p className="px-3 pb-2 text-[0.5625rem] font-semibold uppercase tracking-[0.16em] text-subtle">
                            {group.title}
                          </p>
                          <ul className="space-y-0.5">
                            {group.items.map((item) => {
                              const active =
                                item.href === "/app"
                                  ? pathname === "/app"
                                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                              return (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.8125rem] font-medium",
                                      active
                                        ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100"
                                        : "text-muted hover:bg-canvas hover:text-ink-900",
                                    )}
                                  >
                                    <item.icon
                                      className={cn(
                                        "size-4 shrink-0",
                                        active ? "text-brand-700" : "text-subtle",
                                      )}
                                      strokeWidth={1.9}
                                      aria-hidden
                                    />
                                    {item.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-line p-3">
                      <p className="px-2 text-[0.625rem] leading-relaxed text-subtle">
                        Phase 2 · savings ledger arrives in Phase 4.
                      </p>
                    </div>
                  </motion.nav>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
