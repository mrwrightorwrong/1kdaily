import type { Metadata } from "next";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export const metadata: Metadata = {
  title: { default: "Overview", template: "%s · 1kDaily" },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <AppSidebar />
      <div className="lg:pl-[15.5rem]">
        <AppTopbar />
        <main
          id="main"
          className="mx-auto w-full max-w-[76rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16"
        >
          {children}
        </main>
      </div>
      <AppBottomNav />
    </div>
  );
}
