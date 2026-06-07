import type { CoachSiteContent } from "../admin-coach-sites";
import { requiredCoachTemplateContentFields } from "../coach-template-content-slots";
import { getCachedAiResult, setCachedAiResult, createStableAiHash } from "./ai-cache-service";
import { compressAiContext } from "./ai-context-compressor";
import { getAiModelConfig, type AiModelConfigEnv } from "./ai-model-config";
import { estimateAiTokens, type AiUsageEstimate } from "./ai-token-estimator";

export type CoachCopyAiEnv = AiModelConfigEnv & {
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
        maxItems: 5,
        minItems: 2,
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
      benefitsSectionLabel: {
        type: "string"
      },
      subheadline: {
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
    required: requiredCoachTemplateContentFields,
    type: "object"
  },
  strict: true,
  type: "json_schema"
};

const AI_COPY_SCHEMA_PROPERTIES = AI_COPY_SCHEMA.schema.properties;

const COPY_SCOPE_FIELDS: Record<CoachCopyScope, Array<keyof CoachSiteContent>> = {
  all: requiredCoachTemplateContentFields,
  benefits: ["benefitsSectionLabel", "benefitsHeading", "benefits", "benefitDescriptions"],
  cta: ["ctaSectionLabel", "ctaText", "trustText", "socialCopy"],
  faq: ["faqSectionLabel", "faqHeading", "faq"],
  footer: ["footerBrandLine", "footerHeadline", "footerText"],
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

const COPY_SCOPE_MAX_OUTPUT_TOKENS: Record<CoachCopyScope, number> = {
  all: 3200,
  benefits: 450,
  cta: 320,
  faq: 650,
  footer: 320,
  hero: 360,
  intro: 300,
  journey: 520,
  media: 360,
  problem: 460,
  vision: 300
};

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

  const scope = normalizeCopyScope(input.scope);
  const config = getAiModelConfig(env);
  const normalizedInput = normalizeAiInput(input, config.maxInputTokens);
  const prompt = createCoachCopyPrompt(normalizedInput, scope);
  const maxOutputTokens = Math.min(COPY_SCOPE_MAX_OUTPUT_TOKENS[scope], config.maxOutputTokens);
  const usageEstimate = estimateAiTokens(prompt, maxOutputTokens);
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

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: prompt,
        instructions:
          "Generate only editable website copy for a fixed coach referral page. Do not propose design changes, backend logic, database schema, security settings, payment changes, or third-party automation. Keep copy practical, ethical, and education-first.",
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
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      method: "POST"
    });

    if (!response.ok) {
      return {
        configured: true,
        message: "AI copy generation failed.",
        ok: false
      };
    }

    const payload = (await response.json()) as OpenAiResponse;
    const content = parseCoachCopy(extractResponseText(payload), scope);
    if (!content) {
      return {
        configured: true,
        message: "AI copy generation failed.",
        ok: false
      };
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
    return {
      configured: true,
      message: "AI copy generation failed.",
      ok: false
    };
  }
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
  return [
    "Create copy for a Yours Wellness fixed-template coach referral page.",
    `Requested generation scope: ${getPromptScopeLabel(scope)}.`,
    `Coach name: ${input.coachName}`,
    `Coach niche: ${input.niche}`,
    `Coach location: ${input.location || "Not provided"}`,
    `Coach short bio: ${input.bio || "Not provided"}`,
    `Coach vision/mission: ${input.vision || "Not provided"}`,
    input.existingPaidFunnelUrl
      ? `Existing paid funnel page URL analyzed by admin: ${input.existingPaidFunnelUrl}`
      : "Existing paid funnel page URL: Not provided",
    input.paidFunnelContext
      ? `Clean visible context extracted from the existing paid funnel page:\n${input.paidFunnelContext.slice(0, 7000)}`
      : "Extracted paid funnel page context: Not provided",
    `Hero media type selected: ${input.heroMediaType || "none"}`,
    `Registration link configured: ${input.hasGoogleFormUrl ? "yes" : "no"}`,
    `Preferred register button text: ${input.registerButtonText || "Register Now"}`,
    `Hidden fallback support text configured: ${input.supportText ? "yes" : "no"}`,
    `Hidden fallback support contact configured: ${input.hasSupportContact ? "yes" : "no"}`,
    "The public page leads to a Google Form register button when configured. Do not claim form submissions are tracked.",
    "If paid funnel page context is provided, adapt it into a free guest/referral page. Do not copy paid funnel text word-for-word.",
    "Do not invent coach credentials, medical claims, contact details, or outcomes that are not supported by admin fields or extracted page context.",
    "Do not publish coach phone, email, WhatsApp, or contact-support instructions in normal page copy.",
    "Tone: professional, supportive, clear, practical, and not medical-diagnosis oriented.",
    "Use YW Nutritech brand language lightly. Keep it premium, wellness-tech, practical, and coach-specific.",
    "Every visible text slot must be specific to the coach, niche, location, and available context. Avoid generic placeholder-like copy.",
    "Keep legal/safety language education-first. Do not promise cures, guaranteed results, diagnosis, treatment, or disease reversal.",
    scope === "all"
      ? `Generate the complete content object for these visible template fields: ${requiredCoachTemplateContentFields.join(", ")}.`
      : "Generate only the requested section fields in the schema. Do not include unrelated fields.",
    "Return structured copy only in the requested JSON schema."
  ].join("\n");
}

function getPromptScopeLabel(scope: CoachCopyScope) {
  if (scope === "benefits") return "benefits section only";
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

function parseCoachCopy(value: string, scope: CoachCopyScope): GeneratedCoachSiteCopy | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isCoachGeneratedCopy(parsed, scope)) return null;
    if (!hasUsableCoachGeneratedCopy(parsed, scope)) return null;

    return parsed;
  } catch {
    return null;
  }
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

function hasUsableCoachGeneratedCopy(value: GeneratedCoachSiteCopy, scope: CoachCopyScope) {
  return COPY_SCOPE_FIELDS[scope].every((field) => {
    const fieldValue = value[field];

    if (field === "benefits" || field === "benefitDescriptions" || field === "problemPoints") {
      const items = fieldValue as string[] | undefined;

      return (
        Array.isArray(items) &&
        items.length > 0 &&
        items.every((item) => isUsableCopyText(item))
      );
    }

    if (field === "faq") {
      const items = fieldValue as GeneratedCoachSiteCopy["faq"];

      return (
        Array.isArray(items) &&
        items.length > 0 &&
        items.every(
          (item) => isUsableCopyText(item.question) && isUsableCopyText(item.answer)
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
            isUsableCopyText(item.label) &&
            isUsableCopyText(item.title) &&
            isUsableCopyText(item.description)
        )
      );
    }

    return typeof fieldValue === "string" && isUsableCopyText(fieldValue);
  });
}

function isUsableCopyText(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3) return false;

  return !/\b(coach name|wellness niche|template media|placeholder|lorem ipsum|insert here|registration link pending)\b/i.test(
    normalized
  );
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
