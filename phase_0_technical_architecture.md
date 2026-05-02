# Phase 0 Technical Architecture

Micro-task: 0.3

Project: PCOS / Women's Wellness / Beauty Brand Landing Page and n8n-Powered Automation System

## 1. Current Architecture Direction

Use a lighter Next.js application with a minimal backend and an n8n-first automation layer.

The landing page remains the main product. The backend exists only to:

- Create Razorpay orders.
- Verify payment success.
- Create confirmed registrations.
- Show an immediate Thank You page.
- Send `paid_user_created` events to n8n.

Do not build a large backend CRM in the current phase.
Do not build direct Google Sheets, email, WhatsApp, reminder, or admin follow-up automation inside the app backend right now.

## 2. High-Level Production Flow

```text
Landing Page
-> User clicks Pay INR 51
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
-> n8n sends email confirmation
-> n8n sends WhatsApp onboarding/reminder messages
-> n8n sends admin alert if manual follow-up is required
```

Important:

- Do not wait for n8n before showing the Thank You page.
- Do not wait for Google Sheet updates before showing the n8n-tracked WhatsApp button.
- Do not wait for email or WhatsApp automation before allowing the user to join the community.

## 3. Recommended Stack

Frontend and app server:

- Next.js App Router.
- TypeScript.
- Route Handlers for the minimal backend endpoints.
- Clean landing-page focused UI.

Data:

- Database remains the source of truth.
- Google Sheets is an owner-friendly reporting dashboard, managed through n8n for now.

Payments:

- Razorpay Standard Checkout with Orders API.
- Server-side payment signature verification.
- Razorpay webhook route available for trusted provider events.

Automation:

- n8n receives `paid_user_created`, owns the WhatsApp tracking webhook, and owns Google Sheets, email, WhatsApp onboarding, reminders, and admin alerts.

## 4. Public Pages

| Route | Purpose |
|---|---|
| `/` | Main landing page |
| `/thank-you/[registrationToken]` | Immediate verified-payment Thank You page |
| `/payment-pending` | Pending payment state if needed |
| `/payment-failed` | Failed payment / retry path if needed |
| `/privacy` | Privacy policy |
| `/terms` | Terms and conditions |
| `/disclaimer` | Medical/results disclaimer |
| `/refund` | Refund policy |
| `/cancellation` | Cancellation policy |

## 5. Required Backend Routes

Create only these backend routes for the payment and n8n handoff phase:

| Route | Method | Purpose |
|---|---|---|
| `/api/checkout/create-order` | POST | Create a Razorpay order for INR 51 / 5100 paise |
| `/api/payments/razorpay/verify` | POST | Verify Razorpay Checkout payment signature and create confirmed registration |
| `/api/payments/razorpay/webhook` | POST | Handle Razorpay webhook events if needed |
| `/api/registrations/[registrationToken]` | GET | Serve safe registration data for the Thank You page |
| `/api/automation/n8n/dispatch` | POST | Dispatch `paid_user_created` events to n8n or retry failed dispatches |

Do not create a large admin dashboard yet.

## 6. Status Definitions

### `payment_status`

- `created`
- `attempted`
- `success`
- `failed`
- `pending`
- `refunded`
- `disputed`

### `member_status`

- `paid_not_joined`
- `group_link_clicked`
- `active_member`
- `reminder_1_sent`
- `reminder_2_sent`
- `reminder_3_sent`
- `reminder_4_sent`
- `manual_followup_required`

Clicked WhatsApp link is not the same as joined group.

Only mark `active_member` when:

- WhatsApp group join webhook confirms the user joined, if the provider supports it.
- Admin manually confirms the user joined.

## 7. Minimum Database Shape

### `registrations`

Purpose:

- Store confirmed paid registrations and payment/member state.

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

Purpose:

- Store backend-to-n8n `paid_user_created` dispatch attempts and allow failed dispatch retry without losing paid registrations.

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

## 8. n8n Responsibilities

### Workflow 1: Paid User Created

Trigger:

- Backend sends `paid_user_created`.

Actions:

- Add/update Google Sheet row.
- Set `payment_status = success`.
- Set `member_status = paid_not_joined`.
- Send confirmation email.
- Send WhatsApp onboarding message.
- Set `reminder_count = 0`.
- Set `next_reminder_at = now + 15 minutes`.

### Workflow 2: WhatsApp Link Clicked

Trigger:

- User clicks the n8n tracking webhook URL from the Thank You page.

Actions:

- Update the same Google Sheet row.
- Set `whatsapp_group_link_clicked = yes`.
- Set `whatsapp_group_link_clicked_at = timestamp`.
- Set `member_status = group_link_clicked`.
- Redirect the user to the real WhatsApp community invite link.

### Workflow 3: Reminder Loop

Trigger:

- Scheduled n8n workflow every 10-15 minutes.

Logic:

- Find paid users who are not `active_member`.
- Require `reminder_count < 4`.
- Require `current time >= next_reminder_at`.
- Require `manual_followup_required = false`.

Actions:

- Send WhatsApp reminder from customer support number.
- Increment `reminder_count`.
- Set `last_reminder_sent_at = now`.
- Set `next_reminder_at = now + 1 to 1.5 hours`.
- Update the same Google Sheet row.

After 4 reminders:

- Set `member_status = manual_followup_required`.
- Set `manual_followup_required = true`.
- Send admin WhatsApp alert for manual follow-up.

### Workflow 4: Future Group Join Detection

Only if the WhatsApp provider supports a group join webhook:

- Receive group join event.
- Match phone number with paid registration.
- Set `member_status = active_member`.
- Set `joined_whatsapp_group = yes`.
- Set `joined_whatsapp_group_at = timestamp`.
- Stop future reminders.

If group join webhook is not available, do not falsely mark `active_member`.

## 9. n8n Event Contract

### Event: `paid_user_created`

```json
{
  "event_type": "paid_user_created",
  "registration_id": "string",
  "registration_token": "string",
  "full_name": "string",
  "phone_number": "string",
  "email": "string",
  "program_slug": "string",
  "workshop_slot": "string",
  "amount": 5100,
  "currency": "INR",
  "payment_status": "success",
  "member_status": "paid_not_joined",
  "razorpay_order_id": "string",
  "razorpay_payment_id": "string",
  "whatsapp_group_link": "string",
  "thank_you_url": "string",
  "utm_source": "string",
  "utm_medium": "string",
  "utm_campaign": "string",
  "utm_content": "string",
  "utm_term": "string",
  "created_at": "ISO timestamp"
}
```

The `whatsapp_group_link_clicked` update is owned by n8n, triggered by the n8n tracking webhook button on the Thank You page.

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

## 10. Thank You Page Requirements

Use Option B for the WhatsApp community button:

```text
Thank You Page button -> n8n click-tracking webhook -> real WhatsApp community invite link
```

The Thank You page must show:

- Payment success message.
- Workshop confirmation.
- WhatsApp community join section.
- Primary button: `Join WhatsApp Community`.
- Secondary option: `Copy WhatsApp Group Link`.
- Backup instruction: if WhatsApp does not open, copy the link and open it on your phone.

The button target must be configurable through:

```text
N8N_WHATSAPP_CLICK_TRACKING_URL=
```

Example button target:

```text
https://n8n.yourdomain.com/webhook/join-whatsapp?registration_id=abc123
```

The main button must not directly expose only the raw WhatsApp invite URL.

n8n tracking webhook responsibilities:

- Receive the required `whatsapp_group_link_clicked` payload.
- Update Google Sheet with `member_status = group_link_clicked`.
- Set `whatsapp_group_link_clicked = true`.
- Set `whatsapp_group_link_clicked_at = current timestamp`.
- Redirect the user to the real WhatsApp community invite link.

The website/backend must not mark `active_member` from this click.

Final ownership rule:

- Backend = payment verification only.
- n8n = post-payment automation brain.
- Thank You button = n8n tracking first, WhatsApp redirect second.

## 11. Google Sheets Direction

Current direction:

```text
Backend -> n8n -> Google Sheet
```

Not current direction:

```text
Backend -> Google Sheet directly
```

The existing Google service account setup stays documented because n8n may use it for Google Sheets access. Do not build direct backend Google Sheets sync unless requested later.

## 12. Environment Variables

Use placeholders only. Do not expose secrets in frontend, GitHub, logs, or browser console.

```text
RAZORPAY_MODE=test
RAZORPAY_TEST_KEY_ID=
RAZORPAY_TEST_KEY_SECRET=
RAZORPAY_LIVE_KEY_ID=
RAZORPAY_LIVE_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

WORKSHOP_AMOUNT_PAISE=5100
WORKSHOP_CURRENCY=INR

WHATSAPP_COMMUNITY_INVITE_URL=

N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
N8N_WHATSAPP_CLICK_TRACKING_URL=
```

## 13. Deferred Backend Scope

Do not build these inside the app backend in the current phase:

- Google Sheets writing.
- Email sending.
- WhatsApp sending.
- Reminder loop.
- Admin follow-up messaging.
- Full CRM dashboard.

## 14. Micro-Step Implementation Order

Proceed slowly and stop after each step for approval:

1. Update planning docs with the n8n-first automation architecture.
2. Add minimal registration model/status fields.
3. Add Razorpay test order creation route.
4. Add Razorpay payment verification route.
5. Add secure Thank You Page registration token lookup.
6. Add Thank You page n8n tracking button URL support.
7. Add n8n `paid_user_created` event dispatch service with placeholder env vars.
8. Add `automation_events` retry-safe logging.
9. Add tests for payment success -> Thank You -> n8n tracking button URL.

## 15. Acceptance Criteria For This Architecture

This architecture is approved when:

- The landing page remains the main product.
- The backend is limited to payment verification, confirmed registration, Thank You page data, and `paid_user_created` n8n handoff.
- n8n owns Google Sheets, email, WhatsApp, reminders, and admin alerts.
- n8n owns WhatsApp click tracking and redirect.
- Thank You page is immediate after verified payment.
- WhatsApp link clicks are tracked without falsely marking active membership.
- The database remains the source of truth.
- Direct backend Google Sheets/email/WhatsApp automation is explicitly deferred.
