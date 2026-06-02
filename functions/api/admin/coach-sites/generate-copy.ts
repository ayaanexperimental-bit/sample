import type { D1Database } from "@cloudflare/workers-types";
import {
  adminJson,
  readJsonBody,
  requireAdmin
} from "../../../../lib/server/admin-auth";
import {
  type CoachCopyAiInput,
  generateCoachSiteCopyWithAi
} from "../../../../lib/server/coach-copy-ai";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type GenerateCopyBody = {
  bio?: unknown;
  coachName?: unknown;
  hasGoogleFormUrl?: unknown;
  hasSupportContact?: unknown;
  heroMediaType?: unknown;
  location?: unknown;
  niche?: unknown;
  registerButtonText?: unknown;
  scope?: unknown;
  supportText?: unknown;
  vision?: unknown;
};

export async function onRequest({ request, env }: PagesContext) {
  if (request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "POST" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: true });
  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody<GenerateCopyBody>(request);
  const input = parseGenerateCopyBody(body);
  if (!input) {
    return adminJson({ ok: false, error: "Coach name and coach niche are required." }, 400);
  }

  const result = await generateCoachSiteCopyWithAi(input, env);
  if (!result.ok && !result.configured) {
    return adminJson(
      {
        configured: false,
        message: result.message,
        ok: false
      },
      503
    );
  }

  if (!result.ok) {
    return adminJson(
      {
        configured: true,
        message: result.message,
        ok: false
      },
      502
    );
  }

  return adminJson({
    configured: true,
    content: result.content,
    ok: true
  });
}

function parseGenerateCopyBody(body: GenerateCopyBody | null): CoachCopyAiInput | null {
  const coachName = typeof body?.coachName === "string" ? body.coachName.trim() : "";
  const niche = typeof body?.niche === "string" ? body.niche.trim() : "";
  if (!coachName || !niche) return null;

  return {
    bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 1200) : "",
    coachName: coachName.slice(0, 160),
    hasGoogleFormUrl: body?.hasGoogleFormUrl === true,
    hasSupportContact: body?.hasSupportContact === true,
    heroMediaType:
      body?.heroMediaType === "image" ||
      body?.heroMediaType === "none" ||
      body?.heroMediaType === "video"
        ? body.heroMediaType
        : "none",
    location: typeof body?.location === "string" ? body.location.trim().slice(0, 160) : "",
    niche: niche.slice(0, 160),
    registerButtonText:
      typeof body?.registerButtonText === "string"
        ? body.registerButtonText.trim().slice(0, 80)
        : "",
    scope: parseCopyScope(body?.scope),
    supportText:
      typeof body?.supportText === "string" ? body.supportText.trim().slice(0, 400) : "",
    vision: typeof body?.vision === "string" ? body.vision.trim().slice(0, 1200) : ""
  };
}

function parseCopyScope(value: unknown): CoachCopyAiInput["scope"] {
  return value === "benefits" ||
    value === "cta" ||
    value === "faq" ||
    value === "hero" ||
    value === "intro" ||
    value === "vision"
    ? value
    : "all";
}
