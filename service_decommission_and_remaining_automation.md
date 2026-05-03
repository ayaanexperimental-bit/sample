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

Added a direct failure logging path for the owner-facing Google Sheet:

```text
Tab name: AUTOMATION FAILURES
Purpose: manual follow-up visibility when n8n was offline or unreachable
Source of truth: Cloudflare D1
Failure writer: Google Apps Script webhook, called directly by Cloudflare Worker
Setup doc: automation_failure_log_setup.md
```

Important behavior:

```text
n8n offline -> D1 captures the failed/pending event
n8n offline -> Cloudflare writes/updates AUTOMATION FAILURES directly through Apps Script
n8n recovers -> retry Worker sends the old event again
n8n writes SUCCESSFUL PAYMENTS
Cloudflare removes the matching row from AUTOMATION FAILURES through Apps Script
```

The failure sheet is still not the failure source of truth. D1 remains the source of truth if n8n, Apps Script, or Google Sheets is unavailable.

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

### 2A. Razorpay Page Change Safety

Current automation is isolated to the active WHM101 Razorpay payment page/link:

```text
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO
```

Editing copy, branding, fields, or redirect on the same Razorpay page should not break automation. Replacing the page/link requires updating the accepted identifiers first.

Detailed maintenance checklist:

```text
razorpay_payment_page_change_safety.md
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
