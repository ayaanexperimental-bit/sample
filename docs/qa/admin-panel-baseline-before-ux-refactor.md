# Admin Panel Baseline Before UX Refactor

Source of truth: `C:\Users\Yours Wellness\Desktop\allia.md`

Old source-of-truth files ignored for this baseline. This report captures current production/admin behavior before implementing the `allia.md` admin UX refactor.

## Safety Backup

| Item | Result |
| --- | --- |
| Current branch | `codex/ywcoach-platform-migration` |
| Backup branch | `backup/admin-ux-before-refactor-20260605-215108` |
| Dirty worktree before refactor | Clean |
| Modified files before refactor | None |
| Untracked files before refactor | None |

## Baseline Environment

| Item | Result |
| --- | --- |
| Admin URL | `https://ywcoach.com/admin/dashboard` |
| Auth method | Production email OTP |
| OTP handling | Used only for current login session; not stored in this report |
| Browser console | No relevant errors during baseline login/dashboard load |
| Screenshot folder | `docs/screenshots/admin-baseline-before-ux-refactor/` |

## Baseline Module Status

| Module | Current status | Notes |
| --- | --- | --- |
| Admin Login | Working | `/admin/dashboard` redirects to `/admin/login?next=/admin/dashboard`; OTP login returned to dashboard. |
| Logout | Not executed | Baseline kept the session active for module testing. |
| Overview | Working / cluttered | Loads KPIs and AI/analytics sections. Uses several large cards and full page-like vertical space. Session check loader can feel slow before dashboard appears. |
| Website Creator | Working / cluttered | Opens as a modal wizard from Create Coach Site. The modal is large and contains internal flow, but still visually heavy. Mutation flows were not executed against production to avoid fake coach records. |
| Coach Sites | Working | Published Gyana referral record appears. Drafts area appears. Archived menu exists. Actions are reachable but mostly text-heavy. |
| Coach Analytics | Working / partial UX | Main page shows coach list/table and View Analytics opens a panel. Large dashboard/card areas still feel heavy and need compacting. |
| Error Reports | Working / cluttered | Page opens and list is visible. Clear flow is present. Clear mutation was not executed during baseline to avoid deleting real reports before refactor. |
| Backup/Cleanup | Working / cluttered | Page opens and protected backup/cleanup controls are visible. Long explanatory/status cards are present. Mutation flows were not executed during baseline. |
| Settings | Working / cluttered | Page opens. Settings are mostly status cards and explanations rather than compact settings panels. |
| Public Coach Page | Working | `/coach/gyana-ranjan` opens on mobile baseline. Public site was not redesigned by this task. |
| General navigation | Working | Sidebar navigation changes modules. Desktop sidebar is visible; mobile uses menu button. |
| Full-page scroll model | Partial / UX issue | Admin shell has internal overflow, but the app container is not strongly viewport-locked and topbar/sidebar are not sticky inside the dashboard workspace. |
| Dialogs/drawers | Partial | Some actions use dialogs, but multiple modules still show large inline sections and large action buttons. |
| Action feedback | Partial | Loading/message states exist for many actions, but feedback is inconsistent and sometimes inline instead of dashboard-level. |
| Mobile responsiveness | Partial | Mobile renders, but key pages stack into long vertical pages; actions become full-width and page still feels like a long webpage. |

## Baseline UX Issues Found

| UX issue ID | Surface | Evidence | Severity |
| --- | --- | --- | --- |
| UX-BL-001 | Admin shell | Topbar/sidebar are not sticky in the desktop dashboard workspace. | High |
| UX-BL-002 | Admin shell | Admin app does not enforce a strong viewport-height locked workspace; long modules still feel page-like. | High |
| UX-BL-003 | Overview / Backup / Settings | Large explanatory/status cards remain visible by default. | Medium |
| UX-BL-004 | Actions | Common actions are mostly large text buttons instead of compact icon/menu actions with tooltips. | Medium |
| UX-BL-005 | AI actions | AI is compact in places, but still appears as large AI/status panels after generation and needs contextual polish. | Medium |
| UX-BL-006 | Mobile | Mobile dashboard remains readable but becomes a long stacked page; internal module scrolling needs stronger behavior. | High |
| UX-BL-007 | Session loader | On reload, “Checking Session” stayed visible for several seconds before the dashboard appeared. | Medium |

## Baseline Screenshots

- `01-overview-desktop.png`
- `02-coach-sites-desktop.png`
- `03-website-creator-desktop.png`
- `04-coach-analytics-desktop.png`
- `05-view-analytics-panel-desktop.png`
- `06-error-reports-desktop.png`
- `07-backup-cleanup-desktop.png`
- `08-settings-desktop.png`
- `09-overview-tablet.png`
- `10-overview-mobile.png`
- `11-public-coach-mobile.png`

Authenticated admin email areas were redacted from admin screenshots.

## Baseline Expected vs Actual

| Flow | Expected from allia.md | Baseline actual | Baseline result |
| --- | --- | --- | --- |
| Save Draft | Draft saves, feedback appears, Drafts updates. | Flow exists; production mutation not executed in baseline to avoid fake records. Covered by existing admin security tests later. | Needs post-change test |
| Publish Site | Loading, success, public link, Published list update. | Publish progress UI exists; production mutation not executed in baseline. | Needs post-change test |
| Clear Error Reports | Confirmation, clear, close, list updates. | Confirmation flow exists; not executed in baseline to preserve real reports. | Needs post-change test |
| Archive Site | Confirmation, site moves to Archived. | Action exists through Manage flow; not executed in baseline. | Needs post-change test |
| Reactivate Site | Archived site restores to previous active status. | Reactivate exists; no archived production record tested in baseline. | Needs post-change test |
| View Analytics | List remains clean, selected coach opens detail panel. | Passed. | Working |
| AI Assistant | Compact icon/menu, no clutter. | Partial; AI actions exist but need more compact contextual polish. | Partial |
| Settings Save | Loading/success and persisted values. | No active editable settings save executed in baseline. | Needs post-change test |
| Tooltip Behavior | Delayed hover/focus tooltip instead of explanation cards. | Not consistently implemented. | Partial |

