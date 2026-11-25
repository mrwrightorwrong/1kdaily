import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

type LegalDoc = {
  readonly title: string;
  readonly summary: string;
  readonly sections: ReadonlyArray<{ readonly heading: string; readonly body: string }>;
};

const DOCS: Record<string, LegalDoc> = {
  terms: {
    title: "Terms of use",
    summary:
      "The contractual basis for using 1kDaily, including eligibility, plan rules, fees and complaint handling.",
    sections: [
      {
        heading: "1. Who we are",
        body: "1kDaily is a technology platform. Where funds are held or credit is advanced, it is done by an appropriately authorised financial partner under a separate agreement. Nothing in these terms authorises 1kDaily to take deposits or lend in its own right unless it holds the required licence.",
      },
      {
        heading: "2. Eligibility",
        body: "You must be at least 18 years old, provide accurate identity information, and complete the verification level required for the services you use. We may decline or restrict an account where verification cannot be completed or where law requires it.",
      },
      {
        heading: "3. Savings plans",
        body: "Each plan displays its daily amount, duration, expected total, start and end dates, withdrawal rules, grace-day treatment and missed-contribution consequences before you confirm. Activating a plan constitutes acceptance of those specific rules.",
      },
      {
        heading: "4. Credit is not guaranteed",
        body: "Savings multipliers describe potential ceilings only. Every application is subject to assessment of affordability, obligations, repayment history, policy and available capital. We do not guarantee approval, amounts, rates or timelines.",
      },
      {
        heading: "5. Fees and charges",
        body: "Any fee is disclosed before the transaction it applies to. We do not deduct undisclosed charges from savings balances.",
      },
      {
        heading: "6. Complaints",
        body: "A complaint may be raised from the support module. We will acknowledge it, investigate and respond within the period required by applicable consumer protection rules.",
      },
    ],
  },
  privacy: {
    title: "Privacy notice",
    summary:
      "What personal data 1kDaily processes, why, how long it is kept, and the rights available under the Nigeria Data Protection Act 2023.",
    sections: [
      {
        heading: "1. Data we process",
        body: "Account and contact details, identity verification results, financial profile information you provide, savings and repayment records, device and security logs, and support correspondence. We collect only what a stated purpose requires.",
      },
      {
        heading: "2. Identity documents",
        body: "BVN and NIN are verified through an authorised vendor. We store the verification result, vendor reference and a masked identifier where needed — not the full number.",
      },
      {
        heading: "3. Lawful basis",
        body: "We rely on contract performance for the service, consent for optional processing such as marketing, legal obligation for identity and financial records, and legitimate interest for fraud prevention and security.",
      },
      {
        heading: "4. Retention",
        body: "Financial and identity records are retained for the period required by financial regulation and audit obligations. Other data is deleted or anonymised when the purpose ends.",
      },
      {
        heading: "5. Your rights",
        body: "You may request access, correction, portability or erasure of your data, and may object to certain processing. Financial records subject to statutory retention are excluded from erasure. Requests are handled through the support module.",
      },
      {
        heading: "6. Security",
        body: "Access is role-based and least-privilege. Sensitive data is isolated, audited and never exposed to ordinary support staff. Security incidents are handled under a documented incident procedure.",
      },
    ],
  },
  "loan-terms": {
    title: "Loan terms",
    summary:
      "How credit is priced, disclosed and repaid — including the interest method, fees, and consequences of missed payments.",
    sections: [
      {
        heading: "1. Offer and acceptance",
        body: "Before acceptance you see the principal, interest rate, calculation method (flat or declining balance), total interest, fees, total payable, installment amount and full schedule. Acceptance is explicit; no loan is created by browsing.",
      },
      {
        heading: "2. Interest method",
        body: "Flat and declining-balance interest are different products and are never presented as interchangeable. The method used for your offer is stated on the offer and in the contract.",
      },
      {
        heading: "3. Repayment",
        body: "Repayments are applied to the schedule. Partial payments are recorded and reflected in the outstanding balance. A payment is only treated as received after server-side verification.",
      },
      {
        heading: "4. Missed payments",
        body: "Late charges, if any, are lawful, disclosed in advance and capped by policy. Collection activity follows applicable consumer protection rules; we do not contact your contacts or engage in abusive practices.",
      },
      {
        heading: "5. Guarantors and collateral",
        body: "Where required, a guarantor must independently review and consent to the guarantee. Collateral is verified and documented before it is treated as security, and is released when the contractual obligations are satisfied.",
      },
    ],
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc];
  return { title: entry?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = DOCS[doc];
  if (!entry) notFound();

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Home
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">
          {entry.title}
        </h1>
        <Badge variant="warning">Draft · legal review pending</Badge>
      </div>

      <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">{entry.summary}</p>

      <div className="mt-8 space-y-6">
        {entry.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[0.9375rem] font-semibold text-ink-900">{section.heading}</h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-line pt-5 text-[0.6875rem] leading-relaxed text-subtle">
        This is a working draft prepared for product and architectural review. It is not legal advice
        and must be reviewed and finalised by qualified Nigerian counsel before any live use.
      </p>
    </main>
  );
}
