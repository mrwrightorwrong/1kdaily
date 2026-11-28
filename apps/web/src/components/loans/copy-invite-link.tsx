"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The invitation link is the delivery mechanism until email is wired up. The
 * token itself is only readable by the borrower (RLS), so this reflects a real
 * capability rather than a placeholder.
 */
export function CopyInviteLink({
  path,
  className,
}: {
  readonly path: string;
  readonly className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("failed");
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[0.625rem] text-muted">
        {path}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[0.6875rem] font-medium text-ink-900 transition-colors hover:border-brand-300 hover:text-brand-800"
      >
        {state === "copied" ? (
          <Check className="size-3.5 text-brand-700" strokeWidth={2.2} aria-hidden />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.9} aria-hidden />
        )}
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy link"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Invitation link copied" : state === "failed" ? "Could not copy the link" : ""}
      </span>
    </div>
  );
}
