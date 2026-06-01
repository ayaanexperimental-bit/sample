import {
  createPaymentAttemptCookie,
  createPaymentAttemptId,
  PAYMENT_ATTEMPT_FIELD
} from "../../../lib/server/payment-access";
import { getFunnelById, isPaidProgramFunnel } from "../../../lib/coach-platform";
import { blockedLinkResponse } from "../../../lib/server/blocked-response";
import { verifyFunnelAccessFromCookie } from "../../../lib/server/funnel-access";

type Env = {
  FUNNEL_ACCESS_SECRET?: string;
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
const HTML_HEADERS = {
  ...NO_STORE_HEADERS,
  "content-type": "text/html; charset=utf-8"
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
    return paymentUnavailable();
  }

  const activeFunnel = await getActivePaidFunnel(request, env);
  if (!activeFunnel) {
    return blockedLinkResponse();
  }

  const attemptId = createPaymentAttemptId();
  const attemptCookie = await createPaymentAttemptCookie({
    attemptId,
    secret: accessSecret
  });
  const paymentPageUrl = new URL(
    activeFunnel.paymentUrl || env.RAZORPAY_PAYMENT_PAGE_URL || DEFAULT_PAYMENT_PAGE_URL
  );
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

async function getActivePaidFunnel(request: Request, env: Env) {
  const funnelAccessSecret = env.FUNNEL_ACCESS_SECRET;
  if (!funnelAccessSecret) return null;

  const funnelAccess = await verifyFunnelAccessFromCookie({
    cookieHeader: request.headers.get("cookie"),
    secret: funnelAccessSecret
  });
  if (!funnelAccess) return null;

  const funnel = getFunnelById(funnelAccess.funnelId);

  return isPaidProgramFunnel(funnel) ? funnel : null;
}

function paymentUnavailable() {
  return new Response(
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Payment Temporarily Unavailable</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #fff7fb;
              color: #251126;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            main {
              width: min(92vw, 34rem);
              padding: 2rem;
              border: 1px solid rgba(201, 33, 126, 0.18);
              border-radius: 1.25rem;
              background: rgba(255, 255, 255, 0.82);
              box-shadow: 0 1rem 3rem rgba(99, 25, 70, 0.12);
            }
            h1 {
              margin: 0 0 0.75rem;
              font-size: clamp(1.6rem, 5vw, 2.2rem);
              line-height: 1.05;
            }
            p {
              margin: 0;
              color: #60445e;
              font-size: 1rem;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>Payment is temporarily unavailable</h1>
            <p>Please try again shortly. Registration is not confirmed until payment is completed.</p>
          </main>
        </body>
      </html>`,
    {
      status: 503,
      headers: HTML_HEADERS
    }
  );
}
