# YW Coach Platform

Multi-coach funnel platform for `ywcoach.com`.

## Current Scope

- Root `https://ywcoach.com/` redirects to `https://yourswellness.in`.
- Coaches use fixed `/go/...` links as the only public entry point.
- Gyana guest funnel: `/go/gyana-guest` -> `/gyana`.
- Gyana paid funnel: `/go/gyana-pcos-51` -> `/gyana/pcos-51`.
- Gyana paid success page: `/gyana/pcos-51/success`.
- Direct URL tinkering is blocked by Cloudflare Pages middleware.

## Source Of Truth

- Platform funnel/access rules: `C:\Users\Yours Wellness\Desktop\PLAN COACHES.md`
- Universal guest page design system: `C:\Users\Yours Wellness\Desktop\INSTR.MD`
- Repo copy of the guest page rules: `docs/guest-page-design-system.md`
- Coach data collection format: `docs/coach-guest-input-template.md`
- Official YW NutriTech logo asset: `public/images/yw-nutritech-logo.png`

Before generating a new coach guest page, collect the coach data described in `docs/coach-guest-input-template.md`. If fields are missing, create a safe niche-based first draft and leave it easy to micro-edit.

## Non-Negotiable Readiness Gate

No coach guest page, paid program page, payment page, success page, loader, footer, CTA, form, or animation is production-ready until it passes:

- build checks
- lint/type checks where available
- route checks
- funnel isolation checks
- multi-device visual checks on mobile, tablet, desktop, and large screen

Before completion, verify layout stability, readable text, tappable buttons, unstretched images/logos, centered premium loader, smooth reduced-motion-friendly animations, visible CTA, proper footer/legal sections, no horizontal scrolling, and coach-specific funnel isolation on every tested viewport.

The first viewport must show the hero immediately on mobile, tablet, desktop, and large screen. The main hook, coach identity, and primary CTA must not be pushed too far down by spacing, banners, loader behavior, or oversized visuals.

## Active Stack

- Next.js App Router
- TypeScript
- Cloudflare Pages static output
- Cloudflare Pages Functions for funnel sessions and route isolation
- Hosted Razorpay payment flow
- Pabbly Connect / Google Sheets outside the app

## Development Scripts

```bash
pnpm dev
pnpm build
pnpm build:pages
pnpm typecheck
pnpm lint
pnpm format:check
```

## Environment Setup

Copy `.env.example` to `.env.local` if local overrides are needed.

Required Cloudflare secret before preview/production. This must be a separate random value used only for funnel access cookies:

```txt
FUNNEL_ACCESS_SECRET
```

Payment redirect currently uses a server-only signing secret for the temporary Razorpay attempt ID:

```txt
RAZORPAY_KEY_SECRET
SUCCESS_ACCESS_SECRET
```

WhatsApp access is scoped by the active paid funnel session, not by payment webhook verification in v1.
Private WhatsApp/group invite URLs must stay server-only. For the current Gyana paid funnel, set this in Cloudflare as a secret or encrypted variable before production deploy:

```txt
WHATSAPP_GROUP_URL_GYANA_PCOS_51
```

For future scale, use `YW_PRIVATE_FUNNEL_LINKS_JSON` as a server-only JSON map keyed by funnel id.
Do not put secrets in `NEXT_PUBLIC_` variables unless the value is intentionally public.
Do not reuse Razorpay secrets for funnel access.
