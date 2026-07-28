import type { D1Database } from "@cloudflare/workers-types";
import type { CoachSiteContent } from "../admin-coach-sites";
import { buildAdminAIContentBoundary } from "../admin-ai/adminAIContentTrust";
import { universalCoachBonuses } from "../coach-canonical-template";
import { aiRegeneratableCoachTemplateContentFields } from "../coach-template-content-slots";
import { getCachedAiResult, setCachedAiResult, createStableAiHash } from "./ai-cache-service";
import { compressAiContext } from "./ai-context-compressor";
import { getAiModelConfig, type AiModelConfigEnv } from "./ai-model-config";
import { estimateAiTokens, type AiUsageEstimate } from "./ai-token-estimator";

export type CoachCopyAiEnv = AiModelConfigEnv & {
  ADMIN_DB?: D1Database;
  AI_COPY_REQUEST_TIMEOUT_MS?: string;
  OPENAI_API_KEY?: string;
};

export type CoachCopyScope =
  | "all"
  | "benefits"
  | "cta"
  | "faq"
  | "footer"
  | "hero"
  | "intro"
  | "journey"
  | "media"
  | "problem"
  | "vision";

export type CoachCopyAiInput = {
  bio?: string;
  coachName: string;
  existingPaidFunnelUrl?: string;
  hasGoogleFormUrl?: boolean;
  hasSupportContact?: boolean;
  heroMediaType?: "image" | "none" | "video";
  location?: string;
  niche: string;
  paidFunnelContext?: string;
  registerButtonText?: string;
  scope?: CoachCopyScope;
  supportText?: string;
  vision?: string;
};

export type GeneratedCoachSiteCopy = Partial<CoachSiteContent>;

const FIXED_BONUS_SERVICE_TITLES = universalCoachBonuses.map((bonus) => bonus.baseTitle);

export type CoachCopyAiFailure = {
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

export type CoachCopyAiResult =
  | {
      cache: "hit" | "miss";
      configured: true;
      content: GeneratedCoachSiteCopy;
      ok: true;
      usageEstimate: AiUsageEstimate;
    }
  | {
      configured: false;
      message: "AI generation not configured yet.";
      ok: false;
    }
  | {
      configured: true;
      failure: CoachCopyAiFailure;
      message: "AI copy generation failed.";
      ok: false;
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

const AI_COPY_SCHEMA = {
  name: "coach_site_copy",
  schema: {
    additionalProperties: false,
    properties: {
      benefitDescriptions: {
        items: {
          type: "string"
        },
        maxItems: 5,
        minItems: 3,
        type: "array"
      },
      benefits: {
        items: {
          type: "string"
        },
        maxItems: 5,
        minItems: 3,
        type: "array"
      },
      benefitsHeading: {
        type: "string"
      },
      brandBadge: {
        type: "string"
      },
      brandEyebrow: {
        type: "string"
      },
      coachIntro: {
        type: "string"
      },
      coachIntroLabel: {
        type: "string"
      },
      ctaText: {
        type: "string"
      },
      ctaSectionLabel: {
        type: "string"
      },
      faqHeading: {
        type: "string"
      },
      faqSectionLabel: {
        type: "string"
      },
      faq: {
        items: {
          additionalProperties: false,
          properties: {
            answer: {
              type: "string"
            },
            question: {
              type: "string"
            }
          },
          required: ["question", "answer"],
          type: "object"
        },
        maxItems: 8,
        minItems: 5,
        type: "array"
      },
      footerHeadline: {
        type: "string"
      },
      footerBrandLine: {
        type: "string"
      },
      footerText: {
        type: "string"
      },
      heroHeadline: {
        type: "string"
      },
      heroMediaLabel: {
        type: "string"
      },
      heroMicroTrustText: {
        type: "string"
      },
      heroTrustLine: {
        type: "string"
      },
      introHeading: {
        type: "string"
      },
      introSectionLabel: {
        type: "string"
      },
      journeyHeading: {
        type: "string"
      },
      journeySectionLabel: {
        type: "string"
      },
      journeySteps: {
        items: {
          additionalProperties: false,
          properties: {
            description: {
              type: "string"
            },
            label: {
              type: "string"
            },
            title: {
              type: "string"
            }
          },
          required: ["label", "title", "description"],
          type: "object"
        },
        maxItems: 4,
        minItems: 3,
        type: "array"
      },
      mediaBody: {
        type: "string"
      },
      mediaHeading: {
        type: "string"
      },
      mediaModuleLabel: {
        type: "string"
      },
      mediaSubheading: {
        type: "string"
      },
      problemHeading: {
        type: "string"
      },
      problemSectionLabel: {
        type: "string"
      },
      problemPoints: {
        items: {
          type: "string"
        },
        maxItems: 5,
        minItems: 3,
        type: "array"
      },
      socialCopy: {
        type: "string"
      },
      stickyCtaContactButton: {
        type: "string"
      },
      stickyCtaContext: {
        type: "string"
      },
      stickyCtaHeading: {
        type: "string"
      },
      stickyCtaLabel: {
        type: "string"
      },
      benefitsSectionLabel: {
        type: "string"
      },
      subheadline: {
        type: "string"
      },
      supportEmailLabel: {
        type: "string"
      },
      supportHeading: {
        type: "string"
      },
      supportPhoneLabel: {
        type: "string"
      },
      supportPrimaryButton: {
        type: "string"
      },
      supportPrivacyNote: {
        type: "string"
      },
      supportWhatsappButton: {
        type: "string"
      },
      supportWhatsappLabel: {
        type: "string"
      },
      trustText: {
        type: "string"
      },
      visionLabel: {
        type: "string"
      },
      visionText: {
        type: "string"
      }
    },
    required: aiRegeneratableCoachTemplateContentFields,
    type: "object"
  },
  strict: true,
  type: "json_schema"
};

const AI_COPY_SCHEMA_PROPERTIES = AI_COPY_SCHEMA.schema.properties;

const COPY_SCOPE_FIELDS: Record<CoachCopyScope, Array<keyof CoachSiteContent>> = {
  all: aiRegeneratableCoachTemplateContentFields,
  benefits: ["benefitsSectionLabel", "benefitsHeading", "benefitDescriptions"],
  cta: [
    "ctaSectionLabel",
    "ctaText",
    "trustText",
    "socialCopy",
    "stickyCtaContactButton",
    "stickyCtaContext",
    "stickyCtaHeading",
    "stickyCtaLabel",
    "supportEmailLabel",
    "supportHeading",
    "supportPhoneLabel",
    "supportPrimaryButton",
    "supportWhatsappButton",
    "supportWhatsappLabel"
  ],
  faq: ["faqSectionLabel", "faqHeading", "faq"],
  footer: ["footerHeadline"],
  hero: [
    "brandBadge",
    "brandEyebrow",
    "heroHeadline",
    "subheadline",
    "heroMediaLabel",
    "heroTrustLine",
    "heroMicroTrustText",
    "socialCopy"
  ],
  intro: ["introSectionLabel", "introHeading", "coachIntroLabel", "coachIntro"],
  journey: ["journeySectionLabel", "journeyHeading", "journeySteps"],
  media: ["mediaSubheading", "mediaModuleLabel", "mediaHeading", "mediaBody"],
  problem: ["problemSectionLabel", "problemHeading", "problemPoints", "trustText"],
  vision: ["visionLabel", "visionText"]
};

export function getCoachCopyScopeFields(scope: CoachCopyScope) {
  return [...COPY_SCOPE_FIELDS[scope]];
}

const COPY_SCOPE_MAX_OUTPUT_TOKENS: Record<CoachCopyScope, number> = {
  all: 3200,
  benefits: 450,
  cta: 720,
  faq: 650,
  footer: 420,
  hero: 360,
  intro: 300,
  journey: 520,
  media: 360,
  problem: 460,
  vision: 300
};

const LARGE_INPUT_CHARACTER_THRESHOLD = 8_000;
const LARGE_INPUT_TOKEN_THRESHOLD = 4_000;
const PROVIDER_MAX_ATTEMPTS = 2;
const PROVIDER_TIMEOUT_DEFAULT_MS = 12_000;
const PROVIDER_TIMEOUT_MAX_MS = 30_000;
const PROVIDER_TIMEOUT_MIN_MS = 25;
const USAGE_LIMIT_MAX_REQUESTS = 12;
const USAGE_LIMIT_WINDOW_SECONDS = 60;
const usageLimitSchemaReady = new WeakSet<D1Database>();

const AI_COACH_COPY_USAGE_SCHEMA = `CREATE TABLE IF NOT EXISTS ai_coach_copy_usage_limits (
  identity_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`;

export function getCoachCopyRequestPreflight(input: CoachCopyAiInput, env: CoachCopyAiEnv) {
  const prepared = prepareCoachCopyRequest(input, env);
  return {
    confirmationRequired:
      countNormalizedSourceCharacters(input) >= LARGE_INPUT_CHARACTER_THRESHOLD ||
      prepared.usageEstimate.estimatedInputTokens >= LARGE_INPUT_TOKEN_THRESHOLD,
    usageEstimate: prepared.usageEstimate
  };
}

export async function consumeCoachCopyUsage(
  identity: string,
  env: CoachCopyAiEnv,
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
      await db.prepare(AI_COACH_COPY_USAGE_SCHEMA).run();
      usageLimitSchemaReady.add(db);
    }
    const identityHash = createStableAiHash(identity.trim().toLowerCase() || "unknown-admin");
    const resetAt = now + USAGE_LIMIT_WINDOW_SECONDS;
    const consumed = await db
      .prepare(
        `INSERT INTO ai_coach_copy_usage_limits (
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

export async function generateCoachSiteCopyWithAi(
  input: CoachCopyAiInput,
  env: CoachCopyAiEnv
): Promise<CoachCopyAiResult> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      message: "AI generation not configured yet.",
      ok: false
    };
  }

  const { config, maxOutputTokens, normalizedInput, prompt, scope, usageEstimate } =
    prepareCoachCopyRequest(input, env);
  const cacheKey = createStableAiHash(
    JSON.stringify({
      model: config.copyModel,
      prompt,
      scope
    })
  );
  const cached = config.cachingEnabled ? getCachedAiResult<GeneratedCoachSiteCopy>(cacheKey) : null;

  if (cached) {
    return {
      cache: "hit",
      configured: true,
      content: cached,
      ok: true,
      usageEstimate
    };
  }

  const providerResult = await requestCoachCopyProvider({
    apiKey,
    body: JSON.stringify({
      input: prompt,
      instructions:
        "Generate only editable website copy for the single canonical YW Nutritech Circle coach page. Do not propose design changes, backend logic, database schema, security settings, payment changes, or third-party automation. Keep copy practical, ethical, and education-first.",
      max_output_tokens: maxOutputTokens,
      model: config.copyModel,
      reasoning: {
        effort: "minimal"
      },
      store: false,
      text: {
        format: createCopySchemaForScope(scope)
      }
    }),
    timeoutMs: parseBoundedInteger(
      env.AI_COPY_REQUEST_TIMEOUT_MS,
      PROVIDER_TIMEOUT_DEFAULT_MS,
      PROVIDER_TIMEOUT_MIN_MS,
      PROVIDER_TIMEOUT_MAX_MS
    )
  });
  if (!providerResult.ok) return providerFailure(providerResult.failure);

  try {
    const payload = JSON.parse(providerResult.body) as OpenAiResponse;
    const content = parseCoachCopy(extractResponseText(payload), scope, normalizedInput);
    if (!content) {
      return providerFailure({
        attempts: providerResult.attempts,
        code: "invalid_provider_response",
        retryable: false
      });
    }

    if (config.cachingEnabled) setCachedAiResult(cacheKey, content);

    return {
      cache: "miss",
      configured: true,
      content,
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

function prepareCoachCopyRequest(input: CoachCopyAiInput, env: CoachCopyAiEnv) {
  const scope = normalizeCopyScope(input.scope);
  const config = getAiModelConfig(env);
  const normalizedInput = normalizeAiInput(input, config.maxInputTokens);
  const prompt = createCoachCopyPrompt(normalizedInput, scope);
  const maxOutputTokens = Math.min(COPY_SCOPE_MAX_OUTPUT_TOKENS[scope], config.maxOutputTokens);

  return {
    config,
    maxOutputTokens,
    normalizedInput,
    prompt,
    scope,
    usageEstimate: estimateAiTokens(prompt, maxOutputTokens)
  };
}

async function requestCoachCopyProvider({
  apiKey,
  body,
  timeoutMs
}: {
  apiKey: string;
  body: string;
  timeoutMs: number;
}): Promise<
  { attempts: number; body: string; ok: true } | { failure: CoachCopyAiFailure; ok: false }
> {
  for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt += 1) {
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
      if (response.ok) return { attempts: attempt, body: await response.text(), ok: true };

      const failure = classifyProviderResponse(response, attempt);
      if (attempt < PROVIDER_MAX_ATTEMPTS && shouldRetryProviderStatus(response.status)) continue;
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

function classifyProviderResponse(response: Response, attempts: number): CoachCopyAiFailure {
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

function providerFailure(failure: CoachCopyAiFailure): CoachCopyAiResult {
  return {
    configured: true,
    failure,
    message: "AI copy generation failed.",
    ok: false
  };
}

function shouldRetryProviderStatus(status: number) {
  return status === 408 || (status >= 500 && status <= 599);
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

function countNormalizedSourceCharacters(input: CoachCopyAiInput) {
  return [
    sanitizeAiField(input.coachName, 160),
    sanitizeAiField(input.niche, 160),
    sanitizeAiField(input.location, 160),
    sanitizeAiField(input.bio, 1200),
    sanitizeAiField(input.vision, 1200),
    sanitizeAiField(input.existingPaidFunnelUrl, 1200),
    sanitizeAiField(input.paidFunnelContext, 7000),
    sanitizeAiField(input.registerButtonText, 80),
    sanitizeAiField(input.supportText, 400)
  ].reduce((total, value) => total + value.length, 0);
}

function normalizeAiInput(input: CoachCopyAiInput, maxInputTokens: number): CoachCopyAiInput {
  const compressedPaidFunnel = compressAiContext(input.paidFunnelContext || "", maxInputTokens);

  return {
    ...input,
    bio: sanitizeAiField(input.bio, 1200),
    coachName: sanitizeAiField(input.coachName, 160),
    existingPaidFunnelUrl: sanitizeAiField(input.existingPaidFunnelUrl, 1200),
    location: sanitizeAiField(input.location, 160),
    niche: sanitizeAiField(input.niche, 160),
    paidFunnelContext: compressedPaidFunnel.compactText,
    registerButtonText: sanitizeAiField(input.registerButtonText, 80),
    supportText: sanitizeAiField(input.supportText, 400),
    vision: sanitizeAiField(input.vision, 1200)
  };
}

function sanitizeAiField(value: string | undefined, maxLength: number) {
  return (value || "")
    .replace(/\b(?:token|secret|otp|password|authorization|cookie)\s*[:=]\s*\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function createCopySchemaForScope(scope: CoachCopyScope) {
  const fields = COPY_SCOPE_FIELDS[scope];
  const properties = Object.fromEntries(
    fields.map((field) => [field, AI_COPY_SCHEMA_PROPERTIES[field]])
  );

  return {
    name: `coach_site_copy_${scope}`,
    schema: {
      additionalProperties: false,
      properties,
      required: fields,
      type: "object"
    },
    strict: true,
    type: "json_schema"
  };
}

function createCoachCopyPrompt(input: CoachCopyAiInput, scope: CoachCopyScope) {
  const coachProfile = createUntrustedContentBlock("COACH PROFILE", "coach-copy", {
    bio: input.bio || "Not provided",
    coachName: input.coachName,
    location: input.location || "Not provided",
    niche: input.niche,
    vision: input.vision || "Not provided"
  });
  const adminForm = createUntrustedContentBlock("ADMIN FORM", "form-submission", {
    hasGoogleFormUrl: input.hasGoogleFormUrl === true,
    hasSupportContact: input.hasSupportContact === true,
    heroMediaType: input.heroMediaType || "none",
    registerButtonText: input.registerButtonText || "Register Now",
    supportText: input.supportText || "Not provided"
  });
  const externalPage = createUntrustedContentBlock("EXTERNAL PAGE", "external-page", {
    existingPaidFunnelUrl: input.existingPaidFunnelUrl || "Not provided",
    paidFunnelContext: input.paidFunnelContext || "Not provided"
  });

  return [
    "Create copy for the single canonical Yours Wellness fixed-template coach referral page.",
    `Requested generation scope: ${getPromptScopeLabel(scope)}.`,
    coachProfile,
    adminForm,
    externalPage,
    "The public page leads to a Google Form register button when configured. Do not claim form submissions are tracked.",
    "Do not generate or alter Google Form URLs. Each coach site uses its own admin/shop-provided registration link.",
    "Do not generate or alter support contact details, public slugs, analytics behavior, payment/security logic, legal link destinations, or YW Nutritech branding placement.",
    "Universal section copy rule: structure is fixed, copy must adapt to the coach niche, bio, audience, location/language, media, page goal, CTA destination, and safety rules.",
    "Do not hardcode or reuse these stale phrases: FREE LIVE MASTERCLASS EXCLUSIVELY FOR WOMEN, LIMITED SEATS AVAILABLE, 2-HOUR MASTERCLASS, Masterclass Details, Only for Women, The Coaching Blueprint, This masterclass is free, Is this masterclass right for you, They used this blueprint, Real women, transformation isn't optional, without quitting, profitable coaching business, spots left, secure your seat.",
    "Do not use women-only, hormone, PMOS, PCOS, diabetes, gut, sleep, fat-loss, or fitness wording unless the current coach niche/bio/context clearly supports that niche.",
    "Top strip, mini eyebrow, hero title, hero support copy, detail heading/subline, trust section, problem section, process section, proof section, fit-check section, final CTA, and FAQ must each be coach-aware and niche-aware.",
    "The detail panel must not force date, time, duration, or language cards unless that data is true and relevant. Prefer focus area, support type, next step, location, format, or language when available.",
    "FAQ requirements: generate at least 5 meaningful FAQs with non-empty answers. Each answer must be safe, clear, useful, and at least one full sentence. Include medical-safety clarification without promising diagnosis, treatment, cures, or prescriptions.",
    "The canonical nicheAdaptiveBonusSection always contains exactly these fixed service titles in this order: Life-Long Health Calculators, Lifetime Support Sessions, Lifestyle Success Toolkit.",
    "Only benefitsSectionLabel, benefitsHeading, benefitDescriptions, and helper/framing copy may adapt to the coach niche. Never rename, hide, reorder, or replace the three fixed service titles.",
    "Do not use the benefits field to create bonus titles. If the schema requires benefits, keep those entries aligned with the exact fixed service titles above.",
    "Bonus descriptions may adapt by niche, but must fall back to neutral wellness copy when the niche is unclear. Do not leak diabetes wording into PCOS, gut, sleep, fitness, fat-loss, or general wellness coaches unless the coach niche supports it.",
    "Universal bonus service identity, actual value, legal disclaimer, CTA destination, public route, analytics, payment logic, and YW Nutritech branding are locked template rules. Do not invent new bonus assets, fake values, fake scarcity, countdowns, or spots-left claims.",
    "If paid funnel page context is provided, adapt it into a free guest/referral page. Do not copy paid funnel text word-for-word.",
    "Do not invent coach credentials, medical claims, contact details, or outcomes that are not supported by admin fields or extracted page context.",
    "Do not publish coach phone, email, WhatsApp, or contact-support instructions in normal page copy.",
    "Tone: professional, supportive, clear, practical, and not medical-diagnosis oriented.",
    "Use YW Nutritech brand language lightly. Keep it premium, wellness-tech, practical, and coach-specific.",
    "Every visible text slot must be specific to the coach, niche, location, and available context. Avoid generic placeholder-like copy.",
    "Keep legal/safety language education-first. Do not promise cures, guaranteed results, diagnosis, treatment, or disease reversal.",
    scope === "all"
      ? `Generate the complete content object for these AI-regeneratable template fields: ${COPY_SCOPE_FIELDS.all.join(", ")}.`
      : "Generate only the requested section fields in the schema. Do not include unrelated fields.",
    "Return structured copy only in the requested JSON schema."
  ].join("\n");
}

function createUntrustedContentBlock(
  label: "ADMIN FORM" | "COACH PROFILE" | "EXTERNAL PAGE",
  source: "coach-copy" | "external-page" | "form-submission",
  content: Record<string, unknown>
) {
  const boundary = buildAdminAIContentBoundary({ content: JSON.stringify(content), source });

  return [
    `BEGIN UNTRUSTED ${label}`,
    `source: ${boundary.source}`,
    `trust: ${boundary.trust}`,
    `action authority: ${boundary.actionAuthority}`,
    boundary.instruction,
    `payload: ${boundary.content}`,
    `END UNTRUSTED ${label}`
  ].join("\n");
}

function getPromptScopeLabel(scope: CoachCopyScope) {
  if (scope === "benefits") return "niche-adaptive bonus section presentation only";
  if (scope === "cta") return "CTA and trust section only";
  if (scope === "faq") return "FAQ section only";
  if (scope === "footer") return "footer section only";
  if (scope === "hero") return "hero headline and subheadline only";
  if (scope === "intro") return "coach introduction section only";
  if (scope === "journey") return "journey section only";
  if (scope === "media") return "media section only";
  if (scope === "problem") return "problem-to-solution section only";
  if (scope === "vision") return "mission/vision section only";
  return "all sections";
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

function parseCoachCopy(
  value: string,
  scope: CoachCopyScope,
  input: CoachCopyAiInput
): GeneratedCoachSiteCopy | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isCoachGeneratedCopy(parsed, scope)) return null;
    if (!hasUsableCoachGeneratedCopy(parsed, scope, input)) return null;

    return normalizeGeneratedCoachCopy(parsed);
  } catch {
    return null;
  }
}

function normalizeGeneratedCoachCopy(value: GeneratedCoachSiteCopy): GeneratedCoachSiteCopy {
  if (!Array.isArray(value.benefits)) return value;

  return {
    ...value,
    benefits: FIXED_BONUS_SERVICE_TITLES
  };
}

function isCoachGeneratedCopy(
  value: unknown,
  scope: CoachCopyScope
): value is GeneratedCoachSiteCopy {
  if (!isRecord(value)) return false;

  return COPY_SCOPE_FIELDS[scope].every((field) => {
    const fieldValue = value[field];

    if (field === "benefits") {
      return Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === "string");
    }

    if (field === "benefitDescriptions" || field === "problemPoints") {
      return Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === "string");
    }

    if (field === "faq") {
      return (
        Array.isArray(fieldValue) &&
        fieldValue.every(
          (item) =>
            isRecord(item) && typeof item.question === "string" && typeof item.answer === "string"
        )
      );
    }

    if (field === "journeySteps") {
      return (
        Array.isArray(fieldValue) &&
        fieldValue.every(
          (item) =>
            isRecord(item) &&
            typeof item.description === "string" &&
            typeof item.label === "string" &&
            typeof item.title === "string"
        )
      );
    }

    return typeof fieldValue === "string";
  });
}

function hasUsableCoachGeneratedCopy(
  value: GeneratedCoachSiteCopy,
  scope: CoachCopyScope,
  input: CoachCopyAiInput
) {
  return COPY_SCOPE_FIELDS[scope].every((field) => {
    const fieldValue = value[field];

    if (field === "benefits" || field === "benefitDescriptions" || field === "problemPoints") {
      const items = fieldValue as string[] | undefined;

      return (
        Array.isArray(items) &&
        items.length > 0 &&
        items.every((item) => isUsableCopyText(item, input))
      );
    }

    if (field === "faq") {
      const items = fieldValue as GeneratedCoachSiteCopy["faq"];

      return (
        Array.isArray(items) &&
        items.length > 0 &&
        items.every(
          (item) => isUsableCopyText(item.question, input) && isUsableCopyText(item.answer, input)
        )
      );
    }

    if (field === "journeySteps") {
      const items = fieldValue as GeneratedCoachSiteCopy["journeySteps"];

      return (
        Array.isArray(items) &&
        items.length > 0 &&
        items.every(
          (item) =>
            isUsableCopyText(item.label, input) &&
            isUsableCopyText(item.title, input) &&
            isUsableCopyText(item.description, input)
        )
      );
    }

    return typeof fieldValue === "string" && isUsableCopyText(fieldValue, input);
  });
}

function isUsableCopyText(value: string, input: CoachCopyAiInput) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3) return false;
  if (isForbiddenGeneratedCopy(normalized)) return false;
  if (hasUnsupportedNicheLeakage(normalized, input)) return false;

  return !/\b(coach name|wellness niche|template media|placeholder|lorem ipsum|insert here|registration link pending)\b/i.test(
    normalized
  );
}

function isForbiddenGeneratedCopy(value: string) {
  if (
    /\b(free live masterclass|limited seats?|2[-\s]?hour masterclass|only for women|women only|exclusively for women|the coaching blueprint|this masterclass is free|masterclass right for you|real women|they used this blueprint|complete blueprint|nothing held back|transformation isn't optional|without quitting|coaching business|profitable coaching|spots? left|secure your seat)\b/i.test(
      value
    )
  ) {
    return true;
  }

  if (/\bmasterclass\b/i.test(value) && !/\bguest session|support session|registration session\b/i.test(value)) {
    return true;
  }

  return /\b(guaranteed\s+(?:result|results|outcome|outcomes|reversal|transformation)|stop\s+(?:medicine|medicines|medication)|replace\s+(?:your\s+)?doctor|cure\s+(?:your|diabetes|pcos|pcod|pmos|condition|disease))\b/i.test(
    value
  );
}

function hasUnsupportedNicheLeakage(value: string, input: CoachCopyAiInput) {
  const context = [input.niche, input.bio, input.vision, input.paidFunnelContext]
    .join(" ")
    .toLowerCase();
  const nicheGuards: Array<{ pattern: RegExp; support: RegExp }> = [
    {
      pattern: /\b(women|woman|female|pcos|pcod|pmos|hormone|hormonal)\b/i,
      support: /\b(women|woman|female|pcos|pcod|pmos|hormone|hormonal)\b/i
    },
    {
      pattern: /\b(diabetes|diabetic|blood sugar|glucose|insulin|metabolic)\b/i,
      support: /\b(diabetes|diabetic|blood sugar|glucose|insulin|metabolic)\b/i
    },
    {
      pattern: /\b(gut|digestion|digestive|bloating|acidity)\b/i,
      support: /\b(gut|digestion|digestive|bloating|acidity)\b/i
    },
    {
      pattern: /\b(sleep|insomnia|recovery|rest)\b/i,
      support: /\b(sleep|insomnia|recovery|rest)\b/i
    },
    {
      pattern: /\b(fat loss|weight loss|weight-management|weight management|slimming)\b/i,
      support: /\b(fat loss|weight loss|weight-management|weight management|slimming)\b/i
    },
    {
      pattern: /\b(fitness|strength|workout|training|movement)\b/i,
      support: /\b(fitness|strength|workout|training|movement)\b/i
    }
  ];

  return nicheGuards.some((guard) => guard.pattern.test(value) && !guard.support.test(context));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCopyScope(value: unknown): CoachCopyScope {
  return value === "benefits" ||
    value === "cta" ||
    value === "faq" ||
    value === "footer" ||
    value === "hero" ||
    value === "intro" ||
    value === "journey" ||
    value === "media" ||
    value === "problem" ||
    value === "vision"
    ? value
    : "all";
}
