# Heavy Failure-Point Reliability Audit

Date: 2026-06-06

Source of truth used: `C:\Users\Yours Wellness\Desktop\robust testing.md`

Old `.md` files ignored: yes. This report only tracks the current `robust testing.md`.

## Executive Summary

The current implementation strengthens the highest-risk admin and coach-site reliability gaps found in the active source-of-truth file:

- Admin AI buttons now show a body-level working/result drawer instead of cramped content spilling into the page; the drawer is viewport-contained on desktop and mobile.
- Error Reports now default to Active issues, and Mark Fixed updates the UI immediately without requiring refresh.
- Save Draft now has duplicate-click protection and a visible `Saving...` state.
- Coach Website Creator copy generation now uses a broader structured content slot registry so public and preview templates can render niche-aware content instead of generic hardcoded placeholder sections.
- Public coach template rendering now reads the expanded content slots in both the React route and the Cloudflare Pages Function route.
- Mobile Error Reports text wrapping was hardened to avoid clipped safe messages.

## Requirement Checklist

| Requirement | Implemented | Tested | Result | Issue found | Fix applied | Re-test result | Remaining blocker |
|---|---:|---:|---|---|---|---|---|
| Universal action feedback for serious admin actions | Partial | Yes | Partial | Scope is platform-wide; current pass targeted AI, Error Reports, Save Draft, Publish panel already present | Added `ActionToast`, AI busy drawer, Mark Fixed loading, Save Draft busy state | Passed targeted flows | Full activity center and every single admin action still need broader production click pass |
| Button-level micro feedback | Partial | Yes | Partial | Save Draft button did not show loading | Added `draftSubmitting` state/ref and `Saving...` text | Delayed POST test passed | Some existing actions still use older inline status only |
| AI report/generation feedback | Yes | Yes | Pass | AI panel content was cramped, mixed with page content, and mobile fixed positioning could be clipped by admin scroll | Moved AI drawer into a React portal, added viewport-contained desktop/mobile sizing, scroll containment, working text, async action handling, error message | Desktop and 390px mobile portal screenshots verified; no horizontal overflow | None for current AI panel |
| Result highlight after actions | Partial | Yes | Pass for Error Reports | Fixed report stayed visually stale in Active list | Added optimistic report status update and highlight marker | Mark Fixed test passed | Draft row highlight is visual through list update, not a timed pulse yet |
| Full overlay only for long-running actions | Partial | Yes | Pass for tested flows | Publish already had progress panel; AI used cramped popover | AI drawer made compact; publish panel retained | Screenshots passed | Backup/Cleanup animation not fully covered in this edit |
| Real-time UI updates after mutation | Yes for Error Reports and draft save | Yes | Pass | Mark Fixed remained in Active list in previous UX | Optimistic local state update, refresh with preserved updated status, close detail dialog on Fixed/Ignored | Active count 2 -> 1, Fixed tab shows item, All tab shows item | Production live D1 test still recommended after deploy |
| Reduced clutter/no noisy animations | Yes | Visual | Pass | AI result card was visually mashed up | Contained scrollable drawer, no full-page overlay for simple AI results | Screenshot verified | None |
| Accessibility for feedback | Partial | Code/visual | Pass for touched components | AI menu role was not ideal and busy state was missing | Added `role="dialog"`, `aria-busy`, `aria-live`, disabled duplicate clicks | Typecheck/lint passed | Full keyboard audit remains a future hardening pass |
| Apply feedback to Website Creator Save Draft | Yes | Yes | Pass | Save Draft felt dead and could be clicked repeatedly | Added draft submitting guard and UI text | Delayed draft save test passed | None for Save Draft |
| Apply feedback to Publish | Yes | Build/visual | Pass | Previous work already had progress; current change preserved it | Publish panel keeps copy link hidden until verified success | Build passed; code inspected | Full production publish test needs real coach data/API session |
| Apply feedback to Error Reports Mark Fixed | Yes | Yes | Pass | Fixed item remained in active list | Fixed filters/state/refetch/status message | Passed UI flow | None |
| Error Report filters Active/New/Reviewing/Fixed/Ignored/All | Yes | Yes | Pass | Needed active exclusion of Fixed/Ignored | Existing filters verified with fixed flow | Active excludes Fixed; Fixed/All include item | None |
| Clear Old Error Reports feedback | Partial | Code inspected | Partial | Clear flow exists but delete animation is not a full dustbin/progress animation | Existing confirmation + busy state retained | Not fully retested in this pass | Needs broader Backup/Cleanup/Error Reports production pass |
| Full template text slots dynamic/editable | Partial | Code/build/public route | Partial | Several visible sections still came from hardcoded generic text | Added content slot registry and expanded form/content fields, AI schema, public React renderer, Cloudflare renderer | Build and public route tests passed | Universal inspect click-to-edit for every exact text node is still not fully proven |
| AI generates structured full website content object | Yes | Typecheck/build | Pass | AI schema only covered a few sections | Expanded JSON schema and required fields from registry | Typecheck/build passed | Live OpenAI production generation not run in this pass to avoid creating fake production records |
| Section-level regeneration | Partial | Code/build | Partial | Section list missed problem/journey/media/footer | Added scopes and form mapping | Build passed | Click-level inspect/regenerate needs deeper live creator test |
| Copy quality validation | Yes | Typecheck/build | Pass | Placeholder-style output could be accepted | Added usable-copy checks for placeholder terms and empty arrays | Typecheck/build passed | Live AI quality still depends on model output |
| Public page renders generated content | Yes | Yes | Pass | Public renderer and Pages Function needed expanded fields | React and Cloudflare renderer now read new content slots | `/coach/gyana-ranjan` tested at 320, 390, 768, 1024, 1440 | Register URL depends on real coach data |
| Contact Support only as fallback | Yes | Public route | Pass | Normal public route must not show Contact Support | No normal contact card rendered; support fallback remains hidden | Public route test: fallback not shown | Actual fallback pages still should be sampled in production |
| Error/fallback logging not exposed publicly | No new fallback added | Code inspected | Pass | This change did not introduce new public failure flow | Existing error-report API untouched except UI handling | Build passed | No new code needed |
| Mobile/tablet/desktop visual reliability | Yes for touched public/admin routes | Yes | Pass | Mobile error details and AI drawer could be clipped by constrained admin layout | Removed mobile line clamp, added wrap rules, moved AI drawer to body portal, contained scroll | Mobile overflow false; AI drawer box 390x844 at 390px viewport | More admin pages should be sampled in broader release QA |
| Codebase audit and final QA report | Yes | Yes | Pass | Report file did not exist | Created this audit file | Completed | None |

## Expected vs Actual

| Flow | Step | Expected | Actual after fix | Result |
|---|---|---|---|---|
| Error Reports | Open default page | Active tab shows New + Reviewing | Active showed 2 active reports in test data | Pass |
| Error Reports | Run AI Group Similar Issues | Loading appears, result not mashed into page | Immediate loading text appeared; final result stayed inside drawer | Pass |
| Error Reports | Mark one New report Fixed | Report disappears from Active immediately | Active count changed from 2 to 1; fixed report removed from Active | Pass |
| Error Reports | Fixed tab | Fixed report appears | Fixed tab showed the report | Pass |
| Error Reports | All tab | Fixed report remains visible with status | All tab showed the report | Pass |
| Error Reports mobile | Open AI assistant at 390px | Drawer remains readable, scrollable, and inside viewport | Portal drawer rendered at x=0, y=0, width=390, height=844 with no body overflow | Pass |
| Website Creator | Save Draft with delayed API | Button shows `Saving...`, then success | `Saving...` visible; `Draft saved successfully.` visible | Pass |
| Public Coach Page | Open normal route | No Contact Support fallback during successful load | `/coach/gyana-ranjan` loaded YW template and coach name, no support fallback | Pass |
| Mobile public route | 320/390/768/1024/1440 | No horizontal overflow | Overflow false at tested breakpoints | Pass |

## Major Failure Points Found

1. AI report drawer could visually overlap and mash results into underlying content, especially when opened from admin page action areas.
2. Mark Fixed updated the server but stale UI could leave the report in Active.
3. Save Draft had no loading state and no duplicate-click guard.
4. Coach template content model did not cover all visible template text slots.
5. Mobile Error Reports safe-message text could be clipped by line clamping.

## Root Causes

- AI actions were synchronous from the UI perspective and did not keep a guaranteed working state visible.
- The AI drawer originally lived inside the admin page action cluster, so fixed/static positioning could inherit cramped layout or scroll offsets.
- Error Reports state refresh could reintroduce stale status before the UI reflected the mutation.
- Save Draft reused the generic upsert flow without its own action state.
- Template preview/public renderer had hardcoded visible copy not represented in builder form or AI schema.
- Mobile Error Reports styles used clamping instead of safe wrapping.

## Fixes Applied

- Added async AI action handling, minimum visible working state, error state, and contained scrollable AI drawer rendered through a body-level React portal.
- Added Error Reports optimistic status update, status-preserving refetch, row highlight, loading state, and toast.
- Added Save Draft `draftSubmitting` state/ref, disabled duplicate clicks, and `Saving...` button text.
- Added `lib/coach-template-content-slots.ts`.
- Expanded `CoachSiteContent`, form state, AI schema, generation scopes, validators, builder editors, React renderer, and Cloudflare renderer.
- Removed mobile safe-message clipping and added `overflow-wrap`/`word-break` protection.

## Error Fallbacks Added Or Updated

No new public error-code fallback was added in this pass because the changed flows are admin UI state handling and content-slot normalization. The reliability rule was followed: fix the working flow first, keep Contact Support as the existing emergency fallback only.

## Codebase Risk Patterns Found

- Local Next dev does not serve Cloudflare Pages Functions admin APIs, so authenticated admin UI tests require route mocks locally.
- Incomplete test coach-site mock objects can crash the dashboard; real server normalization protects actual D1 rows, but test fixtures must use normalized records or empty lists.
- Broad production-level action feedback is partially implemented; some non-touched actions still use existing inline statuses instead of the full premium animation system.

## Mobile / Tablet / Desktop Notes

- Error Reports mobile: no horizontal page overflow at 390px.
- Public coach route: no horizontal overflow at 320, 390, 768, 1024, 1440.
- Public coach route: YW Nutritech and coach identity rendered; Contact Support fallback did not appear during normal load.
- AI drawer desktop: readable, scroll-contained, not mashed into the page.
- AI drawer mobile 390px: full viewport, readable, no top clipping, no horizontal overflow.

## Commands Run

- `git status --short --branch`
- `git diff --stat`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Local Playwright/Chromium smoke tests through Node for admin Error Reports, AI drawer, Save Draft feedback, public coach page breakpoints, and portal-based mobile drawer containment.

## Build / Lint / Typecheck

- `pnpm typecheck`: Pass
- `pnpm lint`: Pass
- `pnpm build`: Pass

## Visual Evidence

Local screenshots saved under:

- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\error-reports-ai-flow-desktop.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\error-reports-fixed-flow-desktop.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\error-reports-ai-drawer-desktop-portal.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\error-reports-ai-drawer-mobile-portal.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\creator-save-draft-feedback-desktop.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\error-reports-mobile-final.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\public-coach-mobile-320-final.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\public-coach-mobile-390-final.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\public-coach-tablet-768-final.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\public-coach-laptop-1024-final.png`
- `C:\Users\Yours Wellness\Documents\Codex\artifacts\robust-admin-ui\public-coach-desktop-1440-final.png`

## Remaining Risks / Blockers

- Production admin OTP/Gmail session was not used in this pass; local authenticated admin behavior was tested with protected API mocks because local Next does not serve Cloudflare Pages Functions.
- Full production Website Creator publish with real OpenAI/R2 was not run because creating fake production coaches/media would pollute production data.
- Global Activity Center and every single serious admin action animation are not fully implemented everywhere; current pass covers the highest-priority broken UX paths from this edit.

Final reliability confidence: Partial
