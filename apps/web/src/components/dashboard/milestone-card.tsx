import { Sparkles } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function MilestoneCard({
  label,
  targetDays,
  progressDays,
}: {
  readonly label: string;
  readonly targetDays: number;
  readonly progressDays: number;
}) {
  const percent = targetDays === 0 ? 0 : Math.round((progressDays / targetDays) * 100);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Next milestone</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Consistency, recognised.</p>
        </div>
        <Badge variant="gold">
          <Sparkles className="size-2.5" aria-hidden />
          {progressDays} of {targetDays}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="rounded-xl bg-gold-100/60 p-4">
          <p className="text-[0.9375rem] font-semibold text-ink-900">{label}</p>
          <p className="mt-1 text-[0.75rem] text-muted">
            {targetDays} consecutive contribution days
          </p>

          <div className="mt-4 flex gap-1.5" aria-hidden>
            {Array.from({ length: targetDays }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < progressDays ? "bg-gold-500" : "bg-white",
                )}
              />
            ))}
          </div>

          <div className="mt-3">
            <Progress value={percent} label={`${label} progress`} tone="gold" size="sm" />
            <p className="mt-2 text-[0.6875rem] text-muted">
              <span className="font-semibold text-ink-900">{percent}%</span> of the way there
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
