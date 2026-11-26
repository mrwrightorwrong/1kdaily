import Link from "next/link";
import { Bell, CircleHelp } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppTopbar({ initials }: { readonly initials: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-1 lg:hidden">
        <MobileNav />
        <Logo size="sm" href="/app" />
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <span className="text-[0.75rem] font-medium text-muted">
          Save daily. Build capacity.
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/app/support"
          aria-label="Help and support"
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink-900/5 hover:text-ink-900"
        >
          <CircleHelp className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />
        </Link>
        <Link
          href="/app/notifications"
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-ink-900/5 hover:text-ink-900"
        >
          <Bell className="size-[1.15rem]" strokeWidth={1.8} aria-hidden />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-line ring-2 ring-canvas" />
        </Link>
        <Link
          href="/app/profile"
          aria-label="Account"
          className="ml-1 grid size-9 place-items-center rounded-full border border-line bg-ink-900 text-white"
        >
          <span className="text-[0.625rem] font-semibold tracking-wide">{initials}</span>
        </Link>
      </div>
    </header>
  );
}
