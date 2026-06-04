import type { D1Database } from "@cloudflare/workers-types";
import {
  createPaymentAttemptCookie,
  createPaymentAttemptId,
  PAYMENT_ATTEMPT_FIELD
} from "../../../lib/server/payment-access";
import { getCoachById, getFunnelById, isPaidProgramFunnel } from "../../../lib/coach-platform";
import { recordAnalyticsEvent } from "../../../lib/server/analytics-events";
import { blockedLinkResponse } from "../../../lib/server/blocked-response";
import { verifyFunnelAccessFromCookie } from "../../../lib/server/funnel-access";
import {
  getPrivatePaymentPageUrl,
  isAllowedPaymentPageUrl,
  type PrivateFunnelLinkEnv
} from "../../../lib/server/private-funnel-links";
import {
  paidFunnelSupportResponse,
  type PaidFunnelSupportEnv
} from "../../../lib/server/paid-funnel-support";

type Env = PrivateFunnelLinkEnv &
  PaidFunnelSupportEnv & {
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

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET" }
    });
  }

  const activeFunnel = await getActivePaidFunnel(request, env);
  if (!activeFunnel) {
    return blockedLinkResponse();
  }

  const accessSecret = env.SUCCESS_ACCESS_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!accessSecret) {
    return paidFunnelSupportResponse({
      env,
      funnel: activeFunnel,
      funnelStep: "payment_start",
      request,
      safeMessage: "The payment step is temporarily unavailable. Please contact support before retrying.",
      technicalDigest: "payment_start_secret_missing",
      userAction: "Open paid payment link"
    });
  }

  const attemptId = createPaymentAttemptId();
  const attemptCookie = await createPaymentAttemptCookie({
    attemptId,
    secret: accessSecret
  });
  const resolvedPaymentUrl =
    (await getPrivatePaymentPageUrl(activeFunnel, env)) ||
    activeFunnel.paymentUrl ||
    env.RAZORPAY_PAYMENT_PAGE_URL ||
    DEFAULT_PAYMENT_PAGE_URL;
  if (!isAllowedPaymentPageUrl(resolvedPaymentUrl)) {
    return paidFunnelSupportResponse({
      env,
      funnel: activeFunnel,
      funnelStep: "payment_start",
      request,
      safeMessage: "The payment link is temporarily unavailable. Please contact support before retrying.",
      technicalDigest: "payment_start_url_invalid",
      userAction: "Open paid payment link"
    });
  }

  const paymentPageUrl = new URL(resolvedPaymentUrl);
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
