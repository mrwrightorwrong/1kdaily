"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

/**
 * 1kDaily brand loader.
 *
 * The supplied artwork is a light-background lockup with a dark wordmark, so it
 * sits on a soft plate in both themes rather than inverting and losing contrast.
 * The progress bar is deliberately indeterminate: we never show a percentage we
 * cannot measure. Motion is skipped entirely for reduced-motion users.
 */
export function BrandLoader({
  message,
  size = "full",
  className,
}: {
  readonly message?: string;
  readonly size?: "sm" | "md" | "full";
  readonly className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const width = size === "sm" ? 180 : size === "md" ? 260 : 340;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "flex flex-col items-center gap-6 text-center",
        size === "full" && "min-h-dvh justify-center px-6 py-12",
        className,
      )}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl bg-white/95 px-4 py-3 shadow-[0_18px_50px_-30px_rgba(11,23,57,0.6)] ring-1 ring-black/5 dark:bg-white"
      >
        <Image
          src="/brand/logo-loader.png"
          alt="1kDaily — Save Daily, Build Capacity"
          width={900}
          height={312}
          priority
          className="h-auto"
          style={{ width, height: "auto" }}
        />
      </motion.div>

      <div className="w-56 max-w-[70vw]">
        <div className="h-1 overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/15">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#064E3B] via-[#16A34A] to-[#10B981]"
            initial={reduceMotion ? { width: "100%" } : { x: "-120%" }}
            animate={reduceMotion ? { width: "100%" } : { x: ["-120%", "320%"] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.15 }
            }
          />
        </div>

        <p className="mt-3 text-[0.75rem] font-medium text-muted">
          {message ?? "Preparing your experience…"}
        </p>
      </div>
    </div>
  );
}

/** Thin, local loader for panels and tables — never full screen. */
export function InlineBrandLoader({
  label = "Loading",
  className,
}: {
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-brand-500 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-brand-600" />
      </span>
      <span className="text-[0.8125rem] text-muted">{label}</span>
    </span>
  );
}
