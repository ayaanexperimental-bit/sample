import type { KVNamespace } from "@cloudflare/workers-types";

type Env = {
  LIVE_VIEWERS?: KVNamespace;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const ACTIVE_TTL_SECONDS = 120;
const SESSION_PREFIX = "viewer:";
const MAX_COUNTED_SESSIONS = 1000;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export async function onRequest({ request, env }: PagesContext) {
  if (!env.LIVE_VIEWERS) {
    return json({ viewers: 1, source: "fallback" });
  }

  if (request.method === "GET") {
    return json({ viewers: await countActiveViewers(env.LIVE_VIEWERS) });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { sessionId?: unknown; active?: unknown };
  try {
    body = (await request.json()) as { sessionId?: unknown; active?: unknown };
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (typeof body.sessionId !== "string" || !isValidSessionId(body.sessionId)) {
    return json({ error: "Invalid session" }, 400);
  }

  const key = `${SESSION_PREFIX}${body.sessionId}`;

  if (body.active === false) {
    await env.LIVE_VIEWERS.delete(key);
  } else {
    await env.LIVE_VIEWERS.put(key, String(Date.now()), {
      expirationTtl: ACTIVE_TTL_SECONDS
    });
  }

  return json({ viewers: await countActiveViewers(env.LIVE_VIEWERS) });
}

async function countActiveViewers(store: KVNamespace) {
  const sessions = await store.list({ prefix: SESSION_PREFIX, limit: MAX_COUNTED_SESSIONS });
  return Math.max(1, sessions.keys.length);
}

function isValidSessionId(sessionId: string) {
  return /^[a-zA-Z0-9._:-]{8,128}$/.test(sessionId);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders
  });
}
