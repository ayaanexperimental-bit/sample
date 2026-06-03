"use client";

import { useEffect, useState } from "react";
import { YWLoaderOverlay, type LoaderVariant } from "./YWLoader";
import styles from "./GlobalYWLoader.module.css";

type LoaderPhase = "show" | "hide" | "gone";

const DEFAULT_SHOW_MS = 680;
const DEFAULT_EXIT_MS = 220;
const REDUCED_SHOW_MS = 180;
const REDUCED_EXIT_MS = 80;

export function GlobalYWLoader({
  label = "Loading YW Coach",
  variant = "guest"
}: {
  label?: string;
  variant?: LoaderVariant;
}) {
  const [phase, setPhase] = useState<LoaderPhase>("show");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showMs = reducedMotion ? REDUCED_SHOW_MS : DEFAULT_SHOW_MS;
    const exitMs = reducedMotion ? REDUCED_EXIT_MS : DEFAULT_EXIT_MS;
    const hideTimer = window.setTimeout(() => setPhase("hide"), showMs);
    const goneTimer = window.setTimeout(() => setPhase("gone"), showMs + exitMs);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={styles.globalLoader} data-phase={phase}>
      <YWLoaderOverlay label={label} variant={variant} />
    </div>
  );
}
