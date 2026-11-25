import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * 1kDaily mark: a navy tile with ascending savings bars and a gold coin accent.
 * Deliberately geometric so it stays legible at 16px (favicon) — no fine detail,
 * no text baked into the mark.
 */
export function LogoMark({
  className,
  title = "1kDaily",
}: {
  readonly className?: string;
  readonly title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("size-8 shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="kd-tile" x1="4" y1="0" x2="28" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14294F" />
          <stop offset="1" stopColor="#0B1739" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#kd-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="#ffffff" strokeOpacity="0.08" />
      <rect x="8" y="18" width="3.5" height="6" rx="1.75" fill="#10B981" fillOpacity="0.55" />
      <rect x="14.25" y="14" width="3.5" height="10" rx="1.75" fill="#10B981" fillOpacity="0.82" />
      <rect x="20.5" y="9.5" width="3.5" height="14.5" rx="1.75" fill="#34D399" />
      <circle cx="22.25" cy="6.6" r="2" fill="#F5B942" />
    </svg>
  );
}

const wordmarkSize = {
  sm: "text-[0.9375rem]",
  md: "text-[1.0625rem]",
  lg: "text-xl",
} as const;

const markSize = {
  sm: "size-7",
  md: "size-8",
  lg: "size-10",
} as const;

export function Logo({
  tone = "light",
  size = "md",
  href = "/",
  withWordmark = true,
  className,
}: {
  readonly tone?: "light" | "dark";
  readonly size?: keyof typeof wordmarkSize;
  readonly href?: string | null;
  readonly withWordmark?: boolean;
  readonly className?: string;
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markSize[size]} />
      {withWordmark ? (
        <span
          className={cn(
            "font-semibold tracking-[-0.02em]",
            wordmarkSize[size],
            tone === "dark" ? "text-white" : "text-ink-900",
          )}
        >
          1k
          <span className={tone === "dark" ? "text-brand-300" : "text-brand-600"}>Daily</span>
        </span>
      ) : null}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-lg" aria-label="1kDaily home">
      {content}
    </Link>
  );
}
