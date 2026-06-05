"use client";

import { useEffect, useState } from "react";
import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const desktopMotionQuery = window.matchMedia(
      "(min-width: 1280px) and (prefers-reduced-motion: no-preference)"
    );

    const syncWebglReadiness = () => {
      setWebglReady(desktopMotionQuery.matches && !navigator.webdriver);
    };

    syncWebglReadiness();
    desktopMotionQuery.addEventListener("change", syncWebglReadiness);

    return () => desktopMotionQuery.removeEventListener("change", syncWebglReadiness);
  }, []);

  return (
    <div
      className={`ambient-background ambient-background--grainient ${
        webglReady ? "ambient-background--webgl-ready" : "ambient-background--css-only"
      }`}
      aria-hidden="true"
    >
      {webglReady ? (
        <Grainient
          className="ambient-background__webgl"
          color1="#f59ab8"
          color2="#ffe88f"
          color3="#b7d99c"
          timeSpeed={1.2}
          colorBalance={0}
          warpStrength={1.14}
          warpFrequency={5}
          warpSpeed={2.65}
          warpAmplitude={44}
          blendAngle={8}
          blendSoftness={0.05}
          rotationAmount={620}
          noiseScale={2}
          grainAmount={0.08}
          grainScale={2}
          grainAnimated={false}
          contrast={1.62}
          gamma={1}
          saturation={1.16}
          centerX={0}
          centerY={0}
          zoom={0.9}
          frameRate={14}
          lowPowerFrameRate={6}
        />
      ) : null}
    </div>
  );
}
