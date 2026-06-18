# Shop Razorpay Webhook Setup

Use this setup for the public Shop Website Builder payment page.

## Payment Page Callback

In the Razorpay Payment Page settings, enable:

- Action after successful payment: `Redirect to your website`
- Redirect URL: `https://ywcoach.com/shop/success`

This is only the customer return page. It does not verify payment by itself.

## Order Identifier Field

Add a Payment Page input/custom field for the Shop order id:

- Label: `shop_order_id`
- Type: single-line text
- Required: optional, if Razorpay gives the choice

The app sends the order id in three URL parameters:

- `shop_order_id`
- `order_id`
- `reference_id`

If a buyer edits or clears the visible field, the server does not blindly trust it. The webhook first verifies Razorpay's signature, then publishes only when the order id is valid and the paid contact email or phone matches the pending Shop order. If the order id is missing, the webhook can recover only when the signed payload uniquely matches one recent pending Shop order by payer email or phone.

This protects against accidental edits in the visible `shop_order_id` field:

- Wrong but valid-looking order id + different payer email/phone: rejected and logged for admin review.
- Blank or missing order id + unique matching payer email/phone: recovered and published.
- Ambiguous contact match: rejected safely.

## Webhook

Create a Razorpay webhook:

- URL: `https://ywcoach.com/api/shop/razorpay-webhook`
- Method: `POST`
- Secret: same value as Cloudflare Pages `SHOP_RAZORPAY_WEBHOOK_SECRET`

Enable these events when available:

- `payment.captured`
- `order.paid`
- `payment_link.paid`
- `payment_page.paid`

## Required Production Test

After saving the webhook, make one real/test successful payment through:

`https://ywcoach.com/shop`

Expected result:

1. Razorpay redirects the buyer to `/shop/success`.
2. The signed webhook verifies payment server-side.
3. The Shop order changes from `pending_payment` to `published`.
4. The success page shows the generated public coach website link.

## If `/shop/success` Still Shows Pending

That means the customer callback worked, but the signed webhook has not verified the payment yet.

Do not make another payment first. The success page now attempts automatic same-browser recovery for this exact case. Keep the page open; it will call `/api/shop/reconcile-payment` and publish when a signed Razorpay payment is found for that checkout window.

Manual fallback is still available under `Manual payment check`. Use it only from the same browser/device that created the Shop order:

1. Open `https://ywcoach.com/shop/success`.
2. Enter the Razorpay payment id, for example `pay_...`.
3. Enter the email used on the Razorpay payment page.
4. Click `Verify Payment`.

The app verifies the payment only if all of these are true:

- The browser still has the private Shop order access key.
- The payment id was already received in a signed Razorpay webhook.
- The webhook payer email matches the email entered in the recovery form.
- The payment id is not already attached to another Shop order.

If the browser access key is missing, do not retry payment. Use admin-side recovery only after confirming which Razorpay payment id belongs to which Shop order.

Check Razorpay:

1. Open Razorpay Dashboard in the same mode where the payment happened.
2. Go to `Transactions -> Payments` and confirm the payment status is `Captured`.
3. Go to `Accounts & Settings -> Webhooks`.
4. Open the webhook for `https://ywcoach.com/api/shop/razorpay-webhook`.
5. Confirm status is `Enabled`.
6. Confirm the secret exactly matches Cloudflare Pages `SHOP_RAZORPAY_WEBHOOK_SECRET`.
7. Confirm these events are selected when available:
   - `payment.captured`
   - `order.paid`
   - `payment_link.paid`
   - `payment_page.paid`
8. Open the webhook delivery/history for the payment and retry/resend the failed delivery if Razorpay shows one.
9. If the delivery succeeds but the Shop still stays pending, compare the payer email/phone in Razorpay with the email/phone entered in the Shop builder. They must match unless the webhook payload includes the exact Shop order id.

Current recovered production orders:

- `shop-order-078d4ae4-8f0c-44d9-95f9-be765f8f4178` -> `/coach/a-3`, recovered from `pay_T0jRpdkPxaNeSH`
- `shop-order-d2fb73c0-da9d-4b79-a601-eed956f3b1eb` -> `/coach/a-2`, recovered from `pay_T0jOCf25r3pejO`

Duplicate/unclaimed signed payments to inspect in Razorpay for refund/manual review:

- `pay_T0j5uemxME6rOE`, payer `dulumcharan123@gmail.com`
- `pay_T0jJOEkYIHQDuH`, payer `satrughnab04@gmail.com`

App-side diagnostics:

- Invalid signed-shape Shop webhook requests now log to `shop_failures` with stage `webhook_signature`.
- Signed webhooks that cannot be matched to a Shop order now log to `shop_failures` with stage `webhook_order_match`.
- Future checkouts are blocked before payment unless the Shop builder has a valid email or phone/WhatsApp number, so webhook contact matching can recover safely.
- Missing-order-id signed webhooks now attempt unique payer-contact recovery. If no unique pending order matches, the endpoint logs the payment to `shop_failures` for manual review and returns a successful acknowledgement to Razorpay so one unmatched payment cannot disable the whole webhook.
- Same-browser automatic recovery is available at `/shop/success` through `/api/shop/reconcile-payment`; wrong/missing access keys are rejected before any publish action.
- Same-browser manual recovery remains available through `/api/shop/claim-payment` when support has the exact Razorpay payment id and payer email.
