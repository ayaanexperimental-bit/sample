"use client";

import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--grainient" aria-hidden="true">
      <Grainient
        color1="#fdaefa"
        color2="#d040e9"
        color3="#B497CF"
        timeSpeed={2.35}
        colorBalance={0}
        warpStrength={1}
        warpFrequency={5}
        warpSpeed={3.8}
        warpAmplitude={36}
        blendAngle={0}
        blendSoftness={0.05}
        rotationAmount={500}
        noiseScale={2}
        grainAmount={0.1}
        grainScale={2}
        grainAnimated={false}
        contrast={1.85}
        gamma={1}
        saturation={1.22}
        centerX={0}
        centerY={0}
        zoom={0.9}
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
