"use client";

import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--grainient" aria-hidden="true">
      <Grainient
        color1="#ffd7ed"
        color2="#e991d5"
        color3="#cdb9df"
        timeSpeed={1.15}
        colorBalance={0}
        warpStrength={0.62}
        warpFrequency={3.8}
        warpSpeed={1.55}
        warpAmplitude={26}
        blendAngle={0}
        blendSoftness={0.18}
        rotationAmount={260}
        noiseScale={2}
        grainAmount={0.055}
        grainScale={2}
        grainAnimated={false}
        contrast={1.18}
        gamma={1.04}
        saturation={0.82}
        centerX={0}
        centerY={0}
        zoom={0.82}
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
