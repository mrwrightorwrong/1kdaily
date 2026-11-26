import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { disclaimers, siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Savings plans", href: "/#plans" },
      { label: "Loan eligibility", href: "/#eligibility" },
      { label: "Dashboard preview", href: "/app" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "Security", href: "/#security" },
      { label: "Design system", href: "/design" },
      { label: "Admin console", href: "/admin" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of use", href: "/legal/terms" },
      { label: "Privacy notice", href: "/legal/privacy" },
      { label: "Loan terms", href: "/legal/loan-terms" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
              Daily savings discipline, a verifiable financial record, and a responsible path to
              credit eligibility.
            </p>
            <p className="mt-6 rounded-xl border border-warn-500/25 bg-warn-50 p-3 text-[0.6875rem] leading-relaxed text-[#7a5300]">
              Phase 2 build. Accounts and identity verification are live; savings payments and the
              ledger arrive in Phase 4. No money is collected in this deployment, and local
              verification uses a mock provider.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.8125rem] text-muted transition-colors hover:text-ink-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-line pt-6">
          <p className="text-[0.6875rem] leading-relaxed text-subtle">{disclaimers.credit}</p>
          <p className="text-[0.6875rem] leading-relaxed text-subtle">{disclaimers.custody}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <p className="text-[0.6875rem] text-subtle">
              © {new Date().getFullYear()} {siteConfig.name}. Built for the Nigerian market.
            </p>
            <p className="text-[0.6875rem] text-subtle">Lagos, Nigeria · WAT (UTC+1)</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
