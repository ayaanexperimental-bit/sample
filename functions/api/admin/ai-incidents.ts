import type { D1Database } from "@cloudflare/workers-types";
import type { AdminAIHealthEvidenceInput } from "../../../lib/admin-ai/adminAIHealth";
import { adminJson, readJsonBody, requireOwner } from "../../../lib/server/admin-auth";
import {
  getActiveAdminAIIncident,
  resolveAdminAIIncident,
  syncAdminAIIncident,
  updateAdminAIIncidentChecklist,
  type AdminAIIncidentMutationResult
} from "../../../lib/server/admin-ai-incidents";

type Env = {
  ADMIN_ALLOWED_EMAILS?: string;
  ADMIN_AUTH_DEMO_ENABLED?: string;
  ADMIN_DB?: D1Database;
  ADMIN_DEV_OTP?: string;
  ADMIN_REQUIRE_DB_ADMIN_ROLES?: string;
  ADMIN_SESSION_SECRET?: string;
  ROOT_OWNER_EMAIL?: string;
};

type PagesContext = {
  env: Env;
  request: Request;
};

type AdminAIIncidentBody = {
  evidence?: unknown;
  expectedVersion?: unknown;
  incidentId?: unknown;
  itemId?: unknown;
  mode?: unknown;
  query?: unknown;
  reason?: unknown;
  status?: unknown;
};

export async function onRequest({ env, request }: PagesContext) {
  if (request.method !== "GET" && request.method !== "POST") {
    return adminJson({ ok: false, error: "Method not allowed." }, 405, {
      allow: "GET, POST"
    });
  }

  const admin = await requireOwner(request, env, {
    requireCsrf: request.method === "POST"
  });
  if (!admin.ok) return admin.response;
  if (!env.ADMIN_DB) {
    return adminJson({ ok: false, error: "Durable incident storage is unavailable." }, 503);
  }

  try {
    if (request.method === "GET") {
      return adminJson({ ok: true, incident: await getActiveAdminAIIncident(env.ADMIN_DB) });
    }

    const body = await readJsonBody<AdminAIIncidentBody>(request);
    const mode = parseIdentifier(body?.mode, 24);
    let result: AdminAIIncidentMutationResult;
    if (mode === "sync") {
      result = await syncAdminAIIncident({
        adminEmail: admin.admin.email,
        db: env.ADMIN_DB,
        evidence: parseEvidence(body?.evidence),
        query: parseText(body?.query, 500),
        requestedAt: new Date().toISOString()
      });
    } else if (mode === "checklist") {
      result = await updateAdminAIIncidentChecklist({
        adminEmail: admin.admin.email,
        db: env.ADMIN_DB,
        expectedVersion: parseVersion(body?.expectedVersion),
        incidentId: parseIdentifier(body?.incidentId, 120),
        itemId: parseIdentifier(body?.itemId, 80) as Parameters<
          typeof updateAdminAIIncidentChecklist
        >[0]["itemId"],
        status: parseIdentifier(body?.status, 24) as Parameters<
          typeof updateAdminAIIncidentChecklist
        >[0]["status"]
      });
    } else if (mode === "resolve") {
      result = await resolveAdminAIIncident({
        adminEmail: admin.admin.email,
        db: env.ADMIN_DB,
        expectedVersion: parseVersion(body?.expectedVersion),
        incidentId: parseIdentifier(body?.incidentId, 120),
        reason: parseText(body?.reason, 240)
      });
    } else {
      return adminJson({ ok: false, error: "Invalid incident operation." }, 400);
    }

    return result.ok
      ? adminJson({ ok: true, incident: result.incident }, result.status)
      : adminJson({ ok: false, code: result.code, error: result.message }, result.status);
  } catch {
    return adminJson({ ok: false, error: "Durable incident storage is unavailable." }, 503);
  }
}

function parseEvidence(value: unknown): AdminAIHealthEvidenceInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .slice(0, 100) as AdminAIHealthEvidenceInput[];
}

function parseText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized.slice(0, maxLength) : "";
}

function parseVersion(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}
