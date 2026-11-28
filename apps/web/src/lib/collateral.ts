export const COLLATERAL_CATEGORIES = [
  "vehicle",
  "equipment",
  "property",
  "business_asset",
  "other",
] as const;

export type CollateralCategory = (typeof COLLATERAL_CATEGORIES)[number];

export const COLLATERAL_CATEGORY_LABEL: Record<string, string> = {
  vehicle: "Vehicle",
  equipment: "Equipment",
  property: "Property",
  business_asset: "Business asset",
  other: "Other",
};

export type BadgeTone = "warning" | "success" | "danger" | "neutral" | "info";

export const COLLATERAL_STATUS_VARIANT: Record<string, BadgeTone> = {
  submitted: "warning",
  pending_verification: "info",
  verified: "success",
  rejected: "danger",
  under_review: "info",
  released: "neutral",
  disputed: "danger",
};

export function isCollateralCategory(value: string): value is CollateralCategory {
  return (COLLATERAL_CATEGORIES as ReadonlyArray<string>).includes(value);
}
