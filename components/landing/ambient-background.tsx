import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--aqua-mesh" aria-hidden="true">
      <span className="ambient-background__field" />
      <span className="ambient-background__flow" />
      <span className="ambient-background__counterflow" />
      <Grainient
        className="ambient-background__webgl"
        timeSpeed={2.18}
        colorBalance={0.06}
        warpStrength={1.05}
        warpFrequency={4.15}
        warpSpeed={1.08}
        warpAmplitude={24}
        blendAngle={24}
        blendSoftness={0.14}
        rotationAmount={320}
        noiseScale={1.7}
        grainAmount={0.018}
        grainScale={2}
        grainAnimated
        contrast={1.2}
        gamma={1}
        saturation={1.32}
        centerX={0}
        centerY={-0.01}
        zoom={0.92}
        color1="#f5a7bd"
        color2="#ffe78f"
        color3="#b8d89a"
        frameRate={26}
        lowPowerFrameRate={16}
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
