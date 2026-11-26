import { Sparkles } from "lucide-react";
import type { MilestoneProgress } from "@1kdaily/core";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function MilestoneCard({ milestones }: { readonly milestones: MilestoneProgress }) {
  const { achieved, next, paidDays, daysToNext, percent } = milestones;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Next milestone</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Consistency, recognised.</p>
        </div>
        <Badge variant="gold">
          <Sparkles className="size-2.5" aria-hidden />
          {next ? `${daysToNext} to go` : "All achieved"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="rounded-xl bg-gold-100/60 p-4">
          <p className="text-[0.9375rem] font-semibold text-ink-900">
            {next ? `${next}-day milestone` : "365-day milestone"}
          </p>
          <p className="mt-1 text-[0.75rem] text-muted">
            {next
              ? `${daysToNext} more paid ${daysToNext === 1 ? "day" : "days"} of ${next}`
              : `${paidDays} paid days in total`}
          </p>

          <div className="mt-3 flex flex-wrap gap-1" aria-hidden>
            {[...achieved, ...(next ? [next] : [])]
              .filter((value, index, list) => list.indexOf(value) === index)
              .slice(-7)
              .map((milestone) => (
                <span
                  key={milestone}
                  className={cn(
                    "grid h-6 min-w-6 place-items-center rounded-full px-1 text-[0.5rem] font-semibold",
                    achieved.includes(milestone)
                      ? "bg-ink-900 text-white"
                      : "bg-white/70 text-subtle ring-1 ring-line",
                  )}
                >
                  {milestone}
                </span>
              ))}
          </div>

          <div className="mt-3">
            <Progress value={percent} label="Milestone progress" tone="gold" size="sm" />
            <p className="mt-2 text-[0.6875rem] text-muted">
              <span className="font-semibold text-ink-900">{percent}%</span> of the way to the next
              milestone
            </p>
          </div>
        </div>

        <p className="mt-auto pt-4 text-[0.6875rem] leading-relaxed text-subtle">
          Milestones reward discipline. They do not unlock credit on their own, and they never count
          unconfirmed payments.
        </p>
      </CardContent>
    </Card>
  );
}
