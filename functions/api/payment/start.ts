import {
  createPaymentAttemptCookie,
  createPaymentAttemptId
} from "../../../lib/server/payment-access";

type Env = {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const PAYMENT_AMOUNT_IN_PAISE = 5100;
const PAYMENT_CURRENCY = "INR";
const PAYMENT_DESCRIPTION = "Heal Your Hormones Registration";
const RAZORPAY_PAYMENT_LINKS_API = "https://api.razorpay.com/v1/payment_links/";
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
  if (!accessSecret || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return redirectToSuccess(request, "missing_configuration");
  }

  const attemptId = createPaymentAttemptId();
  const paymentLink = await createRazorpayPaymentLink({
    attemptId,
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    request
  });

  if (!paymentLink) {
    return redirectToSuccess(request, "payment_link_creation_failed");
  }

  const attemptCookie = await createPaymentAttemptCookie({
    attemptId,
    secret: accessSecret
  });

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: paymentLink.shortUrl,
      "set-cookie": attemptCookie
    }
  });
}

async function createRazorpayPaymentLink({
  attemptId,
  keyId,
  keySecret,
  request
}: {
  attemptId: string;
  keyId: string;
  keySecret: string;
  request: Request;
}) {
  const callbackUrl = new URL("/api/razorpay/success", request.url);
  const response = await fetch(RAZORPAY_PAYMENT_LINKS_API, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      accept_partial: false,
      amount: PAYMENT_AMOUNT_IN_PAISE,
      callback_method: "get",
      callback_url: callbackUrl.toString(),
      currency: PAYMENT_CURRENCY,
      description: PAYMENT_DESCRIPTION,
      notes: {
        product: "heal_your_hormones_registration"
      },
      notify: {
        email: false,
        sms: false
      },
      reference_id: attemptId,
      reminder_enable: false
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || typeof payload.short_url !== "string") {
    return null;
  }

  return { shortUrl: payload.short_url };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
