# Template Skins Preview and Production Match Report

Implemented:
- React preview renderer and static public route both resolve skin through `getCoachTemplateTheme()`.
- Both now use `getTemplateBackgroundConfig()`.
- Both emit matching skin/background data attributes.
- Both use the same selected `selectedThemeId`.
- Both keep the same CSS variable serialization.

Verified by source:
- `components/coach/public-coach-site-page.tsx`
- `functions/coach/[slug].ts`
- `public/coach-circle-template.css`

Expected parity:
- same content
- same selected skin
- same background type
- same CTA behavior
- same FAQ behavior
- same bonus section
- same sticky CTA

Remaining risk:
- Final deployed visual comparison screenshots are still pending.
