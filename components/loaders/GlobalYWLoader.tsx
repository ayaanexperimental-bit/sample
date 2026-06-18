"use client";

import { useEffect, useState } from "react";
import { YWLoaderOverlay, type LoaderVariant } from "./YWLoader";
import styles from "./GlobalYWLoader.module.css";

type LoaderPhase = "show" | "hide" | "gone";

const DEFAULT_MIN_SHOW_MS = 260;
const DEFAULT_EXIT_MS = 140;
const DEFAULT_MAX_SHOW_MS = 900;
const REDUCED_MIN_SHOW_MS = 120;
const REDUCED_EXIT_MS = 80;
const REDUCED_MAX_SHOW_MS = 520;

export function GlobalYWLoader({ label, variant }: { label?: string; variant?: LoaderVariant }) {
  const [phase, setPhase] = useState<LoaderPhase>("hide");
  const [routeLoader, setRouteLoader] = useState<{ label: string; variant: LoaderVariant }>(() =>
    getRouteLoaderDefaults("", { label, variant })
  );

  useEffect(() => {
    const routeFrame = window.requestAnimationFrame(() => {
      setRouteLoader(getRouteLoaderDefaults(window.location.pathname, { label, variant }));
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minShowMs = reducedMotion ? REDUCED_MIN_SHOW_MS : DEFAULT_MIN_SHOW_MS;
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : DEFAULT_EXIT_MS;
    const maxShowMs = reducedMotion ? REDUCED_MAX_SHOW_MS : DEFAULT_MAX_SHOW_MS;
    const startedAt = window.performance.now();
    let hideStarted = false;
    let hideTimer = 0;
    let goneTimer = 0;

    const hide = () => {
      if (hideStarted) return;
      hideStarted = true;

      const elapsed = window.performance.now() - startedAt;
      const remainingMinShow = Math.max(0, minShowMs - elapsed);

      hideTimer = window.setTimeout(() => {
        setPhase("hide");
        goneTimer = window.setTimeout(() => setPhase("gone"), exitMs);
      }, remainingMinShow);
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      window.requestAnimationFrame(hide);
    } else {
      document.addEventListener("DOMContentLoaded", hide, { once: true });
      window.addEventListener("load", hide, { once: true });
    }

    const maxTimer = window.setTimeout(hide, maxShowMs);

    return () => {
      window.cancelAnimationFrame(routeFrame);
      document.removeEventListener("DOMContentLoaded", hide);
      window.removeEventListener("load", hide);
      window.clearTimeout(hideTimer);
      window.clearTimeout(goneTimer);
      window.clearTimeout(maxTimer);
    };
  }, [label, variant]);

  if (phase === "gone") return null;

  return (
    <div className={styles.globalLoader} data-phase={phase} id="yw-global-loader">
      <YWLoaderOverlay label={routeLoader.label} variant={routeLoader.variant} />
    </div>
  );
}

function getRouteLoaderDefaults(
  pathname: string,
  overrides: { label?: string; variant?: LoaderVariant }
) {
  if (pathname.startsWith("/admin")) {
    return {
      label: overrides.label || "Loading admin panel",
      variant: overrides.variant || "profile"
    };
  }

  if (pathname.includes("/success")) {
    return {
      label: overrides.label || "Loading success page",
      variant: overrides.variant || "success"
    };
  }

  if (
    pathname.startsWith("/go/") ||
    pathname.includes("/paid") ||
    pathname.includes("/program") ||
    pathname.includes("/masterclass") ||
    pathname.includes("/pcos-51")
  ) {
    return {
      label: overrides.label || "Loading paid masterclass",
      variant: overrides.variant || "paid"
    };
  }

  if (pathname.startsWith("/coach/") || pathname.startsWith("/gyana")) {
    return {
      label: overrides.label || "Loading coach referral",
      variant: overrides.variant || "guest"
    };
  }

  return {
    label: overrides.label || "Loading YW Coach",
    variant: overrides.variant || "guest"
  };
}
