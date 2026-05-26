import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--aqua-mesh" aria-hidden="true">
      <span className="ambient-background__field" />
      <span className="ambient-background__flow" />
      <span className="ambient-background__counterflow" />
      <Grainient
        className="ambient-background__webgl"
        timeSpeed={2.55}
        colorBalance={0.02}
        warpStrength={1.32}
        warpFrequency={4.6}
        warpSpeed={1.28}
        warpAmplitude={19}
        blendAngle={18}
        blendSoftness={0.11}
        rotationAmount={390}
        noiseScale={2.05}
        grainAmount={0.024}
        grainScale={2}
        grainAnimated
        contrast={1.28}
        gamma={1}
        saturation={1.42}
        centerX={0}
        centerY={-0.01}
        zoom={0.92}
        color1="#f5a7bd"
        color2="#ffe78f"
        color3="#b8d89a"
        frameRate={28}
        lowPowerFrameRate={18}
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
