# Consolidated Landing Page and Automation Implementation Plan

Source files:
- `C:\Users\Yours Wellness\Downloads\deep-research-report(1).md`
- `C:\Users\Yours Wellness\Downloads\payment_google_sheets_email_whatsapp_automation_update.md`

Current architecture update:
- `n8n_first_architecture_update.md`

## 1. Executive Summary

The project is a production-grade landing page and conversion system for a PCOS / women's wellness masterclass. The landing page remains the main product: it should be clear, mobile-first, medically safe, conversion-focused, and easy to trust.

The implementation direction is now lighter and n8n-first:

```text
Backend -> n8n -> Google Sheet / Email / WhatsApp / Reminders / Admin Alerts
```

The app backend should not become a full CRM. It should only verify payment, create confirmed registrations, send `paid_user_created` to n8n, and show the Thank You page.

## 2. Correct Production Flow

```text
Instagram Ad / UTM Source
-> Landing Page
-> User clicks Pay INR 29
-> Razorpay Standard Checkout opens
-> User completes payment
-> Backend verifies Razorpay payment
-> Backend creates confirmed registration
-> Backend sets payment_status = success
-> Backend sets member_status = paid_not_joined
-> Backend sends paid_user_created event to n8n
-> User is redirected immediately to Thank You Page
-> Thank You Page button points to n8n tracking webhook
-> User clicks WhatsApp community button
-> n8n marks member_status = group_link_clicked
-> n8n redirects user to real WhatsApp community link
-> n8n updates Google Sheet
-> n8n sends confirmation email
-> n8n sends WhatsApp onboarding/reminders
-> n8n sends admin alert if manual follow-up is required
```

Critical rules:

- Payment success must be verified server-side before confirmed registration is created.
- Do not wait for n8n before showing the Thank You page.
- Do not wait for Google Sheets, email, or WhatsApp automation before showing the WhatsApp community action.
- Clicked WhatsApp link is not the same as joined group.
- Mark `active_member` only after a supported group-join webhook or admin confirmation.

## 3. System Principles

- Use a mobile-first, premium, health-safe landing page.
- Avoid cure, permanent reversal, guaranteed fertility, guaranteed skin, or guaranteed timeline claims.
- Use safer language such as learn, support, improve, understand, symptom-aware, sustainable, clinician-supervised, and results vary.
- Use Razorpay Standard Checkout with Orders API; never collect raw card data.
- Verify payment server-side before registration confirmation.
- Store confirmed registration records in the database.
- Keep Google Sheets as reporting only.
- Let n8n handle Google Sheets, email, WhatsApp onboarding, reminders, and admin alerts.
- Log failed n8n dispatches for retry.
- Keep Codex implementation phase-gated and micro-tasked.

## 4. Recommended Architecture

Default stack:

- Next.js App Router
- TypeScript
- Clean landing-page styling
- Route Handlers for minimal backend endpoints
- Database as source of truth
- Google Sheets as reporting sink through n8n
- Razorpay Standard Checkout with Orders API
- n8n event dispatch for automation handoff
- Environment-variable based configuration

High-level topology:

```text
User Browser
-> Next.js Landing Page
-> Create Razorpay Order
-> Razorpay Checkout
-> Payment Verification Endpoint
-> Database
-> Thank You Page
-> n8n WhatsApp Tracking Webhook
-> Google Sheets / Email / WhatsApp / Reminders / Admin Alerts
```

## 5. Required Pages and Routes

Public pages:

- `/` landing page
- `/thank-you/[registrationToken]`
- `/payment-pending`
- `/payment-failed`
- `/privacy`
- `/terms`
- `/disclaimer`
- `/refund`
- `/cancellation`

Backend routes for the current payment/n8n phase:

- `POST /api/checkout/create-order`
- `POST /api/payments/razorpay/verify`
- `POST /api/payments/razorpay/webhook`
- `GET /api/registrations/[registrationToken]`
- `POST /api/automation/n8n/dispatch`

Do not create a full admin dashboard yet.

## 6. Minimum Data Models

### `registrations`

Stores confirmed paid registrations and payment/member state.

Fields:

- `id`
- `registration_token`
- `full_name`
- `phone_number`
- `email`
- `program_slug`
- `workshop_slot`
- `amount`
- `currency`
- `payment_status`
- `member_status`
- `razorpay_order_id`
- `razorpay_payment_id`
- `razorpay_signature_verified`
- `joined_whatsapp_group`
- `joined_whatsapp_group_at`
- `automation_dispatched`
- `automation_dispatch_error`
- `created_at`
- `updated_at`

### `automation_events`

Stores backend-to-n8n `paid_user_created` payloads, dispatch status, retry count, and errors.

Fields:

- `id`
- `registration_id`
- `event_type`
- `payload_json`
- `status`
- `retry_count`
- `last_error`
- `created_at`
- `sent_at`

## 7. Status Definitions

`payment_status`:

- `created`
- `attempted`
- `success`
- `failed`
- `pending`
- `refunded`
- `disputed`

`member_status`:

- `paid_not_joined`
- `group_link_clicked`
- `active_member`
- `reminder_1_sent`
- `reminder_2_sent`
- `reminder_3_sent`
- `reminder_4_sent`
- `manual_followup_required`

## 8. n8n Automation Ownership

### Workflow 1: Paid User Created

Backend sends `paid_user_created`.

n8n actions:

- Add/update Google Sheet row.
- Set `payment_status = success`.
- Set `member_status = paid_not_joined`.
- Send confirmation email.
- Send WhatsApp onboarding message.
- Set `reminder_count = 0`.
- Set `next_reminder_at = now + 15 minutes`.

### Workflow 2: WhatsApp Link Clicked

User clicks the n8n tracking webhook URL from the Thank You page.

This is Option B for the WhatsApp community button:

```text
Thank You Page button -> n8n click-tracking webhook -> real WhatsApp community invite link
```

n8n actions:

- Update the same Google Sheet row.
- Set `whatsapp_group_link_clicked = yes`.
- Set `whatsapp_group_link_clicked_at = timestamp`.
- Set `member_status = group_link_clicked`.
- Redirect user to the real WhatsApp community invite link.

The website/backend does not receive or process the WhatsApp click. It only sends `paid_user_created` after verified payment.

### Workflow 3: Reminder Loop

Scheduled n8n workflow every 10-15 minutes.

Logic:

- `payment_status = success`
- `member_status` is not `active_member`
- `reminder_count < 4`
- `current time >= next_reminder_at`
- `manual_followup_required = false`

After 4 reminders:

- Set `member_status = manual_followup_required`.
- Set `manual_followup_required = true`.
- Send admin WhatsApp alert.

### Workflow 4: Future Group Join Detection

Only if the WhatsApp provider supports group join webhook:

- Match phone number with paid registration.
- Set `member_status = active_member`.
- Set `joined_whatsapp_group = yes`.
- Set `joined_whatsapp_group_at = timestamp`.
- Stop future reminders.

## 9. n8n Event Contract

### `paid_user_created`

Required payload fields:

- `event_type`
- `registration_id`
- `registration_token`
- `full_name`
- `phone_number`
- `email`
- `program_slug`
- `workshop_slot`
- `amount`
- `currency`
- `payment_status`
- `member_status`
- `razorpay_order_id`
- `razorpay_payment_id`
- `whatsapp_group_link`
- `thank_you_url`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `created_at`

### `whatsapp_group_link_clicked`

This is handled by the n8n tracking webhook, not by a backend app route.

Required n8n click webhook payload:

```json
{
  "event_type": "whatsapp_group_link_clicked",
  "registration_id": "string",
  "registration_token": "string",
  "full_name": "string",
  "phone_number": "string",
  "email": "string",
  "program_slug": "string",
  "payment_status": "success",
  "member_status": "group_link_clicked",
  "clicked_at": "ISO timestamp"
}
```

Clicked link does not mean joined group. `active_member` can only be set by a WhatsApp `group_join` webhook or manual admin confirmation.

## 10. Google Sheet Reporting Structure

Google Sheets will be managed by n8n, not direct backend sync in the current phase.

Provided Sheet ID:

```text
1D1orv4pqfmI7WRGzvCP_jMspFlAQPaXTDm5H3HerxO8
```

Owner/admin email:

```text
ayaanexperimental@gmail.com
```

Service account email:

```text
workshop-sheet-writer@pcos-landing-page-automation.iam.gserviceaccount.com
```

The service account setup remains documented for n8n/reporting access.

## 11. Required Environment Placeholders

```text
RAZORPAY_MODE=test
RAZORPAY_TEST_KEY_ID=
RAZORPAY_TEST_KEY_SECRET=
RAZORPAY_LIVE_KEY_ID=
RAZORPAY_LIVE_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

WORKSHOP_AMOUNT_PAISE=2900
WORKSHOP_CURRENCY=INR

WHATSAPP_COMMUNITY_INVITE_URL=

N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
N8N_WHATSAPP_CLICK_TRACKING_URL=
```

Do not expose secrets in frontend, GitHub, logs, or browser console.

## 12. Implementation Plan

### Phase 0: Audit, Spec, and Architecture

Goal: define the target build before implementation.

Exit condition:

- Approved spec, IA, n8n-first architecture, and missing-resource list.

### Phase 1: Frontend Skeleton and Landing Page

Goal: build the public landing page shell in small, reviewable increments.

Exit condition:

- Mobile-first landing page works with placeholder-safe content and no obvious layout or responsive failures.

### Phase 2: Payment, Thank You Page, and n8n Handoff

Goal: build the minimal backend workflow needed for verified payment, confirmed registration, immediate Thank You page, and `paid_user_created` n8n handoff.

Tasks:

- Add minimal `registrations` model/status fields.
- Add Razorpay test order creation route.
- Add Razorpay payment verification route.
- Add secure Thank You Page registration token lookup.
- Add Thank You page n8n tracking button URL support.
- Add n8n `paid_user_created` event dispatch service with placeholder env vars.
- Add `automation_events` retry-safe logging.
- Add tests for payment success -> Thank You -> n8n tracking button URL.

Exit condition:

- Successful verified payment creates a confirmed registration and shows the Thank You page immediately.
- WhatsApp community button uses `N8N_WHATSAPP_CLICK_TRACKING_URL`.
- n8n receives `paid_user_created` from the backend and handles WhatsApp click tracking itself.
- Failed n8n dispatch is logged for retry without blocking the user.
- No direct backend Google Sheets, email, WhatsApp, reminder, or CRM automation is built in this phase.

Final ownership rule:

- Backend = payment verification only.
- n8n = post-payment automation brain.
- Thank You button = n8n tracking first, WhatsApp redirect second.

### Phase 3: Production Hardening

Goal: make the system ready for public ad traffic.

Tasks:

- Add monitoring.
- Add request-level structured logging.
- Add security headers.
- Tighten rate limiting.
- Add deployment docs.
- Add staging and production environment docs.
- Add launch checklist.

## 13. Current Missing Items

### Payment

- Razorpay test key ID.
- Razorpay test key secret.
- Razorpay live key ID.
- Razorpay live key secret.
- Razorpay webhook secret.
- Razorpay dashboard webhook event selections.
- Post-payment fallback fields if Razorpay contact details are missing.

### n8n

- n8n webhook URL.
- n8n webhook secret.
- n8n Google Sheets credential method.
- n8n email credential/provider.
- n8n WhatsApp provider credential.
- Reminder interval confirmation.
- Admin WhatsApp alert recipient.
- Group-join webhook availability.

### WhatsApp

- Real WhatsApp community invite URL.
- WhatsApp provider.
- Support WhatsApp number.

### Business / Content

- Coach name, role, bio, and public credentials.
- Final date, time, duration, language, and delivery platform.
- Final testimonials and permissions.
- Final support email.
- Final domain/deployment target.

## 14. Codex Micro-Task Protocol

Every implementation step should end with:

```text
MICRO-TASK COMPLETE

Goal of this micro-task:
- ...

Changes made:
- ...

Files created:
- ...
Files modified:
- ...

Why these changes were made:
- ...

How to test this micro-task:
1. ...
2. ...
3. ...

Expected result:
- ...

Assumptions:
- ...

Missing assets or decisions:
- ...

Should I proceed to the next micro-task?
Please reply with one of:
- "change this"
- "approved, continue"
```

Codex must not continue to the next micro-task without explicit approval.

## 15. Immediate Next Step

Current step:

```text
Step 1: Update planning docs with the n8n-first automation architecture.
Stop and show diff.
```

Next step after approval:

```text
Step 2: Add minimal registration model/status fields.
Stop and show diff.
```
