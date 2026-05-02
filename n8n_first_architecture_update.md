# n8n-First Architecture Update

Status: Current project direction.

## Core Decision

Keep the app lean and landing-page focused.

The backend should only verify payment, create confirmed registrations, send `paid_user_created` to n8n, and show the Thank You page.

n8n handles Google Sheets, email, WhatsApp onboarding, reminders, and admin alerts.

## Correct Production Flow

```text
Landing Page
-> Razorpay Standard Checkout for INR 51
-> Verified payment
-> Confirmed registration created
-> payment_status = success
-> member_status = paid_not_joined
-> Backend sends paid_user_created to n8n
-> Immediate Thank You Page
-> Thank You page button points to n8n tracking webhook
-> n8n marks member_status = group_link_clicked after click
-> n8n redirects to real WhatsApp invite link
-> n8n updates Google Sheet and sends messages
```

WhatsApp community button decision:

```text
Option B: Thank You Page button -> n8n click-tracking webhook -> real WhatsApp community invite link
```

The Thank You Page button must not directly point to the raw WhatsApp group link.

Button URL must be configurable:

```text
N8N_WHATSAPP_CLICK_TRACKING_URL=
```

Example:

```text
https://n8n.yourdomain.com/webhook/join-whatsapp?registration_id=abc123
```

Final ownership rule:

- Backend = payment verification only.
- n8n = post-payment automation brain.
- Thank You button = n8n tracking first, WhatsApp redirect second.

## Backend Scope

Build only:

- Razorpay order creation.
- Razorpay payment verification.
- Razorpay webhook handling if needed.
- Confirmed registration creation after verified payment.
- Secure registration token generation.
- Thank You page registration lookup.
- n8n `paid_user_created` event dispatch.
- Failed n8n dispatch logging for retry.

Do not build now:

- Direct Google Sheets sync.
- Email sending.
- WhatsApp sending.
- Reminder loop.
- Admin follow-up messaging.
- Full CRM dashboard.

## Required Backend Routes

- `POST /api/checkout/create-order`
- `POST /api/payments/razorpay/verify`
- `POST /api/payments/razorpay/webhook`
- `GET /api/registrations/[registrationToken]`
- `POST /api/automation/n8n/dispatch`

## Status Definitions

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

Clicked WhatsApp link is not active membership.

## n8n Events

### `paid_user_created`

Sent after verified payment and confirmed registration creation.

Required fields:

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
- UTM fields
- `created_at`

### `whatsapp_group_link_clicked`

Owned by the n8n tracking webhook after the Thank You page button is clicked.

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

## n8n Workflows

Workflow 1: Paid User Created

- Add/update Google Sheet row.
- Set `payment_status = success`.
- Set `member_status = paid_not_joined`.
- Send confirmation email.
- Send WhatsApp onboarding message.
- Set reminder fields.

Workflow 2: WhatsApp Link Clicked

- Triggered by the n8n tracking webhook URL from the Thank You Page button.
- Update Google Sheet row.
- Mark WhatsApp group link clicked.
- Set `member_status = group_link_clicked`.
- Redirect user to the real WhatsApp community invite link.

Workflow 3: Reminder Loop

- Run every 10-15 minutes.
- Remind paid users who are not confirmed active members.
- Stop after 4 reminders and mark manual follow-up required.

Workflow 4: Future Group Join Detection

- Only if the WhatsApp provider supports group join webhooks.
- Mark `active_member` only after verified join event or admin confirmation.

## Environment Placeholders

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

## Micro-Step Order

1. Update planning docs with this n8n-first automation architecture.
2. Add minimal registration model/status fields.
3. Add Razorpay test order creation route.
4. Add Razorpay payment verification route.
5. Add secure Thank You Page registration token lookup.
6. Add Thank You page n8n tracking button URL support.
7. Add n8n `paid_user_created` event dispatch service with placeholder env vars.
8. Add `automation_events` retry-safe logging.
9. Add tests for payment success -> Thank You -> n8n tracking button URL.

Stop after every step and wait for approval.
