import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import type { Kobo } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonVariants,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function EligibilityCard({ eligibleSavingsKobo }: { readonly eligibleSavingsKobo: Kobo }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Loan eligibility</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Potential ceilings, not approvals.</p>
        </div>
        <Badge variant="warning">Not assessed</Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <dl className="divide-y divide-line">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[0.75rem] text-muted">Eligible savings</dt>
            <dd className="text-[0.8125rem] font-semibold text-ink-900">
              <Money value={eligibleSavingsKobo} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[0.75rem] text-muted">
              Potential 2<span className="align-super text-[0.5625rem]">×</span> ceiling
            </dt>
            <dd className="text-[0.8125rem] font-semibold text-subtle">—</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-[0.75rem] text-muted">
              Potential 3<span className="align-super text-[0.5625rem]">×</span> ceiling
            </dt>
            <dd className="text-[0.8125rem] font-semibold text-subtle">—</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-canvas p-3">
          <Info className="mt-0.5 size-3.5 shrink-0 text-muted" strokeWidth={1.9} aria-hidden />
          <p className="text-[0.6875rem] leading-relaxed text-muted">
            An assessment needs at least one confirmed contribution and a verified financial profile.
            Approval also depends on affordability and lending policy.
          </p>
        </div>

        <Link
          href="/app/eligibility"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4 w-full")}
        >
          View eligibility requirements
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
