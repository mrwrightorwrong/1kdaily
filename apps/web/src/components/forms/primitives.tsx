"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form";

const controlBase =
  "w-full rounded-xl border bg-surface px-3.5 text-[0.875rem] text-ink-900 shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:ring-4 disabled:opacity-60";

function controlClass(hasError: boolean): string {
  return cn(
    controlBase,
    "h-11",
    hasError
      ? "border-danger-600/60 focus:border-danger-600 focus:ring-danger-600/10"
      : "border-line focus:border-brand-500 focus:ring-brand-500/10",
  );
}

function FieldWrap({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly optional?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[0.75rem] font-medium text-ink-900">{label}</span>
        {optional ? (
          <span className="text-[0.625rem] uppercase tracking-[0.08em] text-subtle">Optional</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.6875rem] font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  type,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly optional?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  return (
    <FieldWrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <div className="relative">
        <input
          id={id}
          name={props.name ?? id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(controlClass(Boolean(error)), isPassword && "pr-11", className)}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-subtle transition-colors hover:text-ink-900"
          >
            {revealed ? (
              <EyeOff className="size-4" strokeWidth={1.9} aria-hidden />
            ) : (
              <Eye className="size-4" strokeWidth={1.9} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </FieldWrap>
  );
}

export function SelectField({
  id,
  label,
  error,
  hint,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"select"> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
}) {
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass(Boolean(error)), "appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrap>
  );
}

export function TextareaField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly optional?: boolean;
}) {
  return (
    <FieldWrap id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea
        id={id}
        name={props.name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(controlClass(Boolean(error)), "min-h-24 py-2.5 leading-relaxed", className)}
        {...props}
      />
    </FieldWrap>
  );
}

export function CheckboxField({
  id,
  label,
  error,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  readonly id: string;
  readonly label: ReactNode;
  readonly error?: string;
}) {
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name={props.name ?? id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-line accent-[#16A34A]"
          {...props}
        />
        <label htmlFor={id} className="text-[0.75rem] leading-relaxed text-muted">
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[0.6875rem] font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ state }: { readonly state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "rounded-xl border px-3.5 py-3 text-[0.75rem] leading-relaxed",
        isError
          ? "border-danger-600/25 bg-danger-50 text-[#8f1d1d]"
          : "border-brand-200 bg-brand-50 text-brand-800",
      )}
    >
      {state.message}
    </div>
  );
}
