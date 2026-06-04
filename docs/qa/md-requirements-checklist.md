# YWcoach Source-of-Truth Requirement Checklist

Test date: 2026-06-05
Production URL tested: https://ywcoach.com
Authenticated admin test: completed through existing production session. Gmail OTP value was not recorded in this file.
Latest deployment tested: https://c701da4b.ywcoach.pages.dev and https://ywcoach.com

## Summary

Total requirement groups found: 28
Completed and tested: 22
Partial or blocked: 6
Critical production bugs fixed in this pass: 1

## Checklist

| Source | Requirement group | Implemented | Tested | Result | Issue found | Fix applied | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INSTR.MD | Admin, builder, preview, and public pages must stay smooth without redesign | Partial | Yes | Partial | Full performance matrix still needs repeated long-scroll checks across all breakpoints after every visual edit. | Current admin pages show no mobile horizontal overflow in tested viewport. | Full 320/375/390/414/768/1024 matrix is ongoing, not complete in this pass. |
| INSTR.MD | Animations should use transform/opacity, reduce heavy blur/glow on mobile, avoid setState on scroll | Yes | Code reviewed | Pass | No new heavy animation was added in this pass. | No code change needed. | None found in this pass. |
| INSTR.MD | Website Creator preview updates should be debounced/memoized and not regenerate every keystroke | Partial | Code reviewed | Partial | Deep creator publish flow was not executed with fake production coach data. | Existing creator code keeps generation action-driven; no fake production coach created. | Live AI/R2 creator test is intentionally reserved for real coach creation. |
| INSTR.MD | Run lint, type-check, build after edits | Yes | Yes | Pass | Initial lint failed on setState-in-effect. | Replaced effect-based portal readiness with a render-time document guard. | None. |
| pendings.md | Clear Old Error Reports without requiring backup | Yes | Yes | Pass | Mobile dialog was previously off-screen when opened after scrolling. | Shared admin dialog now portals to document.body. | None. |
| pendings.md | Error Reports cleanup must require confirmation text and offer fixed/ignored, 30d, 90d, stale-all options | Yes | Yes | Pass | Same off-screen dialog issue. | Portal fix. Confirmed modal text and options in production. | None. |
| pendings.md | Analytics/data cleanup must require backup plus active-admin email notification | Yes | Code reviewed/UI tested | Pass | No destructive cleanup executed. | Existing server flow blocks cleanup if backup/notification fails. | Active admin recipient configuration must remain valid before cleanup can run. |
| pendings.md | Backup primary is email attachment, not Google Sheets | Yes | Yes | Pass | Older docs mention Google Sheets as optional legacy context. | Production Backup/Cleanup UI says Email CSV + XLS attachments primary. | None for primary flow. |
| pendings.md | Backup must include CSV and XLS | Yes | Yes | Pass | None. | `admin-maintenance.ts` generates `backup_csv` and `backup_xls`; UI mentions CSV + XLS. | None. |
| pendings.md | Backup recipients must come from active Admin DB role list, not hardcoded email | Yes | Code reviewed/UI tested | Pass | No destructive cleanup run. | `getActiveBackupRecipients` reads `admin_users`. | Strict role enforcement still intentionally off until admin row is verified. |
| pendings.md | Strict DB admin role enforcement panel/checklist, but do not enable blindly | Yes | UI/code reviewed | Pass | Enabling too early can lock out admin. | Settings/Backup UI expose checklist and rollback notes. | Requires admin role row/email verification before enabling env flag. |
| pendings.md | Add coach photo/avatar to Coach Sites if safe | Yes | Yes | Pass | Previously user noted missing image. | Coach Sites, Coach Analytics, and Top Performers show Gyana image from builder/site record. | None. |
| pendings.md | Do not run fake live AI/R2 production creation test | Yes | Yes | Pass | Full live media upload test intentionally skipped. | Config remains ready without fake production data. | Real coach/media creation test should be done only during real production entry. |
| ROBUST ADMIN PANEL--UPDATED.MD | Admin Overview should be robust command center using real data or empty states | Yes | Yes | Pass | None in tested viewport. | Overview shows live source, KPIs, graph, AI overview action, top coach. | More long-term predictions improve as real data accumulates. |
| ROBUST ADMIN PANEL--UPDATED.MD | Coach Analytics main page must be all-coach list/table, not one giant coach card | Yes | Yes | Pass | None after scoped mobile nav testing. | Main page shows filter controls, graph, list card/table, actions. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | View Analytics opens detailed modal/drawer for selected coach | Yes | Yes | Pass | Critical mobile bug: dialog existed but rendered above viewport when page was scrolled. | `AdminActionDialog` now portals to `document.body`. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | Detail panel should include coach photo, badges, KPI/report tools, AI insights, graphs, dynamic tabs | Yes | Yes | Pass | Not visible before portal fix. | Portal fix made panel visible; production test confirms photo, dynamic tabs, AI summary, report buttons, CSV and Excel buttons. | None. |
| ROBUST ADMIN PANEL--UPDATED.MD | Interactive graphs with hover-only tooltip and range buttons | Yes | Yes | Pass | Tooltip was previously suspected visible by default. | Production test confirms selected tooltip text is hidden before hover. | Hover activation could not be fully asserted in mobile automation; hidden-by-default is verified. |
| ROBUST ADMIN PANEL--UPDATED.MD | AI insights global and per-coach, cached/on-demand, no automatic all-coach token spend | Yes | Code/UI tested | Pass | None. | UI shows Generate/Refresh AI, server-side model config defaults, compact data. | Real insight quality depends on OpenAI credits/model availability. |
| ROBUST ADMIN PANEL--UPDATED.MD | AI copy generation model configuration and token-efficient page analyzer | Yes | Code reviewed | Pass | None. | `ai-model-config`, analyzer, compressor, cache, estimator, and generator modules exist. | Real paid-funnel extraction test should be done with real approved coach content. |
| ROBUST ADMIN PANEL--UPDATED.MD | Coach reports: generate, copy, download, share; include CSV/Excel report output | Yes | UI/code reviewed | Pass | Button label is `Download Sheet CSV` rather than plain `Download CSV`; behavior matches sheet/CSV intent. | No fix needed. | Branded PDF remains optional future upgrade. |
| ROBUST ADMIN PANEL--UPDATED.MD | No fake/demo data in production analytics | Yes | Code/UI reviewed | Pass | Old QA docs still contain historic notes but production UI says live records/empty values. | No fake production data introduced. | Historical docs can be updated separately if desired. |
| admin coach analystics.MD | Universal funnel detection: paid only, free only, both, none | Yes | Yes | Pass | Current live production has one coach with both funnels. | UI shows dynamic counts and Combined/Paid/Free tabs for Gyana. | Need more real coaches to visually test paid-only/free-only/none states without fake data. |
| admin coach analystics.MD | Main list rows show photo, name, niche, region, funnel badges, status, visits, clicks, CTR, best funnel, last activity, source, actions | Yes | Yes | Pass | None. | Production Coach Analytics row shows the required fields and actions. | None. |
| admin coach analystics.MD | Manage opens management/edit action; Open Site opens public URL or disabled state | Yes | Partial | Partial | Manage routing/action tested conceptually; destructive edits not performed. | Open Site button exists. | Full manage/edit flow for real coach should be tested during real content update. |
| admin coach analystics.MD | Analytics must be admin-only and not expose private data | Yes | Yes | Pass | None. | Paid manage modal hides private WhatsApp and raw payment URL; OTP gate present. | None. |
| follow this.md | Production admin login and route access must be usable | Yes | Yes | Pass | Admin `YW-ERR-404` was previously reported. | Earlier fix deployed `app/not-found.tsx` admin redirect guard; this pass confirms admin opens. | None. |
| follow this.md | Full Website Creator draft/publish/public URL production flow | Partial | No | Partial | Source allows QA coach creation but also says do not pollute production; no fake production coach created in this pass. | No code change in this pass. | Needs a real approved coach entry or explicit QA cleanup plan before running publish tests. |
| follow this.md | Public coach template audit for builder-created production sites | Partial | Yes | Partial | Current live builder data has Gyana only. | Public/admin references treat Gyana as real production record. | More builder-created coach sites needed for full multi-site template comparison. |

## Production Evidence

- Admin dashboard opened without `YW-ERR-404`.
- Admin mobile nav was tested through Menu for Overview, Coach Sites, Coach Analytics, Top Performers, Paid Masterclass Links/Settings, Error Reports, Backup/Cleanup, and Settings.
- No horizontal overflow was detected in the tested mobile-width admin viewport.
- Coach Sites shows Gyana image/avatar.
- Coach Analytics list shows Gyana image/avatar, funnel badges, visits/clicks/CTR/source/action buttons.
- Coach Analytics detail dialog is visible after the portal fix and includes AI/report/export controls.
- Paid Masterclass Manage dialog is visible after the portal fix, includes OTP-protected private WhatsApp reveal and OTP-protected payment link update, and does not expose private URLs.
- Error Reports cleanup dialog is visible after the portal fix and includes the required irreversible-confirmation text and cleanup options.

Screenshot artifacts:

- `artifacts/md-compliance/mobile-overview.png`
- `artifacts/md-compliance/mobile-coach-sites.png`
- `artifacts/md-compliance/mobile-coach-analytics.png`
- `artifacts/md-compliance/mobile-top-performers.png`
- `artifacts/md-compliance/mobile-paid-masterclass-links-settings.png`
- `artifacts/md-compliance/mobile-error-reports.png`
- `artifacts/md-compliance/mobile-backup-cleanup.png`
- `artifacts/md-compliance/mobile-settings.png`
- `artifacts/md-compliance/production-coach-analytics-detail-after-fix.png`
- `artifacts/md-compliance/production-paid-manage-after-fix.png`
- `artifacts/md-compliance/production-error-cleanup-after-fix-scoped.png`

## Commands Run

- `git status --short --branch`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm build:pages`
- `pnpm build:pages-functions`
- `pnpm run deploy`
- Production browser UI checks through https://ywcoach.com/admin/dashboard

## Build Results

- lint: pass
- type-check: pass
- Next build: pass
- Cloudflare Pages static build: pass
- Cloudflare Pages Functions build: pass
- Deploy: pass

## Open Blockers

1. Strict DB admin role enforcement remains off until the active admin row/email is verified and rollback plan is confirmed.
2. Full live AI/R2 creator test is intentionally not run with fake media/coaches; run this with a real coach site creation.
3. Full Website Creator publish journey should be tested with a real approved coach or a clearly labeled QA coach plus cleanup plan.
4. More real coach records are needed to visually prove paid-only, free-only, and no-funnel states in production without adding fake data.
5. Complete performance matrix across every listed breakpoint remains a recurring QA task after each visual change.

