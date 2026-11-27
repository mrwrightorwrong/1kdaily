"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const ARTWORK = {
  src: "/brand/logo-loader.webp",
  width: 1080,
  height: 360,
} as const;

/**
 * 1kDaily brand loader.
 *
 * The artwork is a dark-on-transparent lockup, so in dark mode it sits on a soft
 * white plate to keep contrast; in light mode it sits directly on the surface.
 * The progress bar is deliberately indeterminate — we never show a percentage
 * we cannot measure. Motion is skipped entirely for reduced-motion users.
 *
 * The artwork is served straight from the CDN (no image optimiser): this renders
 * during a cold first paint, and an optimiser cache miss would leave the plate
 * empty exactly when the loader is on screen.
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
  const [artworkReady, setArtworkReady] = useState(false);
  const width = size === "sm" ? 180 : size === "md" ? 260 : 340;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
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
        className="rounded-2xl px-3 py-3 dark:bg-white dark:shadow-[0_18px_50px_-30px_rgba(0,0,0,0.8)] dark:ring-1 dark:ring-white/10"
      >
        <span
          className="relative block overflow-hidden rounded-lg"
          style={{ width: `min(${width}px, 82vw)`, aspectRatio: "3 / 1" }}
        >
          {artworkReady ? null : (
            <span
              aria-hidden
              className="absolute inset-0 animate-pulse rounded-lg bg-gradient-to-r from-brand-50 via-white to-brand-100 dark:from-white/10 dark:via-white/25 dark:to-white/10"
            />
          )}
          <Image
            src={ARTWORK.src}
            alt="1kDaily — Save Daily, Build Capacity"
            width={ARTWORK.width}
            height={ARTWORK.height}
            unoptimized
            priority
            sizes="(max-width: 640px) 82vw, 340px"
            onLoad={() => setArtworkReady(true)}
            className={cn(
              "relative h-full w-full object-contain transition-opacity duration-500",
              artworkReady ? "opacity-100" : "opacity-0",
            )}
          />
        </span>
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

        <p className="mt-3 text-[0.75rem] font-medium text-muted dark:text-white/70">
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
