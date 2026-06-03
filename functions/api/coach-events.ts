type PagesContext = {
  request: Request;
};

type CoachEventBody = {
  coachSlug?: unknown;
  eventName?: unknown;
  funnelType?: unknown;
  metadata?: unknown;
  pagePath?: unknown;
  referrer?: unknown;
  sessionId?: unknown;
  source?: unknown;
};

const allowedEvents = new Set([
  "coach_google_form_click",
  "coach_register_click",
  "coach_site_archived",
  "coach_site_created",
  "coach_site_paused",
  "coach_site_published",
  "coach_site_removed",
  "coach_site_resumed",
  "coach_site_view",
  "coach_site_updated",
  "coach_video_play",
  "coach_whatsapp_click",
  "paid_landing_view",
  "paid_payment_click",
  "paid_register_click",
  "paid_whatsapp_click",
  "payment_initiated",
  "payment_success",
  "success_page_view"
]);

export async function onRequest({ request }: PagesContext) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const body = await readJsonBody(request);
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const coachSlug = typeof body?.coachSlug === "string" ? sanitizeSlug(body.coachSlug) : "";
  const funnelType = parseFunnelType(body?.funnelType);
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.slice(0, 240) : "";
  const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 240) : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 120) : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 120) : "";

  if (!allowedEvents.has(eventName) || !coachSlug) {
    return json({ ok: false, error: "Invalid event." }, 400);
  }

  // TODO: Persist analytics_events with event id, event name, timestamp, page path, coach slug,
  // funnel type, source/referrer, UTM params, session/visitor id, device type, region, and safe
  // metadata after the analytics event table is approved.
  return json({
    event: {
      coachSlug,
      eventName,
      funnelType,
      pagePath,
      referrer,
      sessionId,
      source
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

function parseFunnelType(value: unknown) {
  return value === "paid_masterclass" || value === "free_guest_link" ? value : "free_guest_link";
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
