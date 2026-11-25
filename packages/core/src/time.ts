/**
 * Business-calendar primitives.
 *
 * 1kDaily is a *daily* savings product, so "which day did this contribution
 * belong to?" is a financial fact, not a presentation detail. Every
 * contribution stores a `business_date` computed here at confirmation time and
 * never recomputed from `now()` afterwards.
 *
 * The business time zone is Africa/Lagos (UTC+1, no DST). Date arithmetic is
 * done in UTC on date-only strings so it stays exact regardless of the host
 * machine's time zone.
 */

export const BUSINESS_TIME_ZONE = "Africa/Lagos";

declare const businessDateBrand: unique symbol;
/** ISO calendar date (YYYY-MM-DD) in the business time zone. */
export type BusinessDate = string & { readonly [businessDateBrand]: true };

export type BusinessDateFormat = "compact" | "medium" | "long" | "monthYear" | "weekday";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** Calendar date of an instant, in the business time zone. */
export function businessDateOf(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): BusinessDate {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError("Cannot derive a business date from an invalid Date.");
  }
  const parts = zoneFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return `${year}-${month}-${day}` as BusinessDate;
}

export function isBusinessDate(value: string): value is BusinessDate {
  if (!DATE_PATTERN.test(value)) return false;
  const millis = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(millis)) return false;
  return new Date(millis).toISOString().slice(0, 10) === value;
}

export function asBusinessDate(value: string): BusinessDate {
  if (!isBusinessDate(value)) {
    throw new RangeError(`"${value}" is not a valid business date.`);
  }
  return value;
}

export function todayBusinessDate(now: Date = new Date()): BusinessDate {
  return businessDateOf(now);
}

/** Midnight UTC of the date — an arithmetic anchor only, never displayed. */
function anchoredMillis(date: BusinessDate): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: BusinessDate, days: number): BusinessDate {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError("Day offsets must be whole numbers.");
  }
  const shifted = new Date(anchoredMillis(date) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10) as BusinessDate;
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from: BusinessDate, to: BusinessDate): number {
  return Math.round((anchoredMillis(to) - anchoredMillis(from)) / 86_400_000);
}

/** Inclusive list of `count` consecutive business dates. */
export function eachDay(start: BusinessDate, count: number): BusinessDate[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Day counts must be non-negative whole numbers.");
  }
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

/** ISO weekday index: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: BusinessDate): number {
  return new Date(anchoredMillis(date)).getUTCDay();
}

export function startOfMonth(date: BusinessDate): BusinessDate {
  return `${date.slice(0, 8)}01` as BusinessDate;
}

export function daysInMonth(date: BusinessDate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function endOfMonth(date: BusinessDate): BusinessDate {
  return addDays(startOfMonth(date), daysInMonth(date) - 1);
}

const displayFormatters: Readonly<Record<BusinessDateFormat, Intl.DateTimeFormatOptions>> = {
  compact: { day: "numeric", month: "short" },
  medium: { weekday: "short", day: "numeric", month: "short" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  monthYear: { month: "long", year: "numeric" },
  weekday: { weekday: "short" },
};

/** Human-readable label for a business date. Formatting only — no zone math. */
export function formatBusinessDate(
  date: BusinessDate,
  format: BusinessDateFormat = "medium",
): string {
  const noonUtc = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    ...displayFormatters[format],
    timeZone: "UTC",
  }).format(noonUtc);
}
