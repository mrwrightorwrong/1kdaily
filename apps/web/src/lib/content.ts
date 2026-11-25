import { fromKobo, type Kobo } from "@1kdaily/core";

/**
 * Marketing content for the Phase 1 public surface.
 *
 * Plan figures here are *illustrative configurations* for the landing page.
 * Phase 3 loads real, administrator-managed products from `savings_products`.
 */

export type ShowcasePlan = {
  readonly name: string;
  readonly dailyKobo: Kobo;
  readonly durationDays: number;
  readonly blurb: string;
  readonly featured?: boolean;
};

export const SHOWCASE_PLANS: readonly ShowcasePlan[] = [
  {
    name: "Starter",
    dailyKobo: fromKobo(100_000),
    durationDays: 30,
    blurb: "A gentle first month. Build the habit before increasing the amount.",
  },
  {
    name: "Growth",
    dailyKobo: fromKobo(200_000),
    durationDays: 90,
    blurb: "A full quarter of consistency — the shortest useful track record.",
    featured: true,
  },
  {
    name: "Builder",
    dailyKobo: fromKobo(500_000),
    durationDays: 180,
    blurb: "Half a year of discipline, with a larger verifiable savings base.",
  },
  {
    name: "Power",
    dailyKobo: fromKobo(1_000_000),
    durationDays: 365,
    blurb: "A year-long commitment for users with strong monthly cash flow.",
  },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Choose a daily amount",
    body: "Start from ₦1,000 a day or set a custom amount within the limits. Pick a duration from 30 to 365 days.",
  },
  {
    step: "02",
    title: "Save, and let the record build",
    body: "Each confirmed contribution is written to an auditable ledger and mapped to its business day. Streaks, calendars and consistency are derived from those records — never estimated.",
  },
  {
    step: "03",
    title: "See your real capacity",
    body: "Your savings history contributes to an eligibility assessment alongside affordability, existing obligations and policy. You see the reasons, including what is holding you back.",
  },
] as const;

export const FAQS = [
  {
    q: "Is a 2x or 3x limit a guaranteed loan?",
    a: "No. The multiplier describes a potential ceiling derived from eligible savings. Actual credit depends on affordability, repayment capacity, risk policy, documents, and available lending capital. We will never tell you approval is guaranteed.",
  },
  {
    q: "What happens if I miss a day?",
    a: "Your plan rules are shown before you activate it, including grace days and what a missed contribution does to your consistency record. Missing a day never silently changes a balance.",
  },
  {
    q: "Can I withdraw before my plan ends?",
    a: "Each plan states its withdrawal rules up front. Where early withdrawal is permitted, any fees or restrictions are displayed before you confirm — never deducted silently.",
  },
  {
    q: "Who holds my money?",
    a: "The architecture is built for partner-held custody with an authorised financial institution. 1kDaily is the technology and record-keeping layer, and does not operate an internal lending pool from customer savings.",
  },
  {
    q: "Does saving earn interest?",
    a: "Not by default. We do not advertise returns unless an authorised product structure supports them. If a partner-backed savings return is introduced, it will be disclosed with its terms and risks.",
  },
] as const;

export const ELIGIBILITY_FACTORS = [
  "Verified savings balance on eligible plans",
  "Contribution consistency and missed-day history",
  "How long you have been saving",
  "Verified income and existing obligations",
  "Previous repayment performance with 1kDaily",
  "Risk policy and available lending capital",
] as const;
