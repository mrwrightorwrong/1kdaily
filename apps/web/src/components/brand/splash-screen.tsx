"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site";
import { LogoMark } from "./logo";

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
          className="hero-surface fixed inset-0 z-[100] grid place-items-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: EXIT_S, ease: "easeOut" } }}
        >
          <div className="hero-grid-lines absolute inset-0 opacity-40" />
          <div className="relative flex flex-col items-center gap-5 px-6 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
            >
              <LogoMark className="size-16 rounded-[18px] shadow-hero" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-[1.375rem] font-semibold tracking-[-0.02em] text-white"
            >
              1k<span className="text-brand-300">Daily</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.34, duration: 0.4 }}
              className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-white/50"
            >
              {siteConfig.tagline}
            </motion.p>

            <motion.span
              aria-hidden
              className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-brand-400 to-transparent"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.42, duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
