# Urgent Hosting Migration Plan

Status: emergency recovery because Netlify credits are exhausted and the site is blocked.

## Final Verdict

Use Vercel immediately.

Reason:

- The app is already a standard Next.js app.
- Vercel can import the existing GitHub repo directly.
- Current API routes should work without refactoring.
- Cloudflare Pages/Workers is still a good later option, but it requires runtime adaptation/testing for Next.js API routes.

## Source Repo

```text
https://github.com/ayaanexperimental-bit/sample
```

Branch:

```text
main
```

## Vercel Project Settings

Framework preset:

```text
Next.js
```

Build command:

```text
pnpm build
```

Install command:

```text
pnpm install
```

Output directory:

```text
.next
```

Root directory:

```text
./
```

## Required Vercel Environment Variables

Copy these from Netlify or set manually:

```text
NEXT_PUBLIC_SITE_URL=https://freedomfromdiabetes.in
NEXT_PUBLIC_PAYMENT_ENABLED=true

RAZORPAY_MODE=live
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_HOSTED_CHECKOUT_URL=https://rzp.io/rzp/xBIZzJHv
RAZORPAY_IGNORED_PAYMENT_PAGE_SLUG=gy1111

WORKSHOP_AMOUNT_PAISE=5100
WORKSHOP_CURRENCY=INR

WHATSAPP_COMMUNITY_INVITE_URL=https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4

N8N_WEBHOOK_URL=https://ayaantester.app.n8n.cloud/webhook/whm101-paid-user-created
N8N_WHATSAPP_CLICK_TRACKING_URL=https://ayaantester.app.n8n.cloud/webhook/whm101-whatsapp-clicked
```

Optional only if already used:

```text
N8N_WEBHOOK_SECRET=
SENTRY_DSN=
```

Do not expose secret values in GitHub.

## Razorpay Webhook URL Change

After Vercel deployment and domain connection, keep the same webhook URL if the domain remains:

```text
https://freedomfromdiabetes.in/api/payments/razorpay/webhook
```

If testing before DNS moves, temporarily add the Vercel preview/production URL webhook in Razorpay:

```text
https://<vercel-project-domain>/api/payments/razorpay/webhook
```

Events:

```text
payment.captured
order.paid
payment_link.paid
```

## Domain Move

Domain registrar/DNS is GoDaddy currently.

In Vercel:

1. Add `freedomfromdiabetes.in`.
2. Add `www.freedomfromdiabetes.in`.
3. Set `freedomfromdiabetes.in` as primary.
4. Let `www.freedomfromdiabetes.in` redirect to apex.

In GoDaddy DNS, remove Netlify records for:

```text
@
www
```

Then follow Vercel's shown records. Typically:

```text
Type: A
Name: @
Value: 76.76.21.21
TTL: 1 hour
```

```text
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 1 hour
```

Use the exact values Vercel shows if they differ.

## Validation Checklist

Before DNS switch:

- Vercel deployment opens on the `.vercel.app` URL.
- Landing page loads.
- Pay button opens `https://rzp.io/rzp/xBIZzJHv`.
- `/success` loads.
- `/api/checkout/session` returns the Razorpay URL.
- Unsigned Razorpay webhook test returns `400`, which is expected.

After DNS switch:

- `https://freedomfromdiabetes.in` loads.
- `https://www.freedomfromdiabetes.in` redirects correctly.
- SSL certificate is active.
- Razorpay payment redirects to success page.
- Razorpay webhook triggers n8n.
- Google Sheet receives clean row.

## Rollback

Do not delete Netlify project yet.

If Vercel has issues:

1. Point GoDaddy DNS back to Netlify records.
2. Re-enable Netlify only if credits/plan allow.
3. Keep Razorpay webhook on domain URL so it follows whichever host owns the domain.

## Later Optimization

Once the system is stable:

```text
GoDaddy domain
-> Cloudflare DNS
-> Vercel or Cloudflare Pages/Workers
-> Razorpay
-> n8n
-> Google Sheets
```

Cloudflare DNS should be considered after emergency recovery, not during the outage.
