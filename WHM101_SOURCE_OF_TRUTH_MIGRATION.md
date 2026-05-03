# WHM101 Source Of Truth And Migration Playbook

Status: active source of truth plus migration instruction

Last updated: 03 May 2026

Project: Women Health Masterclass 101

Purpose: keep the current build, migration direction, exact implementation steps, testing rules, and future vision in one editable Markdown file.

This file is the canonical project file from this point forward. If older docs conflict with this file, this file wins.

---

## 1. How This File Must Be Used

Use this file before making any future project decision.

This file must be updated whenever any of these change:

- Payment page URL.
- Razorpay payment page ID.
- Razorpay payment link ID.
- Allowed payment amount.
- Automation provider.
- Automation webhook URL.
- Google Sheet columns.
- Failure logging method.
- D1 database schema.
- Retry behavior.
- Thank You page behavior.
- WhatsApp community URL.
- Launch checklist.

Do not create a new competing source-of-truth document unless the owner explicitly requests replacement. Update this file instead.

Every future task should follow this sequence:

```text
Read this file
Identify the current phase
Identify the smallest safe next change
Make the change
Test the change
Update this file if the system state changed
Commit and push
```

---

## 2. Current Interpretation Of The Master Prompt

The attached `WHM101_codex_master_prompt.md` is accepted as:

```text
Source of truth for direction
+ migration instruction
+ operating rules
```

Important clarification:

The master prompt describes the target automation layer as Pabbly Connect. The current repository still has n8n naming and n8n webhook configuration in code and config.

Therefore this file treats the system as hybrid until migration is verified:

```text
Current live state: n8n automation endpoint is still wired in the build.
Approved target state: Pabbly Connect replaces n8n.
Migration rule: do not disturb Razorpay, D1, retry worker, Google Sheets columns, or landing page while swapping automation endpoint.
```

After the Pabbly migration passes testing, this file must be updated so Pabbly becomes the current state and n8n becomes decommissioned history.

---

## 3. Project Identity

```text
Project name: Women Health Masterclass 101
Short name: WHM101
Domain: https://freedomfromdiabetes.in
DNS/CDN: Cloudflare
Hosting: Cloudflare Pages
Worker runtime: Cloudflare Pages Worker
Retry runtime: Cloudflare Worker
Database: Cloudflare D1
D1 database name: whm101-db
Payment provider: Razorpay
Payment page URL: https://rzp.io/rzp/xBIZzJHv
WhatsApp community: https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4
Owner-facing reporting: Google Sheets
Failure log: Google Apps Script writing to Google Sheets
Current automation endpoint: n8n
Target automation endpoint: Pabbly Connect
Pabbly paid-user-created webhook: configured in Cloudflare vars
```

Landing page title:

```text
WOMEN HEALTH MASTERCLASS 101
```

Landing page positioning:

```text
An integrated and holistic approach for PCOS/PCOD
```

---

## 4. Product Direction

The project is not a CRM.

The landing page is the main product.

The backend exists only to:

```text
1. receive and verify Razorpay payment webhooks
2. isolate the correct Razorpay page from old payment ecosystems
3. create a durable paid registration record in D1
4. create a retryable automation event in D1
5. dispatch the paid lead to the automation provider
6. keep retrying failed automation dispatches
7. maintain a human-readable failure log
8. clean only safely synced old data after 7 days
```

No admin dashboard should be built right now.

Google Sheets remains the only owner-facing reporting view.

D1 is the hidden reliability ledger, not the user-facing dashboard.

---

## 5. Current Live Architecture

Current live flow before Pabbly migration:

```text
Visitor
-> freedomfromdiabetes.in
-> Landing page
-> Pay CTA
-> Razorpay hosted payment page
-> Payment captured by Razorpay
-> Razorpay webhook hits Cloudflare Pages Worker
-> Worker verifies webhook signature
-> Worker validates payment source allowlist
-> Worker upserts registration into D1
-> Worker creates or reuses automation event in D1
-> Worker dispatches paid_user_created to n8n
-> n8n writes SUCCESSFUL PAYMENTS row in Google Sheets
-> Worker marks automation event sent if automation endpoint returns success
```

Current failure flow:

```text
Razorpay payment succeeds
-> Worker captures payment in D1
-> Automation endpoint fails or is offline
-> Worker keeps automation event as failed or pending
-> Worker writes failure row to AUTOMATION FAILURES through Google Apps Script
-> Retry Worker runs every 5 minutes
-> Retry Worker re-sends old failed event
-> Automation provider recovers
-> SUCCESSFUL PAYMENTS row is written
-> Worker marks event sent
-> Failure row is removed from AUTOMATION FAILURES
```

Current cleanup flow:

```text
Daily cleanup
-> delete sent automation events older than 7 days
-> delete registrations older than 7 days only if all related automation events are sent and old enough
-> never auto-delete pending events
-> never auto-delete failed events
-> never auto-delete dead events
```

---

## 6. Approved Target Architecture After Pabbly Migration

Target flow:

```text
Visitor
-> freedomfromdiabetes.in
-> Landing page
-> Pay CTA
-> Razorpay hosted payment page
-> Payment captured by Razorpay
-> Razorpay webhook hits Cloudflare Pages Worker
-> Worker verifies webhook signature
-> Worker validates payment source allowlist
-> Worker upserts registration into D1
-> Worker creates or reuses automation event in D1
-> Worker dispatches paid_user_created to Pabbly Connect
-> Pabbly writes SUCCESSFUL PAYMENTS row in Google Sheets
-> Worker marks automation event sent after provider success
```

Target failure flow:

```text
Razorpay payment succeeds
-> D1 captures registration
-> Pabbly fails or is unavailable
-> D1 keeps event failed or pending
-> Apps Script writes AUTOMATION FAILURES row
-> Retry Worker retries every 5 minutes
-> Pabbly recovers
-> Pabbly writes SUCCESSFUL PAYMENTS row
-> Worker marks event sent
-> Failure row is removed from AUTOMATION FAILURES
```

Nothing else should change during this migration:

```text
Razorpay page: unchanged
D1 schema: unchanged
Retry worker: unchanged
Landing page: unchanged
Google Sheet columns: unchanged
Apps Script failure log: unchanged
Payment source allowlist: unchanged
```

---

## 7. Non-Negotiable Rules

```text
1. Do not touch or merge old Pabbly/Razorpay ecosystems.
2. The old payment ecosystem is separate and must stay ignored by WHM101.
3. D1 is the reliability source of truth.
4. Google Sheets is reporting only.
5. Razorpay payment success is not enough unless webhook source passes allowlist.
6. Unknown payment sources must be silently ignored.
7. razorpay_payment_id is the idempotency key.
8. Duplicate Razorpay webhooks must not duplicate D1 rows.
9. Duplicate Razorpay webhooks must not duplicate Google Sheet rows.
10. Automation failure must never lose a paid lead.
11. Automation failure must never block the user's payment success.
12. Never expose secrets in frontend, GitHub, logs, or browser console.
13. Do not build a CRM or admin dashboard now.
14. The Thank You page button click does not mean active_member.
15. active_member can only be set by a WhatsApp group_join webhook or manual admin confirmation.
16. Keep INR 1 test amount only during testing.
17. Before launch, allowed amount must become only 5100 paise.
18. Razorpay webhook must point to Cloudflare, never directly to Pabbly.
19. Pabbly webhook URL belongs only in Cloudflare provider config.
```

Correct webhook routing:

```text
Razorpay webhook URL:
https://freedomfromdiabetes.in/api/payments/razorpay/webhook

Cloudflare automation provider URL:
PABBLY_WEBHOOK_URL=https://connect.pabbly.com/webhook-listener/...
```

Why direct Razorpay to Pabbly is forbidden:

```text
It bypasses D1 durable capture.
It bypasses Razorpay signature verification in our Worker.
It bypasses WHM101 payment-source allowlist.
It bypasses duplicate protection by razorpay_payment_id.
It bypasses retry and failure logging.
It can mix old payment ecosystems into the WHM101 reporting sheet.
```

---

## 8. Active Payment Source Allowlist

Current active payment page:

```text
https://rzp.io/rzp/xBIZzJHv
```

Required Cloudflare config:

```env
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO
RAZORPAY_ACTIVE_PAYMENT_MARKERS=whatsapp_no,your_health_goal
WORKSHOP_ALLOWED_AMOUNTS_PAISE=100,5100
```

Testing rule:

```text
100 paise = INR 1 test amount
5100 paise = INR 51 launch amount
```

Launch rule:

```env
WORKSHOP_ALLOWED_AMOUNTS_PAISE=5100
```

Future payment page migration rule:

```text
If a new Razorpay page is created later, do not rewrite logic.
Update the env vars only:
- RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG
- RAZORPAY_ACTIVE_PAYMENT_LINK_ID
- RAZORPAY_ACTIVE_PAYMENT_MARKERS
- WORKSHOP_ALLOWED_AMOUNTS_PAISE
```

---

## 9. Data Model

D1 table:

```text
registrations
```

Purpose:

```text
one row per verified paid Razorpay payment
```

Idempotency key:

```text
razorpay_payment_id
```

D1 table:

```text
automation_events
```

Purpose:

```text
one retryable automation event per registration and event type
```

Important statuses:

```text
pending
sent
failed
dead
```

Retry rule:

```text
Retry pending or failed events every 5 minutes.
Stop retrying after 20 attempts.
Mark exhausted events dead.
Never auto-delete dead events.
```

Retention rule:

```text
Delete sent records older than 7 days.
Keep pending, failed, and dead records until manually resolved.
```

---

## 10. Google Sheets Structure

Google Sheet is the reporting dashboard.

Current important tabs:

```text
SUCCESSFUL PAYMENTS
AUTOMATION FAILURES
```

`SUCCESSFUL PAYMENTS` columns:

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
Show unresolved paid leads where automation dispatch failed.
Help manual follow-up if automation is offline.
Self-clear or mark resolved when the retry succeeds.
```

Important:

```text
AUTOMATION FAILURES is not the source of truth.
D1 is the source of truth.
The failure sheet is only a human-readable operational log.
```

Future columns to add only when implementing later phases:

```text
WhatsApp Clicked
Clicked At
Reminder Count
Member Status
Next Reminder At
Manual Followup Required
```

---

## 11. Automation Provider State

Current state:

```text
Pabbly URL is configured in the repository Cloudflare vars.
n8n remains as fallback until the INR 1 success test and failure/recovery test pass.
Cloudflare Pages and retry worker are deployed with Pabbly provider config.
Production health endpoint confirms automation_provider = pabbly.
Pabbly-to-Google-Sheets mapping is verified for SUCCESSFUL PAYMENTS.
```

Target state:

```text
Pabbly Connect replaces n8n after verified migration.
```

Current repo references that still need migration:

```text
N8N_WEBHOOK_URL
N8N_WEBHOOK_SECRET
N8N_WHATSAPP_CLICK_TRACKING_URL
NEXT_PUBLIC_N8N_WHATSAPP_CLICK_TRACKING_URL
n8n documentation files
n8n workflow JSON files
```

Migration prep already added:

```text
Worker supports PABBLY_WEBHOOK_URL.
Worker supports AUTOMATION_WEBHOOK_URL.
Worker keeps N8N_WEBHOOK_URL fallback until Pabbly is verified.
Success page supports NEXT_PUBLIC_WHATSAPP_CLICK_TRACKING_URL with n8n fallback.
Health endpoint exposes generic automation provider status.
```

Preferred future naming:

```env
AUTOMATION_WEBHOOK_URL=
AUTOMATION_WEBHOOK_SECRET=
NEXT_PUBLIC_WHATSAPP_CLICK_TRACKING_URL=
PABBLY_WEBHOOK_URL=
PABBLY_WEBHOOK_SECRET=
```

Safe migration approach:

```text
Add generic automation names while keeping n8n fallback until Pabbly passes tests.
Then remove n8n references after migration is verified.
```

---

## 12. Pabbly Migration Overview

Goal:

```text
Replace n8n with Pabbly Connect without disturbing payment capture, D1, retry worker, Google Sheets columns, or the live landing page.
```

Migration phases:

```text
Phase A: freeze and backup current working state
Phase B: build Pabbly Flow 1 for paid_user_created
Phase C: verify Pabbly response behavior
Phase D: update Cloudflare automation endpoint safely
Phase E: run INR 1 payment test
Phase F: run failure and recovery test
Phase G: decommission n8n only after successful verification
Phase H: update this source-of-truth file
```

---

## 13. Phase A - Freeze And Backup Current Working State

Do this before touching Pabbly or Cloudflare env vars.

Checklist:

```text
[ ] Confirm the live site loads: https://freedomfromdiabetes.in
[ ] Confirm health endpoint returns ok: https://freedomfromdiabetes.in/api/health
[ ] Confirm Razorpay payment page opens: https://rzp.io/rzp/xBIZzJHv
[ ] Export or screenshot current Cloudflare env vars.
[ ] Export or screenshot current Cloudflare secrets list.
[ ] Export current n8n paid-user workflow.
[ ] Export current n8n WhatsApp click workflow if present.
[ ] Duplicate the Google Sheet or confirm existing sheet can be restored.
[ ] Confirm SUCCESSFUL PAYMENTS headers are correct.
[ ] Confirm AUTOMATION FAILURES headers are correct.
[ ] Confirm Apps Script failure logger URL is saved.
[ ] Confirm current Git branch is clean.
[ ] Confirm latest code is pushed to GitHub.
```

Expected health endpoint indicators:

```json
{
  "ok": true,
  "runtime": "cloudflare-worker",
  "durable_capture": true,
  "n8n_webhook_configured": true,
  "failure_log_configured": true,
  "active_payment_source_configured": true
}
```

After Pabbly migration, the health wording should be updated from `n8n_webhook_configured` to a generic automation provider flag.

---

## 14. Phase B - Build Pabbly Flow 1

Create this Pabbly workflow:

```text
Workflow name: WHM101 - Paid User Created
Trigger: Webhook
Method: POST
Purpose: receive paid_user_created payload from Cloudflare Worker
```

Webhook payload must include these fields:

```text
event_type
registration_id
registration_token
full_name
phone_number
email
program_slug
workshop_slot
amount
currency
payment_status
member_status
razorpay_order_id
razorpay_payment_id
whatsapp_group_link
thank_you_url
utm_source
utm_medium
utm_campaign
utm_content
utm_term
created_at
automation_event_id
retry_count
automation_previous_status
automation_last_error
```

Pabbly Google Sheets action:

```text
App: Google Sheets
Action: Add New Row or equivalent append action
Spreadsheet: current WHM101 reporting sheet
Worksheet: SUCCESSFUL PAYMENTS
```

Map fields:

```text
Timestamp -> formatted current/payment timestamp
Email ID -> email
Full Name -> full_name
First Name -> first word of full_name
Last Name -> remaining words of full_name
Mobile Number -> phone_number
Webinar Tag -> WHM101
Platform -> Razorpay
Status -> Paid
```

Preferred timestamp format:

```text
DD/MM/YYYY hh:mm:ss AM/PM
```

Example:

```text
03/05/2026 07:16:10 PM
```

Important:

```text
Do not use raw ISO timestamp directly if the sheet should match the father's lead sheet style.
```

---

## 15. Phase C - Verify Pabbly Response Behavior

This is a critical gate.

The reliability design assumes:

```text
Worker marks automation_event = sent only after the automation provider confirms success.
```

Problem to check:

```text
Some automation tools return HTTP 200 immediately when their webhook receives data, even if later Google Sheets steps fail.
```

If Pabbly returns 200 immediately before Google Sheets succeeds, then this statement is not true:

```text
Pabbly 200 = Google Sheet row successfully written
```

Required test:

```text
1. Create Pabbly webhook.
2. Add Google Sheets append action.
3. Intentionally break the Google Sheets action.
4. Send test payload to Pabbly webhook.
5. Observe whether the webhook caller still receives HTTP 200.
```

If Pabbly returns non-2xx when Google Sheets fails:

```text
Safe to use Pabbly directly as automation endpoint.
```

If Pabbly still returns 200 even when Google Sheets fails:

```text
Do not treat Pabbly webhook 200 as final success.
Use one of these safer options:

Option 1: keep D1 retry and add a Pabbly callback endpoint later.
Option 2: keep direct Google Apps Script failure/success logging in Worker.
Option 3: use an automation provider that supports delayed response after all steps complete.
```

Current preferred decision:

```text
Proceed with Pabbly only after response behavior is verified.
If response behavior is weak, add a callback design before calling migration complete.
```

---

## 16. Phase D - Update Cloudflare Automation Endpoint

Current code uses n8n naming.

Safe code migration should be naming-only first:

```text
[x] Add support for AUTOMATION_WEBHOOK_URL and PABBLY_WEBHOOK_URL.
[x] Keep N8N_WEBHOOK_URL as fallback until migration passes.
[x] Rename dispatchToN8n path to generic automation dispatch naming.
[x] Do not change payload shape.
[x] Do not change D1 schema.
[x] Do not change retry logic.
[x] Do not change Razorpay verification.
```

Recommended env resolution order:

```text
PABBLY_WEBHOOK_URL
AUTOMATION_WEBHOOK_URL
N8N_WEBHOOK_URL
existing default n8n URL during transition only
```

After code patch is deployed, set Cloudflare secret or env:

```env
PABBLY_WEBHOOK_URL=<Pabbly Connect paid-user-created webhook URL>
```

Keep old n8n URL available only until testing passes.

After testing passes:

```text
Remove default n8n fallback from code.
Remove N8N_WEBHOOK_URL from Cloudflare.
Remove n8n workflow files from active docs or move them to archive.
```

---

## 17. Phase E - INR 1 End-To-End Payment Test

Use INR 1 only while testing.

Before test:

```text
[ ] WORKSHOP_ALLOWED_AMOUNTS_PAISE includes 100.
[ ] Razorpay payment page amount is INR 1.
[ ] Pabbly Flow 1 is active.
[ ] Cloudflare env points to Pabbly webhook.
[ ] Google Sheet is clean or test rows are clearly labeled.
```

Test:

```text
1. Open https://freedomfromdiabetes.in.
2. Click payment CTA.
3. Complete INR 1 payment on Razorpay page.
4. Wait 30 to 90 seconds.
5. Check Razorpay payment status is captured.
6. Check D1 registration exists.
7. Check D1 automation event exists.
8. Check Google Sheet SUCCESSFUL PAYMENTS row appears.
9. Check AUTOMATION FAILURES stays empty.
10. Check no duplicate rows appear after Razorpay retries.
```

Pass criteria:

```text
D1 row created
SUCCESSFUL PAYMENTS row created
AUTOMATION FAILURES empty
No duplicate row
No unrelated old payment appears
```

Fail criteria:

```text
Payment captured but no D1 row
Payment captured but no Sheet row
Payment captured but failure log empty when automation failed
Duplicate Sheet row
Old payment ecosystem row appears
Incorrect timestamp
Missing phone number when Razorpay has phone
Wrong amount accepted
```

---

## 18. Phase F - Failure And Recovery Test

Purpose:

```text
Prove that paid leads are not lost when Pabbly fails.
```

Controlled failure test:

```text
1. Temporarily set PABBLY_WEBHOOK_URL to an invalid URL.
2. Deploy Cloudflare.
3. Make one INR 1 test payment.
4. Confirm Razorpay payment succeeds.
5. Confirm D1 registration exists.
6. Confirm automation event status is failed or pending.
7. Confirm AUTOMATION FAILURES row appears.
8. Restore real PABBLY_WEBHOOK_URL.
9. Deploy Cloudflare.
10. Wait for retry worker or trigger retry if available.
11. Confirm SUCCESSFUL PAYMENTS row appears.
12. Confirm AUTOMATION FAILURES row is removed or marked resolved according to current chosen behavior.
```

Chosen current behavior:

```text
Remove failure row when recovered.
```

Pass criteria:

```text
Payment succeeds while Pabbly is broken.
D1 captures the paid lead.
Failure row appears.
Retry recovers after URL is restored.
Successful row appears.
Failure row clears.
```

Fail criteria:

```text
D1 does not capture payment.
Failure row does not appear.
Retry does not send after recovery.
Failure row remains unresolved after successful recovery.
Duplicate successful rows appear.
```

---

## 19. Phase G - n8n Decommission

Do this only after Pabbly passes Phase E and Phase F.

Checklist:

```text
[ ] Pabbly Flow 1 verified.
[ ] INR 1 successful payment verified.
[ ] Failure and recovery verified.
[ ] No old payment ecosystem rows leak into WHM101 sheet.
[ ] Cloudflare env no longer depends on n8n.
[ ] Code uses generic automation naming or Pabbly naming.
[ ] Health endpoint shows automation configured without n8n wording.
[ ] This file is updated from hybrid state to Pabbly current state.
```

Then:

```text
1. Disable n8n paid-user workflow.
2. Disable n8n click workflow if any.
3. Export n8n workflow files for archive if needed.
4. Remove n8n URLs from Cloudflare env.
5. Remove n8n URLs from docs that are meant to be active.
6. Keep historical docs only if clearly marked archived.
```

Do not keep n8n and Pabbly both active for the same WHM101 event.

---

## 20. Phase H - WhatsApp Click Tracking

Build this after paid-user-created works on Pabbly.

Target flow:

```text
Thank You page
-> User clicks Join WhatsApp Community
-> Button opens Pabbly click tracking webhook
-> Pabbly receives registration or payment identifier
-> Pabbly updates Google Sheet row
-> Pabbly redirects to real WhatsApp invite link
```

Required button behavior:

```text
The main button must not expose only the raw WhatsApp link.
It should go through the tracking webhook first.
```

Required Pabbly Flow 2:

```text
Workflow name: WHM101 - WhatsApp Clicked
Trigger: Webhook GET
Input: registration_token or razorpay_payment_id
Action 1: find matching row in SUCCESSFUL PAYMENTS
Action 2: update WhatsApp Clicked = TRUE
Action 3: update Clicked At = current timestamp
Action 4: redirect user to WhatsApp community
```

Important rule:

```text
Clicked WhatsApp link does not mean joined WhatsApp group.
Do not set active_member from this click.
```

If no matching row is found:

```text
Still redirect to WhatsApp group.
Log mismatch separately later if needed.
Do not block the user.
```

---

## 21. Confirmation Email Phase

Build after paid-user-created and click tracking are stable.

Trigger:

```text
Successful payment row written
```

Content fields:

```text
Full name
Payment ID
Workshop name
Workshop schedule
WhatsApp community link
Support contact
Legal disclaimer link
```

Rules:

```text
Email failure must not block payment success.
Email failure should be logged.
No medical cure claims.
No unrealistic PCOS/PCOD reversal claims.
```

Pending decision:

```text
Email provider: not final
Options: Pabbly email connector, Gmail SMTP, Resend, another approved provider
```

---

## 22. WhatsApp Onboarding Phase

Build after email phase or in parallel if provider is finalized.

Trigger:

```text
Successful payment row written
```

Source phone:

```text
Razorpay customer contact or Razorpay notes whatsapp_no
```

Rules:

```text
WhatsApp failure must not block payment success.
Do not mark active_member from message sent.
Log failures for manual follow-up.
```

Pending decision:

```text
WhatsApp provider not final
```

---

## 23. Reminder Loop Phase

Build after click tracking and WhatsApp provider are stable.

Schedule:

```text
Every 10 to 15 minutes
```

Logic:

```text
Find paid users where:
- Status = Paid
- Member Status is not active
- reminder_count < 4
- next_reminder_at is due
- manual_followup_required is not true
```

Action:

```text
Send WhatsApp or email reminder
Increment reminder_count
Set last_reminder_sent_at
Set next_reminder_at to 1 to 1.5 hours later
```

After 4 reminders:

```text
Set manual_followup_required = TRUE
Send admin alert
Do not send infinite reminders
```

---

## 24. Active Member Confirmation Phase

Allowed ways to set active_member:

```text
1. WhatsApp provider group_join webhook confirms join
2. Admin manually confirms in Google Sheet
```

Not allowed:

```text
Button click
Message sent
Payment success alone
```

---

## 25. Launch Checklist

Before real launch:

```text
[ ] Pabbly paid-user-created flow verified.
[ ] Failure and recovery verified.
[ ] n8n decommissioned or explicitly marked inactive.
[ ] WORKSHOP_ALLOWED_AMOUNTS_PAISE changed to 5100 only.
[ ] Razorpay payment page changed from INR 1 test to INR 51 live.
[ ] Active payment source allowlist verified.
[ ] Google Sheet test rows cleaned.
[ ] SUCCESSFUL PAYMENTS headers correct.
[ ] AUTOMATION FAILURES headers correct.
[ ] Thank You page opens after Razorpay redirect.
[ ] WhatsApp button works.
[ ] Email confirmation tested.
[ ] WhatsApp onboarding tested.
[ ] Reminder loop tested if launching with reminders.
[ ] Admin alert tested if launching with manual follow-up.
[ ] Legal pages reviewed.
[ ] Final landing page copy reviewed.
[ ] Coach photo displayed correctly.
[ ] Mobile layout checked.
[ ] Desktop layout checked.
[ ] Payment flow checked on mobile.
[ ] Payment flow checked on desktop.
```

---

## 26. What Is Complete

Do not rebuild these unless a bug is proven:

```text
Cloudflare DNS
Cloudflare Pages deployment
Razorpay webhook integration
Razorpay signature verification
Payment source allowlist
D1 durable registration capture
D1 automation event ledger
Retry worker schedule
Daily 7-day safe cleanup
Apps Script failure log
SUCCESSFUL PAYMENTS sheet format
AUTOMATION FAILURES sheet format
INR 1 testing mode
Landing page base design
Thank You page base flow
Legal/policy pages
Coach photo integration
```

---

## 27. What Is Not Complete

Current immediate work:

```text
Run clean INR 1 live payment test through Razorpay -> Cloudflare -> Pabbly -> Google Sheets.
Pabbly failure and recovery verification.
n8n decommission after Pabbly passes
```

Next product automation:

```text
WhatsApp click tracking through Pabbly
Confirmation email
WhatsApp onboarding
Reminder loop
Admin alert after repeated non-join
Active member confirmation path
```

UX polish:

```text
Thank You page final polish
Payment completion redirect speed expectations
Mobile review
Copy review
Visual animation polish only if it does not affect conversion or performance
```

---

## 28. Pending Inputs From Owner

Needed for Pabbly migration:

```text
Pabbly paid-user-created webhook URL: received and configured
Proof Pabbly can report failure if Google Sheets action fails, or approval for callback workaround
```

Needed for WhatsApp click tracking:

```text
Pabbly click-tracking webhook URL
Final redirect method supported by Pabbly
```

Needed for email:

```text
Email sender provider
Sender email
Credentials or connector access
Final confirmation email copy
```

Needed for WhatsApp onboarding:

```text
WhatsApp provider
Customer support phone number
Approved WhatsApp message template
Template approval status if using WhatsApp Cloud API
```

Needed before launch:

```text
Final INR 51 confirmation
Final weekly workshop schedule handling
Final legal wording approval
Final test row cleanup decision
```

---

## 29. Exact Next Task

Do this next:

```text
Run the INR 1 end-to-end payment test against the live site.
```

Then implement:

```text
1. Run INR 1 payment test.
2. Confirm Razorpay captured.
3. Confirm D1 registration and automation event captured.
4. Confirm Pabbly execution ran.
5. Confirm SUCCESSFUL PAYMENTS updated.
6. Confirm AUTOMATION FAILURES stayed empty.
7. Run broken-Pabbly failure test.
8. Restore Pabbly URL.
9. Confirm retry recovery.
10. Decommission n8n.
11. Update this file.
```

---

## 30. Change Log

| Date | Version | Change |
| --- | --- | --- |
| 03 May 2026 | 1.0 | Created hybrid source-of-truth and migration playbook from current build plus WHM101 Codex master prompt. |
| 03 May 2026 | 1.1 | Added code-level migration prep: generic automation webhook support, Pabbly env support, n8n fallback, generic WhatsApp click tracking env support. |
| 03 May 2026 | 1.2 | Received Pabbly paid-user-created webhook URL and configured it for Cloudflare Pages and retry worker deployment. |
| 03 May 2026 | 1.3 | Local Wrangler deploy attempted but blocked by expired/invalid Cloudflare token. Deployment still needs dashboard redeploy or refreshed CLOUDFLARE_API_TOKEN. |
| 03 May 2026 | 1.4 | Wrangler OAuth login completed, Cloudflare Pages and retry worker deployed, and production health verified automation_provider = pabbly. |
| 03 May 2026 | 1.5 | Added explicit rule that Razorpay webhooks must point to Cloudflare and Pabbly must remain downstream automation only. |
| 03 May 2026 | 1.6 | Verified Pabbly now writes mapped paid-user rows into SUCCESSFUL PAYMENTS and AUTOMATION FAILURES remains empty. |
