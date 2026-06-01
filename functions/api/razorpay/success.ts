import { getFunnelById, isPaidProgramFunnel } from "../../../lib/coach-platform";
import { blockedLinkResponse } from "../../../lib/server/blocked-response";
import { verifyFunnelAccessFromCookie } from "../../../lib/server/funnel-access";

type PagesContext = {
  env: Env;
  request: Request;
};

type Env = {
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

  const activeFunnel = await getActivePaidFunnel(request, env);
  if (!activeFunnel) {
    return blockedLinkResponse();
  }

  return redirectToProgramSuccess(request, activeFunnel.successPath);
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

function redirectToProgramSuccess(request: Request, successPath: string) {
  const url = new URL(successPath, request.url);

  return new Response(null, {
    status: 302,
    headers: {
      ...NO_STORE_HEADERS,
      location: url.toString()
    }
  });
}
