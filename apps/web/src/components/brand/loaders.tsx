import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/primitives";
import { LogoMark } from "./logo";

export function DailyInlineLoader({
  label = "Loading",
  className,
}: {
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-brand-600" />
      </span>
      <span className="text-[0.8125rem] text-muted">{label}</span>
    </span>
  );
}

/** Full-surface loader for boot / authentication resolution only. */
export function DailyLoadingScreen({ label = "Securing your session" }: { readonly label?: string }) {
  return (
    <div className="hero-surface grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <LogoMark className="size-14 rounded-2xl animate-breathe" />
        <p className="text-[0.8125rem] font-medium tracking-wide text-white/70">{label}</p>
        <span className="h-1 w-32 overflow-hidden rounded-pill bg-white/10">
          <span className="block h-full w-1/2 animate-shimmer rounded-pill bg-brand-400" />
        </span>
      </div>
    </div>
  );
}

/** Section-level skeleton: use inside a page while a panel's data resolves. */
export function DailySectionLoader({
  title,
  rows = 3,
  className,
}: {
  readonly title?: string;
  readonly rows?: number;
  readonly className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-card border border-line bg-surface p-5 shadow-card", className)}
    >
      <span className="sr-only">{title ? `${title} is loading` : "Section is loading"}</span>
      {title ? <p className="mb-4 text-[0.9375rem] font-semibold text-ink-900">{title}</p> : null}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
