# WHM101 Source Of Truth

Status: hard reset approved

Last updated: 03 May 2026

Project: Women Health Masterclass 101

Domain: https://freedomfromdiabetes.in

This file is the active source of truth. If older planning documents conflict with this file, this file wins.

---

## Current Direction

The project has been reset to a lean architecture.

The website is only the landing page and user-facing success page. It does not verify payments, store registrations, call automation webhooks, retry failed automations, or write to Google Sheets.

Payment data belongs to Razorpay. Automation belongs to Pabbly Connect. Reporting belongs to Google Sheets.

```text
Landing page
-> Razorpay hosted checkout
-> Razorpay captures payment
-> Pabbly native Razorpay trigger receives payment captured event
-> Pabbly writes SUCCESSFUL PAYMENTS row in Google Sheets
-> Pabbly sends email/WhatsApp follow-up when configured
```

---

## Kept

```text
Domain: freedomfromdiabetes.in
DNS/CDN: Cloudflare
Hosting: Cloudflare Pages
Landing page frontend
Thank You / success page frontend
Razorpay hosted checkout URL
WhatsApp community URL
Google Sheets reporting through Pabbly
```

---

## Removed From Active Build

```text
Cloudflare webhook handler
Cloudflare D1 durable capture
Retry worker
Apps Script failure logger
AUTOMATION FAILURES app logic
Payment source allowlist code
Razorpay webhook signature verification code
App API routes for checkout/payment/leads/health
n8n fallback configuration
Custom backend registration model
```

---

## Active URLs

```text
Website: https://freedomfromdiabetes.in
Razorpay hosted checkout: https://rzp.io/rzp/xBIZzJHv
WhatsApp community: https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4
```

---

## Current App Environment

Only public frontend values are needed by the website:

```env
NEXT_PUBLIC_SITE_URL=https://freedomfromdiabetes.in
NEXT_PUBLIC_PAYMENT_ENABLED=true
NEXT_PUBLIC_RAZORPAY_HOSTED_CHECKOUT_URL=https://rzp.io/rzp/xBIZzJHv
NEXT_PUBLIC_WHATSAPP_COMMUNITY_INVITE_URL=https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4
ENABLE_PROMPT_LAB=false
```

No Razorpay secret, Pabbly webhook, Google API credential, n8n URL, D1 binding, or Apps Script secret belongs in this app anymore.

---

## Pabbly Setup Requirement

Use Pabbly Connect native Razorpay integration.

```text
Trigger: Razorpay - Payment Captured
Action: Google Sheets - Add Row in SUCCESSFUL PAYMENTS
```

Pabbly should map Razorpay payment fields into:

```text
Timestamp
Email ID
Full Name
First Name
Last Name
Mobile Number
Payment ID
Amount
Status
WhatsApp Clicked
Clicked At
Member Status
```

Minimal currently accepted sheet format:

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

---

## Hard Rules

```text
1. Do not rebuild custom payment backend logic.
2. Do not add D1 back unless the owner explicitly reverses this reset.
3. Do not add n8n back unless the owner explicitly asks for it.
4. Do not point Razorpay webhook to this app.
5. Do not store Razorpay secrets in this repository.
6. Do not store Google service account credentials in this repository.
7. Razorpay is the payment source of truth.
8. Google Sheets is owner-facing reporting only.
9. Pabbly owns post-payment automation.
10. active_member must not be set only from a button click.
```

---

## Owner Revocation Checklist

These actions happen in external dashboards and must be completed by the owner:

```text
[ ] Delete Razorpay webhook that pointed to Cloudflare Worker.
[ ] Delete Cloudflare D1 database whm101-db.
[ ] Delete Cloudflare retry worker freedomfromdiabetes-retry-worker.
[ ] Delete old Apps Script failure logger deployments.
[ ] Revoke Google OAuth / service-account access created for the old build.
[ ] Delete old n8n workflows and credentials if no longer needed.
[ ] Remove stale Cloudflare environment variables/secrets not listed above.
[ ] Keep Pabbly native Razorpay integration active.
```

---

## Immediate Test Procedure

```text
1. Open https://freedomfromdiabetes.in.
2. Click Pay Rs. 51.
3. Confirm Razorpay hosted checkout opens.
4. Complete a small test payment only if the Razorpay page is temporarily set to INR 1.
5. Confirm Razorpay shows payment captured.
6. Confirm Pabbly execution ran from native Razorpay trigger.
7. Confirm SUCCESSFUL PAYMENTS row appears in Google Sheets.
8. Confirm no duplicate row appears for the same Razorpay payment ID.
```

If the sheet does not update:

```text
Check Pabbly execution history first.
Then check Razorpay captured payment details.
Then check Pabbly Google Sheets field mapping.
Do not debug this in the website code unless the Pay button itself fails to open Razorpay.
```

---

## Future Phases

Build these in Pabbly, not in this app:

```text
1. Confirmation email.
2. WhatsApp onboarding message.
3. WhatsApp click tracking.
4. Reminder workflow.
5. Admin alert.
6. Manual active_member confirmation process.
```

Website changes should stay limited to:

```text
Landing page copy/design
Razorpay hosted checkout URL
Success page copy
WhatsApp community link
Legal pages
```

---

## Change Log

| Date | Version | Change |
| --- | --- | --- |
| 03 May 2026 | 2.0 | Hard reset approved. Active build moved to landing page + Razorpay hosted checkout only. Custom Worker, D1, retry, Apps Script failure logging, and n8n fallback removed from active app direction. |
