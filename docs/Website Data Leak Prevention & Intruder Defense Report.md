# Website Data Leak Prevention & Intruder Defense Report

Audit date: 2026-06-01
Project audited: `C:\Users\Yours Wellness\Documents\Codex`
Scope: Current YW Coach production codebase, with special focus on admin auth, data leaks, APIs, payment/success flow, deployment risk, and production readiness.

## 1. Executive Summary

The project is a Next.js 16 App Router static export deployed to Cloudflare Pages with Cloudflare Functions, Wrangler, D1, Google OAuth, Resend email OTP, Razorpay links/webhooks, and signed coach funnel cookies.

No real `.env` file or direct secret value was found committed. Only `.env.example` is tracked. Server secrets are referenced through Cloudflare environment bindings. Admin OTP values are hashed before D1 storage, not stored as plain OTPs. Admin sessions use signed HttpOnly cookies with SameSite controls.

The main security gaps are not active data leaks today, but production-hardening gaps before the admin panel becomes real:

- Admin rate limiting is still a placeholder in `lib/server/admin-rate-limit.ts`.
- Several admin audit paths still use a placeholder logger in `lib/server/admin-audit.ts`.
- `/admin` is a static client-rendered shell; before real admin data exists, server-side admin gating must be added.
- Current CSP headers are incomplete because there is no `default-src`, `script-src`, or `style-src`.
- Legacy placeholder endpoints for password login, demo OTP, forgot password, and reset password still exist.
- WhatsApp group links are not in the public static output, but they are present in source config and should move to server-only storage before scaling.
- `pnpm format:check` currently fails on existing files.

No risky fix was applied in this audit.

## 2. Critical Risks

No confirmed Critical live exploit was found during this inspection.

## 3. High Risks

### Bug/Risk ID: SEC-001
Title: Admin rate limiting is a placeholder
Category: Admin login attacks, OTP abuse, API abuse
Severity: High
Location: `lib/server/admin-rate-limit.ts:16`
Affected data: Admin session access, OTP delivery, admin availability
How an intruder could abuse it, safe high-level only: Automated callers could repeatedly hit admin login/OTP endpoints and cause OTP spam, brute-force pressure, or provider abuse.
Actual issue: `checkAdminRateLimit` always returns allowed.
Expected secure behavior: Per-IP, per-email, per-action rate limits with progressive delays and audit logs.
Recommended fix: Implement Durable Object, D1, or Cloudflare-native rate limiting for admin actions.
Exact file/config area: `lib/server/admin-rate-limit.ts`, all `functions/api/admin/auth/*`
Must fix before production: Yes, before real admin features.
Risk of fixing: Medium, because bad limits can lock out the real admin.
Priority: P0

### Bug/Risk ID: SEC-002
Title: Admin audit logger is incomplete for several endpoints
Category: Detection and recovery
Severity: High
Location: `lib/server/admin-audit.ts:21`
Affected data: Admin access trail, incident response evidence
How an intruder could abuse it, safe high-level only: Repeated suspicious admin attempts may not be visible if they go through older placeholder endpoints.
Actual issue: `recordAdminAuditEvent` is a TODO and does not persist.
Expected secure behavior: Every admin attempt, failure, logout, password reset request, and MFA event is logged safely.
Recommended fix: Route all admin audit events into D1 with masked/minimized metadata; never store OTP/password/token values.
Exact file/config area: `lib/server/admin-audit.ts`, `database/admin-auth.sql`
Must fix before production: Yes, before real admin operations.
Risk of fixing: Low to Medium.
Priority: P0

### Bug/Risk ID: SEC-003
Title: Admin page is a public static shell
Category: Admin route bypass
Severity: High for future real admin features; Medium today
Location: `app/admin/page.tsx:14`
Affected data: Future admin dashboard data
How an intruder could abuse it, safe high-level only: If real admin data is rendered into the static/client shell later, unauthenticated visitors could receive sensitive HTML or client payloads.
Actual issue: Current `/admin` loads publicly and relies on client session check to show dashboard placeholder.
Expected secure behavior: Real admin dashboard pages must be protected server-side or rendered only after an authenticated admin API/session check.
Recommended fix: Keep login page public, but move dashboard to a guarded route/API boundary with `requireAdmin`.
Exact file/config area: `app/admin/page.tsx`, future admin dashboard routes, `lib/server/admin-auth.ts`
Must fix before production: Yes, before adding real admin data.
Risk of fixing: Medium because this app is static export plus Functions.
Priority: P0

### Bug/Risk ID: SEC-004
Title: CSP is incomplete
Category: XSS / browser hardening
Severity: High
Location: `public/_headers:6`
Affected data: User/admin browser sessions, page integrity
How an intruder could abuse it, safe high-level only: If an injection bug appears later, weak CSP gives the browser less protection against script execution.
Actual issue: CSP has `base-uri`, `object-src`, `frame-ancestors`, etc., but no `default-src`, `script-src`, or `style-src`.
Expected secure behavior: Deny-by-default CSP with explicit script/style/connect/img/frame policies compatible with Next static output.
Recommended fix: Add a tested CSP policy. Because Next uses inline/runtime scripts, test carefully before production.
Exact file/config area: `public/_headers`
Must fix before production: Yes for strong admin security.
Risk of fixing: Medium to High because strict CSP can break Next hydration if not tested.
Priority: P0

### Bug/Risk ID: SEC-005
Title: Legacy demo OTP endpoint remains in code
Category: OTP/MFA
Severity: High if demo env is accidentally enabled; Low if disabled
Location: `functions/api/admin/auth/verify-otp.ts:61`
Affected data: Admin session access
How an intruder could abuse it, safe high-level only: If `ADMIN_AUTH_DEMO_ENABLED=true` and a weak/shared demo OTP is configured, the endpoint can create an admin session for an allowlisted email.
Actual issue: Demo OTP logic is still present.
Expected secure behavior: Production admin auth should only use Google OAuth and/or real email OTP/TOTP flows.
Recommended fix: Remove or hard-block demo OTP endpoint in production after migration.
Exact file/config area: `functions/api/admin/auth/verify-otp.ts`, Cloudflare env vars
Must fix before production: Yes, before real admin dashboard launch.
Risk of fixing: Low if email OTP/Google auth are working.
Priority: P1

## 4. Medium Risks

### Bug/Risk ID: SEC-006
Title: Placeholder password reset endpoints are publicly reachable
Category: Forgot password attacks
Severity: Medium
Location: `functions/api/admin/auth/forgot-password.ts:42`, `functions/api/admin/auth/reset-password.ts:54`
Affected data: Future admin credentials
How an intruder could abuse it, safe high-level only: Public reset surfaces can be spammed or mistaken as live if connected later without token validation.
Actual issue: The endpoints return safe placeholder responses and do not change passwords, but they are reachable.
Expected secure behavior: Either disable until implemented, or require real one-time reset tokens and rate limits.
Recommended fix: Return 404/501 until password auth is actually launched, or implement full reset token flow.
Exact file/config area: `functions/api/admin/auth/forgot-password.ts`, `functions/api/admin/auth/reset-password.ts`
Must fix before production: Yes if email/password auth is launched.
Risk of fixing: Low.
Priority: P1

### Bug/Risk ID: SEC-007
Title: CSRF protection is documented but not implemented for future admin mutations
Category: CSRF
Severity: Medium now; High later
Location: `lib/server/admin-auth.ts:72`
Affected data: Future admin mutations
How an intruder could abuse it, safe high-level only: A signed-in admin could be tricked into triggering state-changing actions from another site if no CSRF validation exists.
Actual issue: Current sensitive admin mutations are not built yet. Logout is POST and cookie-based.
Expected secure behavior: CSRF token or strict Origin/Referer checks on every cookie-authenticated state-changing admin API.
Recommended fix: Add CSRF middleware/helper before adding real admin write APIs.
Exact file/config area: `lib/server/admin-auth.ts`, future `functions/api/admin/*`
Must fix before production: Yes, before real admin write APIs.
Risk of fixing: Medium.
Priority: P1

### Bug/Risk ID: SEC-008
Title: WhatsApp group URL is in source config
Category: Private link exposure
Severity: Medium
Location: `lib/coach-platform.ts:208`
Affected data: Private WhatsApp group link
How an intruder could abuse it, safe high-level only: Anyone with repo/source access can see the group invite even though the public static output does not expose it.
Actual issue: The link is not found in `out` public static output, but it exists in source code.
Expected secure behavior: Private join URLs should live in server-only env/D1/admin-controlled storage.
Recommended fix: Move `whatsappGroupUrl` to D1/server-only config before scaling coaches.
Exact file/config area: `lib/coach-platform.ts`, future coach/funnel storage
Must fix before production: Yes if the repo will be shared or more private links are added.
Risk of fixing: Medium because funnel config must stay isolated per coach.
Priority: P1

### Bug/Risk ID: SEC-009
Title: Missing HSTS header
Category: Deployment/config hardening
Severity: Medium
Location: `public/_headers`
Affected data: Browser transport security
How an intruder could abuse it, safe high-level only: Without HSTS, browsers do not remember to force HTTPS for future visits.
Actual issue: `Strict-Transport-Security` is not configured.
Expected secure behavior: Add HSTS once HTTPS/domain setup is stable.
Recommended fix: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` only after confirming all subdomains are HTTPS-ready.
Exact file/config area: `public/_headers`, Cloudflare SSL/TLS config
Must fix before production: Recommended before full admin launch.
Risk of fixing: Medium if subdomains are not ready.
Priority: P2

### Bug/Risk ID: SEC-010
Title: Formatting check fails
Category: Build/deployment hygiene
Severity: Medium
Location: 20 files reported by `pnpm format:check`
Affected data: None directly
How an intruder could abuse it, safe high-level only: Not directly exploitable, but inconsistent formatting increases review errors and merge risk.
Actual issue: Prettier check fails on existing files.
Expected secure behavior: Formatting check passes before release/commit.
Recommended fix: Run Prettier intentionally in a separate cleanup after confirming no unrelated user edits should be disturbed.
Exact file/config area: `app/globals.css`, loader files, coach files, landing files, worker files, etc.
Must fix before production: No for runtime, Yes before clean release workflow.
Risk of fixing: Medium because the worktree is dirty and formatting may touch many unrelated files.
Priority: P2

## 5. Low Risks / Positive Findings

- No real `.env` file is tracked. Only `.env.example` is tracked.
- `.gitignore` excludes `.env`, `.env*.local`, logs, build output, `.wrangler`, and `secrets/`.
- `NEXT_PUBLIC_*` usage is limited to public site/payment flags. No `NEXT_PUBLIC` server secret was found.
- No public `out` source maps were found.
- Public static output did not expose the WhatsApp invite URL during the targeted search.
- Email OTP codes are sent but only HMAC hashes are stored in D1.
- Resend API key is only used server-side.
- Google OAuth callback verifies state, email verification, issuer, audience, and allowlist.
- Admin session API returns only `{ authenticated: false }` when unauthenticated.
- Payment webhook verifies Razorpay signature before writing payment access.
- SQL uses prepared statements with `.bind(...)`; no raw string-concatenated user SQL was found.

## 6. Top 10 Attack Paths And Countermeasures

1. Admin brute force or OTP spam
   - Countermeasure: durable rate limiting, per-IP and per-email limits, lockout alerts.
2. OTP brute force
   - Countermeasure: short TTL, max attempts, one-time use, IP limits. Current D1 attempt limit exists; IP limiter is missing.
3. Admin route bypass
   - Countermeasure: server-side guard before real admin data is rendered.
4. Admin API direct calls
   - Countermeasure: `requireAdmin` on every real admin API; deny-by-default.
5. Demo OTP accidentally enabled
   - Countermeasure: remove production demo endpoint or enforce production hard-block.
6. CSRF on future admin writes
   - Countermeasure: CSRF tokens and Origin/Referer checks.
7. XSS through future admin content
   - Countermeasure: stronger CSP, no unsafe HTML, sanitize any rich text.
8. Private WhatsApp link leakage
   - Countermeasure: server-only storage, signed/short-lived join links if needed.
9. Payment/success misuse
   - Countermeasure: continue signed funnel cookies and Razorpay webhook validation; do not expose success links publicly.
10. Deployment/config mistakes
   - Countermeasure: env validation, HSTS, strict CORS review, build checks, rollback plan.

## 7. Data Leak Risks

No direct secret leak was found. The main data leak risk is operational: private coach funnel metadata and WhatsApp URLs are currently in source config. This is acceptable only while repo access is tightly controlled. Before scaling to hundreds of coaches, private links should move to server-only D1/env-managed storage.

## 8. Admin Access Risks

Admin access currently has a working allowlist pattern and Google/email OTP flows, but the actual admin dashboard is still a placeholder. Before adding real data:

- Add server-side route protection.
- Add D1-backed admin users and roles.
- Remove or disable placeholder password/demo endpoints.
- Add durable rate limits.
- Add persistent audit logging.
- Add CSRF protection for all state-changing APIs.

## 9. OTP/MFA Risks

Email OTP is reasonably structured:

- 6-digit code.
- D1 stores hash only.
- Code expires.
- Attempts are limited.
- Code is one-time use.

Remaining gaps:

- No IP-based limiter yet.
- No device/session binding.
- No authenticator-app TOTP yet.
- No recovery-code process yet.
- Resend delivery status is logged only as accepted, not delivered/bounced.

## 10. Forgot Password Risks

Forgot/reset password endpoints are placeholders and do not change passwords. This is safe for now, but they should not remain public once real password auth launches unless token validation, one-time use, expiry, rate limits, and session invalidation are implemented.

## 11. API Exposure Risks

Current admin APIs do not expose private admin data. Future admin APIs must call `requireAdmin` server-side. Do not rely on client-side hiding.

## 12. Frontend Exposure Risks

Admin page HTML contains only public placeholder UI and no admin secrets. Client uses `fetch` with credentials for session checks and OTP verification. No auth tokens were found in localStorage/sessionStorage. Live-viewer localStorage stores a viewer ID only, not an admin token.

## 13. Secret/Env Risks

Cloudflare env values cannot be read from code. The repo uses server-only env names correctly. Keep these out of `NEXT_PUBLIC_*`:

- `ADMIN_SESSION_SECRET`
- `ADMIN_OAUTH_STATE_SECRET`
- `ADMIN_GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `FUNNEL_ACCESS_SECRET`
- `SUCCESS_ACCESS_SECRET`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

If any of these are ever pasted into files/chats/screenshots, rotate immediately.

## 14. Database Risks

D1 schema currently stores:

- Admin email OTP hashes and metadata.
- Admin audit events.
- Payment attempt hashes.

Recommended improvements:

- Store only masked email in long-term audit logs, or separate sensitive email fields with retention rules.
- Add retention cleanup for old audit/OTP rows.
- Add admin users, roles, sessions, and recovery-code tables before real dashboard features.

## 15. Third-Party Risks

- Google OAuth: client secret is server-only; allowlist protects admin access.
- Resend: API key server-only; domain verified. Add delivered/bounced visibility later.
- Razorpay: webhook signature verification exists; payment page URL is public by design.
- YouTube/WhatsApp: external links are business-required; private WhatsApp link should move server-side.

## 16. Logging Risks

Do not log OTP codes, reset tokens, session cookies, provider access tokens, Razorpay secrets, or full private links. Current OTP implementation logs provider email ID and status, not the OTP. Placeholder audit code must be replaced before real admin actions.

## 17. Deployment/Downtime Risks

- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm build:pages`: passed.
- `pnpm check:links`: passed.
- `pnpm test:e2e`: passed, 8 tests across mobile/tablet/desktop/large.
- `pnpm audit --audit-level moderate`: no known vulnerabilities.
- `pnpm format:check`: failed on existing formatting in 20 files.

Downtime risks to watch:

- Heavy WebGL loader/animations on mobile.
- Missing env vars in Cloudflare causing 503 auth/payment behavior.
- CSP tightening can break hydration if not tested.
- Formatter cleanup can create large unrelated diffs in the dirty worktree.

## 18. Performance Risks

The project uses animated loader, Three/R3F dependencies, large CSS, and video embeds. Current build passes. Continue testing mobile performance before production deploys. Prefer reduced-motion fallbacks for all animation.

## 19. Security Headers/Config Risks

Existing headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy` for camera/mic/geolocation/payment disabled
- CSP with frame restrictions and object blocking

Missing or incomplete:

- HSTS.
- CSP `default-src`.
- CSP `script-src`.
- CSP `style-src`.
- Review Cloudflare-generated `Access-Control-Allow-Origin: *` on HTML responses. APIs tested did not show wildcard CORS on GET session.

## 20. Must Fix Before Real Admin Production

1. Implement durable admin rate limiting.
2. Persist admin audit logs safely.
3. Server-protect real admin dashboard/data routes.
4. Add admin roles/permissions in D1.
5. Remove or hard-disable demo OTP and placeholder password endpoints.
6. Add CSRF protection for admin mutations.
7. Strengthen CSP with full browser testing.
8. Add HSTS after confirming HTTPS/subdomains are stable.
9. Move private WhatsApp links to server-only storage.
10. Add admin rollback/recovery plan.

## 21. Recommended Fix Order

1. Rate limiting and audit persistence.
2. Server-side admin guard and role model.
3. Remove/disable placeholder auth surfaces.
4. CSRF protection.
5. CSP/HSTS hardening.
6. Private link storage migration.
7. Admin monitoring/alerts.
8. Formatter cleanup in a separate change.

## 22. Safe Fixes That Can Be Applied Immediately

- Add persistent D1 audit helper for placeholder audit events.
- Replace placeholder `checkAdminRateLimit` with simple D1-based counters.
- Add production guard to reject demo OTP when `ywcoach.com` is the host.
- Add stricter no-store headers for all admin pages/APIs.
- Add comments/TODOs where future APIs must call `requireAdmin`.

These are safe but still should be reviewed because auth changes can lock out admin access.

## 23. Risky Fixes That Need Approval

- Changing session token structure.
- Adding D1 admin user/role tables.
- Removing legacy endpoints if UI still references them.
- Changing payment/success flow.
- Strict CSP rollout.
- HSTS preload.
- Moving coach/funnel data out of static source config.

## 24. Commands Run And Results

- `git status --short`: dirty worktree with many modified/untracked files.
- `git diff --stat`: 22 tracked files changed, 1778 insertions, 267 deletions.
- `git diff --name-only`: reviewed changed tracked file list.
- `git branch --show-current`: `codex/ywcoach-platform-migration`.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm build:pages`: passed.
- `pnpm check:links`: passed all production route/funnel checks.
- `pnpm test:e2e`: passed 8 Playwright tests.
- `pnpm audit --audit-level moderate`: no known vulnerabilities.
- `pnpm format:check`: failed on 20 files.
- Admin production smoke: `/admin`, `/admin/login`, `/admin/verify`, `/admin/forgot-password`, `/admin/reset-password`, and `/api/admin/auth/session` returned 200.
- Admin invalid payload smoke: invalid email OTP start returned 400; invalid email OTP verify returned 400; unauthenticated logout returned 200 and clears cookie.
- Admin visual smoke: mobile, tablet, desktop, and large all showed `Admin Login`, Google button, email field, CTA, and no horizontal overflow.
- Public output scan: no public static source maps found and no public `out` exposure of WhatsApp URL found.

## 25. Final Recommendation

Do not add real admin data/features yet. The current admin foundation is acceptable as a placeholder/login foundation, but it is not ready for a full production admin dashboard until rate limiting, audit persistence, server-side admin guards, CSRF protection, role checks, and stronger CSP are in place.

Absolute security does not exist. A layered admin model with server-side allowlist, Google/email OTP or TOTP, short-lived HttpOnly sessions, D1 roles, audit logs, rate limits, CSRF checks, strict headers, secret rotation, and rollback planning will make unauthorized access much harder and much easier to detect.
