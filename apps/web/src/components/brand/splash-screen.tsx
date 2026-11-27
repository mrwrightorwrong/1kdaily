"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { BrandLoader } from "./brand-loader";

const SEEN_KEY = "1kd:splash-seen";
const HOLD_MS = 1500;
const EXIT_S = 0.32;

/**
 * Brand boot reveal. Shows at most once per browser session, never blocks
 * content for longer than 1.5s, and is skipped entirely for reduced-motion
 * users (and when session storage is unavailable, e.g. hardened browsers).
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    try {
      if (window.sessionStorage.getItem(SEEN_KEY)) return;
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="splash"
          aria-hidden
          className="fixed inset-0 z-[100] overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f6f8fc_58%,#ecfdf5_100%)] dark:bg-[linear-gradient(160deg,#0b1739_0%,#0a2a24_60%,#064e3b_100%)]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: EXIT_S, ease: "easeOut" } }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_48%_at_50%_42%,rgba(16,185,129,0.14),transparent_72%)] dark:bg-[radial-gradient(58%_48%_at_50%_42%,rgba(16,185,129,0.22),transparent_72%)]"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5b942]/60 to-transparent" />

          <BrandLoader size="full" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
