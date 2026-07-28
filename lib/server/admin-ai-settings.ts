import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type { AdminAIApprovedPreferenceCorrection } from "../admin-ai/adminAIMemory";
import {
  DEFAULT_ADMIN_AI_OWNER_POLICY,
  redactAdminAIText,
  type AdminAIOwnerPolicy
} from "../admin-ai/adminAIPolicy";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";

export type AdminAISettingsActor = { email: string; isOwner: boolean };

export type AdminAIPreferences = {
  aiPillEnabled: boolean;
  dailyBriefingEnabled: boolean;
  memoryEnabled: boolean;
  notificationPreference: "both" | "email" | "in-app" | "none";
  preferredLanguage: string;
  proactiveSuggestionsEnabled: boolean;
  reportFormat: "json" | "markdown" | "plain-text";
  responseLength: "balanced" | "concise" | "detailed";
};

export type AdminAIOwnerConfig = AdminAIOwnerPolicy;

type SettingsRow = {
  admin_email: string;
  clear_safe_memory_requested_at: number | string | null;
  preferences_json: string;
  updated_at: number | string;
  updated_by: string;
};

type OwnerSettingsRow = {
  config_json: string;
  updated_at: number | string;
  updated_by: string;
  version: number | string;
};

type ObservationSummaryRow = {
  approval_count: number | string;
  estimated_cost_microusd: number | string;
  requests: number | string;
  tool_call_count: number | string;
};

type ObservationHistoryRow = {
  action_outcome: string;
  command: string;
  created_at: number | string;
  id: string;
  outcome: string;
};

type ObservationCountRow = { requests: number | string };

type ApprovedCorrectionRow = {
  category: AdminAIApprovedPreferenceCorrection["category"];
  correction_text: string;
};

const OWNER_SETTINGS_ID = "default";
const schemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const MUTATION_KEYS = new Set(["clearSafeMemory", "expectedVersion", "ownerConfig", "preferences"]);
const PREFERENCE_KEYS = new Set([
  "aiPillEnabled",
  "dailyBriefingEnabled",
  "memoryEnabled",
  "notificationPreference",
  "preferredLanguage",
  "proactiveSuggestionsEnabled",
  "reportFormat",
  "responseLength"
]);
const OWNER_CONFIG_KEYS = new Set([
  "actionPermissions",
  "approvedKnowledgeSources",
  "auditConfiguration",
  "featureAvailability",
  "modelRouting",
  "retentionPeriodDays",
  "usageLimits"
]);
const OWNER_NESTED_KEYS = {
  actionPermissions: new Set(["dangerousEnabled", "readEnabled", "writeEnabled"]),
  auditConfiguration: new Set([
    "enabled",
    "recordDeniedAttempts",
    "recordReadEvents",
    "retentionDays"
  ]),
  featureAvailability: new Set([
    "artifacts",
    "dailyBriefing",
    "proactiveSuggestions",
    "streaming",
    "voice"
  ]),
  modelRouting: new Set(["complexModel", "defaultModel", "fallbackModel"]),
  usageLimits: new Set(["dailyRequestsPerAdmin", "maxTokensPerRequest", "monthlyRequestsGlobal"])
} as const;
const KNOWLEDGE_SOURCE_KEYS = new Set(["id", "label", "type", "url"]);
const SETTINGS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_admin_settings (
    admin_email TEXT PRIMARY KEY,
    preferences_json TEXT NOT NULL,
    clear_safe_memory_requested_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_ai_owner_settings (
    id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_ai_settings_events (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('admin', 'owner')),
    event_type TEXT NOT NULL CHECK (event_type IN (
      'preferences-updated', 'safe-memory-clear-requested', 'owner-config-updated'
    )),
    actor_email TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    occurred_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_settings_events_actor_occurred
   ON admin_ai_settings_events (actor_email, occurred_at DESC)`
] as const;

const DEFAULT_PREFERENCES: AdminAIPreferences = {
  aiPillEnabled: true,
  dailyBriefingEnabled: false,
  memoryEnabled: true,
  notificationPreference: "in-app",
  preferredLanguage: "en",
  proactiveSuggestionsEnabled: true,
  reportFormat: "markdown",
  responseLength: "balanced"
};

const DEFAULT_OWNER_CONFIG: AdminAIOwnerConfig = DEFAULT_ADMIN_AI_OWNER_POLICY;

export async function ensureAdminAISettingsSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: schemaCache,
    db,
    setup: async () => {
      for (const statement of SETTINGS_SCHEMA) await db.prepare(statement).run();
    }
  });
}

export function validateAdminAISettingsMutation(value: unknown):
  | {
      input: {
        clearSafeMemory: boolean;
        expectedVersion?: number;
        ownerConfig?: Partial<AdminAIOwnerConfig>;
        preferences?: Partial<AdminAIPreferences>;
      };
      ok: true;
    }
  | { error: string; ok: false } {
  if (!isRecord(value) || hasUnknownKeys(value, MUTATION_KEYS) || Object.keys(value).length === 0) {
    return invalid("Invalid AI settings fields.");
  }
  if (value.clearSafeMemory !== undefined && value.clearSafeMemory !== true) {
    return invalid("Invalid clear-safe-memory request.");
  }
  const preferences =
    value.preferences === undefined ? undefined : normalizePreferencesPatch(value.preferences);
  if (value.preferences !== undefined && !preferences)
    return invalid("Invalid AI preference fields.");
  const ownerConfig =
    value.ownerConfig === undefined ? undefined : normalizeOwnerConfigPatch(value.ownerConfig);
  if (value.ownerConfig !== undefined && !ownerConfig) return invalid("Invalid owner AI settings.");
  if (ownerConfig && !nonNegativeInteger(value.expectedVersion)) {
    return invalid("A valid expected owner settings version is required.");
  }
  if (!ownerConfig && value.expectedVersion !== undefined) {
    return invalid("Owner settings version requires an owner settings update.");
  }
  return {
    input: {
      clearSafeMemory: value.clearSafeMemory === true,
      ...(ownerConfig ? { expectedVersion: value.expectedVersion as number } : {}),
      ...(ownerConfig ? { ownerConfig } : {}),
      ...(preferences ? { preferences } : {})
    },
    ok: true
  };
}

export async function getAdminAISettingsCenter({
  actor,
  db
}: {
  actor: AdminAISettingsActor;
  db: D1Database;
}) {
  const safeActor = normalizeActor(actor);
  if (!safeActor) throw new Error("Invalid settings actor.");
  await ensureAdminAISettingsSchema(db);
  const settingsRow = await db
    .prepare(
      `SELECT admin_email, preferences_json, clear_safe_memory_requested_at, updated_at, updated_by
       FROM admin_ai_admin_settings WHERE admin_email = ?1 LIMIT 1`
    )
    .bind(safeActor.email)
    .first<SettingsRow>();
  const visibility = await readVisibility(db, safeActor);
  const [ownerPolicy, usageBudget] = await Promise.all([
    readOwnerPolicy(db),
    readUsageBudget(db, safeActor.email)
  ]);
  const settings = settingsRow
    ? parsePreferences(settingsRow.preferences_json)
    : { ...DEFAULT_PREFERENCES };
  const approvedCorrections = settings.memoryEnabled
    ? await readApprovedPreferenceCorrections(
        db,
        safeActor.email,
        Number(settingsRow?.clear_safe_memory_requested_at || 0)
      )
    : [];
  const center = {
    actionHistory: visibility.actionHistory,
    approvedCorrections,
    clearSafeMemoryRequestedAt: settingsRow?.clear_safe_memory_requested_at
      ? toIso(settingsRow.clear_safe_memory_requested_at)
      : null,
    preferences: settings,
    privacy: {
      memory:
        "Safe memory is optional, permission-scoped, and can be disabled or queued for clearing by this admin.",
      retention:
        "Artifact, action, and settings retention follows the owner-approved retention and audit policy.",
      sharing:
        "AI settings and safe history never expose another admin's data unless the viewer is the owner."
    },
    updatedAt: settingsRow ? toIso(settingsRow.updated_at) : null,
    updatedBy: settingsRow?.updated_by || null,
    effectivePolicy: cloneOwnerConfig(ownerPolicy.config),
    usage: visibility.usage,
    usageBudget
  };
  if (!safeActor.isOwner) return center;
  return {
    ...center,
    ownerConfig: {
      ...ownerPolicy.config,
      updatedAt: ownerPolicy.row ? toIso(ownerPolicy.row.updated_at) : null,
      updatedBy: ownerPolicy.row?.updated_by || null,
      version: ownerPolicy.row ? positiveInteger(Number(ownerPolicy.row.version)) : 0
    }
  };
}

export async function updateAdminAISettingsCenter({
  actor,
  db,
  input
}: {
  actor: AdminAISettingsActor;
  db: D1Database;
  input: unknown;
}): Promise<
  | { ok: true; settings: Awaited<ReturnType<typeof getAdminAISettingsCenter>>; status: 200 }
  | {
      code: "conflict" | "forbidden" | "invalid" | "unavailable";
      message: string;
      ok: false;
      status: 400 | 403 | 409 | 503;
    }
> {
  const safeActor = normalizeActor(actor);
  if (!safeActor) {
    return failure("invalid", "Invalid settings actor.", 400);
  }
  if (isRecord(input) && input.ownerConfig !== undefined && !safeActor.isOwner) {
    return failure("forbidden", "Owner access is required for AI policy settings.", 403);
  }
  const validated = validateAdminAISettingsMutation(input);
  if (!validated.ok) {
    return failure("invalid", validated.error, 400);
  }
  await ensureAdminAISettingsSchema(db);
  const now = nowSeconds();

  if (validated.input.preferences || validated.input.clearSafeMemory) {
    const current = await db
      .prepare(
        `SELECT admin_email, preferences_json, clear_safe_memory_requested_at, updated_at, updated_by
         FROM admin_ai_admin_settings WHERE admin_email = ?1 LIMIT 1`
      )
      .bind(safeActor.email)
      .first<SettingsRow>();
    const preferences = {
      ...(current ? parsePreferences(current.preferences_json) : DEFAULT_PREFERENCES),
      ...(validated.input.preferences || {}),
      ...(validated.input.clearSafeMemory ? { memoryEnabled: false } : {})
    };
    const clearAt = validated.input.clearSafeMemory
      ? now
      : current?.clear_safe_memory_requested_at === null ||
          current?.clear_safe_memory_requested_at === undefined
        ? null
        : Number(current.clear_safe_memory_requested_at);
    const statements = [
      db
        .prepare(
          `INSERT INTO admin_ai_admin_settings (
            admin_email, preferences_json, clear_safe_memory_requested_at,
            created_at, updated_at, updated_by
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT(admin_email) DO UPDATE SET
            preferences_json = excluded.preferences_json,
            clear_safe_memory_requested_at = excluded.clear_safe_memory_requested_at,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by`
        )
        .bind(safeActor.email, JSON.stringify(preferences), clearAt, now, now, safeActor.email)
    ];
    if (validated.input.preferences) {
      statements.push(settingsEvent(db, "admin", "preferences-updated", safeActor.email, now, now));
    }
    if (validated.input.clearSafeMemory) {
      statements.push(
        settingsEvent(db, "admin", "safe-memory-clear-requested", safeActor.email, now, now)
      );
    }
    const requiredChangeCount = statements.length;
    if (validated.input.clearSafeMemory) {
      statements.push(
        db
          .prepare(
            `DELETE FROM admin_ai_evaluation_inputs
             WHERE correction_id IN (
               SELECT id FROM admin_ai_corrections
               WHERE admin_email = ?1 AND review_status = 'approved'
             )`
          )
          .bind(safeActor.email),
        db
          .prepare(
            `DELETE FROM admin_ai_improvement_records
             WHERE correction_id IN (
               SELECT id FROM admin_ai_corrections
               WHERE admin_email = ?1 AND review_status = 'approved'
             )`
          )
          .bind(safeActor.email),
        db
          .prepare(
            `DELETE FROM admin_ai_corrections
             WHERE admin_email = ?1 AND review_status = 'approved'`
          )
          .bind(safeActor.email)
      );
    }
    const results = await db.batch(statements);
    const requiredChangesPersisted = results
      .slice(0, requiredChangeCount)
      .every((result) => result.success && Number(result.meta.changes) === 1);
    const optionalDeletesSucceeded = results
      .slice(requiredChangeCount)
      .every((result) => result.success);
    if (!requiredChangesPersisted || !optionalDeletesSucceeded) {
      return failure("unavailable", "Durable AI settings storage is unavailable.", 503);
    }
  }

  if (validated.input.ownerConfig) {
    const expectedVersion = validated.input.expectedVersion as number;
    const current = await db
      .prepare(
        `SELECT config_json, version, updated_at, updated_by
         FROM admin_ai_owner_settings WHERE id = ?1 LIMIT 1`
      )
      .bind(OWNER_SETTINGS_ID)
      .first<OwnerSettingsRow>();
    const currentVersion = current ? positiveInteger(Number(current.version)) : 0;
    if (current && currentVersion === 0) {
      return failure("unavailable", "Durable owner AI settings storage is unavailable.", 503);
    }
    if (currentVersion !== expectedVersion) {
      return failure("conflict", "Owner AI settings changed. Reload and try again.", 409);
    }
    const config = mergeOwnerConfig(
      current ? parseOwnerConfig(current.config_json) : DEFAULT_OWNER_CONFIG,
      validated.input.ownerConfig
    );
    const version = expectedVersion + 1;
    const statements = [
      db
        .prepare(
          `INSERT INTO admin_ai_owner_settings (
            id, config_json, version, created_at, updated_at, updated_by
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6
          WHERE ?7 = 0 OR EXISTS (
            SELECT 1 FROM admin_ai_owner_settings WHERE id = ?1 AND version = ?7
          )
          ON CONFLICT(id) DO UPDATE SET
            config_json = excluded.config_json,
            version = admin_ai_owner_settings.version + 1,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
          WHERE admin_ai_owner_settings.version = ?7`
        )
        .bind(
          OWNER_SETTINGS_ID,
          JSON.stringify(config),
          version,
          now,
          now,
          safeActor.email,
          expectedVersion
        ),
      settingsEvent(db, "owner", "owner-config-updated", safeActor.email, version, now)
    ];
    const results = await db.batch(statements);
    if (hasNoChangesEach(results, 2)) {
      return failure("conflict", "Owner AI settings changed. Reload and try again.", 409);
    }
    if (!hasOneChangeEach(results, 2)) {
      return failure("unavailable", "Durable owner AI settings storage is unavailable.", 503);
    }
  }

  return {
    ok: true,
    settings: await getAdminAISettingsCenter({ actor: safeActor, db }),
    status: 200
  };
}

async function readOwnerPolicy(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT config_json, version, updated_at, updated_by
       FROM admin_ai_owner_settings WHERE id = ?1 LIMIT 1`
    )
    .bind(OWNER_SETTINGS_ID)
    .first<OwnerSettingsRow>();
  return {
    config: row ? parseOwnerConfig(row.config_json) : cloneOwnerConfig(DEFAULT_OWNER_CONFIG),
    row
  };
}

async function readUsageBudget(db: D1Database, adminEmail: string) {
  const now = new Date();
  const dailyStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000
  );
  const monthlyStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  try {
    const [daily, monthly] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS requests FROM admin_ai_observations
           WHERE admin_email = ?1 AND created_at >= ?2`
        )
        .bind(adminEmail, dailyStart)
        .first<ObservationCountRow>(),
      db
        .prepare(
          `SELECT COUNT(*) AS requests FROM admin_ai_observations
           WHERE created_at >= ?1`
        )
        .bind(monthlyStart)
        .first<ObservationCountRow>()
    ]);
    return {
      dailyRequestsPerAdmin: numberValue(daily?.requests),
      monthlyRequestsGlobal: numberValue(monthly?.requests)
    };
  } catch {
    return { dailyRequestsPerAdmin: 0, monthlyRequestsGlobal: 0 };
  }
}

async function readApprovedPreferenceCorrections(
  db: D1Database,
  adminEmail: string,
  clearedAt: number
): Promise<AdminAIApprovedPreferenceCorrection[]> {
  try {
    const rows = await db
      .prepare(
        `SELECT c.category, c.correction_text
         FROM admin_ai_corrections c
         INNER JOIN admin_ai_improvement_records i ON i.correction_id = c.id
         WHERE c.admin_email = ?1
           AND c.review_status = 'approved'
           AND c.category IN ('preferred-wording', 'workflow-preference')
           AND c.automatic_retraining = 0
           AND i.status = 'approved'
           AND i.security_override = 0
           AND i.automatic_retraining = 0
           AND i.approved_at > ?2
         ORDER BY i.approved_at ASC LIMIT 40`
      )
      .bind(adminEmail, clearedAt)
      .all<ApprovedCorrectionRow>();
    return (rows.results || []).map((row) => ({
      automaticRetraining: false,
      category: row.category,
      correction: redactAdminAIText(row.correction_text).slice(0, 1200),
      reviewStatus: "approved",
      securityOverride: false
    }));
  } catch {
    return [];
  }
}

async function readVisibility(db: D1Database, actor: AdminAISettingsActor) {
  const scope = actor.isOwner ? "all-admins" : "self";
  const cutoff = getAdminAIRetentionCutoffSeconds();
  const where = actor.isOwner
    ? " WHERE created_at > ?1"
    : " WHERE admin_email = ?1 AND created_at > ?2";
  const params = actor.isOwner ? [cutoff] : [actor.email, cutoff];
  try {
    const summaryStatement = db.prepare(
      `SELECT COUNT(*) AS requests,
              COALESCE(SUM(tool_call_count), 0) AS tool_call_count,
              COALESCE(SUM(approval_count), 0) AS approval_count,
              COALESCE(SUM(estimated_cost_microusd), 0) AS estimated_cost_microusd
       FROM admin_ai_observations${where}`
    );
    const historyStatement = db.prepare(
      `SELECT id, command, outcome, action_outcome, created_at
       FROM admin_ai_observations${where} ORDER BY created_at DESC LIMIT 20`
    );
    const [summary, history] = await Promise.all([
      summaryStatement.bind(...params).first<ObservationSummaryRow>(),
      historyStatement.bind(...params).all<ObservationHistoryRow>()
    ]);
    return {
      actionHistory: {
        available: true,
        entries: (history.results || []).map((row) => ({
          actionOutcome: row.action_outcome,
          command: row.command,
          createdAt: toIso(row.created_at),
          id: row.id,
          outcome: row.outcome
        })),
        scope
      },
      usage: {
        approvals: numberValue(summary?.approval_count),
        available: true,
        estimatedCostMicrousd: numberValue(summary?.estimated_cost_microusd),
        requests: numberValue(summary?.requests),
        scope,
        toolCalls: numberValue(summary?.tool_call_count)
      }
    };
  } catch {
    return {
      actionHistory: { available: false, entries: [], scope },
      usage: {
        approvals: 0,
        available: false,
        estimatedCostMicrousd: 0,
        requests: 0,
        scope,
        toolCalls: 0
      }
    };
  }
}

function normalizePreferencesPatch(value: unknown): Partial<AdminAIPreferences> | null {
  if (
    !isRecord(value) ||
    hasUnknownKeys(value, PREFERENCE_KEYS) ||
    Object.keys(value).length === 0
  ) {
    return null;
  }
  const booleans = [
    "aiPillEnabled",
    "dailyBriefingEnabled",
    "memoryEnabled",
    "proactiveSuggestionsEnabled"
  ] as const;
  if (booleans.some((key) => value[key] !== undefined && typeof value[key] !== "boolean"))
    return null;
  if (
    value.responseLength !== undefined &&
    !["balanced", "concise", "detailed"].includes(String(value.responseLength))
  ) {
    return null;
  }
  if (
    value.reportFormat !== undefined &&
    !["json", "markdown", "plain-text"].includes(String(value.reportFormat))
  ) {
    return null;
  }
  if (
    value.notificationPreference !== undefined &&
    !["both", "email", "in-app", "none"].includes(String(value.notificationPreference))
  ) {
    return null;
  }
  if (
    value.preferredLanguage !== undefined &&
    !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(String(value.preferredLanguage))
  ) {
    return null;
  }
  return { ...value } as Partial<AdminAIPreferences>;
}

function normalizeOwnerConfigPatch(value: unknown): Partial<AdminAIOwnerConfig> | null {
  if (
    !isRecord(value) ||
    hasUnknownKeys(value, OWNER_CONFIG_KEYS) ||
    Object.keys(value).length === 0
  ) {
    return null;
  }
  for (const key of Object.keys(OWNER_NESTED_KEYS) as Array<keyof typeof OWNER_NESTED_KEYS>) {
    const section = value[key];
    if (section === undefined) continue;
    if (!isRecord(section) || hasUnknownKeys(section, OWNER_NESTED_KEYS[key])) return null;
  }
  if (
    !validBooleanSection(value.actionPermissions) ||
    !validBooleanSection(value.featureAvailability)
  ) {
    return null;
  }
  if (value.auditConfiguration !== undefined) {
    const audit = value.auditConfiguration as Record<string, unknown>;
    if (
      !validBooleanSection(audit, ["enabled", "recordDeniedAttempts", "recordReadEvents"]) ||
      (audit.retentionDays !== undefined && audit.retentionDays !== 90)
    ) {
      return null;
    }
  }
  if (value.modelRouting !== undefined) {
    const routing = value.modelRouting as Record<string, unknown>;
    if (Object.values(routing).some((item) => !parseIdentifier(item, 80))) return null;
  }
  if (value.usageLimits !== undefined) {
    const limits = value.usageLimits as Record<string, unknown>;
    if (
      (limits.dailyRequestsPerAdmin !== undefined &&
        !integerBetween(limits.dailyRequestsPerAdmin, 1, 100_000)) ||
      (limits.monthlyRequestsGlobal !== undefined &&
        !integerBetween(limits.monthlyRequestsGlobal, 1, 10_000_000)) ||
      (limits.maxTokensPerRequest !== undefined &&
        !integerBetween(limits.maxTokensPerRequest, 256, 131_072))
    ) {
      return null;
    }
  }
  if (
    value.retentionPeriodDays !== undefined &&
    value.retentionPeriodDays !== 90
  ) {
    return null;
  }
  if (value.approvedKnowledgeSources !== undefined) {
    if (
      !Array.isArray(value.approvedKnowledgeSources) ||
      value.approvedKnowledgeSources.length > 100
    ) {
      return null;
    }
    for (const source of value.approvedKnowledgeSources) {
      if (!isRecord(source) || hasUnknownKeys(source, KNOWLEDGE_SOURCE_KEYS)) return null;
      const id = parseIdentifier(source.id, 80);
      const label = cleanText(source.label, 120);
      if (!id || !label || !["internal", "public-url"].includes(String(source.type))) return null;
      if (source.type === "public-url" && !allowedPublicUrl(source.url)) return null;
      if (source.type === "internal" && source.url !== undefined) return null;
    }
  }
  return value as Partial<AdminAIOwnerConfig>;
}

function mergeOwnerConfig(base: AdminAIOwnerConfig, patch: Partial<AdminAIOwnerConfig>) {
  return {
    ...cloneOwnerConfig(base),
    ...patch,
    actionPermissions: { ...base.actionPermissions, ...(patch.actionPermissions || {}) },
    auditConfiguration: {
      ...base.auditConfiguration,
      ...(patch.auditConfiguration || {}),
      retentionDays: 90
    },
    featureAvailability: { ...base.featureAvailability, ...(patch.featureAvailability || {}) },
    modelRouting: { ...base.modelRouting, ...(patch.modelRouting || {}) },
    retentionPeriodDays: 90,
    usageLimits: { ...base.usageLimits, ...(patch.usageLimits || {}) }
  };
}

function parsePreferences(value: string) {
  const parsed = JSON.parse(value) as unknown;
  const normalized = normalizePreferencesPatch(parsed);
  if (!normalized || Object.keys(normalized).length !== PREFERENCE_KEYS.size) {
    throw new Error("Invalid persisted Admin AI preferences.");
  }
  return { ...DEFAULT_PREFERENCES, ...normalized };
}

function parseOwnerConfig(value: string) {
  const parsed = JSON.parse(value) as unknown;
  const normalized = normalizeOwnerConfigPatch(parsed);
  if (!normalized || Object.keys(normalized).length !== OWNER_CONFIG_KEYS.size) {
    throw new Error("Invalid persisted owner AI settings.");
  }
  return mergeOwnerConfig(DEFAULT_OWNER_CONFIG, normalized);
}

function settingsEvent(
  db: D1Database,
  scope: "admin" | "owner",
  eventType: "owner-config-updated" | "preferences-updated" | "safe-memory-clear-requested",
  actorEmail: string,
  version: number,
  occurredAt: number
) {
  return db
    .prepare(
      `INSERT INTO admin_ai_settings_events (
        id, scope, event_type, actor_email, version, occurred_at
      ) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1`
    )
    .bind(
      `admin-ai-settings-event-${crypto.randomUUID()}`,
      scope,
      eventType,
      actorEmail,
      version,
      occurredAt
    );
}

function cloneOwnerConfig(config: AdminAIOwnerConfig): AdminAIOwnerConfig {
  return JSON.parse(JSON.stringify(config)) as AdminAIOwnerConfig;
}

function normalizeActor(actor: AdminAISettingsActor) {
  const email = normalizeEmail(actor?.email);
  return email ? { email, isOwner: actor.isOwner === true } : null;
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : "";
}

function validBooleanSection(value: unknown, keys?: string[]) {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (keys || Object.keys(value)).every(
    (key) => value[key] === undefined || typeof value[key] === "boolean"
  );
}

function allowedPublicUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function integerBetween(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) && normalized.length <= maxLength ? normalized : "";
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

function hasOneChangeEach(results: D1Result<unknown>[], count: number) {
  return (
    results.length === count &&
    results.every((result) => result.success && Number(result.meta.changes) === 1)
  );
}

function hasNoChangesEach(results: D1Result<unknown>[], count: number) {
  return (
    results.length === count &&
    results.every((result) => result.success && Number(result.meta.changes) === 0)
  );
}

function failure(
  code: "conflict" | "forbidden" | "invalid" | "unavailable",
  message: string,
  status: 400 | 403 | 409 | 503
) {
  return { code, message, ok: false as const, status };
}

function invalid(error: string) {
  return { error, ok: false as const };
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function nonNegativeInteger(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}

function numberValue(value: number | string | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toIso(value: number | string) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) throw new Error("Invalid AI settings timestamp.");
  return new Date(seconds * 1000).toISOString();
}

function hasUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).some((key) => !allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
