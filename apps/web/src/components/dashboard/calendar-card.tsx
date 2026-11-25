import { formatBusinessDate } from "@1kdaily/core";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { buildMonthCalendar } from "@/lib/calendar";
import { cn } from "@/lib/cn";

const LEGEND = [
  { label: "Paid", className: "bg-brand-500" },
  { label: "Multiple", className: "bg-ink-900" },
  { label: "Grace", className: "bg-gold-500" },
  { label: "Missed", className: "bg-danger-600/30 ring-1 ring-danger-600/50" },
  { label: "Upcoming", className: "bg-line" },
] as const;

export function CalendarCard() {
  const calendar = buildMonthCalendar();
  const daysInMonth = calendar.cells.filter((cell) => cell.inMonth).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Savings calendar</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">{calendar.monthLabel} · WAT</p>
        </div>
        <Badge variant="neutral">0 of {daysInMonth} days</Badge>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {calendar.weekdayLabels.map((day) => (
            <span
              key={day}
              aria-hidden
              className="pb-1 text-center text-[0.5625rem] font-semibold uppercase tracking-wide text-subtle"
            >
              {day.slice(0, 1)}
            </span>
          ))}

          {calendar.cells.map((cell) => {
            const isToday = cell.date === calendar.today;
            if (!cell.inMonth) {
              return (
                <div
                  key={cell.date}
                  aria-hidden
                  className="grid aspect-square place-items-center rounded-md text-[0.625rem] text-subtle opacity-30"
                >
                  {cell.dayOfMonth}
                </div>
              );
            }
            return (
              <div
                key={cell.date}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${formatBusinessDate(cell.date, "medium")}: no contribution recorded`}
                title={`${formatBusinessDate(cell.date, "medium")} — no contribution recorded`}
                className={cn(
                  "grid aspect-square place-items-center rounded-md border text-[0.625rem]",
                  isToday
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                    : "border-transparent text-muted",
                )}
              >
                {cell.dayOfMonth}
              </div>
            );
          })}
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", item.className)} aria-hidden />
              <span className="text-[0.625rem] text-muted">{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
