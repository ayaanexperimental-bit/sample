# Production Coach Template Match Audit

## Test Metadata

- Test date/time: 2026-06-03 16:30 IST
- Production URL tested: https://ywcoach.com
- Admin login method: Gmail plugin OTP used safely; OTP not exposed.
- Report scope: production coach sites created by Website Builder, plus separate note for Gyana approved production referral.

## Summary

- Production builder-created published coach sites checked: 1
- Builder-created sites matching final approved template: 1
- Builder-created sites using old template: 0
- Builder-created broken public pages: 0
- QA cleanup after test: QA builder-created site was archived and then OTP-removed; current admin status is `removed`.
- Code-approved non-builder production referral pages checked separately: 1
- Selected theme applied correctly on checked builder site: Yes, `default-current`
- Preview route and public route use the same renderer: No, they use separate renderers with matching visual intent.

## Final Approved Template Checklist

Expected sections/signals:

- YW Nutritech branding
- Hero section
- Coach hero media/no-media state
- Coach intro section
- Niche/problem-solution section
- Benefits/cards section
- Register CTA section
- Google Form register button
- Hidden support/contact fallback data, not normal public contact card
- FAQ section
- Legal footer/disclaimer
- Final CTA/footer
- Theme colors/typography
- Mobile/tablet/desktop layout

## Per-Site Results

| Coach / Site | Public URL | Source | Status | Template Used | Theme Applied | Register Result | Contact Support Result | Severity |
|---|---|---|---|---|---|---|---|---|
| QA Test Coach Do Not Use 20260603 QA Audit | `/coach/qa-test-coach-do-not-use-20260603-qa-audit` | Website Builder / D1 | Published during test; OTP-removed after audit | Final while published | Yes, `default-current` | All visible CTAs pointed to configured Google Forms-domain URL while published | Hidden on normal page; fallback details available for error/unavailable states | Cleanup complete; removed record still visible as admin history |
| Gyana Ranjan | `/coach/gyana-ranjan` | Code-approved production referral, not D1 builder record | Published | Final visual system, but content contains older placeholder phrasing | Yes, `default-current` | Missing Google Form link / registration not active | No normal contact support card, consistent with hidden fallback rule | Critical registration/admin-sync issue |

## QA Builder Site Detail

- Coach name changed correctly: Yes.
- Niche changed correctly: Yes.
- Hero/subheadline changed correctly: Yes.
- Hero media type `No Media` rendered without crashing: Yes.
- CTA text changed correctly: Yes.
- Register href saved and rendered: Yes.
- FAQ/content generated and rendered: Yes.
- Public URL used the expected slug: Yes.
- Page used YW Nutritech branding: Yes.
- Page showed final template sections: Yes.
- Page showed Contact Support fallback during normal successful flow: No.
- Public route after archive showed fallback: Yes.
- Same public URL worked again after Restore Site: Yes.
- Final cleanup after verification: archived again, then removed through OTP-protected Remove.

## Gyana Production Referral Note

Gyana `/coach/gyana-ranjan` is a real production referral page. It is not currently a D1 builder-created record, so it is missing from Admin -> Coach Sites. The page visually uses the final YW Nutritech system, but it still has placeholder-style copy and no active Google Form registration link in the production coach record. Admin Error Reports shows repeated `YW-ERR-5001` link-missing reports for Gyana.

This is not an old-template visual failure. It is a production data/source-of-truth failure.

## Template Renderer Root Cause Trace

- Builder preview renderer: `CoachSitePreview` in `components/admin/admin-coach-sites-manager.tsx`.
- Static app route renderer: `PublicCoachSitePage` in `components/coach/public-coach-site-page.tsx`, used by `app/coach/[slug]/page.tsx`.
- Cloudflare production dynamic renderer: separate inline HTML/CSS renderer in `functions/coach/[slug].ts`.
- `selectedThemeId` is saved by builder and read by public route: Yes for QA.
- Theme ignored: No for QA.
- Same renderer: No.
- Risk: High future drift risk because preview and production dynamic public route are separate implementations.

## Sections Matching Final Template

QA builder-created page:

- YW Nutritech branding: Pass
- Hero section: Pass
- Coach identity: Pass
- Coach intro: Pass
- Problem/solution: Pass
- Benefits/cards: Pass
- Register CTA: Pass
- FAQ: Pass
- Legal footer/disclaimer: Pass
- Theme styling: Pass
- Mobile/tablet/desktop: Pass except possible 320px overflow metric risk

Gyana approved page:

- YW Nutritech branding: Pass
- Hero section: Pass
- Coach identity: Pass
- Coach intro: Pass
- Problem/solution: Pass
- Benefits/cards: Pass
- FAQ/footer: Pass
- Register CTA: Fail due missing form link / pending state
- Admin manageability: Fail because not present in D1 Coach Sites list

## Screenshots / Visual Notes

Safe public screenshots saved:

- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\qa-coach-390.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\gyana-referral-1024.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\missing-coach-fallback-390.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\paid-entry-1024.png`

## Recommended Fix Order

1. Import/sync Gyana into the D1 `coach_sites` source of truth or show code-approved production sites in Admin with source labels.
2. Add the real Gyana Google Form registration link through the approved production data path.
3. Fix Pause persistence/public unavailable behavior.
4. Reduce template drift by sharing renderer logic or adding parity tests between preview and Cloudflare public function output.
5. Improve Coach Analytics display to show human coach name plus slug.
6. Add responsive screenshot/overflow regression tests for 320px, 390px, 768px, 1024px.

## Cleanup Result

The QA builder-created published coach site was cleaned up after the audit. It was archived and then removed through the OTP-protected flow. Current product behavior keeps removed records visible in Admin as audit/history rows; add a separate hard-delete/retention cleanup policy if QA rows must disappear from Admin entirely.
