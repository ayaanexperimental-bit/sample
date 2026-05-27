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
          timeSpeed={0.56}
          warpStrength={0.9}
          warpFrequency={4.1}
          warpSpeed={1.68}
          warpAmplitude={50}
          blendAngle={-18}
          blendSoftness={0.18}
          rotationAmount={220}
          noiseScale={1.7}
          grainAmount={0.028}
          grainScale={1.8}
          grainAnimated
          contrast={1.12}
          gamma={1}
          saturation={1.22}
          zoom={0.82}
        />
      ) : null}
      <div className="levelup-sakura-grainient__veil" />
    </div>
  );
}
