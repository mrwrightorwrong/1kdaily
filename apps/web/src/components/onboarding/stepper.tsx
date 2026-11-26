import { cn } from "@/lib/cn";

const STEPS = [
  { key: "profile", label: "Details" },
  { key: "identity", label: "Identity" },
  { key: "financial", label: "Affordability" },
] as const;

export function OnboardingStepper({ current }: { readonly current: "profile" | "identity" | "financial" }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold",
                  done && "bg-brand-600 text-white",
                  active && "bg-ink-900 text-white ring-4 ring-ink-900/10",
                  !done && !active && "bg-white text-subtle ring-1 ring-line",
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[0.75rem] font-medium sm:block",
                  active ? "text-ink-900" : "text-subtle",
                )}
              >
                {step.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className={cn("h-px flex-1", done ? "bg-brand-500" : "bg-line")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-ink-900">{title}</h1>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{description}</p>
    </div>
  );
}
