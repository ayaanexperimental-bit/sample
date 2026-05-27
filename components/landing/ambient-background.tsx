import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--grainient" aria-hidden="true">
      <Grainient
        className="ambient-background__webgl"
        color1="#f59ab8"
        color2="#ffe88f"
        color3="#b7d99c"
        timeSpeed={0.7}
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
      />
    </div>
  );
}
