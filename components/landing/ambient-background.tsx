import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--aqua-mesh" aria-hidden="true">
      <span className="ambient-background__field" />
      <span className="ambient-background__flow" />
      <span className="ambient-background__counterflow" />
      <Grainient
        className="ambient-background__webgl"
        timeSpeed={2.35}
        colorBalance={0.01}
        warpStrength={1.24}
        warpFrequency={4.7}
        warpSpeed={1.18}
        warpAmplitude={22}
        blendAngle={58}
        blendSoftness={0.28}
        rotationAmount={440}
        noiseScale={2.35}
        grainAmount={0.02}
        grainScale={2}
        grainAnimated
        contrast={1.18}
        gamma={1}
        saturation={1.26}
        centerX={0}
        centerY={-0.01}
        zoom={0.92}
        color1="#f5a7bd"
        color2="#ffeeb0"
        color3="#cde9ad"
        frameRate={26}
        lowPowerFrameRate={18}
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
