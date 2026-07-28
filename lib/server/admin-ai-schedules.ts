import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { ADMIN_AI_EXECUTIVE_REPORT_TYPES } from "../admin-ai/adminAIReports";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";

export const ADMIN_AI_SCHEDULE_REPORT_TYPES = [
  "Daily Briefing",
  ...ADMIN_AI_EXECUTIVE_REPORT_TYPES
] as const;

export type AdminAIScheduleReportType = (typeof ADMIN_AI_SCHEDULE_REPORT_TYPES)[number];
export type AdminAIScheduleWeekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type AdminAIScheduleCadence = {
  dayOfMonth?: number;
  frequency: "daily" | "monthly" | "weekly";
  localTime: string;
  timeZone: string;
  weekday?: AdminAIScheduleWeekday;
};

export type AdminAIScheduleDelivery = {
  attemptedAt: string | null;
  channel: "email" | "in-app";
  deliveredAt: string | null;
  detail: string | null;
  recipientEmails: string[];
  status: "blocked" | "delivered" | "failed" | "not-attempted";
};

export type AdminAIScheduleRun = {
  attempt: number;
  checkpoint: string | null;
  completedAt: string | null;
  errorCode: string | null;
  id: string;
  maxAttempts: number;
  nextAttemptAt: string | null;
  resumeCount: number;
  startedAt: string;
  status: "completed" | "dead-letter" | "failed" | "paused" | "retry-wait" | "running";
  updatedAt: string;
};

export type AdminAISchedule = {
  cadence: AdminAIScheduleCadence;
  createdAt: string;
  createdBy: string;
  delivery: AdminAIScheduleDelivery;
  enabled: boolean;
  id: string;
  nextRunAt: string | null;
  reportType: AdminAIScheduleReportType;
  runs: AdminAIScheduleRun[];
  updatedAt: string;
  updatedBy: string;
  version: number;
};

export type AdminAIScheduleActor = { email: string; isOwner: boolean };
export type AdminAIScheduleCapabilities = {
  approvedEmailWorkflow: boolean;
  secureScheduledJobs: boolean;
};

type ScheduleRow = {
  created_at: number | string;
  created_by: string;
  enabled: number | string;
  id: string;
  next_run_at: number | string | null;
  report_type: string;
  state_json: string;
  updated_at: number | string;
  updated_by: string;
  version: number | string;
};

type AdminAIScheduleFailure = {
  code: "conflict" | "forbidden" | "invalid" | "not-found" | "unavailable";
  message: string;
  ok: false;
  status: 400 | 403 | 404 | 409 | 503;
};

export type AdminAIScheduleMutationResult =
  | { ok: true; schedule: AdminAISchedule; status: 200 | 201 }
  | AdminAIScheduleFailure;

export type AdminAIScheduleListResult =
  | { ok: true; schedules: AdminAISchedule[]; status: 200 }
  | AdminAIScheduleFailure;

const schemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>();
const CREATE_KEYS = new Set(["cadence", "delivery", "enabled", "operation", "reportType"]);
const UPDATE_KEYS = new Set(["expectedVersion", "operation", "patch", "scheduleId"]);
const UPDATE_PATCH_KEYS = new Set(["cadence", "delivery", "enabled", "reportType"]);
const DISABLE_KEYS = new Set(["expectedVersion", "operation", "scheduleId"]);
const DELIVERY_KEYS = new Set(["detail", "expectedVersion", "operation", "scheduleId", "status"]);
const RUN_START_KEYS = new Set(["expectedVersion", "maxAttempts", "operation", "scheduleId"]);
const RUN_CHECKPOINT_KEYS = new Set([
  "checkpoint",
  "expectedVersion",
  "operation",
  "pause",
  "runId",
  "scheduleId"
]);
const RUN_RESUME_KEYS = new Set(["expectedVersion", "operation", "runId", "scheduleId"]);
const RUN_RESULT_KEYS = new Set([
  "errorCode",
  "expectedVersion",
  "operation",
  "result",
  "runId",
  "scheduleId"
]);
const RUN_STATE_KEYS = new Set([
  "attempt",
  "checkpoint",
  "completedAt",
  "errorCode",
  "id",
  "maxAttempts",
  "nextAttemptAt",
  "resumeCount",
  "startedAt",
  "status",
  "updatedAt"
]);
const CADENCE_KEYS = new Set(["dayOfMonth", "frequency", "localTime", "timeZone", "weekday"]);
const DELIVERY_CONFIG_KEYS = new Set(["channel", "recipientEmails"]);
const WEEKDAYS: AdminAIScheduleWeekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];
const SCHEDULE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_schedules (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    next_run_at INTEGER,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_ai_schedule_events (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'schedule-created', 'schedule-updated', 'schedule-disabled',
      'delivery-delivered', 'delivery-failed', 'delivery-blocked'
    )),
    actor_email TEXT NOT NULL,
    schedule_version INTEGER NOT NULL CHECK (schedule_version > 0),
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_schedules_enabled_next_run
   ON admin_ai_schedules (enabled, next_run_at)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_schedule_events_schedule_time
   ON admin_ai_schedule_events (schedule_id, occurred_at)`
] as const;

export async function ensureAdminAIScheduleSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: schemaCache,
    db,
    setup: async () => {
      for (const statement of SCHEDULE_SCHEMA) await db.prepare(statement).run();
    }
  });
}

export async function getAdminAISchedules({
  actor,
  db
}: {
  actor: AdminAIScheduleActor;
  db: D1Database;
}): Promise<AdminAIScheduleListResult> {
  const safeActor = normalizeActor(actor);
  if (!safeActor) return failure("invalid", "Invalid schedule actor.", 400);
  if (!safeActor.isOwner) {
    return failure("forbidden", "Owner access is required for scheduled briefings.", 403);
  }
  try {
    await ensureAdminAIScheduleSchema(db);
    const rows = await db
      .prepare(`${scheduleSelect()} ORDER BY updated_at DESC, id LIMIT 100`)
      .all<ScheduleRow>();
    return {
      ok: true,
      schedules: (rows.results || []).map(parseScheduleRow),
      status: 200
    };
  } catch {
    return failure("unavailable", "Durable scheduled-briefing storage is unavailable.", 503);
  }
}

export async function mutateAdminAISchedule({
  actor,
  capabilities,
  db,
  input
}: {
  actor: AdminAIScheduleActor;
  capabilities: AdminAIScheduleCapabilities;
  db: D1Database;
  input: unknown;
}): Promise<AdminAIScheduleMutationResult> {
  const safeActor = normalizeActor(actor);
  if (!safeActor || !isRecord(input)) {
    return failure("invalid", "Invalid scheduled-briefing request.", 400);
  }
  if (!safeActor.isOwner) {
    return failure("forbidden", "Owner access is required for scheduled briefings.", 403);
  }
  try {
    if (input.operation === "create") {
      return await createSchedule(db, safeActor, capabilities, input);
    }
    if (input.operation === "update") {
      return await updateSchedule(db, safeActor, capabilities, input);
    }
    if (input.operation === "disable") {
      return await disableSchedule(db, safeActor, input);
    }
    if (input.operation === "record-delivery") {
      return await recordDelivery(db, safeActor, capabilities, input);
    }
    if (input.operation === "start-run") {
      return await startScheduleRun(db, safeActor, capabilities, input);
    }
    if (input.operation === "checkpoint-run") {
      return await checkpointScheduleRun(db, safeActor, capabilities, input);
    }
    if (input.operation === "resume-run") {
      return await resumeScheduleRun(db, safeActor, capabilities, input);
    }
    if (input.operation === "record-run-result") {
      return await recordScheduleRunResult(db, safeActor, capabilities, input);
    }
    return failure("invalid", "Invalid scheduled-briefing operation.", 400);
  } catch {
    return failure("unavailable", "Durable scheduled-briefing storage is unavailable.", 503);
  }
}

export function calculateNextAdminAIScheduleRun(
  cadence: AdminAIScheduleCadence,
  after: Date | number | string
): string | null {
  const normalized = normalizeCadence(cadence);
  const afterMs = after instanceof Date ? after.getTime() : new Date(after).getTime();
  if (!normalized || !Number.isFinite(afterMs)) return null;

  const localStart = zonedParts(afterMs, normalized.timeZone);
  if (!localStart) return null;
  const [hour, minute] = normalized.localTime.split(":").map(Number);
  for (let offset = 0; offset <= 370; offset += 1) {
    const calendarDate = new Date(
      Date.UTC(localStart.year, localStart.month - 1, localStart.day + offset)
    );
    const year = calendarDate.getUTCFullYear();
    const month = calendarDate.getUTCMonth() + 1;
    const day = calendarDate.getUTCDate();
    if (!cadenceMatchesDate(normalized, calendarDate)) continue;
    const candidate = localDateTimeToUtc({ day, hour, minute, month, year }, normalized.timeZone);
    if (candidate !== null && candidate > afterMs) return new Date(candidate).toISOString();
  }
  return null;
}

async function createSchedule(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (hasUnknownKeys(value, CREATE_KEYS) || typeof value.enabled !== "boolean") {
    return failure("invalid", "Invalid schedule create fields.", 400);
  }
  const reportType = normalizeReportType(value.reportType);
  const cadence = normalizeCadence(value.cadence);
  const deliveryConfig = normalizeDeliveryConfig(value.delivery);
  if (!reportType || !cadence || !deliveryConfig) {
    return failure("invalid", "Invalid schedule configuration.", 400);
  }
  const capabilityIssue = value.enabled
    ? getCapabilityIssue(deliveryConfig.channel, capabilities)
    : null;
  if (capabilityIssue) return failure("unavailable", capabilityIssue, 503);

  await ensureAdminAIScheduleSchema(db);
  const now = nowSeconds();
  const timestamp = toIso(now);
  const nextRunAt = value.enabled ? calculateNextAdminAIScheduleRun(cadence, now * 1000) : null;
  if (value.enabled && !nextRunAt) {
    return failure("invalid", "A safe next run could not be calculated.", 400);
  }
  const schedule: AdminAISchedule = {
    cadence,
    createdAt: timestamp,
    createdBy: actor.email,
    delivery: {
      attemptedAt: null,
      ...deliveryConfig,
      deliveredAt: null,
      detail: null,
      status: "not-attempted"
    },
    enabled: value.enabled,
    id: `admin-ai-schedule-${crypto.randomUUID()}`,
    nextRunAt,
    reportType,
    runs: [],
    updatedAt: timestamp,
    updatedBy: actor.email,
    version: 1
  };
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO admin_ai_schedules (
          id, report_type, enabled, next_run_at, state_json, version,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
      )
      .bind(
        schedule.id,
        schedule.reportType,
        schedule.enabled ? 1 : 0,
        toEpochSecondsOrNull(schedule.nextRunAt),
        JSON.stringify(schedule),
        schedule.version,
        schedule.createdBy,
        schedule.updatedBy,
        now,
        now
      ),
    eventInsert(db, schedule, "schedule-created", actor.email, now)
  ]);
  return hasOneChangeEach(results, 2)
    ? { ok: true, schedule, status: 201 }
    : failure("unavailable", "The schedule was not stored durably.", 503);
}

async function updateSchedule(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (hasUnknownKeys(value, UPDATE_KEYS) || !isRecord(value.patch)) {
    return failure("invalid", "Invalid schedule update fields.", 400);
  }
  const patch = value.patch;
  if (Object.keys(patch).length === 0 || hasUnknownKeys(patch, UPDATE_PATCH_KEYS)) {
    return failure("invalid", "Invalid schedule update fields.", 400);
  }
  const currentResult = await readForMutation(db, value);
  if (!currentResult.ok) return currentResult;
  const cadence =
    patch.cadence === undefined ? currentResult.schedule.cadence : normalizeCadence(patch.cadence);
  const reportType =
    patch.reportType === undefined
      ? currentResult.schedule.reportType
      : normalizeReportType(patch.reportType);
  const deliveryConfig =
    patch.delivery === undefined
      ? {
          channel: currentResult.schedule.delivery.channel,
          recipientEmails: currentResult.schedule.delivery.recipientEmails
        }
      : normalizeDeliveryConfig(patch.delivery);
  const enabled = patch.enabled === undefined ? currentResult.schedule.enabled : patch.enabled;
  if (!cadence || !reportType || !deliveryConfig || typeof enabled !== "boolean") {
    return failure("invalid", "Invalid schedule update configuration.", 400);
  }
  const capabilityIssue = enabled ? getCapabilityIssue(deliveryConfig.channel, capabilities) : null;
  if (capabilityIssue) return failure("unavailable", capabilityIssue, 503);

  const now = nowSeconds();
  const deliveryChanged = patch.delivery !== undefined;
  const next: AdminAISchedule = {
    ...currentResult.schedule,
    cadence,
    delivery: deliveryChanged
      ? {
          attemptedAt: null,
          ...deliveryConfig,
          deliveredAt: null,
          detail: null,
          status: "not-attempted"
        }
      : currentResult.schedule.delivery,
    enabled,
    nextRunAt: enabled ? calculateNextAdminAIScheduleRun(cadence, now * 1000) : null,
    reportType,
    updatedAt: toIso(now),
    updatedBy: actor.email,
    version: currentResult.schedule.version + 1
  };
  if (enabled && !next.nextRunAt) {
    return failure("invalid", "A safe next run could not be calculated.", 400);
  }
  return persistSchedule(
    db,
    next,
    currentResult.schedule.version,
    "schedule-updated",
    actor.email,
    now
  );
}

async function disableSchedule(
  db: D1Database,
  actor: AdminAIScheduleActor,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (hasUnknownKeys(value, DISABLE_KEYS)) {
    return failure("invalid", "Invalid schedule disable fields.", 400);
  }
  const currentResult = await readForMutation(db, value);
  if (!currentResult.ok) return currentResult;
  if (!currentResult.schedule.enabled) {
    return { ok: true, schedule: currentResult.schedule, status: 200 };
  }
  const now = nowSeconds();
  return persistSchedule(
    db,
    {
      ...currentResult.schedule,
      enabled: false,
      nextRunAt: null,
      updatedAt: toIso(now),
      updatedBy: actor.email,
      version: currentResult.schedule.version + 1
    },
    currentResult.schedule.version,
    "schedule-disabled",
    actor.email,
    now
  );
}

async function recordDelivery(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (
    hasUnknownKeys(value, DELIVERY_KEYS) ||
    !["blocked", "delivered", "failed"].includes(String(value.status))
  ) {
    return failure("invalid", "Invalid delivery status fields.", 400);
  }
  const detail = value.detail === undefined ? "" : cleanText(value.detail, 500);
  if (value.detail !== undefined && !detail) {
    return failure("invalid", "Invalid delivery status detail.", 400);
  }
  if ((value.status === "blocked" || value.status === "failed") && !detail) {
    return failure("invalid", "A blocked or failed delivery requires a reason.", 400);
  }
  const currentResult = await readForMutation(db, value);
  if (!currentResult.ok) return currentResult;
  if (!currentResult.schedule.enabled) {
    return failure("conflict", "The schedule is disabled.", 409);
  }

  const capabilityIssue = getCapabilityIssue(currentResult.schedule.delivery.channel, capabilities);
  const status = capabilityIssue ? "blocked" : (value.status as "blocked" | "delivered" | "failed");
  const now = nowSeconds();
  const timestamp = toIso(now);
  const next: AdminAISchedule = {
    ...currentResult.schedule,
    delivery: {
      ...currentResult.schedule.delivery,
      attemptedAt: timestamp,
      deliveredAt: status === "delivered" ? timestamp : currentResult.schedule.delivery.deliveredAt,
      detail: capabilityIssue || detail || (status === "delivered" ? "Delivery recorded." : null),
      status
    },
    enabled: status !== "blocked",
    nextRunAt:
      status === "blocked"
        ? null
        : calculateNextAdminAIScheduleRun(currentResult.schedule.cadence, now * 1000),
    updatedAt: timestamp,
    updatedBy: actor.email,
    version: currentResult.schedule.version + 1
  };
  if (next.enabled && !next.nextRunAt) {
    return failure("unavailable", "A safe next run could not be calculated after delivery.", 503);
  }
  return persistSchedule(
    db,
    next,
    currentResult.schedule.version,
    `delivery-${status}`,
    actor.email,
    now
  );
}

export function calculateAdminAIJobRetryAt(
  attempt: number,
  after: Date | number | string
): string | null {
  const afterMs = after instanceof Date ? after.getTime() : new Date(after).getTime();
  if (!Number.isInteger(attempt) || attempt < 1 || !Number.isFinite(afterMs)) return null;
  const delayMs = Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempt - 1, 10));
  return new Date(afterMs + delayMs).toISOString();
}

async function startScheduleRun(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (hasUnknownKeys(value, RUN_START_KEYS)) {
    return failure("invalid", "Invalid schedule run fields.", 400);
  }
  const maxAttempts = positiveInteger(value.maxAttempts);
  if (maxAttempts < 1 || maxAttempts > 10) {
    return failure("invalid", "A schedule run requires 1 to 10 attempts.", 400);
  }
  const current = await readRunnableSchedule(db, capabilities, value);
  if (!current.ok) return current;
  if (
    current.schedule.runs.some((run) => ["paused", "retry-wait", "running"].includes(run.status))
  ) {
    return failure("conflict", "An unfinished run already exists for this schedule.", 409);
  }

  const now = nowSeconds();
  const timestamp = toIso(now);
  const run: AdminAIScheduleRun = {
    attempt: 1,
    checkpoint: null,
    completedAt: null,
    errorCode: null,
    id: `admin-ai-run-${crypto.randomUUID()}`,
    maxAttempts,
    nextAttemptAt: null,
    resumeCount: 0,
    startedAt: timestamp,
    status: "running",
    updatedAt: timestamp
  };
  return persistRunTransition(db, actor, current.schedule, [run, ...current.schedule.runs], now);
}

async function checkpointScheduleRun(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (
    hasUnknownKeys(value, RUN_CHECKPOINT_KEYS) ||
    (value.pause !== undefined && typeof value.pause !== "boolean")
  ) {
    return failure("invalid", "Invalid schedule checkpoint fields.", 400);
  }
  const checkpoint = cleanText(value.checkpoint, 500);
  if (!checkpoint) return failure("invalid", "A durable checkpoint is required.", 400);
  const current = await readRunnableSchedule(db, capabilities, value);
  if (!current.ok) return current;
  const run = findScheduleRun(current.schedule, value.runId);
  if (!run || run.status !== "running") {
    return failure("conflict", "Only a running job can store a checkpoint.", 409);
  }

  const now = nowSeconds();
  return persistRunTransition(
    db,
    actor,
    current.schedule,
    replaceScheduleRun(current.schedule.runs, {
      ...run,
      checkpoint,
      status: value.pause === true ? "paused" : "running",
      updatedAt: toIso(now)
    }),
    now
  );
}

async function resumeScheduleRun(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (hasUnknownKeys(value, RUN_RESUME_KEYS)) {
    return failure("invalid", "Invalid schedule resume fields.", 400);
  }
  const current = await readRunnableSchedule(db, capabilities, value);
  if (!current.ok) return current;
  const run = findScheduleRun(current.schedule, value.runId);
  if (!run || (run.status !== "paused" && run.status !== "retry-wait")) {
    return failure("conflict", "Only a paused or retry-wait job can resume.", 409);
  }
  const now = nowSeconds();
  if (
    run.status === "retry-wait" &&
    (!run.nextAttemptAt || Date.parse(run.nextAttemptAt) > now * 1000)
  ) {
    return failure("conflict", "The bounded retry backoff has not elapsed.", 409);
  }

  return persistRunTransition(
    db,
    actor,
    current.schedule,
    replaceScheduleRun(current.schedule.runs, {
      ...run,
      attempt: run.attempt + (run.status === "retry-wait" ? 1 : 0),
      errorCode: null,
      nextAttemptAt: null,
      resumeCount: run.resumeCount + 1,
      status: "running",
      updatedAt: toIso(now)
    }),
    now
  );
}

async function recordScheduleRunResult(
  db: D1Database,
  actor: AdminAIScheduleActor,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
): Promise<AdminAIScheduleMutationResult> {
  if (
    hasUnknownKeys(value, RUN_RESULT_KEYS) ||
    !["completed", "failed", "retryable-failure"].includes(String(value.result))
  ) {
    return failure("invalid", "Invalid schedule run result fields.", 400);
  }
  const errorCode = value.errorCode === undefined ? null : parseIdentifier(value.errorCode, 80);
  if (value.result !== "completed" && !errorCode) {
    return failure("invalid", "A failed run requires a bounded error code.", 400);
  }
  const current = await readRunnableSchedule(db, capabilities, value);
  if (!current.ok) return current;
  const run = findScheduleRun(current.schedule, value.runId);
  if (!run || run.status !== "running") {
    return failure("conflict", "Only a running job can record a result.", 409);
  }

  const now = nowSeconds();
  const timestamp = toIso(now);
  const retryable = value.result === "retryable-failure" && run.attempt < run.maxAttempts;
  const nextAttemptAt = retryable ? calculateAdminAIJobRetryAt(run.attempt, now * 1000) : null;
  if (retryable && !nextAttemptAt) {
    return failure("unavailable", "A safe retry time could not be calculated.", 503);
  }
  const status =
    value.result === "completed"
      ? "completed"
      : retryable
        ? "retry-wait"
        : value.result === "retryable-failure"
          ? "dead-letter"
          : "failed";
  return persistRunTransition(
    db,
    actor,
    current.schedule,
    replaceScheduleRun(current.schedule.runs, {
      ...run,
      completedAt: ["completed", "dead-letter", "failed"].includes(status) ? timestamp : null,
      errorCode: value.result === "completed" ? null : errorCode,
      nextAttemptAt,
      status,
      updatedAt: timestamp
    }),
    now
  );
}

async function readRunnableSchedule(
  db: D1Database,
  capabilities: AdminAIScheduleCapabilities,
  value: Record<string, unknown>
) {
  const current = await readForMutation(db, value);
  if (!current.ok) return current;
  if (!current.schedule.enabled) return failure("conflict", "The schedule is disabled.", 409);
  const capabilityIssue = getCapabilityIssue(current.schedule.delivery.channel, capabilities);
  return capabilityIssue ? failure("unavailable", capabilityIssue, 503) : current;
}

function findScheduleRun(schedule: AdminAISchedule, value: unknown) {
  const runId = parseIdentifier(value, 120);
  return runId ? schedule.runs.find((run) => run.id === runId) || null : null;
}

function replaceScheduleRun(runs: AdminAIScheduleRun[], replacement: AdminAIScheduleRun) {
  return runs.map((run) => (run.id === replacement.id ? replacement : run));
}

function persistRunTransition(
  db: D1Database,
  actor: AdminAIScheduleActor,
  schedule: AdminAISchedule,
  runs: AdminAIScheduleRun[],
  now: number
) {
  return persistSchedule(
    db,
    {
      ...schedule,
      runs: runs.slice(0, 20),
      updatedAt: toIso(now),
      updatedBy: actor.email,
      version: schedule.version + 1
    },
    schedule.version,
    "schedule-updated",
    actor.email,
    now
  );
}

async function readForMutation(
  db: D1Database,
  value: Record<string, unknown>
): Promise<{ ok: true; schedule: AdminAISchedule } | AdminAIScheduleFailure> {
  const id = parseIdentifier(value.scheduleId, 120);
  const expectedVersion = positiveInteger(value.expectedVersion);
  if (!id || !expectedVersion) {
    return failure("invalid", "Invalid schedule identity or version.", 400);
  }
  await ensureAdminAIScheduleSchema(db);
  const row = await db
    .prepare(`${scheduleSelect()} WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<ScheduleRow>();
  if (!row) return failure("not-found", "Schedule not found.", 404);
  const schedule = parseScheduleRow(row);
  if (schedule.version !== expectedVersion) {
    return failure("conflict", "The schedule changed before this update.", 409);
  }
  return { ok: true, schedule };
}

async function persistSchedule(
  db: D1Database,
  schedule: AdminAISchedule,
  expectedVersion: number,
  eventType:
    | "delivery-blocked"
    | "delivery-delivered"
    | "delivery-failed"
    | "schedule-disabled"
    | "schedule-updated",
  actorEmail: string,
  now: number
): Promise<AdminAIScheduleMutationResult> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE admin_ai_schedules
         SET report_type = ?1, enabled = ?2, next_run_at = ?3, state_json = ?4,
             version = ?5, updated_by = ?6, updated_at = ?7
         WHERE id = ?8 AND version = ?9`
      )
      .bind(
        schedule.reportType,
        schedule.enabled ? 1 : 0,
        toEpochSecondsOrNull(schedule.nextRunAt),
        JSON.stringify(schedule),
        schedule.version,
        schedule.updatedBy,
        now,
        schedule.id,
        expectedVersion
      ),
    eventInsert(db, schedule, eventType, actorEmail, now)
  ]);
  return hasOneChangeEach(results, 2)
    ? { ok: true, schedule, status: 200 }
    : failure("conflict", "The schedule changed before this update.", 409);
}

function eventInsert(
  db: D1Database,
  schedule: AdminAISchedule,
  eventType:
    | "delivery-blocked"
    | "delivery-delivered"
    | "delivery-failed"
    | "schedule-created"
    | "schedule-disabled"
    | "schedule-updated",
  actorEmail: string,
  now: number
) {
  return db
    .prepare(
      `INSERT INTO admin_ai_schedule_events (
        id, schedule_id, event_type, actor_email, schedule_version, occurred_at
      ) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1`
    )
    .bind(
      `admin-ai-schedule-event-${crypto.randomUUID()}`,
      schedule.id,
      eventType,
      actorEmail,
      schedule.version,
      now
    );
}

function parseScheduleRow(row: ScheduleRow): AdminAISchedule {
  const parsed = JSON.parse(row.state_json) as Partial<AdminAISchedule>;
  const cadence = normalizeCadence(parsed.cadence);
  const reportType = normalizeReportType(parsed.reportType);
  const runs = normalizeScheduleRuns(parsed.runs);
  const version = positiveInteger(row.version);
  const enabled = Number(row.enabled);
  const nextRunAt = row.next_run_at === null ? null : Number(row.next_run_at);
  if (
    !cadence ||
    !reportType ||
    !runs ||
    !version ||
    parsed.id !== row.id ||
    parsed.version !== version ||
    typeof parsed.enabled !== "boolean" ||
    ![0, 1].includes(enabled) ||
    parsed.enabled !== Boolean(enabled) ||
    reportType !== row.report_type ||
    !isDeliveryState(parsed.delivery) ||
    !validIso(parsed.createdAt) ||
    !validIso(parsed.updatedAt) ||
    normalizeEmail(parsed.createdBy) !== normalizeEmail(row.created_by) ||
    normalizeEmail(parsed.updatedBy) !== normalizeEmail(row.updated_by) ||
    Date.parse(parsed.createdAt as string) / 1000 !== Number(row.created_at) ||
    Date.parse(parsed.updatedAt as string) / 1000 !== Number(row.updated_at) ||
    (parsed.nextRunAt !== null && !validIso(parsed.nextRunAt)) ||
    toEpochSecondsOrNull(parsed.nextRunAt ?? null) !== nextRunAt
  ) {
    throw new Error("Invalid persisted Admin AI schedule.");
  }
  return { ...parsed, runs } as AdminAISchedule;
}

function normalizeScheduleRuns(value: unknown): AdminAIScheduleRun[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const runs = value.map((run): AdminAIScheduleRun | null => {
    if (!isRecord(run) || hasUnknownKeys(run, RUN_STATE_KEYS)) return null;
    const attempt = positiveInteger(run.attempt);
    const maxAttempts = positiveInteger(run.maxAttempts);
    const resumeCount = Number(run.resumeCount);
    const id = parseIdentifier(run.id, 120);
    const checkpoint = run.checkpoint === null ? null : cleanText(run.checkpoint, 500);
    const errorCode = run.errorCode === null ? null : parseIdentifier(run.errorCode, 80);
    const status = String(run.status);
    if (
      !id ||
      id !== run.id ||
      attempt < 1 ||
      maxAttempts < attempt ||
      maxAttempts > 10 ||
      !Number.isInteger(resumeCount) ||
      resumeCount < 0 ||
      resumeCount > 100 ||
      !["completed", "dead-letter", "failed", "paused", "retry-wait", "running"].includes(status) ||
      !validIso(run.startedAt) ||
      !validIso(run.updatedAt) ||
      (run.checkpoint !== null && !checkpoint) ||
      (run.errorCode !== null && !errorCode) ||
      (run.completedAt !== null && !validIso(run.completedAt)) ||
      (run.nextAttemptAt !== null && !validIso(run.nextAttemptAt))
    ) {
      return null;
    }
    return {
      attempt,
      checkpoint,
      completedAt: run.completedAt as string | null,
      errorCode,
      id,
      maxAttempts,
      nextAttemptAt: run.nextAttemptAt as string | null,
      resumeCount,
      startedAt: run.startedAt as string,
      status: status as AdminAIScheduleRun["status"],
      updatedAt: run.updatedAt as string
    };
  });
  return runs.some((run) => !run) ? null : (runs as AdminAIScheduleRun[]);
}

function normalizeCadence(value: unknown): AdminAIScheduleCadence | null {
  if (!isRecord(value) || hasUnknownKeys(value, CADENCE_KEYS)) return null;
  const frequency = String(value.frequency || "");
  const localTime = typeof value.localTime === "string" ? value.localTime.trim() : "";
  const timeZone = typeof value.timeZone === "string" ? value.timeZone.trim() : "";
  if (
    !["daily", "monthly", "weekly"].includes(frequency) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime) ||
    !getTimeZoneFormatter(timeZone)
  ) {
    return null;
  }
  if (frequency === "daily") {
    if (value.weekday !== undefined || value.dayOfMonth !== undefined) return null;
    return { frequency, localTime, timeZone };
  }
  if (frequency === "weekly") {
    if (
      !WEEKDAYS.includes(value.weekday as AdminAIScheduleWeekday) ||
      value.dayOfMonth !== undefined
    ) {
      return null;
    }
    return { frequency, localTime, timeZone, weekday: value.weekday as AdminAIScheduleWeekday };
  }
  if (
    !Number.isInteger(value.dayOfMonth) ||
    Number(value.dayOfMonth) < 1 ||
    Number(value.dayOfMonth) > 31 ||
    value.weekday !== undefined
  ) {
    return null;
  }
  return { dayOfMonth: Number(value.dayOfMonth), frequency: "monthly", localTime, timeZone };
}

function normalizeDeliveryConfig(value: unknown): {
  channel: "email" | "in-app";
  recipientEmails: string[];
} | null {
  if (!isRecord(value) || hasUnknownKeys(value, DELIVERY_CONFIG_KEYS)) return null;
  if (value.channel !== "email" && value.channel !== "in-app") return null;
  const recipients = normalizeEmailList(value.recipientEmails);
  if (!recipients) return null;
  if (value.channel === "email" && recipients.length === 0) return null;
  if (value.channel === "in-app" && recipients.length > 0) return null;
  return { channel: value.channel, recipientEmails: recipients };
}

function normalizeEmailList(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 25) return null;
  const emails = value.map((item) => normalizeEmail(item));
  return emails.every(Boolean) && new Set(emails).size === emails.length ? emails : null;
}

function isDeliveryState(value: unknown): value is AdminAIScheduleDelivery {
  if (!isRecord(value)) return false;
  const config = normalizeDeliveryConfig({
    channel: value.channel,
    recipientEmails: value.recipientEmails
  });
  return Boolean(
    config &&
    ["blocked", "delivered", "failed", "not-attempted"].includes(String(value.status)) &&
    (value.attemptedAt === null || validIso(value.attemptedAt)) &&
    (value.deliveredAt === null || validIso(value.deliveredAt)) &&
    (value.detail === null || cleanText(value.detail, 500))
  );
}

function normalizeReportType(value: unknown): AdminAIScheduleReportType | null {
  return ADMIN_AI_SCHEDULE_REPORT_TYPES.includes(value as AdminAIScheduleReportType)
    ? (value as AdminAIScheduleReportType)
    : null;
}

function getCapabilityIssue(
  channel: "email" | "in-app",
  capabilities: AdminAIScheduleCapabilities
) {
  if (!capabilities.secureScheduledJobs) {
    return "Secure scheduled jobs are not configured; the schedule remains disabled.";
  }
  if (channel === "email" && !capabilities.approvedEmailWorkflow) {
    return "An approved email workflow is not configured; email delivery remains disabled.";
  }
  return null;
}

function cadenceMatchesDate(cadence: AdminAIScheduleCadence, date: Date) {
  if (cadence.frequency === "daily") return true;
  if (cadence.frequency === "weekly") return WEEKDAYS[date.getUTCDay()] === cadence.weekday;
  return date.getUTCDate() === cadence.dayOfMonth;
}

function localDateTimeToUtc(
  desired: { day: number; hour: number; minute: number; month: number; year: number },
  timeZone: string
) {
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute
  );
  let guess = desiredAsUtc;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const actual = zonedParts(guess, timeZone);
    if (!actual) return null;
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    const difference = actualAsUtc - desiredAsUtc;
    if (difference === 0) return guess;
    guess -= difference;
  }
  const verified = zonedParts(guess, timeZone);
  return verified &&
    verified.year === desired.year &&
    verified.month === desired.month &&
    verified.day === desired.day &&
    verified.hour === desired.hour &&
    verified.minute === desired.minute
    ? guess
    : null;
}

function zonedParts(value: number, timeZone: string) {
  const formatter = getTimeZoneFormatter(timeZone);
  if (!formatter) return null;
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  const result = {
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    month: parts.month,
    year: parts.year
  };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

function getTimeZoneFormatter(timeZone: string) {
  if (!timeZone || timeZone.length > 80) return null;
  const cached = timeZoneFormatters.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric"
    });
    formatter.format(new Date(0));
    timeZoneFormatters.set(timeZone, formatter);
    return formatter;
  } catch {
    return null;
  }
}

function scheduleSelect() {
  return `SELECT id, report_type, enabled, next_run_at, state_json, version,
                 created_by, updated_by, created_at, updated_at
          FROM admin_ai_schedules`;
}

function hasOneChangeEach(results: D1Result<unknown>[], count: number) {
  return (
    results.length === count &&
    results.every((result) => result.success && Number(result.meta.changes) === 1)
  );
}

function failure(
  code: AdminAIScheduleFailure["code"],
  message: string,
  status: AdminAIScheduleFailure["status"]
): AdminAIScheduleFailure {
  return { code, message, ok: false, status };
}

function normalizeActor(actor: AdminAIScheduleActor) {
  const email = normalizeEmail(actor.email);
  return email ? { email, isOwner: actor.isOwner === true } : null;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return "";
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

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: Set<string>) {
  return Object.keys(value).some((key) => !allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validIso(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toIso(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

function toEpochSecondsOrNull(value: string | null) {
  return value === null ? null : Math.floor(Date.parse(value) / 1000);
}
