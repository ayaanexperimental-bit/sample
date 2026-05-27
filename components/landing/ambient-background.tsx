"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Grainient = dynamic(() => import("@/components/Grainient"), {
  ssr: false
});

export function AmbientBackground() {
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const syncMotionPreference = () => setMotionEnabled(media.matches);

    syncMotionPreference();
    media.addEventListener("change", syncMotionPreference);

    return () => media.removeEventListener("change", syncMotionPreference);
  }, []);

  return (
    <div className="levelup-sakura-grainient" aria-hidden="true">
      <div className="levelup-sakura-grainient__css" />
      {motionEnabled ? (
        <Grainient
          className="levelup-sakura-grainient__webgl"
          color1="#f5a7bd"
          color2="#ffe78f"
          color3="#b8d89a"
          timeSpeed={1.06}
          warpStrength={1.34}
          warpFrequency={4.9}
          warpSpeed={2.65}
          warpAmplitude={48}
          blendAngle={-18}
          blendSoftness={0.18}
          rotationAmount={220}
          noiseScale={1.7}
          grainAmount={0.036}
          grainScale={1.8}
          grainAnimated
          contrast={1.26}
          gamma={1}
          saturation={1.56}
          zoom={0.76}
        />
      ) : null}
      <div className="levelup-sakura-grainient__veil" />
    </div>
  );
}
