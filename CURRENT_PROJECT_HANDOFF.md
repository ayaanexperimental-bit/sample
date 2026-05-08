# WHM101 Current Project Handoff

Use this file as the source-of-truth handoff when starting a new Codex chat.

## Project

- Workspace: `C:\Users\Yours Wellness\Documents\Codex`
- Live domain: `https://freedomfromdiabetes.in`
- Latest Cloudflare preview deployment: `https://a27d298d.freedomfromdiabetes.pages.dev`
- Product: Heal Your Hormones / Women Health Masterclass 101 landing page
- Current checkout state: Website checkout button is intentionally paused. The old live Razorpay payment-page link was removed from the site button.

## Current Architecture

The current production direction is:

```text
Landing page
-> Razorpay hosted payment page / webhook ecosystem
-> Cloudflare Pages site
-> Cloudflare Worker / backend reliability layer where used
-> Pabbly or automation webhook for sheet update
-> Google Sheets as owner-facing reporting view
```

Important rule:

- Do not reconnect the old Razorpay/Pabbly ecosystem into the new website flow unless explicitly requested.
- Do not add the raw Razorpay payment link back behind the website CTA unless explicitly requested.
- Preserve all routing, API routes, legal pages, success page, and existing automation assumptions.

## Latest Security Fix

- `/success` no longer displays a public payment-success or thank-you confirmation when accessed directly.
- Direct visits now show a verification-required state with `noindex, nofollow` metadata.
- No Razorpay/payment links were reconnected.
- A real future success state still needs backend payment verification before showing confirmation content.

## Latest UI Work Completed

The previous session continued from a dirty worktree and preserved partial work.

Completed fixes:

- Header hover no longer shifts or jitters.
- Old liquid-scroll header feature remains removed.
- Button/CTA click no longer causes huge expansion.
- Ripple is clipped inside CTAs/buttons.
- Sticky `Register Now`, hero CTAs, and `Registration Paused` keep stable dimensions.
- Card hover sideways slide is locked off.
- Faint moving shine line under cards is disabled.
- Registration section keeps a liquid-glass panel separation.
- Hero detail dots keep subtle pulse animation.
- Grainient background remains part of the visual system.

Verification completed:

```bash
pnpm lint
pnpm build:pages
```

Both passed.

Playwright-style checks confirmed:

- Header geometry stayed stable on hover.
- Sticky CTA dimensions stayed stable during click.
- Pricing button dimensions stayed stable during click.
- FAQ and method cards kept `transform: none`.
- Ripple elements were created inside CTAs.

Latest deployed preview:

```text
https://34f82ac9.freedomfromdiabetes.pages.dev
```

## Known Worktree State

The repository is intentionally dirty. Do not blindly revert.

Known modified/deleted/new files from the last inspection included:

```text
M app/globals.css
M app/page.tsx
M components/landing/ambient-background.tsx
M components/landing/checkout-button.tsx
M components/landing/hero.tsx
D components/landing/liquid-progress-layer.tsx
D components/landing/scroll-liquid-course-panel.tsx
M components/landing/sticky-offer-bar.tsx
D components/landing/use-scroll-liquid-progress.ts
M components/react-bits/grainient/grainient.tsx
M components/ui/button.tsx
M eslint.config.mjs
M lib/workshop-schedule.ts
M next-env.d.ts
M package.json
M pnpm-lock.yaml
?? components.json
?? components/landing/glass-card-interactions.tsx
?? components/ui/card.tsx
?? components/ui/progress.tsx
?? lib/utils.ts
?? tmp-ui-check-mobile-after.png
?? tmp-ui-check-mobile-final.png
?? tmp-ui-check-mobile.png
```

Before any new work:

```bash
git status --short
```

Then inspect the relevant files before editing.

## Current UI Direction

Design target:

- Premium women-focused wellness UI
- Liquid glass / glassmorphism panels
- Feminine, professional, credible, not childish
- Grainient background visible but not overpowering
- Stable cards and CTA geometry
- Ripple effect integrated with CTAs/buttons only
- No unstable hover movement
- No large layout shifts

Avoid:

- Reintroducing header liquid scroll progress
- Huge button expansion on click
- Cards sliding sideways on hover
- Overly heavy neon/gaming effects
- Breaking mobile layout or sticky offer bar

## Immediate Next Steps In New Chat

1. Start by reading this file.
2. Run:

```bash
git status --short
```

3. Inspect:

```text
app/globals.css
components/landing/glass-card-interactions.tsx
components/ui/button.tsx
components/landing/sticky-offer-bar.tsx
components/landing/checkout-button.tsx
components/landing/hero.tsx
```

4. If continuing UI polish:

- Improve visual quality without moving card positions.
- Keep transforms locked unless very carefully scoped.
- Use clipped ripple only on actual buttons/CTAs.
- Test mobile and desktop screenshots.

5. If deploying:

```bash
pnpm lint
pnpm build:pages
pnpm exec wrangler pages deploy out --project-name freedomfromdiabetes --branch main
```

## User-Side Pending Items

- Decide when website checkout should be unpaused.
- Confirm final payment system URL only when ready.
- Confirm whether registration should remain paused while UI work continues.
- Continue monitoring Google Sheet/Pabbly/Razorpay captures separately from website UI.

## Chat Migration Instruction

Paste this in the next Codex chat:

```text
Continue this project from C:\Users\Yours Wellness\Documents\Codex.
First read CURRENT_PROJECT_HANDOFF.md.
Then inspect git status and modified files.
Preserve all partial work.
Do not rebuild from scratch.
Do not reconnect any old payment links unless explicitly requested.
Continue safely from the current implementation.
```
