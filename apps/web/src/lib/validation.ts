import { z } from "zod";
import { isValidIdentityNumber, normalizeIdentityNumber } from "@1kdaily/core";

const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(80, "Maximum 80 characters");

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .toLowerCase();

// NIST-aligned minimum. Length beats forced symbol soup; still require a letter
// and a number so a single dictionary word is not enough.
const password = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(72, "Maximum 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

const phone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^\+[1-9][0-9]{7,14}$/.test(value), {
    message: "Use international format, e.g. +2348012345678",
  });

export const signUpSchema = z.object({
  first_name: name,
  last_name: name,
  email,
  phone,
  password,
  terms: z.string().optional(),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(72),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirm_password: z.string().min(1, "Confirm your password"),
  })
  .refine((value) => value.password === value.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const resendVerificationSchema = z.object({ email });

export const profileSchema = z.object({
  first_name: name,
  last_name: name,
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || /^\+[1-9][0-9]{7,14}$/.test(value), {
      message: "Use international format, e.g. +2348012345678",
    }),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Use the date picker",
    }),
  state: z.string().trim().max(60).optional(),
  address_line: z.string().trim().max(200).optional(),
});

export const employmentStatuses = [
  "salaried",
  "self_employed",
  "business_owner",
  "student",
  "unemployed",
  "retired",
  "other",
] as const;

export type EmploymentStatus = (typeof employmentStatuses)[number];

export const financialProfileSchema = z.object({
  employment_status: z.enum(employmentStatuses, { message: "Select your employment status" }),
  income_source: z.string().trim().max(120).optional(),
  business_type: z.string().trim().max(120).optional(),
  monthly_income: z.string().trim().max(20).optional(),
  monthly_obligations: z.string().trim().max(20).optional(),
  existing_debt: z.string().trim().max(20).optional(),
});

export const identitySchema = z
  .object({
    kind: z.enum(["bvn", "nin"], { message: "Choose BVN or NIN" }),
    number: z.string().trim().max(30),
    consent: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (!isValidIdentityNumber(value.kind, value.number)) {
      context.addIssue({
        code: "custom",
        path: ["number"],
        message: `Enter the 11-digit ${value.kind.toUpperCase()}.`,
      });
    }
    if (value.consent !== "on") {
      context.addIssue({
        code: "custom",
        path: ["consent"],
        message: "You must consent to verification before continuing",
      });
    }
  })
  .transform((value) => ({
    kind: value.kind,
    number: normalizeIdentityNumber(value.number),
    consent: true as const,
  }));

export const identityDecisionSchema = z.object({
  document_id: z.string().uuid("Invalid document reference"),
  decision: z.enum(["verify", "reject", "request_review"]),
  reason: z
    .string()
    .trim()
    .min(10, "Give a reason of at least 10 characters")
    .max(500, "Maximum 500 characters"),
});

export type FieldErrors = Record<string, string>;

/** First error per field, in the order Zod reports them. */
export function firstFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/** FormData → plain object, omitting empty strings so optional fields stay optional. */
export function formToObject(formData: FormData): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") output[key] = value;
  }
  return output;
}
