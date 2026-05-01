import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { getRazorpayConfig } from "@/lib/razorpay/config";
import { createRazorpayOrder } from "@/lib/razorpay/orders";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_PROGRAM_SLUG = "women-health-masterclass-101";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createReceipt() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  return `whm101_${suffix}`;
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `razorpay-order:${getClientIp(request)}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many checkout attempts. Please try again later."
      },
      { status: 429 }
    );
  }

  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const config = getRazorpayConfig();

  if (!config.isConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay test credentials are not configured.",
        requiredEnv: [
          "RAZORPAY_MODE",
          "RAZORPAY_TEST_KEY_ID",
          "RAZORPAY_TEST_KEY_SECRET",
          "WORKSHOP_AMOUNT_PAISE",
          "WORKSHOP_CURRENCY"
        ]
      },
      { status: 501 }
    );
  }

  try {
    const order = await createRazorpayOrder(config, {
      receipt: createReceipt(),
      programSlug: asString(input.programSlug) || DEFAULT_PROGRAM_SLUG,
      workshopSlot: asString(input.workshopSlot) || undefined
    });

    return NextResponse.json({
      ok: true,
      provider: "razorpay",
      mode: config.mode,
      keyId: config.keyId,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Razorpay order creation failed."
      },
      { status: 502 }
    );
  }
}
