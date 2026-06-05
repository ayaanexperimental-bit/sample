# Admin Panel UX Refactor Regression Report

Source of truth: `C:\Users\Yours Wellness\Desktop\allia.md`

Old `.md` files and previous source-of-truth files were ignored for this pass.

Latest Pages deployment tested: `https://60e09c83.ywcoach.pages.dev`

Production domain tested: `https://ywcoach.com`

## Summary

The admin panel now behaves as a dashboard app shell instead of a long webpage on desktop/tablet. The shell, sidebar, and topbar stay within a fixed viewport-height workspace, and module content scrolls internally.

The biggest UX fixes were:

- Overview AI moved from a large card into a compact contextual popover.
- Coach Analytics main page now stays as an all-coach list/table; the detailed coach dashboard opens only after View Analytics.
- Coach Analytics table visibility/density was fixed after testing found the row actions were too low and partially awkward.
- Coach Sites rows now show a clear coach photo/avatar with accessible labels.
- Error Reports and Backup/Cleanup actions open confirmation dialogs instead of acting inline.
- Settings top status cards were compacted into concise rows.
- Responsive testing was completed at 320, 375, 390, 414, 768, 1024, and desktop widths.

## Files Changed

- `components/admin/admin-auth-shell.tsx`
- `components/admin/admin-auth-shell.module.css`
- `components/admin/admin-dashboard-layout.tsx`
- `components/admin/admin-dashboard-shell.tsx`
- `components/admin/admin-dashboard-shell.module.css`
- `components/admin/admin-coach-sites-manager.tsx`
- `docs/qa/admin-panel-baseline-before-ux-refactor.md`
- `docs/qa/admin-ux-allia-requirements-checklist.md`
- `docs/qa/admin-panel-after-ux-refactor-regression.md`
- `docs/screenshots/admin-baseline-before-ux-refactor/*`
- `docs/screenshots/admin-after-ux-refactor/*`

## UX Issues Found And Fixed

| UX Issue ID | Area | Severity | Expected | Actual Found | Root Cause | Fix | Re-test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UX-001 | Admin shell | Critical | Browser page should not be the primary scroll surface. | Admin felt like a normal long page. | Auth/page wrappers and dashboard shell did not enforce a locked workspace. | Added dashboard-specific auth wrapper and viewport-bounded app/page body CSS. | Production Browser desktop: document `scrollHeight=1000`, `clientHeight=1000`; module body scrolls internally. |
| UX-002 | Coach Analytics | High | Main page shows all coaches in a list/table, no giant coach card by default. | Table existed but was difficult to see/reach and detail card risk remained visually dominant. | List panel/table scroll wrapper had poor height behavior and density. | Added internal table scroll min-height/max-height and compact row/action density. | Browser verified Gyana list row and no `Gyana Ranjan Analytics` detail by default. |
| UX-003 | Coach Analytics actions | High | View Analytics/Manage/Open Site must be visible and tappable. | Actions were near the right edge and initially appeared risky. | Table min width/density too wide. | Reduced table density and kept table scroll contained without body overflow. | Browser verified action buttons visible at desktop; responsive matrix no horizontal overflow. |
| UX-004 | Coach Sites row identity | Medium | Coach row should show photo/avatar clearly. | Visual avatar existed but was hidden from accessibility checks and tests. | Avatar had `aria-hidden=true` and empty image alt. | Added `role="img"`, `aria-label`, `data-has-photo`, and meaningful image alt. | Production Browser verified `Gyana Ranjan avatar` and `/images/coach-gyana-ranjan.png`. |
| UX-005 | Error Reports actions | High | Clear Old Error Reports should open confirmation and avoid accidental destructive action. | Confirmation existed but needed live proof. | Destructive action needed stronger QA evidence. | Verified confirmation wording and cancel path; kept real logs intact. | Browser verified required permanent-clear wording and dialog cancellation. |
| UX-006 | Backup actions | Medium | Backup actions should open focused confirmation dialogs. | Backup action risked feeling immediate. | Action was too close to one-click execution. | Added confirmation dialogs for backup and test email. | Browser verified Run Backup confirmation without sending extra email. |
| UX-007 | Settings | Medium | Settings should not feel like a giant status-card dump. | Settings top area was too card-heavy. | Status cards consumed too much visual space. | Replaced top cards with compact settings summary rows. | Browser verified compact rows and security status section. |
| UX-008 | Responsive admin testing | High | Test mobile/tablet/desktop, no horizontal overflow. | Production standalone testing redirected unauthenticated dashboard requests before hydration. | Cloudflare middleware protects admin dashboard. | Used local production `next start` with safe mocked admin API responses for layout-only viewport matrix. | 320/375/390/414/768/1024/1440 passed `bodyOverflowX=false`. |

## Expected vs Actual

| Flow | Expected Behavior | Actual Verified Behavior | Result |
| --- | --- | --- | --- |
| Admin Overview | Loads inside dashboard shell, top KPIs visible, AI not a huge card. | Production Browser shows fixed shell, internal module scroll, compact AI popover in actions. | Pass |
| Coach Analytics main page | Shows all coaches in list/table; no giant selected coach by default. | Production Browser shows coach performance list with Gyana row and no detail dashboard until View Analytics. | Pass |
| View Analytics | Opens focused detail drawer/panel with coach identity, KPI/report tools, and dynamic tabs. | Production Browser opened `Gyana Ranjan Analytics` drawer with Combined, Paid Masterclass, and Free Guest Link. | Pass |
| Coach Sites | Shows Drafts area, archived access, current published row, and action dialog. | Production Browser verified Drafts, Archived Coaches button, Gyana published row, Manage dialog. | Pass |
| Website Creator | Opens as wizard dialog, not inline. | Production Browser verified six-step `Coach Website Creator` dialog with Save Draft/Publish controls. | Pass |
| Save Draft / Publish | Saves drafts, publishes, updates lists, and public route renders. | Browser text-entry was blocked by the plugin clipboard, so no fake production draft was created. Admin-security test covered draft publish/list/public rendering pipeline. | Pass |
| Clear Error Reports | Opens confirmation, requires explicit action, list remains in context. | Production Browser verified dialog and cancel path; no real logs deleted in this QA pass. | Pass |
| Backup | Opens confirmation before sending backup. | Production Browser verified Run Backup confirmation and cancel path. | Pass |
| Settings | Compact settings rows, support action available, security status findable. | Production Browser verified settings compact rows; security section is inside internal scroll. | Pass |
| Public coach route | Admin refactor must not break coach template. | `https://ywcoach.com/coach/gyana-ranjan` opened final coach template, no `YW-ERR`, no Contact Support fallback. | Pass |
| Paid route | Admin refactor must not break paid funnel. | `https://ywcoach.com/go/gyana-pcos-51` redirected to paid page, no `YW-ERR`, no Contact Support fallback. | Pass |

## Screenshot Evidence

Desktop/live production:

- `docs/screenshots/admin-after-ux-refactor/01-overview-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/02-coach-analytics-top-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/03-coach-analytics-list-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/04-coach-analytics-detail-drawer-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/05-coach-sites-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/06-production-after-deploy-overview.png`
- `docs/screenshots/admin-after-ux-refactor/07-coach-sites-after-deploy.png`
- `docs/screenshots/admin-after-ux-refactor/08-website-creator-dialog.png`
- `docs/screenshots/admin-after-ux-refactor/09-error-reports-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/10-error-reports-ai-popover.png`
- `docs/screenshots/admin-after-ux-refactor/11-error-reports-clear-confirmation.png`
- `docs/screenshots/admin-after-ux-refactor/12-backup-cleanup-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/13-backup-confirmation.png`
- `docs/screenshots/admin-after-ux-refactor/14-settings-desktop.png`
- `docs/screenshots/admin-after-ux-refactor/15-public-coach-route.png`
- `docs/screenshots/admin-after-ux-refactor/16-paid-entry-route.png`
- `docs/screenshots/admin-after-ux-refactor/17-coach-sites-manage-dialog.png`

Responsive layout-only screenshots:

- `docs/screenshots/admin-after-ux-refactor/responsive/overview-320.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-375.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-390.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-414.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-768.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-1024.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/overview-1440.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-320.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-375.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-390.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-414.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-768.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-1024.png`
- `docs/screenshots/admin-after-ux-refactor/responsive/coach-analytics-1440.png`

## Responsive Results

The responsive matrix used local production `next start` with safe mocked admin API responses to avoid fake production writes.

| Width | Overview | Coach Analytics | Horizontal Overflow | Result |
| --- | --- | --- | --- | --- |
| 320 | Dashboard loaded, mobile menu available. | Coach list visible, Gyana row present. | No | Pass |
| 375 | Dashboard loaded, mobile menu available. | Coach list visible, Gyana row present. | No | Pass |
| 390 | Dashboard loaded, mobile menu available. | Coach list visible, Gyana row present. | No | Pass |
| 414 | Dashboard loaded, mobile menu available. | Coach list visible, Gyana row present. | No | Pass |
| 768 | Dashboard loaded. | Coach list visible, Gyana row present. | No | Pass |
| 1024 | Dashboard loaded. | Coach list visible, Gyana row present. | No | Pass |
| 1440 | Dashboard loaded. | Coach list visible, Gyana row present. | No | Pass |

## Commands Run

- `git status --short --branch`
- `git log --oneline -5`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm deploy:pages`
- `pnpm check:links`
- `pnpm test:admin-security`
- Browser production checks for admin dashboard, Coach Analytics, Coach Sites, Website Creator, Error Reports, Backup/Cleanup, Settings, public coach route, and paid route.
- Local Playwright responsive matrix at 320, 375, 390, 414, 768, 1024, 1440.

## Results

- Type-check: Pass
- Lint: Pass
- Build: Pass
- Deploy: Pass, latest preview `https://60e09c83.ywcoach.pages.dev`
- Production link smoke: Pass
- Admin security suite: Pass, 21/21
- Production admin Browser UX checks: Pass
- Public route smoke: Pass
- Responsive matrix: Pass

## Remaining Items

No code-side pending item remains against the current `allia.md`.

Notes:

- Browser text entry into the Website Creator was blocked by the Browser plugin virtual clipboard in this session, so I did not create a temporary production draft. The Save Draft/Publish/data-sync path was covered by the admin-security persistence tests instead, and no fake production coach was left behind.
- Clear Error Reports and Backup dialogs were opened and canceled in production to avoid deleting real logs or sending extra emails during this visual QA pass.
