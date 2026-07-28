import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { AdminAIHealthEvidenceInput } from "../admin-ai/adminAIHealth";
import {
  buildAdminAIIncident,
  hydrateAdminAIIncidentEvidence,
  type AdminAIIncident,
  type AdminAIIncidentChecklistItem
} from "../admin-ai/adminAIIncident";
import type { AdminAICommand } from "../admin-ai/adminAIRegistry";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";

export type AdminAIIncidentPersistenceEvent = {
  actorEmail: string;
  detail: string;
  eventType: "checklist-updated" | "incident-opened" | "incident-refreshed" | "incident-resolved";
  id: string;
  incidentId: string;
  occurredAt: string;
};

export type AdminAIPersistedIncident = {
  events: AdminAIIncidentPersistenceEvent[];
  incident: AdminAIIncident;
  openedAt: string;
  openedBy: string;
  resolutionReason: string | null;
  resolvedAt: string | null;
  status: "active" | "resolved";
  updatedAt: string;
  updatedBy: string;
  version: number;
};

export type AdminAIIncidentMutationResult =
  | { incident: AdminAIPersistedIncident; ok: true; status: 200 | 201 }
  | {
      code: "conflict" | "invalid" | "not-declared" | "not-found" | "unavailable";
      message: string;
      ok: false;
      status: 400 | 404 | 409 | 422 | 503;
    };

type IncidentRow = {
  classification: string;
  evidence_fingerprint: string;
  freeze_active: number | string;
  id: string;
  opened_at: number | string;
  opened_by: string;
  resolution_reason: string | null;
  resolved_at: number | string | null;
  scope: string;
  severity: string;
  snapshot_json: string;
  status: string;
  updated_at: number | string;
  updated_by: string;
  version: number | string;
};

type IncidentEventRow = {
  actor_email: string;
  detail: string;
  event_type: string;
  id: string;
  incident_id: string;
  occurred_at: number | string;
};

const INCIDENT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_incidents (
    id TEXT PRIMARY KEY,
    classification TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high')),
    status TEXT NOT NULL CHECK (status IN ('active', 'resolved')),
    freeze_active INTEGER NOT NULL CHECK (freeze_active IN (0, 1)),
    scope TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    evidence_fingerprint TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    opened_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolution_reason TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_ai_incidents_active_classification
   ON admin_ai_incidents (classification) WHERE status = 'active'`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_incidents_active_freeze
   ON admin_ai_incidents (status, freeze_active, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS admin_ai_incident_events (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (
      event_type IN ('incident-opened', 'incident-refreshed', 'checklist-updated', 'incident-resolved')
    ),
    detail TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_incident_events_incident_occurred
   ON admin_ai_incident_events (incident_id, occurred_at, id)`
] as const;

const CHECKLIST_IDS = new Set<AdminAIIncidentChecklistItem["id"]>([
  "confirm-impact",
  "follow-recovery-runbook",
  "freeze-dangerous-actions",
  "record-outcome",
  "review-evidence"
]);
const incidentSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();

export async function ensureAdminAIIncidentSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: incidentSchemaCache,
    db,
    setup: async () => {
      for (const statement of INCIDENT_SCHEMA) await db.prepare(statement).run();
    }
  });
}

export async function getActiveAdminAIIncident(
  db: D1Database
): Promise<AdminAIPersistedIncident | null> {
  await ensureAdminAIIncidentSchema(db);
  const row = await db
    .prepare(
      `${incidentSelect()} WHERE status = 'active' AND freeze_active = 1 ORDER BY updated_at DESC LIMIT 1`
    )
    .first<IncidentRow>();
  return row ? readPersistedIncident(db, row) : null;
}

export async function hasActiveAdminAIIncidentFreeze(db: D1Database) {
  await ensureAdminAIIncidentSchema(db);
  const row = await db
    .prepare(
      `SELECT id FROM admin_ai_incidents
       WHERE status = 'active' AND freeze_active = 1
       ORDER BY updated_at DESC LIMIT 1`
    )
    .first<{ id: string }>();
  return Boolean(row?.id);
}

export function isAdminAICommandFrozen(command: AdminAICommand) {
  return (
    command.type === "dangerous" ||
    (command.kind === "registered-action" && command.type === "write")
  );
}

export async function syncAdminAIIncident({
  adminEmail,
  db,
  evidence,
  query,
  requestedAt
}: {
  adminEmail: string;
  db: D1Database;
  evidence: readonly AdminAIHealthEvidenceInput[];
  query: string;
  requestedAt: string;
}): Promise<AdminAIIncidentMutationResult> {
  const email = normalizeEmail(adminEmail);
  const safeQuery = cleanText(query, 500);
  if (!email || !safeQuery || !Number.isFinite(Date.parse(requestedAt))) {
    return incidentFailure("invalid", "Invalid incident sync request.", 400);
  }

  const built = buildAdminAIIncident({
    evidence: evidence.slice(0, 100),
    query: safeQuery,
    requestedAt
  });
  if (
    built.status !== "active" ||
    !built.classification ||
    !built.criticalBanner.severity ||
    !built.actionFreeze.active
  ) {
    return incidentFailure(
      "not-declared",
      "Validated critical or high-priority evidence is required to open an incident.",
      422
    );
  }

  await ensureAdminAIIncidentSchema(db);
  const now = toEpochSeconds(requestedAt);
  const fingerprint = incidentFingerprint(built);
  const existingRow = await db
    .prepare(
      `${incidentSelect()}
       WHERE status = 'active' AND freeze_active = 1 AND classification = ?1
       ORDER BY updated_at DESC LIMIT 1`
    )
    .bind(built.classification)
    .first<IncidentRow>();

  if (existingRow) {
    const existing = await readPersistedIncident(db, existingRow);
    if (existingRow.evidence_fingerprint === fingerprint) {
      return { incident: existing, ok: true, status: 200 };
    }
    const version = existing.version + 1;
    const incident = mergeIncident(existing.incident, built);
    const event = createEvent(
      incident.incidentId,
      "incident-refreshed",
      "Validated incident evidence was refreshed without lifting the action freeze.",
      email,
      now
    );
    const results = await db.batch([
      db
        .prepare(
          `UPDATE admin_ai_incidents
           SET snapshot_json = ?1, evidence_fingerprint = ?2, version = ?3,
               updated_by = ?4, updated_at = ?5
           WHERE id = ?6 AND version = ?7 AND status = 'active'`
        )
        .bind(
          JSON.stringify(incident),
          fingerprint,
          version,
          email,
          now,
          incident.incidentId,
          existing.version
        ),
      incidentEventInsert(db, event, true)
    ]);
    if (!hasOneChangeEach(results, 2)) {
      return incidentFailure("conflict", "The incident changed before evidence refresh.", 409);
    }
    const stored = await getAdminAIIncidentById(db, incident.incidentId);
    if (!stored) return incidentFailure("not-found", "The refreshed incident was not found.", 404);
    return { incident: stored, ok: true, status: 200 };
  }

  const incidentId = `incident-${crypto.randomUUID()}`;
  const incident = remapIncidentId(built, incidentId);
  const event = createEvent(
    incidentId,
    "incident-opened",
    "Validated high-priority evidence opened Incident Mode and required the action freeze.",
    email,
    now
  );
  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO admin_ai_incidents (
            id, classification, severity, status, freeze_active, scope, snapshot_json,
            evidence_fingerprint, version, opened_by, updated_by, opened_at, updated_at,
            resolved_at, resolution_reason
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
        )
        .bind(
          incidentId,
          incident.classification,
          incident.criticalBanner.severity,
          "active",
          1,
          incident.actionFreeze.scope,
          JSON.stringify(incident),
          fingerprint,
          1,
          email,
          email,
          now,
          now,
          null,
          null
        ),
      incidentEventInsert(db, event, true)
    ]);
    if (!hasOneChangeEach(results, 2)) {
      return incidentFailure("conflict", "A matching active incident already exists.", 409);
    }
  } catch (error) {
    return isUniqueConstraintError(error)
      ? incidentFailure("conflict", "A matching active incident already exists.", 409)
      : incidentFailure("unavailable", "Durable incident storage is unavailable.", 503);
  }
  const stored = await getAdminAIIncidentById(db, incidentId);
  if (!stored) return incidentFailure("not-found", "The opened incident was not found.", 404);
  return { incident: stored, ok: true, status: 201 };
}

export async function updateAdminAIIncidentChecklist({
  adminEmail,
  db,
  expectedVersion,
  incidentId,
  itemId,
  status
}: {
  adminEmail: string;
  db: D1Database;
  expectedVersion: number;
  incidentId: string;
  itemId: AdminAIIncidentChecklistItem["id"];
  status: AdminAIIncidentChecklistItem["status"];
}): Promise<AdminAIIncidentMutationResult> {
  const email = normalizeEmail(adminEmail);
  const id = parseIdentifier(incidentId, 120);
  if (
    !email ||
    !id ||
    !CHECKLIST_IDS.has(itemId) ||
    !["complete", "pending"].includes(status) ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return incidentFailure("invalid", "Invalid incident checklist update.", 400);
  }
  const stored = await getAdminAIIncidentById(db, id);
  if (!stored || stored.status !== "active") {
    return incidentFailure("not-found", "The active incident was not found.", 404);
  }
  if (stored.version !== expectedVersion) {
    return incidentFailure("conflict", "The incident checklist changed before this update.", 409);
  }
  const now = getNowSeconds();
  const version = stored.version + 1;
  const incident = {
    ...stored.incident,
    checklist: stored.incident.checklist.map((item) =>
      item.id === itemId ? { ...item, status } : item
    )
  };
  const event = createEvent(id, "checklist-updated", `${itemId}:${status}`, email, now);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE admin_ai_incidents
         SET snapshot_json = ?1, version = ?2, updated_by = ?3, updated_at = ?4
         WHERE id = ?5 AND version = ?6 AND status = 'active'`
      )
      .bind(JSON.stringify(incident), version, email, now, id, expectedVersion),
    incidentEventInsert(db, event, true)
  ]);
  if (!hasOneChangeEach(results, 2)) {
    return incidentFailure("conflict", "The incident checklist changed before this update.", 409);
  }
  const updated = await getAdminAIIncidentById(db, id);
  if (!updated) return incidentFailure("not-found", "The updated incident was not found.", 404);
  return { incident: updated, ok: true, status: 200 };
}

export async function resolveAdminAIIncident({
  adminEmail,
  db,
  expectedVersion,
  incidentId,
  reason
}: {
  adminEmail: string;
  db: D1Database;
  expectedVersion: number;
  incidentId: string;
  reason: string;
}): Promise<AdminAIIncidentMutationResult> {
  const email = normalizeEmail(adminEmail);
  const id = parseIdentifier(incidentId, 120);
  const safeReason = cleanText(reason, 240);
  if (!email || !id || !safeReason || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return incidentFailure("invalid", "Invalid incident resolution request.", 400);
  }
  const stored = await getAdminAIIncidentById(db, id);
  if (!stored || stored.status !== "active") {
    return incidentFailure("not-found", "The active incident was not found.", 404);
  }
  if (stored.version !== expectedVersion) {
    return incidentFailure("conflict", "The incident changed before resolution.", 409);
  }
  const now = getNowSeconds();
  const version = stored.version + 1;
  const incident: AdminAIIncident = {
    ...stored.incident,
    actionFreeze: {
      ...stored.incident.actionFreeze,
      active: false,
      enforcement: "not-required",
      reason: `Incident resolved explicitly: ${safeReason}`
    },
    checklist: stored.incident.checklist.map((item) =>
      item.id === "record-outcome" ? { ...item, status: "complete" } : item
    ),
    criticalBanner: { ...stored.incident.criticalBanner, visible: false },
    status: "monitoring"
  };
  const resolvedIncident = { ...incident, report: rebuildReport(incident) };
  const event = createEvent(id, "incident-resolved", safeReason, email, now);
  const results = await db.batch([
    db
      .prepare(
        `UPDATE admin_ai_incidents
         SET status = 'resolved', freeze_active = 0, snapshot_json = ?1, version = ?2,
             updated_by = ?3, updated_at = ?4, resolved_at = ?5, resolution_reason = ?6
         WHERE id = ?7 AND version = ?8 AND status = 'active'`
      )
      .bind(
        JSON.stringify(resolvedIncident),
        version,
        email,
        now,
        now,
        safeReason,
        id,
        expectedVersion
      ),
    incidentEventInsert(db, event, true)
  ]);
  if (!hasOneChangeEach(results, 2)) {
    return incidentFailure("conflict", "The incident changed before resolution.", 409);
  }
  const resolved = await getAdminAIIncidentById(db, id);
  if (!resolved) return incidentFailure("not-found", "The resolved incident was not found.", 404);
  return { incident: resolved, ok: true, status: 200 };
}

export async function getAdminAIIncidentById(db: D1Database, incidentId: string) {
  const id = parseIdentifier(incidentId, 120);
  if (!id) return null;
  await ensureAdminAIIncidentSchema(db);
  const row = await db
    .prepare(
      `${incidentSelect()}
       WHERE id = ?1 AND (status = 'active' OR updated_at > ?2)
       LIMIT 1`
    )
    .bind(id, getAdminAIRetentionCutoffSeconds())
    .first<IncidentRow>();
  return row ? readPersistedIncident(db, row) : null;
}

async function readPersistedIncident(db: D1Database, row: IncidentRow) {
  const incident = parseIncidentSnapshot(row.snapshot_json);
  const result = await db
    .prepare(
      `SELECT id, incident_id, event_type, detail, actor_email, occurred_at
       FROM admin_ai_incident_events
       WHERE incident_id = ?1 AND occurred_at > ?2
       ORDER BY occurred_at, id`
    )
    .bind(row.id, getAdminAIRetentionCutoffSeconds())
    .all<IncidentEventRow>();
  const status = row.status === "resolved" ? "resolved" : row.status === "active" ? "active" : null;
  const version = Number(row.version);
  if (!status || !Number.isInteger(version) || version < 1 || incident.incidentId !== row.id) {
    throw new Error("Invalid persisted Admin AI incident.");
  }
  return {
    events: (result.results || []).map(mapEvent),
    incident,
    openedAt: toIso(row.opened_at),
    openedBy: normalizeEmail(row.opened_by),
    resolutionReason: row.resolution_reason || null,
    resolvedAt: row.resolved_at === null ? null : toIso(row.resolved_at),
    status,
    updatedAt: toIso(row.updated_at),
    updatedBy: normalizeEmail(row.updated_by),
    version
  } satisfies AdminAIPersistedIncident;
}

function incidentEventInsert(
  db: D1Database,
  event: AdminAIIncidentPersistenceEvent,
  requirePreviousChange: boolean
) {
  return db
    .prepare(
      `INSERT INTO admin_ai_incident_events (
        id, incident_id, event_type, detail, actor_email, occurred_at
      ) SELECT ?1, ?2, ?3, ?4, ?5, ?6${requirePreviousChange ? " WHERE changes() = 1" : ""}`
    )
    .bind(
      event.id,
      event.incidentId,
      event.eventType,
      event.detail,
      event.actorEmail,
      toEpochSeconds(event.occurredAt)
    );
}

function createEvent(
  incidentId: string,
  eventType: AdminAIIncidentPersistenceEvent["eventType"],
  detail: string,
  actorEmail: string,
  occurredAt: number
): AdminAIIncidentPersistenceEvent {
  return {
    actorEmail,
    detail: cleanText(detail, 500),
    eventType,
    id: `admin-ai-incident-event-${crypto.randomUUID()}`,
    incidentId,
    occurredAt: new Date(occurredAt * 1000).toISOString()
  };
}

function mapEvent(row: IncidentEventRow): AdminAIIncidentPersistenceEvent {
  if (
    !["checklist-updated", "incident-opened", "incident-refreshed", "incident-resolved"].includes(
      row.event_type
    )
  ) {
    throw new Error("Invalid persisted Admin AI incident event.");
  }
  return {
    actorEmail: normalizeEmail(row.actor_email),
    detail: row.detail,
    eventType: row.event_type as AdminAIIncidentPersistenceEvent["eventType"],
    id: row.id,
    incidentId: row.incident_id,
    occurredAt: toIso(row.occurred_at)
  };
}

function remapIncidentId(incident: AdminAIIncident, incidentId: string): AdminAIIncident {
  const next: AdminAIIncident = {
    ...incident,
    auditTrail: incident.auditTrail.map((entry) => ({
      ...entry,
      id: `${incidentId}-${entry.event}-${stableHash(entry.occurredAt)}`
    })),
    incidentId,
    report: { ...incident.report, incidentId }
  };
  return { ...next, report: rebuildReport(next) };
}

function mergeIncident(existing: AdminAIIncident, incoming: AdminAIIncident): AdminAIIncident {
  const incidentId = existing.incidentId;
  const checklistStatus = new Map(existing.checklist.map((item) => [item.id, item.status]));
  const next: AdminAIIncident = {
    ...incoming,
    affectedModules: unique([...existing.affectedModules, ...incoming.affectedModules]),
    alerts: uniqueBy([...existing.alerts, ...incoming.alerts], (item) => item.id).slice(-200),
    auditTrail: uniqueBy(
      [
        ...existing.auditTrail,
        ...incoming.auditTrail.map((entry) => ({
          ...entry,
          id: `${incidentId}-${entry.event}-${stableHash(`${entry.occurredAt}:${entry.detail}`)}`
        }))
      ],
      (entry) => `${entry.event}:${entry.occurredAt}:${entry.detail}`
    ).slice(-100),
    checklist: incoming.checklist.map((item) => ({
      ...item,
      status: checklistStatus.get(item.id) || item.status
    })),
    evidence: uniqueBy(
      [...existing.evidence, ...incoming.evidence],
      (item) => `${item.alertId}:${item.observedAt}:${item.source}:${item.summary}`
    ).slice(-300),
    incidentId,
    recoverySteps: uniqueBy(
      [...existing.recoverySteps, ...incoming.recoverySteps],
      (item) => item.label
    ).slice(-100),
    requestedAt: existing.requestedAt,
    timeline: uniqueBy(
      [...existing.timeline, ...incoming.timeline],
      (item) => `${item.alertId}:${item.observedAt}:${item.source}:${item.summary}`
    ).slice(-300)
  };
  return { ...next, report: rebuildReport(next) };
}

function rebuildReport(incident: AdminAIIncident): AdminAIIncident["report"] {
  return {
    ...incident.report,
    incidentId: incident.incidentId,
    sections: [
      { id: "impact", items: [incident.impactSummary], title: "Impact" },
      {
        id: "affected-modules",
        items: incident.affectedModules.length ? incident.affectedModules : ["None"],
        title: "Affected modules"
      },
      {
        id: "evidence",
        items: incident.evidence.length
          ? incident.evidence.map(
              (item) =>
                `${item.observedAt} | ${item.source} | module=${item.module} | entity=${item.entityReference} | filters=${Object.entries(
                  item.filters
                )
                  .map(([key, value]) => `${key}=${value}`)
                  .join(", ")} | ${item.summary}`
            )
          : ["No validated incident evidence."],
        title: "Evidence"
      },
      {
        id: "recovery",
        items: incident.recoverySteps.map(({ label }) => label),
        title: "Recovery"
      },
      {
        id: "timeline",
        items: incident.timeline.map(
          (item) => `${item.observedAt} | ${item.module} | ${item.summary}`
        ),
        title: "Timeline"
      },
      {
        id: "audit-trail",
        items: incident.auditTrail.map(
          (item) => `${item.occurredAt} | ${item.event} | mutation=${item.mutation}`
        ),
        title: "Audit trail"
      }
    ],
    status: incident.status
  };
}

function parseIncidentSnapshot(value: string): AdminAIIncident {
  const incident = JSON.parse(value) as Partial<AdminAIIncident>;
  if (
    !incident ||
    typeof incident.incidentId !== "string" ||
    !incident.actionFreeze ||
    typeof incident.actionFreeze.active !== "boolean" ||
    !Array.isArray(incident.alerts) ||
    !Array.isArray(incident.checklist) ||
    !Array.isArray(incident.evidence) ||
    !Array.isArray(incident.timeline) ||
    !Array.isArray(incident.auditTrail)
  ) {
    throw new Error("Invalid persisted Admin AI incident snapshot.");
  }
  const restored = incident as AdminAIIncident;
  const hydrated = {
    ...restored,
    evidence: hydrateAdminAIIncidentEvidence(restored, restored.evidence)
  } satisfies AdminAIIncident;
  return { ...hydrated, report: rebuildReport(hydrated) };
}

function incidentSelect() {
  return `SELECT id, classification, severity, status, freeze_active, scope, snapshot_json,
                 evidence_fingerprint, version, opened_by, updated_by, opened_at, updated_at,
                 resolved_at, resolution_reason
          FROM admin_ai_incidents`;
}

function incidentFingerprint(incident: AdminAIIncident) {
  return stableHash(
    JSON.stringify({
      alerts: incident.alerts,
      classification: incident.classification,
      severity: incident.criticalBanner.severity
    })
  );
}

function incidentFailure(
  code: Exclude<AdminAIIncidentMutationResult, { ok: true }>["code"],
  message: string,
  status: Exclude<AdminAIIncidentMutationResult, { ok: true }>["status"]
): AdminAIIncidentMutationResult {
  return { code, message, ok: false, status };
}

function hasOneChangeEach(results: D1Result<unknown>[], count: number) {
  return (
    results.length === count &&
    results.every((result) => result.success && Number(result.meta.changes) === 1)
  );
}

function unique<T>(values: readonly T[]) {
  return Array.from(new Set(values));
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string) {
  return Array.from(new Map(values.map((value) => [key(value), value])).values());
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+$/.test(normalized) ? normalized : "";
}

function cleanText(value: unknown, maxLength: number) {
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

function toEpochSeconds(value: number | string) {
  if (typeof value === "number") return Math.floor(value);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid incident timestamp.");
  return Math.floor(parsed / 1000);
}

function toIso(value: number | string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) throw new Error("Invalid persisted incident timestamp.");
  return new Date(seconds * 1000).toISOString();
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isUniqueConstraintError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /(?:SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint failed)/i.test(message);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
