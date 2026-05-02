import { NextRequest, NextResponse } from "next/server";
import {
  buildPaidUserCreatedPayload,
  getWebhookEventStatus,
  getRazorpayActiveSourceConfig,
  isActiveRazorpayPaymentSource,
  type RazorpayWebhookPayload,
  verifyRazorpayWebhookSignature
} from "@/lib/razorpay/webhook";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay webhook secret is not configured."
      },
      { status: 501 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay webhook signature verification failed."
      },
      { status: 400 }
    );
  }

  let webhook: RazorpayWebhookPayload;

  try {
    webhook = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid Razorpay webhook JSON." },
      { status: 400 }
    );
  }

  const eventStatus = getWebhookEventStatus(webhook.event);

  if (eventStatus !== "paid") {
    return NextResponse.json({
      ok: true,
      event: webhook.event ?? "unknown",
      status: eventStatus,
      handled: false
    });
  }

  const activeSourceConfig = getRazorpayActiveSourceConfig();

  if (!isActiveRazorpayPaymentSource(webhook, activeSourceConfig)) {
    return NextResponse.json({
      ok: true,
      event: webhook.event ?? "unknown",
      status: eventStatus,
      handled: false,
      ignored_reason: "Payment did not come from the active Razorpay payment page."
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://freedomfromdiabetes.in";
  const paidUserPayload = buildPaidUserCreatedPayload({
    webhook,
    siteUrl,
    whatsappGroupLink: process.env.WHATSAPP_COMMUNITY_INVITE_URL ?? ""
  });

  if (!paidUserPayload) {
    return NextResponse.json(
      {
        ok: false,
        event: webhook.event ?? "unknown",
        error: "Payment payload is missing required INR 5100 payment details."
      },
      { status: 422 }
    );
  }

  const n8nResult = await dispatchPaidUserCreatedToN8n(paidUserPayload);

  return NextResponse.json({
    ok: true,
    event: webhook.event,
    status: eventStatus,
    handled: true,
    payment_status: paidUserPayload.payment_status,
    member_status: paidUserPayload.member_status,
    registration_id: paidUserPayload.registration_id,
    customer: {
      full_name: paidUserPayload.full_name,
      phone_number_present: Boolean(paidUserPayload.phone_number),
      email_present: Boolean(paidUserPayload.email)
    },
    automation: n8nResult
  });
}

async function dispatchPaidUserCreatedToN8n(payload: unknown) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      status: "skipped",
      reason: "N8N_WEBHOOK_URL is not configured."
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET }
          : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return {
        status: "failed",
        statusCode: response.status
      };
    }

    return {
      status: "sent",
      statusCode: response.status
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "n8n dispatch failed."
    };
  }
}
