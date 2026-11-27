export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Badge, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { getPermissions, requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { default: "Operations", template: "%s · 1kDaily Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await requireUser();
  const permissions = await getPermissions();
  const isStaff = permissions.length > 0;

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
            <span className="hidden text-[0.6875rem] text-subtle sm:block">{user.email}</span>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
            >
              Consumer app
              <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>
        </header>

        {isStaff ? <AdminMobileNav /> : null}

        <main id="main" className="mx-auto w-full max-w-[86rem] px-4 py-6 sm:px-6 lg:px-8">
          {isStaff ? (
            children
          ) : (
            <div className="mx-auto max-w-md py-20 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-canvas text-muted ring-1 ring-line">
                <Lock className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <h1 className="mt-4 text-[1.25rem] font-semibold text-ink-900">
                Staff access required
              </h1>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
                Your account is signed in but holds no staff role. Access is granted per permission
                through a role assignment, and every action is audited.
              </p>
              <Link
                href="/app"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-5")}
              >
                Return to your dashboard
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
