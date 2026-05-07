"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DeferredGrainient = dynamic(() => import("@/components/react-bits/grainient/grainient"), {
  ssr: false,
  loading: () => <span className="grainient-skeleton" />
});

export function AmbientBackground() {
  const [canRenderGrainient, setCanRenderGrainient] = useState(false);

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    const handle =
      idleWindow.requestIdleCallback?.(() => setCanRenderGrainient(true), { timeout: 1200 }) ??
      window.setTimeout(() => setCanRenderGrainient(true), 900);

    return () => {
      if (idleWindow.cancelIdleCallback && typeof handle === "number") {
        idleWindow.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle);
      }
    };
  }, []);

  return (
    <div className="ambient-background ambient-background--grainient" aria-hidden="true">
      {!canRenderGrainient && <span className="grainient-skeleton" />}
      {canRenderGrainient ? (
        <DeferredGrainient
          color1="#ffc1e3"
          color2="#d86cc4"
          color3="#a9d8df"
          timeSpeed={1.35}
          colorBalance={0}
          warpStrength={0.78}
          warpFrequency={4.2}
          warpSpeed={1.8}
          warpAmplitude={32}
          blendAngle={0}
          blendSoftness={0.14}
          rotationAmount={320}
          noiseScale={2}
          grainAmount={0.065}
          grainScale={2}
          grainAnimated={false}
          contrast={1.28}
          gamma={1.03}
          saturation={0.94}
          centerX={0}
          centerY={0}
          zoom={0.86}
        />
      ) : null}
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
