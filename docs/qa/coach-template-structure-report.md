# Coach Template Structure Report

Architecture:
- One canonical functional renderer.
- One shared content-slot model.
- One shared CTA/legal/support/analytics/FAQ/bonus behavior.
- Many presentation-only skins.

Core files:
- `lib/coach-template-themes.ts`: skin registry, contracts, readiness, background registry, validation.
- `components/coach/public-coach-site-page.tsx`: shared React renderer and background layer.
- `functions/coach/[slug].ts`: shared static public renderer.
- `public/coach-circle-template.css`: scoped skin presentation and non-clone composition layer.

Skin contracts:
- Each skin has public name, status, design story, skin design contract, tokens, layout variants, background config, motion config, readiness metadata, preview thumbnail, and visual difference evidence.

Shared sections:
- navbar
- hero
- coach media/story
- problem/audience
- coach promise
- benefits/results
- journey/how-it-works
- universal bonuses
- fit check
- FAQ
- final CTA
- legal/support footer

Test data requested by source:
- Gyana PCOS/hormone
- Ayaan fat-loss
- Priya gut
- Neha sleep
- Rohan fitness
- Meera general wellness
- long-name coach
- minimal-data coach

Implementation note:
- Test data gallery route was not added in this pass to avoid exposing an unprotected dev route. Registry metadata and docs serve as the internal catalog until a protected internal gallery is approved.
