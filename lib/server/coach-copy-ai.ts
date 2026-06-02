import type { CoachSiteContent } from "../admin-coach-sites";

export type CoachCopyAiEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export type CoachCopyAiInput = {
  bio?: string;
  coachName: string;
  hasGoogleFormUrl?: boolean;
  hasSupportContact?: boolean;
  heroMediaType?: "image" | "none" | "video";
  location?: string;
  niche: string;
  registerButtonText?: string;
  supportText?: string;
  vision?: string;
};

export type CoachCopyAiResult =
  | {
      configured: true;
      content: CoachSiteContent;
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

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: createCoachCopyPrompt(input),
        instructions:
          "Generate only editable website copy for a fixed coach referral page. Do not propose design changes, backend logic, database schema, security settings, payment changes, or third-party automation. Keep copy practical, ethical, and education-first.",
        model: env.OPENAI_MODEL || "gpt-5-mini",
        text: {
          format: AI_COPY_SCHEMA
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
    const content = parseCoachCopy(extractResponseText(payload));
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

function createCoachCopyPrompt(input: CoachCopyAiInput) {
  return [
    "Create copy for a Yours Wellness fixed-template coach referral page.",
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
    "Return structured copy only in the requested JSON schema."
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

function parseCoachCopy(value: string): CoachSiteContent | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isCoachSiteContent(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

function isCoachSiteContent(value: unknown): value is CoachSiteContent {
  if (!isRecord(value)) return false;

  return (
    typeof value.heroHeadline === "string" &&
    typeof value.subheadline === "string" &&
    typeof value.coachIntro === "string" &&
    typeof value.visionText === "string" &&
    Array.isArray(value.benefits) &&
    value.benefits.every((item) => typeof item === "string") &&
    typeof value.ctaText === "string" &&
    Array.isArray(value.faq) &&
    value.faq.every(
      (item) =>
        isRecord(item) && typeof item.question === "string" && typeof item.answer === "string"
    ) &&
    typeof value.trustText === "string" &&
    typeof value.socialCopy === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
