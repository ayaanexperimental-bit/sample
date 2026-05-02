import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidUserCreatedPayload } from "@/lib/registrations/types";

export type RazorpayWebhookPaymentEntity = {
  id?: string;
  order_id?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, unknown> | null;
  created_at?: number;
};

export type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayWebhookPaymentEntity;
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, unknown> | null;
      };
    };
    payment_link?: {
      entity?: {
        id?: string;
        short_url?: string;
        shortUrl?: string;
        reference_id?: string | null;
        payment_page_id?: string | null;
        page_id?: string | null;
        description?: string | null;
        amount?: number;
        currency?: string;
        status?: string;
        customer?: {
          name?: string | null;
          email?: string | null;
          contact?: string | null;
        } | null;
        notes?: Record<string, unknown> | null;
      };
    };
    payment_page?: {
      entity?: {
        id?: string;
        short_url?: string;
        shortUrl?: string;
        slug?: string;
        reference_id?: string | null;
        description?: string | null;
        notes?: Record<string, unknown> | null;
      };
    };
  };
};

const PAID_EVENTS = new Set(["payment.captured", "order.paid", "payment_link.paid"]);
const FAILED_EVENTS = new Set([
  "payment.failed",
  "payment_link.cancelled",
  "payment_link.partially_paid"
]);

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  webhookSecret: string
) {
  const expectedSignature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return timingSafeStringEqual(expectedSignature, receivedSignature);
}

export function getWebhookEventStatus(eventType: string | undefined) {
  if (!eventType) {
    return "ignored" as const;
  }

  if (PAID_EVENTS.has(eventType)) {
    return "paid" as const;
  }

  if (FAILED_EVENTS.has(eventType)) {
    return "failed" as const;
  }

  return "ignored" as const;
}

export function getRazorpayActiveSourceConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    slugs: splitEnvList(env.RAZORPAY_ACTIVE_PAYMENT_PAGE_SLUG || "xBIZzJHv"),
    paymentLinkIds: splitEnvList(env.RAZORPAY_ACTIVE_PAYMENT_LINK_ID),
    paymentPageIds: splitEnvList(env.RAZORPAY_ACTIVE_PAYMENT_PAGE_ID),
    ignoredSlugs: splitEnvList(env.RAZORPAY_IGNORED_PAYMENT_PAGE_SLUG || "gy1111")
  };
}

export function isActiveRazorpayPaymentSource(
  webhook: RazorpayWebhookPayload,
  config = getRazorpayActiveSourceConfig()
) {
  const acceptedIdentifiers = [
    ...config.slugs,
    ...config.paymentLinkIds,
    ...config.paymentPageIds
  ].map((value) => value.toLowerCase());
  const ignoredIdentifiers = config.ignoredSlugs.map((value) => value.toLowerCase());
  const webhookIdentifiers = collectRazorpaySourceIdentifiers(webhook).map((value) =>
    value.toLowerCase()
  );

  const matchesIgnoredSource = ignoredIdentifiers.some((ignoredIdentifier) =>
    webhookIdentifiers.some((webhookIdentifier) => webhookIdentifier.includes(ignoredIdentifier))
  );

  if (matchesIgnoredSource) {
    return false;
  }

  if (acceptedIdentifiers.length === 0 || webhookIdentifiers.length === 0) {
    return true;
  }

  return acceptedIdentifiers.some((acceptedIdentifier) =>
    webhookIdentifiers.some((webhookIdentifier) => webhookIdentifier.includes(acceptedIdentifier))
  );
}

export function buildPaidUserCreatedPayload(input: {
  webhook: RazorpayWebhookPayload;
  siteUrl: string;
  whatsappGroupLink: string;
}): PaidUserCreatedPayload | null {
  const payment = input.webhook.payload?.payment?.entity;
  const order = input.webhook.payload?.order?.entity;
  const paymentLink = input.webhook.payload?.payment_link?.entity;
  const amount = payment?.amount ?? order?.amount ?? paymentLink?.amount;
  const currency = payment?.currency ?? order?.currency ?? paymentLink?.currency;
  const paymentId = payment?.id;

  if (!paymentId || amount !== 5100 || currency !== "INR") {
    return null;
  }

  const notes = {
    ...(order?.notes ?? {}),
    ...(paymentLink?.notes ?? {}),
    ...(payment?.notes ?? {})
  };
  const registrationId = createRegistrationId(paymentId);
  const registrationToken = createRegistrationToken(paymentId);
  const fullName =
    asString(notes.full_name) ||
    asString(notes.fullName) ||
    asString(notes.name) ||
    asString(paymentLink?.customer?.name) ||
    "Workshop Participant";
  const phoneNumber =
    normalizePhone(asString(notes.phone_number) || asString(notes.phoneNumber)) ||
    normalizePhone(payment?.contact ?? paymentLink?.customer?.contact ?? "");
  const email =
    asString(notes.email) || asString(payment?.email) || asString(paymentLink?.customer?.email);
  const programSlug = asString(notes.program_slug) || "women-health-masterclass-101";
  const workshopSlot = asString(notes.workshop_slot) || "next-saturday-7pm-ist";
  const createdAt = payment?.created_at
    ? new Date(payment.created_at * 1000).toISOString()
    : new Date().toISOString();
  const leadTimestamp = formatLeadTimestamp(createdAt);

  return {
    event_type: "paid_user_created",
    registration_id: registrationId,
    registration_token: registrationToken,
    full_name: fullName,
    phone_number: phoneNumber,
    email,
    program_slug: programSlug,
    workshop_slot: workshopSlot,
    amount: 5100,
    currency: "INR",
    payment_status: "success",
    member_status: "paid_not_joined",
    razorpay_order_id: payment?.order_id || order?.id || paymentLink?.id || paymentId,
    razorpay_payment_id: paymentId,
    whatsapp_group_link: input.whatsappGroupLink,
    thank_you_url: `${input.siteUrl.replace(/\/$/, "")}/success?registration_token=${registrationToken}`,
    utm_source: asString(notes.utm_source),
    utm_medium: asString(notes.utm_medium),
    utm_campaign: asString(notes.utm_campaign),
    utm_content: asString(notes.utm_content),
    utm_term: asString(notes.utm_term),
    created_at: createdAt,
    lead_timestamp: leadTimestamp
  };
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
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

function splitEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectRazorpaySourceIdentifiers(webhook: RazorpayWebhookPayload) {
  const payment = webhook.payload?.payment?.entity;
  const order = webhook.payload?.order?.entity;
  const paymentLink = webhook.payload?.payment_link?.entity;
  const paymentPage = webhook.payload?.payment_page?.entity;
  const identifiers: string[] = [];

  collectStringValues(paymentLink, identifiers);
  collectStringValues(paymentPage, identifiers);
  collectStringValues(payment?.notes, identifiers);
  collectStringValues(order?.notes, identifiers);

  return identifiers;
}

function collectStringValues(value: unknown, output: string[]) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed) {
      output.push(trimmed);
    }

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
    for (const nestedValue of Object.values(value)) {
      collectStringValues(nestedValue, output);
    }
  }
}

function createRegistrationId(paymentId: string) {
  return `rzp_${paymentId}`;
}

function createRegistrationToken(paymentId: string) {
  return Buffer.from(paymentId).toString("base64url");
}
