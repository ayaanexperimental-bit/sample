import type { DurableObjectNamespace } from "@cloudflare/workers-types";

type Env = {
  LIVE_VIEWERS?: DurableObjectNamespace;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const ROOM_NAME = "primary-landing-page";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export function onRequest({ request, env }: PagesContext) {
  if (!env.LIVE_VIEWERS) {
    return json({ error: "Live viewer service is not configured" }, 503);
  }

  const room = env.LIVE_VIEWERS.get(env.LIVE_VIEWERS.idFromName(ROOM_NAME));
  return room.fetch(request as unknown as Parameters<typeof room.fetch>[0]);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}
