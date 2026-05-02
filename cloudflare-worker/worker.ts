type Env = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  RAZORPAY_WEBHOOK_SECRET: string;
  RAZORPAY_HOSTED_CHECKOUT_URL?: string;
  RAZORPAY_IGNORED_PAYMENT_PAGE_SLUG?: string;
  WORKSHOP_ALLOWED_AMOUNTS_PAISE?: string;
  WORKSHOP_AMOUNT_PAISE?: string;
  WORKSHOP_CURRENCY?: string;
  WHATSAPP_COMMUNITY_INVITE_URL?: string;
  N8N_WEBHOOK_URL?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string | null;
        amount?: number;
        currency?: string;
        email?: string | null;
        contact?: string | null;
        name?: string | null;
        created_at?: number;
        notes?: Record<string, unknown> | null;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount_paid?: number;
        amount?: number;
        currency?: string;
        notes?: Record<string, unknown> | null;
      };
    };
    payment_link?: {
      entity?: {
        id?: string;
        short_url?: string;
        shortUrl?: string;
        amount?: number;
        amount_paid?: number;
        currency?: string;
        customer?: {
          name?: string | null;
          email?: string | null;
          contact?: string | null;
        } | null;
        notes?: Record<string, unknown> | null;
      };
    };
  };
};

const DEFAULT_CHECKOUT_URL = "https://rzp.io/rzp/xBIZzJHv";
const DEFAULT_WHATSAPP_URL = "https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4";
const DEFAULT_N8N_WEBHOOK_URL = "https://ayaantester.app.n8n.cloud/webhook/whm101-paid-user-created";
const PAID_EVENTS = new Set(["payment.captured", "order.paid", "payment_link.paid"]);
const MAX_WEBHOOK_BODY_BYTES = 100_000;
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://ayaantester.app.n8n.cloud",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://rzp.io https://pages.razorpay.com https://api.razorpay.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return withSecurityHeaders(withCors(new Response(null, { status: 204 })));
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, runtime: "cloudflare-worker" });
    }

    if (url.pathname === "/api/checkout/session" && request.method === "POST") {
      return json({
        ok: true,
        checkoutUrl: env.RAZORPAY_HOSTED_CHECKOUT_URL || DEFAULT_CHECKOUT_URL,
        checkout: {
          amount: getAmount(env),
          currency: getCurrency(env),
          provider: "razorpay",
          mode: "hosted"
        }
      });
    }

    if (url.pathname === "/api/payments/razorpay/webhook" && request.method === "POST") {
      return handleRazorpayWebhook(request, env, url);
    }

    if (env.ASSETS) {
      return withSecurityHeaders(await env.ASSETS.fetch(request), url);
    }

    return json({ ok: false, error: "Not found." }, 404);
  }
};

async function handleRazorpayWebhook(request: Request, env: Env, url: URL) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    return json({ ok: false, error: "Razorpay webhook secret is not configured." }, 501);
  }

  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);

  if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return json({ ok: false, error: "Razorpay webhook body is too large." }, 413);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!(await verifyRazorpaySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET))) {
    return json({ ok: false, error: "Razorpay webhook signature verification failed." }, 400);
  }

  let webhook: RazorpayWebhookPayload;

  try {
    webhook = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return json({ ok: false, error: "Invalid Razorpay webhook JSON." }, 400);
  }

  if (!PAID_EVENTS.has(webhook.event ?? "")) {
    return json({ ok: true, event: webhook.event ?? "unknown", handled: false });
  }

  if (isIgnoredPaymentSource(webhook, env)) {
    return json({
      ok: true,
      event: webhook.event ?? "unknown",
      handled: false,
      ignored_reason: "Payment came from an ignored Razorpay payment page."
    });
  }

  const paidUserPayload = buildPaidUserPayload(webhook, env, url.origin);

  if (!paidUserPayload) {
    const paymentDetails = getPaymentDetails(webhook);

    return json({
      ok: false,
      event: webhook.event ?? "unknown",
      error: "Payment payload is missing accepted paid payment details.",
      received: paymentDetails,
      accepted_amounts: [...getAllowedAmounts(env)],
      accepted_currency: getCurrency(env)
    }, 422);
  }

  const automation = await dispatchToN8n(paidUserPayload, env);

  return json({
    ok: true,
    event: webhook.event,
    handled: true,
    registration_id: paidUserPayload.registration_id,
    automation
  });
}

async function verifyRazorpaySignature(rawBody: string, signature: string, secret: string) {
  if (!signature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(digest), signature);
}

function buildPaidUserPayload(webhook: RazorpayWebhookPayload, env: Env, siteOrigin: string) {
  const payment = webhook.payload?.payment?.entity;
  const order = webhook.payload?.order?.entity;
  const paymentLink = webhook.payload?.payment_link?.entity;
  const amount = payment?.amount ?? order?.amount_paid ?? order?.amount ?? paymentLink?.amount_paid ?? paymentLink?.amount;
  const currency = payment?.currency ?? order?.currency ?? paymentLink?.currency;
  const transactionId = payment?.id || paymentLink?.id || order?.id;

  if (!transactionId || typeof amount !== "number" || !getAllowedAmounts(env).has(amount) || currency !== getCurrency(env)) {
    return null;
  }

  const notes = {
    ...(order?.notes ?? {}),
    ...(paymentLink?.notes ?? {}),
    ...(payment?.notes ?? {})
  };
  const createdAt = payment?.created_at
    ? new Date(payment.created_at * 1000).toISOString()
    : new Date().toISOString();
  const registrationToken = btoa(transactionId).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return {
    event_type: "paid_user_created",
    registration_id: `rzp_${transactionId}`,
    registration_token: registrationToken,
    full_name:
      asString(notes.full_name) ||
      asString(notes.fullName) ||
      asString(notes.name) ||
      asString(payment?.name) ||
      asString(paymentLink?.customer?.name) ||
      "Workshop Participant",
    phone_number:
      normalizePhone(asString(notes.phone_number) || asString(notes.phoneNumber) || asString(notes.whatsapp_no)) ||
      normalizePhone(payment?.contact ?? paymentLink?.customer?.contact ?? ""),
    email:
      asString(notes.email) || asString(payment?.email) || asString(paymentLink?.customer?.email),
    program_slug: asString(notes.program_slug) || "women-health-masterclass-101",
    workshop_slot: asString(notes.workshop_slot) || "next-saturday-7pm-ist",
    amount,
    currency: getCurrency(env),
    payment_status: "success",
    member_status: "paid_not_joined",
    razorpay_order_id: payment?.order_id || order?.id || paymentLink?.id || transactionId,
    razorpay_payment_id: payment?.id || transactionId,
    whatsapp_group_link: env.WHATSAPP_COMMUNITY_INVITE_URL || DEFAULT_WHATSAPP_URL,
    thank_you_url: `${siteOrigin}/success?registration_token=${registrationToken}`,
    utm_source: asString(notes.utm_source),
    utm_medium: asString(notes.utm_medium),
    utm_campaign: asString(notes.utm_campaign),
    utm_content: asString(notes.utm_content),
    utm_term: asString(notes.utm_term),
    created_at: createdAt,
    lead_timestamp: formatLeadTimestamp(createdAt)
  };
}

function getPaymentDetails(webhook: RazorpayWebhookPayload) {
  const payment = webhook.payload?.payment?.entity;
  const order = webhook.payload?.order?.entity;
  const paymentLink = webhook.payload?.payment_link?.entity;

  return {
    payment_id: payment?.id ?? null,
    order_id: order?.id ?? payment?.order_id ?? null,
    payment_link_id: paymentLink?.id ?? null,
    payment_amount: payment?.amount ?? null,
    order_amount_paid: order?.amount_paid ?? null,
    order_amount: order?.amount ?? null,
    payment_link_amount_paid: paymentLink?.amount_paid ?? null,
    payment_link_amount: paymentLink?.amount ?? null,
    currency: payment?.currency ?? order?.currency ?? paymentLink?.currency ?? null
  };
}

async function dispatchToN8n(payload: unknown, env: Env) {
  const webhookUrl = env.N8N_WEBHOOK_URL || DEFAULT_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return { status: "skipped", reason: "N8N_WEBHOOK_URL is not configured." };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    return { status: response.ok ? "sent" : "failed", statusCode: response.status };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "n8n dispatch failed."
    };
  }
}

function isIgnoredPaymentSource(webhook: RazorpayWebhookPayload, env: Env) {
  const ignoredSlug = (env.RAZORPAY_IGNORED_PAYMENT_PAGE_SLUG || "gy1111").toLowerCase();
  const identifiers: string[] = [];

  collectStringValues(webhook.payload?.payment_link?.entity, identifiers);
  collectStringValues(webhook.payload?.payment?.entity?.notes, identifiers);
  collectStringValues(webhook.payload?.order?.entity?.notes, identifiers);

  return identifiers.some((identifier) => identifier.toLowerCase().includes(ignoredSlug));
}

function collectStringValues(value: unknown, output: string[]) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    output.push(value);
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, output);
    }
    return;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStringValues(item, output);
    }
  }
}

function formatLeadTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })
    .format(new Date(isoTimestamp))
    .replace(",", "")
    .toUpperCase();
}

function getAmount(env: Env) {
  return Number.parseInt(env.WORKSHOP_AMOUNT_PAISE || "5100", 10);
}

function getAllowedAmounts(env: Env) {
  const configuredAmounts = env.WORKSHOP_ALLOWED_AMOUNTS_PAISE || `${getAmount(env)},100`;
  const amounts = configuredAmounts
    .split(",")
    .map((amount) => Number.parseInt(amount.trim(), 10))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  return new Set(amounts.length > 0 ? amounts : [getAmount(env)]);
}

function getCurrency(env: Env) {
  return env.WORKSHOP_CURRENCY === "INR" ? "INR" : "INR";
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

function json(body: unknown, status = 200) {
  return withSecurityHeaders(withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  ));
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "https://freedomfromdiabetes.in");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,x-razorpay-signature");
  headers.append("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function withSecurityHeaders(response: Response, url?: URL) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("Content-Type") || "";

  headers.set("Referrer-Policy", SECURITY_HEADERS["Referrer-Policy"]);
  headers.set("Strict-Transport-Security", SECURITY_HEADERS["Strict-Transport-Security"]);
  headers.set("Cross-Origin-Opener-Policy", SECURITY_HEADERS["Cross-Origin-Opener-Policy"]);
  headers.set("Cross-Origin-Resource-Policy", SECURITY_HEADERS["Cross-Origin-Resource-Policy"]);
  headers.set("X-Permitted-Cross-Domain-Policies", SECURITY_HEADERS["X-Permitted-Cross-Domain-Policies"]);
  headers.set("X-Content-Type-Options", SECURITY_HEADERS["X-Content-Type-Options"]);
  headers.set("X-Frame-Options", SECURITY_HEADERS["X-Frame-Options"]);

  if (contentType.includes("text/html")) {
    headers.delete("Access-Control-Allow-Origin");
    headers.delete("Access-Control-Allow-Headers");
    headers.delete("Access-Control-Allow-Methods");
    headers.set("Content-Security-Policy", SECURITY_HEADERS["Content-Security-Policy"]);
    headers.set("Permissions-Policy", SECURITY_HEADERS["Permissions-Policy"]);
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  } else if (url && isImmutableAsset(url.pathname)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (contentType.includes("application/json")) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isImmutableAsset(pathname: string) {
  return pathname.startsWith("/_next/static/") || /\.(?:css|js|jpg|jpeg|png|webp|avif|svg|ico|woff2?)$/i.test(pathname);
}
