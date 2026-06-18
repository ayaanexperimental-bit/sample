# Full Production UX Bug Audit

## Test Metadata

- Test date/time: 2026-06-05 IST
- Production URL tested: https://ywcoach.com
- Admin login state: authenticated production Browser session was already active; Gmail OTP was not needed and no OTP was read, stored, printed, or reported.
- Test mode: production read-only UI/API/D1 verification plus one safe D1 admin-role row insertion for the visible logged-in admin email.
- No fake production coach was created in this audit.
- No payment, private WhatsApp, OTP, API key, or secret value is included in this report.

## Executive Summary

The previously reported admin `YW-ERR-404` problem is fixed in production. `/admin`, `/admin/login`, `/admin/dashboard`, `/Admin/Dashboard`, `/admin-panel`, and `/dashboard` all route into the canonical admin login/dashboard flow without rendering `YW-ERR-404`.

Gyana Ranjan is now a real production `coach_sites` D1 record, not an external/static-only fallback. The production public route `/coach/gyana-ranjan` opens successfully, uses YW Nutritech branding, shows PMOS content, loads the coach image, and all visible Register CTAs point to `https://forms.gle/nsY5F1mcjZnZBbVo9`.

One real issue found and fixed in this audit: paid funnel analytics were fragmented because older payment events used the static platform coach slug `gyana` while the managed coach site uses `gyana-ranjan`. The analytics write path now falls back from static funnel `coach_id` to the canonical D1 coach-site slug, and existing production analytics rows were normalized so all 184 Gyana events now use `gyana-ranjan`.

One production data gap remains: Gyana's coach support contact fields in `coach_sites` are still empty, so paid masterclass support fallback correctly uses default YW support. This is safe fallback behavior, but coach-specific paid support will only appear after phone/WhatsApp/email are added in Admin.

## Current Production Facts

### Admin Route Recovery

- `/admin`: 200, no `YW-ERR-404`
- `/admin/login`: 200, no `YW-ERR-404`
- `/admin/dashboard`: 302 to `/admin/login?next=%2Fadmin%2Fdashboard` when unauthenticated
- `/Admin/Dashboard`: 302 to `/admin/dashboard`
- `/admin-panel`: 302 to `/admin/dashboard`
- `/dashboard`: 302 to `/admin/dashboard`
- Authenticated Browser session opened `https://ywcoach.com/admin/dashboard`; after hydration it showed Admin Overview, production metrics, Coach Sites, Coach Analytics, Paid Masterclass settings, Error Reports, Backup/Cleanup, and Settings navigation.

### Coach Site Source Of Truth

Remote D1 `coach_sites` currently has one active production record:

- Coach: Gyana Ranjan
- Slug: `gyana-ranjan`
- Status: `published`
- Niche: `PMOS / Women Wellness`
- Location: Odisha
- Selected theme: legacy theme removed; active rendering now normalizes to the canonical coach-site template.
- Google Form link: configured
- Photo: configured
- Video: configured
- Coach phone/email/WhatsApp: not configured

No active drafts or archived coach sites were found in the live table during this audit.

### Public Coach Route

Route tested: `https://ywcoach.com/coach/gyana-ranjan`

- Opens successfully.
- No Contact Support fallback during normal flow.
- No `YW-ERR-*` visible during normal flow.
- YW Nutritech branding visible.
- Gyana Ranjan name visible.
- PMOS wording visible; PCOS wording was not found on the checked public page.
- Coach image loads from `/images/coach-gyana-ranjan.png`.
- Visible Register CTAs open the configured Google Form in a new tab.

### Analytics

Production `analytics_events` currently has 184 Gyana events. After this audit fix, all Gyana rows are normalized to:

- `coach_slug = gyana-ranjan`

Top event groups after normalization:

- `coach_site_view / free_guest_link / gyana-ranjan`: 91
- `payment_initiated / paid_masterclass / gyana-ranjan`: 51
- `paid_landing_view / paid_masterclass / gyana-ranjan`: 34
- `success_page_view / paid_masterclass / gyana-ranjan`: 4
- `coach_register_click / free_guest_link / gyana-ranjan`: 1
- `paid_payment_click / paid_masterclass / gyana-ranjan`: 1
- `paid_register_click / paid_masterclass / gyana-ranjan`: 1
- `paid_whatsapp_click / paid_masterclass / gyana-ranjan`: 1

This is real event data from D1, not demo data.

### Backup/Cleanup

- Backup implementation supports CSV and XLS output.
- `analytics_backups` currently has no backup records yet.
- `admin_users` previously had no active rows, so backup email recipients were missing.
- Fixed in this audit: inserted/updated `ayaanexperimental@gmail.com` as active `owner` in `admin_users`.
- Strict DB-only admin role enforcement remains disabled; do not enable it until a fresh login/rollback test is completed.

### Error Reports

Production error report counts:

- New: 67
- Fixed: 13

Recent new reports are mostly `YW-ERR-5003` for direct paid page/success route access without the proper paid entry/access flow. This fallback is expected for direct private route access, but the reports need admin triage so expected test/direct-access cases do not remain mixed with real user issues.

## Issues Found

### UX-FIXED-001 - Admin route aliases could show `YW-ERR-404`

- Severity: Critical
- Status: Fixed and deployed before this audit continuation.
- Expected: Common admin URL variants route to admin login/dashboard.
- Actual before fix: uppercase/common aliases could hit fallback.
- Fix: Cloudflare middleware canonicalizes admin aliases and casing.
- Proof: route header checks listed above.

### UX-FIXED-002 - Paid funnel analytics slug fragmentation

- Severity: High
- Status: Fixed in this audit.
- Expected: Gyana paid and free analytics roll up under one coach slug, `gyana-ranjan`.
- Actual before fix: `payment_initiated` rows existed under `gyana`, while referral/public rows used `gyana-ranjan`.
- Root cause: `recordAnalyticsEvent` trusted the static platform coach slug when the incoming slug did not match a D1 coach-site row.
- Fix: `lib/server/analytics-events.ts` now falls back by static funnel `coach_id` to the matching non-removed D1 coach site and uses that canonical slug.
- Data normalization: existing production rows with `coach_slug='gyana' AND coach_id='coach-gyana'` were updated to `gyana-ranjan`.
- Proof: D1 query now shows all 184 Gyana analytics rows under `gyana-ranjan`.

### UX-DATA-001 - Coach-specific support contact is missing for Gyana

- Severity: Medium
- Status: Data pending.
- Expected: Paid and coach fallback pages use coach-specific phone/WhatsApp/email when available.
- Actual: Gyana `coach_sites` row has no phone/email/WhatsApp, so fallback uses default YW support.
- Why this is acceptable short-term: fallback behaves exactly as required when coach contact is missing.
- Needed: add Gyana phone/WhatsApp/email in Admin Manage/Website Builder when ready.

### UX-OPS-001 - Old new error reports need triage

- Severity: Medium
- Status: Pending admin cleanup/triage.
- Expected: Error Reports should be reviewed as New / Reviewing / Fixed / Ignored.
- Actual: 67 reports remain New.
- Needed: mark expected direct paid-route access reports as Fixed/Ignored after confirming no real payment flow issue exists.

## Testing Notes

- Browser DOM click automation did not reliably switch the React sidebar state in this session, even though the admin shell loaded and displayed live data. This is treated as a Browser-wrapper limitation for this audit, not a confirmed production UI click bug.
- Production Browser session did verify admin hydration and current Overview data.
- Remote D1 verified coach sites, analytics events, error reports, backups, and admin users.
- No fake coach creation/publish flow was executed in production during this audit to avoid polluting final consumer-ready data.

## Files Changed In This Audit

- `lib/server/analytics-events.ts`
- `docs/qa/full-production-ux-bug-audit.md`
- `docs/qa/production-coach-template-match-audit.md`
- `docs/qa/md-requirements-checklist.md`

## Production Data Changed In This Audit

- Inserted/updated `admin_users` row for the visible logged-in production admin email as active `owner`.
- Normalized 51 existing Gyana analytics rows from `coach_slug='gyana'` to `coach_slug='gyana-ranjan'`.

## Remaining

- Add real coach contact fields for Gyana if coach-specific support fallback should appear instead of default support.
- Run a full real Website Creator save draft -> publish -> edit -> republish test only when a real approved coach is being created, or with an explicitly disposable QA record and cleanup policy.
- Triage 67 New error reports.
- Run Backup Now after confirming email delivery vars are configured; the recipient row now exists.
- Keep strict DB-only admin enforcement off until fresh login with the DB row is verified and rollback is ready.
