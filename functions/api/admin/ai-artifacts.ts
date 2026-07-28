import type { D1Database } from "@cloudflare/workers-types";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import {
  getAdminAIArtifact,
  listAdminAIArtifacts,
  mutateAdminAIArtifact
} from "../../../lib/server/admin-ai-artifacts";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = { env: Env; request: Request };

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, { allow: "GET, POST" });
  }

  const admin = await requireAdmin(request, env, { requireCsrf: request.method === "POST" });
  if (!admin.ok) return admin.response;
  if (!env.ADMIN_DB) {
    return adminJson({ ok: false, error: "Durable artifact storage is unavailable." }, 503);
  }
  const actor = { email: admin.admin.email, isOwner: admin.admin.isOwner };

  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      if (
        Array.from(url.searchParams.keys()).some((key) => !["id", "includeDeleted"].includes(key))
      ) {
        return adminJson({ ok: false, error: "Invalid artifact query fields." }, 400);
      }
      const artifactId = url.searchParams.get("id");
      const includeDeleted = url.searchParams.get("includeDeleted") === "true";
      if (artifactId) {
        const result = await getAdminAIArtifact({
          actor,
          artifactId,
          db: env.ADMIN_DB,
          includeDeleted
        });
        return result.ok
          ? adminJson({ artifact: result.artifact, ok: true })
          : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
      }
      return adminJson({
        artifacts: await listAdminAIArtifacts({ actor, db: env.ADMIN_DB, includeDeleted }),
        ok: true
      });
    }

    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return adminJson({ ok: false, error: "Invalid artifact request." }, 400);
    const result = await mutateAdminAIArtifact({ actor, db: env.ADMIN_DB, input: body });
    return result.ok
      ? adminJson({ artifact: result.artifact, ok: true }, result.status)
      : adminJson({ code: result.code, error: result.message, ok: false }, result.status);
  } catch {
    return adminJson({ ok: false, error: "Durable artifact storage is unavailable." }, 503);
  }
}
