"use client";

import type { CSSProperties } from "react";
import { useScrollLiquidProgress } from "@/components/landing/use-scroll-liquid-progress";

type LiquidStyle = CSSProperties & {
  "--scroll-progress": string;
  "--scroll-velocity": string;
  "--liquid-wave-strength": string;
};

type LiquidProgressLayerProps = {
  variant?: "default" | "nav";
};

export function LiquidProgressLayer({ variant = "default" }: LiquidProgressLayerProps) {
  const { smoothProgress, direction, velocity, percentage } = useScrollLiquidProgress();
  const isNav = variant === "nav";
  const normalizedVelocity = Math.min(1, velocity / (isNav ? 34 : 90));
  const style: LiquidStyle = {
    "--scroll-progress": smoothProgress.toFixed(4),
    "--scroll-velocity": normalizedVelocity.toFixed(4),
    "--liquid-wave-strength": `${Math.min(
      isNav ? 58 : 28,
      7 + velocity * (isNav ? 0.72 : 0.22)
    ).toFixed(2)}px`
  };

  return (
    <div
      aria-hidden="true"
      className={`liquid-progress-layer liquid-progress-layer--${variant}`}
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
        <span />
        <span />
        <span />
      </div>
      <div className="liquid-bubbles">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
