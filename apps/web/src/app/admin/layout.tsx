import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Badge } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s Â· 1kDaily Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <AdminSidebar />
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="text-[0.8125rem] font-semibold text-ink-900">Operations console</span>
            <Badge variant="danger">Restricted</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="warning">Phase 1 shell</Badge>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
            >
              Consumer app
              <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>
        </header>
        <AdminMobileNav />
        <main id="main" className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
