import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { cancelPlanAction, pausePlanAction, resumePlanAction } from "@/server/actions/savings";

export function PlanLifecycleActions({
  planId,
  status,
}: {
  readonly planId: string;
  readonly status: string;
}) {
  const canPause = status === "active";
  const canResume = status === "paused";
  const canCancel = status === "active" || status === "paused" || status === "pending_activation";

  if (!canPause && !canResume && !canCancel) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canPause ? (
          <form action={pausePlanAction}>
            <input type="hidden" name="plan_id" value={planId} />
            <Button type="submit" variant="secondary" size="sm">
              <Pause className="size-3.5" aria-hidden />
              Pause plan
            </Button>
          </form>
        ) : null}

        {canResume ? (
          <form action={resumePlanAction}>
            <input type="hidden" name="plan_id" value={planId} />
            <Button type="submit" variant="primary" size="sm">
              <Play className="size-3.5" aria-hidden />
              Resume plan
            </Button>
          </form>
        ) : null}
      </div>

      {canCancel ? (
        <details className="rounded-xl border border-line bg-canvas p-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.75rem] font-medium text-muted">
            <X className="size-3.5" aria-hidden />
            Cancel this plan
          </summary>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted">
            Cancelling stops all future contribution days and marks them skipped. Days already paid
            stay in your record. This cannot be undone.
          </p>
          <form action={cancelPlanAction} className="mt-2.5 flex flex-wrap items-center gap-2">
            <input type="hidden" name="plan_id" value={planId} />
            <input
              name="reason"
              placeholder="Reason (optional)"
              maxLength={160}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[0.75rem] text-ink-900"
            />
            <Button type="submit" variant="danger" size="sm">
              Confirm cancel
            </Button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
