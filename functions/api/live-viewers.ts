import type { KVNamespace } from "@cloudflare/workers-types";

type Env = {
  LIVE_VIEWERS?: KVNamespace;
};

type PagesContext = {
  request: Request;
  env: Env;
};

const ACTIVE_TTL_SECONDS = 45;
const ACTIVE_TTL_MS = ACTIVE_TTL_SECONDS * 1000;
const VIEWER_INDEX_KEY = "viewer:index";
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

  return json({
    viewers: await updateActiveViewers(env.LIVE_VIEWERS, body.sessionId, body.active !== false)
  });
}

async function countActiveViewers(store: KVNamespace) {
  const sessions = await readSessionIndex(store);
  return Math.max(1, pruneExpiredSessions(sessions, Date.now()).size);
}

async function updateActiveViewers(store: KVNamespace, sessionId: string, active: boolean) {
  const now = Date.now();
  const sessions = pruneExpiredSessions(await readSessionIndex(store), now);

  if (active) {
    sessions.set(sessionId, now + ACTIVE_TTL_MS);
  } else {
    sessions.delete(sessionId);
  }

  const compactSessions = Array.from(sessions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COUNTED_SESSIONS);

  await store.put(VIEWER_INDEX_KEY, JSON.stringify(compactSessions), {
    expirationTtl: ACTIVE_TTL_SECONDS * 2
  });

  return Math.max(1, compactSessions.length);
}

async function readSessionIndex(store: KVNamespace) {
  const raw = await store.get(VIEWER_INDEX_KEY);
  if (!raw) {
    return new Map<string, number>();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Map<string, number>();
    }

    const sessions = new Map<string, number>();
    for (const entry of parsed) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "number" &&
        isValidSessionId(entry[0])
      ) {
        sessions.set(entry[0], entry[1]);
      }
    }

    return sessions;
  } catch {
    return new Map<string, number>();
  }
}

function pruneExpiredSessions(sessions: Map<string, number>, now: number) {
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }

  return sessions;
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
