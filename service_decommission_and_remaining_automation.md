# Service Decommission And Remaining Automation

Status: Cloudflare migration completed. Netlify and the old payment ecosystem must stay out of the active path.

## Active Production Ecosystem

```text
GoDaddy domain
-> Cloudflare DNS
-> Cloudflare Pages + Pages Worker
-> Razorpay Payment Page
-> Razorpay webhook to Cloudflare Worker
-> n8n Cloud
-> Google Sheets
```

Active domain:

```text
https://freedomfromdiabetes.in
```

Active Razorpay webhook:

```text
https://freedomfromdiabetes.in/api/payments/razorpay/webhook
```

Active n8n paid-user webhook:

```text
https://ayaantester.app.n8n.cloud/webhook/whm101-paid-user-created
```

Active n8n WhatsApp click webhook:

```text
https://ayaantester.app.n8n.cloud/webhook/whm101-whatsapp-clicked
```

## Removed From Active Path

Netlify is no longer an approved production host for this project.

Do not use:

```text
incandescent-tartufo-4b3df5.netlify.app
*.netlify.app
75.2.60.5
```

Pabbly or the old payment-page automation should not receive new WHM101 production leads.

## External Decommission Checklist

These actions must be completed inside the external dashboards because they are outside the repository.

### Netlify

1. Open Netlify dashboard.
2. Open the old `freedomfromdiabetes` / `incandescent-tartufo` project.
3. Confirm no custom domain is attached.
4. Disconnect GitHub repository access if present.
5. Disable auto-publishing.
6. Remove environment variables and secrets.
7. Delete the Netlify project only after Cloudflare has been stable for 48 hours.
8. Revoke Netlify GitHub App access from GitHub if no other projects need it.

### GitHub

1. Open GitHub repository settings for `ayaanexperimental-bit/sample`.
2. Check Webhooks.
3. Remove any Netlify webhook.
4. Keep Cloudflare/GitHub access only if Cloudflare is importing from GitHub.

### Razorpay

1. Ensure webhook URL is the main domain only.
2. Remove old temporary deployment webhook URLs.
3. Remove old payment page automation links that send leads to Pabbly for WHM101.
4. Keep enabled events:
   - `payment.captured`
   - `order.paid`
   - `payment_link.paid`

## Remaining Automation Work

### 1. Durable Registration Storage

Implemented as the hidden reliability ledger:

```text
Cloudflare D1 database: whm101-db
registrations table
automation_events table
idempotency by razorpay_payment_id
scheduled retry failed n8n dispatches
safe 7-day cleanup for sent records
```

This prevents paid registrations from being lost if n8n or Google Sheets is unavailable.

### 1A. Automation Failure Visibility

Added a recovered-failure logging path for the owner-facing Google Sheet:

```text
Tab name: AUTOMATION FAILURES
Purpose: manual follow-up visibility when n8n was offline or unreachable
Source of truth: Cloudflare D1
Workflow template: n8n_paid_user_created_clean_sheet.json
Setup doc: automation_failure_log_setup.md
```

Important behavior:

```text
n8n offline -> D1 captures the failed/pending event
n8n recovers -> retry Worker sends the old event again
n8n writes SUCCESSFUL PAYMENTS
n8n writes AUTOMATION FAILURES with Bot Status = Offline
```

The failure sheet is not the failure source of truth because n8n cannot write to Google Sheets while n8n itself is offline.

Safety rule:

```text
Only sent/synced old records are deleted automatically.
Pending, failed, and dead records are retained.
```

### 2. n8n Paid User Workflow Completion

Current confirmed:

```text
Append paid participant to SUCCESSFUL PAYMENTS
```

Still required:

```text
Send confirmation email
Send WhatsApp onboarding message
Admin alert when phone/email is missing
```

### 3. n8n WhatsApp Click Tracking

Required:

```text
Thank You Page button -> n8n click webhook
n8n marks group_link_clicked
n8n redirects to WhatsApp community invite
```

Current risk:

```text
If the n8n click webhook is not active, the success page may fall back to direct WhatsApp link.
```

### 4. Reminder Loop

Required before unattended operations:

```text
Run every 10-15 minutes
Find paid_not_joined users
Send up to 4 reminders
Mark manual_followup_required after 4 reminders
Send admin alert
```

This needs either extra tracking columns or D1 as the source of truth.

### 5. Active Member Confirmation

Do not mark `active_member` from link click alone.

Only set `active_member` when:

```text
WhatsApp provider confirms group join
or admin manually confirms
```

### 6. Final Launch Cleanup

Before final launch:

```text
Remove INR 1 test payment acceptance
Set WORKSHOP_ALLOWED_AMOUNTS_PAISE=5100
Set Razorpay page amount back to INR 51
Run one final INR 51 payment test
Confirm Google Sheet row
Confirm email
Confirm WhatsApp onboarding
Confirm reminder logic
```
