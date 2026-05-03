# Razorpay Payment Page Change Safety

## Current Rule

The automation is intentionally strict. It only processes paid webhooks that match the active WHM101 Razorpay payment page/link.

Current accepted identifiers:

```text
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO
RAZORPAY_ACTIVE_PAYMENT_MARKERS=whatsapp_no,your_health_goal,2.0 HEAL YOUR HORMONES
```

This prevents unrelated Razorpay payments from entering the WHM101 Google Sheet/n8n flow.

## Safe Changes

These edits should normally be safe if the same Razorpay Payment Page/Payment Link remains active:

```text
Payment page title
Payment page description
Form labels
Success message
Branding/colors
Redirect URL
Customer fields
Minor copy changes
```

These changes do not usually change the Razorpay payment link ID.

## Changes That Can Stop Automation

These changes need extra care:

```text
Creating a new Razorpay Payment Page
Creating a new Razorpay Payment Link
Replacing the checkout URL with a new rzp.io link
Changing the final price to an amount not listed in WORKSHOP_ALLOWED_AMOUNTS_PAISE
Moving payments to another Razorpay account
Removing required customer fields from the Razorpay page
Changing webhooks in Razorpay dashboard
```

If the payment page/link ID changes and Cloudflare is not updated, the webhook will be safely ignored instead of polluting the sheet.

## Flexible Migration Rule

For a controlled transition, multiple accepted identifiers can be used temporarily:

```text
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv,newSlugHere
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO,newPaymentLinkIdHere
RAZORPAY_ACTIVE_PAYMENT_MARKERS=whatsapp_no,your_health_goal,newUniqueFieldOrTitle
```

After testing the new page, remove the old identifier.

## Price Change Rule

Testing currently allows:

```text
WORKSHOP_ALLOWED_AMOUNTS_PAISE=100,5100
```

Before final launch, change to:

```text
WORKSHOP_ALLOWED_AMOUNTS_PAISE=5100
```

If the workshop price changes later, add the new amount in paise first, test it, then remove the old amount.

Examples:

```text
Rs 51 = 5100
Rs 99 = 9900
Rs 199 = 19900
```

## Before Editing Razorpay

Use this checklist:

```text
1. If editing the same page, proceed.
2. If creating/replacing a page, copy the new payment page slug and payment link ID.
3. Add the new identifiers or unique page markers to Cloudflare before sending traffic.
4. Do one Rs 1 test payment if test amount is still enabled.
5. Confirm SUCCESSFUL PAYMENTS updates.
6. Confirm unrelated/old payment pages do not update the sheet.
```

## Outside-Ecosystem Payment Behavior

If the active page/link identifier does not match:

```text
Payment still succeeds in Razorpay
Webhook is ignored by WHM101 automation
D1/n8n/Google Sheet are not updated
```

This is intentional. The WHM101 automation does not know or care whether that outside payment belongs to another old or separate system. It simply does not intermix ecosystems.

## Fail-Closed Rule

If no active Razorpay page/link identifiers are configured:

```text
Webhook is ignored by WHM101 automation
No D1 registration is created
No n8n event is sent
No Google Sheet row is added
```

This prevents accidental broad acceptance of unrelated Razorpay payments.
