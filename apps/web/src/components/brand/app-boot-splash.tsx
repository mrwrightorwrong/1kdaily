"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "./brand-loader";

const BOOTED_KEY = "1kd:app-booted";

/**
 * The app segment's loading fallback is shared by ordinary navigation and by
 * the first entry of a session. Navigations must stay skeleton-only, so the
 * brand loader is shown only for that first entry — and never on top of a
 * skeleton that later navigations would have shown anyway.
 */
export function AppBootSplash({ children }: { readonly children: React.ReactNode }) {
  const [boot, setBoot] = useState(false);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(BOOTED_KEY)) return;
      window.sessionStorage.setItem(BOOTED_KEY, "1");
    } catch {
      // Session storage unavailable (private mode): treat as a first entry.
    }
    setBoot(true);
  }, []);

  if (!boot) return <>{children}</>;

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <BrandLoader size="md" message="Loading your dashboard…" />
    </div>
  );
}
