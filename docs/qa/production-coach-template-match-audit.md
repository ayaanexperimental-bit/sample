# Production Coach Template Match Audit

## Test Metadata

- Test date/time: 2026-06-05 IST
- Production URL tested: https://ywcoach.com
- Scope: live production coach referral template behavior and source-of-truth alignment.
- Admin login state: existing authenticated production Browser session; no OTP exposed or recorded.

## Summary

- Active production coach-site records checked: 1
- Active production coach-site records in D1: 1
- Real production referral pages using the final YW Nutritech template: 1
- Pages showing old template during normal flow: 0 found in this audit
- Pages showing Contact Support during normal successful referral flow: 0 found in this audit
- Current selected production theme for Gyana: `premium-feminine-wellness`

## Site Result

| Coach | Public URL | Source | Status | Theme | Register Link | Normal Support Card | Result |
|---|---|---|---|---|---|---|---|
| Gyana Ranjan | `/coach/gyana-ranjan` | D1 `coach_sites` | Published | `premium-feminine-wellness` | Configured Google Form | Hidden, as required | Pass |

## Gyana Route Evidence

Route tested: `https://ywcoach.com/coach/gyana-ranjan`

- Page title: `Gyana Ranjan | YW Nutritech Coach Referral`
- Coach name visible: Yes
- YW Nutritech branding visible: Yes
- PMOS wording visible: Yes
- PCOS wording on checked public page: No
- Coach photo loaded: Yes, `/images/coach-gyana-ranjan.png`
- Contact Support fallback visible during normal page load: No
- Visible Register CTAs: all point to `https://forms.gle/nsY5F1mcjZnZBbVo9`

## Template Source Trace

Current renderer setup:

- Builder/admin React preview: `components/coach/public-coach-site-page.tsx` is used for the reusable public preview flow.
- Public Cloudflare Pages route: `functions/coach/[slug].ts` renders server-side HTML/CSS for `/coach/[slug]`.
- Theme source: `lib/coach-template-themes.ts`
- Site source: production D1 `coach_sites`
- Public lookup/storage: `lib/server/coach-site-storage.ts`

The public route and React preview are still separate renderers, but this audit did not find an active production visual mismatch for Gyana. The duplication remains a maintenance risk: future template changes must be checked in both the React preview and Cloudflare public renderer.

## Corrected Stale Conclusion

Older audit text said Gyana was not in D1 and was only a code-approved/static fallback. That is no longer true.

Current verified state:

- D1 `coach_sites.id`: `coach-site-gyana-ranjan`
- `slug`: `gyana-ranjan`
- `status`: `published`
- `selected_theme_id`: `premium-feminine-wellness`
- `google_form_url`: configured
- `photo_url`: configured
- `video_url`: configured

## Template Checklist

- YW Nutritech brand feel: Pass
- Coach identity: Pass
- Hero/media: Pass
- Coach intro/mission/content: Pass
- Benefits/CTA/FAQ/legal/footer: Pass on checked public route
- Register CTA: Pass
- Hidden fallback support rule: Pass
- Mobile-safe fallback not triggered during normal flow: Pass for checked public route

## Remaining Risks

1. Renderer drift risk remains because public route and preview are separate implementations.
2. Only one real active coach site exists, so multi-coach template universality can be proven fully only after more real coach sites are created.
3. Gyana support/contact fields are empty, so fallback support uses default YW support until coach contact is configured.

## Recommended Regression Checks After Future Template Changes

- Open `/coach/gyana-ranjan`.
- Open builder preview for the same record.
- Compare hero, media, CTA, footer, Register link, theme colors, and hidden support behavior.
- Test 320px, 390px, 768px, 1024px, and desktop.
- Confirm no `YW-ERR-*` or Contact Support fallback appears during normal successful flow.
