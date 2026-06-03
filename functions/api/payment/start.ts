import type { D1Database } from "@cloudflare/workers-types";
import {
  createPaymentAttemptCookie,
  createPaymentAttemptId,
  PAYMENT_ATTEMPT_FIELD
} from "../../../lib/server/payment-access";
import { getCoachById, getFunnelById, isPaidProgramFunnel } from "../../../lib/coach-platform";
import { getSupportErrorDefinition } from "../../../lib/error-codes";
import { recordAnalyticsEvent } from "../../../lib/server/analytics-events";
import { blockedLinkResponse } from "../../../lib/server/blocked-response";
import { insertWebsiteErrorReport } from "../../../lib/server/error-reports";
import { verifyFunnelAccessFromCookie } from "../../../lib/server/funnel-access";

type Env = {
  ADMIN_DB?: D1Database;
  FUNNEL_ACCESS_SECRET?: string;
  NEXT_PUBLIC_SUPPORT_EMAIL?: string;
  NEXT_PUBLIC_SUPPORT_MESSAGE?: string;
  NEXT_PUBLIC_SUPPORT_NAME?: string;
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
    return paymentUnavailable(request, env);
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
  await recordPaidEvent({
    env,
    eventName: "payment_initiated",
    funnelId: activeFunnel.id,
    request
  });

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

async function paymentUnavailable(request: Request, env: Env) {
  const definition = getSupportErrorDefinition("payment_flow_issue");
  const referenceId = `${definition.code}-PAYMENT-START`;
  await insertWebsiteErrorReport(
    {
      browser: request.headers.get("user-agent") || "",
      category: "payment_flow_issue",
      coachSlug: "",
      digest: "payment_start_secret_missing",
      errorCode: definition.code,
      funnelStep: "payment_start",
      missingSupportFields: [],
      pagePath: new URL(request.url).pathname,
      referenceId,
      referrer: request.headers.get("referer") || "",
      safeMessage: "Payment start configuration is unavailable.",
      screenSize: "",
      supportSource: "default",
      technicalDetails: "Payment start access secret is not configured.",
      userAction: "Open paid payment link"
    },
    env
  );

  const supportName = escapeHtml(env.NEXT_PUBLIC_SUPPORT_NAME || "Yours Wellness Support");
  const supportEmail = escapeHtml(env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@ywcoach.com");
  const supportMessage = escapeHtml(
    env.NEXT_PUBLIC_SUPPORT_MESSAGE ||
      "We could not complete this step. Please contact support for help."
  );

  return new Response(
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Payment Support | YW Coach</title>
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
              margin: 0 0 1rem;
              color: #60445e;
              font-size: 1rem;
              line-height: 1.6;
            }
            .code {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              border: 1px solid rgba(201, 33, 126, 0.18);
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.72);
              color: #8b174d;
              font-weight: 800;
              letter-spacing: 0.04em;
              padding: 0.65rem 0.85rem;
            }
            .actions {
              display: flex;
              flex-wrap: wrap;
              gap: 0.75rem;
              margin-top: 1.25rem;
            }
            a,
            button {
              min-height: 2.8rem;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(201, 33, 126, 0.18);
              border-radius: 999px;
              background: white;
              color: #251126;
              cursor: pointer;
              font: inherit;
              font-weight: 800;
              padding: 0 1rem;
              text-decoration: none;
            }
            a:first-child {
              background: linear-gradient(135deg, #251126, #9f174d 58%, #a855f7);
              color: white;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>Payment is temporarily unavailable</h1>
            <p>${supportMessage}</p>
            <p>Contact ${supportName} and share this code:</p>
            <button class="code" type="button" onclick="navigator.clipboard && navigator.clipboard.writeText('${definition.code}')">${definition.code}</button>
            <div class="actions">
              <a href="mailto:${supportEmail}?subject=Payment%20support%20${definition.code}">Contact Support</a>
              <a href="/">Go Back Home</a>
            </div>
          </main>
        </body>
      </html>`,
    {
      status: 503,
      headers: HTML_HEADERS
    }
  );
}

async function recordPaidEvent({
  env,
  eventName,
  funnelId,
  request
}: {
  env: Env;
  eventName: "payment_initiated";
  funnelId: string;
  request: Request;
}) {
  try {
    const funnel = getFunnelById(funnelId);
    const coach = funnel ? getCoachById(funnel.coachId) : null;

    await recordAnalyticsEvent(
      {
        coachSlug: coach?.slug || "",
        eventName,
        funnelId,
        funnelType: "paid_masterclass",
        pagePath: new URL(request.url).pathname,
        referrer: request.headers.get("referer") || "",
        request
      },
      env
    );
  } catch {
    // Analytics storage must never block payment redirect.
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
