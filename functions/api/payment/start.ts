import {
  createPaymentAttemptCookie,
  createPaymentAttemptId,
  PAYMENT_ATTEMPT_FIELD
} from "../../../lib/server/payment-access";

type Env = {
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_PAYMENT_PAGE_URL?: string;
  SUCCESS_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const DEFAULT_PAYMENT_PAGE_URL = "https://pages.razorpay.com/pl_SkURMJD4JJjdxO/view";
const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET" }
    });
  }

  const accessSecret = env.SUCCESS_ACCESS_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!accessSecret) {
    return redirectToSuccess(request, "missing_configuration");
  }

  const attemptId = createPaymentAttemptId();
  const attemptCookie = await createPaymentAttemptCookie({
    attemptId,
    secret: accessSecret
  });

  const paymentPageUrl = new URL(env.RAZORPAY_PAYMENT_PAGE_URL || DEFAULT_PAYMENT_PAGE_URL);
  paymentPageUrl.searchParams.set(PAYMENT_ATTEMPT_FIELD, attemptId);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: paymentPageUrl.toString(),
      "set-cookie": attemptCookie
    }
  });
}

function redirectToSuccess(request: Request, reason: string) {
  const url = new URL("/success", request.url);
  url.searchParams.set("payment", reason);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString()
    }
  });
}
