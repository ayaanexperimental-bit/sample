import { NextRequest, NextResponse } from "next/server";
import { getDatabaseConfig } from "@/lib/db/config";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { getRazorpayConfig } from "@/lib/razorpay/config";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay/signature";
import { validateRazorpayVerificationInput } from "@/lib/razorpay/verification";
import { CONFIRMED_PAYMENT_STATUS, INITIAL_MEMBER_STATUS } from "@/lib/registrations/status";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `razorpay-verify:${getClientIp(request)}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Too many payment verification attempts. Please try again later."
      },
      { status: 429 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid JSON body."] }, { status: 400 });
  }

  const validation = validateRazorpayVerificationInput(body);

  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }

  const razorpay = getRazorpayConfig();

  if (!razorpay.isConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay credentials are not configured.",
        requiredEnv: [
          "RAZORPAY_MODE",
          "RAZORPAY_TEST_KEY_ID",
          "RAZORPAY_TEST_KEY_SECRET",
          "RAZORPAY_LIVE_KEY_ID",
          "RAZORPAY_LIVE_KEY_SECRET"
        ]
      },
      { status: 501 }
    );
  }

  const signatureVerified = verifyRazorpayPaymentSignature(
    {
      razorpayOrderId: validation.data.razorpayOrderId,
      razorpayPaymentId: validation.data.razorpayPaymentId,
      razorpaySignature: validation.data.razorpaySignature
    },
    razorpay.keySecret
  );

  if (!signatureVerified) {
    return NextResponse.json(
      {
        ok: false,
        error: "Razorpay payment signature verification failed."
      },
      { status: 400 }
    );
  }

  const database = getDatabaseConfig();

  return NextResponse.json({
    ok: true,
    verified: true,
    payment: {
      provider: "razorpay",
      mode: razorpay.mode,
      razorpay_order_id: validation.data.razorpayOrderId,
      razorpay_payment_id: validation.data.razorpayPaymentId,
      razorpay_signature_verified: true,
      payment_status: CONFIRMED_PAYMENT_STATUS,
      member_status: INITIAL_MEMBER_STATUS
    },
    registration: {
      persistence: database.isConfigured ? "database_ready" : "database_not_configured",
      next_step: database.isConfigured
        ? "Persist confirmed registration in the next registration microtask."
        : "Choose/configure the database provider before confirmed registrations can be saved durably."
    }
  });
}
