export type FormState = {
  readonly status: "idle" | "error" | "success";
  readonly message?: string;
  readonly fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

/** Only allow same-origin, path-relative redirects. */
export function safeNextPath(value: string | null | undefined, fallback = "/app"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
