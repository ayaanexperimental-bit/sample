# Next Task Goal — Finish Current Admin AI / Admin V2 Work

Use this file as the continuation prompt in a new Codex task.

## Objective

Finish the current Admin AI Copilot / Admin V2 objective completely from the repository's present state. Do not restart the project, replay the old chat, or accept older completion reports as proof.

The only current product specification is:

1. `C:\Users\Yours Wellness\.codex\attachments\57742b3b-3178-48ea-ab09-c5d171aa5dbd\pasted-text-1.txt`
   - 612 lines
   - Sections 1–21
   - SHA-256: `031CF2D157DE151EEDE82AD84B7ACF2DAEDBE5E5BFF5C3882836B4339DBA9FE4`
2. `C:\Users\Yours Wellness\.codex\attachments\57742b3b-3178-48ea-ab09-c5d171aa5dbd\pasted-text-2.txt`
   - 1,414 lines
   - Sections 22–65
   - SHA-256: `5B438515D09C477CBC52C19FD1D47A4C14F3EF534806D68CA9EC98176E3B206C`

`C:\Users\Yours Wellness\Documents\Codex\CURRENT_ADMIN_AI_SPEC_REQUIREMENT_CHECKLIST.md` currently records 1,173 atomic requirements. Treat it as a tracking baseline, not as proof that its old Partial/Fail statuses are still current.

## Repository Truth at Handoff

- Repository: `C:\Users\Yours Wellness\Documents\Codex`
- Branch: `integration/admin-v2-od-real-wiring-20260703-231720`
- Upstream: matching `origin/integration/admin-v2-od-real-wiring-20260703-231720`
- Dirty tree at handoff: 52 tracked changes + 82 untracked paths = 134 changed paths.
- Preserve every existing change. Never reset, revert, delete, clean, stage, commit, push, or deploy without first verifying exact scope and receiving authority where required.
- Project graph exists at `C:\Users\Yours Wellness\Documents\Codex\graphify-out\graph.json`; it was last modified on 2026-07-27 at 11:54:59 IST. Query it first for architecture/dependency questions, then verify every inferred edge in source.
- Headroom was listening on protected port `8787`.
- Local Admin V2 was listening on `4802`, but it served an older static build. Do not use that runtime as final proof; rebuild and restart it before final browser verification.

## Work Already Present — Do Not Recreate

- Large uncommitted Admin AI implementation across UI, orchestration, RBAC, context, memory, actions, safety, reports, health, incidents, knowledge, model routing, settings, schedules, observability, artifacts, persistence, and tests.
- Admin V2 OD CSS isolation work:
  - generated/scoped OD stylesheet
  - malformed selector/token corrections
  - namespaced keyframes
  - portal scope for dialogs and AI panel
  - focused CSS regression test
- Admin auth-shell performance work:
  - lazy classic/V2 dashboard loading after authentication
  - stable Suspense fallback
  - artifact-size checker and regression test
  - focused verification previously passed, but a combined final build is still required
- `tests/e2e/admin-v2-copilot-resilience-matrix.spec.ts` now includes:
  - exact selected-coach identity continuity and fail-closed assertions
  - throttle-safe direct OTP verification
  - schema-complete route fixtures
  - focused test previously passed against the old `4802` build, so it must be rerun after the combined rebuild

Nothing was staged, committed, pushed, deployed, reset, reverted, or cleaned in the handoff step.

## Required Continuation Procedure

1. Start with `git status`, current branch, diff statistics, untracked inventory, and current port/process checks.
2. Read the two authoritative specification files completely, then read:
   - `CURRENT_ADMIN_AI_SPEC_REQUIREMENT_CHECKLIST.md`
   - current source diffs and newly added tests
   - relevant current audit/handoff files only as evidence
3. Give a short current-state report before editing. State what is already implemented, what is unverified, and the exact remaining code-fixable gaps.
4. Do not spawn broad duplicate audits. Divide only concrete remaining gaps, and never let parallel agents edit overlapping files.
5. Reconcile the working tree against all 65 specification sections. Verify current code before assuming an old checklist row is still failing.
6. Implement only real remaining gaps. Preserve production functionality, native OD Admin V2 UI, auth/RBAC, cross-coach isolation, approval/OTP rules, fail-closed audit behavior, redaction, prompt-injection defenses, and no-wrapper behavior.
7. Do not downgrade the latest panel. The target is:

   `latest Admin V2 = all safe production-admin functionality + all approved newer upgrades, without old-UI leakage, security regression, fake behavior, or visual regression`

8. After code settles, perform one combined flagged build, restart the local `4802` runtime, and run fresh verification against that exact artifact.
9. At minimum, run the repository's available equivalents of:
   - type-check
   - lint
   - standard build
   - flagged Pages build
   - Pages Functions build
   - complete Admin security suite
   - focused Admin AI contract/security/persistence tests
   - Admin V2 owner and limited-role browser flows
   - the Copilot resilience matrix
   - desktop/tablet/mobile responsive checks
   - affected public-route checks
   - error/fallback, reload persistence, save/read/update sync, and service-unavailable behavior
10. Fix every discovered code bug and rerun the exact failed flow.
11. Update the 1,173-requirement checklist with current evidence. No internal `Partial`, `Fail`, or unclassified pending item may remain.
12. Produce one final current completion report containing:
   - authoritative source files and hashes
   - total/completed/pending requirement counts
   - bugs found and fixed
   - exact files changed
   - exact commands and results
   - UI, responsive, role, security, persistence, and public-route results
   - external blockers, if any
   - final status

## Completion Boundary

Allowed final statuses:

1. `Completed and tested`
2. `Blocked only by an exact external credential, secret, production permission, provider/API access, production data permission, or user-side dependency`

Do not call the goal complete because a build passed, because an old report says PASS, or because a test ran against the stale `4802` artifact. Do not commit, push, deploy, or mutate production unless the user explicitly authorizes that exact action after scope verification.
