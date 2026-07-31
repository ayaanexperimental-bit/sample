# Gyana Paid Funnel Setup

## Public link

Share only:

```txt
https://ywcoach.com/go/gyana-pcos-51
```

Do not share the paid page or success page URL. Those URLs contain a browser-bound access hash
and require the matching signed browser cookie.

## Razorpay Hosted Payment Page

In the existing Razorpay Payment Page, set **Action after successful payment** to redirect to:

```txt
https://ywcoach.com/api/razorpay/success
```

No custom Razorpay checkout API is required for this browser-bound flow.

## Expected flow

1. `/go/gyana-pcos-51` creates a random access hash and a signed browser cookie.
2. The paid landing page opens only when the URL hash matches that cookie.
3. `/api/payment/start` records a short-lived attempt in the same browser, then opens Razorpay.
4. Razorpay redirects the successful payment back to `/api/razorpay/success`.
5. The callback issues a long-lived paid browser cookie and redirects to the hashed success URL.
6. The success page and private WhatsApp link require that paid cookie and matching hash.

The old seven-minute paid-access expiry is removed. Clearing browser cookies or moving to a new
browser/device removes access because the protection is intentionally browser-bound.

## Security boundary

This setup blocks direct URLs and copied links in other browsers. Because a Hosted Payment Page
redirect is not cryptographic proof of payment, it does not defend against a technical attacker
who deliberately forges the local callback sequence. Configure the existing signed Razorpay
webhook flow if verified-payment-only access is required later.
