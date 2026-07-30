import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { AdminAIFeedbackKind } from "../admin-ai/adminAITypes";
import type { AdminAIProviderResponse } from "../admin-ai/adminAIModelRouting";
import { recordAdminAuditEvent, type AdminAuditEnv } from "./admin-audit";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";

export const ADMIN_AI_CORRECTION_CATEGORIES = [
  "report-interpretation",
  "preferred-wording",
  "known-issue-classification",
  "workflow-preference"
] as const;

export type AdminAICorrectionCategory = (typeof ADMIN_AI_CORRECTION_CATEGORIES)[number];
export type AdminAIObservationOutcome = "blocked" | "cancelled" | "failed" | "success";
export type AdminAIActionOutcome = "blocked" | "failed" | "not-applicable" | "success";
export type AdminAIApprovalTelemetry = {
  level: 1 | 2 | 3;
  outcome: "approved" | "cancelled" | "denied" | "not-required";
};

export type AdminAIObservationInput = {
  actionOutcome?: unknown;
  approvals?: unknown;
  command?: unknown;
  dangerousActionBlocked?: unknown;
  errorCodes?: unknown;
  estimatedCostMicrousd?: unknown;
  feedbackKind?: unknown;
  inputTokens?: unknown;
  latencyMs?: unknown;
  model?: unknown;
  modelVersion?: unknown;
  module?: unknown;
  outcome?: unknown;
  outputTokens?: unknown;
  permissionDenied?: unknown;
  provider?: unknown;
  requestId?: unknown;
  safetyRefusal?: unknown;
  toolCalls?: unknown;
};

export type AdminAICorrectionInput = {
  category?: unknown;
  command?: unknown;
  correction?: unknown;
  feedbackKind?: unknown;
  module?: unknown;
  requestId?: unknown;
};

export type AdminAICorrectionRecord = {
  adminEmail: string;
  automaticRetraining: false;
  category: AdminAICorrectionCategory;
  command: string;
  correction: string;
  createdAt: string;
  evaluationStatus: "queued";
  feedbackKind: AdminAIFeedbackKind | null;
  id: string;
  module: string;
  requestId: string;
  reviewReason: string | null;
  reviewStatus: "approved" | "pending" | "rejected";
  reviewedAt: string | null;
  reviewedBy: string | null;
};

export type AdminAIImprovementRecord = {
  approvedAt: string;
  approvedBy: string;
  automaticRetraining: false;
  correctionId: string;
  id: string;
  securityOverride: false;
  status: "approved";
};

export type AdminAIObservabilityDashboard = {
  actionSuccess: { attempted: number; rate: number; succeeded: number };
  blockedDangerousActions: number;
  corrections: { approved: number; pending: number; rejected: number; total: number };
  cost: { estimatedMicrousd: number };
  failures: {
    blocked: number;
    cancelled: number;
    errorEvents: number;
    failed: number;
    permissionDenied: number;
    safetyRefusals: number;
  };
  feedback: { responses: number; score: number };
  generatedAt: string;
  latency: { averageMs: number; maximumMs: number };
  range: { from: string; to: string };
  topCommands: Array<{ command: string; count: number }>;
  usage: {
    approvals: number;
    byModel: Array<{
      count: number;
      model: string;
      modelVersion: string | null;
      provider: string;
    }>;
    byModule: Array<{ count: number; module: string }>;
    byProvider: Array<{ count: number; provider: string }>;
    requests: number;
    tokens: { input: number; output: number; total: number };
    toolCalls: number;
    uniqueAdmins: number;
  };
};

export type AdminAIOperationFailure = {
  code: "conflict" | "forbidden" | "invalid" | "not-found" | "security-override";
  message: string;
  ok: false;
  status: 400 | 403 | 404 | 409 | 422;
};

type CorrectionRow = {
  admin_email: string;
  automatic_retraining: number | string;
  category: string;
  command: string;
  correction_text: string;
  created_at: number | string;
  evaluation_status: string;
  feedback_kind: string | null;
  id: string;
  module: string;
  request_id: string;
  review_reason: string | null;
  review_status: string;
  reviewed_at: number | string | null;
  reviewed_by: string | null;
};

type ObservationSummaryRow = {
  action_attempted: number | string | null;
  action_succeeded: number | string | null;
  approval_count: number | string | null;
  blocked: number | string | null;
  cancelled: number | string | null;
  dangerous_action_blocked: number | string | null;
  error_count: number | string | null;
  estimated_cost_microusd: number | string | null;
  failed: number | string | null;
  feedback_helpful: number | string | null;
  feedback_total: number | string | null;
  input_tokens: number | string | null;
  latency_average: number | string | null;
  latency_maximum: number | string | null;
  output_tokens: number | string | null;
  permission_denied: number | string | null;
  requests: number | string | null;
  safety_refusals: number | string | null;
  tool_call_count: number | string | null;
  total_tokens: number | string | null;
  unique_admins: number | string | null;
};

type CorrectionSummaryRow = {
  approved: number | string | null;
  pending: number | string | null;
  rejected: number | string | null;
  total: number | string | null;
};

type AdminAIAuditEventRow = {
  created_at: number | string;
  id: string;
  reason: string | null;
};

type AdminAIActionReceiptVerificationRow = {
  action_id: string;
  admin_email: string;
  audit_reference: string;
  id: string;
  rollback_audit_reference: string | null;
  section_id: string;
};

type VerifiedAdminAIObservation = {
  actionOutcome: AdminAIActionOutcome;
  approvals: AdminAIApprovalTelemetry[];
  command: string;
  dangerousActionBlocked: boolean;
  errorCodes: string[];
  estimatedCostMicrousd: 0;
  feedbackKind: null;
  inputTokens: number;
  latencyMs: number;
  model: string;
  modelVersion: string | null;
  module: string;
  outcome: AdminAIObservationOutcome;
  outputTokens: number;
  permissionDenied: false;
  provider: string;
  requestId: string;
  safetyRefusal: false;
  serverReference: string;
  toolCalls: string[];
  totalTokens: number;
};

const FEEDBACK_KINDS = new Set<AdminAIFeedbackKind>([
  "helpful",
  "incorrect-data",
  "missing-context",
  "not-helpful",
  "unsafe-suggestion"
]);
const CORRECTION_CATEGORIES = new Set<AdminAICorrectionCategory>(ADMIN_AI_CORRECTION_CATEGORIES);
const schemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const OBSERVATION_ATTESTATION_MAX_AGE_SECONDS = 10 * 60;

export async function recordAdminAIProviderReadAttestation({
  adminEmail,
  env,
  latencyMs,
  module,
  outcome,
  request,
  response
}: {
  adminEmail: string;
  env: AdminAuditEnv;
  latencyMs: number;
  module: string;
  outcome: "failed" | "success";
  request: Request;
  response: AdminAIProviderResponse;
}) {
  const value = typeof response === "string" ? null : response;
  const provider = parseIdentifier(value?.provider, 120);
  const model = parseIdentifier(value?.model, 120);
  const moduleId = parseIdentifier(module, 80);
  if (!provider || !model || !moduleId) return null;

  const inputTokens = providerTokenCount(value?.usage?.inputTokens);
  const outputTokens = providerTokenCount(value?.usage?.outputTokens);
  const modelVersion = parseIdentifier(value?.modelVersion, 120);
  const requestId = `aip-${crypto.randomUUID()}`;
  const phase = outcome === "success" ? "completed" : "failed";
  const reason = [
    "copilot:natural-language",
    `section:${moduleId}`,
    "type:read",
    `phase:${phase}`,
    `request:${requestId}`,
    `provider:${provider}`,
    `model:${model}`,
    `input-tokens:${inputTokens}`,
    `output-tokens:${outputTokens}`,
    `latency-ms:${parseAdminAITelemetryInteger(String(Math.max(0, Math.round(latencyMs))), 3_600_000)}`,
    ...(modelVersion ? [`model-version:${modelVersion}`] : [])
  ].join("|");
  const persisted = await recordAdminAuditEvent({
    email: adminEmail,
    env,
    reason,
    request,
    type: "ai_action"
  });
  return persisted ? { requestId } : null;
}

const OBSERVABILITY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_observations (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    module TEXT NOT NULL,
    command TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    model_version TEXT,
    latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0 AND latency_ms <= 3600000),
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failed', 'blocked', 'cancelled')),
    tool_calls_json TEXT NOT NULL,
    tool_call_count INTEGER NOT NULL CHECK (tool_call_count >= 0 AND tool_call_count <= 16),
    approvals_json TEXT NOT NULL,
    approval_count INTEGER NOT NULL CHECK (approval_count >= 0 AND approval_count <= 8),
    error_codes_json TEXT NOT NULL,
    error_count INTEGER NOT NULL CHECK (error_count >= 0 AND error_count <= 12),
    safety_refusal INTEGER NOT NULL CHECK (safety_refusal IN (0, 1)),
    permission_denied INTEGER NOT NULL CHECK (permission_denied IN (0, 1)),
    feedback_kind TEXT CHECK (
      feedback_kind IS NULL OR feedback_kind IN (
        'helpful', 'incorrect-data', 'missing-context', 'not-helpful', 'unsafe-suggestion'
      )
    ),
    action_outcome TEXT NOT NULL CHECK (
      action_outcome IN ('not-applicable', 'success', 'failed', 'blocked')
    ),
    dangerous_action_blocked INTEGER NOT NULL CHECK (dangerous_action_blocked IN (0, 1)),
    estimated_cost_microusd INTEGER NOT NULL CHECK (
      estimated_cost_microusd >= 0 AND estimated_cost_microusd <= 1000000000000
    ),
    input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0 AND input_tokens <= 10000000),
    output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0 AND output_tokens <= 10000000),
    total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0 AND total_tokens <= 20000000),
    server_reference TEXT,
    integrity_verified INTEGER NOT NULL DEFAULT 0 CHECK (integrity_verified IN (0, 1)),
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_observations_created
   ON admin_ai_observations (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_observations_command_created
   ON admin_ai_observations (command, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_corrections (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    module TEXT NOT NULL,
    command TEXT NOT NULL,
    feedback_kind TEXT CHECK (
      feedback_kind IS NULL OR feedback_kind IN (
        'helpful', 'incorrect-data', 'missing-context', 'not-helpful', 'unsafe-suggestion'
      )
    ),
    category TEXT NOT NULL CHECK (
      category IN (
        'report-interpretation', 'preferred-wording',
        'known-issue-classification', 'workflow-preference'
      )
    ),
    correction_text TEXT NOT NULL,
    evaluation_status TEXT NOT NULL DEFAULT 'queued' CHECK (evaluation_status = 'queued'),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (
      review_status IN ('pending', 'approved', 'rejected')
    ),
    automatic_retraining INTEGER NOT NULL DEFAULT 0 CHECK (automatic_retraining = 0),
    reviewed_by TEXT,
    reviewed_at INTEGER,
    review_reason TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_corrections_review_created
   ON admin_ai_corrections (review_status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_evaluation_inputs (
    id TEXT PRIMARY KEY,
    correction_id TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'evaluation-only' CHECK (purpose = 'evaluation-only'),
    automatic_retraining INTEGER NOT NULL DEFAULT 0 CHECK (automatic_retraining = 0),
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_ai_improvement_records (
    id TEXT PRIMARY KEY,
    correction_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status = 'approved'),
    security_override INTEGER NOT NULL DEFAULT 0 CHECK (security_override = 0),
    automatic_retraining INTEGER NOT NULL DEFAULT 0 CHECK (automatic_retraining = 0),
    approved_by TEXT NOT NULL,
    approved_at INTEGER NOT NULL
  )`
] as const;

export async function ensureAdminAIObservabilitySchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: schemaCache,
    db,
    setup: async () => {
      for (const statement of OBSERVABILITY_SCHEMA) await db.prepare(statement).run();
      await ensureObservationColumn(db, "provider", "TEXT NOT NULL DEFAULT 'unknown'");
      await ensureObservationColumn(db, "model_version", "TEXT");
      await ensureObservationColumn(db, "input_tokens", "INTEGER NOT NULL DEFAULT 0");
      await ensureObservationColumn(db, "output_tokens", "INTEGER NOT NULL DEFAULT 0");
      await ensureObservationColumn(db, "total_tokens", "INTEGER NOT NULL DEFAULT 0");
      await ensureObservationColumn(db, "server_reference", "TEXT");
      await ensureObservationColumn(
        db,
        "integrity_verified",
        "INTEGER NOT NULL DEFAULT 0 CHECK (integrity_verified IN (0, 1))"
      );
      await db
        .prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_ai_observations_verified_request
           ON admin_ai_observations (admin_email, request_id)
           WHERE integrity_verified = 1`
        )
        .run();
      await db
        .prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_ai_observations_server_reference
           ON admin_ai_observations (server_reference)
           WHERE integrity_verified = 1 AND server_reference IS NOT NULL`
        )
        .run();
    }
  });
}

export async function recordAdminAIObservation({
  adminEmail,
  db,
  observation
}: {
  adminEmail: string;
  db: D1Database;
  observation: AdminAIObservationInput;
}): Promise<
  | { observation: { id: string; recordedAt: string; requestId: string }; ok: true; status: 201 }
  | AdminAIOperationFailure
> {
  const email = normalizeEmail(adminEmail);
  const parsed = parseObservationLocator(observation);
  if (!email || !parsed) return failure("invalid", "Invalid Admin AI observation.", 400);

  await ensureAdminAIObservabilitySchema(db);
  const verified = await verifyObservation(db, email, parsed);
  if (!verified) {
    return failure(
      "forbidden",
      "A recent server-issued Admin AI request or action receipt is required.",
      403
    );
  }
  const id = `admin-ai-observation-${crypto.randomUUID()}`;
  const createdAt = nowSeconds();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO admin_ai_observations (
        id, request_id, server_reference, admin_email, module, command, model, latency_ms, outcome,
        tool_calls_json, tool_call_count, approvals_json, approval_count,
        error_codes_json, error_count, safety_refusal, permission_denied, feedback_kind,
        action_outcome, dangerous_action_blocked, estimated_cost_microusd, created_at,
        provider, model_version, input_tokens, output_tokens, total_tokens, integrity_verified
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
        ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28
      )`
    )
    .bind(
      id,
      verified.requestId,
      verified.serverReference,
      email,
      verified.module,
      verified.command,
      verified.model,
      verified.latencyMs,
      verified.outcome,
      JSON.stringify(verified.toolCalls),
      verified.toolCalls.length,
      JSON.stringify(verified.approvals),
      verified.approvals.length,
      JSON.stringify(verified.errorCodes),
      verified.errorCodes.length,
      verified.safetyRefusal ? 1 : 0,
      verified.permissionDenied ? 1 : 0,
      verified.feedbackKind,
      verified.actionOutcome,
      verified.dangerousActionBlocked ? 1 : 0,
      verified.estimatedCostMicrousd,
      createdAt,
      verified.provider,
      verified.modelVersion,
      verified.inputTokens,
      verified.outputTokens,
      verified.totalTokens,
      1
    )
    .run();
  if (!hasChanges(result)) return failure("conflict", "Observation was not persisted.", 409);

  return {
    observation: { id, recordedAt: toIso(createdAt), requestId: verified.requestId },
    ok: true,
    status: 201
  };
}

export async function recordAdminAIObservationFeedback({
  adminEmail,
  db,
  feedbackKind,
  requestId
}: {
  adminEmail: string;
  db: D1Database;
  feedbackKind: unknown;
  requestId: unknown;
}): Promise<
  | { feedback: { feedbackKind: AdminAIFeedbackKind; requestId: string }; ok: true; status: 200 }
  | AdminAIOperationFailure
> {
  const email = normalizeEmail(adminEmail);
  const id = parseIdentifier(requestId, 120);
  const kind = parseFeedbackKind(feedbackKind);
  if (!email || !id || !kind) return failure("invalid", "Invalid Admin AI feedback.", 400);

  await ensureAdminAIObservabilitySchema(db);
  const result = await db
    .prepare(
      `UPDATE admin_ai_observations
       SET feedback_kind = ?1
       WHERE request_id = ?2 AND admin_email = ?3 AND created_at > ?4`
    )
    .bind(kind, id, email, getAdminAIRetentionCutoffSeconds())
    .run();
  if (!hasChanges(result)) {
    return failure("not-found", "The matching Admin AI observation was not found.", 404);
  }
  return { feedback: { feedbackKind: kind, requestId: id }, ok: true, status: 200 };
}

export async function submitAdminAICorrection({
  adminEmail,
  correction,
  db
}: {
  adminEmail: string;
  correction: AdminAICorrectionInput;
  db: D1Database;
}): Promise<
  { correction: AdminAICorrectionRecord; ok: true; status: 201 } | AdminAIOperationFailure
> {
  const email = normalizeEmail(adminEmail);
  const parsed = parseCorrection(correction);
  if (!email || !parsed) return failure("invalid", "Invalid Admin AI correction.", 400);
  if (containsSecurityOverrideAttempt(parsed.originalCorrection)) {
    return failure(
      "security-override",
      "Corrections cannot override security, RBAC, approval, OTP, or action-safety rules.",
      422
    );
  }

  await ensureAdminAIObservabilitySchema(db);
  const id = `admin-ai-correction-${crypto.randomUUID()}`;
  const evaluationId = `admin-ai-evaluation-${crypto.randomUUID()}`;
  const createdAt = nowSeconds();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO admin_ai_corrections (
          id, request_id, admin_email, module, command, feedback_kind, category,
          correction_text, evaluation_status, review_status, automatic_retraining,
          reviewed_by, reviewed_at, review_reason, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'queued', 'pending', 0, NULL, NULL, NULL, ?9)`
      )
      .bind(
        id,
        parsed.requestId,
        email,
        parsed.module,
        parsed.command,
        parsed.feedbackKind,
        parsed.category,
        parsed.correction,
        createdAt
      ),
    db
      .prepare(
        `INSERT INTO admin_ai_evaluation_inputs (
          id, correction_id, purpose, automatic_retraining, created_at
        ) SELECT ?1, ?2, 'evaluation-only', 0, ?3 WHERE changes() = 1`
      )
      .bind(evaluationId, id, createdAt)
  ]);
  if (!hasOneChangeEach(results, 2)) {
    return failure("conflict", "Correction evaluation record was not persisted.", 409);
  }

  return {
    correction: {
      adminEmail: email,
      automaticRetraining: false,
      category: parsed.category,
      command: parsed.command,
      correction: parsed.correction,
      createdAt: toIso(createdAt),
      evaluationStatus: "queued",
      feedbackKind: parsed.feedbackKind,
      id,
      module: parsed.module,
      requestId: parsed.requestId,
      reviewReason: null,
      reviewStatus: "pending",
      reviewedAt: null,
      reviewedBy: null
    },
    ok: true,
    status: 201
  };
}

export async function reviewAdminAICorrection({
  correctionId,
  db,
  decision,
  reason,
  reviewerEmail,
  reviewerIsOwner
}: {
  correctionId: string;
  db: D1Database;
  decision: unknown;
  reason: unknown;
  reviewerEmail: string;
  reviewerIsOwner: boolean;
}): Promise<
  | {
      correction: AdminAICorrectionRecord;
      improvement: AdminAIImprovementRecord | null;
      ok: true;
      status: 200;
    }
  | AdminAIOperationFailure
> {
  if (!reviewerIsOwner) return failure("forbidden", "Owner access is required.", 403);
  const id = parseCorrectionId(correctionId);
  const reviewer = normalizeEmail(reviewerEmail);
  const reviewDecision = decision === "approve" || decision === "reject" ? decision : null;
  const reviewReason = sanitizeSensitiveText(reason, 240);
  if (!id || !reviewer || !reviewDecision || !reviewReason) {
    return failure("invalid", "Invalid correction review.", 400);
  }

  await ensureAdminAIObservabilitySchema(db);
  const existingRow = await readCorrectionRow(db, id);
  if (!existingRow) return failure("not-found", "Correction was not found.", 404);
  if (existingRow.review_status !== "pending") {
    return failure("conflict", "Correction was already reviewed.", 409);
  }
  if (containsSecurityOverrideAttempt(existingRow.correction_text)) {
    return failure("security-override", "Security-rule overrides cannot be approved.", 422);
  }

  const reviewedAt = nowSeconds();
  const reviewStatus = reviewDecision === "approve" ? "approved" : "rejected";
  let improvement: AdminAIImprovementRecord | null = null;
  if (reviewDecision === "approve") {
    const improvementId = `admin-ai-improvement-${crypto.randomUUID()}`;
    const results = await db.batch([
      correctionReviewUpdate(db, reviewStatus, reviewer, reviewedAt, reviewReason, id),
      db
        .prepare(
          `INSERT INTO admin_ai_improvement_records (
            id, correction_id, status, security_override, automatic_retraining,
            approved_by, approved_at
          ) SELECT ?1, ?2, 'approved', 0, 0, ?3, ?4 WHERE changes() = 1`
        )
        .bind(improvementId, id, reviewer, reviewedAt)
    ]);
    if (!hasOneChangeEach(results, 2)) {
      return failure("conflict", "Correction changed before owner approval.", 409);
    }
    improvement = {
      approvedAt: toIso(reviewedAt),
      approvedBy: reviewer,
      automaticRetraining: false,
      correctionId: id,
      id: improvementId,
      securityOverride: false,
      status: "approved"
    };
  } else {
    const result = await correctionReviewUpdate(
      db,
      reviewStatus,
      reviewer,
      reviewedAt,
      reviewReason,
      id
    ).run();
    if (!hasChanges(result)) {
      return failure("conflict", "Correction changed before owner rejection.", 409);
    }
  }

  const reviewedRow = await readCorrectionRow(db, id);
  if (!reviewedRow) return failure("not-found", "Reviewed correction was not found.", 404);
  return { correction: mapCorrectionRow(reviewedRow), improvement, ok: true, status: 200 };
}

export async function getAdminAIObservabilityDashboard({
  db,
  range,
  viewerIsOwner
}: {
  db: D1Database;
  range?: { from?: unknown; to?: unknown };
  viewerIsOwner: boolean;
}): Promise<AdminAIObservabilityDashboard | AdminAIOperationFailure> {
  if (!viewerIsOwner) return failure("forbidden", "Owner access is required.", 403);
  await ensureAdminAIObservabilitySchema(db);
  const normalizedRange = normalizeAdminAIObservabilityRange(range);
  const from = toEpochSeconds(normalizedRange.from);
  const to = toEpochSeconds(normalizedRange.to);
  const summarySql = `FROM admin_ai_observations
    WHERE integrity_verified = 1 AND created_at >= ?1 AND created_at <= ?2`;
  const [summary, topCommands, byModel, byModule, byProvider, corrections] = await Promise.all([
    db
      .prepare(
        `SELECT
          COUNT(*) AS requests,
          COUNT(DISTINCT admin_email) AS unique_admins,
          COALESCE(SUM(tool_call_count), 0) AS tool_call_count,
          COALESCE(SUM(approval_count), 0) AS approval_count,
          COALESCE(SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
          COALESCE(SUM(CASE WHEN outcome = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked,
          COALESCE(SUM(CASE WHEN outcome = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled,
          COALESCE(SUM(error_count), 0) AS error_count,
          COALESCE(SUM(safety_refusal), 0) AS safety_refusals,
          COALESCE(SUM(permission_denied), 0) AS permission_denied,
          COALESCE(SUM(dangerous_action_blocked), 0) AS dangerous_action_blocked,
          COALESCE(SUM(estimated_cost_microusd), 0) AS estimated_cost_microusd,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(SUM(total_tokens), 0) AS total_tokens,
          COALESCE(AVG(latency_ms), 0) AS latency_average,
          COALESCE(MAX(latency_ms), 0) AS latency_maximum,
          COALESCE(SUM(CASE WHEN action_outcome != 'not-applicable' THEN 1 ELSE 0 END), 0)
            AS action_attempted,
          COALESCE(SUM(CASE WHEN action_outcome = 'success' THEN 1 ELSE 0 END), 0)
            AS action_succeeded,
          COALESCE(SUM(CASE WHEN feedback_kind IS NOT NULL THEN 1 ELSE 0 END), 0)
            AS feedback_total,
          COALESCE(SUM(CASE WHEN feedback_kind = 'helpful' THEN 1 ELSE 0 END), 0)
            AS feedback_helpful
        ${summarySql}`
      )
      .bind(from, to)
      .first<ObservationSummaryRow>(),
    db
      .prepare(
        `SELECT command, COUNT(*) AS count ${summarySql}
         GROUP BY command ORDER BY count DESC, command ASC LIMIT 10`
      )
      .bind(from, to)
      .all<{ command: string; count: number | string }>(),
    db
      .prepare(
        `SELECT provider, model, model_version, COUNT(*) AS count ${summarySql}
         GROUP BY provider, model, model_version
         ORDER BY count DESC, provider ASC, model ASC, model_version ASC`
      )
      .bind(from, to)
      .all<{
        count: number | string;
        model: string;
        model_version: string | null;
        provider: string;
      }>(),
    db
      .prepare(
        `SELECT module, COUNT(*) AS count ${summarySql}
         GROUP BY module ORDER BY count DESC, module ASC`
      )
      .bind(from, to)
      .all<{ module: string; count: number | string }>(),
    db
      .prepare(
        `SELECT provider, COUNT(*) AS count ${summarySql}
         GROUP BY provider ORDER BY count DESC, provider ASC`
      )
      .bind(from, to)
      .all<{ count: number | string; provider: string }>(),
    db
      .prepare(
        `SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN review_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
          COALESCE(SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END), 0) AS approved,
          COALESCE(SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
         FROM admin_ai_corrections WHERE created_at >= ?1 AND created_at <= ?2`
      )
      .bind(from, to)
      .first<CorrectionSummaryRow>()
  ]);

  const values = summary || ({} as ObservationSummaryRow);
  const correctionValues = corrections || ({} as CorrectionSummaryRow);
  const attempted = numberValue(values.action_attempted);
  const feedbackTotal = numberValue(values.feedback_total);
  return {
    actionSuccess: {
      attempted,
      rate: percent(numberValue(values.action_succeeded), attempted),
      succeeded: numberValue(values.action_succeeded)
    },
    blockedDangerousActions: numberValue(values.dangerous_action_blocked),
    corrections: {
      approved: numberValue(correctionValues.approved),
      pending: numberValue(correctionValues.pending),
      rejected: numberValue(correctionValues.rejected),
      total: numberValue(correctionValues.total)
    },
    cost: { estimatedMicrousd: numberValue(values.estimated_cost_microusd) },
    failures: {
      blocked: numberValue(values.blocked),
      cancelled: numberValue(values.cancelled),
      errorEvents: numberValue(values.error_count),
      failed: numberValue(values.failed),
      permissionDenied: numberValue(values.permission_denied),
      safetyRefusals: numberValue(values.safety_refusals)
    },
    feedback: {
      responses: feedbackTotal,
      score: percent(numberValue(values.feedback_helpful), feedbackTotal)
    },
    generatedAt: new Date().toISOString(),
    latency: {
      averageMs: Math.round(numberValue(values.latency_average)),
      maximumMs: numberValue(values.latency_maximum)
    },
    range: normalizedRange,
    topCommands: (topCommands.results || []).map((row) => ({
      command: row.command,
      count: numberValue(row.count)
    })),
    usage: {
      approvals: numberValue(values.approval_count),
      byModel: (byModel.results || []).map((row) => ({
        count: numberValue(row.count),
        model: row.model,
        modelVersion: row.model_version,
        provider: row.provider
      })),
      byModule: (byModule.results || []).map((row) => ({
        count: numberValue(row.count),
        module: row.module
      })),
      byProvider: (byProvider.results || []).map((row) => ({
        count: numberValue(row.count),
        provider: row.provider
      })),
      requests: numberValue(values.requests),
      tokens: {
        input: numberValue(values.input_tokens),
        output: numberValue(values.output_tokens),
        total: numberValue(values.total_tokens)
      },
      toolCalls: numberValue(values.tool_call_count),
      uniqueAdmins: numberValue(values.unique_admins)
    }
  };
}

function parseObservationLocator(value: AdminAIObservationInput) {
  const requestId = parseIdentifier(value?.requestId, 120);
  const moduleId = parseIdentifier(value?.module, 80);
  const command = parseIdentifier(value?.command, 120);
  return requestId && moduleId && command ? { command, module: moduleId, requestId } : null;
}

async function verifyObservation(
  db: D1Database,
  adminEmail: string,
  locator: { command: string; module: string; requestId: string }
): Promise<VerifiedAdminAIObservation | null> {
  const createdAfter = nowSeconds() - OBSERVATION_ATTESTATION_MAX_AGE_SECONDS;
  const result = await db
    .prepare(
      `SELECT id, reason, created_at
       FROM admin_audit_events
       WHERE event_type = 'ai_action' AND email = ?1 AND created_at >= ?2
       ORDER BY created_at DESC
       LIMIT 24`
    )
    .bind(adminEmail, createdAfter)
    .all<AdminAIAuditEventRow>();
  const candidates = (result.results || [])
    .map(parseAdminAIAuditEvent)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const ordered = [
    ...candidates.filter((item) => item.references.includes(locator.requestId)),
    ...candidates.filter(
      (item) =>
        !item.references.includes(locator.requestId) &&
        item.command === locator.command &&
        item.module === locator.module
    )
  ];

  for (const candidate of ordered) {
    if (candidate.receiptId) {
      const receipt = await verifyActionReceipt(db, adminEmail, candidate);
      if (!receipt) continue;
    }
    return {
      actionOutcome: candidate.actionOutcome,
      approvals: [],
      command: candidate.command,
      dangerousActionBlocked: candidate.dangerousActionBlocked,
      errorCodes: candidate.outcome === "failed" ? ["server-recorded-failure"] : [],
      estimatedCostMicrousd: 0,
      feedbackKind: null,
      inputTokens: candidate.inputTokens,
      latencyMs: candidate.latencyMs,
      model: candidate.model,
      modelVersion: candidate.modelVersion,
      module: candidate.module,
      outcome: candidate.outcome,
      outputTokens: candidate.outputTokens,
      permissionDenied: false,
      provider: candidate.provider,
      requestId: locator.requestId,
      safetyRefusal: false,
      serverReference: candidate.serverReference,
      toolCalls: [],
      totalTokens: candidate.totalTokens
    };
  }
  return null;
}

function parseAdminAIAuditEvent(row: AdminAIAuditEventRow) {
  const id = parseIdentifier(row.id, 120);
  const reason = typeof row.reason === "string" ? row.reason : "";
  if (!id || !reason) return null;
  const normalizedReason = reason.replace(
    /_(?=(?:section|type|phase|confirmation|records|request|provider|model|model-version|input-tokens|output-tokens|latency-ms|path|fp):)/g,
    "|"
  );
  const fields = new Map<string, string>();
  for (const part of normalizedReason.split("|")) {
    const separator = part.indexOf(":");
    if (separator <= 0) continue;
    const key = part.slice(0, separator);
    const rawValue = part.slice(separator + 1);
    const value =
      key === "receipt" ? parseAdminAIReceiptId(rawValue) : parseIdentifier(rawValue, 160);
    if (value && !fields.has(key)) fields.set(key, value);
  }

  const action = fields.get("action");
  const copilot = fields.get("copilot");
  const command = parseIdentifier(action || copilot, 120);
  const moduleId = parseIdentifier(fields.get("section"), 80);
  if (!command || !moduleId) return null;
  const providerTelemetry = parseAdminAIProviderTelemetry(fields);

  if (action) {
    const receiptId = parseAdminAIReceiptId(fields.get("receipt"));
    const outcome = fields.get("outcome");
    if (!receiptId || (outcome !== "completed" && outcome !== "rollback_completed")) return null;
    return {
      actionOutcome: "success" as const,
      command,
      dangerousActionBlocked: false,
      ...deterministicAdminAITelemetry(),
      module: moduleId,
      outcome: "success" as const,
      receiptId,
      references: [id, receiptId],
      serverReference: id
    };
  }

  const requestId = parseIdentifier(fields.get("request"), 120);
  const actionType = fields.get("type");
  const phase = fields.get("phase");
  if (
    !["dangerous", "read", "write"].includes(actionType || "") ||
    !["completed", "denied", "failed"].includes(phase || "")
  ) {
    return null;
  }
  const outcome: AdminAIObservationOutcome =
    phase === "completed" ? "success" : phase === "denied" ? "blocked" : "failed";
  return {
    actionOutcome:
      actionType === "read"
        ? ("not-applicable" as const)
        : outcome === "success"
          ? ("success" as const)
          : outcome === "blocked"
            ? ("blocked" as const)
            : ("failed" as const),
    command,
    dangerousActionBlocked: actionType === "dangerous" && outcome !== "success",
    ...providerTelemetry,
    module: moduleId,
    outcome,
    receiptId: null,
    references: [id, ...(requestId ? [requestId] : [])],
    serverReference: id
  };
}

function parseAdminAIProviderTelemetry(fields: ReadonlyMap<string, string>) {
  const provider = parseIdentifier(fields.get("provider"), 120);
  const model = parseIdentifier(fields.get("model"), 120);
  if (!provider || !model) return deterministicAdminAITelemetry();

  const inputTokens = parseAdminAITelemetryInteger(fields.get("input-tokens"), 10_000_000);
  const outputTokens = parseAdminAITelemetryInteger(fields.get("output-tokens"), 10_000_000);
  const latencyMs = parseAdminAITelemetryInteger(fields.get("latency-ms"), 3_600_000);
  const modelVersion = parseIdentifier(fields.get("model-version"), 120);
  return {
    inputTokens,
    latencyMs,
    model,
    modelVersion: modelVersion || null,
    outputTokens,
    provider,
    totalTokens: inputTokens + outputTokens
  };
}

function deterministicAdminAITelemetry() {
  return {
    inputTokens: 0,
    latencyMs: 0,
    model: "deterministic",
    modelVersion: null,
    outputTokens: 0,
    provider: "deterministic",
    totalTokens: 0
  } as const;
}

function parseAdminAITelemetryInteger(value: string | undefined, ceiling: number) {
  if (!value || !/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= ceiling ? parsed : 0;
}

function providerTokenCount(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 10_000_000
    ? value
    : 0;
}

async function verifyActionReceipt(
  db: D1Database,
  adminEmail: string,
  candidate: {
    command: string;
    module: string;
    receiptId: string | null;
    serverReference: string;
  }
) {
  if (!candidate.receiptId) return null;
  const row = await db
    .prepare(
      `SELECT id, audit_reference, rollback_audit_reference, action_id, section_id, admin_email
       FROM admin_ai_action_receipts
       WHERE id = ?1 AND admin_email = ?2
          AND (audit_reference = ?3 OR rollback_audit_reference = ?3)
          AND created_at > ?4
        LIMIT 1`
    )
    .bind(
      candidate.receiptId,
      adminEmail,
      candidate.serverReference,
      getAdminAIRetentionCutoffSeconds()
    )
    .first<AdminAIActionReceiptVerificationRow>();
  return row &&
    row.admin_email === adminEmail &&
    row.action_id === candidate.command &&
    row.section_id === candidate.module
    ? row
    : null;
}

async function ensureObservationColumn(db: D1Database, column: string, definition: string) {
  const statement = db.prepare("PRAGMA table_info(admin_ai_observations)") as unknown as {
    all?: <T>() => Promise<{ results?: T[] }>;
  };
  if (typeof statement.all !== "function") return;
  const result = await statement.all<{ name: string }>();
  if ((result.results || []).some((row) => row.name === column)) return;
  await db.prepare(`ALTER TABLE admin_ai_observations ADD COLUMN ${column} ${definition}`).run();
}

function parseCorrection(value: AdminAICorrectionInput) {
  const requestId = parseIdentifier(value?.requestId, 120);
  const moduleId = parseIdentifier(value?.module, 80);
  const command = parseIdentifier(value?.command, 120);
  const category = CORRECTION_CATEGORIES.has(value?.category as AdminAICorrectionCategory)
    ? (value.category as AdminAICorrectionCategory)
    : null;
  const feedbackKind = parseFeedbackKind(value?.feedbackKind);
  const originalCorrection = normalizeText(value?.correction, 1200);
  const correction = sanitizeSensitiveText(originalCorrection, 800);
  if (
    !requestId ||
    !moduleId ||
    !command ||
    !category ||
    !originalCorrection ||
    !correction ||
    (value?.feedbackKind != null && !feedbackKind)
  ) {
    return null;
  }
  return {
    category,
    command,
    correction,
    feedbackKind,
    module: moduleId,
    originalCorrection,
    requestId
  };
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(normalized) ||
    looksLikeSensitiveValue(normalized)
  ) {
    return "";
  }
  return normalized;
}

function parseCorrectionId(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^admin-ai-correction-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : "";
}

function parseAdminAIReceiptId(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^admin-ai-receipt-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : "";
}

function looksLikeSensitiveValue(value: string) {
  return (
    /^\d{6}$/.test(value) ||
    /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value) ||
    /^(?:sk|sess|token|secret)[-_][a-zA-Z0-9_-]{16,}$/i.test(value) ||
    (value.length >= 48 && /^[a-zA-Z0-9_+/=-]+$/.test(value))
  );
}

function parseFeedbackKind(value: unknown): AdminAIFeedbackKind | null {
  return FEEDBACK_KINDS.has(value as AdminAIFeedbackKind) ? (value as AdminAIFeedbackKind) : null;
}

function sanitizeSensitiveText(value: unknown, maxLength: number) {
  return normalizeText(value, maxLength * 2)
    .replace(
      /\b(otp|one[- ]time(?: password| code)?|password|passcode|secret|session(?: token)?|access token|refresh token|api[- ]?key|authorization)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;.]+)/gi,
      "$1: [REDACTED]"
    )
    .replace(/\bbearer\s+[a-zA-Z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[REDACTED]")
    .replace(/\b(?:sk|sess|token|secret)[-_][a-zA-Z0-9_-]{16,}\b/gi, "[REDACTED]")
    .replace(/\b\d{6}\b/g, "[REDACTED]")
    .slice(0, maxLength)
    .trim();
}

function containsSecurityOverrideAttempt(value: string) {
  const normalized = value.toLowerCase();
  const override = /\b(ignore|override|bypass|disable|remove|skip|circumvent|turn off)\b/.test(
    normalized
  );
  const protectedRule =
    /\b(security|rbac|permission|authorization|approval|otp|csrf|confirmation|audit|action[- ]safety|safety rule)\b/.test(
      normalized
    );
  return override && protectedRule;
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalizeAdminAIObservabilityRange(
  range?: { from?: unknown; to?: unknown },
  nowMilliseconds = Date.now()
) {
  const now = new Date(nowMilliseconds);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const firstRetainedSecond =
    (getAdminAIRetentionCutoffSeconds(Math.floor(nowMilliseconds / 1_000)) + 1) * 1_000;
  const retainedFrom = new Date(firstRetainedSecond);
  const requestedFrom = parseDate(range?.from) || defaultFrom;
  const from = new Date(Math.max(requestedFrom.getTime(), retainedFrom.getTime()));
  const to = parseDate(range?.to) || now;
  if (from.getTime() > to.getTime())
    return { from: retainedFrom.toISOString(), to: now.toISOString() };
  return { from: from.toISOString(), to: to.toISOString() };
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function correctionReviewUpdate(
  db: D1Database,
  reviewStatus: "approved" | "rejected",
  reviewer: string,
  reviewedAt: number,
  reason: string,
  id: string
) {
  return db
    .prepare(
      `UPDATE admin_ai_corrections
       SET review_status = ?1, reviewed_by = ?2, reviewed_at = ?3, review_reason = ?4
       WHERE id = ?5
         AND review_status = 'pending'
         AND automatic_retraining = 0
         AND created_at > ?6`
    )
    .bind(
      reviewStatus,
      reviewer,
      reviewedAt,
      reason,
      id,
      getAdminAIRetentionCutoffSeconds(reviewedAt)
    );
}

async function readCorrectionRow(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT id, request_id, admin_email, module, command, feedback_kind, category,
               correction_text, evaluation_status, review_status, automatic_retraining,
               reviewed_by, reviewed_at, review_reason, created_at
        FROM admin_ai_corrections WHERE id = ?1 AND created_at > ?2 LIMIT 1`
    )
    .bind(id, getAdminAIRetentionCutoffSeconds())
    .first<CorrectionRow>();
}

function mapCorrectionRow(row: CorrectionRow): AdminAICorrectionRecord {
  if (
    !CORRECTION_CATEGORIES.has(row.category as AdminAICorrectionCategory) ||
    !["approved", "pending", "rejected"].includes(row.review_status) ||
    row.evaluation_status !== "queued" ||
    numberValue(row.automatic_retraining) !== 0
  ) {
    throw new Error("Invalid persisted Admin AI correction.");
  }
  const feedbackKind = row.feedback_kind ? parseFeedbackKind(row.feedback_kind) : null;
  if (row.feedback_kind && !feedbackKind) throw new Error("Invalid persisted feedback kind.");
  return {
    adminEmail: normalizeEmail(row.admin_email),
    automaticRetraining: false,
    category: row.category as AdminAICorrectionCategory,
    command: row.command,
    correction: row.correction_text,
    createdAt: toIso(numberValue(row.created_at)),
    evaluationStatus: "queued",
    feedbackKind,
    id: row.id,
    module: row.module,
    requestId: row.request_id,
    reviewReason: row.review_reason,
    reviewStatus: row.review_status as AdminAICorrectionRecord["reviewStatus"],
    reviewedAt: row.reviewed_at === null ? null : toIso(numberValue(row.reviewed_at)),
    reviewedBy: row.reviewed_by ? normalizeEmail(row.reviewed_by) : null
  };
}

function hasChanges(result: D1Result<unknown>) {
  return Number(result.meta.changes || 0) === 1;
}

function hasOneChangeEach(results: D1Result<unknown>[], expected: number) {
  return results.length === expected && results.every(hasChanges);
}

function failure(
  code: AdminAIOperationFailure["code"],
  message: string,
  status: AdminAIOperationFailure["status"]
): AdminAIOperationFailure {
  return { code, message, ok: false, status };
}

function numberValue(value: number | string | null | undefined) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toEpochSeconds(value: string) {
  return Math.floor(Date.parse(value) / 1000);
}

function toIso(value: number) {
  return new Date(value * 1000).toISOString();
}
