import type { D1Database } from "@cloudflare/workers-types";
import { redactAdminAIText } from "../admin-ai/adminAIPolicy";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

export const ADMIN_AI_TASK_RETENTION_DAYS = 90;
export const ADMIN_AI_AUDIT_RETENTION_DAYS = 90;
export const ADMIN_AI_TASK_RETENTION_SECONDS = ADMIN_AI_TASK_RETENTION_DAYS * 86_400;
export const ADMIN_AI_MAX_CAPSULE_BYTES = 32 * 1024;
export const ADMIN_AI_MAX_PINNED_REQUIREMENTS = 50;
export const ADMIN_AI_MAX_SELECTED_ENTITY_REFS = 100;
export const ADMIN_AI_MAX_RECENT_TURN_DIGESTS = 6;

export const ADMIN_AI_SPEC_POLICY = {
  promptContractVersion: "admin-ai-v1",
  spec1Sha256: "031CF2D157DE151EEDE82AD84B7ACF2DAEDBE5E5BFF5C3882836B4339DBA9FE4",
  spec2Sha256: "5B438515D09C477CBC52C19FD1D47A4C14F3EF534806D68CA9EC98176E3B206C"
} as const;

export type AdminAITaskStatus =
  | "active"
  | "awaiting-user"
  | "blocked-access-changed"
  | "cancelled"
  | "completed"
  | "failed-safe"
  | "paused";

export type AdminAICheckpointDisposition = {
  reasonCode:
    | "input-ceiling-exceeded"
    | "invalid-provider-response"
    | "provider-cancelled"
    | "provider-failure"
    | "provider-timeout"
    | "provider-unavailable"
    | "safe-checkpoint";
  status: "active" | "failed-safe";
};

const ADMIN_AI_FAILED_SAFE_CHECKPOINT_REASONS = new Set([
  "input-ceiling-exceeded",
  "invalid-provider-response",
  "provider-cancelled",
  "provider-failure",
  "provider-timeout",
  "provider-unavailable"
]);

export function normalizeAdminAICheckpointDisposition(
  status: unknown,
  reasonCode: unknown
): AdminAICheckpointDisposition | null {
  if (
    (status === undefined || status === "active") &&
    (reasonCode === undefined || reasonCode === "safe-checkpoint")
  ) {
    return { reasonCode: "safe-checkpoint", status: "active" };
  }
  if (
    status === "failed-safe" &&
    typeof reasonCode === "string" &&
    ADMIN_AI_FAILED_SAFE_CHECKPOINT_REASONS.has(reasonCode)
  ) {
    return {
      reasonCode: reasonCode as AdminAICheckpointDisposition["reasonCode"],
      status: "failed-safe"
    };
  }
  return null;
}

export type AdminAIContinuityActor = {
  isOwner: boolean;
  modules: string[];
  permissionBoundaryHash: string;
  permissions: string[];
  roleKey: string;
  subjectId: string;
};

export type AdminAITaskScope = {
  allowedSectionIds: string[];
  mode: "global" | "module" | "page" | "record" | "selection";
  module: string;
};

export type AdminAISelectedEntityRef = {
  id: string;
  requiredPermissions: string[];
  sourceVersion: string | null;
  type: string;
};

export type AdminAITaskCapsule = {
  adminSubjectId: string;
  artifactRefs: string[];
  completedSteps: Array<{ evidenceRefs: string[]; id: string; summary: string }>;
  conversationId: string | null;
  createdAt: string;
  currentStep: string | null;
  decisions: Array<{ decidedAt: string; id: string; summary: string }>;
  expiresAt: string;
  goal: string;
  lastActivityAt: string;
  openQuestions: string[];
  pinnedRequirements: Array<{ id: string; source: string; text: string }>;
  policy: typeof ADMIN_AI_SPEC_POLICY & { ownerPolicyVersion: number };
  recentTurnDigests: Array<{ createdAt: string; role: "assistant" | "user"; summary: string }>;
  safeConversationSummary: string;
  schemaVersion: 1;
  scope: AdminAITaskScope;
  security: {
    lastValidatedAt: string;
    permissionSnapshotHash: string;
    redactionVersion: 1;
  };
  selectedEntityRefs: AdminAISelectedEntityRef[];
  status: AdminAITaskStatus;
  taskId: string;
  version: number;
};

export type AdminAITaskClient = {
  artifactCount: number;
  conversationId: string | null;
  expiresAt: string;
  goal: string;
  id: string;
  lastActivityAt: string;
  lastSafeStep: string | null;
  scope: AdminAITaskScope;
  status: AdminAITaskStatus;
  title: string;
  version: number;
};

type TaskRow = {
  capsule_json: string;
  created_at: number | string;
  deleted_at: number | string | null;
  expires_at: number | string;
  goal_summary: string;
  id: string;
  last_activity_at: number | string;
  status: AdminAITaskStatus;
  title: string;
  version: number | string;
};

type AdminAITaskCreateInput = {
  goal: string;
  pinnedRequirements: Array<{ id: string; source: string; text: string }>;
  scope: AdminAITaskScope;
  selectedEntityRefs: AdminAISelectedEntityRef[];
};

type ContinuityResult<T> =
  | { ok: true; value: T }
  | { code: string; message: string; ok: false; status: number };

const schemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const identifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;
const sensitivePattern =
  /\b(?:authorization\s*:\s*bearer\s+[^\s,;]+|bearer\s+[a-z0-9._~+/-]{8,}|(?:api[_ -]?key|session[_ -]?token|password|passwd|secret|cookie)\s*[:=]\s*[^\s,;]+)\b|(?:\botp\b|\bone[- ]time (?:passcode|password|code)\b)[^\n]{0,24}\b\d{4,10}\b/i;

export const ADMIN_AI_CONTINUITY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_tasks (
    id TEXT PRIMARY KEY,
    admin_subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'active', 'awaiting-user', 'blocked-access-changed', 'cancelled',
      'completed', 'failed-safe', 'paused'
    )),
    scope_json TEXT NOT NULL,
    goal_summary TEXT NOT NULL,
    capsule_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    active_job_id TEXT,
    created_at INTEGER NOT NULL,
    last_activity_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_tasks_subject_activity
    ON admin_ai_tasks (admin_subject_id, deleted_at, last_activity_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_tasks_expiry
    ON admin_ai_tasks (expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_conversations (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
    safe_summary TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_conversations_task
    ON admin_ai_conversations (task_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_conversations_expiry
    ON admin_ai_conversations (expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_task_events (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    conversation_id TEXT,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_subject_id TEXT NOT NULL,
    safe_reason_code TEXT NOT NULL,
    task_version INTEGER NOT NULL,
    occurred_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_task_events_task
    ON admin_ai_task_events (task_id, occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_task_events_expiry
    ON admin_ai_task_events (expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_task_checkpoints (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    job_id TEXT,
    sequence INTEGER NOT NULL,
    safe_checkpoint_json TEXT NOT NULL,
    artifact_id TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE (task_id, sequence)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_task_checkpoints_expiry
    ON admin_ai_task_checkpoints (expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_idempotency (
    admin_subject_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    result_reference TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (admin_subject_id, operation, idempotency_key_hash)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_idempotency_expiry
    ON admin_ai_idempotency (expires_at)`
] as const;

export async function ensureAdminAIContinuitySchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: schemaCache,
    db,
    setup: async () => {
      for (const statement of ADMIN_AI_CONTINUITY_SCHEMA) {
        await db.prepare(statement).run();
      }
    }
  });
}

export function normalizeAdminAITaskCreateInput(
  value: unknown
): ContinuityResult<AdminAITaskCreateInput> {
  if (!isRecord(value) || !isRecord(value.scope)) {
    return failure("invalid-task", "A valid saved-task goal and scope are required.", 400);
  }
  const rawGoal = safeText(value.goal, 2_000);
  const mode = value.scope.mode;
  const moduleId = safeIdentifier(value.scope.module, 100);
  const allowedSectionIds = uniqueIdentifiers(value.scope.allowedSectionIds, 50, 100);
  if (
    !rawGoal ||
    !moduleId ||
    !["global", "module", "page", "record", "selection"].includes(String(mode)) ||
    !allowedSectionIds
  ) {
    return failure("invalid-task", "A valid saved-task goal and scope are required.", 400);
  }
  if (containsSensitiveAdminAIText(rawGoal)) {
    return failure(
      "unsafe-input",
      "Secrets, OTPs, tokens, credentials, and authorization material cannot be saved.",
      400
    );
  }
  const goal = safeText(redactAdminAIText(rawGoal), 2_000);
  if (!goal) return failure("unsafe-input", "The saved-task goal has no safe content.", 400);

  const pinnedRequirements = normalizePinnedRequirements(value.pinnedRequirements);
  const selectedEntityRefs = normalizeSelectedEntityRefs(value.selectedEntityRefs);
  if (!pinnedRequirements || !selectedEntityRefs) {
    return failure(
      "invalid-task",
      "Saved-task references are invalid or exceed the safe limit.",
      400
    );
  }

  const input: AdminAITaskCreateInput = {
    goal,
    pinnedRequirements,
    scope: {
      allowedSectionIds,
      mode: mode as AdminAITaskScope["mode"],
      module: moduleId
    },
    selectedEntityRefs
  };
  if (utf8Length(JSON.stringify(input)) > ADMIN_AI_MAX_CAPSULE_BYTES / 2) {
    return failure("context-ceiling-exceeded", "The saved-task context is too large.", 413);
  }
  return { ok: true, value: input };
}

export async function buildAdminAISubjectId(email: string, secret: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !secret) throw new Error("Admin subject identity is unavailable.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(normalized));
  return `admin_${hex(digest).slice(0, 40)}`;
}

export async function buildAdminAIContinuityActor(
  admin: {
    email: string;
    isOwner: boolean;
    modules: string[];
    permissions: string[];
    roleKey: string;
  },
  secret: string
): Promise<AdminAIContinuityActor> {
  return {
    isOwner: admin.isOwner,
    modules: [...admin.modules],
    permissionBoundaryHash: await buildAdminAIPermissionBoundaryHash(admin),
    permissions: [...admin.permissions],
    roleKey: admin.roleKey,
    subjectId: await buildAdminAISubjectId(admin.email, secret)
  };
}

export async function buildAdminAIPermissionBoundaryHash(input: {
  isOwner: boolean;
  modules: string[];
  permissions: string[];
  roleKey: string;
}) {
  return sha256(
    JSON.stringify({
      isOwner: input.isOwner,
      modules: [...new Set(input.modules)].sort(),
      permissions: [...new Set(input.permissions)].sort(),
      roleKey: input.roleKey.trim().toLowerCase()
    })
  );
}

export function isAdminAITaskReadableAt(
  task: { deletedAt: number | null; expiresAt: number },
  nowSeconds: number
) {
  return task.deletedAt === null && task.expiresAt > nowSeconds;
}

export async function createAdminAITask({
  actor,
  db,
  idempotencyKey,
  input,
  nowSeconds = currentSeconds()
}: {
  actor: AdminAIContinuityActor;
  db: D1Database;
  idempotencyKey: string;
  input: unknown;
  nowSeconds?: number;
}): Promise<ContinuityResult<AdminAITaskClient>> {
  await ensureAdminAIContinuitySchema(db);
  const normalized = normalizeAdminAITaskCreateInput(input);
  if (!normalized.ok) return normalized;
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return failure("idempotency-required", "A valid idempotency key is required.", 400);

  const keyHash = await sha256(key);
  const requestFingerprint = await sha256(JSON.stringify(normalized.value));
  const replay = await readIdempotency(db, actor.subjectId, "create", keyHash, nowSeconds);
  if (replay) {
    if (replay.requestFingerprint !== requestFingerprint) {
      return failure(
        "idempotency-conflict",
        "The idempotency key was already used for a different request.",
        409
      );
    }
    const existing = await readTask(db, actor.subjectId, replay.resultReference, nowSeconds);
    if (existing) return { ok: true, value: taskClient(existing) };
  }

  const taskId = crypto.randomUUID();
  const conversationId = crypto.randomUUID();
  const expiresAt = nowSeconds + ADMIN_AI_TASK_RETENTION_SECONDS;
  const createdAt = toIso(nowSeconds);
  const capsule: AdminAITaskCapsule = {
    adminSubjectId: actor.subjectId,
    artifactRefs: [],
    completedSteps: [],
    conversationId,
    createdAt,
    currentStep: null,
    decisions: [],
    expiresAt: toIso(expiresAt),
    goal: normalized.value.goal,
    lastActivityAt: createdAt,
    openQuestions: [],
    pinnedRequirements: normalized.value.pinnedRequirements,
    policy: { ...ADMIN_AI_SPEC_POLICY, ownerPolicyVersion: 1 },
    recentTurnDigests: [],
    safeConversationSummary: "",
    schemaVersion: 1,
    scope: normalized.value.scope,
    security: {
      lastValidatedAt: createdAt,
      permissionSnapshotHash: actor.permissionBoundaryHash,
      redactionVersion: 1
    },
    selectedEntityRefs: normalized.value.selectedEntityRefs,
    status: "active",
    taskId,
    version: 1
  };
  const capsuleJson = serializeCapsule(capsule);
  if (!capsuleJson)
    return failure("context-ceiling-exceeded", "The saved-task context is too large.", 413);
  const title = createTaskTitle(normalized.value.goal);

  await db.batch([
    db
      .prepare(
        `INSERT INTO admin_ai_tasks (
          id, admin_subject_id, title, status, scope_json, goal_summary, capsule_json,
          version, active_job_id, created_at, last_activity_at, expires_at, deleted_at
        ) VALUES (?, ?, ?, 'active', ?, ?, ?, 1, NULL, ?, ?, ?, NULL)`
      )
      .bind(
        taskId,
        actor.subjectId,
        title,
        JSON.stringify(normalized.value.scope),
        normalized.value.goal,
        capsuleJson,
        nowSeconds,
        nowSeconds,
        expiresAt
      ),
    db
      .prepare(
        `INSERT INTO admin_ai_conversations (
          id, task_id, status, safe_summary, created_at, closed_at, expires_at
        ) VALUES (?, ?, 'active', '', ?, NULL, ?)`
      )
      .bind(conversationId, taskId, nowSeconds, expiresAt),
    eventStatement(db, {
      actorSubjectId: actor.subjectId,
      conversationId,
      eventType: "task-created",
      expiresAt,
      fromStatus: null,
      occurredAt: nowSeconds,
      reasonCode: "created",
      taskId,
      taskVersion: 1,
      toStatus: "active"
    }),
    db
      .prepare(
        `INSERT INTO admin_ai_idempotency (
          admin_subject_id, operation, idempotency_key_hash, request_fingerprint,
          result_reference, created_at, expires_at
        ) VALUES (?, 'create', ?, ?, ?, ?, ?)`
      )
      .bind(actor.subjectId, keyHash, requestFingerprint, taskId, nowSeconds, expiresAt)
  ]);
  return {
    ok: true,
    value: taskClient({
      capsule_json: capsuleJson,
      created_at: nowSeconds,
      deleted_at: null,
      expires_at: expiresAt,
      goal_summary: normalized.value.goal,
      id: taskId,
      last_activity_at: nowSeconds,
      status: "active",
      title,
      version: 1
    })
  };
}

export async function listAdminAITasks({
  actor,
  db,
  nowSeconds = currentSeconds()
}: {
  actor: AdminAIContinuityActor;
  db: D1Database;
  nowSeconds?: number;
}) {
  await ensureAdminAIContinuitySchema(db);
  const rows = await db
    .prepare(
      `SELECT id, title, status, goal_summary, capsule_json, version, created_at,
              last_activity_at, expires_at, deleted_at
       FROM admin_ai_tasks
       WHERE admin_subject_id = ? AND deleted_at IS NULL AND expires_at > ?
       ORDER BY last_activity_at DESC
       LIMIT 50`
    )
    .bind(actor.subjectId, nowSeconds)
    .all<TaskRow>();
  return (rows.results || []).map(taskClient);
}

export async function getAdminAITaskPreview({
  actor,
  db,
  nowSeconds = currentSeconds(),
  taskId
}: {
  actor: AdminAIContinuityActor;
  db: D1Database;
  nowSeconds?: number;
  taskId: string;
}): Promise<ContinuityResult<AdminAITaskClient & { accessChanged: boolean }>> {
  await ensureAdminAIContinuitySchema(db);
  const row = await readTask(db, actor.subjectId, safeIdentifier(taskId, 100), nowSeconds);
  if (!row) return taskNotFound();
  const capsule = parseCapsule(row.capsule_json);
  return {
    ok: true,
    value: {
      ...taskClient(row),
      accessChanged: capsule.security.permissionSnapshotHash !== actor.permissionBoundaryHash
    }
  };
}

export async function getAdminAITaskExecutionContext({
  actor,
  db,
  expectedVersion,
  nowSeconds = currentSeconds(),
  taskId
}: {
  actor: AdminAIContinuityActor;
  db: D1Database;
  expectedVersion: number;
  nowSeconds?: number;
  taskId: string;
}): Promise<ContinuityResult<{ providerContext: string; task: AdminAITaskClient }>> {
  await ensureAdminAIContinuitySchema(db);
  const row = await readTask(db, actor.subjectId, safeIdentifier(taskId, 100), nowSeconds);
  if (!row) return taskNotFound();
  const capsule = parseCapsule(row.capsule_json);
  const access = validateCurrentBoundary(actor, capsule);
  if (!access.ok) return access;
  if (numberValue(row.version) !== expectedVersion) return taskVersionConflict(row);
  if (row.status === "cancelled") {
    return failure(
      "task-cancelled",
      "This saved task is cancelled and cannot accept new messages.",
      409
    );
  }
  const providerContext = JSON.stringify({
    completedSteps: capsule.completedSteps,
    currentStep: capsule.currentStep,
    decisions: capsule.decisions,
    goal: capsule.goal,
    openQuestions: capsule.openQuestions,
    pinnedRequirements: capsule.pinnedRequirements,
    policy: capsule.policy,
    recentTurnDigests: capsule.recentTurnDigests,
    safeConversationSummary: capsule.safeConversationSummary,
    scope: capsule.scope,
    selectedEntityRefs: capsule.selectedEntityRefs,
    taskId: capsule.taskId,
    version: capsule.version
  });
  if (utf8Length(providerContext) > ADMIN_AI_MAX_CAPSULE_BYTES) {
    return failure("context-ceiling-exceeded", "The saved-task context is too large.", 413);
  }
  return { ok: true, value: { providerContext, task: taskClient(row) } };
}

export async function resumeAdminAITask(
  args: TaskTransitionArgs
): Promise<ContinuityResult<AdminAITaskClient>> {
  return transitionAdminAITask({
    ...args,
    eventType: "task-resumed",
    reasonCode: "explicit-resume",
    requireUnchangedBoundary: true,
    startNewConversation: true,
    status: "active",
    updateCapsule: (capsule, now, conversationId) => ({
      ...capsule,
      conversationId,
      lastActivityAt: toIso(now),
      security: {
        ...capsule.security,
        lastValidatedAt: toIso(now)
      }
    })
  });
}

export async function cancelAdminAITask(
  args: TaskTransitionArgs
): Promise<ContinuityResult<AdminAITaskClient>> {
  return transitionAdminAITask({
    ...args,
    eventType: "task-cancelled",
    reasonCode: "user-cancelled",
    status: "cancelled"
  });
}

export async function retryAdminAITask(
  args: TaskTransitionArgs
): Promise<ContinuityResult<AdminAITaskClient>> {
  return transitionAdminAITask({
    ...args,
    eventType: "task-retry-requested",
    reasonCode: "explicit-retry",
    requireUnchangedBoundary: true,
    status: "active"
  });
}

export async function clearAdminAITaskContext(
  args: TaskTransitionArgs
): Promise<ContinuityResult<AdminAITaskClient>> {
  return transitionAdminAITask({
    ...args,
    closeConversation: true,
    eventType: "conversation-cleared",
    reasonCode: "user-cleared-context",
    status: "active",
    updateCapsule: (capsule, now) => ({
      ...capsule,
      conversationId: null,
      lastActivityAt: toIso(now),
      recentTurnDigests: [],
      safeConversationSummary: ""
    })
  });
}

export async function checkpointAdminAITask({
  actor,
  artifactId,
  assistantSummary,
  db,
  expectedVersion,
  idempotencyKey,
  nowSeconds = currentSeconds(),
  reasonCode,
  status,
  taskId,
  userSummary
}: {
  actor: AdminAIContinuityActor;
  artifactId?: string | null;
  assistantSummary: string;
  db: D1Database;
  expectedVersion: number;
  idempotencyKey: string;
  nowSeconds?: number;
  reasonCode?: unknown;
  status?: unknown;
  taskId: string;
  userSummary: string;
}): Promise<ContinuityResult<AdminAITaskClient>> {
  await ensureAdminAIContinuitySchema(db);
  const disposition = normalizeAdminAICheckpointDisposition(status, reasonCode);
  if (!disposition) {
    return failure(
      "invalid-checkpoint-disposition",
      "The task checkpoint status or reason code is invalid.",
      400
    );
  }
  const safeUser = safeText(redactAdminAIText(userSummary), 1_000);
  const safeAssistant = safeText(redactAdminAIText(assistantSummary), 4_000);
  if (
    !safeUser ||
    !safeAssistant ||
    containsSensitiveAdminAIText(safeUser) ||
    containsSensitiveAdminAIText(safeAssistant)
  ) {
    return failure("unsafe-input", "Unsafe task checkpoint content was rejected.", 400);
  }
  const row = await readTask(db, actor.subjectId, safeIdentifier(taskId, 100), nowSeconds);
  if (!row) return taskNotFound();
  const capsule = parseCapsule(row.capsule_json);
  const access = validateCurrentBoundary(actor, capsule);
  if (!access.ok) return access;
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return failure("idempotency-required", "A valid idempotency key is required.", 400);
  const fingerprint = await sha256(
    `${safeUser}\n${safeAssistant}\n${artifactId || ""}\n${disposition.status}\n${disposition.reasonCode}`
  );
  const keyHash = await sha256(key);
  const replay = await readIdempotency(db, actor.subjectId, "checkpoint", keyHash, nowSeconds);
  if (replay) {
    if (replay.requestFingerprint !== fingerprint) {
      return failure("idempotency-conflict", "The idempotency key is already in use.", 409);
    }
    return { ok: true, value: taskClient(row) };
  }
  if (numberValue(row.version) !== expectedVersion) return taskVersionConflict(row);

  const nextVersion = expectedVersion + 1;
  const expiresAt = nowSeconds + ADMIN_AI_TASK_RETENTION_SECONDS;
  const checkpointId = crypto.randomUUID();
  const conversationId = capsule.conversationId || crypto.randomUUID();
  const recentTurnDigests = [
    ...capsule.recentTurnDigests,
    { createdAt: toIso(nowSeconds), role: "user" as const, summary: safeUser },
    { createdAt: toIso(nowSeconds), role: "assistant" as const, summary: safeAssistant }
  ].slice(-ADMIN_AI_MAX_RECENT_TURN_DIGESTS);
  const nextCapsule: AdminAITaskCapsule = {
    ...capsule,
    artifactRefs: artifactId
      ? [...new Set([...capsule.artifactRefs, safeIdentifier(artifactId, 100)])].filter(Boolean)
      : capsule.artifactRefs,
    conversationId,
    expiresAt: toIso(expiresAt),
    lastActivityAt: toIso(nowSeconds),
    recentTurnDigests,
    safeConversationSummary: safeAssistant,
    status: disposition.status,
    version: nextVersion
  };
  const capsuleJson = serializeCapsule(nextCapsule);
  if (!capsuleJson)
    return failure("context-ceiling-exceeded", "The task checkpoint is too large.", 413);
  const update = db
    .prepare(
      `UPDATE admin_ai_tasks
       SET status = ?, capsule_json = ?, version = ?, last_activity_at = ?, expires_at = ?
       WHERE id = ? AND admin_subject_id = ? AND version = ?
         AND deleted_at IS NULL AND expires_at > ?`
    )
    .bind(
      disposition.status,
      capsuleJson,
      nextVersion,
      nowSeconds,
      expiresAt,
      row.id,
      actor.subjectId,
      expectedVersion,
      nowSeconds
    );
  const sequence = nextVersion;
  const checkpointStatements = [update];
  if (!capsule.conversationId) {
    checkpointStatements.push(
      db
        .prepare(
          `INSERT INTO admin_ai_conversations (
            id, task_id, status, safe_summary, created_at, closed_at, expires_at
          )
          SELECT ?, ?, 'active', '', ?, NULL, ?
          WHERE changes() = 1`
        )
        .bind(conversationId, row.id, nowSeconds, expiresAt)
    );
  }
  checkpointStatements.push(
    db
      .prepare(
        `INSERT INTO admin_ai_task_checkpoints (
          id, task_id, job_id, sequence, safe_checkpoint_json, artifact_id, created_at, expires_at
        )
        SELECT ?, ?, NULL, ?, ?, ?, ?, ?
        WHERE changes() = 1`
      )
      .bind(
        checkpointId,
        row.id,
        sequence,
        JSON.stringify({
          assistantSummary: safeAssistant,
          reasonCode: disposition.reasonCode,
          status: disposition.status,
          userSummary: safeUser
        }),
        artifactId ? safeIdentifier(artifactId, 100) : null,
        nowSeconds,
        expiresAt
      ),
    eventStatement(db, {
      actorSubjectId: actor.subjectId,
      conversationId,
      eventType: "checkpoint-committed",
      expiresAt: nowSeconds + ADMIN_AI_AUDIT_RETENTION_DAYS * 86_400,
      fromStatus: row.status,
      occurredAt: nowSeconds,
      requirePriorChange: true,
      reasonCode: disposition.reasonCode,
      taskId: row.id,
      taskVersion: nextVersion,
      toStatus: disposition.status
    }),
    db
      .prepare(
        `INSERT INTO admin_ai_idempotency (
          admin_subject_id, operation, idempotency_key_hash, request_fingerprint,
          result_reference, created_at, expires_at
        )
        SELECT ?, 'checkpoint', ?, ?, ?, ?, ?
        WHERE changes() = 1`
      )
      .bind(actor.subjectId, keyHash, fingerprint, checkpointId, nowSeconds, expiresAt)
  );
  const checkpointResults = await db.batch(checkpointStatements);
  if (!changed(checkpointResults[0])) return taskVersionConflict(row);
  return {
    ok: true,
    value: taskClient({
      ...row,
      capsule_json: capsuleJson,
      expires_at: expiresAt,
      last_activity_at: nowSeconds,
      status: disposition.status,
      version: nextVersion
    })
  };
}

export async function deleteAdminAITask({
  actor,
  db,
  expectedVersion,
  idempotencyKey,
  nowSeconds = currentSeconds(),
  taskId
}: {
  actor: AdminAIContinuityActor;
  db: D1Database;
  expectedVersion: number;
  idempotencyKey: string;
  nowSeconds?: number;
  taskId: string;
}): Promise<ContinuityResult<{ deleted: true }>> {
  await ensureAdminAIContinuitySchema(db);
  const safeTaskId = safeIdentifier(taskId, 100);
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!safeTaskId) return taskNotFound();
  if (!key) return failure("idempotency-required", "A valid idempotency key is required.", 400);
  const keyHash = await sha256(key);
  const fingerprint = await sha256(`${safeTaskId}|${expectedVersion}|delete`);
  const replay = await readIdempotency(db, actor.subjectId, "delete", keyHash, nowSeconds);
  if (replay) {
    if (replay.requestFingerprint !== fingerprint || replay.resultReference !== safeTaskId) {
      return failure("idempotency-conflict", "The idempotency key is already in use.", 409);
    }
    return { ok: true, value: { deleted: true } };
  }
  const row = await readTask(db, actor.subjectId, safeTaskId, nowSeconds);
  if (!row) return taskNotFound();
  if (numberValue(row.version) !== expectedVersion) return taskVersionConflict(row);
  const nextVersion = expectedVersion + 1;
  const update = db
    .prepare(
      `UPDATE admin_ai_tasks
       SET deleted_at = ?, version = ?, active_job_id = NULL
       WHERE id = ? AND admin_subject_id = ? AND version = ?
         AND deleted_at IS NULL AND expires_at > ?`
    )
    .bind(nowSeconds, nextVersion, row.id, actor.subjectId, expectedVersion, nowSeconds);
  const results = await db.batch([
    update,
    eventStatement(db, {
      actorSubjectId: actor.subjectId,
      conversationId: parseCapsule(row.capsule_json).conversationId,
      eventType: "task-deleted",
      expiresAt: nowSeconds + ADMIN_AI_AUDIT_RETENTION_DAYS * 86_400,
      fromStatus: row.status,
      occurredAt: nowSeconds,
      requirePriorChange: true,
      reasonCode: "explicit-delete",
      taskId: row.id,
      taskVersion: nextVersion,
      toStatus: row.status
    }),
    db
      .prepare(
        `INSERT INTO admin_ai_idempotency (
          admin_subject_id, operation, idempotency_key_hash, request_fingerprint,
          result_reference, created_at, expires_at
        )
        SELECT ?, 'delete', ?, ?, ?, ?, ?
        WHERE changes() = 1`
      )
      .bind(
        actor.subjectId,
        keyHash,
        fingerprint,
        row.id,
        nowSeconds,
        nowSeconds + ADMIN_AI_TASK_RETENTION_SECONDS
      )
  ]);
  if (!changed(results[0])) return failure("task-version-conflict", "The task changed.", 409);
  return { ok: true, value: { deleted: true } };
}

export const ADMIN_AI_CONTINUITY_PURGE_STATEMENTS = [
  `DELETE FROM admin_ai_idempotency WHERE rowid IN (
    SELECT rowid FROM admin_ai_idempotency WHERE expires_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_task_checkpoints WHERE rowid IN (
    SELECT rowid FROM admin_ai_task_checkpoints WHERE expires_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_conversations WHERE rowid IN (
    SELECT rowid FROM admin_ai_conversations WHERE expires_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_task_events WHERE rowid IN (
    SELECT rowid FROM admin_ai_task_events WHERE expires_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_tasks WHERE rowid IN (
    SELECT rowid FROM admin_ai_tasks WHERE expires_at <= ?1 LIMIT ?2
  )`
] as const;

export async function purgeExpiredAdminAIContinuity({
  batchSize = 250,
  db,
  nowSeconds = currentSeconds()
}: {
  batchSize?: number;
  db: D1Database;
  nowSeconds?: number;
}) {
  await ensureAdminAIContinuitySchema(db);
  const limit = Math.max(1, Math.min(1_000, Math.floor(batchSize)));
  const results = await db.batch(
    ADMIN_AI_CONTINUITY_PURGE_STATEMENTS.map((sql) => db.prepare(sql).bind(nowSeconds, limit))
  );
  return results.reduce((total, result) => total + Number(result.meta?.changes || 0), 0);
}

type TaskTransitionArgs = {
  actor: AdminAIContinuityActor;
  db: D1Database;
  expectedVersion: number;
  idempotencyKey: string;
  nowSeconds?: number;
  taskId: string;
};

async function transitionAdminAITask(
  args: TaskTransitionArgs & {
    closeConversation?: boolean;
    eventType: string;
    reasonCode: string;
    requireUnchangedBoundary?: boolean;
    startNewConversation?: boolean;
    status: AdminAITaskStatus;
    updateCapsule?: (
      capsule: AdminAITaskCapsule,
      nowSeconds: number,
      conversationId: string | null
    ) => AdminAITaskCapsule;
  }
): Promise<ContinuityResult<AdminAITaskClient>> {
  await ensureAdminAIContinuitySchema(args.db);
  const row = await readTask(
    args.db,
    args.actor.subjectId,
    safeIdentifier(args.taskId, 100),
    args.nowSeconds || currentSeconds()
  );
  if (!row) return taskNotFound();
  const now = args.nowSeconds || currentSeconds();
  const capsule = parseCapsule(row.capsule_json);
  const access = validateCurrentBoundary(args.actor, capsule);
  if (args.requireUnchangedBoundary && !access.ok) {
    await blockTaskForAccessChange(args.db, args.actor, row, capsule, now);
    return access;
  }
  const key = normalizeIdempotencyKey(args.idempotencyKey);
  if (!key) return failure("idempotency-required", "A valid idempotency key is required.", 400);
  const keyHash = await sha256(key);
  const fingerprint = await sha256(`${row.id}|${args.expectedVersion}|${args.eventType}`);
  const replay = await readIdempotency(args.db, args.actor.subjectId, args.eventType, keyHash, now);
  if (replay) {
    if (replay.requestFingerprint !== fingerprint) {
      return failure("idempotency-conflict", "The idempotency key is already in use.", 409);
    }
    return { ok: true, value: taskClient(row) };
  }
  if (numberValue(row.version) !== args.expectedVersion) return taskVersionConflict(row);

  const priorConversationId = capsule.conversationId;
  let conversationId = priorConversationId;
  const expiry = now + ADMIN_AI_TASK_RETENTION_SECONDS;
  if (args.closeConversation) {
    conversationId = null;
  } else if (args.startNewConversation) {
    conversationId = crypto.randomUUID();
  }

  const nextVersion = args.expectedVersion + 1;
  const baseCapsule: AdminAITaskCapsule = {
    ...capsule,
    conversationId,
    expiresAt: toIso(expiry),
    lastActivityAt: toIso(now),
    status: args.status,
    version: nextVersion
  };
  const nextCapsule = args.updateCapsule
    ? args.updateCapsule(baseCapsule, now, conversationId)
    : baseCapsule;
  const capsuleJson = serializeCapsule(nextCapsule);
  if (!capsuleJson)
    return failure("context-ceiling-exceeded", "The saved-task context is too large.", 413);
  const statements = [
    args.db
      .prepare(
        `UPDATE admin_ai_tasks
         SET status = ?, capsule_json = ?, version = ?, last_activity_at = ?,
             expires_at = ?, active_job_id = NULL
         WHERE id = ? AND admin_subject_id = ? AND version = ?
           AND deleted_at IS NULL AND expires_at > ?`
      )
      .bind(
        args.status,
        capsuleJson,
        nextVersion,
        now,
        expiry,
        row.id,
        args.actor.subjectId,
        args.expectedVersion,
        now
      )
  ];
  statements.push(
    eventStatement(args.db, {
      actorSubjectId: args.actor.subjectId,
      conversationId,
      eventType: args.eventType,
      expiresAt: now + ADMIN_AI_AUDIT_RETENTION_DAYS * 86_400,
      fromStatus: row.status,
      occurredAt: now,
      requirePriorChange: true,
      reasonCode: args.reasonCode,
      taskId: row.id,
      taskVersion: nextVersion,
      toStatus: args.status
    }),
    args.db
      .prepare(
        `INSERT INTO admin_ai_idempotency (
          admin_subject_id, operation, idempotency_key_hash, request_fingerprint,
          result_reference, created_at, expires_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE changes() = 1`
      )
      .bind(args.actor.subjectId, args.eventType, keyHash, fingerprint, row.id, now, expiry)
  );
  if ((args.closeConversation || args.startNewConversation) && priorConversationId) {
    statements.push(
      args.db
        .prepare(
          `UPDATE admin_ai_conversations
           SET status = 'closed', closed_at = ?
           WHERE id = ? AND task_id = ? AND status = 'active' AND changes() = 1`
        )
        .bind(now, priorConversationId, row.id)
    );
  }
  if (args.startNewConversation && conversationId) {
    statements.push(
      args.db
        .prepare(
          `INSERT INTO admin_ai_conversations (
            id, task_id, status, safe_summary, created_at, closed_at, expires_at
          )
          SELECT ?, ?, 'active', ?, ?, NULL, ?
          WHERE changes() = 1`
        )
        .bind(conversationId, row.id, capsule.safeConversationSummary, now, expiry)
    );
  }
  const results = await args.db.batch(statements);
  if (!changed(results[0])) return taskVersionConflict(row);
  return {
    ok: true,
    value: taskClient({
      ...row,
      capsule_json: capsuleJson,
      expires_at: expiry,
      last_activity_at: now,
      status: args.status,
      version: nextVersion
    })
  };
}

function validateCurrentBoundary(
  actor: AdminAIContinuityActor,
  capsule: AdminAITaskCapsule
): ContinuityResult<true> {
  if (capsule.adminSubjectId !== actor.subjectId) return taskNotFound();
  if (capsule.security.permissionSnapshotHash !== actor.permissionBoundaryHash) {
    return failure(
      "access-changed",
      "Permissions changed. This saved task is blocked until an authorized review.",
      409
    );
  }
  const required = new Set(capsule.selectedEntityRefs.flatMap((ref) => ref.requiredPermissions));
  if (
    !actor.isOwner &&
    [...required].some((permission) => !actor.permissions.includes(permission))
  ) {
    return failure(
      "access-changed",
      "A required capability is no longer available for this saved task.",
      409
    );
  }
  return { ok: true, value: true };
}

async function blockTaskForAccessChange(
  db: D1Database,
  actor: AdminAIContinuityActor,
  row: TaskRow,
  capsule: AdminAITaskCapsule,
  now: number
) {
  const nextVersion = numberValue(row.version) + 1;
  const nextCapsule = {
    ...capsule,
    status: "blocked-access-changed" as const,
    version: nextVersion
  };
  const serialized = serializeCapsule(nextCapsule);
  if (!serialized) return;
  await db.batch([
    db
      .prepare(
        `UPDATE admin_ai_tasks
         SET status = 'blocked-access-changed', capsule_json = ?, version = ?
         WHERE id = ? AND admin_subject_id = ? AND version = ?`
      )
      .bind(serialized, nextVersion, row.id, actor.subjectId, numberValue(row.version)),
    eventStatement(db, {
      actorSubjectId: actor.subjectId,
      conversationId: capsule.conversationId,
      eventType: "access-changed",
      expiresAt: now + ADMIN_AI_AUDIT_RETENTION_DAYS * 86_400,
      fromStatus: row.status,
      occurredAt: now,
      requirePriorChange: true,
      reasonCode: "permission-boundary-changed",
      taskId: row.id,
      taskVersion: nextVersion,
      toStatus: "blocked-access-changed"
    })
  ]);
}

async function readTask(db: D1Database, subjectId: string, taskId: string, nowSeconds: number) {
  if (!taskId) return null;
  return db
    .prepare(
      `SELECT id, title, status, goal_summary, capsule_json, version, created_at,
              last_activity_at, expires_at, deleted_at
       FROM admin_ai_tasks
       WHERE id = ? AND admin_subject_id = ? AND deleted_at IS NULL AND expires_at > ?`
    )
    .bind(taskId, subjectId, nowSeconds)
    .first<TaskRow>();
}

async function readIdempotency(
  db: D1Database,
  subjectId: string,
  operation: string,
  keyHash: string,
  nowSeconds: number
) {
  const row = await db
    .prepare(
      `SELECT request_fingerprint, result_reference
       FROM admin_ai_idempotency
       WHERE admin_subject_id = ? AND operation = ? AND idempotency_key_hash = ?
         AND expires_at > ?`
    )
    .bind(subjectId, operation, keyHash, nowSeconds)
    .first<{ request_fingerprint: string; result_reference: string }>();
  return row
    ? {
        requestFingerprint: row.request_fingerprint,
        resultReference: row.result_reference
      }
    : null;
}

function eventStatement(
  db: D1Database,
  input: {
    actorSubjectId: string;
    conversationId: string | null;
    eventType: string;
    expiresAt: number;
    fromStatus: string | null;
    occurredAt: number;
    requirePriorChange?: boolean;
    reasonCode: string;
    taskId: string;
    taskVersion: number;
    toStatus: string;
  }
) {
  return db
    .prepare(
      `INSERT INTO admin_ai_task_events (
        id, task_id, conversation_id, event_type, from_status, to_status,
        actor_subject_id, safe_reason_code, task_version, occurred_at, expires_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      ${input.requirePriorChange ? "WHERE changes() = 1" : ""}`
    )
    .bind(
      crypto.randomUUID(),
      input.taskId,
      input.conversationId,
      input.eventType,
      input.fromStatus,
      input.toStatus,
      input.actorSubjectId,
      input.reasonCode,
      input.taskVersion,
      input.occurredAt,
      input.expiresAt
    );
}

function taskClient(row: TaskRow): AdminAITaskClient {
  const capsule = parseCapsule(row.capsule_json);
  return {
    artifactCount: capsule.artifactRefs.length,
    conversationId: capsule.conversationId,
    expiresAt: toIso(numberValue(row.expires_at)),
    goal: row.goal_summary,
    id: row.id,
    lastActivityAt: toIso(numberValue(row.last_activity_at)),
    lastSafeStep: capsule.completedSteps.at(-1)?.summary || capsule.safeConversationSummary || null,
    scope: capsule.scope,
    status: row.status,
    title: row.title,
    version: numberValue(row.version)
  };
}

function parseCapsule(value: string): AdminAITaskCapsule {
  const parsed = JSON.parse(value) as AdminAITaskCapsule;
  if (
    parsed.schemaVersion !== 1 ||
    !parsed.taskId ||
    !parsed.adminSubjectId ||
    !parsed.security?.permissionSnapshotHash
  ) {
    throw new Error("Invalid Admin AI task capsule.");
  }
  return parsed;
}

function serializeCapsule(capsule: AdminAITaskCapsule) {
  const value = JSON.stringify(capsule);
  return utf8Length(value) <= ADMIN_AI_MAX_CAPSULE_BYTES ? value : null;
}

function normalizePinnedRequirements(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > ADMIN_AI_MAX_PINNED_REQUIREMENTS) return null;
  const output = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = safeIdentifier(item.id, 100);
    const rawText = safeText(item.text, 500);
    const text = safeText(redactAdminAIText(rawText), 500);
    const source = safeText(item.source, 100) || "user-confirmed";
    if (!id || !rawText || !text || containsSensitiveAdminAIText(rawText)) return null;
    output.push({ id, source, text });
  }
  return output;
}

function normalizeSelectedEntityRefs(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > ADMIN_AI_MAX_SELECTED_ENTITY_REFS) return null;
  const output: AdminAISelectedEntityRef[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const id = safeIdentifier(item.id, 120);
    const type = safeIdentifier(item.type, 80);
    const requiredPermissions = uniqueIdentifiers(item.requiredPermissions, 20, 120);
    const sourceVersion =
      item.sourceVersion === null || item.sourceVersion === undefined
        ? null
        : safeText(item.sourceVersion, 120);
    if (!id || !type || !requiredPermissions || (item.sourceVersion && !sourceVersion)) return null;
    output.push({ id, requiredPermissions, sourceVersion, type });
  }
  return output;
}

function uniqueIdentifiers(value: unknown, maximum: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const output = value.map((item) => safeIdentifier(item, maxLength));
  if (output.some((item) => !item)) return null;
  return [...new Set(output)];
}

function containsSensitiveAdminAIText(value: string) {
  return sensitivePattern.test(value);
}

function createTaskTitle(goal: string) {
  const title = goal.split(/[\r\n.!?]/, 1)[0]?.trim() || "Saved Admin AI task";
  return title.slice(0, 100);
}

function normalizeIdempotencyKey(value: string) {
  const key = value.trim();
  return key.length >= 12 && key.length <= 200 && identifierPattern.test(key) ? key : "";
}

function safeIdentifier(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length <= maxLength && identifierPattern.test(text) ? text : "";
}

function safeText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text && text.length <= maxLength ? text : "";
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function hex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toIso(seconds: number) {
  return new Date(seconds * 1_000).toISOString();
}

function currentSeconds() {
  return Math.floor(Date.now() / 1_000);
}

function numberValue(value: number | string | undefined | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}

function changed(result: { meta?: { changes?: number } }) {
  return Number(result.meta?.changes || 0) === 1;
}

function taskNotFound(): ContinuityResult<never> {
  return failure("task-not-found", "Saved task was not found.", 404);
}

function taskVersionConflict(row: TaskRow): ContinuityResult<never> {
  return failure(
    "task-version-conflict",
    `The saved task changed. Reload version ${numberValue(row.version)} before retrying.`,
    409
  );
}

function failure(code: string, message: string, status: number): ContinuityResult<never> {
  return { code, message, ok: false, status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
