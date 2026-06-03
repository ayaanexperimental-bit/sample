import type { D1Database } from "@cloudflare/workers-types";
import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsDeviceType,
  type AnalyticsEventName,
  type AnalyticsFunnelType,
  type AnalyticsMetricSummary
} from "../analytics-events";
import { getFunnelById } from "../coach-platform";
import {
  type CoachSiteAnalyticsSummary,
  normalizeCoachSlug
} from "../admin-coach-sites";
import { ensureCoachSiteTables } from "./coach-site-storage";

export type AnalyticsEventStorageEnv = {
  ADMIN_DB?: D1Database;
};

export type AnalyticsEventInput = {
  coachSlug?: string;
  eventName: AnalyticsEventName;
  funnelId?: string;
  funnelType?: AnalyticsFunnelType;
  metadata?: Record<string, unknown>;
  pagePath?: string;
  pageUrl?: string;
  referrer?: string;
  request: Request;
  sessionId?: string;
  source?: string;
};

type AnalyticsEventRow = {
  coach_id: string;
  coach_slug: string;
  created_at: number;
  device_type: AnalyticsDeviceType;
  event_name: AnalyticsEventName;
  funnel_id: string;
  funnel_type: AnalyticsFunnelType;
  region: string;
  source: string;
};

const ANALYTICS_TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    funnel_type TEXT NOT NULL CHECK (funnel_type IN ('free_guest_link', 'paid_masterclass')),
    coach_slug TEXT NOT NULL DEFAULT '',
    coach_site_id TEXT NOT NULL DEFAULT '',
    coach_id TEXT NOT NULL DEFAULT '',
    funnel_id TEXT NOT NULL DEFAULT '',
    page_path TEXT NOT NULL DEFAULT '',
    referrer TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    utm_source TEXT NOT NULL DEFAULT '',
    utm_medium TEXT NOT NULL DEFAULT '',
    utm_campaign TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    device_type TEXT NOT NULL DEFAULT 'unknown',
    region TEXT NOT NULL DEFAULT 'Not available',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    created_date TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
    ON analytics_events (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_coach_created
    ON analytics_events (coach_slug, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_funnel_created
    ON analytics_events (funnel_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
    ON analytics_events (event_name, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_analytics_events_date_funnel
    ON analytics_events (created_date, funnel_type)`
];

const DEFAULT_ANALYTICS: CoachSiteAnalyticsSummary = {
  averageVisits: 0,
  conversionRate: "0%",
  dailyVisits: 0,
  deviceBreakdown: {
    desktop: 0,
    mobile: 0,
    tablet: 0
  },
  lastUpdated: "Not connected",
  monthlyVisits: 0,
  region: "Not available",
  source: "Not available",
  totalRegisterClicks: 0,
  totalVisits: 0,
  totalWhatsappClicks: 0,
  videoPlays: 0,
  weeklyVisits: 0
};

export async function ensureAnalyticsEventTables(env: AnalyticsEventStorageEnv) {
  if (!env.ADMIN_DB) return false;

  for (const statement of ANALYTICS_TABLE_SQL) {
    await env.ADMIN_DB.prepare(statement).run();
  }

  return true;
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput, env: AnalyticsEventStorageEnv) {
  if (!env.ADMIN_DB || !ANALYTICS_EVENT_NAMES.has(input.eventName)) {
    return { ok: false, persisted: false, reason: "not_configured_or_invalid" };
  }

  await ensureCoachSiteTables(env);
  await ensureAnalyticsEventTables(env);

  const now = Math.floor(Date.now() / 1000);
  const normalizedInputSlug = normalizeCoachSlug(input.coachSlug || "");
  const funnelId = sanitizeToken(input.funnelId, 120);
  const staticFunnel = funnelId ? getFunnelById(funnelId) : null;
  const row = normalizedInputSlug
    ? await env.ADMIN_DB.prepare(
        `SELECT id, coach_id, slug, analytics_json
         FROM coach_sites
         WHERE slug = ?1
         LIMIT 1`
      )
        .bind(normalizedInputSlug)
        .first<{
          analytics_json: string;
          coach_id: string;
          id: string;
          slug: string;
        }>()
    : null;
  const coachSlug = row?.slug || normalizedInputSlug;
  const coachId = row?.coach_id || staticFunnel?.coachId || "";
  const funnelType = normalizeFunnelType(input.funnelType, input.eventName);
  const pagePath = sanitizePath(input.pagePath || extractPathFromUrl(input.pageUrl));
  const referrer = sanitizeUrlText(input.referrer || input.request.headers.get("referer") || "");
  const source = sanitizeText(
    input.source || extractUtm(input.pageUrl, "utm_source") || getSourceFromReferrer(referrer),
    80
  );
  const deviceType = getDeviceType(input.request.headers.get("user-agent") || "");
  const region = getRequestRegion(input.request);
  const metadataJson = JSON.stringify(sanitizeMetadata(input.metadata));
  const createdDate = new Date(now * 1000).toISOString().slice(0, 10);
  const eventId = `analytics-event-${crypto.randomUUID()}`;

  await env.ADMIN_DB.prepare(
    `INSERT INTO analytics_events (
      id, event_name, funnel_type, coach_slug, coach_site_id, coach_id, funnel_id,
      page_path, referrer, source, utm_source, utm_medium, utm_campaign, session_id,
      device_type, region, metadata_json, created_at, created_date
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7,
      ?8, ?9, ?10, ?11, ?12, ?13, ?14,
      ?15, ?16, ?17, ?18, ?19
    )`
  )
    .bind(
      eventId,
      input.eventName,
      funnelType,
      coachSlug,
      row?.id || "",
      coachId,
      funnelId,
      pagePath,
      referrer,
      source || "direct",
      sanitizeText(extractUtm(input.pageUrl, "utm_source"), 80),
      sanitizeText(extractUtm(input.pageUrl, "utm_medium"), 80),
      sanitizeText(extractUtm(input.pageUrl, "utm_campaign"), 120),
      sanitizeToken(input.sessionId, 120),
      deviceType,
      region,
      metadataJson,
      now,
      createdDate
    )
    .run();

  if (row && funnelType === "free_guest_link") {
    await updateCoachSiteAnalyticsFromEvents({
      env,
      fallbackAnalyticsJson: row.analytics_json,
      slug: row.slug
    });
  }

  return {
    eventId,
    ok: true,
    persisted: true
  };
}

export async function getAnalyticsMetricSummaries(
  env: AnalyticsEventStorageEnv
): Promise<AnalyticsMetricSummary[]> {
  if (!env.ADMIN_DB) return [];

  await ensureAnalyticsEventTables(env);

  const result = await env.ADMIN_DB.prepare(
    `SELECT event_name, funnel_type, coach_slug, coach_id, funnel_id, device_type, region, source, created_at
     FROM analytics_events
     ORDER BY created_at DESC
     LIMIT 20000`
  ).all<AnalyticsEventRow>();

  return summarizeEventRows(result.results || []);
}

async function updateCoachSiteAnalyticsFromEvents({
  env,
  fallbackAnalyticsJson,
  slug
}: {
  env: AnalyticsEventStorageEnv;
  fallbackAnalyticsJson: string;
  slug: string;
}) {
  if (!env.ADMIN_DB) return;

  const result = await env.ADMIN_DB.prepare(
    `SELECT event_name, funnel_type, coach_slug, coach_id, funnel_id, device_type, region, source, created_at
     FROM analytics_events
     WHERE coach_slug = ?1 AND funnel_type = 'free_guest_link'
     ORDER BY created_at DESC
     LIMIT 10000`
  )
    .bind(slug)
    .all<AnalyticsEventRow>();
  const summary = summarizeEventRows(result.results || [])[0];
  const previous = safeJson<CoachSiteAnalyticsSummary>(fallbackAnalyticsJson, DEFAULT_ANALYTICS);
  const nextAnalytics = summaryToCoachSiteAnalytics(summary, previous);
  const now = Math.floor(Date.now() / 1000);

  await env.ADMIN_DB.prepare(
    `UPDATE coach_sites
     SET analytics_json = ?1,
         updated_at = ?2
     WHERE slug = ?3`
  )
    .bind(JSON.stringify(nextAnalytics), now, slug)
    .run();
}

function summarizeEventRows(rows: AnalyticsEventRow[]): AnalyticsMetricSummary[] {
  const groups = new Map<string, AnalyticsMetricSummary>();
  const now = Math.floor(Date.now() / 1000);
  const dayStart = now - 86400;
  const weekStart = now - 7 * 86400;
  const monthStart = now - 30 * 86400;
  const regionCounts = new Map<string, Record<string, number>>();
  const sourceCounts = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const key = `${row.coach_id}|${row.coach_slug}|${row.funnel_id}|${row.funnel_type}`;
    const summary = getOrCreateSummary(groups, key, row);
    const eventTime = normalizeNumber(row.created_at);

    if (isVisitEvent(row.event_name)) {
      summary.totalVisits += 1;
      if (eventTime >= dayStart) summary.dailyVisits += 1;
      if (eventTime >= weekStart) summary.weeklyVisits += 1;
      if (eventTime >= monthStart) summary.monthlyVisits += 1;
      if (row.device_type !== "unknown") {
        summary.deviceBreakdown[row.device_type] += 1;
      }
    }

    if (row.event_name === "coach_register_click" || row.event_name === "paid_register_click") {
      summary.registerClicks += 1;
    }
    if (row.event_name === "paid_payment_click") summary.paymentButtonClicks += 1;
    if (row.event_name === "payment_initiated") summary.paymentInitiated += 1;
    if (row.event_name === "payment_success") summary.paymentSuccess += 1;
    if (row.event_name === "success_page_view") summary.successPageViews += 1;
    if (row.event_name === "coach_whatsapp_click" || row.event_name === "paid_whatsapp_click") {
      summary.whatsappClicks += 1;
    }
    if (row.event_name === "coach_video_play") summary.videoPlays += 1;

    if (eventTime && (!summary.lastActivity || Date.parse(summary.lastActivity) / 1000 < eventTime)) {
      summary.lastActivity = new Date(eventTime * 1000).toISOString();
    }

    incrementBreakdown(regionCounts, key, row.region);
    incrementBreakdown(sourceCounts, key, row.source);
  }

  return Array.from(groups.entries()).map(([key, summary]) => ({
    ...summary,
    region: getTopBreakdown(regionCounts.get(key), "Not available"),
    source: getTopBreakdown(sourceCounts.get(key), "Not available")
  }));
}

function getOrCreateSummary(
  groups: Map<string, AnalyticsMetricSummary>,
  key: string,
  row: AnalyticsEventRow
) {
  const existing = groups.get(key);
  if (existing) return existing;

  const created: AnalyticsMetricSummary = {
    coachId: row.coach_id || "",
    coachSlug: row.coach_slug || "",
    dailyVisits: 0,
    deviceBreakdown: {
      desktop: 0,
      mobile: 0,
      tablet: 0
    },
    funnelId: row.funnel_id || "",
    funnelType: row.funnel_type,
    lastActivity: "",
    monthlyVisits: 0,
    paymentButtonClicks: 0,
    paymentInitiated: 0,
    paymentSuccess: 0,
    region: "Not available",
    registerClicks: 0,
    source: "Not available",
    successPageViews: 0,
    totalVisits: 0,
    videoPlays: 0,
    weeklyVisits: 0,
    whatsappClicks: 0
  };
  groups.set(key, created);

  return created;
}

function summaryToCoachSiteAnalytics(
  summary: AnalyticsMetricSummary | undefined,
  previous: CoachSiteAnalyticsSummary
): CoachSiteAnalyticsSummary {
  if (!summary) return previous;

  return {
    averageVisits: summary.weeklyVisits ? Math.round(summary.weeklyVisits / 7) : 0,
    conversionRate: getConversionRate(summary.registerClicks, summary.totalVisits),
    dailyVisits: summary.dailyVisits,
    deviceBreakdown: summary.deviceBreakdown,
    lastUpdated: summary.lastActivity || new Date().toISOString(),
    monthlyVisits: summary.monthlyVisits,
    region: summary.region,
    source: summary.source,
    totalRegisterClicks: summary.registerClicks,
    totalVisits: summary.totalVisits,
    totalWhatsappClicks: summary.whatsappClicks,
    videoPlays: summary.videoPlays,
    weeklyVisits: summary.weeklyVisits
  };
}

function isVisitEvent(eventName: AnalyticsEventName) {
  return eventName === "coach_site_view" || eventName === "paid_landing_view";
}

function normalizeFunnelType(value: unknown, eventName: AnalyticsEventName): AnalyticsFunnelType {
  if (value === "paid_masterclass" || eventName.startsWith("paid_") || eventName === "payment_initiated" || eventName === "payment_success" || eventName === "success_page_view") {
    return "paid_masterclass";
  }

  return "free_guest_link";
}

function getDeviceType(userAgent: string): AnalyticsDeviceType {
  const value = userAgent.toLowerCase();
  if (!value) return "unknown";
  if (/ipad|tablet|playbook|silk/.test(value)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|phone/.test(value)) return "mobile";
  return "desktop";
}

function getRequestRegion(request: Request) {
  const requestWithCf = request as Request & {
    cf?: {
      country?: string;
      region?: string;
    };
  };
  const cf = requestWithCf.cf;
  const region = sanitizeText(cf?.region || cf?.country || "", 80);

  return region || "Not available";
}

function getSourceFromReferrer(referrer: string) {
  if (!referrer) return "direct";

  try {
    const hostname = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (hostname.includes("instagram")) return "instagram";
    if (hostname.includes("facebook") || hostname.includes("fb.")) return "facebook";
    if (hostname.includes("whatsapp")) return "whatsapp";
    if (hostname.includes("google")) return "google";
    if (hostname.includes("youtube")) return "youtube";
    return hostname || "referral";
  } catch {
    return "referral";
  }
}

function extractPathFromUrl(value: string | undefined) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function extractUtm(value: string | undefined, key: string) {
  if (!value) return "";

  try {
    return new URL(value).searchParams.get(key) || "";
  } catch {
    return "";
  }
}

function sanitizeMetadata(value: Record<string, unknown> | undefined) {
  if (!value) return {};

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 16)
      .map(([key, item]) => [
        sanitizeText(key, 50),
        typeof item === "number" || typeof item === "boolean"
          ? item
          : sanitizeText(String(item ?? ""), 180)
      ])
      .filter(([key]) => key)
  );
}

function incrementBreakdown(target: Map<string, Record<string, number>>, key: string, value: string) {
  const label = value && value !== "Not available" ? value : "";
  if (!label) return;

  const breakdown = target.get(key) || {};
  breakdown[label] = (breakdown[label] || 0) + 1;
  target.set(key, breakdown);
}

function getTopBreakdown(values: Record<string, number> | undefined, fallback: string) {
  const [label] = Object.entries(values || {}).sort(([, a], [, b]) => b - a)[0] || [];
  return label || fallback;
}

function getConversionRate(clicks: number, visits: number) {
  if (!visits) return "0%";
  return `${((clicks / visits) * 100).toFixed(1)}%`;
}

function sanitizePath(value: unknown) {
  const raw = sanitizeText(value, 320);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw.startsWith("/") ? raw : "";
  }
}

function sanitizeUrlText(value: unknown) {
  const raw = sanitizeText(value, 320);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return "";
  }
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeToken(value: unknown, maxLength: number) {
  return sanitizeText(value, maxLength).replace(/[^A-Za-z0-9._:-]/g, "");
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

