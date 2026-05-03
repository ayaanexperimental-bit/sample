# Automation Failure Log Setup

## Purpose

`AUTOMATION FAILURES` is a human-readable recovery log for cases where n8n was offline or unreachable when a paid lead was first captured.

D1 remains the real source of truth. This sheet is only for owner visibility and manual follow-up.

## Required Google Sheet Tab

Create a new tab named exactly:

```text
AUTOMATION FAILURES
```

Add these headers in row 1:

```text
Timestamp
Razorpay Payment ID
Order ID
Full Name
Email ID
Mobile Number
Bot Status
Failure Status
Retry Count
Last Error
Recovered At
Manual Follow-up
```

## How It Works

1. Razorpay sends a paid webhook to Cloudflare.
2. Cloudflare stores the lead in D1.
3. Cloudflare tries to send the lead to n8n.
4. If n8n is offline, D1 keeps the event as failed.
5. Cloudflare directly writes/updates `AUTOMATION FAILURES` through Google Apps Script.
6. The retry Worker tries again every 5 minutes.
7. When n8n comes back online, Cloudflare sends the old event again with:

```text
automation_delivery_status = recovered_after_failure
automation_bot_status = offline
automation_retry_count = number of failed attempts
automation_last_error = last n8n/HTTP error
automation_recovered_at = recovery timestamp
```

8. n8n appends the normal lead to `SUCCESSFUL PAYMENTS`.
9. Cloudflare directly marks the matching `AUTOMATION FAILURES` row as `Resolved`.

## Apps Script Setup

Use this file:

```text
google_apps_script_failure_log.js
```

Steps:

1. Open Google Sheets.
2. Go to `Extensions` -> `Apps Script`.
3. Paste the full script from `google_apps_script_failure_log.js`.
4. Replace:

```text
REPLACE_WITH_LONG_RANDOM_SECRET
```

with a long random secret.

5. Deploy as a Web App.
6. Set access to allow webhook requests.
7. Copy the Web App URL.
8. Add these Cloudflare Worker/Page environment variables:

```text
FAILURE_LOG_WEBHOOK_URL=
FAILURE_LOG_WEBHOOK_SECRET=
```

`FAILURE_LOG_WEBHOOK_SECRET` must match the secret in Apps Script.

## Direct Failure Logging

This failure log does not depend on n8n.

```text
n8n offline
-> D1 stores failed event
-> Cloudflare calls Apps Script directly
-> AUTOMATION FAILURES shows Bot Status = Offline
```

When n8n recovers:

```text
retry succeeds
-> n8n writes SUCCESSFUL PAYMENTS
-> Cloudflare calls Apps Script directly
-> AUTOMATION FAILURES row becomes Resolved
```

## Updated n8n Workflow File

Use:

```text
n8n_paid_user_created_clean_sheet.json
```

This workflow remains intentionally simple:

```text
Webhook
→ Append clean paid user row
```

The failure sheet does not depend on n8n. Cloudflare/Apps Script is the direct failure-log path.

## Important Limitation

If both n8n and Google Apps Script/Google Sheets are unavailable, D1 still remains the source of truth. The failure row may not appear immediately, but paid lead capture is still protected in D1.

During n8n downtime:

```text
D1 = protected capture
AUTOMATION FAILURES = updated directly through Apps Script
```

After recovery:

```text
SUCCESSFUL PAYMENTS gets the paid lead
AUTOMATION FAILURES marks that lead Resolved
```
