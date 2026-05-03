# WHM101 Current Project, Future Roadmap, And Vision

Last updated: 03 May 2026

## 1. Project Identity

Project:

```text
Women Health Masterclass 101
```

Current page title:

```text
WOMEN HEALTH MASTERCLASS 101
```

Current positioning:

```text
An integrated and holistic approach for PCOS/PCOD
```

Current domain:

```text
https://freedomfromdiabetes.in
```

Current payment page:

```text
https://rzp.io/rzp/xBIZzJHv
```

Current WhatsApp community:

```text
https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4
```

## 2. Core Product Direction

The main product is the landing page and post-payment registration journey.

The project should stay lightweight:

```text
Landing page first
Minimal backend
Razorpay for payment
Cloudflare D1 for durable capture
n8n for automation
Google Sheets for owner-facing reporting
No large CRM dashboard right now
```

The backend should not become a full CRM. Its job is to protect payment capture, verify/receive Razorpay webhooks, store a short-term safety ledger, and hand automation to n8n.

## 3. Current Production Architecture

Active ecosystem:

```text
GoDaddy domain
-> Cloudflare DNS
-> Cloudflare Pages
-> Cloudflare Pages Worker
-> Razorpay Payment Page
-> Razorpay webhook
-> Cloudflare D1
-> n8n Cloud
-> Google Sheets
-> Apps Script failure log
```

Active host:

```text
Cloudflare Pages
```

Removed from active path:

```text
Netlify
Old temporary deployment URLs
Separate legacy payment automations
Old payment ecosystem logic
```

Important rule:

```text
Do not intermix old/separate payment ecosystems with this WHM101 ecosystem.
```

The new system does not track, depend on, or integrate old payment flows. If a Razorpay payment does not belong to the configured WHM101 allowlist, this ecosystem silently does nothing with it.

## 4. Current Payment Flow

Current live flow:

```text
Landing page
-> User clicks payment CTA
-> Razorpay hosted payment page opens
-> User pays
-> Razorpay sends webhook to Cloudflare
-> Cloudflare verifies webhook signature
-> Cloudflare checks amount and active payment-source allowlist
-> Cloudflare stores registration in D1
-> Cloudflare stores automation event in D1
-> Cloudflare sends paid_user_created event to n8n
-> n8n writes SUCCESSFUL PAYMENTS row
-> Cloudflare marks automation event sent
```

If n8n fails:

```text
Razorpay payment still succeeds
Cloudflare stores registration in D1
Cloudflare stores failed automation event in D1
Cloudflare writes row to AUTOMATION FAILURES through Apps Script
Retry Worker retries every 5 minutes
When n8n recovers, n8n writes SUCCESSFUL PAYMENTS
Cloudflare removes matching AUTOMATION FAILURES row
```

## 5. Active Payment Isolation Rules

The system is config-driven and fail-closed.

Active source controls:

```text
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG
RAZORPAY_ACTIVE_PAYMENT_LINK_ID
RAZORPAY_ACTIVE_PAYMENT_PAGE_ID
RAZORPAY_ACTIVE_PAYMENT_MARKERS
WORKSHOP_ALLOWED_AMOUNTS_PAISE
```

Current accepted source configuration:

```text
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO
RAZORPAY_ACTIVE_PAYMENT_MARKERS=whatsapp_no,your_health_goal
WORKSHOP_ALLOWED_AMOUNTS_PAISE=100,5100
```

Current test amount:

```text
INR 1 = 100 paise
```

Current final intended amount:

```text
INR 51 = 5100 paise
```

Production launch rule:

```text
Remove 100 from WORKSHOP_ALLOWED_AMOUNTS_PAISE before final launch.
```

Final launch value:

```text
WORKSHOP_ALLOWED_AMOUNTS_PAISE=5100
```

If a new Razorpay page/link is created later, do not change code. Update the relevant env vars, test, then remove old identifiers.

## 6. Durable Capture Layer

Cloudflare D1 database:

```text
whm101-db
```

Current tables:

```text
registrations
automation_events
```

Purpose:

```text
Prevent paid registrations from being lost if n8n, Google Sheets, or Apps Script is unavailable.
```

Key behavior:

```text
razorpay_payment_id is the idempotency key
duplicate Razorpay webhooks do not duplicate D1 rows
duplicate automation events are reused
failed n8n dispatches are retried
sent records older than 7 days are safely cleaned up
pending/failed/dead records are retained
```

Retry Worker:

```text
freedomfromdiabetes-retry-worker
```

Retry schedule:

```text
Every 5 minutes
```

Cleanup schedule:

```text
Daily
```

## 7. Google Sheets Reporting

Google Sheet remains the owner-facing reporting dashboard.

Current important tabs:

```text
SUCCESSFUL PAYMENTS
AUTOMATION FAILURES
```

`SUCCESSFUL PAYMENTS` purpose:

```text
Clean paid lead sheet for confirmed paid users processed by n8n.
```

Current columns:

```text
Timestamp
Email ID
Full Name
First Name
Last Name
Mobile Number
Webinar Tag
Platform
Status
```

`AUTOMATION FAILURES` purpose:

```text
Active unresolved automation failure list for manual awareness.
```

Important behavior:

```text
n8n failure -> row appears in AUTOMATION FAILURES
n8n recovery -> row is removed from AUTOMATION FAILURES
```

The failure sheet is not the source of truth. D1 is the source of truth.

## 8. Current n8n Responsibilities

Current n8n paid-user workflow:

```text
Webhook
-> Append clean paid user row
-> Respond after successful sheet write
```

Important n8n rule:

```text
n8n must not respond immediately before Google Sheets write finishes.
```

Why:

```text
If n8n responds early with 200 OK, Cloudflare thinks automation succeeded even if the sheet node fails later.
```

Current paid-user webhook:

```text
POST /webhook/whm101-paid-user-created
```

Current click-tracking webhook planned:

```text
GET /webhook/whm101-whatsapp-clicked
```

## 9. Verified Tests Completed

The following have been tested and verified:

```text
Cloudflare Pages live
Razorpay webhook reaches Cloudflare
D1 registration capture works
D1 automation event capture works
Bad n8n URL causes failed event
Failed event writes AUTOMATION FAILURES row
Restored n8n URL recovers failed event
Recovered event writes SUCCESSFUL PAYMENTS
Recovered event removes AUTOMATION FAILURES row
Health endpoint confirms durable_capture=true
Failure-log secrets configured correctly
Active payment-source config detected
```

Recent verified failure/recovery result:

```text
TEST-3 payment events failed while n8n URL was intentionally bad
AUTOMATION FAILURES received active rows
Real n8n URL was restored
Retry Worker recovered the failed events
SUCCESSFUL PAYMENTS received recovered rows
AUTOMATION FAILURES returned to headers only
```

## 10. Known Cleanup Items

Optional manual cleanup:

```text
Remove test rows from SUCCESSFUL PAYMENTS:
TEST-1
TEST-2
TEST-3
diagnostic rows

Keep AUTOMATION FAILURES tab with headers only.
```

Important:

```text
Do not delete real paid users unless intentionally cleaning test data.
```

## 11. What Is Done

Completed:

```text
Domain moved to Cloudflare
Netlify removed from active production path
Cloudflare Pages deployment working
Razorpay hosted payment page connected
Razorpay webhook connected to Cloudflare
D1 durable capture implemented
D1 retryable automation events implemented
Retry Worker implemented
7-day safe cleanup implemented
Google Sheets SUCCESSFUL PAYMENTS flow implemented
AUTOMATION FAILURES direct Apps Script flow implemented
n8n failure/recovery tested
Payment source allowlist implemented
Config-driven page/link migration documented
Legal/policy pages exist
Landing page built and deployed
Feminine UI color direction applied
Coach photo added
Thank You page exists
```

## 12. What Is Partially Done

Partially done:

```text
Thank You page exists, but final post-payment UX should still be polished.
WhatsApp community button exists/fallback exists, but n8n click-tracking flow still needs final verification.
n8n paid-user workflow writes Sheets, but email and WhatsApp onboarding are not fully implemented.
Failure visibility works, but long-term admin alerting still needs implementation.
Reminder loop is planned but not implemented.
Active member confirmation is planned but not implemented.
```

## 13. What Is Not Done Yet

Not done yet:

```text
Final confirmation email automation
Final WhatsApp onboarding message automation
Reminder loop for users who have not joined community
Admin alert after repeated reminder failure
Admin alert for missing phone/email
WhatsApp group join detection
Manual active_member confirmation flow
Final launch cleanup of INR 1 test amount
Final INR 51 production payment test
Final legal review
Final copy/design polish
Final performance and security pass
```

## 14. Immediate Next Recommended Work

Recommended next task:

```text
WhatsApp community click tracking and redirect workflow
```

Target flow:

```text
Thank You Page
-> Join WhatsApp Community button
-> n8n click tracking webhook
-> n8n records group_link_clicked
-> n8n redirects to real WhatsApp community link
```

Important:

```text
Clicked link does not mean joined group.
Do not mark active_member from click alone.
```

After click tracking:

```text
Build confirmation email
Build WhatsApp onboarding
Build reminder loop
Build admin manual follow-up alert
Remove INR 1 test amount
Final launch test
```

## 15. Future Automation Roadmap

### Phase 1: WhatsApp Click Tracking

Implement:

```text
n8n click webhook
Google Sheet update for click status
Redirect to WhatsApp community
Thank You page button wired to n8n URL
Fallback copy-link option
```

Suggested fields:

```text
WhatsApp Clicked
Clicked At
Member Status
```

### Phase 2: Confirmation Email

Implement:

```text
Send email after SUCCESSFUL PAYMENTS write
Use full_name, email, payment ID, workshop info
Include WhatsApp community link
Do not block payment flow if email fails
Log email failures for follow-up
```

Provider still to decide:

```text
Gmail
SMTP
Resend
other provider
```

### Phase 3: WhatsApp Onboarding

Implement:

```text
Send WhatsApp onboarding message after payment
Use customer phone from Razorpay
Include community link
Log send failures
```

Provider still to decide:

```text
WhatsApp Cloud API
approved WhatsApp provider
other provider supported by n8n
```

### Phase 4: Reminder Loop

Implement scheduled n8n workflow:

```text
Every 10-15 minutes
Find paid users not active_member
Send up to 4 reminders
Increment reminder count
Set next reminder time
After 4 reminders, mark manual_followup_required
Send admin alert
```

### Phase 5: Active Member Confirmation

Only mark active member when:

```text
WhatsApp provider gives group_join webhook
or admin manually confirms
```

Never mark active member from button click alone.

## 16. Launch Checklist

Before final launch:

```text
1. Change Razorpay amount back to INR 51.
2. Set WORKSHOP_ALLOWED_AMOUNTS_PAISE=5100.
3. Confirm active Razorpay source identifiers are correct.
4. Run one INR 51 payment test.
5. Confirm D1 registration.
6. Confirm SUCCESSFUL PAYMENTS row.
7. Confirm AUTOMATION FAILURES remains empty on success.
8. Confirm n8n failure test still works if needed.
9. Confirm Thank You page opens correctly.
10. Confirm WhatsApp button works.
11. Confirm email automation.
12. Confirm WhatsApp onboarding automation.
13. Confirm reminder loop.
14. Confirm admin alert.
15. Remove or archive test rows.
```

## 17. Pending Inputs From User

Still needed later:

```text
Final workshop copy/content refinements
Final weekly workshop schedule handling decision
Email sender provider and credentials
WhatsApp provider and credentials
Admin alert phone/email
Final launch price confirmation
Final Razorpay page identifiers if the page/link changes
Final legal wording approval
Whether to keep or remove test rows
```

## 18. Operating Principles

Use these rules for all future work:

```text
Do not overbuild a CRM.
Keep landing page as the main product.
Keep old/separate ecosystems out of this ecosystem.
Use config for payment-page changes, not code changes.
Use D1 as reliability ledger.
Use Google Sheets as reporting, not source of truth.
Use n8n as automation brain.
Keep failure behavior visible but non-blocking.
Fail closed for unknown payment sources.
Do not mark active_member without real join confirmation.
Do not expose secrets in frontend, GitHub, logs, or browser console.
```

## 19. Long-Term Vision

The long-term goal is a reliable, low-cost, owner-friendly automation system for paid wellness workshops.

The system should eventually support:

```text
Reusable workshop landing pages
Configurable price and active payment page
Weekly dynamic session date
Razorpay payment verification
Durable D1 safety capture
Google Sheets owner dashboard
n8n email and WhatsApp automation
Reminder automation
Manual follow-up visibility
Optional active member confirmation
Fast rollback through config
No dependency on one fragile no-code flow
```

The final ideal operating state:

```text
User pays
User gets immediate confirmation
User can join WhatsApp community immediately
Owner sees clean paid lead in Google Sheets
Failures are captured and visible
Failed automations recover automatically
Manual follow-up is only needed for true edge cases
The system can run unattended for long periods
```

## 20. Current Recommendation

Move on from payment durability testing.

Next work:

```text
Implement and verify WhatsApp community click tracking.
```

Keep this document as the source-of-truth roadmap and update it whenever architecture, flow, or launch decisions change.
