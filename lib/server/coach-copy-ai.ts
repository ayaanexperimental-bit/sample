import type { CoachSiteContent } from "../admin-coach-sites";

export type CoachCopyAiEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type CoachCopyScope = "all" | "benefits" | "cta" | "faq" | "hero" | "intro" | "vision";

export type CoachCopyAiInput = {
  bio?: string;
  coachName: string;
  hasGoogleFormUrl?: boolean;
  hasSupportContact?: boolean;
  heroMediaType?: "image" | "none" | "video";
  location?: string;
  niche: string;
  registerButtonText?: string;
  scope?: CoachCopyScope;
  supportText?: string;
  vision?: string;
};

export type GeneratedCoachSiteCopy = Partial<CoachSiteContent>;

export type CoachCopyAiResult =
  | {
      configured: true;
      content: GeneratedCoachSiteCopy;
      ok: true;
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
      benefits: {
        items: {
          type: "string"
        },
        maxItems: 5,
        minItems: 3,
        type: "array"
      },
      coachIntro: {
        type: "string"
      },
      ctaText: {
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
      heroHeadline: {
        type: "string"
      },
      socialCopy: {
        type: "string"
      },
      subheadline: {
        type: "string"
      },
      trustText: {
        type: "string"
      },
      visionText: {
        type: "string"
      }
    },
    required: [
      "heroHeadline",
      "subheadline",
      "coachIntro",
      "visionText",
      "benefits",
      "ctaText",
      "faq",
      "trustText",
      "socialCopy"
    ],
    type: "object"
  },
  strict: true,
  type: "json_schema"
};

const AI_COPY_SCHEMA_PROPERTIES = AI_COPY_SCHEMA.schema.properties;

const COPY_SCOPE_FIELDS: Record<CoachCopyScope, Array<keyof CoachSiteContent>> = {
  all: [
    "heroHeadline",
    "subheadline",
    "coachIntro",
    "visionText",
    "benefits",
    "ctaText",
    "faq",
    "trustText",
    "socialCopy"
  ],
  benefits: ["benefits"],
  cta: ["ctaText", "trustText"],
  faq: ["faq"],
  hero: ["heroHeadline", "subheadline", "socialCopy"],
  intro: ["coachIntro"],
  vision: ["visionText"]
};

const COPY_SCOPE_MAX_OUTPUT_TOKENS: Record<CoachCopyScope, number> = {
  all: 1200,
  benefits: 450,
  cta: 320,
  faq: 650,
  hero: 360,
  intro: 300,
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

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: createCoachCopyPrompt(input, scope),
        instructions:
          "Generate only editable website copy for a fixed coach referral page. Do not propose design changes, backend logic, database schema, security settings, payment changes, or third-party automation. Keep copy practical, ethical, and education-first.",
        max_output_tokens: COPY_SCOPE_MAX_OUTPUT_TOKENS[scope],
        model: env.OPENAI_MODEL || "gpt-5-mini",
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

    return {
      configured: true,
      content,
      ok: true
    };
  } catch {
    return {
      configured: true,
      message: "AI copy generation failed.",
      ok: false
    };
  }
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
    `Hero media type selected: ${input.heroMediaType || "none"}`,
    `Registration link configured: ${input.hasGoogleFormUrl ? "yes" : "no"}`,
    `Preferred register button text: ${input.registerButtonText || "Register Now"}`,
    `Hidden fallback support text configured: ${input.supportText ? "yes" : "no"}`,
    `Hidden fallback support contact configured: ${input.hasSupportContact ? "yes" : "no"}`,
    "The public page leads to a Google Form register button when configured. Do not claim form submissions are tracked.",
    "Do not publish coach phone, email, WhatsApp, or contact-support instructions in normal page copy.",
    "Tone: professional, supportive, clear, practical, and not medical-diagnosis oriented.",
    scope === "all"
      ? "Generate all fixed-template copy sections."
      : "Generate only the requested section fields in the schema. Do not include unrelated fields.",
    "Return structured copy only in the requested JSON schema."
  ].join("\n");
}

function getPromptScopeLabel(scope: CoachCopyScope) {
  if (scope === "benefits") return "benefits section only";
  if (scope === "cta") return "CTA and trust section only";
  if (scope === "faq") return "FAQ section only";
  if (scope === "hero") return "hero headline and subheadline only";
  if (scope === "intro") return "coach introduction section only";
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

    if (field === "faq") {
      return (
        Array.isArray(fieldValue) &&
        fieldValue.every(
          (item) =>
            isRecord(item) && typeof item.question === "string" && typeof item.answer === "string"
        )
      );
    }

    return typeof fieldValue === "string";
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCopyScope(value: unknown): CoachCopyScope {
  return value === "benefits" ||
    value === "cta" ||
    value === "faq" ||
    value === "hero" ||
    value === "intro" ||
    value === "vision"
    ? value
    : "all";
}
