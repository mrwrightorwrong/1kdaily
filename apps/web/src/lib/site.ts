/**
 * Static site configuration and the compliance copy that appears repeatedly.
 * Any statement about credit here must remain conditional — never a promise.
 */

export const siteConfig = {
  name: "1kDaily",
  tagline: "Save Daily. Build Capacity. Unlock Opportunity.",
  description:
    "1kDaily is a daily savings and financial discipline platform. Save consistently, build a verifiable savings record, and see how that record may support future credit eligibility.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://1kdaily.ng",
  locale: "en-NG",
} as const;

export const disclaimers = {
  credit:
    "Savings multipliers are potential ceilings, not entitlements. Every loan is subject to assessment, affordability checks, policy and available lending capital. Approval is not guaranteed.",
  custody:
    "1kDaily is a technology platform. Customer funds are intended to be held with appropriately authorised financial partners; the platform does not itself take deposits or lend.",
  illustration:
    "Illustrative product configuration shown for design review. Plan limits and durations are administered server-side and may change.",
} as const;

export const trustPoints = [
  {
    title: "Partner-held funds",
    body: "Savings are designed to sit with a licensed financial partner, not in an unregulated pool.",
  },
  {
    title: "Ledger-backed balances",
    body: "Every balance is derived from double-entry ledger records. No editable wallet numbers.",
  },
  {
    title: "Verified payments only",
    body: "A contribution counts only after the provider confirms it server-side. Never from a browser response.",
  },
  {
    title: "No guaranteed loans",
    body: "Eligibility is assessed on savings behaviour, affordability and policy. We never promise approval.",
  },
] as const;
