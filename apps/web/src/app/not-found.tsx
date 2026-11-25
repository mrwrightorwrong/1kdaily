import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <Logo size="md" href={null} className="justify-center" />
        <p className="mt-8 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-700">
          Error 404
        </p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">
          This page does not exist
        </h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          The link may be out of date, or the section may not have shipped yet. Nothing financial was
          affected.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/app" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
            Open dashboard
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
