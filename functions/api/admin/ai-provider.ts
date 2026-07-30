import type { D1Database } from "@cloudflare/workers-types";
import { classifyAdminAITask } from "../../../lib/admin-ai/adminAIModelRouting";
import {
  buildAdminAIRejectedProviderResponse,
  extractAdminAIRequirementFacts,
  isAdminAIProviderNarrativeGrounded,
  parseAdminAIProtectedProviderInput
} from "../../../lib/admin-ai/adminAIProviderGrounding";
import { adminJson, readJsonBody, requireAdmin } from "../../../lib/server/admin-auth";
import { recordAdminAIProviderReadAttestation } from "../../../lib/server/admin-ai-observability";
import {
  isAdminAIOpenAIEnabled,
  runAdminAIOpenAI,
  type AdminAIOpenAIEnv
} from "../../../lib/server/admin-ai-openai";

type Env = AdminAIOpenAIEnv & {
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
    return adminJson({ error: "Method not allowed.", ok: false }, 405, {
      allow: "GET, POST"
    });
  }
  const admin = await requireAdmin(request, env, { requireCsrf: request.method === "POST" });
  if (!admin.ok) return admin.response;

  if (request.method === "GET") {
    return adminJson({
      configured: isAdminAIOpenAIEnabled(env),
      modelPolicy: {
        complex: "gpt-5.6-luna / medium",
        deterministic: "application code",
        routine: "gpt-5.6-luna / low"
      },
      ok: true
    });
  }

  const payload = await readJsonBody<{
    input?: unknown;
    query?: unknown;
    requestedMaxOutputTokens?: unknown;
  }>(request);
  if (!payload) {
    return adminJson(
      { code: "invalid-provider-request", error: "Invalid Admin AI request.", ok: false },
      400
    );
  }
  const query = typeof payload.query === "string" ? payload.query : "";
  const input = typeof payload.input === "string" ? payload.input : "";
  const protectedInput = parseAdminAIProtectedProviderInput(input);
  const expectedTask = classifyAdminAITask(query);
  if (!protectedInput || protectedInput.task !== expectedTask) {
    return adminJson(
      {
        code: "invalid-provider-context",
        error: "The bounded provider-grounding context is invalid.",
        ok: false
      },
      400
    );
  }
  const serverProtectedInput = {
    ...protectedInput,
    requirementFacts: extractAdminAIRequirementFacts(query, expectedTask),
    task: expectedTask
  };
  const requestedMaxOutputTokens =
    typeof payload.requestedMaxOutputTokens === "number"
      ? payload.requestedMaxOutputTokens
      : undefined;
  const providerStartedAt = Date.now();
  const result = await runAdminAIOpenAI(env, {
    input: JSON.stringify(serverProtectedInput),
    query,
    requestedMaxOutputTokens,
    signal: request.signal
  });
  if (!result.ok) {
    return adminJson(
      {
        code: result.code,
        error: result.message,
        ok: false,
        retryable: result.retryable
      },
      result.status
    );
  }

  const providerNarrative =
    typeof result.response === "string" ? result.response : result.response.output;
  const providerOutputValid = isAdminAIProviderNarrativeGrounded(
    providerNarrative,
    serverProtectedInput
  );
  const providerAttestation = await recordAdminAIProviderReadAttestation({
    adminEmail: admin.admin.email,
    env,
    latencyMs: Date.now() - providerStartedAt,
    module: "global",
    outcome: providerOutputValid ? "success" : "failed",
    request,
    response: result.response
  });
  if (!providerAttestation) {
    return adminJson(
      {
        code: "provider-observability-unavailable",
        error:
          "The provider response was rejected because its server telemetry attestation could not be persisted.",
        ok: false,
        retryable: false
      },
      503
    );
  }

  return adminJson({
    observationRequestId: providerAttestation.requestId,
    ok: true,
    response: providerOutputValid
      ? result.response
      : buildAdminAIRejectedProviderResponse(result.response),
    route: {
      maxInputTokens: result.route.maxInputTokens,
      maxOutputTokens: result.route.maxOutputTokens,
      mode: result.route.mode,
      model: result.route.model,
      reasoningEffort: result.route.reasoningEffort,
      task: result.route.task
    }
  });
}
