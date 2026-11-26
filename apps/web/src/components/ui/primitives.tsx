import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-[background-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white shadow-card hover:bg-brand-800",
        dark: "bg-ink-900 text-white shadow-card hover:bg-ink-800",
        secondary: "border border-line bg-surface text-body shadow-card hover:border-line-strong hover:bg-canvas",
        ghost: "text-body hover:bg-ink-900/5",
        outline: "border border-ink-900/15 text-ink-900 hover:bg-ink-900/5",
        onDark: "bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15",
        gold: "bg-gold-500 text-ink-900 shadow-card hover:brightness-105",
        danger: "bg-danger-600 text-white shadow-card hover:brightness-95",
        link: "rounded-md px-0 text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-[0.8125rem]",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[0.9375rem]",
        icon: "size-10",
        none: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ComponentPropsWithoutRef<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      className={cn("text-[0.9375rem] font-semibold tracking-tight text-ink-900", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("mt-1 text-[0.8125rem] leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("flex items-center gap-3 border-t border-line px-5 py-3.5", className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        brand: "bg-brand-50 text-brand-700",
        success: "bg-brand-50 text-brand-700",
        neutral: "bg-canvas text-muted ring-1 ring-inset ring-line",
        warning: "bg-warn-50 text-[#8a5a00]",
        danger: "bg-danger-50 text-danger-600",
        info: "bg-info-50 text-[#0369a1]",
        gold: "bg-gold-100 text-[#7a5605]",
        outline: "text-ink-900 ring-1 ring-inset ring-ink-900/15",
        onDark: "bg-white/10 text-white ring-1 ring-inset ring-white/15",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { readonly className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden rounded-md bg-[#eaeff7]", className)}>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/65 to-transparent" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export function Progress({
  value,
  label,
  tone = "brand",
  className,
  size = "md",
}: {
  readonly value: number;
  readonly label?: string;
  readonly tone?: "brand" | "ink" | "gold" | "onDark";
  readonly className?: string;
  readonly size?: "sm" | "md";
}) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const toneClass =
    tone === "ink"
      ? "bg-ink-900"
      : tone === "gold"
        ? "bg-gold-500"
        : tone === "onDark"
          ? "bg-brand-400"
          : "bg-brand-600";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label ?? "Progress"}
      className={cn(
        "w-full overflow-hidden rounded-pill",
        tone === "onDark" ? "bg-white/12" : "bg-[#e9eef6]",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-pill transition-[width] duration-500 ease-out", toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  compact = false,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly tone?: "neutral" | "brand";
  readonly compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        tone === "brand" ? "border-brand-200 bg-brand-50/40" : "border-line bg-canvas/60",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-white text-muted ring-1 ring-line",
        )}
        aria-hidden
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-[0.875rem] font-semibold text-ink-900">{title}</p>
      <p className="max-w-[42ch] text-[0.8125rem] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  tone = "light",
  className,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly tone?: "light" | "dark";
  readonly className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p
            className={cn(
              "mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
              tone === "dark" ? "text-brand-300" : "text-brand-700",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={cn(
            "text-balance text-[1.375rem] font-semibold tracking-[-0.02em] sm:text-2xl",
            tone === "dark" ? "text-white" : "text-ink-900",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-1.5 text-[0.875rem] leading-relaxed",
              tone === "dark" ? "text-white/65" : "text-muted",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Divider                                                                     */
/* -------------------------------------------------------------------------- */

export function Divider({ className }: { readonly className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
