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
  const stateRef = useRef(state);
  const lastCommitRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function readProgress() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      return maxScroll > 0 ? clamp(window.scrollY / maxScroll) : 0;
    }

    function commit(nextState: ScrollLiquidProgress) {
      const previous = stateRef.current;
      const progressDelta = Math.abs(previous.smoothProgress - nextState.smoothProgress);
      const velocityDelta = Math.abs(previous.velocity - nextState.velocity);

      if (
        progressDelta < 0.0015 &&
        velocityDelta < 0.18 &&
        previous.direction === nextState.direction &&
        previous.percentage === nextState.percentage
      ) {
        return;
      }

      stateRef.current = nextState;
      setState(nextState);
    }

    function update() {
      frameRef.current = null;
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
        : smoothRef.current + (progress - smoothRef.current) * 0.34;

      const smoothProgress = clamp(smoothRef.current);
      const now = performance.now();
      const shouldCommit = now - lastCommitRef.current > 32 || rawVelocity > 8 || reduceMotion;

      if (!shouldCommit) {
        previousYRef.current = currentY;
        return;
      }

      commit({
        progress,
        smoothProgress,
        direction: directionRef.current,
        velocity: velocityRef.current,
        percentage: Math.round(smoothProgress * 100)
      });

      lastCommitRef.current = now;
      previousYRef.current = currentY;
    }

    function requestUpdate() {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(update);
    }

    previousYRef.current = window.scrollY;
    smoothRef.current = readProgress();
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return state;
}
