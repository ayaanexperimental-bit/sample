import { expect, test } from "@playwright/test";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import { onRequest as handleAdminAIAction } from "../../functions/api/admin/ai-actions";
import { onRequest as handleAdminAIObservability } from "../../functions/api/admin/ai-observability";
import { onRequest as handleAdminAIProvider } from "../../functions/api/admin/ai-provider";
import {
  recordAdminAIObservation,
  recordAdminAIProviderReadAttestation
} from "../../lib/server/admin-ai-observability";

const ADMIN_EMAIL = "integrity-admin@example.com";
const SESSION_SECRET = "admin-ai-observability-integrity-secret";

test.describe("Admin AI observability integrity", () => {
  test("requires and consumes a same-admin server request while deriving aggregate fields", async () => {
    const db = new IntegrityFakeD1();
    db.auditEvents.push({
      created_at: Math.floor(Date.now() / 1000),
      email: ADMIN_EMAIL,
      event_type: "ai_action",
      id: "audit-event-1",
      reason:
        "copilot:analytics.explain|section:coach-analytics|type:read|phase:completed|confirmation:not-required|records:none|request:admin-ai-known-1"
    });

    const recorded = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: db.asD1(),
      observation: forgedObservation({ requestId: "admin-ai-known-1" })
    });

    expect(recorded).toMatchObject({ ok: true, status: 201 });
    expect(db.observations).toHaveLength(1);
    expect(db.observations[0]).toMatchObject({
      action_outcome: "not-applicable",
      admin_email: ADMIN_EMAIL,
      approval_count: 0,
      command: "analytics.explain",
      dangerous_action_blocked: 0,
      error_count: 0,
      estimated_cost_microusd: 0,
      input_tokens: 0,
      integrity_verified: 1,
      latency_ms: 0,
      model: "deterministic",
      model_version: null,
      module: "coach-analytics",
      outcome: "success",
      output_tokens: 0,
      permission_denied: 0,
      provider: "deterministic",
      request_id: "admin-ai-known-1",
      safety_refusal: 0,
      server_reference: "audit-event-1",
      tool_call_count: 0,
      total_tokens: 0
    });

    const replayWithFreshClientId = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: db.asD1(),
      observation: forgedObservation({
        command: "analytics.explain",
        module: "coach-analytics",
        requestId: "ai-fresh-client-id"
      })
    });
    expect(replayWithFreshClientId).toMatchObject({ code: "conflict", ok: false, status: 409 });
    expect(db.observations).toHaveLength(1);
  });

  test("persists server-attested Luna telemetry while ignoring forged client values", async () => {
    const db = new IntegrityFakeD1();
    const attestation = await recordAdminAIProviderReadAttestation({
      adminEmail: ADMIN_EMAIL,
      env: { ADMIN_DB: db.asD1(), ADMIN_SESSION_SECRET: SESSION_SECRET },
      latencyMs: 842,
      module: "global",
      outcome: "success",
      request: apiRequest("/api/admin/ai-tasks/task-1/messages", {}, {}),
      response: {
        model: "gpt-5.6-luna",
        output: "Both verified requirements use a 90-day retention policy.",
        provider: "openai",
        usage: { inputTokens: 137, outputTokens: 29 }
      }
    });
    expect(attestation?.requestId).toMatch(/^aip-/);

    const recorded = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: db.asD1(),
      observation: forgedObservation({
        command: "natural-language",
        module: "global",
        requestId: attestation?.requestId
      })
    });

    expect(recorded).toMatchObject({ ok: true, status: 201 });
    expect(db.observations).toHaveLength(1);
    expect(db.observations[0]).toMatchObject({
      command: "natural-language",
      input_tokens: 137,
      latency_ms: 842,
      model: "gpt-5.6-luna",
      model_version: null,
      module: "global",
      outcome: "success",
      output_tokens: 29,
      provider: "openai",
      request_id: attestation?.requestId,
      server_reference: db.auditEvents[0].id,
      total_tokens: 166
    });
    expect(db.observations[0]).not.toMatchObject({
      input_tokens: 9_000_000,
      model: "forged-model",
      output_tokens: 9_000_000,
      provider: "forged-provider"
    });
  });

  test("keeps rejected provider output failed-safe while accounting server usage", async () => {
    const db = new IntegrityFakeD1();
    const attestation = await recordAdminAIProviderReadAttestation({
      adminEmail: ADMIN_EMAIL,
      env: { ADMIN_DB: db.asD1(), ADMIN_SESSION_SECRET: SESSION_SECRET },
      latencyMs: 603,
      module: "global",
      outcome: "failed",
      request: apiRequest("/api/admin/ai-tasks/task-2/messages", {}, {}),
      response: {
        model: "gpt-5.6-luna",
        output: "Rejected ungrounded provider output.",
        provider: "openai",
        usage: { inputTokens: 101, outputTokens: 17 }
      }
    });
    expect(attestation?.requestId).toMatch(/^aip-/);

    const recorded = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: db.asD1(),
      observation: forgedObservation({
        command: "natural-language",
        module: "global",
        outcome: "success",
        requestId: attestation?.requestId
      })
    });

    expect(recorded).toMatchObject({ ok: true, status: 201 });
    expect(db.observations[0]).toMatchObject({
      error_codes_json: JSON.stringify(["server-recorded-failure"]),
      input_tokens: 101,
      model: "gpt-5.6-luna",
      outcome: "failed",
      output_tokens: 17,
      provider: "openai",
      total_tokens: 118
    });
  });

  test("provider endpoint issues the opaque telemetry reference used by observation storage", async () => {
    const db = new IntegrityFakeD1();
    const session = await createAdminTestSession();
    const env = {
      ADMIN_AI_OPENAI_PROVIDER: "true",
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: db.asD1(),
      ADMIN_REQUIRE_DB_ADMIN_ROLES: "false",
      ADMIN_SESSION_SECRET: SESSION_SECRET,
      OPENAI_API_KEY: "test-provider-key",
      ROOT_OWNER_EMAIL: ADMIN_EMAIL
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          model: "gpt-5.6-luna",
          output_text:
            "Both bounded requirements specify 90 days, so there is no direct duration conflict.",
          status: "completed",
          usage: { input_tokens: 211, output_tokens: 31 }
        }),
        { headers: { "content-type": "application/json" }, status: 200 }
      );

    try {
      const query =
        "Check these two requirements for compatibility conflicts: audit logs must be retained 90 days and saved task memory must be retained 90 days.";
      const providerResponse = await handleAdminAIProvider({
        env,
        request: apiRequest(
          "/api/admin/ai-provider",
          {
            cookie: session.cookie,
            "x-yw-admin-csrf": session.csrfToken
          },
          {
            input: JSON.stringify({
              dateRange: "unavailable",
              freshness: "recent",
              metrics: {
                permissionVisibleEntityCount: 0,
                sourceErrorCount: 0,
                visibleMetricCount: 0,
                warningCount: 0
              },
              requirementFacts: [],
              scope: "Entire Admin Panel",
              section: "Admin Overview",
              task: "requirement-conflict-analysis",
              version: 2
            }),
            query,
            requestedMaxOutputTokens: 240
          }
        )
      });
      expect(providerResponse.status).toBe(200);
      const payload = (await providerResponse.json()) as {
        observationRequestId?: string;
        response?: { output?: string };
      };
      expect(payload).toMatchObject({
        observationRequestId: expect.stringMatching(/^aip-/),
        response: {
          output: expect.stringContaining("no direct duration conflict")
        }
      });

      const recorded = await recordAdminAIObservation({
        adminEmail: ADMIN_EMAIL,
        db: db.asD1(),
        observation: forgedObservation({
          command: "natural-language",
          module: "global",
          requestId: payload.observationRequestId
        })
      });
      expect(recorded).toMatchObject({ ok: true, status: 201 });
      expect(db.observations[0]).toMatchObject({
        input_tokens: 211,
        model: "gpt-5.6-luna",
        outcome: "success",
        output_tokens: 31,
        provider: "openai",
        total_tokens: 242
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects fabricated and cross-admin request identifiers", async () => {
    const db = new IntegrityFakeD1();
    db.auditEvents.push({
      created_at: Math.floor(Date.now() / 1000),
      email: "different-admin@example.com",
      event_type: "ai_action",
      id: "audit-event-other-admin",
      reason:
        "copilot:analytics.explain|section:coach-analytics|type:read|phase:completed|confirmation:not-required|records:none|request:admin-ai-other-admin"
    });

    for (const requestId of ["admin-ai-never-issued", "admin-ai-other-admin"]) {
      const result = await recordAdminAIObservation({
        adminEmail: ADMIN_EMAIL,
        db: db.asD1(),
        observation: forgedObservation({ requestId })
      });
      expect(result).toMatchObject({ code: "forbidden", ok: false, status: 403 });
    }
    expect(db.observations).toHaveLength(0);
  });

  test("binds registered-action telemetry to its durable action receipt", async () => {
    const db = new IntegrityFakeD1();
    const auditReference = "admin-ai-298f62d7-cbbe-4390-9850-4a9cf34ccf5c";
    const receiptId = "admin-ai-receipt-f32f2ce9-9102-43b8-93a7-921988e02974";
    db.actionReceipts.push({
      action_id: "error-reports.start-review",
      admin_email: ADMIN_EMAIL,
      audit_reference: auditReference,
      id: receiptId,
      rollback_audit_reference: null,
      section_id: "error-reports"
    });
    db.auditEvents.push({
      created_at: Math.floor(Date.now() / 1000),
      email: ADMIN_EMAIL,
      event_type: "ai_action",
      id: auditReference,
      reason: `action:error-reports.start-review|section:error-reports|record:ERR-1|confirmation:accepted|outcome:completed|receipt:${receiptId}`
    });

    const result = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: db.asD1(),
      observation: forgedObservation({ requestId: auditReference })
    });

    expect(result).toMatchObject({ ok: true, status: 201 });
    expect(db.observations[0]).toMatchObject({
      action_outcome: "success",
      command: "error-reports.start-review",
      module: "error-reports",
      server_reference: auditReference
    });
  });

  test("attests bounded natural-language and registered reads before observation and feedback persistence", async () => {
    const db = new IntegrityFakeD1();
    const session = await createAdminTestSession();
    const env = {
      ADMIN_ALLOWED_EMAILS: ADMIN_EMAIL,
      ADMIN_AUTH_DEMO_ENABLED: "true",
      ADMIN_DB: db.asD1(),
      ADMIN_REQUIRE_DB_ADMIN_ROLES: "false",
      ADMIN_SESSION_SECRET: SESSION_SECRET,
      ROOT_OWNER_EMAIL: ADMIN_EMAIL
    };
    const headers = {
      cookie: session.cookie,
      "x-yw-admin-csrf": session.csrfToken
    };

    const missingCsrf = await handleAdminAIAction({
      env,
      request: apiRequest(
        "/api/admin/ai-actions",
        { cookie: session.cookie },
        {
          mode: "attest-read",
          module: "global",
          outcome: "success"
        }
      )
    });
    expect(missingCsrf.status).toBe(403);

    for (const invalidInput of [
      { mode: "attest-read", module: "unknown-module", outcome: "success" },
      { mode: "attest-read", module: "global", outcome: "arbitrary" }
    ]) {
      const invalid = await handleAdminAIAction({
        env,
        request: apiRequest("/api/admin/ai-actions", headers, invalidInput)
      });
      expect(invalid.status).toBe(400);
    }
    expect(db.auditEvents).toHaveLength(0);

    const attestation = await handleAdminAIAction({
      env,
      request: apiRequest("/api/admin/ai-actions", headers, {
        mode: "attest-read",
        module: "global",
        outcome: "success"
      })
    });
    expect(attestation.status).toBe(200);
    const attestationPayload = (await attestation.json()) as {
      ok?: boolean;
      requestId?: string;
    };
    expect(attestationPayload).toMatchObject({
      ok: true,
      requestId: expect.stringMatching(/^admin-ai-/)
    });
    expect(db.auditEvents).toContainEqual(
      expect.objectContaining({
        email: ADMIN_EMAIL,
        event_type: "ai_action",
        reason: expect.stringContaining(
          `copilot:natural-language_section:global_type:read_phase:completed_request:${attestationPayload.requestId}`
        )
      })
    );

    const observed = await handleAdminAIObservability({
      env,
      request: apiRequest("/api/admin/ai-observability", headers, {
        mode: "observe",
        observation: forgedObservation({
          command: "natural-language",
          module: "global",
          requestId: attestationPayload.requestId
        })
      })
    });
    expect(observed.status).toBe(201);
    expect(db.observations).toHaveLength(1);
    expect(db.observations[0]).toMatchObject({
      action_outcome: "not-applicable",
      command: "natural-language",
      feedback_kind: null,
      module: "global",
      outcome: "success",
      request_id: attestationPayload.requestId
    });

    const feedback = await handleAdminAIObservability({
      env,
      request: apiRequest("/api/admin/ai-observability", headers, {
        feedbackKind: "helpful",
        mode: "feedback",
        requestId: attestationPayload.requestId
      })
    });
    expect(feedback.status).toBe(200);
    expect(db.observations[0]).toMatchObject({ feedback_kind: "helpful" });

    const mismatchedRegisteredAttestation = await handleAdminAIAction({
      env,
      request: apiRequest("/api/admin/ai-actions", headers, {
        actionId: "overview.summarize",
        mode: "attest-read",
        module: "coach-sites",
        outcome: "success"
      })
    });
    expect(mismatchedRegisteredAttestation.status).toBe(400);

    const registeredAttestation = await handleAdminAIAction({
      env,
      request: apiRequest("/api/admin/ai-actions", headers, {
        actionId: "overview.summarize",
        mode: "attest-read",
        module: "overview",
        outcome: "success"
      })
    });
    expect(registeredAttestation.status).toBe(200);
    const registeredAttestationPayload = (await registeredAttestation.json()) as {
      ok?: boolean;
      requestId?: string;
    };
    expect(registeredAttestationPayload).toMatchObject({
      ok: true,
      requestId: expect.stringMatching(/^admin-ai-/)
    });
    expect(db.auditEvents).toContainEqual(
      expect.objectContaining({
        email: ADMIN_EMAIL,
        event_type: "ai_action",
        reason: expect.stringContaining(
          `copilot:overview.summarize_section:overview_type:read_phase:completed_request:${registeredAttestationPayload.requestId}`
        )
      })
    );

    const registeredObserved = await handleAdminAIObservability({
      env,
      request: apiRequest("/api/admin/ai-observability", headers, {
        mode: "observe",
        observation: forgedObservation({
          command: "overview.summarize",
          module: "overview",
          requestId: registeredAttestationPayload.requestId
        })
      })
    });
    expect(registeredObserved.status).toBe(201);
    expect(db.observations.at(-1)).toMatchObject({
      command: "overview.summarize",
      feedback_kind: null,
      module: "overview",
      outcome: "success",
      request_id: registeredAttestationPayload.requestId
    });

    const registeredFeedback = await handleAdminAIObservability({
      env,
      request: apiRequest("/api/admin/ai-observability", headers, {
        feedbackKind: "helpful",
        mode: "feedback",
        requestId: registeredAttestationPayload.requestId
      })
    });
    expect(registeredFeedback.status).toBe(200);
    expect(db.observations.at(-1)).toMatchObject({ feedback_kind: "helpful" });

    const unattestedDb = new IntegrityFakeD1();
    const unattested = await recordAdminAIObservation({
      adminEmail: ADMIN_EMAIL,
      db: unattestedDb.asD1(),
      observation: forgedObservation({
        command: "natural-language",
        module: "global",
        requestId: "admin-ai-unattested-natural-language"
      })
    });
    expect(unattested).toMatchObject({ code: "forbidden", ok: false, status: 403 });
    expect(unattestedDb.observations).toHaveLength(0);
  });
});

function forgedObservation(overrides: Record<string, unknown> = {}) {
  return {
    actionOutcome: "success",
    approvals: [{ level: 3, outcome: "approved" }],
    command: "error-reports.delete",
    dangerousActionBlocked: true,
    errorCodes: ["fabricated_failure"],
    estimatedCostMicrousd: 999_999_999,
    feedbackKind: "helpful",
    inputTokens: 9_000_000,
    latencyMs: 3_600_000,
    model: "forged-model",
    modelVersion: "forged-version",
    module: "global",
    outcome: "failed",
    outputTokens: 9_000_000,
    permissionDenied: true,
    provider: "forged-provider",
    requestId: "admin-ai-forged",
    safetyRefusal: true,
    toolCalls: ["dangerous.delete"],
    ...overrides
  };
}

type AuditEventRow = {
  created_at: number;
  email: string;
  event_type: string;
  id: string;
  reason: string;
};

type ObservationRow = Record<string, unknown> & {
  admin_email: string;
  request_id: string;
  server_reference: string;
};

type ActionReceiptRow = {
  action_id: string;
  admin_email: string;
  audit_reference: string;
  id: string;
  rollback_audit_reference: string | null;
  section_id: string;
};

class IntegrityFakeD1 {
  actionReceipts: ActionReceiptRow[] = [];
  auditEvents: AuditEventRow[] = [];
  observations: ObservationRow[] = [];

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new IntegrityStatement(this, sql);
  }
}

class IntegrityStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: IntegrityFakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T>() {
    if (this.sql.includes("PRAGMA table_info(admin_ai_observations)")) {
      return {
        results: [
          "provider",
          "model_version",
          "input_tokens",
          "output_tokens",
          "total_tokens",
          "server_reference",
          "integrity_verified"
        ].map((name) => ({ name })) as T[]
      };
    }
    if (this.sql.includes("FROM admin_audit_events")) {
      const [email, createdAfter] = this.params;
      return {
        results: this.db.auditEvents
          .filter(
            (row) =>
              row.event_type === "ai_action" &&
              row.email === String(email) &&
              row.created_at >= Number(createdAfter)
          )
          .sort((left, right) => right.created_at - left.created_at) as T[]
      };
    }
    return { results: [] as T[] };
  }

  async first<T>() {
    if (!this.sql.includes("FROM admin_ai_action_receipts")) return null;
    const [receiptId, adminEmail, auditReference] = this.params;
    return (this.db.actionReceipts.find(
      (row) =>
        row.id === String(receiptId) &&
        row.admin_email === String(adminEmail) &&
        (row.audit_reference === String(auditReference) ||
          row.rollback_audit_reference === String(auditReference))
    ) || null) as T | null;
  }

  async run() {
    if (this.sql.includes("INTO admin_audit_events")) {
      const [id, eventType, email, reason, createdAt] = this.params;
      this.db.auditEvents.push({
        created_at: Number(createdAt),
        email: String(email),
        event_type: String(eventType),
        id: String(id),
        reason: String(reason)
      });
      return d1Result(1);
    }
    if (this.sql.includes("UPDATE admin_ai_observations")) {
      const [feedbackKind, requestId, adminEmail] = this.params;
      const observation = this.db.observations.find(
        (row) => row.request_id === String(requestId) && row.admin_email === String(adminEmail)
      );
      if (!observation) return d1Result(0);
      observation.feedback_kind = String(feedbackKind);
      return d1Result(1);
    }
    if (!this.sql.includes("INTO admin_ai_observations")) return d1Result(0);
    const [
      id,
      requestId,
      serverReference,
      adminEmail,
      module,
      command,
      model,
      latencyMs,
      outcome,
      toolCallsJson,
      toolCallCount,
      approvalsJson,
      approvalCount,
      errorCodesJson,
      errorCount,
      safetyRefusal,
      permissionDenied,
      feedbackKind,
      actionOutcome,
      dangerousActionBlocked,
      estimatedCostMicrousd,
      createdAt,
      provider,
      modelVersion,
      inputTokens,
      outputTokens,
      totalTokens,
      integrityVerified
    ] = this.params;
    if (
      this.db.observations.some(
        (row) =>
          (row.admin_email === String(adminEmail) && row.request_id === String(requestId)) ||
          row.server_reference === String(serverReference)
      )
    ) {
      return d1Result(0);
    }
    this.db.observations.push({
      action_outcome: actionOutcome,
      admin_email: String(adminEmail),
      approval_count: approvalCount,
      approvals_json: approvalsJson,
      command,
      created_at: createdAt,
      dangerous_action_blocked: dangerousActionBlocked,
      error_codes_json: errorCodesJson,
      error_count: errorCount,
      estimated_cost_microusd: estimatedCostMicrousd,
      feedback_kind: feedbackKind,
      id,
      input_tokens: inputTokens,
      integrity_verified: integrityVerified,
      latency_ms: latencyMs,
      model,
      model_version: modelVersion,
      module,
      outcome,
      output_tokens: outputTokens,
      permission_denied: permissionDenied,
      provider,
      request_id: String(requestId),
      safety_refusal: safetyRefusal,
      server_reference: String(serverReference),
      tool_call_count: toolCallCount,
      tool_calls_json: toolCallsJson,
      total_tokens: totalTokens
    });
    return d1Result(1);
  }
}

function d1Result(changes: number): D1Result<unknown> {
  return { meta: { changes } as D1Result<unknown>["meta"], results: [], success: true };
}

async function createAdminTestSession() {
  const now = Math.floor(Date.now() / 1000);
  const authEnv = { ADMIN_SESSION_SECRET: SESSION_SECRET };
  const session: AdminSessionPayload = {
    email: ADMIN_EMAIL,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const cookie = await createAdminSessionCookie({
    email: ADMIN_EMAIL,
    env: authEnv,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env: authEnv, session });
  if (!cookie || !csrfToken) throw new Error("Failed to create the Admin AI test session.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function apiRequest(path: string, headers: Record<string, string>, body: Record<string, unknown>) {
  return new Request(`http://127.0.0.1:4802${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      ...headers
    },
    method: "POST"
  });
}
