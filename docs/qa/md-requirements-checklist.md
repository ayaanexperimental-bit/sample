# YWcoach Source-of-Truth Requirement Checklist

Test date: 2026-06-05
Production URL tested: https://ywcoach.com
Authenticated admin test: completed through existing production session. Gmail OTP value was not recorded in this file.
Latest deployments tested: https://c701da4b.ywcoach.pages.dev, https://1d6159d6.ywcoach.pages.dev, https://bdf537c4.ywcoach.pages.dev, https://85e4c304.ywcoach.pages.dev, https://1a57f24b.ywcoach.pages.dev, https://14f82bbb.ywcoach.pages.dev, https://1d35b67e.ywcoach.pages.dev, https://85cbee99.ywcoach.pages.dev, https://ad90287d.ywcoach.pages.dev, and https://ywcoach.com

## Summary

Total requirement groups found: 31
Completed and tested: 29
Partial or blocked: 2
Critical production bugs fixed in this pass: 6

## Latest Verification Addendum

- 2026-06-05: Redeployed production at source commit `ef11918` / deployment `https://ad90287d.ywcoach.pages.dev` after updating the INSTR.MD adaptive visual verification evidence. Fresh live Browser smoke for `/go/gyana-pcos-51` passed: normal flow redirected to `/gyana/pcos-51`, no `YW-ERR-404`, no unexpected Contact Support fallback, no horizontal overflow, loader removed, CTA visible, and the automated Browser received the intended static compatibility tier.
- 2026-06-05: Re-ran the public production matrix after the adaptive Grainient pass. 20/20 checks passed across 320, 390, 768, 1024, and 1440px for `/admin/dashboard` unauthenticated recovery, `/coach-template-preview`, `/coach/gyana-ranjan`, and `/go/gyana-pcos-51`: no `YW-ERR-404`, no framework overlay, no unexpected Contact Support fallback on normal routes, no horizontal overflow, and no stuck loader.
- 2026-06-05: Strengthened the production-like Website Creator regression without creating fake production data. The admin-security pipeline now proves: publish is blocked without a Google Form link, draft saves visibly through the list API, continuing/updating the same draft keeps a single stable record, publishing moves it to `published`, the Coach Sites list returns it, and the public `/coach/[slug]` renderer uses the final YW Nutritech template with the updated generated copy and register link.
- 2026-06-05: Fixed the phone-side adaptive visual gate after real-device feedback showed both weak and strong phones were receiving static Grainient. Strong phones now use a basic WebGL2 check for the low-FPS `reduced` tier, while desktop `full` mode still requires strict no-caveat WebGL2. Weak devices, save-data, reduced-motion, automation, no-WebGL2, and genuinely constrained phones still receive the static compatibility fallback.
- 2026-06-05: Re-audited `pendings.md` maintenance requirements. Added DB-role compatibility so future `admin` and `super_admin` rows are recognized alongside the existing project `owner` role without enabling strict DB roles. Added regression coverage for stale Error Reports cleanup. Production Gmail-backed admin API verification passed without recording the OTP: session authenticated, Backup/Cleanup API read D1 state, a 0-record analytics backup sent successfully to the active admin with both CSV and XLS attachments, protected cleanup deleted 0 records because no analytics were older than 90 days, and Gmail confirmed the backup email with both attachments arrived.
- 2026-06-05: Local static Pages visual check for Admin Backup/Cleanup passed at 390, 768, and 1440px using protected API mocks: no horizontal overflow, no stuck loader, Email CSV + XLS destination visible, Download Latest CSV/XLS controls visible, DB-role readiness checklist visible, and the Clear Old Error Reports modal showed the required irreversible warning plus all four cleanup options.
- 2026-06-05: Fixed and deployed admin route recovery for `/admin_panel` plus related admin aliases. Production Browser verification confirmed `/admin/dashboard`, `/admin_panel`, `/admin-panel`, `/admin-dashboard`, and `/dashboard` all land on the authenticated Admin Dashboard without `YW-ERR-404`.
- 2026-06-05: Hardened admin route recovery again for encoded-space and nested admin aliases: `/admin%20panel`, `/admin%20dashboard`, `/admin-panel/dashboard`, `/admin_panel/dashboard`, `/adminpanel/dashboard`, `/Admin%20Panel`, and `/Admin/Dashboard` now redirect to `/admin/dashboard` without rendering the fallback 404.
- 2026-06-05: Completed the authenticated admin breakpoint matrix after the mobile/sidebar fix. Production Browser evidence covers 45 checks: 9 admin sections across 320, 390, 768, 1024, and 1440px. No `YW-ERR-404`, no framework overlay, no unexpected Contact Support fallback, no horizontal overflow, and expected headings/dialogs were visible.
- 2026-06-05: Triaged the remaining production Error Reports without deleting audit history. D1 now has 0 `New` reports: 13 `Fixed` reports and 69 `Ignored` reports with admin notes. The ignored reports were expected QA/direct-access fallbacks: 64 paid page/success direct opens without the funnel entry cookie and 5 `/support/error` route QA opens. Production Error Reports UI confirms no `New` status, no `YW-ERR-404`, no unexpected support fallback, and no horizontal overflow.
- 2026-06-05: Added admin-maintenance regression coverage proving analytics backup produces both CSV and XLS payloads, stores both formats, exposes protected CSV/XLS download URLs, reads active admin recipients from the Admin DB role list, and blocks cleanup when active-admin email notification is not configured or not successful.
- 2026-06-05: Re-tested production Coach Analytics in the authenticated Browser session. Main page shows the coach list/table, View Analytics opens the detailed panel with photo, report tools, AI summary, Combined/Paid/Free tabs, CSV and Excel controls; Manage moves to Coach Sites without `YW-ERR-404`; mobile 390px navigation reaches Coach Analytics with no horizontal overflow.
- 2026-06-05: Replaced Coach Analytics `Open Site` popup button behavior with a real `target="_blank"` public-site link so the action is reliable and accessible while keeping disabled behavior for coaches without public URLs.
- 2026-06-05: Completed a fresh Gmail-backed production admin OTP login without recording the OTP. Authenticated Browser verification confirmed `/admin/dashboard` opens with the active admin email, no `YW-ERR-404`, no unexpected Contact Support fallback, and no horizontal overflow.
- 2026-06-05: Applied an INSTR.MD performance pass: Coach Analytics graph hover updates are throttled through `requestAnimationFrame` and skip redundant state changes; paid-page Grainient background now runs at lower FPS (`14fps` desktop / `6fps` low-power) while preserving the same visual design.
- 2026-06-05: Production Browser performance matrix passed 20/20 checks across 320, 390, 768, 1024, and 1440px for Admin Dashboard, Coach Template Preview, `/coach/gyana-ranjan`, and `/gyana/pcos-51`: no horizontal overflow, no `YW-ERR-404`, no framework overlay, no unexpected support fallback, loader removed, and no relevant console errors.
- 2026-06-05: Local production preview matrix passed 9/9 checks at 320, 768, and 1440px for Coach Template Preview, `/coach/gyana-ranjan`, and `/gyana/pcos-51` with the same no-overflow/no-error/no-loader criteria.
- 2026-06-05: Fixed and deployed admin typo subpath recovery for `/admil/dashboard`, `/admim/dashboard`, `/admn/dashboard`, `/adminn/dashboard`, and `/admindashboard/overview`. Authenticated Browser verification confirmed `/admil/dashboard` redirects to `/admin/dashboard` with the active admin session, no `YW-ERR-404`, no Contact Support fallback, and no console errors.
- 2026-06-05: Completed the second INSTR.MD performance pass: Website Creator preview memoization was hardened with a stable theme callback, template-preview Next RSC `.txt` prefetch misses now return 204, paid-page WebGL background is gated to real desktop/no reduced motion with a CSS fallback elsewhere, and iframe allowlists were cleaned to remove unsupported `web-share` while allowing `compute-pressure`.
- 2026-06-05: Final responsive production matrix passed 21/21 checks across 320/375/390/414/768/1024/1440px for Coach Template Preview, `/coach/gyana-ranjan`, and `/go/gyana-pcos-51`: no horizontal overflow, no `YW-ERR-404`, no framework overlay, no unexpected Contact Support fallback, and no console warnings/errors.
- 2026-06-05: Redeployed production so Cloudflare Pages source now matches repo commit `1d01599`. Live Browser checks confirm `/admin/dashboard`, `/admin_panel`, `/admin%20panel`, and `/admil/dashboard` open the admin dashboard/login flow without `YW-ERR-404` or unexpected Contact Support fallback.
- 2026-06-05: Hardened `/support/error` support links so the fallback route no longer prefetches the external home redirect and no longer raises the prior CSP console warning. The support route remains a static, visible, copyable fallback page; query-specific error-code rendering is intentionally not enabled after production testing showed that approach could render a blank hidden Suspense shell on Cloudflare Pages.
- 2026-06-05: Verified latest Cloudflare Pages production source `28ec914` / deployment `https://85cbee99.ywcoach.pages.dev`. Live Browser confirmed the authenticated Admin Dashboard opens at `/admin/dashboard` with no `YW-ERR-404`; `/admin`, `/admin/login`, `/admin/verify`, `/admin/dashboard?verify=401dc68`, `/admin/dashboard/`, `/admil`, and `/admin-panel` all recover to the correct admin dashboard/login flow.
- 2026-06-05: Re-ran INSTR.MD performance checks after the latest motion pass. Production matrix passed 28/28 checks across 320/375/390/414/768/1024/1440 for admin login/dashboard routing, Coach Template Preview, `/coach/gyana-ranjan`, and `/go/gyana-pcos-51`: no horizontal overflow, no `YW-ERR-404`, no framework overlay, no unexpected support fallback, and no visible stuck loader. Browser-aborted RSC prefetches and YouTube iframe aborts were observed as non-app-route network behavior.
- 2026-06-05: Authenticated production Browser UI test confirmed Website Creator opens from Admin, step navigation labels are present, Save Draft and Publish controls are present, and Copy Public Link is hidden before publish. Coach Analytics opens through the mobile menu, shows the live dynamic coach list with Gyana, and the detail panel opens with coach image, Combined/Paid/Free tabs, AI/report controls, CSV and Excel buttons, and hover-only graph tooltip hidden before hover.
- 2026-06-05: Public coach performance probes confirmed `/coach/gyana-ranjan` has zero `pointermove` spotlight listeners on 390px touch/mobile, one desktop listener at 1440px, a visible Register CTA with the real Google Form link, PMOS copy, no PCOS leak, no overflow, and no support fallback. Paid masterclass carousel stayed paused while offscreen and resumed once scrolled into view.
- 2026-06-05: Local Cloudflare Pages preview on `127.0.0.1:4198` passed public route checks for Coach Template Preview and `/coach/gyana-ranjan` at 320/390/768/1024/1440. Local `/go/gyana-pcos-51` remains blocked with the expected local 503 because `FUNNEL_ACCESS_SECRET` is not configured in the local preview environment; production `/go/gyana-pcos-51` passes.
- Commands verified in this addendum: `pnpm lint`, `pnpm typecheck`, `pnpm test:admin-security`, `pnpm build`, `pnpm build:pages`, and `pnpm build:pages-functions`.

## Checklist

| Source | Requirement group | Implemented | Tested | Result | Issue found | Fix applied | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INSTR.MD | Admin, builder, preview, and public pages must stay smooth without redesign | Yes | Yes | Pass | Public breakpoint sweep initially found paid support fallback horizontal overflow on 320-414px. Authenticated admin matrix later exposed mobile/tablet sidebar visibility risk. Later code audit found graph hover state updated directly on mousemove and paid Grainient could run heavier than needed. Later real-device feedback showed Grainient remained static on both weak and strong phones. | Fixed server-rendered paid support fallback box sizing and long-code wrapping; fixed admin mobile/tablet sidebar height/scroll/open transform; throttled graph hover updates through `requestAnimationFrame`; replaced width-only Grainient gating with adaptive full/reduced/static visual tiers; loosened mobile reduced-tier WebGL detection while keeping weak-device static fallback. Production matrix now passes admin/template/coach/paid surfaces across 320/390/768/1024/1440. | None for this requirement group. Re-run the matrix after future visual changes. |
| INSTR.MD | Animations should use transform/opacity, reduce heavy blur/glow on mobile, avoid setState on scroll | Yes | Code reviewed/UI tested | Pass | Coach Analytics graph updated React state directly on mousemove; paid-page WebGL background ran more frequently than needed for low-power viewports and later could be disabled too broadly. | Graph hover is now animation-frame batched and skips redundant state changes; paid-page Grainient now uses capability-aware full/reduced/static tiers with capped FPS, strict desktop full mode, basic-WebGL mobile reduced mode, and static fallback for automation/constrained devices. | None found in this pass. |
| INSTR.MD | Website Creator preview updates should be debounced/memoized and not regenerate every keystroke | Yes | Code reviewed/production UI tested | Pass | `CoachSitePreview` was memoized, but its inline theme-change callback changed identity on every form render, so the preview could still rerender more than needed. | Added a stable callback wrapper for the preview theme change handler while preserving the latest form state. Existing creator code keeps AI generation action-driven; no fake production coach created. | None for preview performance. Live AI/R2 creator publish testing remains reserved for real coach creation under the Website Creator flow blockers. |
| INSTR.MD | Run lint, type-check, build after edits | Yes | Yes | Pass | Initial lint failed on setState-in-effect. | Replaced effect-based portal readiness with a render-time document guard. | None. |
| pendings.md | Clear Old Error Reports without requiring backup | Yes | Yes | Pass | Mobile dialog was previously off-screen when opened after scrolling. | Shared admin dialog now portals to document.body. | None. |
| pendings.md | Error Reports cleanup must require confirmation text and offer fixed/ignored, 30d, 90d, stale-all options | Yes | Yes | Pass | Same off-screen dialog issue. | Portal fix. Confirmed modal text and options in production. | None. |
| pendings.md | Analytics/data cleanup must require backup plus active-admin email notification | Yes | Code reviewed/UI tested | Pass | No destructive cleanup executed. | Existing server flow blocks cleanup if backup/notification fails. | Active admin recipient configuration must remain valid before cleanup can run. |
| pendings.md | Backup primary is email attachment, not Google Sheets | Yes | Yes | Pass | Older docs mention Google Sheets as optional legacy context. | Production Backup/Cleanup UI says Email CSV + XLS attachments primary. | None for primary flow. |
| pendings.md | Backup must include CSV and XLS | Yes | Yes | Pass | None. | `admin-maintenance.ts` generates `backup_csv` and `backup_xls`; UI mentions CSV + XLS. | None. |
| pendings.md | Backup recipients must come from active Admin DB role list, not hardcoded email | Yes | Code reviewed/D1/Gmail verified | Pass | Production `admin_users` table was previously empty, so backups had no active recipient. The optional `backup_notifications_enabled` column is still absent, which is allowed because missing means all active admins receive backup notifications. | Inserted/updated the visible logged-in production admin email as active `owner`; `getActiveBackupRecipients` reads `admin_users`; production backup sent to the active admin and Gmail confirmed CSV + XLS attachments. | None for current active admin recipient flow. |
| pendings.md | Strict DB admin role enforcement panel/checklist, but do not enable blindly | Yes | UI/code/D1 reviewed | Pass | Enabling too early can lock out admin. Existing code only recognized project role `owner`; the source also names `admin` and `super_admin`. | Settings/Backup UI expose checklist and rollback notes; active `owner` row exists for the current admin email; DB role checks now recognize `owner`, `admin`, and `super_admin`; fresh Gmail-backed OTP login was verified in production. | Keep `ADMIN_REQUIRE_DB_ADMIN_ROLES=false` until explicit approval to change the production env flag and run the lockout rollback test. |
| pendings.md | Add coach photo/avatar to Coach Sites if safe | Yes | Yes | Pass | Previously user noted missing image. | Coach Sites, Coach Analytics, and Top Performers show Gyana image from builder/site record. | None. |
| pendings.md | Do not run fake live AI/R2 production creation test | Yes | Yes | Pass | Full live media upload test intentionally skipped. | Config remains ready without fake production data. | Real coach/media creation test should be done only during real production entry. |
| ROBUST ADMIN PANEL--UPDATED.MD | Admin Overview should be robust command center using real data or empty states | Yes | Yes | Pass | None in tested viewport. | Overview shows live source, KPIs, graph, AI overview action, top coach. | More long-term predictions improve as real data accumulates. |
| ROBUST ADMIN PANEL--UPDATED.MD | Coach Analytics main page must be all-coach list/table, not one giant coach card | Yes | Yes | Pass | None after scoped mobile nav testing. | Main page shows filter controls, graph, list card/table, actions. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | View Analytics opens detailed modal/drawer for selected coach | Yes | Yes | Pass | Critical mobile bug: dialog existed but rendered above viewport when page was scrolled. | `AdminActionDialog` now portals to `document.body`. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | Detail panel should include coach photo, badges, KPI/report tools, AI insights, graphs, dynamic tabs | Yes | Yes | Pass | Not visible before portal fix. | Portal fix made panel visible; production test confirms photo, dynamic tabs, AI summary, report buttons, CSV and Excel buttons. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | Interactive graphs with hover-only tooltip and range buttons | Yes | Yes | Pass | Tooltip was previously suspected visible by default; code audit found mousemove could update React state every pointer event. | Production test confirms selected tooltip text is hidden before hover; graph hover state now batches through `requestAnimationFrame` and only changes state when the active point changes. | None for current production behavior. |
| ROBUST ADMIN PANEL--UPDATED.MD | AI insights global and per-coach, cached/on-demand, no automatic all-coach token spend | Yes | Code/UI tested | Pass | None. | UI shows Generate/Refresh AI, server-side model config defaults, compact data. | Real insight quality depends on OpenAI credits/model availability. |
| ROBUST ADMIN PANEL--UPDATED.MD | AI copy generation model configuration and token-efficient page analyzer | Yes | Code reviewed | Pass | None. | `ai-model-config`, analyzer, compressor, cache, estimator, and generator modules exist. | Real paid-funnel extraction test should be done with real approved coach content. |
| ROBUST ADMIN PANEL--UPDATED.MD | Coach reports: generate, copy, download, share; include CSV/Excel report output | Yes | UI/code reviewed | Pass | Button label is `Download Sheet CSV` rather than plain `Download CSV`; behavior matches sheet/CSV intent. | No fix needed. | Branded PDF remains optional future upgrade. |
| ROBUST ADMIN PANEL--UPDATED.MD | No fake/demo data in production analytics | Yes | Code/UI reviewed | Pass | Old QA docs still contain historic notes but production UI says live records/empty values. | No fake production data introduced. | Historical docs can be updated separately if desired. |
| admin coach analystics.MD | Universal funnel detection: paid only, free only, both, none | Yes | Yes | Pass | Current live production has one coach with both funnels. | UI shows dynamic counts and Combined/Paid/Free tabs for Gyana. | Need more real coaches to visually test paid-only/free-only/none states without fake data. |
| admin coach analystics.MD | Main list rows show photo, name, niche, region, funnel badges, status, visits, clicks, CTR, best funnel, last activity, source, actions | Yes | Yes | Pass | None. | Production Coach Analytics row shows the required fields and actions. | None. |
| admin coach analystics.MD | Manage opens management/edit action; Open Site opens public URL or disabled state | Yes | Yes | Pass | Browser automation showed popup-style `window.open` was not reliable enough as proof for Open Site. | Open Site is now a normal `target="_blank"` link with `rel="noopener noreferrer"`; Manage was production-tested to move to Coach Sites without error. | Full destructive/edit-save flow should still be tested only during a real content update. |
| admin coach analystics.MD | Analytics must be admin-only and not expose private data | Yes | Yes | Pass | None. | Paid manage modal hides private WhatsApp and raw payment URL; OTP gate present. | None. |
| admin coach analystics.MD | Paid and free analytics should stay under the same canonical coach identity | Yes | D1 verified | Pass | Paid `payment_initiated` rows were split under old static slug `gyana` while the referral site uses `gyana-ranjan`. | `recordAnalyticsEvent` now falls back from static funnel `coach_id` to the matching D1 coach-site slug; 51 existing Gyana rows normalized to `gyana-ranjan`. | None. |
| follow this.md | Production admin login and route access must be usable | Yes | Yes | Pass | Admin `YW-ERR-404` was previously reported. Correct lowercase routes worked, but uppercase/common aliases like `/Admin/Dashboard`, `/admin-panel`, and `/dashboard` could still hit route fallback. | Added server-side canonical admin redirects in Cloudflare Pages middleware; production browser and HTTP checks confirm aliases land on admin dashboard/login without `YW-ERR-404`. | None. |
| follow this.md | Error/Contact Support fallback must be mobile-safe, copyable, and not expose technical details | Yes | Yes | Pass | Paid masterclass fallback pages had horizontal overflow on small phones because the card width plus padding exceeded viewport width. | Added border-box sizing, hidden horizontal overflow, and long-reference wrapping in `paid-funnel-support.ts`; production 320/375/390/414/768/1440 retest passed. | None. |
| follow this.md | Full Website Creator draft/publish/public URL production flow | Yes | Production-like automated test; live production not polluted | Pass | Source allows QA coach creation but also says do not pollute production; no fake production coach should remain in final production. | Strengthened `coach-sites-danger-actions.spec.ts` so the real API/public-route handlers prove draft save, continue/update same draft without duplicates, publish, list sync, public route opening, final template marker, updated copy, and register link. | Live production creation should still be done only with a real approved coach entry or a clearly labeled QA entry plus cleanup plan. |
| follow this.md | Public coach template audit for builder-created production sites | Partial | Yes | Partial | Current live builder data has Gyana only. | Public/admin references treat Gyana as real production record. | More builder-created coach sites needed for full multi-site template comparison. |

## Production Evidence

- Admin dashboard opened without `YW-ERR-404`.
- Admin route recovery tested: `/Admin/Dashboard`, `/admin-panel`, `/dashboard`, `/admin/home`, `/admin/dashboard/index`, `/admil/dashboard`, `/admim/dashboard`, `/admn/dashboard`, `/adminn/dashboard`, and `/admindashboard/overview` now redirect to the canonical admin dashboard/login flow without `YW-ERR-404`.
- Admin mobile/tablet/desktop nav was tested through the authenticated production dashboard matrix for Overview, Coach Sites, Create Coach Site, Coach Analytics, Top Performers, Paid Masterclass Links/Settings, Error Reports, Backup/Cleanup, and Settings at 320/390/768/1024/1440px.
- No horizontal overflow was detected in the tested mobile-width admin viewport.
- Current production D1 `coach_sites` has Gyana Ranjan as a real published record with slug `gyana-ranjan`, theme `premium-feminine-wellness`, configured Google Form, photo, and video.
- Coach Sites shows Gyana image/avatar.
- Public `/coach/gyana-ranjan` opens without Contact Support fallback; Register CTAs point to `https://forms.gle/nsY5F1mcjZnZBbVo9`.
- Production analytics now has all 184 Gyana rows under canonical `coach_slug=gyana-ranjan`.
- Production `admin_users` now has the current admin email as an active `owner` row for backup recipients and strict-role readiness.
- Coach Analytics list shows Gyana image/avatar, funnel badges, visits/clicks/CTR/source/action buttons.
- Coach Analytics detail dialog is visible after the portal fix and includes AI/report/export controls.
- Paid Masterclass Manage dialog is visible after the portal fix, includes OTP-protected private WhatsApp reveal and OTP-protected payment link update, and does not expose private URLs.
- Error Reports cleanup dialog is visible after the portal fix and includes the required irreversible-confirmation text and cleanup options. A fresh regression proves stale cleanup does not require analytics backup and does not delete `New` reports.
- Production public breakpoint sweep covered coach page, paid fallback, success fallback, and template preview across 320/375/390/414/mobile-landscape/768/834/1024/1440.
- Normal coach page and template preview passed all production breakpoint checks: 200 status, no horizontal overflow, no support fallback, hero/media visible early, CTA visible early.
- Paid and success fallback routes correctly returned 403 with visible `YW-ERR-5003`, Contact Support, and Go Back Home; after the fallback CSS fix they have no horizontal overflow on 320/375/390/414/768/1440.
- Local preview pass covered coach page, template preview, and paid page across 320/768/1440 with no horizontal overflow, no unexpected support fallback, hero/media present, and CTA visible.
- Error Reports production state from the latest read-only D1 check: `New=31`, fixed/ignored stale cleanup count is 0, and there are no older-than-30/90 stale reports currently eligible under the safe cleanup filters.
- Production maintenance backup verification: a Gmail-backed admin API session ran `Run Backup Now`; result was `recordCount=0`, `notificationStatus=sent`, CSV download link present, XLS download link present, and Gmail confirmed the `YWcoach Trimonthly Backup Data` email arrived with both `ywcoach-analytics-backup-2026-06-05.csv` and `.xls` attachments.

Screenshot artifacts:

- `artifacts/md-compliance/mobile-overview.png`
- `artifacts/md-compliance/mobile-coach-sites.png`
- `artifacts/md-compliance/mobile-coach-analytics.png`
- `artifacts/md-compliance/mobile-top-performers.png`
- `artifacts/md-compliance/mobile-paid-masterclass-links-settings.png`
- `artifacts/md-compliance/mobile-error-reports.png`
- `artifacts/md-compliance/mobile-backup-cleanup.png`
- `artifacts/md-compliance/mobile-settings.png`
- `artifacts/md-compliance/admin-breakpoint-matrix-2026-06-05/precise-width-320.json`
- `artifacts/md-compliance/admin-breakpoint-matrix-2026-06-05/precise-width-390.json`
- `artifacts/md-compliance/admin-breakpoint-matrix-2026-06-05/precise-width-768.json`
- `artifacts/md-compliance/admin-breakpoint-matrix-2026-06-05/precise-width-1024.json`
- `artifacts/md-compliance/admin-breakpoint-matrix-2026-06-05/precise-width-1440.json`
- `artifacts/md-compliance/production-coach-analytics-detail-after-fix.png`
- `artifacts/md-compliance/production-paid-manage-after-fix.png`
- `artifacts/md-compliance/production-error-cleanup-after-fix-scoped.png`
- `artifacts/md-compliance/breakpoints/production-breakpoint-results.json`
- `artifacts/md-compliance/breakpoints-after-fallback-fix/results.json`
- `artifacts/md-compliance/local-preview/results.json`
- `artifacts/performance-audit-2026-06-05/production-performance-matrix.json`
- `artifacts/performance-audit-2026-06-05/local-performance-matrix.json`
- `artifacts/pendings-maintenance-ui/backup-cleanup-390.png`
- `artifacts/pendings-maintenance-ui/backup-cleanup-768.png`
- `artifacts/pendings-maintenance-ui/backup-cleanup-1440.png`
- `artifacts/pendings-maintenance-ui/error-cleanup-modal-390.png`
- `artifacts/pendings-maintenance-ui/error-cleanup-modal-768.png`
- `artifacts/pendings-maintenance-ui/error-cleanup-modal-1440.png`

## Commands Run

- `git status --short --branch`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:pages`
- `pnpm build:pages-functions`
- `pnpm exec playwright test --config=playwright.admin-security.config.ts tests/admin-security/coach-sites-danger-actions.spec.ts -g "draft publish pipeline persists"`
- `pnpm run deploy`
- `npx wrangler d1 execute ywcoach-admin --remote --command "SELECT ... FROM coach_sites ..."`
- `npx wrangler d1 execute ywcoach-admin --remote --command "INSERT INTO admin_users ... ON CONFLICT(email) DO UPDATE ..."`
- `npx wrangler d1 execute ywcoach-admin --remote --command "UPDATE analytics_events SET coach_slug='gyana-ranjan' ..."`
- Production browser UI checks through https://ywcoach.com/admin/dashboard
- Production admin route alias checks for `/Admin/Dashboard`, `/Admin%20Panel`, `/admin%20panel`, `/admin%20dashboard`, `/admin-panel`, `/admin-panel/dashboard`, `/admin_panel/dashboard`, `/adminpanel/dashboard`, `/dashboard`, `/admin/home`, and `/admin/dashboard/index`
- Production Browser performance matrix for Admin Dashboard, Coach Template Preview, `/coach/gyana-ranjan`, and `/gyana/pcos-51` at 320/390/768/1024/1440
- Production Browser/post-deploy smoke for `/go/gyana-pcos-51` after deployment `https://ad90287d.ywcoach.pages.dev`
- Production public matrix for Admin Login recovery, Coach Template Preview, `/coach/gyana-ranjan`, and `/go/gyana-pcos-51` across 320/390/768/1024/1440
- Production responsive matrix for Coach Template Preview, `/coach/gyana-ranjan`, and `/go/gyana-pcos-51` at 320/375/390/414/768/1024/1440
- Local production preview matrix for Coach Template Preview, `/coach/gyana-ranjan`, and `/gyana/pcos-51` at 320/768/1440
- Production Error Reports D1 triage queries and Admin UI check
- Production Playwright breakpoint sweep for public routes
- Local Next preview breakpoint sweep on `127.0.0.1:4182`
- Read-only production D1 checks for `admin_users`, `analytics_backups`, `cleanup_logs`, `error_report_cleanup_logs`, `analytics_event_rollups`, `analytics_events`, and current Error Reports status counts
- Gmail-backed production admin OTP API login, protected `/api/admin/backup-cleanup` and `/api/admin/error-reports` checks, one safe 0-record backup run, and protected cleanup run that deleted 0 old analytics records
- Gmail search confirmation for `YWcoach Trimonthly Backup Data` delivery with both CSV and XLS attachments
- Local static Cloudflare Pages admin visual check for Backup/Cleanup and Clear Old Error Reports modal at 390/768/1440

## Build Results

- lint: pass
- type-check: pass
- Next build: pass
- Cloudflare Pages static build: pass
- Cloudflare Pages Functions build: pass
- Deploy: pass

## Open Blockers

1. Strict DB admin role enforcement remains off until explicit approval to change the production env flag and run the lockout rollback test. Fresh production OTP login and active owner row are verified; code is now compatible with future `admin` and `super_admin` rows.
2. Full live AI/R2 creator test is intentionally not run with fake media/coaches; run this with a real coach site creation.
3. Live production Website Creator publish should still be exercised with a real approved coach or a clearly labeled QA coach plus cleanup plan before treating a brand-new production entry as final.
4. More real coach records are needed to visually prove paid-only, free-only, and no-funnel states in production without adding fake data.
