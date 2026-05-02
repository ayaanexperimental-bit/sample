# Payment Flow Decision

Status: Approved direction, implementation deferred until the payment phase.

## Decision

Use Razorpay Standard Checkout with Orders API.

The funnel should be payment-first, not lead-form-first.

## Reason

The business goal is to avoid collecting many low-intent unpaid leads. Paid registration is the qualification step.

## Approved Flow

```text
Landing page
-> User clicks Pay INR 51
-> Backend creates Razorpay order for 5100 paise
-> Razorpay Checkout opens
-> User completes payment
-> Backend verifies Razorpay Checkout signature
-> Backend creates confirmed registration
-> Backend sets payment_status = success
-> Backend sets member_status = paid_not_joined
-> Backend generates secure registration token
-> Backend sends paid_user_created event to n8n
-> User is redirected immediately to Thank You Page
-> Thank You Page button points to n8n tracking webhook
-> User clicks WhatsApp community button
-> n8n marks member_status = group_link_clicked
-> n8n redirects user to the real WhatsApp community invite URL
-> n8n handles Google Sheets, email, WhatsApp onboarding, reminders, and admin alerts
```

## Important Rules

- Do not require a lead form before checkout.
- Create confirmed registration only after verified payment.
- Do not treat frontend redirect alone as payment proof.
- Use Option B for the WhatsApp community button: Thank You Page button -> n8n click-tracking webhook -> real WhatsApp community invite link.
- Do not wait for n8n before showing the Thank You page.
- Do not wait for Google Sheets, email, or WhatsApp automation before showing the WhatsApp community action.
- Clicked WhatsApp link does not mean the user joined the group.
- n8n owns the WhatsApp click tracking webhook and redirect.
- Mark `active_member` only from a supported group-join webhook or later admin confirmation.

## Amount

- `INR 51`
- `5100` paise
- `INR`

## Provided Razorpay Payment Window

- Hosted payment window URL: `https://rzp.io/rzp/xBIZzJHv`
- This URL is recorded for the payment phase.
- Final production verification still needs backend-side Razorpay confirmation before creating a confirmed registration.

## Required Payment Routes

- `POST /api/checkout/create-order`
- `POST /api/payments/razorpay/verify`
- `POST /api/payments/razorpay/webhook`

## Post-Payment Routes

- `GET /api/registrations/[registrationToken]`

The Thank You page WhatsApp button should point to the n8n tracking webhook URL, not a backend app redirect route.

The configurable button URL is:

```text
N8N_WHATSAPP_CLICK_TRACKING_URL=
```

Example button target:

```text
https://n8n.yourdomain.com/webhook/join-whatsapp?registration_id=abc123
```

Final ownership rule:

- Backend = payment verification only.
- n8n = post-payment automation brain.
- Thank You button = n8n tracking first, WhatsApp redirect second.

The n8n tracking webhook should receive this click payload, update the Google Sheet, mark `member_status = group_link_clicked`, and redirect to the real WhatsApp community invite link:

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

## Implementation Timing

Do not disrupt the current micro-task sequence.

Implement this payment-first Razorpay Standard Checkout flow only when the project reaches the dedicated Razorpay/payment implementation step.
