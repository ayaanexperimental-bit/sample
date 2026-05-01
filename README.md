# PCOS Wellness Landing System

Production landing page and automation system for a PCOS / women's wellness / beauty brand.

## Current Status

Phase 1, Micro-task 1.1: project scaffold only.

No public page, app layout, styling system, landing section, payment route, database integration, or automation logic has been implemented yet.

## Planned Stack

- Next.js App Router
- TypeScript
- Tailwind CSS or equivalent styling system
- PostgreSQL as source of truth
- Hosted Razorpay payment flow
- Google Sheets reporting sink
- Email confirmation automation
- WhatsApp onboarding automation

## Development Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format:check
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill values when the relevant phase needs them.

Do not put secrets in `NEXT_PUBLIC_` variables unless the value is intentionally public.

## Planning Documents

- `phase_0_project_spec.md`
- `phase_0_landing_page_ia.md`
- `phase_0_technical_architecture.md`
- `phase_0_prompt_refinement_module.md`
- `consolidated_landing_page_automation_plan.md`
- `action_items_only.md`
