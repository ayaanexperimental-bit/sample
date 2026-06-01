# YW NutriTech Animated Loader Blueprint

This is the implementation blueprint for the reusable YW NutriTech animated loader across the YW Coach platform.

## Source Of Truth

Priority order:

1. Uploaded reference image: `C:\Users\Yours Wellness\Downloads\ChatGPT Image May 29, 2026, 10_33_07 PM.png`
2. Official logo asset: `public/images/yw-nutritech-logo.png`
3. Motion references only for technique and motion language. Do not copy external layouts, branding, or visual compositions.

Important reference note:

- The uploaded reference file is RGB and does not contain an alpha channel. The visible checkerboard is baked into the preview image.
- The production loader must rebuild the composition with a real transparent background.
- The checkerboard must never be exported or rendered in the site.

## Visual Target

The final loader should feel like the reference image came to life:

- centered glass circular badge
- official YW NutriTech logo centered inside the badge
- translucent orbital rings around the badge
- multiple blue/cyan electron spheres moving on different orbital paths
- one lighter/white sphere for visual contrast
- soft cyan/blue glow around the orbit area
- subtle soft shadow under the atom composition
- premium health-tech aesthetic
- transparent background
- no skeleton baked into the loader asset
- no "Powered by YW NutriTech" text inside the loader

## Current Code Gap

Current implementation:

- `components/brand/yw-brand-loader.tsx` combines the centered brand loader and page skeleton in one component.
- `app/globals.css` contains both loader animation and skeleton styling under `.yw-loader`.
- Route loading files call `YWBrandLoader` directly.

Required future structure:

- transparent reusable loader component
- separate page skeleton components
- overlay wrapper that composes skeleton background + transparent loader foreground

## Recommended Technical Approach

Use SVG + CSS animation as the first implementation.

Reasons:

- preserves transparency
- scales crisply across devices
- no new animation dependency required
- good performance when animating transform and opacity
- layer control is enough for this atom/orbit design
- easier reduced-motion fallback than video

Avoid GSAP for v1 unless CSS/SVG cannot achieve the desired motion. Avoid Lottie/Rive unless design handoff requires timeline tooling. Avoid WebM unless vector animation fails.

## Proposed File Structure

```txt
public/assets/loader/
  yw-loader-fallback.png
  yw-loader-fallback.webp

components/loaders/YWLoader/
  YWAtomLoader.tsx
  YWLoaderOverlay.tsx
  YWAtomLoader.module.css
  index.ts

components/loaders/PageSkeletons/
  GuestPageSkeleton.tsx
  PaidPageSkeleton.tsx
  SuccessPageSkeleton.tsx
  ProfilePageSkeleton.tsx
  PageSkeletons.module.css
  index.ts
```

## Component Responsibilities

### `YWAtomLoader`

Transparent animated asset only.

Responsibilities:

- render the center badge, logo, rings, electrons, glow, particles, and shadow
- no full-screen background
- no skeleton
- no powered-by text
- no page-specific logic
- accepts size and accessibility label

Suggested API:

```ts
type YWAtomLoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};
```

### `YWLoaderOverlay`

Page loading composition wrapper.

Responsibilities:

- render a page-specific skeleton in the background
- place `YWAtomLoader` centered above it
- provide the full-screen loading surface
- control overlay fade-in/fade-out if needed

Suggested API:

```ts
type YWLoaderOverlayProps = {
  variant: "guest" | "paid" | "success" | "profile";
  label?: string;
};
```

### Page Skeletons

Skeletons stay separate from the loader asset.

Responsibilities:

- match broad page structure only
- remain soft, subtle, and secondary
- avoid visible real content
- avoid pushing page content after load
- adapt to guest, paid, success, and profile layouts

## SVG Layer Plan

Use one SVG viewport for the transparent animated composition, for example `viewBox="0 0 720 420"`.

Layer order from back to front:

1. Back cyan aura glow
2. Soft floor shadow
3. Rear/vertical orbit ring
4. Secondary tilted orbit ring
5. Center circular badge outer rim
6. Center glass disc
7. Official logo image layer
8. Rear electron spheres
9. Front orbit ring
10. Front electron spheres
11. Small sparkle/aura particles

The official logo should be inserted as the existing asset without recoloring or distortion. It can be placed inside the SVG using an `<image>` element or as a normal absolutely positioned `<Image>` over the SVG badge, depending on which gives the sharpest rendering.

## Visual Construction Details

### Center Badge

- circular disc around 180-220 px inside the SVG viewport
- white/glass fill using radial gradient
- subtle inner highlight
- thin blue rim with partial opacity
- light drop shadow and inner glow
- tiny breathing scale motion

### Logo Layer

- use `public/images/yw-nutritech-logo.png`
- preserve aspect ratio
- no recoloring
- no distortion
- centered visually, not mathematically if optical alignment needs slight adjustment
- keep inside badge with safe padding

### Orbit Rings

Use SVG ellipses with:

- transparent fill
- blue/cyan stroke gradients
- low opacity glass strokes
- blur/glow duplicate strokes behind sharper strokes
- different tilt transforms
- different stroke widths
- front and rear segments can be separated if layering needs one ring to pass behind the badge and another to pass in front

Recommended rings:

- wide diagonal ring: major visual ring from lower-left to upper-right
- secondary horizontal ring: flatter ring crossing the badge
- vertical/rear ring: taller ring behind badge

### Electron Spheres

Build each electron as a mini SVG group:

- radial gradient fill
- blue/cyan core
- white specular highlight
- outer glow
- optional tiny cast shadow

Recommended spheres:

- large blue sphere near lower-left path
- medium blue sphere near upper-right path
- small blue sphere near lower-right path
- cyan sphere near left path
- white/glass sphere near bottom-right path

## Motion Blueprint

### Badge Motion

- subtle float/breathing
- duration: 2600-3400ms
- scale range: 0.985 to 1.015
- translateY range: -2px to 2px
- easing: ease-in-out

### Rings

- use transform rotations on grouped ellipses
- durations should differ so motion feels organic
- wide/front ring: 7-9s linear
- secondary ring: 10-13s linear reverse
- vertical/rear ring: 12-16s linear
- opacity pulse should be very subtle

### Electrons

Preferred implementation:

- each electron is wrapped in a ring-sized absolute/SVG group
- rotate the group continuously
- counter-rotate the sphere so the highlight remains believable
- use z-index/layer duplication to fake front/back depth

Alternative:

- use SVG `<animateMotion>` paths for exact elliptical tracks if CSS ring rotation does not match the reference closely enough.

Motion rules:

- electrons should not all move at the same speed
- avoid synchronized loops
- keep speeds slow enough to feel premium
- no sharp jumps at loop boundaries
- maintain 3D illusion by changing opacity/scale when crossing rear sections

### Glow And Shadow

- glow pulses slowly at 3-5s
- floor shadow subtly breathes with badge movement
- animate opacity and transform only where possible

### Reduced Motion

For `prefers-reduced-motion: reduce`:

- stop continuous orbit rotation
- keep static layered composition visible
- allow only a very subtle opacity/scale pulse, or disable all motion entirely
- do not show flashing particles

## CSS Architecture

Use CSS module classes for loader internals to avoid global selector bloat.

Core classes:

```txt
.atom
.svg
.aura
.shadow
.badgeGroup
.logo
.ring
.ringWide
.ringSecondary
.ringVertical
.electron
.electronBlueLarge
.electronBlueMedium
.electronCyan
.electronWhite
.spark
```

Use CSS custom properties for sizing:

```css
--loader-size
--loader-glow
--loader-blue
--loader-cyan
--loader-ring
```

## Integration Plan

Replace current direct loader usage:

```tsx
<YWBrandLoader label="Loading coach guest page" variant="guest" />
```

with:

```tsx
<YWLoaderOverlay label="Loading coach guest page" variant="guest" />
```

Route files to update:

- `app/loading.tsx`
- `app/gyana/loading.tsx`
- `app/gyana/pcos-51/loading.tsx`
- `app/gyana/pcos-51/success/loading.tsx`

Keep the current loader available during development until the new one passes visual QA. Remove or deprecate it only after final verification.

## Fallback Asset Plan

Create fallback transparent PNG/WebP from the final static SVG state.

Rules:

- transparent background
- no checkerboard
- no skeleton
- no powered-by text
- same centered composition
- used only if animation is disabled or fails

Recommended output:

```txt
public/assets/loader/yw-loader-fallback.webp
public/assets/loader/yw-loader-fallback.png
```

## QA And Acceptance Tests

Required checks before production:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:pages`
- route checks using `pnpm check:links`
- visual checks on mobile, tablet, desktop, and large screen
- loader remains centered on all viewports
- no horizontal scroll
- transparent loader asset has no skeleton baked in
- no "Powered by YW NutriTech" text inside loader
- official logo is not stretched or recolored
- reduced-motion behavior works
- guest, paid, and success loading routes use the same loader identity
- page-specific skeletons remain separate and subtle
- first viewport hero rule still passes after loading completes

## Implementation Sequence

1. Create `YWAtomLoader` SVG/CSS component.
2. Add the transparent fallback asset from the static SVG state.
3. Create page skeleton components.
4. Create `YWLoaderOverlay`.
5. Swap route loading files to use `YWLoaderOverlay`.
6. Verify local render and animation.
7. Capture screenshots/video of loader on mobile, tablet, desktop, and large.
8. Run build, lint, type, route, and funnel isolation checks.
9. Deploy only after all checks pass.

## Final Acceptance Criteria

The loader is ready only when:

- it visually matches the reference image closely
- it has true transparent background
- the official logo remains centered and untouched
- orbit rings rotate smoothly
- electron spheres move continuously around the logo
- motion feels premium, 3D-inspired, and calm
- no skeleton is inside the asset
- wrapper can place it over any page-specific skeleton
- it performs well on mobile
- it supports reduced motion
- it does not delay page content artificially
- it works across guest, paid, payment, success, and profile page loading states
