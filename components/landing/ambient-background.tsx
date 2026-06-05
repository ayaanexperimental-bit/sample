"use client";

import { useEffect, useState } from "react";
import Grainient from "@/components/react-bits/grainient/grainient";
import {
  type AdaptiveVisualCapability,
  watchAdaptiveVisualCapability
} from "@/lib/client/adaptive-visual-capability";

export function AmbientBackground() {
  const [visualCapability, setVisualCapability] =
    useState<AdaptiveVisualCapability>("static");

  useEffect(() => {
    const cleanup = watchAdaptiveVisualCapability((capability) => {
      document.documentElement.dataset.ywVisualCapability = capability;
      setVisualCapability(capability);
    });

    return () => {
      cleanup();
    };
  }, []);

  const webglReady = visualCapability !== "static";
  const isReducedVisuals = visualCapability === "reduced";

  return (
    <div
      className={`ambient-background ambient-background--grainient ${
        webglReady ? "ambient-background--webgl-ready" : "ambient-background--css-only"
      } ambient-background--${visualCapability}`}
      data-yw-visual-capability={visualCapability}
      aria-hidden="true"
    >
      {webglReady ? (
        <Grainient
          className="ambient-background__webgl"
          color1="#f59ab8"
          color2="#ffe88f"
          color3="#b7d99c"
          timeSpeed={isReducedVisuals ? 0.72 : 1.2}
          colorBalance={0}
          warpStrength={isReducedVisuals ? 0.82 : 1.14}
          warpFrequency={5}
          warpSpeed={isReducedVisuals ? 1.55 : 2.65}
          warpAmplitude={isReducedVisuals ? 58 : 44}
          blendAngle={8}
          blendSoftness={0.05}
          rotationAmount={isReducedVisuals ? 360 : 620}
          noiseScale={2}
          grainAmount={isReducedVisuals ? 0.045 : 0.08}
          grainScale={2}
          grainAnimated={false}
          contrast={isReducedVisuals ? 1.36 : 1.62}
          gamma={1}
          saturation={isReducedVisuals ? 1.06 : 1.16}
          centerX={0}
          centerY={0}
          zoom={0.9}
          frameRate={isReducedVisuals ? 8 : 18}
          lowPowerFrameRate={isReducedVisuals ? 6 : 10}
        />
      ) : null}
    </div>
  );
}
