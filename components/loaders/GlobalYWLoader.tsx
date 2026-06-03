"use client";

import { useEffect, useState } from "react";
import { YWLoaderOverlay, type LoaderVariant } from "./YWLoader";
import styles from "./GlobalYWLoader.module.css";

type LoaderPhase = "show" | "hide" | "gone";

const DEFAULT_MIN_SHOW_MS = 420;
const DEFAULT_EXIT_MS = 180;
const DEFAULT_MAX_SHOW_MS = 1450;
const REDUCED_MIN_SHOW_MS = 120;
const REDUCED_EXIT_MS = 80;
const REDUCED_MAX_SHOW_MS = 520;

export function GlobalYWLoader({
  label = "Loading YW Coach",
  variant = "guest"
}: {
  label?: string;
  variant?: LoaderVariant;
}) {
  const [phase, setPhase] = useState<LoaderPhase>("show");

  useEffect(() => {
    if (document.documentElement.dataset.ywGlobalLoaderDismissed === "true") {
      const frame = window.requestAnimationFrame(() => setPhase("gone"));
      return () => window.cancelAnimationFrame(frame);
    }

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
        document.documentElement.dataset.ywGlobalLoaderDismissed = "true";
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
      document.removeEventListener("DOMContentLoaded", hide);
      window.removeEventListener("load", hide);
      window.clearTimeout(hideTimer);
      window.clearTimeout(goneTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={styles.globalLoader} data-phase={phase} id="yw-global-loader">
      <YWLoaderOverlay label={label} variant={variant} />
    </div>
  );
}
