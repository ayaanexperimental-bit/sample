# WHM101 Landing Page

Production landing page for Women Health Masterclass 101.

## Current Status

Live site is a Cloudflare Pages landing page. Payment processing is handled by Razorpay hosted checkout. Automation and Google Sheets reporting are handled outside the app through Pabbly Connect.

## Active Stack

- Next.js App Router
- TypeScript
- Cloudflare Pages static output
- Hosted Razorpay payment flow
- Pabbly Connect for post-payment automation
- Google Sheets as owner-facing reporting

## Development Scripts

```bash
pnpm dev
pnpm build
pnpm build:pages
pnpm typecheck
pnpm format:check
```

## Environment Setup

Copy `.env.example` to `.env.local` if local overrides are needed.

Do not put secrets in `NEXT_PUBLIC_` variables unless the value is intentionally public.

## Source Of Truth

Use `WHM101_SOURCE_OF_TRUTH_MIGRATION.md`.
