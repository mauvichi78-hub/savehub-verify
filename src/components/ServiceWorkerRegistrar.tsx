"use client";

import { useEffect } from "react";

// Registers the service worker once on the client. Skipped in dev so we
// don't fight Turbopack's HMR (cached assets shadowing edits). In production
// or when explicitly toggled on, it registers /sw.js at app scope.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("SW registration failed:", err);
    });
  }, []);

  return null;
}
