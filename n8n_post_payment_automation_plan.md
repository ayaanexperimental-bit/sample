# WHM101 n8n Post-Payment Automation Plan

Status: ready for n8n implementation after sender credentials are connected.

## Active Workflow

`GYANA-WHM101 - Paid User Created - Father Style`

Trigger:

```text
POST /webhook/whm101-paid-user-created
```

Current confirmed action:

```text
Append paid participant to SUCCESSFUL PAYMENTS
```

## Required Sheet Columns

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

## Existing Payload Fields

The website sends:

```json
{
  "event_type": "paid_user_created",
  "registration_id": "string",
  "registration_token": "string",
  "full_name": "string",
  "phone_number": "string",
  "email": "string",
  "program_slug": "women-health-masterclass-101",
  "workshop_slot": "next-saturday-7pm-ist",
  "amount": 5100,
  "currency": "INR",
  "payment_status": "success",
  "member_status": "paid_not_joined",
  "razorpay_order_id": "string",
  "razorpay_payment_id": "string",
  "whatsapp_group_link": "string",
  "thank_you_url": "string",
  "created_at": "ISO timestamp",
  "lead_timestamp": "dd/mm/yyyy hh:mm:ss AM/PM"
}
```

In n8n Webhook nodes, read these through:

```text
{{$json.body.field_name}}
```

## Next Nodes To Add

### 1. Confirmation Email

Add after Google Sheets append.

Recommended subject:

```text
Your Women Health Masterclass 101 registration is confirmed
```

Recommended body:

```text
Hi {{$json.body.full_name}},

Your payment has been received and your seat for Women Health Masterclass 101 is confirmed.

Next step: join the WhatsApp community for class access and reminders:
{{$json.body.whatsapp_group_link}}

If you have already joined, no further action is needed.

Regards,
Women Health Masterclass 101 Team
```

Send to:

```text
{{$json.body.email}}
```

Only send if:

```text
{{$json.body.email}}
```

### 2. WhatsApp Onboarding Message

Add after email or parallel after Google Sheets append.

Message:

```text
Hi {{$json.body.full_name}}, your Women Health Masterclass 101 registration is confirmed.

Join the WhatsApp community here:
{{$json.body.whatsapp_group_link}}

This group is where class reminders and access updates will be shared.
```

Send to:

```text
{{$json.body.phone_number}}
```

Only send if:

```text
{{$json.body.phone_number}}
```

### 3. Admin Alert For Missing Data

Add IF node:

```text
{{$json.body.phone_number === "" || $json.body.email === ""}}
```

Admin message:

```text
Manual follow-up required.

Name: {{$json.body.full_name}}
Phone: {{$json.body.phone_number || "missing"}}
Email: {{$json.body.email || "missing"}}
Payment ID: {{$json.body.razorpay_payment_id}}
```

## WhatsApp Click Tracking

Workflow:

```text
GYANA-WHM101 - WhatsApp Click Tracking
```

Trigger:

```text
GET /webhook/whm101-whatsapp-clicked
```

Required behavior:

```text
Receive click
Redirect to WhatsApp community link
```

Later enhancement:

```text
Update participant row/status when click happens
```

## Reminder Loop

Do not implement until the Sheet has reminder columns or a second tracking sheet.

Required future columns if reminder automation is needed:

```text
WhatsApp Clicked
Clicked At
Reminder Count
Last Reminder Sent At
Next Reminder At
Manual Follow-up Required
```

For now, keep the owner-facing sheet clean and do not add these columns.

## Pending From User

- Email sender decision: Gmail, SMTP, or Resend.
- Email sender credentials.
- WhatsApp sender/provider decision.
- WhatsApp sender credentials.
- Admin alert destination phone/email.
- Whether reminder tracking should go into the same sheet or a separate backend sheet.
