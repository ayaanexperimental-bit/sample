import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";

export const ADMIN_AI_ARTIFACT_KINDS = [
  "report",
  "checklist",
  "action-plan",
  "incident-summary",
  "coach-performance-summary",
  "publish-readiness-review",
  "error-investigation",
  "configuration-comparison",
  "migration-checklist"
] as const;
export const ADMIN_AI_ARTIFACT_EXPORT_FORMATS = ["txt", "md", "json"] as const;

export type AdminAIArtifactActor = { email: string; isOwner: boolean };
export type AdminAIArtifactKind = (typeof ADMIN_AI_ARTIFACT_KINDS)[number];
export type AdminAIArtifactExportFormat = (typeof ADMIN_AI_ARTIFACT_EXPORT_FORMATS)[number];
export type AdminAIGeneratedArtifactKind =
  | "checklist"
  | "configuration-comparison"
  | "migration-checklist";
export type AdminAIArtifactGenerationEntry = {
  currentValue?: string;
  label: string;
  status?: "blocked" | "complete" | "pending";
  targetValue?: string;
};

export type AdminAIArtifact = {
  approval: {
    decidedAt: string | null;
    decidedBy: string | null;
    decisionReason: string | null;
    requestedAt: string | null;
    requestedBy: string | null;
    savedAt: string | null;
    savedBy: string | null;
    status: "approved" | "not-requested" | "pending" | "rejected" | "saved";
  };
  content: string;
  copyable: { characterCount: number; enabled: true; mimeType: "text/markdown" | "text/plain" };
  createdAt: string;
  creatorEmail: string;
  deletedAt: string | null;
  deletedBy: string | null;
  editorEmails: string[];
  exportFormats: AdminAIArtifactExportFormat[];
  id: string;
  kind: AdminAIArtifactKind;
  regeneratedAt: string | null;
  regenerationCount: number;
  sourceContext: {
    module: string;
    referenceIds: string[];
    requestId: string | null;
    scope: "global" | "record" | "section" | "selection";
  };
  title: string;
  updatedAt: string;
  version: number;
  viewerEmails: string[];
};

export type AdminAIArtifactMutationResult =
  | { artifact: AdminAIArtifact; ok: true; status: 200 | 201 }
  | {
      code: "conflict" | "forbidden" | "invalid" | "not-found" | "unavailable";
      message: string;
      ok: false;
      status: 400 | 403 | 404 | 409 | 503;
    };

type ArtifactRow = {
  created_at: number | string;
  creator_email: string;
  deleted_at: number | string | null;
  deleted_by: string | null;
  id: string;
  state_json: string;
  updated_at: number | string;
  version: number | string;
};

export type NormalizedCreateInput = {
  content: string;
  editorEmails: string[];
  exportFormats: AdminAIArtifactExportFormat[];
  kind: AdminAIArtifactKind;
  sourceContext: AdminAIArtifact["sourceContext"];
  title: string;
  viewerEmails: string[];
};

const schemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const CREATE_KEYS = new Set([
  "content",
  "editorEmails",
  "exportFormats",
  "kind",
  "sourceContext",
  "title",
  "viewerEmails"
]);
const SOURCE_CONTEXT_KEYS = new Set(["module", "referenceIds", "requestId", "scope"]);
const GENERATED_ARTIFACT_KINDS = new Set<AdminAIGeneratedArtifactKind>([
  "checklist",
  "configuration-comparison",
  "migration-checklist"
]);
const ARTIFACT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_artifacts (
    id TEXT PRIMARY KEY,
    creator_email TEXT NOT NULL,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    deleted_by TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_artifacts_creator_updated
   ON admin_ai_artifacts (creator_email, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_artifacts_active_updated
   ON admin_ai_artifacts (deleted_at, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_artifact_events (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'created', 'regenerated', 'permissions-updated', 'report-save-requested',
      'report-save-approved', 'report-save-rejected', 'saved-to-reports', 'deleted'
    )),
    actor_email TEXT NOT NULL,
    artifact_version INTEGER NOT NULL CHECK (artifact_version > 0),
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_artifact_events_artifact_occurred
   ON admin_ai_artifact_events (artifact_id, occurred_at, id)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_artifact_reports (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`
] as const;

export async function ensureAdminAIArtifactSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: schemaCache,
    db,
    setup: async () => {
      for (const statement of ARTIFACT_SCHEMA) await db.prepare(statement).run();
    }
  });
}

export function validateAdminAIArtifactCreateInput(
  value: unknown
): { input: NormalizedCreateInput; ok: true } | { error: string; ok: false } {
  if (!isRecord(value) || hasUnknownKeys(value, CREATE_KEYS)) {
    return invalidCreate("Invalid artifact create fields.");
  }
  if (!ADMIN_AI_ARTIFACT_KINDS.includes(value.kind as AdminAIArtifactKind)) {
    return invalidCreate("Invalid artifact kind.");
  }
  const title = cleanSingleLine(value.title, 160);
  const content = cleanContent(value.content, 100_000);
  if (!title || !content) return invalidCreate("Artifact title and content are required.");

  const sourceContext = normalizeSourceContext(value.sourceContext);
  if (!sourceContext) return invalidCreate("Invalid artifact source context.");
  const exportFormats = normalizeExportFormats(value.exportFormats);
  if (!exportFormats) return invalidCreate("Invalid artifact export formats.");
  const viewerEmails = normalizeEmailList(value.viewerEmails);
  const editorEmails = normalizeEmailList(value.editorEmails);
  if (!viewerEmails || !editorEmails) return invalidCreate("Invalid artifact permission list.");

  return {
    input: {
      content,
      editorEmails,
      exportFormats,
      kind: value.kind as AdminAIArtifactKind,
      sourceContext,
      title,
      viewerEmails: viewerEmails.filter((email) => !editorEmails.includes(email))
    },
    ok: true
  };
}

export function generateAdminAIArtifactCreateInput(input: {
  editorEmails?: string[];
  entries: AdminAIArtifactGenerationEntry[];
  kind: AdminAIGeneratedArtifactKind;
  sourceContext: AdminAIArtifact["sourceContext"];
  title: string;
  viewerEmails?: string[];
}):
  | { error: string; ok: false }
  | { input: NormalizedCreateInput & { operation: "create" }; ok: true } {
  if (
    !GENERATED_ARTIFACT_KINDS.has(input.kind) ||
    !Array.isArray(input.entries) ||
    input.entries.length < 1 ||
    input.entries.length > 100
  ) {
    return invalidCreate("Invalid generated artifact entries.");
  }

  const entries = input.entries.map((entry) => ({
    currentValue: cleanSingleLine(entry?.currentValue, 500),
    label: cleanSingleLine(entry?.label, 500),
    status: entry?.status || "pending",
    targetValue: cleanSingleLine(entry?.targetValue, 500)
  }));
  if (
    entries.some(
      (entry) =>
        !entry.label ||
        !["blocked", "complete", "pending"].includes(entry.status) ||
        (input.kind === "configuration-comparison" && (!entry.currentValue || !entry.targetValue))
    )
  ) {
    return invalidCreate("Invalid generated artifact entry.");
  }

  const content =
    input.kind === "configuration-comparison"
      ? [
          "| Setting | Current | Target |",
          "| --- | --- | --- |",
          ...entries.map(
            (entry) =>
              `| ${markdownCell(entry.label)} | ${markdownCell(entry.currentValue)} | ${markdownCell(entry.targetValue)} |`
          )
        ].join("\n")
      : entries
          .map(
            (entry) =>
              `- [${entry.status === "complete" ? "x" : " "}] ${entry.label}${entry.status === "blocked" ? " (blocked)" : ""}`
          )
          .join("\n");
  const validated = validateAdminAIArtifactCreateInput({
    content,
    editorEmails: input.editorEmails || [],
    exportFormats: ["md", "json"],
    kind: input.kind,
    sourceContext: input.sourceContext,
    title: input.title,
    viewerEmails: input.viewerEmails || []
  });
  return validated.ok
    ? { input: { ...validated.input, operation: "create" }, ok: true }
    : validated;
}

export async function listAdminAIArtifacts({
  actor,
  db,
  includeDeleted = false
}: {
  actor: AdminAIArtifactActor;
  db: D1Database;
  includeDeleted?: boolean;
}) {
  const safeActor = normalizeActor(actor);
  if (!safeActor) return [];
  await ensureAdminAIArtifactSchema(db);
  const rows = await db
    .prepare(
      `SELECT id, creator_email, state_json, version, created_at, updated_at, deleted_at, deleted_by
       FROM admin_ai_artifacts
       WHERE (
         ?1 = 1
         OR creator_email = ?2
         OR EXISTS (
           SELECT 1 FROM json_each(admin_ai_artifacts.state_json, '$.viewerEmails') AS viewer
           WHERE viewer.value = ?2
         )
         OR EXISTS (
           SELECT 1 FROM json_each(admin_ai_artifacts.state_json, '$.editorEmails') AS editor
           WHERE editor.value = ?2
         )
       )
       AND (deleted_at IS NULL OR (?1 = 1 AND ?3 = 1))
       AND updated_at > ?4
       ORDER BY updated_at DESC, id LIMIT 100`
    )
    .bind(
      safeActor.isOwner ? 1 : 0,
      safeActor.email,
      includeDeleted ? 1 : 0,
      getAdminAIRetentionCutoffSeconds()
    )
    .all<ArtifactRow>();
  return (rows.results || [])
    .map(parseArtifactRow)
    .filter(
      (artifact) =>
        canViewArtifact(artifact, safeActor) &&
        (!artifact.deletedAt || (includeDeleted && safeActor.isOwner))
    );
}

export async function getAdminAIArtifact({
  actor,
  artifactId,
  db,
  includeDeleted = false
}: {
  actor: AdminAIArtifactActor;
  artifactId: string;
  db: D1Database;
  includeDeleted?: boolean;
}): Promise<AdminAIArtifactMutationResult> {
  const safeActor = normalizeActor(actor);
  const id = parseIdentifier(artifactId, 120);
  if (!safeActor || !id) return failure("invalid", "Invalid artifact request.", 400);
  const artifact = await readArtifact(db, id);
  if (
    !artifact ||
    !canViewArtifact(artifact, safeActor) ||
    (artifact.deletedAt && !(includeDeleted && safeActor.isOwner))
  ) {
    return failure("not-found", "Artifact not found.", 404);
  }
  return { artifact, ok: true, status: 200 };
}

export async function mutateAdminAIArtifact({
  actor,
  db,
  input
}: {
  actor: AdminAIArtifactActor;
  db: D1Database;
  input: unknown;
}): Promise<AdminAIArtifactMutationResult> {
  const safeActor = normalizeActor(actor);
  if (!safeActor || !isRecord(input)) return failure("invalid", "Invalid artifact request.", 400);
  const operation = input.operation;
  if (operation === "create") return createArtifact(db, safeActor, input);

  const operationKeys = artifactOperationKeys(operation);
  if (!operationKeys || hasUnknownKeys(input, operationKeys)) {
    return failure("invalid", "Invalid artifact operation fields.", 400);
  }
  const artifactId = parseIdentifier(input.artifactId, 120);
  const expectedVersion = positiveInteger(input.expectedVersion);
  if (!artifactId || !expectedVersion)
    return failure("invalid", "Invalid artifact operation.", 400);

  const artifact = await readArtifact(db, artifactId);
  if (!artifact || artifact.deletedAt) return failure("not-found", "Artifact not found.", 404);
  if (!canEditArtifact(artifact, safeActor)) {
    return failure("forbidden", "Artifact edit permission is required.", 403);
  }
  if (artifact.version !== expectedVersion) {
    return failure("conflict", "The artifact changed before this update.", 409);
  }

  if (operation === "regenerate") {
    const content = cleanContent(input.content, 100_000);
    const title = input.title === undefined ? artifact.title : cleanSingleLine(input.title, 160);
    if (!content || !title) return failure("invalid", "Invalid artifact regeneration.", 400);
    const now = nowIso();
    return persistArtifactUpdate({
      artifact: {
        ...artifact,
        approval: emptyApproval(),
        content,
        copyable: copyableMetadata(content, artifact.exportFormats),
        regeneratedAt: now,
        regenerationCount: artifact.regenerationCount + 1,
        title
      },
      db,
      eventType: "regenerated",
      actor: safeActor,
      expectedVersion
    });
  }

  if (operation === "permissions") {
    const viewerEmails = normalizeEmailList(input.viewerEmails);
    const editorEmails = normalizeEmailList(input.editorEmails);
    if (!viewerEmails || !editorEmails) {
      return failure("invalid", "Invalid artifact permission list.", 400);
    }
    return persistArtifactUpdate({
      artifact: {
        ...artifact,
        editorEmails: editorEmails.filter((email) => email !== artifact.creatorEmail),
        viewerEmails: viewerEmails.filter(
          (email) => email !== artifact.creatorEmail && !editorEmails.includes(email)
        )
      },
      db,
      eventType: "permissions-updated",
      actor: safeActor,
      expectedVersion
    });
  }

  if (operation === "request-report-save") {
    if (!["not-requested", "rejected"].includes(artifact.approval.status)) {
      return failure("conflict", "Report-save approval is already active or complete.", 409);
    }
    const requestedAt = nowIso();
    return persistArtifactUpdate({
      artifact: {
        ...artifact,
        approval: {
          ...emptyApproval(),
          requestedAt,
          requestedBy: safeActor.email,
          status: "pending"
        }
      },
      db,
      eventType: "report-save-requested",
      actor: safeActor,
      expectedVersion
    });
  }

  if (operation === "decide-report-save") {
    if (!safeActor.isOwner) return failure("forbidden", "Owner approval is required.", 403);
    if (artifact.approval.status !== "pending") {
      return failure("conflict", "No report-save approval is pending.", 409);
    }
    if (input.decision !== "approve" && input.decision !== "reject") {
      return failure("invalid", "Invalid report-save decision.", 400);
    }
    const reason = cleanSingleLine(input.reason, 240);
    if (!reason) return failure("invalid", "A report-save decision reason is required.", 400);
    const approved = input.decision === "approve";
    return persistArtifactUpdate({
      artifact: {
        ...artifact,
        approval: {
          ...artifact.approval,
          decidedAt: nowIso(),
          decidedBy: safeActor.email,
          decisionReason: reason,
          status: approved ? "approved" : "rejected"
        }
      },
      db,
      eventType: approved ? "report-save-approved" : "report-save-rejected",
      actor: safeActor,
      expectedVersion
    });
  }

  if (operation === "save-to-reports") {
    if (artifact.approval.status !== "approved") {
      return failure("conflict", "Owner approval is required before saving to Reports.", 409);
    }
    const savedAt = nowIso();
    return persistArtifactUpdate({
      artifact: {
        ...artifact,
        approval: {
          ...artifact.approval,
          savedAt,
          savedBy: safeActor.email,
          status: "saved"
        }
      },
      db,
      eventType: "saved-to-reports",
      actor: safeActor,
      expectedVersion,
      saveReport: true
    });
  }

  if (operation === "delete") {
    const deletedAt = nowIso();
    return persistArtifactUpdate({
      artifact: { ...artifact, deletedAt, deletedBy: safeActor.email },
      db,
      eventType: "deleted",
      actor: safeActor,
      expectedVersion
    });
  }

  return failure("invalid", "Invalid artifact operation.", 400);
}

async function createArtifact(
  db: D1Database,
  actor: AdminAIArtifactActor,
  value: Record<string, unknown>
): Promise<AdminAIArtifactMutationResult> {
  const allowed = new Set(["operation", ...CREATE_KEYS]);
  if (hasUnknownKeys(value, allowed))
    return failure("invalid", "Invalid artifact create fields.", 400);
  const candidate = { ...value };
  delete candidate.operation;
  const validated = validateAdminAIArtifactCreateInput(candidate);
  if (!validated.ok) return failure("invalid", validated.error, 400);
  await ensureAdminAIArtifactSchema(db);

  const now = nowIso();
  const id = `admin-ai-artifact-${crypto.randomUUID()}`;
  const artifact: AdminAIArtifact = {
    approval: emptyApproval(),
    content: validated.input.content,
    copyable: copyableMetadata(validated.input.content, validated.input.exportFormats),
    createdAt: now,
    creatorEmail: actor.email,
    deletedAt: null,
    deletedBy: null,
    editorEmails: validated.input.editorEmails.filter((email) => email !== actor.email),
    exportFormats: validated.input.exportFormats,
    id,
    kind: validated.input.kind,
    regeneratedAt: null,
    regenerationCount: 0,
    sourceContext: validated.input.sourceContext,
    title: validated.input.title,
    updatedAt: now,
    version: 1,
    viewerEmails: validated.input.viewerEmails.filter(
      (email) => email !== actor.email && !validated.input.editorEmails.includes(email)
    )
  };
  const seconds = toEpochSeconds(now);
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO admin_ai_artifacts (
          id, creator_email, state_json, version, created_at, updated_at, deleted_at, deleted_by
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      )
      .bind(id, actor.email, JSON.stringify(artifact), 1, seconds, seconds, null, null),
    eventInsert(db, id, "created", actor.email, 1, seconds)
  ]);
  return hasOneChangeEach(results, 2)
    ? { artifact, ok: true, status: 201 }
    : failure("unavailable", "Artifact storage is unavailable.", 503);
}

async function persistArtifactUpdate({
  actor,
  artifact,
  db,
  eventType,
  expectedVersion,
  saveReport = false
}: {
  actor: AdminAIArtifactActor;
  artifact: AdminAIArtifact;
  db: D1Database;
  eventType:
    | "deleted"
    | "permissions-updated"
    | "regenerated"
    | "report-save-approved"
    | "report-save-rejected"
    | "report-save-requested"
    | "saved-to-reports";
  expectedVersion: number;
  saveReport?: boolean;
}): Promise<AdminAIArtifactMutationResult> {
  const now = nowIso();
  const updated: AdminAIArtifact = {
    ...artifact,
    updatedAt: now,
    version: expectedVersion + 1
  };
  const seconds = toEpochSeconds(now);
  const statements = [
    db
      .prepare(
        `UPDATE admin_ai_artifacts
         SET state_json = ?1, version = ?2, updated_at = ?3, deleted_at = ?4, deleted_by = ?5
         WHERE id = ?6 AND version = ?7 AND deleted_at IS NULL`
      )
      .bind(
        JSON.stringify(updated),
        updated.version,
        seconds,
        updated.deletedAt ? toEpochSeconds(updated.deletedAt) : null,
        updated.deletedBy,
        updated.id,
        expectedVersion
      )
  ];
  if (saveReport) {
    statements.push(
      db
        .prepare(
          `INSERT INTO admin_ai_artifact_reports (
            id, artifact_id, title, content, kind, created_by, created_at
          ) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE changes() = 1`
        )
        .bind(
          `admin-ai-artifact-report-${crypto.randomUUID()}`,
          updated.id,
          updated.title,
          updated.content,
          updated.kind,
          actor.email,
          seconds
        )
    );
  }
  statements.push(eventInsert(db, updated.id, eventType, actor.email, updated.version, seconds));
  const results = await db.batch(statements);
  return hasOneChangeEach(results, statements.length)
    ? { artifact: updated, ok: true, status: 200 }
    : failure("conflict", "The artifact changed before this update.", 409);
}

async function readArtifact(db: D1Database, id: string) {
  await ensureAdminAIArtifactSchema(db);
  const row = await db
    .prepare(
      `SELECT id, creator_email, state_json, version, created_at, updated_at, deleted_at, deleted_by
       FROM admin_ai_artifacts WHERE id = ?1 AND updated_at > ?2 LIMIT 1`
    )
    .bind(id, getAdminAIRetentionCutoffSeconds())
    .first<ArtifactRow>();
  return row ? parseArtifactRow(row) : null;
}

function parseArtifactRow(row: ArtifactRow): AdminAIArtifact {
  const parsed = JSON.parse(row.state_json) as unknown;
  if (
    !isRecord(parsed) ||
    parsed.id !== row.id ||
    parsed.creatorEmail !== normalizeEmail(row.creator_email) ||
    parsed.version !== Number(row.version) ||
    !ADMIN_AI_ARTIFACT_KINDS.includes(parsed.kind as AdminAIArtifactKind) ||
    !Array.isArray(parsed.viewerEmails) ||
    !Array.isArray(parsed.editorEmails)
  ) {
    throw new Error("Invalid persisted Admin AI artifact.");
  }
  return parsed as AdminAIArtifact;
}

function artifactOperationKeys(value: unknown) {
  const common = ["artifactId", "expectedVersion", "operation"];
  if (value === "regenerate") return new Set([...common, "content", "title"]);
  if (value === "permissions") return new Set([...common, "editorEmails", "viewerEmails"]);
  if (value === "request-report-save" || value === "save-to-reports" || value === "delete") {
    return new Set(common);
  }
  if (value === "decide-report-save") return new Set([...common, "decision", "reason"]);
  return null;
}

function normalizeSourceContext(value: unknown): AdminAIArtifact["sourceContext"] | null {
  if (!isRecord(value) || hasUnknownKeys(value, SOURCE_CONTEXT_KEYS)) return null;
  const moduleId = parseIdentifier(value.module, 80);
  const scope = value.scope;
  const requestId = value.requestId === undefined ? null : parseIdentifier(value.requestId, 120);
  if (
    !moduleId ||
    !["global", "record", "section", "selection"].includes(String(scope)) ||
    (value.requestId !== undefined && !requestId) ||
    !Array.isArray(value.referenceIds) ||
    value.referenceIds.length > 50
  ) {
    return null;
  }
  const referenceIds = value.referenceIds.map((item) => parseIdentifier(item, 120));
  if (referenceIds.some((item) => !item)) return null;
  return {
    module: moduleId,
    referenceIds: unique(referenceIds),
    requestId,
    scope: scope as AdminAIArtifact["sourceContext"]["scope"]
  };
}

function normalizeExportFormats(value: unknown): AdminAIArtifactExportFormat[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return null;
  if (value.some((format) => !ADMIN_AI_ARTIFACT_EXPORT_FORMATS.includes(format as never))) {
    return null;
  }
  return unique(value as AdminAIArtifactExportFormat[]);
}

function normalizeEmailList(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return null;
  const emails = value.map((item) => (typeof item === "string" ? normalizeEmail(item) : ""));
  return emails.some((email) => !email) ? null : unique(emails);
}

function normalizeActor(actor: AdminAIArtifactActor) {
  const email = normalizeEmail(actor?.email);
  return email ? { email, isOwner: actor.isOwner === true } : null;
}

function canViewArtifact(artifact: AdminAIArtifact, actor: AdminAIArtifactActor) {
  return (
    actor.isOwner ||
    artifact.creatorEmail === actor.email ||
    artifact.viewerEmails.includes(actor.email) ||
    artifact.editorEmails.includes(actor.email)
  );
}

function canEditArtifact(artifact: AdminAIArtifact, actor: AdminAIArtifactActor) {
  return (
    actor.isOwner ||
    artifact.creatorEmail === actor.email ||
    artifact.editorEmails.includes(actor.email)
  );
}

function eventInsert(
  db: D1Database,
  artifactId: string,
  eventType: string,
  actorEmail: string,
  artifactVersion: number,
  occurredAt: number
) {
  return db
    .prepare(
      `INSERT INTO admin_ai_artifact_events (
        id, artifact_id, event_type, actor_email, artifact_version, occurred_at
      ) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1`
    )
    .bind(
      `admin-ai-artifact-event-${crypto.randomUUID()}`,
      artifactId,
      eventType,
      actorEmail,
      artifactVersion,
      occurredAt
    );
}

function emptyApproval(): AdminAIArtifact["approval"] {
  return {
    decidedAt: null,
    decidedBy: null,
    decisionReason: null,
    requestedAt: null,
    requestedBy: null,
    savedAt: null,
    savedBy: null,
    status: "not-requested"
  };
}

function copyableMetadata(
  content: string,
  exportFormats: readonly AdminAIArtifactExportFormat[]
): AdminAIArtifact["copyable"] {
  return {
    characterCount: content.length,
    enabled: true,
    mimeType: exportFormats.includes("md") ? "text/markdown" : "text/plain"
  };
}

function hasOneChangeEach(results: D1Result<unknown>[], count: number) {
  return (
    results.length === count &&
    results.every((result) => result.success && Number(result.meta.changes) === 1)
  );
}

function invalidCreate(error: string) {
  return { error, ok: false as const };
}

function failure(
  code: Exclude<AdminAIArtifactMutationResult, { ok: true }>["code"],
  message: string,
  status: Exclude<AdminAIArtifactMutationResult, { ok: true }>["status"]
): AdminAIArtifactMutationResult {
  return { code, message, ok: false, status };
}

function cleanContent(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, maxLength)
    : "";
}

function cleanSingleLine(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) && normalized.length <= maxLength ? normalized : "";
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).some((key) => !allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique<T>(values: readonly T[]) {
  return Array.from(new Set(values));
}

function nowIso() {
  return new Date().toISOString();
}

function toEpochSeconds(value: string) {
  return Math.floor(Date.parse(value) / 1000);
}
