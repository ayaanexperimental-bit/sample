"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Grainient = dynamic(() => import("@/components/react-bits/grainient/grainient"), {
  ssr: false
});

export function AmbientBackground() {
  const [showGrainient, setShowGrainient] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const handle =
      idleWindow.requestIdleCallback?.(() => setShowGrainient(true), { timeout: 900 }) ??
      window.setTimeout(() => setShowGrainient(true), 650);

    return () => {
      if (idleWindow.cancelIdleCallback && typeof handle === "number") {
        idleWindow.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, []);

  return (
    <div
      className={`ambient-background ambient-background--grainient ambient-background--css-only${
        showGrainient ? " ambient-background--webgl-ready" : ""
      }`}
      aria-hidden="true"
    >
      <span className="grainient-skeleton" />
      {showGrainient ? (
        <Grainient
          color1="#e18cf4"
          color2="#9ad8d5"
          color3="#8bf95e"
          timeSpeed={1.2}
          colorBalance={0}
          warpStrength={0.72}
          warpFrequency={4}
          warpSpeed={1.35}
          warpAmplitude={58}
          blendAngle={0}
          blendSoftness={0.08}
          rotationAmount={360}
          noiseScale={2}
          grainAmount={0.045}
          grainScale={2}
          grainAnimated={false}
          contrast={1.08}
          gamma={1.02}
          saturation={0.72}
          centerX={0}
          centerY={0}
          zoom={0.96}
        />
      ) : null}
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
