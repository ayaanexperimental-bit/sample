import type { D1Database } from "@cloudflare/workers-types";
import { getFunnelById, isPaidProgramFunnel } from "../../lib/coach-platform";
import { verifyFunnelAccessFromCookie } from "../../lib/server/funnel-access";
import {
  getPrivateWhatsappGroupUrl,
  type PrivateFunnelLinkEnv
} from "../../lib/server/private-funnel-links";

type Env = PrivateFunnelLinkEnv & {
  ADMIN_DB?: D1Database;
  FUNNEL_ACCESS_SECRET?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "GET") {
    return json({ allowed: false, reason: "method_not_allowed" }, 405, {
      allow: "GET"
    });
  }

  const activeFunnel = await getActivePaidFunnel(request, env);
  if (!activeFunnel) {
    return json({ allowed: false, reason: "funnel_access_required" });
  }

  const joinUrl = await getPrivateWhatsappGroupUrl(activeFunnel, env);
  if (!joinUrl) {
    return json({ allowed: false, reason: "not_configured" });
  }

  return json({
    allowed: true,
    joinUrl
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

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers
    }
  });
}
