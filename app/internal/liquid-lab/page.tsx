import { GlassCardInteractions } from "@/components/landing/glass-card-interactions";
import { CssWaterButton, JellyCanvasButton } from "@/components/landing/jelly-button-lab";

export default function LiquidLabPage() {
  return (
    <main className="liquid-lab-page">
      <GlassCardInteractions />
      <section className="liquid-lab-panel">
        <p className="liquid-lab-eyebrow">Local experiment</p>
        <h1>Liquid button comparison</h1>
        <p>
          Review both routes before production. The CSS version is the current low-risk path. The
          canvas version is a TypeGPU-inspired jelly prototype with spring points and caustic
          highlights, without adding a heavy WebGPU dependency yet.
        </p>
        <div className="liquid-lab-grid">
          <article>
            <h2>Production-safe CSS/DOM</h2>
            <p>Uses the current water skin, DOM ripples, and mobile fallback.</p>
            <CssWaterButton />
          </article>
          <article>
            <h2>Canvas jelly prototype</h2>
            <p>Uses a local canvas spring surface inspired by the TypeGPU jelly slider behavior.</p>
            <JellyCanvasButton />
          </article>
        </div>
      </section>
    </main>
  );
}
