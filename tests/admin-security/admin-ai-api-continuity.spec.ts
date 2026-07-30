import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_AI_AUDIT_RETENTION_DAYS,
  ADMIN_AI_TASK_RETENTION_DAYS,
  buildAdminAIPermissionBoundaryHash,
  isAdminAITaskReadableAt,
  normalizeAdminAICheckpointDisposition,
  normalizeAdminAITaskCreateInput
} from "../../lib/server/admin-ai-continuity";
import {
  classifyAdminAITask,
  selectAdminAIModelRoute
} from "../../lib/admin-ai/adminAIModelRouting";
import { DEFAULT_ADMIN_AI_OWNER_POLICY } from "../../lib/admin-ai/adminAIPolicy";
import { getAdminAIResponseOutcome } from "../../lib/admin-ai/adminAIResponseOutcome";
import { runAdminAIOpenAI } from "../../lib/server/admin-ai-openai";

const repoRoot = path.resolve(process.cwd());

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("locks saved-task and audit retention to 90 days", () => {
  expect(ADMIN_AI_TASK_RETENTION_DAYS).toBe(90);
  expect(ADMIN_AI_AUDIT_RETENTION_DAYS).toBe(90);
  expect(DEFAULT_ADMIN_AI_OWNER_POLICY.retentionPeriodDays).toBe(90);
  expect(DEFAULT_ADMIN_AI_OWNER_POLICY.auditConfiguration.retentionDays).toBe(90);
});

test("marks invalid-provider fallback as failed-safe before reporting activity", () => {
  expect(normalizeAdminAICheckpointDisposition("failed-safe", "invalid-provider-response")).toEqual(
    {
      reasonCode: "invalid-provider-response",
      status: "failed-safe"
    }
  );
  expect(normalizeAdminAICheckpointDisposition("failed-safe", "completed")).toBeNull();

  expect(
    getAdminAIResponseOutcome(
      {
        body: "A deterministic fallback remained available.",
        items: [],
        providerFallbackReason: "invalid-provider-response",
        state: "ready",
        title: "Grounded fallback"
      },
      "Entire Admin Panel"
    )
  ).toEqual({
    activityDetail:
      "Provider result degraded safely (invalid-provider-response); deterministic fallback remained available.",
    activityStatus: "error",
    assistantState: "warning",
    checkpointReasonCode: "invalid-provider-response",
    checkpointStatus: "failed-safe",
    degraded: true,
    observationOutcome: "failed"
  });
});

test("validates durable provider output before committing its checkpoint", () => {
  const operation = read("functions/api/admin/ai-tasks/[taskId]/[operation].ts");
  const validationIndex = operation.indexOf("isAdminAIProviderNarrativeGrounded");
  const checkpointIndex = operation.indexOf("checkpointAdminAITask({");

  expect(validationIndex).toBeGreaterThan(-1);
  expect(checkpointIndex).toBeGreaterThan(validationIndex);
  expect(operation).toMatch(/status:\s*providerOutputValid\s*\?\s*"active"\s*:\s*"failed-safe"/);
  expect(operation).toMatch(
    /reasonCode:\s*providerOutputValid\s*\?\s*"safe-checkpoint"\s*:\s*"invalid-provider-response"/
  );
});

test("routes routine and compatibility work to Luna low and medium", () => {
  const routine = selectAdminAIModelRoute("Summarize this page");
  expect(routine).toMatchObject({
    maxInputTokens: 4_000,
    maxOutputTokens: 700,
    mode: "fast",
    model: "gpt-5.6-luna",
    reasoningEffort: "low"
  });

  expect(classifyAdminAITask("Check these two requirements for compatibility conflicts")).toBe(
    "requirement-conflict-analysis"
  );
  const complex = selectAdminAIModelRoute(
    "Check these two requirements for compatibility conflicts across modules"
  );
  expect(complex).toMatchObject({
    maxInputTokens: 8_000,
    maxOutputTokens: 2_400,
    mode: "reasoning",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium"
  });
});

test("task input is compact and rejects secrets before persistence", () => {
  const valid = normalizeAdminAITaskCreateInput({
    goal: "Review three selected coach sites without applying changes.",
    scope: {
      allowedSectionIds: ["coach-sites", "coach-analytics"],
      mode: "selection",
      module: "coach-sites"
    },
    selectedEntityRefs: [
      {
        id: "coach_123",
        requiredPermissions: ["coach_sites.view"],
        sourceVersion: "2026-07-28T00:00:00Z",
        type: "coach-site"
      }
    ]
  });
  expect(valid.ok).toBe(true);
  if (valid.ok) {
    expect(JSON.stringify(valid.value).length).toBeLessThanOrEqual(32 * 1024);
  }

  const unsafe = normalizeAdminAITaskCreateInput({
    goal: "Continue using OTP 123456 and Authorization: Bearer secret-token",
    scope: { allowedSectionIds: [], mode: "page", module: "dashboard" }
  });
  expect(unsafe).toMatchObject({ code: "unsafe-input", ok: false });

  const safePasswordTopic = normalizeAdminAITaskCreateInput({
    goal: "Review the password-reset UX copy without changing any credentials.",
    scope: { allowedSectionIds: [], mode: "page", module: "settings" }
  });
  expect(safePasswordTopic.ok).toBe(true);
});

test("expiry and permission-boundary checks are deterministic", async () => {
  expect(isAdminAITaskReadableAt({ deletedAt: null, expiresAt: 1_000 }, 999)).toBe(true);
  expect(isAdminAITaskReadableAt({ deletedAt: null, expiresAt: 1_000 }, 1_000)).toBe(false);
  expect(isAdminAITaskReadableAt({ deletedAt: 900, expiresAt: 1_000 }, 901)).toBe(false);

  const first = await buildAdminAIPermissionBoundaryHash({
    isOwner: false,
    modules: ["reports", "coach_sites"],
    permissions: ["reports.view", "coach_sites.view"],
    roleKey: "reports"
  });
  const reordered = await buildAdminAIPermissionBoundaryHash({
    isOwner: false,
    modules: ["coach_sites", "reports"],
    permissions: ["coach_sites.view", "reports.view"],
    roleKey: "reports"
  });
  const changed = await buildAdminAIPermissionBoundaryHash({
    isOwner: false,
    modules: ["reports"],
    permissions: ["reports.view"],
    roleKey: "reports"
  });
  expect(reordered).toBe(first);
  expect(changed).not.toBe(first);
});

test("server provider adapter owns Responses API calls with store false", () => {
  const provider = read("lib/server/admin-ai-openai.ts");
  const endpoint = read("functions/api/admin/ai-provider.ts");
  expect(provider).toContain("https://api.openai.com/v1/responses");
  expect(provider).toMatch(/store:\s*false/);
  expect(provider).toContain("effort: route.reasoningEffort");
  expect(provider).toContain("OPENAI_API_KEY");
  expect(endpoint).toContain("requireAdmin");
  expect(endpoint).toContain('requireCsrf: request.method === "POST"');
  expect(endpoint).not.toContain("body.model");
});

test("provider input is redacted before the Responses API boundary", async () => {
  const originalFetch = globalThis.fetch;
  let providerBody = "";
  globalThis.fetch = async (_input, init) => {
    providerBody = String(init?.body || "");
    return new Response(
      JSON.stringify({
        id: "resp_safe_1",
        model: "gpt-5.6-luna",
        output_text: "The bounded review is ready.",
        usage: { input_tokens: 24, output_tokens: 8 }
      }),
      { headers: { "content-type": "application/json" }, status: 200 }
    );
  };

  try {
    const result = await runAdminAIOpenAI(
      {
        ADMIN_AI_OPENAI_PROVIDER: "true",
        OPENAI_API_KEY: "test-provider-key"
      },
      {
        input:
          "Permission-filtered record. authorization: Bearer admin-private-token-123 and email owner@example.com",
        query: "Summarize the selected coach note.",
        requestedMaxOutputTokens: 200
      }
    );
    expect(result.ok).toBe(true);
    expect(providerBody).toContain("[REDACTED]");
    expect(providerBody).not.toContain("admin-private-token-123");
    expect(providerBody).not.toContain("owner@example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider adapter fails closed when Responses returns incomplete output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "resp_incomplete_1",
        incomplete_details: { reason: "max_output_tokens" },
        model: "gpt-5.6-luna",
        output_text: "A partial answer that must not be accepted.",
        status: "incomplete",
        usage: { input_tokens: 24, output_tokens: 200 }
      }),
      { headers: { "content-type": "application/json" }, status: 200 }
    );

  try {
    const result = await runAdminAIOpenAI(
      {
        ADMIN_AI_OPENAI_PROVIDER: "true",
        OPENAI_API_KEY: "test-provider-key"
      },
      {
        input: "Permission-filtered bounded context.",
        query: "Summarize the selected coach note.",
        requestedMaxOutputTokens: 200
      }
    );
    expect(result).toMatchObject({
      code: "provider-response-incomplete",
      ok: false,
      retryable: false,
      status: 502
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider adapter never mislabels a response ID as the model version", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "resp_completed_not_a_model_version",
        model: "gpt-5.6-luna",
        output_text: "The bounded review is complete.",
        status: "completed",
        usage: { input_tokens: 24, output_tokens: 8 }
      }),
      { headers: { "content-type": "application/json" }, status: 200 }
    );

  try {
    const result = await runAdminAIOpenAI(
      {
        ADMIN_AI_OPENAI_PROVIDER: "true",
        OPENAI_API_KEY: "test-provider-key"
      },
      {
        input: "Permission-filtered bounded context.",
        query: "Summarize the selected coach note."
      }
    );
    expect(result.ok).toBe(true);
    if (result.ok && typeof result.response !== "string") {
      expect(result.response.model).toBe("gpt-5.6-luna");
      expect(result.response.modelVersion).toBeUndefined();
    }
    expect(JSON.stringify(result)).not.toContain("resp_completed_not_a_model_version");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("durable task API and Operate-mode UX expose explicit lifecycle controls", () => {
  const taskService = read("lib/server/admin-ai-continuity.ts");
  const schema = read("database/admin-auth.sql");
  const client = read("lib/admin-ai/adminAIDurableClient.ts");
  const panel = read("components/admin/admin-ai/AdminAIPill.tsx");
  const logout = read("components/admin/admin-auth-shell.tsx");

  for (const table of [
    "admin_ai_tasks",
    "admin_ai_conversations",
    "admin_ai_task_events",
    "admin_ai_task_checkpoints",
    "admin_ai_idempotency"
  ]) {
    expect(taskService).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  }
  expect(client).toContain("/api/admin/ai-tasks");
  expect(panel).toContain("Saved tasks");
  expect(panel).toContain("Permissions and data will be checked again.");
  expect(panel).toContain("Resume");
  expect(panel).toContain("Cancel task");
  expect(panel).toContain("Delete saved task");
  expect(panel).toContain("Confirm deletion");
  expect(panel).toContain("Keep task");
  expect(panel).toContain("Clear conversation/context");
  expect(panel).toContain("Fixed 90-day policy");
  expect(panel).toContain("readOnly");
  expect(logout).toContain('const ADMIN_AI_SESSION_STORAGE_PREFIX = "yw-admin-ai:"');
  expect(logout).toContain("key?.startsWith(ADMIN_AI_SESSION_STORAGE_PREFIX)");
  expect(logout).toContain("window.sessionStorage.removeItem(key)");
});

test("continuity writes are version-gated, idempotent, and conversation-boundary safe", () => {
  const taskService = read("lib/server/admin-ai-continuity.ts");
  const taskOperation = read("functions/api/admin/ai-tasks/[taskId]/[operation].ts");
  const deleteStart = taskService.indexOf("export async function deleteAdminAITask");
  const deleteEnd = taskService.indexOf("export async function purgeExpiredAdminAIContinuity");
  const deleteTask = taskService.slice(deleteStart, deleteEnd);

  expect(deleteTask).toContain("await db.batch");
  expect(taskService).toContain("WHERE changes() = 1");
  expect(taskService).toContain("startNewConversation: true");
  expect(taskService).not.toContain("nextCheckpointSequence");
  expect(taskOperation).toContain("getAdminAITaskExecutionContext");
  expect(taskOperation).toContain("Saved task capsule");
});

test("the production worker runs bounded daily Admin AI retention purges", () => {
  const worker = read("workers/live-viewers.ts");
  const workerConfig = read("wrangler.live-viewers.jsonc");

  expect(worker).toContain("scheduled(");
  expect(worker).toContain("purgeExpiredAdminAIRecords");
  expect(worker).toContain("runScheduledAdminAIPurge");
  expect(workerConfig).toContain('"crons"');
  expect(workerConfig).toContain('"binding": "ADMIN_DB"');
});
