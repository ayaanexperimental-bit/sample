# Full Production UX Bug Audit

## Test Metadata

- Test date/time: 2026-06-03 16:30 IST
- Production URL tested: https://ywcoach.com
- Admin login method: Gmail plugin OTP used safely; OTP not exposed.
- QA/test coach record used: QA Test Coach Do Not Use 20260603 QA Audit
- QA public URL tested: /coach/qa-test-coach-do-not-use-20260603-qa-audit
- QA cleanup status after audit: moved through Archive, then OTP-protected Remove; current admin status is `removed`.
- Testing mode: real production browser session, authenticated admin session, safe QA-only record creation.
- Safety: no real coach was deleted, no real payment/private WhatsApp link was changed, no OTP/private link/secret was written to this report.
- QA cleanup: the QA-only record was removed after the audit. Current product behavior keeps removed records visible in Admin for audit/history.

## Executive Summary

Production admin login works with Gmail OTP. The Website Creator can create a QA draft, reopen it, generate preview copy, publish it, list it in Coach Sites, and render the public coach page with the final YW Nutritech referral template. Error fallback pages work and log safe records in Admin Error Reports.

The biggest production problems are not build failures. They are source-of-truth and workflow issues:

1. Gyana referral is a real production coach referral page, but it is not in the D1 `coach_sites` table, so Admin -> Coach Sites does not show it.
2. Gyana referral has no active Google Form registration link in the production coach record, causing repeated `YW-ERR-5001` link-missing reports when users click registration.
3. Pause does not produce the expected public unavailable state for the QA coach. It either does not persist or does not affect the public renderer.
4. Preview and public route are visually aligned, but they are not the same component implementation. Preview uses an admin React preview; Cloudflare dynamic public coach pages use a separate inline renderer, creating future drift risk.
5. Coach Analytics includes the newly published QA route and visit count, but it displays coach slug rather than the human coach name and analytics depth is still limited.

## Flows Tested

- Production admin login with email OTP via Gmail plugin.
- Admin dashboard session persistence and logout.
- Admin navigation: Overview, Coach Sites, Create Coach Site, Coach Analytics, Error Reports.
- Website Creator: Step 1 through Step 6.
- Save Draft and Continue Editing.
- Preview generation.
- Publish.
- Coach Sites list sync.
- Public coach URL rendering.
- Register button href verification.
- Coach Analytics sync after page visit.
- Pause behavior.
- Archive, public unavailable fallback, Reactivate/Restore.
- Error fallback and Admin Error Reports logging.
- Paid masterclass public entry and success page, without real payment.
- Mobile/tablet/desktop public coach page responsiveness.

## Passed Checks

- Admin login page opened.
- OTP email was received via Gmail plugin and used safely.
- Admin dashboard opened after OTP.
- Admin session survived reopening `/admin/dashboard`.
- Logout returned to `/admin/login`.
- Save Draft showed `Draft saved successfully.` and `Saved in coach-site database.`
- Draft appeared in Drafts list with coach name, niche, Draft status, last edited time, Continue Editing, Preview, Publish, Delete Draft.
- Continue Editing reopened the same draft and preserved Step 1 and Step 4 data.
- Preview generation worked and opened Preview & Edit.
- Publish showed `Successfully Published` and stable public link.
- Published QA site appeared in Coach Sites.
- Public QA URL opened successfully and did not show Contact Support fallback.
- Public QA page used final YW Nutritech template sections and branding.
- Register CTAs pointed to the configured Google Forms-domain URL.
- Public QA page visit appeared in Coach Analytics as a free/referral route with 1 visit.
- Archive required slug/name confirmation, reason, and OTP.
- Archive moved QA to Archived list and public URL showed unavailable Contact Support fallback with an error code.
- Reactivate required a confirmation dialog and restored the QA site when `Restore Site` was clicked.
- QA cleanup after verification used OTP-protected Remove; the record now stays visible only as `removed` admin history.
- Missing coach route showed clean support fallback with copyable error code and no stack/secrets.
- Admin Error Reports logged the missing-coach fallback in D1.
- Paid entry `/go/gyana-pcos-51` opened the paid page and established the funnel session.
- Paid success page opened after entry-session flow, showed video/WhatsApp text, and did not expose a private WhatsApp group invite in frontend links.

## Failed / Risk Checks

- Gyana referral is not listed in Admin -> Coach Sites because it is code-approved outside D1 builder storage.
- Gyana referral has no configured Google Form registration link in the production coach record.
- Pause did not create a lasting/public unavailable state for the QA coach.
- Coach Analytics displays slug-oriented rows instead of the human coach name for the QA record.
- Public route and preview route are separate renderers, not one shared renderer.
- 320px checks showed scroll-width/client-width mismatch on public and admin views; likely scrollbar-related but should be treated as a mobile overflow risk until CSS is tightened.
- Creator modal can reopen on a stale later step with `No preview ready` instead of starting cleanly at Step 1.
- Direct paid URLs show `Link Not Available` without entry-session cookie; this is expected for route isolation, but admins must only share `/go/gyana-pcos-51`.

## Critical Bugs

### UX-CRIT-001 - Gyana real referral page missing from Coach Sites

- Severity: Critical
- User type affected: Admin
- Flow: Admin -> Coach Sites
- Step failed: Admin expects all real production coach referral sites to appear.
- Expected behavior: Gyana referral `/coach/gyana-ranjan` appears as a managed production coach site.
- Actual behavior: Admin Coach Sites shows D1 builder records only. Gyana does not appear.
- Why bad UX: Admin cannot manage a real production referral site from the place named `All Coach Sites`.
- Root cause: `functions/api/admin/coach-sites/index.ts` reads `listCoachSitesFromDb(env)` only. Gyana is defined in `approvedCoachSites` in `lib/admin-coach-sites.ts`, not synced into D1 `coach_sites`.
- Likely files/functions: `lib/admin-coach-sites.ts`, `lib/server/coach-site-storage.ts`, `functions/api/admin/coach-sites/index.ts`, `components/admin/admin-coach-sites-manager.tsx`.
- Recommended fix: Import/sync Gyana into D1 as a real published coach site record, or show code-approved production sites in Admin with a clear source label and migration action.
- Must fix before production confidence: Yes

### UX-CRIT-002 - Gyana referral registration link missing

- Severity: Critical
- User type affected: Visitor / Admin
- Flow: Public coach referral -> Register CTA
- Step failed: Visitor clicks registration on Gyana referral.
- Expected behavior: Register opens Gyana's Google Form link.
- Actual behavior: Gyana production record has empty `googleFormUrl`; Admin Error Reports contains repeated `YW-ERR-5001` link-missing entries for `/coach/gyana-ranjan`.
- Why bad UX: Real visitors cannot register from a real production referral page.
- Root cause: `approvedCoachSites` entry for Gyana has `googleFormUrl: ""`.
- Likely files/functions: `lib/admin-coach-sites.ts`, `components/coach/public-coach-site-page.tsx`, `functions/coach/[slug].ts`.
- Recommended fix: Add/sync the real Gyana Google Form link through the production data source; prevent publishing/serving production referral pages with missing registration links unless explicitly Draft/Paused.
- Must fix before production confidence: Yes

### UX-CRIT-003 - Pause does not make public page unavailable

- Severity: Critical
- User type affected: Admin / Visitor
- Flow: Coach Sites -> Manage -> Pause -> Public URL
- Step failed: Pause QA coach site.
- Expected behavior: Public URL shows `This coach page is temporarily unavailable.` or support fallback.
- Actual behavior: After Pause, the public QA URL still rendered the normal coach page; after reload the QA row appeared Published again.
- Why bad UX: Admin cannot reliably pause a live coach page.
- Root cause: Pause action did not persist or public renderer does not honor `paused` correctly. D1/status update and public lookup/render behavior need tracing.
- Likely files/functions: `components/admin/admin-coach-sites-manager.tsx`, `functions/api/admin/coach-sites/index.ts`, `lib/server/coach-site-storage.ts`, `functions/coach/[slug].ts`, `components/coach/public-coach-site-page.tsx`.
- Recommended fix: Verify PATCH status update for `paused`; confirm D1 row changes; make public renderer return unavailable fallback for paused records; add regression test.
- Must fix before production confidence: Yes

## High Bugs

### UX-HIGH-001 - Public route and preview route are separate implementations

- Severity: High
- User type affected: Admin / Visitor
- Flow: Website Creator Preview -> Published public route
- Expected behavior: Preview and public page use the same final approved template renderer or a shared source.
- Actual behavior: Admin preview uses `CoachSitePreview` in `components/admin/admin-coach-sites-manager.tsx`; static app route uses `PublicCoachSitePage`; Cloudflare dynamic production route uses a separate inline renderer in `functions/coach/[slug].ts`.
- Why bad UX: Future template edits can update preview but not production, or production but not preview.
- Root cause: Template is duplicated across admin preview React, public React, and Cloudflare Function HTML renderer.
- Recommended fix: Centralize template section data and renderer helpers, or add strict visual/contract tests comparing preview/public output.
- Must fix before production confidence: Yes

### UX-HIGH-002 - Coach Analytics sync is partial

- Severity: High
- User type affected: Admin
- Flow: Publish QA coach -> Visit public page -> Coach Analytics
- Expected behavior: QA coach appears with human name and Free Guest Link analytics.
- Actual behavior: QA route appears, visit count updates to 1, but the table is slug-first and does not show the human coach name clearly.
- Why bad UX: Admin cannot quickly identify coaches in analytics by the names used in Coach Sites.
- Root cause: `components/admin/admin-dashboard-shell.tsx` renders analytics table around `site.slug`/public URL and not a rich coach identity column.
- Recommended fix: Show coach name, slug, funnel type, and status together; preserve zero/empty states for unavailable analytics.
- Must fix before production confidence: Yes

## Medium Bugs

### UX-MED-001 - Creator opens on stale later step

- Severity: Medium
- User type affected: Admin
- Flow: Admin -> Create Coach Site
- Expected behavior: New creator opens at Step 1.
- Actual behavior: The modal opened on Step 6 Publish with `No preview ready` from prior state until Step 1 was manually selected.
- Why bad UX: Admin sees a dead publish state before entering coach details.
- Root cause: Creator step state is not reset when opening a fresh create flow.
- Likely files/functions: `components/admin/admin-coach-sites-manager.tsx`.
- Recommended fix: Reset active wizard step to Step 1 when opening create-new flow; preserve step only for Continue Editing if intended.
- Must fix before production confidence: No, but should be fixed soon.

### UX-MED-002 - Direct paid page URL is unavailable without entry route

- Severity: Medium
- User type affected: Admin / Paid user
- Flow: Direct `/gyana/pcos-51` or `/gyana/pcos-51/success`
- Expected behavior: Shareable link should be clear.
- Actual behavior: Direct route shows `Link Not Available`; `/go/gyana-pcos-51` works and redirects correctly.
- Why bad UX: Admin may share the wrong URL because Admin Link Settings displays both public entry and paid page paths.
- Root cause: Funnel route isolation requires `/go/gyana-pcos-51` to set access cookie.
- Recommended fix: Label `/go/...` as the only shareable URL in Admin and mark internal paid/success paths as non-shareable.
- Must fix before production confidence: No, but important for operations.

## Low Bugs / Polish

### UX-LOW-001 - 320px overflow metric risk

- Severity: Low
- User type affected: Mobile visitor/admin
- Flow: Public QA page and admin at 320px
- Expected behavior: No horizontal overflow.
- Actual behavior: DOM metric reported `scrollWidth` greater than `clientWidth` at 320px. This may be scrollbar-related, but should be visually reviewed.
- Recommended fix: Add automated 320px overflow assertion and tighten any fixed-width/sticky elements if confirmed.
- Must fix before production confidence: No, unless visually reproduced.

## Template Mismatch Audit

- Builder preview component: `CoachSitePreview` in `components/admin/admin-coach-sites-manager.tsx`.
- Static app public route component: `PublicCoachSitePage` in `components/coach/public-coach-site-page.tsx`, routed by `app/coach/[slug]/page.tsx`.
- Cloudflare dynamic production route renderer: inline HTML/CSS renderer in `functions/coach/[slug].ts`.
- Same renderer: No.
- Same final visual system on QA public route: Yes.
- Old template rendering on QA builder-published route: No.
- Drift risk: High because renderers are duplicated.

## Website Creator Sync Audit

- Draft write: production database via coach-site API.
- Draft read: Drafts list loaded from database.
- Continue Editing: reopened same QA draft and preserved data.
- Publish write: same coach-site database.
- Published read: Coach Sites list showed the QA record as Published.
- Public route read: public `/coach/[slug]` found the QA record and rendered it.
- Source mismatch found: Gyana exists as code-approved production data outside D1, so Admin Coach Sites does not show it.

## Public Route Audit

- QA builder route: `/coach/qa-test-coach-do-not-use-20260603-qa-audit` opened successfully.
- Gyana route: `/coach/gyana-ranjan` opened successfully but lacks active registration link.
- Missing route: `/coach/does-not-exist-qa-audit` showed fallback and logged `YW-ERR-6001`.
- Archived QA route: showed unavailable Contact Support fallback correctly.
- Reactivated QA route: same URL worked again after confirming Restore Site.

## Coach Analytics Sync Audit

- QA public page visit appeared in analytics during the audit.
- Register-click persistence was not proven beyond href/CTA verification.
- `functions/api/coach-events.ts` currently returns `persisted: false`, so client-side event persistence is still incomplete or handled elsewhere by the dynamic function.
- Analytics table is slug-first and should show coach name for clarity.

## Contact Support / Error Fallback Audit

- Missing coach fallback: passed.
- Archived coach fallback: passed.
- Error code visible and copy button present: passed.
- Admin Error Reports logging: passed.
- Public technical detail exposure: no stack/secrets observed.
- Default support missing phone/WhatsApp is logged as missing support fields; configure defaults if phone/WhatsApp should be available.

## Mobile / Tablet / Desktop Audit

Public QA page checked at:

- 320px: hero and CTA visible early; possible overflow metric risk.
- 375px: pass.
- 390px: pass.
- 414px: pass.
- Mobile landscape: hero visible; first CTA not visible in first fold, sticky CTA still needs visual review.
- 768px: pass.
- 834px: pass.
- 1024px: pass.
- 1440px: pass.

Admin checked at:

- 320px: menu present, authenticated workspace visible; possible overflow metric risk.
- 390px: pass.
- 1024px: pass.

## Paid Masterclass Quick Test

- Direct `/gyana/pcos-51`: Link Not Available without entry cookie.
- Shareable `/go/gyana-pcos-51`: works and redirects into paid page.
- Success page after entry session: works, video present, WhatsApp text present.
- Private WhatsApp group URL: not exposed in frontend links during the safe smoke test.
- No real payment was attempted.

## Screenshots / Visual Notes

Safe public screenshots saved:

- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\qa-coach-390.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\gyana-referral-1024.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\missing-coach-fallback-390.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\production-qa\paid-entry-1024.png`

Admin screenshots were visually inspected in session but not saved to avoid retaining authenticated admin UI artifacts.

## QA Data Created And Cleaned Up

- Coach name: QA Test Coach Do Not Use 20260603 QA Audit
- Slug: qa-test-coach-do-not-use-20260603-qa-audit
- Final status after audit cleanup: Removed
- Public URL: `/coach/qa-test-coach-do-not-use-20260603-qa-audit`
- Cleanup performed: archived first, then removed through the OTP-protected Remove flow.
- Product note: the current Remove behavior keeps the record visible in Admin with `removed` status for audit/history. If final production must not show QA/test records anywhere in Admin, add a separate admin-only hard-delete or retention cleanup policy.

## Recommended Fix Order

1. Critical fix batch:
   - Sync Gyana referral into D1/admin Coach Sites or show approved production records in Admin.
   - Add/approve Gyana Google Form registration link.
   - Fix Pause persistence/public unavailable behavior.
2. High fix batch:
   - Align preview/public template renderers or add strict renderer parity tests.
   - Improve Coach Analytics identity display and event persistence clarity.
3. Medium fix batch:
   - Reset Create Coach Site wizard to Step 1 for new create flow.
   - Mark only `/go/...` as shareable paid link in Admin.
4. Low/polish batch:
   - Add automated 320px overflow checks and tighten small-screen fixed widths if confirmed.
5. Needs approval:
   - Any real coach data migration/import.
   - Any real Google Form URL addition.
   - Any hard-delete or retention cleanup policy for removed QA/admin-history records.
