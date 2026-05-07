# Site Teardown: Awwwards Homepage

**URL:** https://www.awwwards.com/
**Date analyzed:** 2026-05-07
**Method:** Playwright render at 390x844 and 1440x1000, plus DOM/style inspection.

## Notes on Use

This teardown is for inspiration and implementation direction only. The production site should use original code, original visuals, and the Heal Your Hormones visual language. Do not copy proprietary Awwwards CSS, JavaScript, images, or class structures into this project.

## Confirmed Surface

| Area | Observation | Project Takeaway |
|---|---|---|
| Header | Compact fixed navigation, pale background, clear search/action grouping. | Keep the HYH header compact and glassy, with less vertical layout shift. |
| Hero | Large editorial headline with metadata row above. | Use stronger typographic hierarchy while keeping wellness copy warmer than Awwwards. |
| Featured media | Image surface is framed by whitespace and grid lines. | Give hero/media cards stable skeletons and subtle grid structure before assets hydrate. |
| Cards | Nominee/winner cards use repeated, scannable blocks. | Improve below-fold rendering with content visibility and consistent glass-card dimensions. |
| Loading feel | Visual placeholders appear where media-heavy content is still resolving. | Add route skeleton, image placeholder, and CSS fallback before WebGL background mounts. |

## Design System Signals

| Role | Awwwards Signal | HYH Adaptation |
|---|---|---|
| Background | Light neutral page with editorial contrast. | Soft rose/aqua base with visible but non-harsh Grainient fallback. |
| Typography | Condensed sans, oversized uppercase headlines. | Preserve feminine serif display, add tighter responsive scale so mobile does not clip. |
| Motion | Media hover/reveal and subtle scroll rhythm. | Keep water ripple, but hydrate it progressively so first load stays fast. |
| Layout | Dense metadata and card rows. | Use content-visibility for below-fold sections and stable skeletons for first meaningful paint. |

## Implemented From This Teardown

1. Progressive WebGL background hydration, with CSS skeleton/fallback visible immediately.
2. Route-level skeleton for slow navigations or suspended chunks.
3. Hero image blur placeholder and responsive `sizes`.
4. Deferred button water-layer hydration so the DOM is not inflated before interaction.
5. Mobile hero sizing and container width adjustments for better responsiveness.

## Remaining Ideas

1. Add an editorial metadata row above key sections if the page needs more Awwwards-style rhythm.
2. Add media-card hover captions for testimonials/outcomes if future sections become more visual.
3. Consider replacing WebGL background on low-end mobile with CSS-only Grainient permanently if field performance is still poor.
4. Avoid broad `content-visibility` on this landing page because the sticky CTA smooth-scroll target depends on stable section heights.
