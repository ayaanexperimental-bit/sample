/// <reference types="@cloudflare/workers-types" />

type Env = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  WHM101_DB: D1Database;
  RAZORPAY_WEBHOOK_SECRET: string;
  RAZORPAY_HOSTED_CHECKOUT_URL?: string;
  RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG?: string;
  RAZORPAY_ACTIVE_PAYMENT_LINK_ID?: string;
  RAZORPAY_ACTIVE_PAYMENT_PAGE_ID?: string;
  RAZORPAY_ACTIVE_PAYMENT_MARKERS?: string;
  WORKSHOP_ALLOWED_AMOUNTS_PAISE?: string;
  WORKSHOP_AMOUNT_PAISE?: string;
  WORKSHOP_CURRENCY?: string;
  WHATSAPP_COMMUNITY_INVITE_URL?: string;
  N8N_WEBHOOK_URL?: string;
  FAILURE_LOG_WEBHOOK_URL?: string;
  FAILURE_LOG_WEBHOOK_SECRET?: string;
};

type PaidUserPayload = {
  event_type: "paid_user_created";
  registration_id: string;
  registration_token: string;
  full_name: string;
  phone_number: string;
  email: string;
  program_slug: string;
  workshop_slot: string;
  amount: number;
  currency: string;
  payment_status: "success";
  member_status: "paid_not_joined";
  razorpay_order_id: string;
  razorpay_payment_id: string;
  whatsapp_group_link: string;
  thank_you_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  created_at: string;
  lead_timestamp: string;
  automation_event_id?: string;
  automation_delivery_status?: "first_attempt" | "recovered_after_failure";
  automation_bot_status?: "online" | "offline";
  automation_retry_count?: number;
  automation_last_error?: string;
  automation_recovered_at?: string;
};

type AutomationDispatchResult = {
  status: "sent" | "failed" | "skipped";
  statusCode?: number;
  reason?: string;
  error?: string;
};

type AutomationEventRow = {
  id: string;
  registration_id: string;
  event_type: string;
  payload_json: string;
  status: "pending" | "sent" | "failed" | "dead";
  retry_count: number;
  last_error: string | null;
};

type FailureLogPayload = {
  action: "upsert_failure" | "mark_resolved";
  secret: string;
  timestamp: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  registration_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  bot_status: "Offline" | "Online";
  failure_status: "Active" | "Resolved";
  retry_count: number;
  last_error: string;
  recovered_at: string;
  manual_followup: string;
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
const MAX_AUTOMATION_RETRIES = 20;
const RETRY_BATCH_SIZE = 25;
const RETENTION_DAYS = 7;
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
      return json({ ok: true, runtime: "cloudflare-worker", durable_capture: Boolean(env.WHM101_DB) });
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
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    await retryPendingAutomationEvents(env);
    await cleanupSyncedOldData(env);
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

  if (!isAcceptedPaymentSource(webhook, env)) {
    return json({
      ok: true,
      event: webhook.event ?? "unknown",
      handled: false,
      ignored_reason: "Payment source is outside the active WHM101 automation allowlist.",
      accepted_payment_source: getAcceptedPaymentSourceIdentifiers(env)
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

  await upsertRegistration(env.WHM101_DB, paidUserPayload);
  const automationEvent = await upsertAutomationEvent(env.WHM101_DB, paidUserPayload);
  let automation: AutomationDispatchResult = {
    status: "skipped",
    reason: "Automation event was already sent."
  };

  if (automationEvent.status !== "sent") {
    automation = await dispatchAutomationEvent(env.WHM101_DB, automationEvent, env);
  }

  return json({
    ok: true,
    event: webhook.event,
    handled: true,
    registration_id: paidUserPayload.registration_id,
    automation_event_id: automationEvent.id,
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

function buildPaidUserPayload(webhook: RazorpayWebhookPayload, env: Env, siteOrigin: string): PaidUserPayload | null {
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

async function upsertRegistration(db: D1Database, payload: PaidUserPayload) {
  await db.prepare(`
    insert into registrations (
      id,
      registration_token,
      full_name,
      phone_number,
      email,
      program_slug,
      workshop_slot,
      amount,
      currency,
      payment_status,
      member_status,
      razorpay_order_id,
      razorpay_payment_id,
      whatsapp_group_link,
      thank_you_url,
      payload_json,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    on conflict(razorpay_payment_id) do update set
      registration_token = excluded.registration_token,
      full_name = excluded.full_name,
      phone_number = excluded.phone_number,
      email = excluded.email,
      program_slug = excluded.program_slug,
      workshop_slot = excluded.workshop_slot,
      amount = excluded.amount,
      currency = excluded.currency,
      payment_status = excluded.payment_status,
      member_status = excluded.member_status,
      razorpay_order_id = excluded.razorpay_order_id,
      whatsapp_group_link = excluded.whatsapp_group_link,
      thank_you_url = excluded.thank_you_url,
      payload_json = excluded.payload_json,
      updated_at = datetime('now')
  `).bind(
    payload.registration_id,
    payload.registration_token,
    payload.full_name,
    payload.phone_number,
    payload.email,
    payload.program_slug,
    payload.workshop_slot,
    payload.amount,
    payload.currency,
    payload.payment_status,
    payload.member_status,
    payload.razorpay_order_id,
    payload.razorpay_payment_id,
    payload.whatsapp_group_link,
    payload.thank_you_url,
    JSON.stringify(payload),
    payload.created_at
  ).run();
}

async function upsertAutomationEvent(db: D1Database, payload: PaidUserPayload) {
  const eventId = `${payload.registration_id}:paid_user_created`;

  await db.prepare(`
    insert into automation_events (
      id,
      registration_id,
      event_type,
      payload_json,
      status,
      retry_count,
      created_at,
      updated_at
    ) values (?, ?, 'paid_user_created', ?, 'pending', 0, datetime('now'), datetime('now'))
    on conflict(registration_id, event_type) do update set
      payload_json = case
        when automation_events.status = 'sent' then automation_events.payload_json
        else excluded.payload_json
      end,
      updated_at = case
        when automation_events.status = 'sent' then automation_events.updated_at
        else datetime('now')
      end
  `).bind(eventId, payload.registration_id, JSON.stringify(payload)).run();

  return getAutomationEvent(db, eventId);
}

async function getAutomationEvent(db: D1Database, eventId: string) {
  const event = await db.prepare(`
    select id, registration_id, event_type, payload_json, status, retry_count, last_error
    from automation_events
    where id = ?
  `).bind(eventId).first<AutomationEventRow>();

  if (!event) {
    throw new Error(`Automation event not found: ${eventId}`);
  }

  return event;
}

async function dispatchAutomationEvent(db: D1Database, event: AutomationEventRow, env: Env) {
  const payload = buildAutomationDispatchPayload(event);
  const result = await dispatchToN8n(payload, env);

  if (result.status === "sent") {
    await db.prepare(`
      update automation_events
      set status = 'sent',
          last_error = null,
          sent_at = datetime('now'),
          updated_at = datetime('now')
      where id = ?
    `).bind(event.id).run();
    await syncFailureLog(env, event, result, "mark_resolved");
    return result;
  }

  const retryCount = event.retry_count + 1;
  const shouldDeadLetter = retryCount >= MAX_AUTOMATION_RETRIES;
  const lastError =
    result.error ||
    result.reason ||
    (result.statusCode ? `n8n returned HTTP ${result.statusCode}` : "n8n dispatch failed");

  await db.prepare(`
    update automation_events
    set status = ?,
        retry_count = ?,
        last_error = ?,
        dead_at = case when ? then datetime('now') else dead_at end,
        updated_at = datetime('now')
    where id = ?
  `).bind(
    shouldDeadLetter ? "dead" : "failed",
    retryCount,
    lastError,
    shouldDeadLetter ? 1 : 0,
    event.id
  ).run();

  await syncFailureLog(env, event, { ...result, retry_count: retryCount, error: lastError }, "upsert_failure");

  return { ...result, retry_count: retryCount, dead: shouldDeadLetter };
}

function buildAutomationDispatchPayload(event: AutomationEventRow): PaidUserPayload {
  const payload = JSON.parse(event.payload_json) as PaidUserPayload;
  const recoveredAfterFailure = event.status === "failed" || event.retry_count > 0;

  return {
    ...payload,
    automation_event_id: event.id,
    automation_delivery_status: recoveredAfterFailure ? "recovered_after_failure" : "first_attempt",
    automation_bot_status: recoveredAfterFailure ? "offline" : "online",
    automation_retry_count: event.retry_count,
    automation_last_error: event.last_error || "",
    automation_recovered_at: recoveredAfterFailure ? new Date().toISOString() : ""
  };
}

async function retryPendingAutomationEvents(env: Env) {
  const events = await env.WHM101_DB.prepare(`
    select id, registration_id, event_type, payload_json, status, retry_count, last_error
    from automation_events
    where status in ('pending', 'failed')
      and retry_count < ?
    order by updated_at asc
    limit ?
  `).bind(MAX_AUTOMATION_RETRIES, RETRY_BATCH_SIZE).all<AutomationEventRow>();

  for (const event of events.results || []) {
    await dispatchAutomationEvent(env.WHM101_DB, event, env);
  }
}

async function cleanupSyncedOldData(env: Env) {
  await env.WHM101_DB.prepare(`
    delete from automation_events
    where status = 'sent'
      and datetime(coalesce(sent_at, updated_at)) < datetime('now', ?)
  `).bind(`-${RETENTION_DAYS} days`).run();

  await env.WHM101_DB.prepare(`
    delete from registrations
    where datetime(created_at) < datetime('now', ?)
      and not exists (
        select 1
        from automation_events
        where automation_events.registration_id = registrations.id
          and automation_events.status != 'sent'
      )
  `).bind(`-${RETENTION_DAYS} days`).run();
}

async function dispatchToN8n(payload: unknown, env: Env): Promise<AutomationDispatchResult> {
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

async function syncFailureLog(
  env: Env,
  event: AutomationEventRow,
  result: AutomationDispatchResult & { retry_count?: number },
  action: FailureLogPayload["action"]
) {
  if (!env.FAILURE_LOG_WEBHOOK_URL || !env.FAILURE_LOG_WEBHOOK_SECRET) {
    return;
  }

  const payload = JSON.parse(event.payload_json) as PaidUserPayload;
  const activeFailure = action === "upsert_failure";
  const failurePayload: FailureLogPayload = {
    action,
    secret: env.FAILURE_LOG_WEBHOOK_SECRET,
    timestamp: payload.lead_timestamp || formatLeadTimestamp(payload.created_at),
    razorpay_payment_id: payload.razorpay_payment_id,
    razorpay_order_id: payload.razorpay_order_id,
    registration_id: payload.registration_id,
    full_name: payload.full_name,
    email: payload.email,
    phone_number: payload.phone_number.replace(/^\+/, ""),
    bot_status: activeFailure ? "Offline" : "Online",
    failure_status: activeFailure ? "Active" : "Resolved",
    retry_count: result.retry_count ?? event.retry_count,
    last_error: activeFailure
      ? result.error || result.reason || (result.statusCode ? `n8n returned HTTP ${result.statusCode}` : "n8n dispatch failed")
      : "",
    recovered_at: activeFailure ? "" : new Date().toISOString(),
    manual_followup: activeFailure ? "Manual follow-up required until this row is resolved." : "Resolved by retry."
  };

  try {
    await fetch(env.FAILURE_LOG_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(failurePayload)
    });
  } catch {
    // D1 remains the source of truth. Failure-log sync must never break payment capture or retries.
  }
}

function isAcceptedPaymentSource(webhook: RazorpayWebhookPayload, env: Env) {
  const acceptedIdentifiers = getAcceptedPaymentSourceIdentifiers(env);

  if (acceptedIdentifiers.length === 0) {
    return false;
  }

  const webhookIdentifiers: string[] = [];
  collectStringValues(webhook.payload?.payment_link?.entity, webhookIdentifiers);
  collectStringValues(webhook.payload?.payment?.entity?.notes, webhookIdentifiers);
  collectStringValues(webhook.payload?.order?.entity?.notes, webhookIdentifiers);
  collectKeyValueIdentifiers(webhook.payload?.payment?.entity?.notes, webhookIdentifiers);
  collectKeyValueIdentifiers(webhook.payload?.order?.entity?.notes, webhookIdentifiers);
  collectKeyValueIdentifiers(webhook.payload?.payment_link?.entity?.notes, webhookIdentifiers);

  const haystack = webhookIdentifiers.map((identifier) => identifier.toLowerCase());
  return acceptedIdentifiers.some((acceptedIdentifier) =>
    haystack.some((identifier) => identifier.includes(acceptedIdentifier))
  );
}

function getAcceptedPaymentSourceIdentifiers(env: Env) {
  return [
    env.RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG,
    env.RAZORPAY_ACTIVE_PAYMENT_LINK_ID,
    env.RAZORPAY_ACTIVE_PAYMENT_PAGE_ID,
    env.RAZORPAY_ACTIVE_PAYMENT_MARKERS
  ]
    .flatMap((value) => (value || "").split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function collectKeyValueIdentifiers(value: unknown, output: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [key, item] of Object.entries(value)) {
    output.push(key);

    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      output.push(`${key}:${String(item)}`);
    }
  }
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
