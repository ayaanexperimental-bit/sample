# Shop Builder Implementation And Test Report

Date: 2026-06-11

Source of truth: `C:\Users\Yours Wellness\Desktop\2.md`

Old `.md` files ignored: yes. This report is only for the current source-of-truth file.

## Status

Final status for the Shop/Admin slice: Partial pass. Production deploy held.

Reason: the implemented Shop flow, public route, admin Shop surface, "Go to Shop Site" entry points, secure media upload, and embedded preview sticky behavior passed local build and browser verification. Full completion of the wider source-of-truth file still has external blockers for authenticated admin browser testing, live Razorpay production verification, and production database/secret validation.

Latest production readiness check: Cloudflare CLI authentication is available, and `wrangler pages secret list --project-name ywcoach` now shows production has `SHOP_RAZORPAY_WEBHOOK_SECRET`. Checkout remains hardened to block payment before redirect if that secret is removed. A real payment returned to `/shop/success`, and Razorpay has delivered signed Shop webhook events, but the observed events lacked a Shop order id and used payer contact `ayaanexperimental@gmail.com`, which does not match the current Ayaan3 pending order contact `ayaanraheman7@gmail.com`.

## Implemented

| Requirement group | Implemented | Tested | Result | Notes |
| --- | --- | --- | --- | --- |
| Public `/shop` route | Yes | Yes | Pass | Route renders from Next production server and Cloudflare Pages static build. |
| Shop builder 6-step guided flow | Yes | Yes | Pass | Browser verified first screen and primary controls. Earlier flow testing covered draft, inspect edit, and payment review. |
| Shop payment link | Yes | Yes | Pass | Configured as `https://rzp.io/rzp/webb` through `SHOP_PAYMENT_PAGE_URL`. |
| Production webhook secret | Yes | Yes | Pass | Production Pages secrets include `SHOP_RAZORPAY_WEBHOOK_SECRET`; checkout still blocks before payment if it is missing. |
| Secure Shop media upload | Yes | Yes | Pass | Pages-dev API accepted a valid PNG, rejected invalid upload types, wrote to local R2, and returned `/api/coach-media?key=coach-sites/...`. |
| Shop draft save/read | Yes | Yes | Pass | API smoke from Pages dev saved drafts and returned order/access key. Browser storage restoration was adjusted to avoid hydration mismatch. |
| Checkout order creation | Yes | Yes | Pass | Local Pages-dev API returned `https://rzp.io/rzp/webb?shop_order_id=...&source=ywcoach_shop`. |
| Missing webhook secret checkout guard | Yes | Yes | Pass | Local Pages-dev API without `SHOP_RAZORPAY_WEBHOOK_SECRET` returned 503 and no redirect. |
| Checkout idempotency | Yes | Yes | Pass | First-click checkout now gets a stable client idempotency key; server reuses existing idempotency-key orders. |
| Duplicate coach name before payment | Yes | Yes | Pass | Checkout now blocks already-published coach names before redirecting to payment. |
| Razorpay webhook publish path | Yes | Yes | Pass | Local signed webhook with `SHOP_RAZORPAY_WEBHOOK_SECRET=testsecret` published generated coach site `shop-e2e-20260611195134`; later local signed webhook with no order id also published by unique payer contact. |
| Public coach site from Shop purchase | Yes | Yes | Pass | Local published `/coach/shop-e2e-20260611195134` returned 200 and rendered coach content plus uploaded media URL. |
| Admin Shop section | Yes | Code-verified | Partial | Requires authenticated admin session for full browser verification. |
| Admin Shop "Go to Shop Site" button | Yes | Code-verified | Pass | Added in the Shop panel header, notice area, and settings action area. |
| Coach Analytics source sync | Yes | API/code verified | Pass | Shop-generated coach sites use `analytics.source = "shop_purchased"`. |
| Backup/Cleanup integration | Yes | Build verified | Pass | Shop data included in maintenance/backup surfaces. |
| Embedded coach preview sticky containment | Yes | Browser verified | Pass | Preview nav and bottom CTA are now contained inside Shop/Admin preview frames. |
| Shop hydration stability | Yes | Browser verified | Pass | LocalStorage draft recovery moved after hydration; final browser check had no relevant `127.0.0.1:4318` errors. |
| Global loader stability | Yes | Browser verified | Pass | Removed pre-hydration HTML mutation and disabled blocking first-paint overlay; final `/shop` mobile check had visible loader false after 850ms. |
| Public coach page sticky nav behavior | Yes | Browser verified earlier | Pass | Public pages keep page-level sticky behavior; only embedded previews opt into contained mode. |
| Public coach Aurora parity | Yes | Browser/API verified | Pass | React preview uses `auroraLayer`; Cloudflare public renderer uses `.aurora`; final public route check confirmed Aurora present. |
| Public coach inline loader stability | Yes | Browser verified | Pass | Cloudflare dynamic route inline loader is non-visual by default; 320/390/768/1440 retest showed visible loader false. |
| Sensitive order privacy | Yes | API verified earlier | Pass | Non-published order lookup requires access key; published public status remains readable. |
| Post-publish self-edit lock | Yes | API verified | Pass | Draft save after signed webhook publish returns `409 Conflict` and the support message. |
| Shop mobile responsive clipping | Yes | Browser verified | Pass | 390x844 retest after CSS fix: shell 362px, rail/workspace 362px, preview 336px, `clipElements = []`, `overflowX = 0`. |

## Bugs Found And Fixed

| Bug | Root cause | Fix | Re-test |
| --- | --- | --- | --- |
| Embedded Shop preview navbar covered the Shop builder header on mobile | Coach template mobile nav had global `position: fixed !important`, so it escaped the preview canvas | Added `stickyMode="contained"` to embedded previews and a scoped `data-sticky-scope="contained"` global override | Pass: at 390x844, preview nav computed `position: sticky`, top 1805, canvas top 1673, contained true |
| Embedded preview bottom CTA could leak or crowd parent layout | Public coach CTA used page-level fixed/sticky behavior | Contained mode also forces embedded CTA to sticky inside the preview canvas | Pass: CTA contained true in final browser check |
| React hydration mismatch on `/shop` | Initial client render read localStorage before hydration, while server rendered empty default state | Draft recovery now runs after mount and persistence waits until restoration completes | Pass: final browser check on `127.0.0.1:4318` had zero relevant warnings/errors |
| `/shop` was unavailable in Pages worker routing earlier | Middleware did not treat `/shop` and `/shop/success` as public page routes | Added both paths to public page allowlist | Pass: Pages route smoke returned 200 earlier after patch |
| Repeated Shop draft save could change slug suffix | Slug availability check did not allow current order's slug | Slug availability now preserves slug when owned by the same order | Pass: API save/checkout smoke kept stable order/slug |
| Shop builder clipped content on 390px mobile | Grid children kept desktop min-content widths inside a one-column shell, so the parent clipped the overflow instead of reflowing | Added scoped `box-sizing: border-box` and `min-width: 0` to Shop shell/grid children; wrapped preview toolbar controls on mobile | Pass: Browser retest showed no clipped elements and no horizontal overflow |
| Global loader caused hydration/flicker risk | Inline script mutated the HTML dataset and loader state before React hydrated | Removed the pre-hydration dataset mutation and made the global loader non-blocking by default | Pass: `/shop` mobile smoke showed visible loader false after 850ms and console errors 0 |
| First checkout click could create a new order on retry | Client generated idempotency only after an order id existed | Added stable localStorage idempotency key for first checkout and server lookup by idempotency key | Pass: repeated checkout reused existing order in API smoke |
| Duplicate coach name could fail after payment | Existing duplicate check ran during publish, after payment verification | Added pre-checkout duplicate coach-name guard | Pass: checkout returned 400 and no redirect for `QA Launch Coach 868176` |
| Public coach inline loader stayed visible in Cloudflare dynamic route | Inline loader used animation timing and a later reduced-motion block could keep it visible | Made the dynamic public-route inline loader non-visual by default and reduced-motion safe | Pass: 320/390/768/1440 public route retest showed no visible loader |
| Post-publish draft save returned `503` | Draft route treated all service failures as unavailable | Return `409 Conflict` for paid/published workflow locks | Pass: post-publish draft save returned 409 |
| Admin backup test was stale after Shop backup integration | Test expected only two analytics records and did not assert Shop backup rows | Updated test to expect the Shop Payment Settings backup section and new count | Pass: admin-security suite 24/24 |
| Checkout could redirect without webhook verification config | Checkout checked payment URL but not the webhook secret needed for publish verification | Added server-side missing-secret guard before redirect | Pass: missing secret returned 503/no redirect; configured test secret still checked out and published |
| Shop success page collapsed into desktop left rail | `/shop/success` reused the two-column builder shell with only one child | Added a dedicated centered single-column status shell | Pass: local and production Browser checks at 1440x900 show centered 768px shell and `overflowX = 0`; mobile 390x844 still passes |

## Files Changed For This Slice

- `app/globals.css`
- `app/shop/shop-builder.module.css`
- `app/shop/shop-builder-client.tsx`
- `components/admin/admin-coach-sites-manager.tsx`
- `components/admin/admin-dashboard-shell.tsx`
- `components/admin/admin-dashboard-shell.module.css`
- `components/coach/public-coach-site-page.tsx`
- `components/coach/public-coach-site-page.module.css`
- `functions/_middleware.ts`
- `functions/api/admin/shop.ts`
- `functions/api/shop/*`
- `lib/server/shop.ts`
- `lib/shop-builder.ts`
- `wrangler.jsonc`
- `.env.example`

## Latest Verification

Commands run:

- `pnpm typecheck` - pass
- `pnpm lint` - pass
- `pnpm build` - pass
- `pnpm build:pages` - pass
- `pnpm build:pages-functions` - pass
- `pnpm test:e2e` - pass, 8/8 with local `FUNNEL_ACCESS_SECRET`
- `pnpm test:admin-security` - pass, 24/24
- `pnpm check:links` - pass with `SITE_URL=http://127.0.0.1:8790`, local funnel/success bindings, and local private WhatsApp D1 seed
- `wrangler whoami` - pass as `ayaanexperimental@gmail.com`
- `wrangler pages secret list --project-name ywcoach` - production secret inspection passed; `SHOP_RAZORPAY_WEBHOOK_SECRET` present

Browser/API verification:

- URL: `http://127.0.0.1:8790/shop?qa=mobile-builder-after-fix`
- Viewport: 390x844
- Page title: `Premium Coach Website Builder | YWcoach`
- Horizontal overflow: 0
- Mobile clipping audit after fix: `clipElements = []`
- Shop shell/rail/workspace widths after fix: `362px / 362px / 362px`
- Preview frame width after fix: `336px`
- Relevant console errors/warnings for `127.0.0.1:8790`: 0
- Media mode interaction: Text-only changed preview media mode to `none`; Photo restored upload controls and image mode.
- E2E flow: upload PNG -> checkout -> signed webhook -> public page passed for `shop-e2e-20260611195134`.
- Checkout redirect: `https://rzp.io/rzp/webb?shop_order_id=shop-order-cd81f828-a3e9-4058-8b31-ba5fea462cc3&source=ywcoach_shop`
- Public page: `http://127.0.0.1:8790/coach/shop-e2e-20260611195134` returned 200 and included the uploaded `/api/coach-media` URL.
- Mobile public sticky check: nav fixed at top gap `16px`; bottom CTA fixed with `9px` bottom gap; footer/legal text reachable via keyboard End; `overflowX = 0`.
- Final `/shop` mobile smoke on `127.0.0.1:8790`: visible loader false after 850ms, `overflowX = 0`, relevant console errors 0.
- Final Shop live-preview smoke: coach name, niche, and location appeared in preview after editing Step 1 fields.
- Final duplicate checkout guard smoke: existing coach name returned 400 and no payment redirect.
- Final shop-published public route smoke: `/coach/qa-launch-coach-868176` returned 200, coach content true, `.aurora` true, `overflowX = 0`, nav/CTA stable at mid-scroll.
- Final public loader retest: `/coach/qa-launch-coach-868176` at 320/390/768/1440 had visible loader false, opacity 0, `overflowX = 0`, Aurora true.
- Final post-publish lock retest: signed webhook published `Lock Retest Coach`, then `/api/shop/draft` returned 409 for edit attempt.
- Final Shop Inspect UI retest on fresh Pages build: Step 4 reached, Inspect widget active, edited hero headline visible, `overflowX = 0`, framework overlay false, visible loader false, console errors 0.
- Final missing-secret checkout guard: fresh Pages worker without `SHOP_RAZORPAY_WEBHOOK_SECRET` returned 503 and no redirect.
- Final configured-secret checkout/publish: fresh Pages worker with test secret returned checkout 200, signed webhook 200, public route 200.
- Final missing-order-id webhook fallback: fresh Pages worker with test secret returned checkout 200; signed `payment.captured` webhook without `shop_order_id` returned 200/published by unique payer email/phone; public route returned 200.
- Final Shop success layout retest: local and production Browser checks at 1440x900 showed centered 768px status shell after the desktop rail-collapse fix; 390x844 mobile remained wrapped with `overflowX = 0`.

## Remaining Blockers

| Blocker | Why blocked | Needed input |
| --- | --- | --- |
| Production Razorpay webhook verification | Local signed webhook paths were tested and production now has the required Shop webhook secret. A real payment returned to `/shop/success`; signed production webhook events reached the app but lacked a Shop order id and used a non-matching payer contact. | Retry/resend the Razorpay webhook after the latest deploy; the event must include the Shop order id or match the builder email/phone |
| Production D1/R2 verification | Production D1/R2 smoke now passes, but the paid publish transition is still blocked by unmatched webhook payload data | Retry the Razorpay webhook, then re-check D1 and the public coach route |
| Live AI provider verification | Builder fallback copy works; live AI quality depends on production AI env and quota | Production AI key/env and allowed test request |
| Email confirmation path | Email sending was not configured in this run | Email provider configuration, if confirmation email is required |
