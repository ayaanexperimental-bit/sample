import type { D1Database } from "@cloudflare/workers-types";
import { getCoachById, getFunnelById, isPaidProgramFunnel } from "../../../lib/coach-platform";
import { recordAnalyticsEvent } from "../../../lib/server/analytics-events";
import {
  FUNNEL_ACCESS_HASH_QUERY,
  verifyFunnelAccessFromCookie
} from "../../../lib/server/funnel-access";
import {
  createPaymentAccessCookie,
  verifyPaymentAttemptFromCookie
} from "../../../lib/server/payment-access";
import {
  paidFunnelSupportResponse,
  type PaidFunnelSupportEnv
} from "../../../lib/server/paid-funnel-support";

type PagesContext = {
  env: Env;
  request: Request;
};

type Env = PaidFunnelSupportEnv & {
  ADMIN_DB?: D1Database;
  FUNNEL_ACCESS_SECRET?: string;
  RAZORPAY_KEY_SECRET?: string;
  SUCCESS_ACCESS_SECRET?: string;
};

const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...NO_STORE_HEADERS, allow: "GET, POST" }
    });
  }

  const accessSecret = env.SUCCESS_ACCESS_SECRET || env.RAZORPAY_KEY_SECRET;
  const activeAccess = await getActivePaidFunnel(request, env);
  const paymentAttempt = accessSecret
    ? await verifyPaymentAttemptFromCookie({
        cookieHeader: request.headers.get("cookie"),
        secret: accessSecret
      })
    : null;
  if (
    !accessSecret ||
    !activeAccess ||
    !paymentAttempt ||
    paymentAttempt.funnelId !== activeAccess.funnel.id ||
    paymentAttempt.accessHash !== activeAccess.accessHash
  ) {
    return paidFunnelSupportResponse({
      env,
      funnel: activeAccess?.funnel || null,
      funnelStep: "paid_success",
      request,
      safeMessage:
        "We could not verify this paid success session. Please contact support for help.",
      status: 403,
      technicalDigest: "paid_success_browser_hash_or_attempt_missing",
      userAction: "Open paid success page"
    });
  }

  const { accessHash, funnel: activeFunnel } = activeAccess;
  const paidCookie = await createPaymentAccessCookie({
    accessHash,
    funnelId: activeFunnel.id,
    paymentId: paymentAttempt.attemptId,
    secret: accessSecret,
    source: "razorpay_hosted_page_redirect"
  });

  await recordPaidSuccessEvent({ env, funnelId: activeFunnel.id, request });

  return redirectToProgramSuccess(request, activeFunnel.successPath, accessHash, paidCookie);
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

  return isPaidProgramFunnel(funnel) ? { accessHash: funnelAccess.accessHash, funnel } : null;
}

function redirectToProgramSuccess(
  request: Request,
  successPath: string,
  accessHash: string,
  paidCookie: string
) {
  const url = new URL(successPath, request.url);
  url.searchParams.set(FUNNEL_ACCESS_HASH_QUERY, accessHash);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString(),
      "set-cookie": paidCookie
    }
  });
}

async function recordPaidSuccessEvent({
  env,
  funnelId,
  request
}: {
  env: Env;
  funnelId: string;
  request: Request;
}) {
  try {
    const funnel = getFunnelById(funnelId);
    const coach = funnel ? getCoachById(funnel.coachId) : null;

    await recordAnalyticsEvent(
      {
        coachSlug: coach?.slug || "",
        eventName: "payment_success",
        funnelId,
        funnelType: "paid_masterclass",
        pagePath: new URL(request.url).pathname,
        referrer: request.headers.get("referer") || "",
        request
      },
      env
    );
  } catch {
    // Analytics storage must never block success redirect.
  }
}
