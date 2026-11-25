import { formatKobo, formatKoboCompact, type Kobo } from "@1kdaily/core";
import { cn } from "@/lib/cn";

/**
 * The single component that renders money. Tabular numerals are mandatory so
 * columns align and figures do not jitter when values update.
 */
export function Money({
  value,
  compact = false,
  decimals = 2,
  className,
  dimDecimals = false,
}: {
  readonly value: Kobo;
  readonly compact?: boolean;
  readonly decimals?: 0 | 2;
  readonly className?: string;
  /** Renders kobo in a smaller, lighter style. Used for hero figures. */
  readonly dimDecimals?: boolean;
}) {
  if (compact) {
    return (
      <span data-slot="amount" className={cn("tabular-nums", className)}>
        {formatKoboCompact(value)}
      </span>
    );
  }

  if (dimDecimals && decimals === 2) {
    const formatted = formatKobo(value, { decimals: 2 });
    const separator = formatted.lastIndexOf(".");
    const whole = separator === -1 ? formatted : formatted.slice(0, separator);
    const fraction = separator === -1 ? "" : formatted.slice(separator);
    return (
      <span data-slot="amount" className={cn("tabular-nums", className)}>
        {whole}
        <span className="text-[0.62em] font-medium opacity-70">{fraction}</span>
      </span>
    );
  }

  return (
    <span data-slot="amount" className={cn("tabular-nums", className)}>
      {formatKobo(value, { decimals })}
    </span>
  );
}
