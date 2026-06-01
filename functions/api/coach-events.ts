type PagesContext = {
  request: Request;
};

type CoachEventBody = {
  coachSlug?: unknown;
  eventName?: unknown;
  pagePath?: unknown;
};

const allowedEvents = new Set([
  "coach_register_click",
  "coach_site_view",
  "coach_video_play",
  "coach_whatsapp_click"
]);

export async function onRequest({ request }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody(request);
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const coachSlug = typeof body?.coachSlug === "string" ? sanitizeSlug(body.coachSlug) : "";
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 240) : "";

  if (!allowedEvents.has(eventName) || !coachSlug) {
    return json({ ok: false, error: "Invalid event." }, 400);
  }

  // TODO: Persist analytics_events with event name, timestamp, page path, coach slug,
  // session/visitor id, device type, region/source, and safe metadata after database approval.
  return json({
    event: {
      coachSlug,
      eventName,
      pagePath
    },
    ok: true,
    persisted: false
  });
}

async function readJsonBody(request: Request): Promise<CoachEventBody | null> {
  try {
    const value = (await request.json()) as unknown;

    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as CoachEventBody)
      : null;
  } catch {
    return null;
  }
}

function sanitizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 72);
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
