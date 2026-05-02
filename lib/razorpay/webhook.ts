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
    created_at: createdAt
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

function createRegistrationId(paymentId: string) {
  return `rzp_${paymentId}`;
}

function createRegistrationToken(paymentId: string) {
  return Buffer.from(paymentId).toString("base64url");
}
