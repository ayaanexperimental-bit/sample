import Grainient from "@/components/react-bits/grainient/grainient";

export function AmbientBackground() {
  return (
    <div className="ambient-background ambient-background--aqua-mesh" aria-hidden="true">
      <span className="ambient-background__field" />
      <Grainient
        className="ambient-background__webgl"
        timeSpeed={1.36}
        colorBalance={-0.08}
        warpStrength={1.46}
        warpFrequency={5.8}
        warpSpeed={2.35}
        warpAmplitude={22}
        blendAngle={28}
        blendSoftness={0.14}
        rotationAmount={520}
        noiseScale={1.9}
        grainAmount={0.045}
        grainScale={2.2}
        grainAnimated={false}
        contrast={1.22}
        gamma={1.02}
        saturation={1.28}
        centerX={0.02}
        centerY={-0.04}
        zoom={0.88}
        color1="#ffb5df"
        color2="#70eadf"
        color3="#fff0a6"
      />
      <span className="ambient-background__readability-veil" />
    </div>
  );
}
