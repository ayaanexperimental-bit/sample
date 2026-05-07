# Site Teardown: Levelupforwomen PCOS Landing Page

**URL:** https://training.levelupforwomenn.in/luw
**Date analyzed:** 2026-05-07
**Method:** Playwright rendered mobile viewport plus DOM/style inspection.

## Use Notes

This is an inspiration note only. Do not copy the page's code, payment flow, scripts, assets, or proprietary funnel structure.

## Confirmed Design Signals

| Area | Observed Pattern | HYH Adaptation |
|---|---|---|
| Main headline | `Libre Baskerville`, large editorial serif, mostly black with hot-pink emphasis words. | Use `Libre Baskerville` for hero and section headings, with pink/accent spans. |
| Body and CTA text | `Montserrat` / `DM Sans`, direct conversion-focused sans typography. | Use `Montserrat` for list/body/CTA clarity instead of overly ornate serif body copy. |
| Accent color | Hot pink around `#e91e8c`, deep urgency red, warm cream-pink background. | Keep HYH liquid palette, but make bullets/badges/PCOS accent sharper pink. |
| Micro animations | Pulsing live dots, CTA glow, short transitions around `0.3s`. | Add pulsating audience bullets and short touch glows without resizing cards. |
| Layout style | Centered, high-contrast claim sections with rounded badges and strong urgency bars. | Keep existing structure, but tighten typography hierarchy and badge treatment. |

## Implemented From This Teardown

1. Added `Libre Baskerville` and `Montserrat` to the app font stack.
2. Switched hero/section display headings to an editorial serif closer to the reference.
3. Switched audience/body/CTA surfaces toward cleaner Montserrat conversion copy.
4. Made audience-list dots hot pink and pulsating.
5. Changed mobile card touch feedback to glow/ripple only, with no expansion.
