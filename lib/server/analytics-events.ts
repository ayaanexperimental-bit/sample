import type { D1Database } from "@cloudflare/workers-types";
import {
  ANALYTICS_EVENT_NAMES,
  type AnalyticsAudienceRegion,
  type AnalyticsDeviceType,
  type AnalyticsDateRangeId,
  type AnalyticsEventName,
  type AnalyticsEventRange,
  type AnalyticsFunnelType,
  type AnalyticsMetricSummary,
  type AnalyticsRecentEvent,
  type AnalyticsTimeSeriesPoint
} from "../analytics-events";
import { getFunnelById } from "../coach-platform";
import { type CoachSiteAnalyticsSummary, normalizeCoachSlug } from "../admin-coach-sites";
import { ensureCoachSiteTables } from "./coach-site-storage";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

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
  page_path: string;
  region: string;
  source: string;
};

type AnalyticsAudienceRow = {
  created_at: number;
  device_type: AnalyticsDeviceType;
  event_name: AnalyticsEventName;
  metadata_json: string;
  region: string;
  source: string;
};

type AnalyticsTimeSeriesRow = {
  created_at: number;
  event_name: AnalyticsEventName;
  source: string;
};

type AnalyticsSummaryOptions = {
  limit?: number;
  rangeEnd?: number;
  rangeStart?: number;
};

type AudienceCoordinates = AnalyticsAudienceRegion["coordinates"];

type AudienceGeo = {
  cityCoordinates: AudienceCoordinates;
  cityLabel: string;
  countryCoordinates: AudienceCoordinates;
  countryLabel: string;
  districtCoordinates: AudienceCoordinates;
  districtLabel: string;
  regionCoordinates: AudienceCoordinates;
  regionLabel: string;
};

type AudienceRegionAccumulator = {
  coordinates: AudienceCoordinates;
  countryLabel: string;
  deviceBreakdown: AnalyticsAudienceRegion["deviceBreakdown"];
  id: string;
  label: string;
  lastActivity: number;
  level: AnalyticsAudienceRegion["level"];
  parentId: string | null;
  paymentSuccess: number;
  registerClicks: number;
  sourceCounts: Record<string, number>;
  visits: number;
};

type TimeSeriesBucket = {
  registerClicks: number;
  sourceCounts: Record<string, number>;
  visits: number;
};

type AnalyticsRangeWindow = {
  id: AnalyticsDateRangeId;
  label: string;
  previousEnd?: number;
  previousStart?: number;
  rangeEnd: number;
  rangeStart?: number;
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
const analyticsEventSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const ANALYTICS_READ_CACHE_TTL_MS = 15 * 1000;
const analyticsSummaryCache = new WeakMap<
  D1Database,
  Map<string, { expiresAt: number; value: AnalyticsMetricSummary[] }>
>();
const recentEventsCache = new WeakMap<
  D1Database,
  Map<string, { expiresAt: number; value: AnalyticsRecentEvent[] }>
>();
const audienceRegionsCache = new WeakMap<
  D1Database,
  Map<string, { expiresAt: number; value: AnalyticsAudienceRegion[] }>
>();
const timeSeriesCache = new WeakMap<
  D1Database,
  Map<string, { expiresAt: number; value: AnalyticsTimeSeriesPoint[] }>
>();

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

  const db = env.ADMIN_DB;
  await runCachedD1SchemaSetup({
    cache: analyticsEventSchemaCache,
    db,
    setup: async () => {
      for (const statement of ANALYTICS_TABLE_SQL) {
        await db.prepare(statement).run();
      }
    }
  });

  return true;
}

export async function recordAnalyticsEvent(
  input: AnalyticsEventInput,
  env: AnalyticsEventStorageEnv
) {
  if (!env.ADMIN_DB || !ANALYTICS_EVENT_NAMES.has(input.eventName)) {
    return { ok: false, persisted: false, reason: "not_configured_or_invalid" };
  }

  await ensureCoachSiteTables(env);
  await ensureAnalyticsEventTables(env);

  const now = Math.floor(Date.now() / 1000);
  const normalizedInputSlug = normalizeCoachSlug(input.coachSlug || "");
  const funnelId = sanitizeToken(input.funnelId, 120);
  const staticFunnel = funnelId ? getFunnelById(funnelId) : null;
  const rowBySlug = normalizedInputSlug
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
  const row =
    rowBySlug ||
    (staticFunnel?.coachId
      ? await env.ADMIN_DB.prepare(
          `SELECT id, coach_id, slug, analytics_json
           FROM coach_sites
           WHERE coach_id = ?1 AND status <> 'removed'
           ORDER BY
             CASE status
               WHEN 'published' THEN 0
               WHEN 'paused' THEN 1
               WHEN 'archived' THEN 2
               ELSE 3
             END,
             updated_at DESC
           LIMIT 1`
        )
          .bind(staticFunnel.coachId)
          .first<{
            analytics_json: string;
            coach_id: string;
            id: string;
            slug: string;
          }>()
      : null);
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
  const requestGeo = getRequestGeo(input.request);
  const region = requestGeo.region || requestGeo.country || "Not available";
  const metadataJson = JSON.stringify(
    sanitizeMetadata({
      ...input.metadata,
      geoCity: requestGeo.city,
      geoCountry: requestGeo.country,
      geoCountryCode: requestGeo.countryCode,
      geoLatitude: requestGeo.latitude,
      geoLongitude: requestGeo.longitude,
      geoRegion: requestGeo.region
    })
  );
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

  clearAnalyticsReadCache(env.ADMIN_DB);

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
  env: AnalyticsEventStorageEnv,
  options: AnalyticsSummaryOptions = {}
): Promise<AnalyticsMetricSummary[]> {
  if (!env.ADMIN_DB) return [];

  await ensureAnalyticsEventTables(env);

  const { limit = 20000, rangeEnd, rangeStart } = options;
  const cacheKey = `summary:${rangeStart || 0}:${rangeEnd || 0}:${limit}`;
  const cached = getAnalyticsCacheValue(analyticsSummaryCache, env.ADMIN_DB, cacheKey);
  if (cached) return cached;
  const where: string[] = [];
  const params: number[] = [];

  if (rangeStart) {
    where.push("created_at >= ?");
    params.push(rangeStart);
  }
  if (rangeEnd) {
    where.push("created_at < ?");
    params.push(rangeEnd);
  }

  const result = await env.ADMIN_DB.prepare(
    `SELECT event_name, funnel_type, coach_slug, coach_id, funnel_id, page_path, device_type, region, source, created_at
     FROM analytics_events
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(...params, limit)
    .all<AnalyticsEventRow>();

  const summaries = summarizeEventRows(result.results || []);
  setAnalyticsCacheValue(analyticsSummaryCache, env.ADMIN_DB, cacheKey, summaries);

  return summaries;
}

export async function getRecentAnalyticsEvents(
  env: AnalyticsEventStorageEnv,
  limit = 12
): Promise<AnalyticsRecentEvent[]> {
  if (!env.ADMIN_DB) return [];

  await ensureAnalyticsEventTables(env);

  const normalizedLimit = Math.max(1, Math.min(40, Math.floor(limit)));
  const cacheKey = `recent:${normalizedLimit}`;
  const cached = getAnalyticsCacheValue(recentEventsCache, env.ADMIN_DB, cacheKey);
  if (cached) return cached;

  const result = await env.ADMIN_DB.prepare(
    `SELECT event_name, funnel_type, coach_slug, coach_id, funnel_id, page_path, device_type, region, source, created_at
     FROM analytics_events
     ORDER BY created_at DESC
     LIMIT ?1`
  )
    .bind(normalizedLimit)
    .all<AnalyticsEventRow>();

  const recentEvents = (result.results || []).map((row) => ({
    coachId: row.coach_id || "",
    coachSlug: row.coach_slug || "",
    createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : "",
    deviceType: row.device_type || "unknown",
    eventName: row.event_name,
    funnelId: row.funnel_id || "",
    funnelType: row.funnel_type,
    pagePath: row.page_path || "",
    region: row.region || "Not available",
    source: row.source || "direct"
  }));
  setAnalyticsCacheValue(recentEventsCache, env.ADMIN_DB, cacheKey, recentEvents);

  return recentEvents;
}

export async function getAnalyticsAudienceRegions(
  env: AnalyticsEventStorageEnv,
  options: AnalyticsSummaryOptions = {}
): Promise<AnalyticsAudienceRegion[]> {
  if (!env.ADMIN_DB) return [];

  await ensureAnalyticsEventTables(env);

  const { limit = 20000, rangeEnd, rangeStart } = options;
  const cacheKey = `audience-regions:${rangeStart || 0}:${rangeEnd || 0}:${limit}`;
  const cached = getAnalyticsCacheValue(audienceRegionsCache, env.ADMIN_DB, cacheKey);
  if (cached) return cached;

  const where: string[] = [];
  const params: number[] = [];

  if (rangeStart) {
    where.push("created_at >= ?");
    params.push(rangeStart);
  }
  if (rangeEnd) {
    where.push("created_at < ?");
    params.push(rangeEnd);
  }

  const result = await env.ADMIN_DB.prepare(
    `SELECT event_name, device_type, region, source, metadata_json, created_at
     FROM analytics_events
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(...params, limit)
    .all<AnalyticsAudienceRow>();

  const regions = summarizeAudienceRegionRows(result.results || []);
  setAnalyticsCacheValue(audienceRegionsCache, env.ADMIN_DB, cacheKey, regions);

  return regions;
}

export async function getAnalyticsTimeSeries(
  env: AnalyticsEventStorageEnv,
  options: Pick<
    AnalyticsRangeWindow,
    "id" | "previousEnd" | "previousStart" | "rangeEnd" | "rangeStart"
  >
): Promise<AnalyticsTimeSeriesPoint[]> {
  if (!env.ADMIN_DB) return [];

  await ensureAnalyticsEventTables(env);

  const rangeEnd = options.rangeEnd;
  const rangeStart = options.rangeStart || rangeEnd - 30 * 86400;
  const duration = Math.max(1, rangeEnd - rangeStart);
  const bucketSize = getAnalyticsTimeSeriesBucketSize(duration);
  const bucketCount = Math.max(2, Math.min(240, Math.ceil(duration / bucketSize)));
  const normalizedRangeEnd = rangeStart + bucketCount * bucketSize;
  const cacheKey = `time-series:${options.id}:${rangeStart}:${rangeEnd}:${options.previousStart || 0}:${options.previousEnd || 0}:${bucketSize}`;
  const cached = getAnalyticsCacheValue(timeSeriesCache, env.ADMIN_DB, cacheKey);
  if (cached) return cached;

  const [currentRows, previousRows] = await Promise.all([
    getAnalyticsTimeSeriesRows(env.ADMIN_DB, rangeStart, normalizedRangeEnd),
    options.previousStart && options.previousEnd
      ? getAnalyticsTimeSeriesRows(env.ADMIN_DB, options.previousStart, options.previousEnd)
      : Promise.resolve([])
  ]);
  const currentBuckets = createEmptyTimeSeriesBuckets(bucketCount);
  const previousBuckets = createEmptyTimeSeriesBuckets(bucketCount);

  applyTimeSeriesRows(currentBuckets, currentRows, rangeStart, bucketSize);
  if (options.previousStart && options.previousEnd) {
    const previousDuration = Math.max(1, options.previousEnd - options.previousStart);
    const previousBucketSize = previousDuration / bucketCount;
    applyTimeSeriesRows(previousBuckets, previousRows, options.previousStart, previousBucketSize);
  }

  const points = currentBuckets.map((bucket, index) => {
    const bucketStart = rangeStart + index * bucketSize;
    const bucketEnd = Math.min(rangeEnd, bucketStart + bucketSize);

    return {
      bucketEnd: new Date(bucketEnd * 1000).toISOString(),
      bucketStart: new Date(bucketStart * 1000).toISOString(),
      currentVisits: bucket.visits,
      previousRangeRegisterClicks: previousBuckets[index]?.registerClicks || 0,
      previousRangeVisits: previousBuckets[index]?.visits || 0,
      registerClicks: bucket.registerClicks,
      source: getTopSourceLabel(bucket.sourceCounts)
    };
  });

  setAnalyticsCacheValue(timeSeriesCache, env.ADMIN_DB, cacheKey, points);

  return points;
}

async function getAnalyticsTimeSeriesRows(
  db: D1Database,
  rangeStart: number,
  rangeEnd: number
): Promise<AnalyticsTimeSeriesRow[]> {
  const result = await db
    .prepare(
      `SELECT event_name, source, created_at
       FROM analytics_events
       WHERE created_at >= ? AND created_at < ?
       ORDER BY created_at ASC
       LIMIT 50000`
    )
    .bind(rangeStart, rangeEnd)
    .all<AnalyticsTimeSeriesRow>();

  return result.results || [];
}

export function getAnalyticsTimeSeriesBucketSize(duration: number) {
  let bucketSize =
    duration <= 6 * 3600
      ? 5 * 60
      : duration <= 2 * 86400
        ? 10 * 60
        : duration <= 8 * 86400
          ? 3600
          : duration <= 32 * 86400
            ? 6 * 3600
            : duration <= 100 * 86400
              ? 86400
              : duration <= 380 * 86400
                ? 3 * 86400
                : 7 * 86400;

  while (Math.ceil(duration / bucketSize) > 220) {
    bucketSize *= 2;
  }

  return bucketSize;
}

function createEmptyTimeSeriesBuckets(count: number): TimeSeriesBucket[] {
  return Array.from({ length: count }, () => ({
    registerClicks: 0,
    sourceCounts: {},
    visits: 0
  }));
}

function applyTimeSeriesRows(
  buckets: TimeSeriesBucket[],
  rows: AnalyticsTimeSeriesRow[],
  rangeStart: number,
  bucketSize: number
) {
  for (const row of rows) {
    const index = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((row.created_at - rangeStart) / bucketSize))
    );
    const bucket = buckets[index];
    if (!bucket) continue;

    if (isVisitEvent(row.event_name)) {
      bucket.visits += 1;
      incrementObjectCount(bucket.sourceCounts, row.source || "direct");
    }

    if (row.event_name === "coach_register_click" || row.event_name === "paid_register_click") {
      bucket.registerClicks += 1;
    }
  }
}

function getTopSourceLabel(values: Record<string, number>) {
  const [label] = Object.entries(values).sort(([, first], [, second]) => second - first)[0] || [];
  return label || "No source";
}

export function getAnalyticsRangeWindow(
  value: unknown,
  customStartValue?: unknown,
  customEndValue?: unknown
): AnalyticsRangeWindow {
  const id = normalizeAnalyticsDateRange(value);
  const now = Math.floor(Date.now() / 1000);
  const todayStart = getUtcDayStart(now);

  if (id === "today") {
    const duration = Math.max(1, now - todayStart);
    return {
      id,
      label: "Today",
      previousEnd: todayStart,
      previousStart: todayStart - duration,
      rangeEnd: now + 1,
      rangeStart: todayStart
    };
  }

  if (id === "all") {
    return {
      id,
      label: "All stored data",
      rangeEnd: now + 1
    };
  }

  if (id === "custom") {
    const customStart = parseDateInputStart(customStartValue);
    const customEnd = parseDateInputEnd(customEndValue);
    if (customStart && customEnd && customEnd > customStart) {
      const duration = customEnd - customStart;
      return {
        id,
        label: `${formatShortDate(customStart)} to ${formatShortDate(customEnd - 1)}`,
        previousEnd: customStart,
        previousStart: customStart - duration,
        rangeEnd: Math.min(customEnd, now + 1),
        rangeStart: customStart
      };
    }

    return {
      id: "7d",
      label: "7 days",
      previousEnd: now - 7 * 86400,
      previousStart: now - 14 * 86400,
      rangeEnd: now + 1,
      rangeStart: now - 7 * 86400
    };
  }

  const days = id === "365d" ? 365 : id === "90d" ? 90 : id === "30d" ? 30 : 7;
  const duration = days * 86400;

  return {
    id,
    label: `${days} days`,
    previousEnd: now - duration,
    previousStart: now - duration * 2,
    rangeEnd: now + 1,
    rangeStart: now - duration
  };
}

export function serializeAnalyticsRange(window: AnalyticsRangeWindow): AnalyticsEventRange {
  return {
    end: new Date(window.rangeEnd * 1000).toISOString(),
    id: window.id,
    label: window.label,
    previousEnd: window.previousEnd ? new Date(window.previousEnd * 1000).toISOString() : null,
    previousStart: window.previousStart
      ? new Date(window.previousStart * 1000).toISOString()
      : null,
    start: window.rangeStart ? new Date(window.rangeStart * 1000).toISOString() : null
  };
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
    `SELECT event_name, funnel_type, coach_slug, coach_id, funnel_id, page_path, device_type, region, source, created_at
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

    if (
      eventTime &&
      (!summary.lastActivity || Date.parse(summary.lastActivity) / 1000 < eventTime)
    ) {
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

function summarizeAudienceRegionRows(rows: AnalyticsAudienceRow[]): AnalyticsAudienceRegion[] {
  const groups = new Map<string, AudienceRegionAccumulator>();

  for (const row of rows) {
    const audienceGeo = getAudienceGeoFromRow(row);
    if (!audienceGeo.countryLabel) continue;

    const countryId = `country:${normalizeRegionKey(audienceGeo.countryLabel)}`;
    const countryGroup = getOrCreateAudienceRegionGroup(groups, {
      coordinates: audienceGeo.countryCoordinates,
      countryLabel: audienceGeo.countryLabel,
      id: countryId,
      label: audienceGeo.countryLabel,
      level: "country",
      parentId: null
    });
    const childGroup =
      audienceGeo.regionLabel && audienceGeo.regionLabel !== audienceGeo.countryLabel
        ? getOrCreateAudienceRegionGroup(groups, {
            coordinates: audienceGeo.regionCoordinates,
            countryLabel: audienceGeo.countryLabel,
            id: `region:${normalizeRegionKey(audienceGeo.countryLabel)}:${normalizeRegionKey(audienceGeo.regionLabel)}`,
            label: audienceGeo.regionLabel,
            level: "region",
            parentId: countryId
          })
        : null;
    const districtGroup =
      childGroup && audienceGeo.districtLabel
        ? getOrCreateAudienceRegionGroup(groups, {
            coordinates: audienceGeo.districtCoordinates,
            countryLabel: audienceGeo.countryLabel,
            id: `district:${normalizeRegionKey(audienceGeo.countryLabel)}:${normalizeRegionKey(childGroup.label)}:${normalizeRegionKey(audienceGeo.districtLabel)}`,
            label: audienceGeo.districtLabel,
            level: "district",
            parentId: childGroup.id
          })
        : null;
    const cityParentGroup = districtGroup || childGroup;
    const cityGroup =
      cityParentGroup && audienceGeo.cityLabel
        ? getOrCreateAudienceRegionGroup(groups, {
            coordinates: audienceGeo.cityCoordinates,
            countryLabel: audienceGeo.countryLabel,
            id: `city:${normalizeRegionKey(audienceGeo.countryLabel)}:${normalizeRegionKey(cityParentGroup.label)}:${normalizeRegionKey(audienceGeo.cityLabel)}`,
            label: audienceGeo.cityLabel,
            level: "city",
            parentId: cityParentGroup.id
          })
        : null;
    const isVisit = isVisitEvent(row.event_name);

    applyAudienceEventToGroup(countryGroup, row, isVisit);
    if (childGroup) applyAudienceEventToGroup(childGroup, row, isVisit);
    if (districtGroup) applyAudienceEventToGroup(districtGroup, row, isVisit);
    if (cityGroup) applyAudienceEventToGroup(cityGroup, row, isVisit);
  }

  const topLevelGroups = Array.from(groups.values()).filter((group) => group.level === "country");
  const totalVisits = topLevelGroups.reduce((total, group) => total + group.visits, 0);
  const byParent = new Map<string, AudienceRegionAccumulator[]>();

  for (const group of groups.values()) {
    if (!group.parentId) continue;
    const siblings = byParent.get(group.parentId) || [];
    siblings.push(group);
    byParent.set(group.parentId, siblings);
  }

  const toRegion = (
    group: AudienceRegionAccumulator,
    siblingTotalVisits: number
  ): AnalyticsAudienceRegion => {
    const share = siblingTotalVisits > 0 ? (group.visits / siblingTotalVisits) * 100 : 0;
    const children = (byParent.get(group.id) || [])
      .filter((child) => child.visits > 0)
      .sort(compareAudienceRegionGroups)
      .slice(0, 18);
    const childrenTotalVisits = children.reduce((total, child) => total + child.visits, 0);

    return {
      children: children.map((child) => toRegion(child, childrenTotalVisits)),
      coordinates: group.coordinates,
      countryLabel: group.countryLabel,
      deviceBreakdown: group.deviceBreakdown,
      id: group.id,
      label: group.label,
      lastActivity: group.lastActivity ? new Date(group.lastActivity * 1000).toISOString() : "",
      level: group.level,
      parentId: group.parentId,
      paymentSuccess: group.paymentSuccess,
      registerClicks: group.registerClicks,
      share: Number(share.toFixed(1)),
      sourceBreakdown: getTopSourceBreakdown(group.sourceCounts, group.visits),
      visits: group.visits
    };
  };

  return topLevelGroups
    .filter((region) => region.visits > 0)
    .sort(compareAudienceRegionGroups)
    .map((group) => toRegion(group, totalVisits))
    .slice(0, 12);
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
  if (
    value === "paid_masterclass" ||
    eventName.startsWith("paid_") ||
    eventName === "payment_initiated" ||
    eventName === "payment_success" ||
    eventName === "success_page_view"
  ) {
    return "paid_masterclass";
  }

  return "free_guest_link";
}

function normalizeAnalyticsDateRange(value: unknown): AnalyticsDateRangeId {
  return value === "today" ||
    value === "30d" ||
    value === "90d" ||
    value === "365d" ||
    value === "all" ||
    value === "custom"
    ? value
    : "7d";
}

function getUtcDayStart(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000);
}

function parseDateInputStart(value: unknown) {
  const raw = sanitizeText(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 0;
  const timestamp = Math.floor(Date.parse(`${raw}T00:00:00.000Z`) / 1000);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function parseDateInputEnd(value: unknown) {
  const raw = sanitizeText(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 0;
  const timestamp = Math.floor(Date.parse(`${raw}T00:00:00.000Z`) / 1000);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp + 86400 : 0;
}

function formatShortDate(timestamp: number) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function getDeviceType(userAgent: string): AnalyticsDeviceType {
  const value = userAgent.toLowerCase();
  if (!value) return "unknown";
  if (/ipad|tablet|playbook|silk/.test(value)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|phone/.test(value)) return "mobile";
  return "desktop";
}

function normalizeAnalyticsDeviceType(value: unknown): AnalyticsDeviceType {
  if (value === "desktop" || value === "mobile" || value === "tablet" || value === "unknown") {
    return value;
  }

  return "unknown";
}

function getRequestGeo(request: Request) {
  const requestWithCf = request as Request & {
    cf?: {
      city?: string;
      country?: string;
      latitude?: string;
      region?: string;
      regionCode?: string;
      longitude?: string;
    };
  };
  const cf = requestWithCf.cf;
  const countryCode = sanitizeText(cf?.country || "", 8).toUpperCase();
  const country = normalizeRegionLabel(countryCode);
  const region = sanitizeText(cf?.region || cf?.regionCode || "", 80);
  const city = sanitizeText(cf?.city || "", 80);
  const latitude = normalizeCoordinate(cf?.latitude, -90, 90);
  const longitude = normalizeCoordinate(cf?.longitude, -180, 180);

  return {
    city,
    country,
    countryCode,
    latitude,
    longitude,
    region: region || country
  };
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
      .slice(0, 28)
      .map(([key, item]) => [
        sanitizeText(key, 50),
        typeof item === "number" || typeof item === "boolean"
          ? item
          : sanitizeText(String(item ?? ""), 180)
      ])
      .filter(([key]) => key)
  );
}

function incrementBreakdown(
  target: Map<string, Record<string, number>>,
  key: string,
  value: string
) {
  const label = value && value !== "Not available" ? value : "";
  if (!label) return;

  const breakdown = target.get(key) || {};
  breakdown[label] = (breakdown[label] || 0) + 1;
  target.set(key, breakdown);
}

function incrementObjectCount(target: Record<string, number>, value: string) {
  const label = sanitizeText(value, 80) || "direct";
  target[label] = (target[label] || 0) + 1;
}

function getTopBreakdown(values: Record<string, number> | undefined, fallback: string) {
  const [label] = Object.entries(values || {}).sort(([, a], [, b]) => b - a)[0] || [];
  return label || fallback;
}

function getTopSourceBreakdown(values: Record<string, number>, totalVisits: number) {
  return Object.entries(values)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([label, visits]) => ({
      label,
      share: totalVisits > 0 ? Number(((visits / totalVisits) * 100).toFixed(1)) : 0,
      visits
    }));
}

function getOrCreateAudienceRegionGroup(
  groups: Map<string, AudienceRegionAccumulator>,
  input: Pick<
    AudienceRegionAccumulator,
    "coordinates" | "countryLabel" | "id" | "label" | "level" | "parentId"
  >
) {
  const existing = groups.get(input.id);
  if (existing) return existing;

  const created: AudienceRegionAccumulator = {
    ...input,
    deviceBreakdown: {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0
    },
    lastActivity: 0,
    paymentSuccess: 0,
    registerClicks: 0,
    sourceCounts: {},
    visits: 0
  };

  groups.set(input.id, created);
  return created;
}

function applyAudienceEventToGroup(
  group: AudienceRegionAccumulator,
  row: AnalyticsAudienceRow,
  isVisit: boolean
) {
  if (isVisit) {
    const deviceType = normalizeAnalyticsDeviceType(row.device_type);
    group.visits += 1;
    group.deviceBreakdown[deviceType] += 1;
    incrementObjectCount(group.sourceCounts, row.source || "direct");
  }
  if (row.event_name === "coach_register_click" || row.event_name === "paid_register_click") {
    group.registerClicks += 1;
  }
  if (row.event_name === "payment_success") group.paymentSuccess += 1;
  if (row.created_at > group.lastActivity) group.lastActivity = row.created_at;
}

function compareAudienceRegionGroups(
  first: Pick<AudienceRegionAccumulator, "label" | "visits">,
  second: Pick<AudienceRegionAccumulator, "label" | "visits">
) {
  if (second.visits !== first.visits) return second.visits - first.visits;
  return first.label.localeCompare(second.label);
}

function getAudienceGeoFromRow(row: AnalyticsAudienceRow): AudienceGeo {
  const metadata = safeJson<Record<string, unknown>>(row.metadata_json || "{}", {});
  const metadataCountry =
    normalizeRegionLabel(readMetadataString(metadata, "geoCountryCode")) ||
    normalizeRegionLabel(readMetadataString(metadata, "geoCountry"));
  const metadataRegion = normalizeRegionLabel(readMetadataString(metadata, "geoRegion"));
  const metadataDistrict =
    normalizeRegionLabel(readMetadataString(metadata, "geoDistrict")) ||
    normalizeRegionLabel(readMetadataString(metadata, "district"));
  const metadataCity = normalizeRegionLabel(readMetadataString(metadata, "geoCity"));
  const legacyRegion = normalizeRegionLabel(row.region);
  const inferredCountry = inferAudienceCountryLabel(metadataRegion || legacyRegion);
  const countryLabel = metadataCountry || inferredCountry || legacyRegion;
  const regionLabel =
    metadataRegion && metadataRegion !== countryLabel
      ? metadataRegion
      : legacyRegion && legacyRegion !== countryLabel && inferAudienceCountryLabel(legacyRegion)
        ? legacyRegion
        : "";
  const latitude = normalizeCoordinate(readMetadataString(metadata, "geoLatitude"), -90, 90);
  const longitude = normalizeCoordinate(readMetadataString(metadata, "geoLongitude"), -180, 180);
  const preciseCoordinates =
    latitude !== null && longitude !== null
      ? ({
          lat: latitude,
          lng: longitude,
          scope: "known"
        } satisfies AudienceCoordinates)
      : null;

  return {
    cityCoordinates:
      preciseCoordinates ||
      getAudienceCoordinates(metadataCity, metadataDistrict || regionLabel || countryLabel),
    cityLabel: metadataCity,
    countryCoordinates: getAudienceCoordinates(countryLabel, ""),
    countryLabel,
    districtCoordinates:
      preciseCoordinates || getAudienceCoordinates(metadataDistrict, regionLabel || countryLabel),
    districtLabel:
      metadataDistrict && metadataDistrict !== regionLabel && metadataDistrict !== countryLabel
        ? metadataDistrict
        : "",
    regionCoordinates:
      preciseCoordinates || getAudienceCoordinates(regionLabel || countryLabel, countryLabel),
    regionLabel
  };
}

function readMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : sanitizeText(value, 120);
}

function normalizeRegionLabel(value: string) {
  const raw = sanitizeText(value, 80);
  if (!raw || raw === "Not available") return "";

  const upper = raw.toUpperCase();
  return COUNTRY_LABELS[upper] || toTitleCase(raw);
}

function normalizeRegionKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const COUNTRY_LABELS: Record<string, string> = {
  AU: "Australia",
  CA: "Canada",
  DE: "Germany",
  GB: "United Kingdom",
  IN: "India",
  NL: "Netherlands",
  SG: "Singapore",
  US: "United States"
};

const AUDIENCE_LOCATION_COORDINATES: Record<
  string,
  { countryLabel: string; lat: number; level: AnalyticsAudienceRegion["level"]; lng: number }
> = {
  australia: { countryLabel: "Australia", lat: -25.2744, level: "country", lng: 133.7751 },
  bangalore: { countryLabel: "India", lat: 12.9716, level: "city", lng: 77.5946 },
  bengaluru: { countryLabel: "India", lat: 12.9716, level: "city", lng: 77.5946 },
  bhubaneswar: { countryLabel: "India", lat: 20.2961, level: "city", lng: 85.8245 },
  canada: { countryLabel: "Canada", lat: 56.1304, level: "country", lng: -106.3468 },
  delhi: { countryLabel: "India", lat: 28.7041, level: "region", lng: 77.1025 },
  germany: { countryLabel: "Germany", lat: 51.1657, level: "country", lng: 10.4515 },
  india: { countryLabel: "India", lat: 20.5937, level: "country", lng: 78.9629 },
  karnataka: { countryLabel: "India", lat: 15.3173, level: "region", lng: 75.7139 },
  maharashtra: { countryLabel: "India", lat: 19.7515, level: "region", lng: 75.7139 },
  mumbai: { countryLabel: "India", lat: 19.076, level: "city", lng: 72.8777 },
  netherlands: { countryLabel: "Netherlands", lat: 52.1326, level: "country", lng: 5.2913 },
  odisha: { countryLabel: "India", lat: 20.9517, level: "region", lng: 85.0985 },
  orissa: { countryLabel: "India", lat: 20.9517, level: "region", lng: 85.0985 },
  pune: { countryLabel: "India", lat: 18.5204, level: "city", lng: 73.8567 },
  singapore: { countryLabel: "Singapore", lat: 1.3521, level: "country", lng: 103.8198 },
  "united-kingdom": { countryLabel: "United Kingdom", lat: 55.3781, level: "country", lng: -3.436 },
  "united-states": { countryLabel: "United States", lat: 37.0902, level: "country", lng: -95.7129 }
};

function inferAudienceCountryLabel(label: string) {
  const key = normalizeRegionKey(label);
  return AUDIENCE_LOCATION_COORDINATES[key]?.countryLabel || "";
}

function getAudienceCoordinates(label: string, parentLabel: string): AudienceCoordinates {
  const key = normalizeRegionKey(label);
  const known = AUDIENCE_LOCATION_COORDINATES[key];
  if (known) {
    return {
      lat: known.lat,
      lng: known.lng,
      scope: "known"
    };
  }

  const parent = AUDIENCE_LOCATION_COORDINATES[normalizeRegionKey(parentLabel)];
  const hash = Array.from(`${parentLabel}:${label}`).reduce(
    (total, char) => total + char.charCodeAt(0),
    0
  );

  return {
    lat: (parent?.lat || 20) + ((hash % 120) - 60) / 12,
    lng: (parent?.lng || 20) + (((hash * 7) % 120) - 60) / 12,
    scope: "estimated"
  };
}

function normalizeCoordinate(value: unknown, min: number, max: number) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(sanitizeText(value, 32));
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getConversionRate(clicks: number, visits: number) {
  if (!visits) return "0%";
  return `${((clicks / visits) * 100).toFixed(1)}%`;
}

function getAnalyticsCacheValue<T>(
  cache: WeakMap<D1Database, Map<string, { expiresAt: number; value: T }>>,
  db: D1Database,
  key: string
) {
  const entry = cache.get(db)?.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;

  return entry.value;
}

function setAnalyticsCacheValue<T>(
  cache: WeakMap<D1Database, Map<string, { expiresAt: number; value: T }>>,
  db: D1Database,
  key: string,
  value: T
) {
  const dbCache = cache.get(db) || new Map<string, { expiresAt: number; value: T }>();
  dbCache.set(key, {
    expiresAt: Date.now() + ANALYTICS_READ_CACHE_TTL_MS,
    value
  });
  cache.set(db, dbCache);
}

function clearAnalyticsReadCache(db: D1Database) {
  analyticsSummaryCache.delete(db);
  recentEventsCache.delete(db);
  audienceRegionsCache.delete(db);
  timeSeriesCache.delete(db);
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
