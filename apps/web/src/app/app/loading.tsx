import { AppBootSplash } from "@/components/brand/app-boot-splash";
import { Skeleton } from "@/components/ui/primitives";

export default function AppLoading() {
  return (
    <AppBootSplash>
      <div className="animate-rise" aria-busy>
        <span className="sr-only">Loading your overview</span>

        <div className="space-y-2 pb-5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="space-y-4">
          <div className="hero-surface rounded-hero p-6 sm:p-7">
            <div className="grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <Skeleton className="h-3 w-32 bg-white/10" />
                <Skeleton className="h-10 w-56 bg-white/10" />
                <Skeleton className="h-3 w-full max-w-sm bg-white/10" />
                <div className="flex gap-3">
                  <Skeleton className="h-16 w-32 bg-white/10" />
                  <Skeleton className="h-16 w-32 bg-white/10" />
                </div>
              </div>
              <Skeleton className="h-44 w-full bg-white/10" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-28 w-full" />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
            <div className="space-y-4 lg:col-span-5">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        </div>
      </div>
    </AppBootSplash>
  );
}
