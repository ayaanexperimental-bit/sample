# Background Layer and React Bits Safety Report

React Bits inspected: Yes.

Observed setup:
- React Bits provides component copy/install paths through shadcn and jsrepo commands.
- Background categories include Aurora, Prism, Particles, Grid, Light Rays, and other effects.
- Individual components can carry their own dependencies and CSS needs.

Project compatibility:
- Next.js 16, React 19, TypeScript, pnpm.
- No Tailwind or shadcn project setup was detected.
- The repo already contains one local React Bits-style OGL background component, but it is not wired into production coach skins.

Decision:
- Do not install or import additional React Bits components in this pass.
- Use registry-backed CSS backgrounds with static fallbacks.
- Keep background rendering shared through `TemplateBackgroundLayer`.

Background types supported by registry:
- none
- static-gradient
- mesh-gradient
- aurora
- prism
- spotlight
- light-rays
- particle-field
- grid-glow
- liquid-glass
- noise-texture
- webgl-subtle

Safety controls:
- decorative layers are `aria-hidden`
- pointer-events none
- z-index behind content
- reduced-motion fallback
- mobile opacity/intensity metadata
- performance mode metadata
- preview/public route data attributes now match

Skipped React Bits components:
- Aurora and Prism direct imports skipped because current app lacks shadcn/Tailwind integration and production-safe direct import paths were not established.
- WebGL-heavy effects skipped for production-ready skins to avoid SSR, hydration, and mobile performance risk.
