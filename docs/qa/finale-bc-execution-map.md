# FINALE BC Execution Map

Source of truth: `C:\Users\Yours Wellness\Desktop\FINALE BC.md`

Scope: normal coach-site template skins only.

Protected areas not touched:
- paid masterclass pages and funnels
- PCOS51 funnel
- payment, callback, success, WhatsApp, and Shop checkout logic
- admin authentication, roles, and security logic
- public slug and route behavior
- Google Form CTA destination logic
- Contact Support behavior
- legal link and Back to Landing Page behavior
- analytics business logic
- bonus service names and FAQ answer source

Implementation phases:
1. Default canonical freeze: documented in `docs/qa/default-canonical-template-freeze-report.md`.
2. Skin infrastructure: implemented in `lib/coach-template-themes.ts`.
3. Background system: registry-backed config plus shared `TemplateBackgroundLayer`.
4. Visual differentiation: scoped non-clone CSS layer in `public/coach-circle-template.css`.
5. Selector gating: Admin and Shop selectors read production-ready registry helpers.
6. Inspect compatibility: inspect data attributes remain canonical; motion freezes while inspect is active.
7. Validation: `pnpm validate:coach-skins` runs readiness and anti-clone gate.
8. Regression: lint, typecheck, admin-security tests, and static build are the release gate.

Release status: pending final full build/test/deploy run for this session.
