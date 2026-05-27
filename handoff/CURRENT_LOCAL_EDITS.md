# Current Local Edits Handoff

Date: 2026-05-27  
Workspace: `C:\Users\Yours Wellness\Documents\Codex`  
Local preview URL: `http://127.0.0.1:3001/`  
Production URL: `https://freedomfromdiabetes.in/`

## Purpose

This handoff captures the exact local edits that are ready to be transferred to production after approval. Do not reinterpret, redesign, or rebuild these changes. Treat this file as the implementation contract.

## Current Local Changes

Only these production files are intentionally changed:

- `app/globals.css`
- `components/landing/ambient-background.tsx`
- `components/landing/glass-card-interactions.tsx`
- `components/landing/levelup-clone.tsx`

Do not include `.codex-artifacts/` in production commits. It contains visual QA screenshots only.

## Background Source Of Truth

The background source of truth is now:

`components/landing/ambient-background.tsx`

It renders the React Bits `Grainient` component from:

`components/react-bits/grainient/grainient.tsx`

Dependency:

`ogl` is already installed in `package.json`.

Current approved Grainient palette and motion props:

```tsx
<Grainient
  className="ambient-background__webgl"
  color1="#f59ab8"
  color2="#ffe88f"
  color3="#b7d99c"
  timeSpeed={0.42}
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
```

Future edits:

- If the user asks to change only the background color, change only `color1`, `color2`, and `color3`.
- If the user asks to make movement stronger or softer, change only Grainient numeric props in `ambient-background.tsx`.
- Do not recreate CSS gradient layers.
- Do not add `.levelup-local-grainient` again.
- Do not replace React Bits `Grainient` with a custom implementation.

## Liquid Glass CTA Source Of Truth

All registration CTAs in `components/landing/levelup-clone.tsx` must remain anchors pointing to checkout:

```tsx
href="#registration"
data-registration-cta="true"
data-ripple="liquid"
aria-controls="registration"
```

Do not change CTA text, routing, form behavior, payment behavior, or checkout section ID while transferring these edits.

The liquid CTA visuals are controlled in `app/globals.css` using:

- `.levelup-cta[data-ripple="liquid"]`
- `.levelup-order-button[data-ripple="liquid"]`
- `.liquid-button-pool`
- `.liquid-water-ripple`

The existing interaction layer is:

`components/landing/glass-card-interactions.tsx`

Important behavior added locally:

- Visible liquid controls hydrate on initial idle.
- Visible liquid controls hydrate again while scrolling.
- This is required so checkout buttons below the fold get the liquid surface when they enter view.

## Hard Guardrails

Do not improvise these areas:

- Do not redesign the page.
- Do not change layout, typography, spacing, pricing, copy, form fields, checkout behavior, FAQ behavior, video, testimonial carousel, sticky CTA logic, or payment logic.
- Do not remove desktop features from mobile.
- Do not alter routes or legal pages.
- Do not add experimental gradient overlays.
- Do not expose dev-only debug panels.
- Do not commit screenshots or temporary QA artifacts.

## Verified Local State

Checks already run locally after these edits:

- `eslint .` passed
- `tsc --noEmit` passed
- `node scripts/build-static.mjs` passed

Browser QA already performed against `http://127.0.0.1:3001/`:

- React Bits Grainient canvas count: `1`
- Old `.levelup-local-grainient` count: `0`
- Mobile visual check passed
- Desktop visual check passed
- Gradient motion check passed
- CTAs with `data-ripple="liquid"`: `8`
- CTAs targeting `#registration`: `8`
- CTA click scrolls to `#registration`
- Checkout liquid pool appears when checkout button enters view

Visual artifacts for review:

- `C:\Users\Yours Wellness\Documents\Codex\.codex-artifacts\sakura-grainient-pop-mobile.png`
- `C:\Users\Yours Wellness\Documents\Codex\.codex-artifacts\sakura-grainient-pop-desktop.png`
- `C:\Users\Yours Wellness\Documents\Codex\.codex-artifacts\local-liquid-cta-mobile-fixed.png`

These artifacts are not part of production.

