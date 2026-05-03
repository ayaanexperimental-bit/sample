# Cloudflare Permanent Migration

Status: prepared without replacing the current Next.js build.

## Final Target

```text
GoDaddy domain
-> Cloudflare DNS
-> Cloudflare Workers with OpenNext
-> Razorpay
-> n8n Cloud
-> Google Sheets
```

## Why This Target

Cloudflare Workers with OpenNext is the correct permanent target for this project because the current app is full-stack Next.js:

- Landing pages
- Next.js route handlers
- Razorpay webhook endpoint
- Success page with n8n tracking URL support

Plain Cloudflare Pages static hosting is not enough unless the backend is split into separate Workers.

## Current Compatibility Status

Normal Next.js build:

```text
PASS
```

Cloudflare OpenNext local build on Windows:

```text
Blocked by Windows symlink permissions during OpenNext bundle generation.
```

This is an environment limitation, not a source-code failure. Cloudflare/OpenNext should be built on Linux, WSL, or Cloudflare's build environment.

## Added Project Files

```text
open-next.config.ts
wrangler.jsonc
```

Added scripts:

```text
pnpm build:cloudflare
pnpm preview:cloudflare
pnpm deploy:cloudflare
pnpm cf-typegen
```

## Cloudflare Build Settings

Framework:

```text
Next.js / Workers with OpenNext
```

Install command:

```text
pnpm install
```

Build command:

```text
pnpm build:cloudflare
```

Deploy command if using Wrangler:

```text
pnpm deploy:cloudflare
```

Worker entry:

```text
.open-next/worker.js
```

Assets:

```text
.open-next/assets
```

Compatibility:

```text
compatibility_date = 2026-05-02
compatibility_flags = ["nodejs_compat"]
```

`nodejs_compat` is required because Razorpay webhook verification uses `node:crypto` and `Buffer`.

## Required Cloudflare Environment Variables

Set these as Worker variables/secrets:

```text
NEXT_PUBLIC_SITE_URL=https://freedomfromdiabetes.in
NEXT_PUBLIC_PAYMENT_ENABLED=true

RAZORPAY_MODE=live
RAZORPAY_WEBHOOK_SECRET=<secret>
RAZORPAY_HOSTED_CHECKOUT_URL=https://rzp.io/rzp/xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG=xBIZzJHv
RAZORPAY_ACTIVE_PAYMENT_LINK_ID=pl_SKURMJD4JJjdxO

WORKSHOP_AMOUNT_PAISE=5100
WORKSHOP_CURRENCY=INR

WHATSAPP_COMMUNITY_INVITE_URL=https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4

N8N_WEBHOOK_URL=https://ayaantester.app.n8n.cloud/webhook/whm101-paid-user-created
N8N_WHATSAPP_CLICK_TRACKING_URL=https://ayaantester.app.n8n.cloud/webhook/whm101-whatsapp-clicked
```

Optional:

```text
N8N_WEBHOOK_SECRET=
SENTRY_DSN=
```

## DNS Migration

1. Add `freedomfromdiabetes.in` to Cloudflare.
2. Cloudflare will give two nameservers.
3. In GoDaddy, replace GoDaddy nameservers with Cloudflare nameservers.
4. In Cloudflare DNS, point:

```text
freedomfromdiabetes.in -> Cloudflare Worker route
www.freedomfromdiabetes.in -> redirect or Worker route
```

Do not change Razorpay URLs until Cloudflare route is live.

## Razorpay Webhook

Final webhook URL remains:

```text
https://freedomfromdiabetes.in/api/payments/razorpay/webhook
```

Events:

```text
payment.captured
order.paid
payment_link.paid
```

## Validation Checklist

Before DNS switch:

- Deploy Worker to a temporary `workers.dev` domain.
- Test `/`.
- Test `/success`.
- Test `POST /api/checkout/session`.
- Confirm unsigned webhook returns `400`.
- Confirm paid-user diagnostic to n8n still writes clean Sheet row.

After DNS switch:

- `https://freedomfromdiabetes.in` loads.
- Pay button opens Razorpay page.
- Razorpay success redirects to `/success`.
- Razorpay webhook reaches app.
- n8n receives `paid_user_created`.
- Google Sheet row appears with AM/PM timestamp.
- WhatsApp button uses n8n tracking URL if configured.

## Rollback

Keep the previous deployment platform active until Cloudflare passes a real payment test.

If Cloudflare has issues:

1. Repoint DNS to the temporary host.
2. Keep Razorpay webhook on the domain URL if the domain points to the working host.
3. Do not delete Cloudflare config; fix and retry from a branch.

## Important Non-Compromise Rule

The current Next.js build must continue passing while Cloudflare is prepared.

Do not remove:

- Next.js scripts
- API route handlers
- Razorpay webhook route
- n8n URLs
- Google Sheet workflow files

Cloudflare support is additive until fully verified.
