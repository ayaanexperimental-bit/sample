import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/http/rate-limit";
import { getClientIp } from "@/lib/http/request";
import { validateCheckoutSessionInput } from "@/lib/checkout/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_HOSTED_CHECKOUT_URL = "https://rzp.io/rzp/xBIZzJHv";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `checkout:${getClientIp(request)}`,
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid JSON body."] }, { status: 400 });
  }

  const validation = validateCheckoutSessionInput(body);

  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }

  const hostedCheckoutUrl = process.env.RAZORPAY_HOSTED_CHECKOUT_URL || DEFAULT_HOSTED_CHECKOUT_URL;

  if (hostedCheckoutUrl) {
    return NextResponse.json({
      ok: true,
      checkoutUrl: hostedCheckoutUrl,
      checkout: {
        amount: validation.data.amount,
        currency: validation.data.currency,
        provider: "razorpay",
        mode: "hosted"
      }
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Hosted Razorpay checkout is not configured yet.",
      checkout: {
        amount: validation.data.amount,
        currency: validation.data.currency,
        provider: "razorpay",
        mode: "hosted",
        nextStep: "Provide Razorpay method, credentials, and payment page or checkout setup."
      }
    },
    { status: 501 }
  );
}
