"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down";

export type ScrollLiquidProgress = {
  progress: number;
  smoothProgress: number;
  direction: ScrollDirection;
  velocity: number;
  percentage: number;
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function useScrollLiquidProgress(): ScrollLiquidProgress {
  const [state, setState] = useState<ScrollLiquidProgress>({
    progress: 0,
    smoothProgress: 0,
    direction: "down",
    velocity: 0,
    percentage: 0
  });

  const frameRef = useRef<number | null>(null);
  const previousYRef = useRef(0);
  const smoothRef = useRef(0);
  const velocityRef = useRef(0);
  const directionRef = useRef<ScrollDirection>("down");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function readProgress() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      return maxScroll > 0 ? clamp(window.scrollY / maxScroll) : 0;
    }

    function tick() {
      const currentY = window.scrollY;
      const progress = readProgress();
      const rawVelocity = Math.abs(currentY - previousYRef.current);

      if (currentY > previousYRef.current) {
        directionRef.current = "down";
      } else if (currentY < previousYRef.current) {
        directionRef.current = "up";
      }

      velocityRef.current = velocityRef.current * 0.82 + rawVelocity * 0.18;
      smoothRef.current = reduceMotion
        ? progress
        : smoothRef.current + (progress - smoothRef.current) * 0.11;

      const smoothProgress = clamp(smoothRef.current);

      setState({
        progress,
        smoothProgress,
        direction: directionRef.current,
        velocity: velocityRef.current,
        percentage: Math.round(smoothProgress * 100)
      });

      previousYRef.current = currentY;
      frameRef.current = window.requestAnimationFrame(tick);
    }

    previousYRef.current = window.scrollY;
    smoothRef.current = readProgress();
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return state;
}
