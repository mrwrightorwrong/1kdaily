import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge, Card, CardContent, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const COMING = [
  "Email and phone verification at registration",
  "Password authentication with rate limiting",
  "TOTP multi-factor authentication",
  "Session and device review",
];

export default function SignInPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <Logo size="md" />

        <div className="mt-8 flex items-center gap-2">
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Sign in</h1>
          <Badge variant="warning">Phase 2</Badge>
        </div>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          Authentication is not connected in this preview. There are no accounts, so there is nothing
          to sign in to yet — and no placeholder form pretending otherwise.
        </p>

        <Card className="mt-6">
          <CardContent>
            <p className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">
              <Lock className="size-3" aria-hidden />
              Arriving in Phase 2
            </p>
            <ul className="mt-3 space-y-2.5">
              {COMING.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <Check className="size-2.5" strokeWidth={3} aria-hidden />
                  </span>
                  <span className="text-[0.8125rem] leading-snug text-body">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col gap-2">
          <Link href="/app" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}>
            Open dashboard preview
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "md" }))}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
