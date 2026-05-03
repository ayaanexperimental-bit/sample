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
5. The retry Worker tries again every 5 minutes.
6. When n8n comes back online, Cloudflare sends the old event again with:

```text
automation_delivery_status = recovered_after_failure
automation_bot_status = offline
automation_retry_count = number of failed attempts
automation_last_error = last n8n/HTTP error
automation_recovered_at = recovery timestamp
```

7. n8n appends the normal lead to `SUCCESSFUL PAYMENTS`.
8. n8n also appends a recovery row to `AUTOMATION FAILURES`.

## Updated n8n Workflow File

Use:

```text
n8n_paid_user_created_clean_sheet.json
```

This workflow now has:

```text
Webhook
→ Append clean paid user row
→ Recovered after automation failure?
→ Append automation failure log
```

The failure log branch only runs when:

```text
automation_delivery_status = recovered_after_failure
```

## Important Limitation

If n8n is offline, the failure sheet cannot update immediately because n8n is the service that writes to Google Sheets.

During downtime:

```text
D1 = protected capture
Google Sheet = waits until n8n recovers
```

After recovery:

```text
SUCCESSFUL PAYMENTS gets the paid lead
AUTOMATION FAILURES gets the recovery/failure log
```
