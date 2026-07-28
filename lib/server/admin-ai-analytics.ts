import type { D1Database } from "@cloudflare/workers-types";
import { buildAdminAIContentBoundary } from "../admin-ai/adminAIContentTrust";
import { createStableAiHash, getCachedAiResult, setCachedAiResult } from "./ai-cache-service";
import { getAiModelConfig, type AiModelConfigEnv } from "./ai-model-config";
import { estimateAiTokens, type AiUsageEstimate } from "./ai-token-estimator";

export type AdminAiAnalyticsEnv = AiModelConfigEnv & {
  ADMIN_DB?: D1Database;
  AI_ANALYTICS_REQUEST_TIMEOUT_MS?: string;
  OPENAI_API_KEY?: string;
};

export type AdminAiAnalyticsScope = "coach" | "overview";

export type AdminAiAnalyticsInsight = {
  dataHash: string;
  generatedAt: string;
  keyTrends: string[];
  model: string;
  predictions: string[];
  recommendations: string[];
  summary: string;
  warnings: string[];
};

export type AdminAiAnalyticsFailure = {
  attempts: number;
  code:
    | "invalid_provider_response"
    | "provider_rate_limited"
    | "provider_rejected_request"
    | "provider_timeout"
    | "provider_unavailable"
    | "request_limit"
    | "usage_limit_unavailable";
  retryAfterSeconds?: number;
  retryable: boolean;
};

export type AdminAiAnalyticsResult =
  | {
      cache: "hit" | "miss";
      configured: true;
      insight: AdminAiAnalyticsInsight;
      ok: true;
      usageEstimate: AiUsageEstimate;
    }
  | {
      configured: false;
      message: "AI analytics is not configured yet.";
      ok: false;
    }
  | {
      configured: true;
      failure: AdminAiAnalyticsFailure;
      message: "AI analytics generation failed.";
      ok: false;
    };

type AdminAiAnalyticsInput = {
  dateRange: string;
  forceRefresh?: boolean;
  payload: unknown;
  scope: AdminAiAnalyticsScope;
};

type AiAnalyticsCacheRow = {
  insight_json: string;
};

type OpenAiResponse = {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
};

const AI_ANALYTICS_CACHE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ai_analytics_cache (
    id TEXT PRIMARY KEY,
    cache_key TEXT NOT NULL UNIQUE,
    scope TEXT NOT NULL,
    date_range TEXT NOT NULL,
    data_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    insight_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_analytics_cache_scope_updated
    ON ai_analytics_cache (scope, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_analytics_cache_hash
    ON ai_analytics_cache (data_hash, model)`
];

const PROVIDER_MAX_ATTEMPTS = 2;
const PROVIDER_TIMEOUT_DEFAULT_MS = 12_000;
const PROVIDER_TIMEOUT_MAX_MS = 30_000;
const PROVIDER_TIMEOUT_MIN_MS = 25;
const MAX_AGGREGATE_COUNT = 99_999_999;
const USAGE_LIMIT_MAX_REQUESTS = 12;
const USAGE_LIMIT_WINDOW_SECONDS = 60;
const usageLimitSchemaReady = new WeakSet<D1Database>();

const AI_ANALYTICS_USAGE_SCHEMA = `CREATE TABLE IF NOT EXISTS ai_analytics_usage_limits (
  identity_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

const AI_ANALYTICS_SCHEMA = {
  name: "admin_analytics_insight",
  schema: {
    additionalProperties: false,
    properties: {
      keyTrends: {
        items: { type: "string" },
        maxItems: 4,
        type: "array"
      },
      predictions: {
        items: { type: "string" },
        maxItems: 3,
        type: "array"
      },
      recommendations: {
        items: { type: "string" },
        maxItems: 4,
        type: "array"
      },
      summary: { type: "string" },
      warnings: {
        items: { type: "string" },
        maxItems: 3,
        type: "array"
      }
    },
    required: ["summary", "keyTrends", "recommendations", "predictions", "warnings"],
    type: "object"
  },
  strict: true,
  type: "json_schema"
};

export function validateAdminAiAnalyticsPayload(value: unknown, scope: AdminAiAnalyticsScope) {
  if (!isRecord(value)) return false;
  const payload =
    scope === "overview"
      ? createOverviewAnalyticsPayload(value)
      : createCoachAnalyticsPayload(value);
  return Object.keys(payload).length > 0;
}

export async function generateAdminAiAnalyticsInsight(
  input: AdminAiAnalyticsInput,
  env: AdminAiAnalyticsEnv
): Promise<AdminAiAnalyticsResult> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      message: "AI analytics is not configured yet.",
      ok: false
    };
  }

  const config = getAiModelConfig(env);
  const dateRange = normalizeDateRange(input.dateRange);
  const compactPayload = createCompactPayload(input.payload, input.scope, config.maxInputTokens);
  const dataHash = createStableAiHash(
    JSON.stringify({
      dateRange,
      payload: compactPayload,
      scope: input.scope
    })
  );
  const cacheKey = createStableAiHash(
    JSON.stringify({
      dataHash,
      dateRange,
      model: config.analyticsModel,
      scope: input.scope
    })
  );
  const prompt = createAnalyticsPrompt({
    dateRange,
    payload: compactPayload,
    scope: input.scope
  });
  const maxOutputTokens = Math.min(config.maxOutputTokens, 700);
  const usageEstimate = estimateAiTokens(prompt, maxOutputTokens);

  if (config.cachingEnabled && !input.forceRefresh) {
    const cached =
      getCachedAiResult<AdminAiAnalyticsInsight>(cacheKey) ||
      (await getCachedInsightFromD1(env, cacheKey));

    if (cached) {
      setCachedAiResult(cacheKey, cached);
      return {
        cache: "hit",
        configured: true,
        insight: cached,
        ok: true,
        usageEstimate
      };
    }
  }

  const providerResult = await requestAnalyticsProvider({
    apiKey,
    body: JSON.stringify({
      input: prompt,
      instructions:
        "You are an admin analytics assistant for Yours Wellness/YW Nutritech. Analyze only compact aggregate data. Do not request or reveal secrets, OTPs, payment IDs, private WhatsApp links, personal user data, raw logs, or technical internals. Use cautious language such as likely trend and suggested action. Do not invent data.",
      max_output_tokens: maxOutputTokens,
      model: config.analyticsModel,
      reasoning: {
        effort: "minimal"
      },
      store: false,
      text: {
        format: AI_ANALYTICS_SCHEMA
      }
    }),
    timeoutMs: parseBoundedInteger(
      env.AI_ANALYTICS_REQUEST_TIMEOUT_MS,
      PROVIDER_TIMEOUT_DEFAULT_MS,
      PROVIDER_TIMEOUT_MIN_MS,
      PROVIDER_TIMEOUT_MAX_MS
    )
  });
  if (!providerResult.ok) return providerFailure(providerResult.failure);

  try {
    const payload = JSON.parse(providerResult.body) as OpenAiResponse;
    const parsed = parseInsight(extractResponseText(payload));
    if (!parsed) {
      return providerFailure({
        attempts: providerResult.attempts,
        code: "invalid_provider_response",
        retryable: false
      });
    }

    const insight: AdminAiAnalyticsInsight = {
      dataHash,
      generatedAt: new Date().toISOString(),
      keyTrends: parsed.keyTrends,
      model: config.analyticsModel,
      predictions: parsed.predictions,
      recommendations: parsed.recommendations,
      summary: parsed.summary,
      warnings: parsed.warnings
    };

    if (config.cachingEnabled) {
      setCachedAiResult(cacheKey, insight);
      await setCachedInsightInD1(env, {
        cacheKey,
        dataHash,
        dateRange,
        insight,
        model: config.analyticsModel,
        scope: input.scope
      });
    }

    return {
      cache: "miss",
      configured: true,
      insight,
      ok: true,
      usageEstimate
    };
  } catch {
    return providerFailure({
      attempts: providerResult.attempts,
      code: "invalid_provider_response",
      retryable: false
    });
  }
}

export async function consumeAdminAiAnalyticsUsage(
  identity: string,
  env: AdminAiAnalyticsEnv,
  now = Math.floor(Date.now() / 1000)
) {
  const db = env.ADMIN_DB;
  if (!db) {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfterSeconds: USAGE_LIMIT_WINDOW_SECONDS
    };
  }

  try {
    if (!usageLimitSchemaReady.has(db)) {
      await db.prepare(AI_ANALYTICS_USAGE_SCHEMA).run();
      usageLimitSchemaReady.add(db);
    }
    const identityHash = createStableAiHash(identity.trim().toLowerCase() || "unknown-admin");
    const resetAt = now + USAGE_LIMIT_WINDOW_SECONDS;
    const consumed = await db
      .prepare(
        `INSERT INTO ai_analytics_usage_limits (
          identity_hash, request_count, reset_at, updated_at
        ) VALUES (?1, 1, ?2, ?3)
        ON CONFLICT(identity_hash) DO UPDATE SET
          request_count = CASE
            WHEN reset_at <= ?3 THEN 1
            ELSE request_count + 1
          END,
          reset_at = CASE
            WHEN reset_at <= ?3 THEN ?2
            ELSE reset_at
          END,
          updated_at = ?3
        WHERE reset_at <= ?3 OR request_count < ?4
        RETURNING request_count, reset_at`
      )
      .bind(identityHash, resetAt, now, USAGE_LIMIT_MAX_REQUESTS)
      .first<{ request_count: number; reset_at: number }>();

    return consumed
      ? { allowed: true as const }
      : {
          allowed: false as const,
          reason: "limit" as const,
          retryAfterSeconds: USAGE_LIMIT_WINDOW_SECONDS
        };
  } catch {
    return {
      allowed: false as const,
      reason: "unavailable" as const,
      retryAfterSeconds: USAGE_LIMIT_WINDOW_SECONDS
    };
  }
}

async function requestAnalyticsProvider({
  apiKey,
  body,
  timeoutMs
}: {
  apiKey: string;
  body: string;
  timeoutMs: number;
}): Promise<
  { attempts: number; body: string; ok: true } | { failure: AdminAiAnalyticsFailure; ok: false }
> {
  for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
    let responseReceived = false;
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        body,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs)
      });
      responseReceived = true;
      if (response.ok) return { attempts: attempt, body: await response.text(), ok: true };
      const failure = classifyProviderResponse(response, attempt);
      if (attempt < PROVIDER_MAX_ATTEMPTS && shouldRetryProviderStatus(response.status)) {
        continue;
      }
      return { failure, ok: false };
    } catch (error) {
      if (isTimeoutError(error)) {
        return {
          failure: {
            attempts: attempt,
            code: "provider_timeout",
            retryable: true
          },
          ok: false
        };
      }
      if (responseReceived) {
        if (attempt < PROVIDER_MAX_ATTEMPTS) continue;
        return {
          failure: {
            attempts: attempt,
            code: "provider_unavailable",
            retryable: true
          },
          ok: false
        };
      }
      if (attempt < PROVIDER_MAX_ATTEMPTS) continue;
      return {
        failure: {
          attempts: attempt,
          code: "provider_unavailable",
          retryable: true
        },
        ok: false
      };
    }
  }

  return {
    failure: {
      attempts: PROVIDER_MAX_ATTEMPTS,
      code: "provider_unavailable",
      retryable: true
    },
    ok: false
  };
}

function classifyProviderResponse(response: Response, attempts: number): AdminAiAnalyticsFailure {
  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
    return {
      attempts,
      code: "provider_rate_limited",
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
      retryable: true
    };
  }
  if (shouldRetryProviderStatus(response.status)) {
    return { attempts, code: "provider_unavailable", retryable: true };
  }
  return { attempts, code: "provider_rejected_request", retryable: false };
}

function providerFailure(failure: AdminAiAnalyticsFailure): AdminAiAnalyticsResult {
  return {
    configured: true,
    failure,
    message: "AI analytics generation failed.",
    ok: false
  };
}

function shouldRetryProviderStatus(status: number) {
  return status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isTimeoutError(error: unknown) {
  return isRecord(error) && (error.name === "AbortError" || error.name === "TimeoutError");
}

function parseRetryAfter(value: string | null) {
  const seconds = Number.parseInt(value || "", 10);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : null;
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

async function ensureAiAnalyticsCacheSchema(env: AdminAiAnalyticsEnv) {
  if (!env.ADMIN_DB) return false;

  for (const statement of AI_ANALYTICS_CACHE_SCHEMA) {
    await env.ADMIN_DB.prepare(statement).run();
  }

  return true;
}

async function getCachedInsightFromD1(env: AdminAiAnalyticsEnv, cacheKey: string) {
  if (!env.ADMIN_DB) return null;

  try {
    await ensureAiAnalyticsCacheSchema(env);
    const row = await env.ADMIN_DB.prepare(
      `SELECT insight_json
       FROM ai_analytics_cache
       WHERE cache_key = ?1
       LIMIT 1`
    )
      .bind(cacheKey)
      .first<AiAnalyticsCacheRow>();

    return row?.insight_json ? parseCachedInsight(row.insight_json) : null;
  } catch {
    return null;
  }
}

async function setCachedInsightInD1(
  { ADMIN_DB }: AdminAiAnalyticsEnv,
  {
    cacheKey,
    dataHash,
    dateRange,
    insight,
    model,
    scope
  }: {
    cacheKey: string;
    dataHash: string;
    dateRange: string;
    insight: AdminAiAnalyticsInsight;
    model: string;
    scope: AdminAiAnalyticsScope;
  }
) {
  if (!ADMIN_DB) return;

  try {
    await ensureAiAnalyticsCacheSchema({ ADMIN_DB });
    const now = Math.floor(Date.now() / 1000);
    await ADMIN_DB.prepare(
      `INSERT INTO ai_analytics_cache (
        id, cache_key, scope, date_range, data_hash, model, insight_json, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
      ON CONFLICT(cache_key) DO UPDATE SET
        insight_json = excluded.insight_json,
        updated_at = excluded.updated_at`
    )
      .bind(
        `ai-analytics-${crypto.randomUUID()}`,
        cacheKey,
        scope,
        sanitizeText(dateRange, 80),
        dataHash,
        sanitizeText(model, 80),
        JSON.stringify(insight),
        now
      )
      .run();
  } catch {
    // Cache failures should not block admin insights.
  }
}

function createCompactPayload(
  value: unknown,
  scope: AdminAiAnalyticsScope,
  maxInputTokens: number
) {
  const cleaned =
    scope === "overview"
      ? createOverviewAnalyticsPayload(value)
      : createCoachAnalyticsPayload(value);
  const maxCharacters = Math.max(1800, Math.min(maxInputTokens * 4, 18000));
  const json = JSON.stringify(cleaned);

  if (json.length <= maxCharacters) return cleaned;

  return { truncated: true };
}

function createOverviewAnalyticsPayload(value: unknown) {
  const input = asRecord(value);
  const systemIssues = asRecord(input.systemIssues);
  const portfolio = asRecord(input.portfolio);
  const riskQueue = asArray(input.riskQueue);

  return compactRecord({
    activeFunnelsBand: aggregateCountBand(input.activeFunnels),
    funnelSplit: sanitizeFunnelSplit(input.funnelSplit),
    healthAlertCountBand: arrayCountBand(input.healthAlerts),
    lowPerformingCoachCountBand: arrayCountBand(input.lowPerformingCoaches),
    portfolio: compactRecord({
      ...countBandRecord(portfolio, [
        "coachCount",
        "highRiskCount",
        "totalRegisterClicks",
        "totalVisits"
      ]),
      paymentHealthPercent: percentageNumber(portfolio.paymentHealth),
      performanceScorePercent: percentageNumber(portfolio.performanceScore)
    }),
    portfolioVisitDeltaPercent: signedPercentageNumber(portfolio.visitDeltaLabel),
    recentActivityCountBand: arrayCountBand(input.recentActivity),
    recentEventCountBand: arrayCountBand(input.recentEvents),
    riskQueue: Array.isArray(input.riskQueue) ? summarizeRiskQueue(riskQueue) : {},
    systemIssues: countBandRecord(systemIssues, ["unresolvedCount"]),
    topCoachMetrics: asArray(input.topCoaches)
      .slice(0, 5)
      .map((item) => {
        const row = asRecord(item);
        return compactRecord({
          clicksBand: aggregateCountBand(row.clicks),
          conversionRatePercent: percentageNumber(row.conversionRate),
          visitsBand: aggregateCountBand(row.visits)
        });
      })
      .filter((row) => Object.keys(row).length > 0),
    totals: countBandRecord(asRecord(input.totals), ["registerClicks", "visits", "whatsappClicks"]),
    trendBars: sanitizeTrendBars(input.trendBars)
  });
}

function createCoachAnalyticsPayload(value: unknown) {
  const input = asRecord(value);
  const coach = asRecord(input.coach);
  const risk = asRecord(coach.risk);
  const combined = asRecord(input.combined);
  const freeFunnel = asRecord(input.freeFunnel);
  const paidFunnel = asRecord(input.paidFunnel);

  return compactRecord({
    activeTab: enumValue(input.activeTab, ["combined", "free", "paid"]),
    coachMetrics: compactRecord({
      clicksBand: aggregateCountBand(coach.clicks),
      ctrPercent: percentageNumber(coach.ctr),
      hasPaidFunnel: booleanValue(coach.hasPaidFunnel),
      lastActivityRecency: activityRecency(coach.lastActivity),
      risk: compactRecord({
        priority: enumValue(risk.priority, ["critical", "good", "high", "medium"]),
        scorePercent: percentageNumber(risk.score)
      }),
      status: enumValue(coach.status, ["archived", "draft", "paused", "published", "removed"]),
      visitsBand: aggregateCountBand(coach.visits)
    }),
    combined: compactRecord({
      clicksBand: aggregateCountBand(combined.clicks),
      conversionRatePercent: percentageNumber(combined.conversionRate),
      lastActivityRecency: activityRecency(combined.lastActivity),
      visitsBand: aggregateCountBand(combined.visits)
    }),
    deviceBreakdown: countBandRecord(asRecord(input.deviceBreakdown), [
      "desktop",
      "mobile",
      "tablet"
    ]),
    freeFunnel: compactRecord({
      ...countBandRecord(freeFunnel, ["registerClicks", "videoPlays", "visits", "whatsappClicks"]),
      googleFormStatus: enumValue(freeFunnel.googleFormStatus, ["configured", "missing"]),
      supportStatus: enumValue(freeFunnel.supportStatus, [
        "coach-specific contact available",
        "fallback support used"
      ])
    }),
    lowActivityReasonCountBand: arrayCountBand(input.lowActivityReasons),
    paidFunnel: countBandRecord(paidFunnel, [
      "paymentButtonClicks",
      "paymentInitiated",
      "paymentSuccess",
      "paymentToSuccessDropOff",
      "registerClicks",
      "successPageViews",
      "visits",
      "whatsappClicks"
    ])
  });
}

function createAnalyticsPrompt({
  dateRange,
  payload,
  scope
}: {
  dateRange: string;
  payload: unknown;
  scope: AdminAiAnalyticsScope;
}) {
  const boundary = buildAdminAIContentBoundary({
    content: JSON.stringify(payload),
    source: "form-submission"
  });
  return [
    `Scope: ${scope === "overview" ? "Main Overview AI Insights" : "Per-Coach AI Insights"}`,
    `Date range: ${normalizeDateRange(dateRange)}`,
    "Use only this compact aggregate JSON. If data is insufficient, say so clearly.",
    "Return concise admin-facing insights only. No markdown tables.",
    "Required tone: practical, honest, cautious, executive, health-tech operations focused.",
    "Do not mention raw logs, secrets, private links, payment IDs, OTPs, or personal user data.",
    `Content trust: ${boundary.trust}; source: ${boundary.source}; action authority: ${boundary.actionAuthority}.`,
    boundary.instruction,
    boundary.content
  ].join("\n");
}

function extractResponseText(payload: OpenAiResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .join("")
      .trim() || ""
  );
}

function parseCachedInsight(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isAdminAiAnalyticsInsight(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseInsight(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isInsightPayload(parsed)) return null;

    return {
      keyTrends: normalizeStringList(parsed.keyTrends, 4),
      predictions: normalizeStringList(parsed.predictions, 3),
      recommendations: normalizeStringList(parsed.recommendations, 4),
      summary: sanitizeText(parsed.summary, 520),
      warnings: normalizeStringList(parsed.warnings, 3)
    };
  } catch {
    return null;
  }
}

function isInsightPayload(value: unknown): value is {
  keyTrends: string[];
  predictions: string[];
  recommendations: string[];
  summary: string;
  warnings: string[];
} {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    Array.isArray(value.keyTrends) &&
    Array.isArray(value.recommendations) &&
    Array.isArray(value.predictions) &&
    Array.isArray(value.warnings)
  );
}

function isAdminAiAnalyticsInsight(value: unknown): value is AdminAiAnalyticsInsight {
  if (!isRecord(value) || !isInsightPayload(value)) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.dataHash === "string" &&
    typeof record.generatedAt === "string" &&
    typeof record.model === "string"
  );
}

function normalizeStringList(value: unknown[], maxItems: number) {
  return value
    .map((item) => sanitizeText(item, 260))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeFunnelSplit(value: unknown) {
  const labels = ["Both", "Free only", "No funnel", "Paid only"] as const;
  return asArray(value)
    .slice(0, labels.length)
    .map((item) => {
      const row = asRecord(item);
      return compactRecord({
        label: enumValue(row.label, labels),
        percent: percentageNumber(row.percent),
        valueBand: aggregateCountBand(row.value)
      });
    })
    .filter((row) => typeof row.label === "string" && Object.keys(row).length > 1);
}

function sanitizeTrendBars(value: unknown) {
  const labels = [
    "Previous clicks",
    "Previous visits",
    "Register clicks",
    "Selected clicks",
    "Selected visits",
    "WhatsApp clicks"
  ] as const;
  return asArray(value)
    .slice(0, labels.length)
    .map((item) => {
      const row = asRecord(item);
      return compactRecord({
        label: enumValue(row.label, labels),
        valueBand: aggregateCountBand(row.value)
      });
    })
    .filter((row) => Object.keys(row).length === 2);
}

function summarizeRiskQueue(items: unknown[]) {
  const priorities = ["critical", "good", "high", "medium"] as const;
  const counts = Object.fromEntries(priorities.map((priority) => [priority, 0])) as Record<
    (typeof priorities)[number],
    number
  >;
  items.slice(0, 20).forEach((item) => {
    const priority = enumValue(asRecord(item).priority, priorities);
    if (priority) counts[priority] += 1;
  });

  return compactRecord({
    countBand: aggregateCountBand(items.length),
    priorityCounts: compactRecord(
      Object.fromEntries(
        Object.entries(counts).map(([priority, count]) => [
          `${priority}Band`,
          count > 0 ? aggregateCountBand(count) : undefined
        ])
      )
    )
  });
}

function countBandRecord(input: Record<string, unknown>, keys: readonly string[]) {
  return compactRecord(
    Object.fromEntries(keys.map((key) => [`${key}Band`, aggregateCountBand(input[key])]))
  );
}

function compactRecord(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return !isRecord(value) || Object.keys(value).length > 0;
    })
  );
}

function aggregateCountBand(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_AGGREGATE_COUNT
  ) {
    return undefined;
  }
  if (value === 0) return "0";
  if (value < 10) return "1-9";
  if (value < 100) return "10-99";
  if (value < 1_000) return "100-999";
  if (value < 10_000) return "1k-9.9k";
  if (value < 100_000) return "10k-99.9k";
  if (value < 1_000_000) return "100k-999.9k";
  if (value < 10_000_000) return "1m-9.9m";
  return "10m-99.9m";
}

function percentageNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
  }
  if (typeof value !== "string" || !/^\d{1,3}(?:\.\d+)?%?$/.test(value.trim())) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : undefined;
}

function signedPercentageNumber(value: unknown) {
  if (typeof value !== "string" || !/^[+-]?\d{1,3}(?:\.\d+)?%$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(-100, Math.min(100, parsed)) : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function enumValue<const T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function activityRecency(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  const ageDays = (Date.now() - timestamp) / 86_400_000;
  if (ageDays < 0) return "future-date";
  if (ageDays <= 1) return "last-24-hours";
  if (ageDays <= 7) return "1-7-days";
  if (ageDays <= 30) return "8-30-days";
  if (ageDays <= 90) return "31-90-days";
  return "older-than-90-days";
}

function arrayCountBand(value: unknown) {
  return Array.isArray(value) ? aggregateCountBand(value.length) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeDateRange(value: unknown) {
  const normalized = sanitizeText(value, 80);
  const known = new Map([
    ["today", "Today"],
    ["7 days", "7 days"],
    ["30 days", "30 days"],
    ["90 days", "90 days"],
    ["1 year", "1 year"],
    ["365 days", "365 days"],
    ["all stored", "All stored"],
    ["all stored data", "All stored data"],
    ["current week", "Current week"],
    ["current month", "Current month"],
    ["selected period", "Selected period"]
  ]);
  const fixed = known.get(normalized.toLowerCase());
  if (fixed) return fixed;
  if (/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return "Selected period";
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
