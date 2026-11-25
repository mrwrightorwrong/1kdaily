import { Plus, Target } from "lucide-react";
import Link from "next/link";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  buttonVariants,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function PlanProgressCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Plan progress</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Your current daily plan and its target.</p>
        </div>
        <Badge variant="neutral">No plan</Badge>
      </CardHeader>
      <CardContent className="flex-1">
        <EmptyState
          icon={Target}
          title="No active savings plan"
          description="Choose a daily amount and duration. You will see the full total, end date, grace rules and withdrawal terms before you confirm."
          action={
            <Link
              href="/app/plans"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
            >
              Choose a plan
              <Plus className="size-3.5" aria-hidden />
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}
