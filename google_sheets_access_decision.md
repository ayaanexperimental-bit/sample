# Google Sheets Access Decision

Status: Approved setup details retained, direct backend implementation deferred.

## Current Decision

Use n8n as the active Google Sheets automation layer for now.

Current production direction:

```text
Backend -> n8n -> Google Sheet
```

Not current production direction:

```text
Backend -> Google Sheet directly
```

## Data Ownership Rule

The database remains the source of truth.

Google Sheets is only an owner-friendly reporting dashboard.

## Why Direct Backend Sync Is Deferred

The project is moving to a lighter backend:

- Backend verifies Razorpay payment.
- Backend creates confirmed registration.
- Backend shows the Thank You page.
- Backend tracks WhatsApp community link clicks.
- Backend sends structured events to n8n.
- n8n writes and updates Google Sheets.

Do not build Google Sheets sync jobs, retry workers, or Sheets column mapping directly inside the app backend unless requested later.

## Existing Google Setup To Keep Documented

The following setup is still useful because n8n may use it to access Google Sheets:

1. Google Cloud project
2. Google Sheets API enabled
3. Service account
4. JSON key
5. Google Sheet
6. Sheet shared with service account email as Editor

## Provided Google Sheet ID

```text
1D1orv4pqfmI7WRGzvCP_jMspFlAQPaXTDm5H3HerxO8
```

## Provided Access Details

Google Sheet owner/admin email:

```text
ayaanexperimental@gmail.com
```

Service account email:

```text
workshop-sheet-writer@pcos-landing-page-automation.iam.gserviceaccount.com
```

The sheet has been shared with the service account as Editor.

## Current Missing n8n Details

- n8n webhook URL.
- n8n webhook secret.
- Final Google Sheet tab and column mapping used inside n8n.
- Confirmation that n8n will authenticate to Google Sheets using the service account or another approved connection.

## Implementation Timing

Do not build direct backend Google Sheets sync in the current micro-task sequence.

Use this document when configuring n8n workflows later.
