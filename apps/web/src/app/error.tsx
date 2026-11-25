"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // Phase 1: surface client errors in the console. Phase 13 replaces this with
    // structured reporting that never includes financial payloads.
    console.error("[1kDaily] render error", error.digest ?? error.message);
  }, [error]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <Logo size="md" href={null} className="justify-center" />
        <p className="mt-8 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-danger-600">
          Something went wrong
        </p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">
          This screen could not load
        </h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-muted">
          Try again. If the problem persists, your balances and records are unaffected — they live in
          the ledger, not in this page.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[0.625rem] uppercase tracking-[0.12em] text-subtle">
            Reference {error.digest}
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="md" onClick={reset}>
            Try again
          </Button>
          <Link href="/app" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
