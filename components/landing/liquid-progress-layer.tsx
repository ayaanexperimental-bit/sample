"use client";

import type { CSSProperties } from "react";
import { useScrollLiquidProgress } from "@/components/landing/use-scroll-liquid-progress";

type LiquidStyle = CSSProperties & {
  "--scroll-progress": string;
  "--scroll-velocity": string;
  "--liquid-wave-strength": string;
};

export function LiquidProgressLayer() {
  const { smoothProgress, direction, velocity, percentage } = useScrollLiquidProgress();
  const normalizedVelocity = Math.min(1, velocity / 90);
  const style: LiquidStyle = {
    "--scroll-progress": smoothProgress.toFixed(4),
    "--scroll-velocity": normalizedVelocity.toFixed(4),
    "--liquid-wave-strength": `${Math.min(28, 7 + velocity * 0.22).toFixed(2)}px`
  };

  return (
    <div
      aria-hidden="true"
      className="liquid-progress-layer"
      data-direction={direction}
      data-percentage={percentage}
      style={style}
    >
      <div className="liquid-fill" />
      <div className="liquid-wave" />
      <div className="liquid-droplets">
        <span />
        <span />
        <span />
      </div>
      <div className="liquid-bubbles">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
