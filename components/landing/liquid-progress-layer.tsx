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
      <div className="liquid-glass-shell" />
      <div className="liquid-inner-depth" />
      <div className="liquid-fill">
        <svg
          className="liquid-surface"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`liquidGradient-${variant}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="28%" stopColor="#a855f7" />
              <stop offset="52%" stopColor="#3b82f6" />
              <stop offset="76%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <filter id={`liquidGlowFilter-${variant}`} x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1.4 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            className="liquid-surface-fill"
            filter={`url(#liquidGlowFilter-${variant})`}
            fill={`url(#liquidGradient-${variant})`}
            d="M0,43 C120,20 220,58 340,37 C470,13 560,67 700,40 C830,18 940,58 1060,38 C1130,27 1170,30 1200,36 L1200,120 L0,120 Z"
          />
          <path
            className="liquid-surface-shine"
            fill="none"
            stroke="rgba(255,255,255,0.78)"
            strokeWidth="3"
            strokeLinecap="round"
            d="M0,43 C120,20 220,58 340,37 C470,13 560,67 700,40 C830,18 940,58 1060,38 C1130,27 1170,30 1200,36"
          />
        </svg>
        <span className="liquid-sparkle-texture" />
      </div>
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
