import type { D1Database } from "@cloudflare/workers-types";
import { createStableAiHash, getCachedAiResult, setCachedAiResult } from "./ai-cache-service";
import { getAiModelConfig, type AiModelConfigEnv } from "./ai-model-config";
import { estimateAiTokens, type AiUsageEstimate } from "./ai-token-estimator";

export type AdminAiAnalyticsEnv = AiModelConfigEnv & {
  ADMIN_DB?: D1Database;
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
  const compactPayload = createCompactPayload(input.payload, config.maxInputTokens);
  const dataHash = createStableAiHash(
    JSON.stringify({
      dateRange: input.dateRange,
      payload: compactPayload,
      scope: input.scope
    })
  );
  const cacheKey = createStableAiHash(
    JSON.stringify({
      dataHash,
      dateRange: input.dateRange,
      model: config.analyticsModel,
      scope: input.scope
    })
  );
  const prompt = createAnalyticsPrompt({
    dateRange: input.dateRange,
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

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return {
        configured: true,
        message: "AI analytics generation failed.",
        ok: false
      };
    }

    const payload = (await response.json()) as OpenAiResponse;
    const parsed = parseInsight(extractResponseText(payload));
    if (!parsed) {
      return {
        configured: true,
        message: "AI analytics generation failed.",
        ok: false
      };
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
        dateRange: input.dateRange,
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
    return {
      configured: true,
      message: "AI analytics generation failed.",
      ok: false
    };
  }
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

async function setCachedInsightInD1({
  ADMIN_DB
}: AdminAiAnalyticsEnv, {
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
}) {
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

function createCompactPayload(value: unknown, maxInputTokens: number) {
  const cleaned = cleanAnalyticsData(value);
  const maxCharacters = Math.max(1800, Math.min(maxInputTokens * 4, 18000));
  const json = JSON.stringify(cleaned);

  if (json.length <= maxCharacters) return cleaned;

  return {
    truncated: true,
    value: json.slice(0, maxCharacters)
  };
}

function cleanAnalyticsData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => cleanAnalyticsData(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveKey(key))
        .slice(0, 40)
        .map(([key, item]) => [sanitizeText(key, 60), cleanAnalyticsData(item)])
        .filter(([key]) => key)
    );
  }

  if (typeof value === "string") {
    return sanitizeText(value, 260);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "boolean") return value;

  return "";
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
  return [
    `Scope: ${scope === "overview" ? "Main Overview AI Insights" : "Per-Coach AI Insights"}`,
    `Date range: ${sanitizeText(dateRange, 80) || "Selected period"}`,
    "Use only this compact aggregate JSON. If data is insufficient, say so clearly.",
    "Return concise admin-facing insights only. No markdown tables.",
    "Required tone: practical, honest, cautious, executive, health-tech operations focused.",
    "Do not mention raw logs, secrets, private links, payment IDs, OTPs, or personal user data.",
    JSON.stringify(payload)
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

function isSensitiveKey(key: string) {
  return /secret|token|otp|password|authorization|cookie|private|joinUrl|paymentId|orderId/i.test(
    key
  );
}

function sanitizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
