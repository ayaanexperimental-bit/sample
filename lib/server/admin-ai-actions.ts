import type { D1Database, D1Result } from "@cloudflare/workers-types";
import {
  ADMIN_AI_REGISTERED_ACTION_CONTRACTS,
  getAdminAICommand,
  type AdminAICommand,
  type AdminAIRegisteredActionHandlerId
} from "../admin-ai/adminAIRegistry";
import type { AdminAIResponse } from "../admin-ai/adminAIService";
import type { AdminAIApprovalReceipt } from "../admin-ai/adminAITypes";
import { hasActiveAdminAIIncidentFreeze, isAdminAICommandFrozen } from "./admin-ai-incidents";
import { getAdminAISettingsCenter } from "./admin-ai-settings";
import {
  getAdminSupportDefaults,
  normalizeAdminSupportDefaultsInput,
  type AdminSupportDefaults,
  type AdminSupportDefaultsEnv
} from "./admin-support-defaults";
import { runCachedD1SchemaSetup, type D1SchemaCacheEntry } from "./d1-schema-cache";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";
import { ensureErrorReportsSchema } from "./error-reports";
import { getShopOrder, getVerifiedPublishedShopOrder, retryShopPublish } from "./shop";

type ErrorReportStatus = "Fixed" | "Ignored" | "New" | "Reviewing";
type SettingsRow = { preferences_json: string };
export type AdminAIServerActionHandlerId =
  | AdminAIRegisteredActionHandlerId
  | "settings-support-defaults-update"
  | "shop-paid-order-publish-retry";
export type AdminAIServerActionCommand = Omit<AdminAICommand, "handlerId"> & {
  handlerId: AdminAIServerActionHandlerId;
};
type AdminAIServerActionContract = {
  actionId: string;
  executionContract: AdminAICommand["executionContract"];
  failureMessage: string;
  handlerId: AdminAIServerActionHandlerId;
  inputSchema: AdminAICommand["inputSchema"];
  requiredPermissions: string[];
  sectionId: AdminAICommand["sectionId"];
  successMessage: string;
};

type AdminAIActionReceiptRow = {
  action_id: string;
  admin_email: string;
  applied_value: string;
  audit_reference: string;
  created_at: number | string;
  handler_id: string;
  id: string;
  previous_value: string;
  recommendation_reference: string;
  record_id: string;
  rollback_audit_reference: string | null;
  rollback_available: number | string;
  rolled_back_at: number | string | null;
  section_id: string;
};

export type AdminAIActionReceipt = {
  actionId: string;
  adminEmail: string;
  appliedValue: string;
  auditReference: string;
  createdAt: number;
  handlerId: AdminAIServerActionHandlerId;
  id: string;
  previousValue: string;
  recommendationReference: string;
  recordId: string;
  rollbackAuditReference: string | null;
  rollbackAvailable: boolean;
  rolledBackAt: number | null;
  sectionId: string;
};

export type AdminAIRegisteredActionResult = {
  ok: boolean;
  response: AdminAIResponse;
  status: number;
};

type CompleteAdminAIApprovalReceipt = AdminAIApprovalReceipt & {
  executionStatus: "failure" | "success";
  impactLabel: "Impact";
  recommendedByAI: string;
  rollbackAvailable: boolean;
};

const ACTION_RECEIPT_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS admin_ai_action_receipts (
    id TEXT PRIMARY KEY,
    audit_reference TEXT NOT NULL UNIQUE,
    action_id TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    record_id TEXT NOT NULL,
    previous_value TEXT NOT NULL,
    applied_value TEXT NOT NULL,
    recommendation_reference TEXT NOT NULL,
    rollback_available INTEGER NOT NULL DEFAULT 1 CHECK (rollback_available IN (0, 1)),
    created_at INTEGER NOT NULL,
    rolled_back_at INTEGER,
    rollback_audit_reference TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_action_receipts_admin_created_at
   ON admin_ai_action_receipts (admin_email, created_at DESC)`
];

const receiptSchemaCache = new WeakMap<D1Database, D1SchemaCacheEntry>();
const ERROR_REPORT_STATUSES = new Set<ErrorReportStatus>(["Fixed", "Ignored", "New", "Reviewing"]);
const PROACTIVE_SUGGESTIONS_KEY = "proactiveSuggestionsEnabled";
const PROACTIVE_SUGGESTIONS_RECORD_ID = `settings:${PROACTIVE_SUGGESTIONS_KEY}`;
const SUPPORT_DEFAULTS_KEY = "supportDefaults";
const SUPPORT_DEFAULTS_RECORD_ID = `settings:${SUPPORT_DEFAULTS_KEY}`;
const SETTINGS_SUPPORT_DEFAULTS_UPDATE_CONTRACT: AdminAIServerActionContract = {
  actionId: "settings.update-support-defaults",
  executionContract: {
    availability: "executable",
    blockedReason: null,
    currentStateLabel: "Current support-default snapshot",
    dependencies: [
      "Authenticated admin session and CSRF validation",
      "Permission: settings.support",
      "Durable ADMIN_DB action receipt",
      "Atomic admin audit persistence"
    ],
    issueClassification: "recommendation",
    maxBatchSize: 1,
    maxSelectedRecords: 0,
    minSelectedRecords: 0,
    proposedStateLabel: "Validated support-default snapshot"
  },
  failureMessage: "Support defaults update failed",
  handlerId: "settings-support-defaults-update",
  inputSchema: {
    currentValue: "string",
    proposedValue: "string",
    settingKey: "string"
  },
  requiredPermissions: ["settings.support"],
  sectionId: "settings",
  successMessage: "Support defaults updated"
};
const SHOP_PAID_ORDER_PUBLISH_RETRY_CONTRACT: AdminAIServerActionContract = {
  actionId: "shop.retry-publish",
  executionContract: {
    availability: "executable",
    blockedReason: null,
    currentStateLabel: "Paid Shop order awaiting publish retry",
    dependencies: [
      "Authenticated admin session and CSRF validation",
      "Permission: shop.recovery",
      "Durable ADMIN_DB action receipt",
      "Verified existing Shop publish path"
    ],
    issueClassification: "protected-workflow",
    maxBatchSize: 1,
    maxSelectedRecords: 1,
    minSelectedRecords: 1,
    proposedStateLabel: "Verified published Shop order"
  },
  failureMessage: "Paid-order publish retry failed",
  handlerId: "shop-paid-order-publish-retry",
  inputSchema: { orderId: "string" },
  requiredPermissions: ["shop.recovery"],
  sectionId: "shop",
  successMessage: "Paid Shop order published"
};

const SETTINGS_SUPPORT_DEFAULTS_UPDATE_COMMAND: AdminAIServerActionCommand = {
  approvalLevel: 2,
  auditLogEnabled: true,
  confirmationRequired: true,
  description: "Update one validated support-default snapshot after exact before-and-after review.",
  ...SETTINGS_SUPPORT_DEFAULTS_UPDATE_CONTRACT,
  id: SETTINGS_SUPPORT_DEFAULTS_UPDATE_CONTRACT.actionId,
  kind: "registered-action",
  label: "Update support defaults",
  responseHandlerId: "registered-action",
  rollback: "available-after-persist",
  type: "write"
};

const SHOP_PAID_ORDER_PUBLISH_RETRY_COMMAND: AdminAIServerActionCommand = {
  approvalLevel: 2,
  auditLogEnabled: true,
  confirmationRequired: true,
  description:
    "Retry one permission-visible paid Shop order through the existing protected publish path.",
  ...SHOP_PAID_ORDER_PUBLISH_RETRY_CONTRACT,
  id: SHOP_PAID_ORDER_PUBLISH_RETRY_CONTRACT.actionId,
  kind: "registered-action",
  label: "Retry paid-order publish",
  responseHandlerId: "registered-action",
  rollback: "not-available",
  type: "write"
};

export function getAdminAIServerActionCommand(
  actionId: string
): AdminAICommand | AdminAIServerActionCommand | undefined {
  return (
    getAdminAICommand(actionId) ||
    (actionId === SETTINGS_SUPPORT_DEFAULTS_UPDATE_COMMAND.id
      ? SETTINGS_SUPPORT_DEFAULTS_UPDATE_COMMAND
      : actionId === SHOP_PAID_ORDER_PUBLISH_RETRY_COMMAND.id
        ? SHOP_PAID_ORDER_PUBLISH_RETRY_COMMAND
        : undefined)
  );
}

export function hasAdminAIRegisteredActionHandler(
  handlerId: string | undefined
): handlerId is AdminAIServerActionHandlerId {
  return (
    handlerId === "error-report-status-reviewing" ||
    handlerId === "settings-proactive-suggestions-update" ||
    handlerId === "settings-support-defaults-update" ||
    handlerId === "shop-paid-order-publish-retry"
  );
}

export async function executeAdminAIRegisteredAction({
  adminEmail,
  command,
  currentValue,
  db,
  proposedValue,
  referenceId,
  settingKey,
  supportDefaultsEnv
}: {
  adminEmail: string;
  command: AdminAICommand | AdminAIServerActionCommand;
  currentValue?: unknown;
  db: D1Database;
  proposedValue?: unknown;
  referenceId?: string;
  settingKey?: string;
  supportDefaultsEnv?: AdminSupportDefaultsEnv;
}): Promise<AdminAIRegisteredActionResult> {
  if (!hasAdminAIExecutableActionContract(command)) {
    return failure(
      "Registered action unavailable",
      "No registered server handler exists for this action.",
      400
    );
  }
  if (command.handlerId === "settings-proactive-suggestions-update") {
    return executeProactiveSuggestionsUpdate({
      adminEmail,
      command,
      currentValue,
      db,
      proposedValue,
      settingKey
    });
  }
  if (command.handlerId === "settings-support-defaults-update") {
    return executeSupportDefaultsUpdate({
      adminEmail,
      command,
      currentValue,
      db,
      proposedValue,
      settingKey,
      supportDefaultsEnv
    });
  }
  if (command.handlerId === "shop-paid-order-publish-retry") {
    return executePaidOrderPublishRetry({
      adminEmail,
      command,
      db,
      orderId: referenceId
    });
  }
  const cleanReferenceId = parseIdentifier(referenceId, 80);
  if (!cleanReferenceId) {
    return failure(
      command.failureMessage,
      "Select one valid error report before running this action.",
      400
    );
  }

  try {
    await ensureErrorReportsSchema(db);
    await ensureAdminAIActionReceiptSchema(db);
  } catch {
    return failure(
      command.failureMessage,
      "Durable action storage is unavailable. No data changed.",
      503
    );
  }
  const freezeFailure = await getIncidentFreezeFailure(command, db);
  if (freezeFailure) return freezeFailure;

  let current: { reference_id: string; status: string } | null;
  try {
    current = await db
      .prepare(
        `SELECT reference_id, status
         FROM error_reports
         WHERE reference_id = ?1
         LIMIT 1`
      )
      .bind(cleanReferenceId)
      .first<{ reference_id: string; status: string }>();
  } catch {
    return failure(
      command.failureMessage,
      "The selected report could not be verified. No data changed.",
      503
    );
  }
  const previousValue = parseErrorReportStatus(current?.status);
  if (!current || !previousValue) {
    return failure(
      command.failureMessage,
      "The selected error report no longer exists. No data changed.",
      404
    );
  }
  const appliedValue: ErrorReportStatus = "Reviewing";
  if (previousValue === appliedValue) {
    return failure(
      command.failureMessage,
      "The selected error report is already Reviewing. No data changed.",
      409
    );
  }

  const now = getNowSeconds();
  const normalizedEmail = normalizeEmail(adminEmail);
  const receiptId = `admin-ai-receipt-${crypto.randomUUID()}`;
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const recommendationReference = `command:${command.id}`;
  const auditReason = buildAuditReason({
    actionId: command.id,
    confirmation: "accepted",
    outcome: "completed",
    receiptId,
    recordId: cleanReferenceId,
    sectionId: command.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `UPDATE error_reports
           SET status = ?1, updated_at = ?2
           WHERE reference_id = ?3 AND status = ?4
             AND NOT EXISTS (
               SELECT 1 FROM admin_ai_incidents
               WHERE status = 'active' AND freeze_active = 1
             )`
        )
        .bind(appliedValue, now, cleanReferenceId, previousValue),
      db
        .prepare(
          `INSERT INTO admin_ai_action_receipts (
            id, audit_reference, action_id, handler_id, section_id, admin_email,
            record_id, previous_value, applied_value, recommendation_reference,
            rollback_available, created_at, rolled_back_at, rollback_audit_reference
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, NULL, NULL
          WHERE changes() = 1`
        )
        .bind(
          receiptId,
          auditReference,
          command.id,
          command.handlerId,
          command.sectionId,
          normalizedEmail,
          cleanReferenceId,
          previousValue,
          appliedValue,
          recommendationReference,
          now
        ),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           SELECT ?1, 'ai_action', ?3, ?4, ?5
           FROM admin_ai_action_receipts
           WHERE id = ?2`
        )
        .bind(auditReference, receiptId, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 3)) {
      const activeFreeze = await getIncidentFreezeFailure(command, db);
      if (activeFreeze) return activeFreeze;
      const body = "The selected report changed before execution. No success is claimed.";
      return failure(
        command.failureMessage,
        body,
        409,
        "action-failed",
        buildApprovalReceipt({
          affectedRecords: [cleanReferenceId],
          auditReference: null,
          command,
          currentState: `Status: ${previousValue}`,
          executionStatus: "failure",
          outcome: body,
          proposedState: `Status: ${appliedValue}`,
          recordsChanged: 0,
          requestedBy: normalizedEmail,
          rollbackAvailable: false,
          timestamp: now
        })
      );
    }
  } catch {
    const activeFreeze = await getIncidentFreezeFailure(command, db);
    if (activeFreeze?.status === 423) return activeFreeze;
    const body = "The protected action could not be audited and persisted. No data changed.";
    return failure(
      command.failureMessage,
      body,
      503,
      "action-failed",
      buildApprovalReceipt({
        affectedRecords: [cleanReferenceId],
        auditReference: null,
        command,
        currentState: `Status: ${previousValue}`,
        executionStatus: "failure",
        outcome: body,
        proposedState: `Status: ${appliedValue}`,
        recordsChanged: 0,
        requestedBy: normalizedEmail,
        rollbackAvailable: false,
        timestamp: now
      })
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        affectedRecords: [cleanReferenceId],
        auditReference,
        command,
        currentState: `Status: ${previousValue}`,
        executionStatus: "success",
        outcome: command.successMessage,
        proposedState: `Status: ${appliedValue}`,
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        rollbackAvailable: true,
        timestamp: now
      }),
      body: `Error report ${cleanReferenceId} is now ${appliedValue}.`,
      items: [
        "The server changed exactly one registered record.",
        "The mutation, durable receipt, and audit row were committed atomically."
      ],
      rollbackAction: {
        label: `Restore status to ${previousValue}`,
        receiptId,
        recordId: cleanReferenceId
      },
      state: "action-complete",
      title: command.successMessage
    },
    status: 200
  };
}

type SupportDefaultsSnapshot = Pick<
  AdminSupportDefaults,
  "supportEmail" | "supportMessage" | "supportName" | "supportPhone" | "supportWhatsapp"
>;

async function executeSupportDefaultsUpdate({
  adminEmail,
  command,
  currentValue,
  db,
  proposedValue,
  settingKey,
  supportDefaultsEnv
}: {
  adminEmail: string;
  command: AdminAIServerActionCommand;
  currentValue: unknown;
  db: D1Database;
  proposedValue: unknown;
  settingKey: string | undefined;
  supportDefaultsEnv: AdminSupportDefaultsEnv | undefined;
}): Promise<AdminAIRegisteredActionResult> {
  const expected = parseSupportDefaultsSnapshot(currentValue);
  const proposed = parseSupportDefaultsSnapshot(proposedValue);
  if (
    settingKey !== SUPPORT_DEFAULTS_KEY ||
    !expected ||
    !proposed ||
    serializeSupportDefaults(expected) === serializeSupportDefaults(proposed)
  ) {
    return failure(
      command.failureMessage,
      "Provide one exact validated supportDefaults before-and-after snapshot.",
      400
    );
  }

  const normalizedEmail = normalizeEmail(adminEmail);
  let actual: AdminSupportDefaults;
  try {
    actual = await getAdminSupportDefaults({ ...supportDefaultsEnv, ADMIN_DB: db });
    await ensureAdminAIActionReceiptSchema(db);
  } catch {
    return failure(
      command.failureMessage,
      "The current durable support defaults could not be verified. No data changed.",
      503
    );
  }
  const actualSnapshot = supportDefaultsSnapshot(actual);
  const previousValue = serializeSupportDefaults(expected);
  const appliedValue = serializeSupportDefaults(proposed);
  if (serializeSupportDefaults(actualSnapshot) !== previousValue) {
    return failure(
      command.failureMessage,
      "The support defaults changed before approval. Refresh the exact current values and try again.",
      409
    );
  }

  const freezeFailure = await getIncidentFreezeFailure(command, db);
  if (freezeFailure) return freezeFailure;
  const now = getNowSeconds();
  const receiptId = `admin-ai-receipt-${crypto.randomUUID()}`;
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const auditReason = buildAuditReason({
    actionId: command.id,
    confirmation: "accepted",
    outcome: "completed",
    receiptId,
    recordId: SUPPORT_DEFAULTS_RECORD_ID,
    sectionId: command.sectionId
  });
  const mutation = buildSupportDefaultsMutation({
    actual,
    db,
    next: proposed,
    now,
    updatedBy: normalizedEmail
  });

  try {
    const results = await db.batch([
      mutation,
      db
        .prepare(
          `INSERT INTO admin_ai_action_receipts (
            id, audit_reference, action_id, handler_id, section_id, admin_email,
            record_id, previous_value, applied_value, recommendation_reference,
            rollback_available, created_at, rolled_back_at, rollback_audit_reference
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, NULL, NULL
          WHERE changes() = 1`
        )
        .bind(
          receiptId,
          auditReference,
          command.id,
          command.handlerId,
          command.sectionId,
          normalizedEmail,
          SUPPORT_DEFAULTS_RECORD_ID,
          previousValue,
          appliedValue,
          `command:${command.id}`,
          now
        ),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           SELECT ?1, 'ai_action', ?3, ?4, ?5
           FROM admin_ai_action_receipts
           WHERE id = ?2`
        )
        .bind(auditReference, receiptId, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 3)) {
      return failure(
        command.failureMessage,
        "The support defaults changed before execution. No success is claimed.",
        409
      );
    }
  } catch {
    return failure(
      command.failureMessage,
      "The support-default change could not be audited and persisted. No data changed.",
      503
    );
  }

  try {
    const verified = await getAdminSupportDefaults({ ADMIN_DB: db });
    if (serializeSupportDefaults(supportDefaultsSnapshot(verified)) !== appliedValue) {
      return failure(
        command.failureMessage,
        "The support-default result could not be verified. No success is claimed.",
        503
      );
    }
  } catch {
    return failure(
      command.failureMessage,
      "The support-default result could not be verified. No success is claimed.",
      503
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        affectedRecords: [SUPPORT_DEFAULTS_RECORD_ID],
        auditReference,
        command,
        currentState: "Previous validated support-default snapshot",
        executionStatus: "success",
        outcome: command.successMessage,
        proposedState: "Applied validated support-default snapshot",
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        rollbackAvailable: true,
        timestamp: now
      }),
      body: "The validated support-default snapshot is now active.",
      items: [
        "The server changed one version-checked support-default record.",
        "The text/config change, durable receipt, and audit row were committed atomically."
      ],
      rollbackAction: {
        label: "Restore the previous support defaults",
        receiptId,
        recordId: SUPPORT_DEFAULTS_RECORD_ID
      },
      state: "action-complete",
      title: command.successMessage
    },
    status: 200
  };
}

function buildSupportDefaultsMutation({
  actual,
  db,
  next,
  now,
  updatedBy
}: {
  actual: AdminSupportDefaults;
  db: D1Database;
  next: SupportDefaultsSnapshot;
  now: number;
  updatedBy: string;
}) {
  if (actual.source === "d1_table") {
    return db
      .prepare(
        `UPDATE admin_support_defaults
         SET support_name = ?1, support_email = ?2, support_phone = ?3,
             support_whatsapp = ?4, support_message = ?5,
             updated_at = ?6, updated_by = ?7
         WHERE id = 'default'
           AND support_name = ?8 AND support_email = ?9 AND support_phone = ?10
           AND support_whatsapp = ?11 AND support_message = ?12`
      )
      .bind(
        next.supportName,
        next.supportEmail,
        next.supportPhone,
        next.supportWhatsapp,
        next.supportMessage,
        now,
        updatedBy,
        actual.supportName,
        actual.supportEmail,
        actual.supportPhone,
        actual.supportWhatsapp,
        actual.supportMessage
      );
  }
  return db
    .prepare(
      `INSERT INTO admin_support_defaults (
         id, support_name, support_email, support_phone, support_whatsapp,
         support_message, created_at, updated_at, updated_by
       )
       SELECT 'default', ?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7
       WHERE NOT EXISTS (SELECT 1 FROM admin_support_defaults WHERE id = 'default')`
    )
    .bind(
      next.supportName,
      next.supportEmail,
      next.supportPhone,
      next.supportWhatsapp,
      next.supportMessage,
      now,
      updatedBy
    );
}

function parseSupportDefaultsSnapshot(value: unknown): SupportDefaultsSnapshot | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const normalized = normalizeAdminSupportDefaultsInput(parsed);
    return normalized.ok ? normalized.defaults : null;
  } catch {
    return null;
  }
}

function supportDefaultsSnapshot(value: AdminSupportDefaults): SupportDefaultsSnapshot {
  return {
    supportEmail: value.supportEmail,
    supportMessage: value.supportMessage,
    supportName: value.supportName,
    supportPhone: value.supportPhone,
    supportWhatsapp: value.supportWhatsapp
  };
}

function serializeSupportDefaults(value: SupportDefaultsSnapshot) {
  return JSON.stringify(
    supportDefaultsSnapshot({
      ...value,
      source: "d1_table",
      updatedAt: null,
      updatedBy: ""
    })
  );
}

async function executePaidOrderPublishRetry({
  adminEmail,
  command,
  db,
  orderId
}: {
  adminEmail: string;
  command: AdminAIServerActionCommand;
  db: D1Database;
  orderId: string | undefined;
}): Promise<AdminAIRegisteredActionResult> {
  const cleanOrderId = parseIdentifier(orderId, 160);
  if (!cleanOrderId) {
    return failure(
      command.failureMessage,
      "Select one valid paid Shop order before retrying publish.",
      400
    );
  }

  try {
    await ensureAdminAIActionReceiptSchema(db);
  } catch {
    return failure(
      command.failureMessage,
      "Durable action storage is unavailable. No publish retry started.",
      503
    );
  }
  const freezeFailure = await getIncidentFreezeFailure(command, db);
  if (freezeFailure) return freezeFailure;

  const shopEnv = { ADMIN_DB: db };
  let current: Awaited<ReturnType<typeof getShopOrder>>;
  try {
    current = await getShopOrder(shopEnv, cleanOrderId);
  } catch {
    return failure(
      command.failureMessage,
      "The selected Shop order could not be verified. No publish retry started.",
      503
    );
  }
  if (!current) {
    return failure(
      command.failureMessage,
      "The selected Shop order no longer exists. No publish retry started.",
      404
    );
  }
  if (
    current.siteStatus !== "publish_failed" ||
    (current.paymentStatus !== "paid" && current.paymentStatus !== "publishing")
  ) {
    return failure(
      command.failureMessage,
      "Only one server-verified paid order in publish_failed state can be retried. No data changed.",
      409
    );
  }

  const normalizedEmail = normalizeEmail(adminEmail);
  const now = getNowSeconds();
  const receiptId = `admin-ai-receipt-${crypto.randomUUID()}`;
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const previousValue = `${current.paymentStatus}/${current.siteStatus}`;
  const requestedValue = "retry_requested";
  const requestedReason = buildAuditReason({
    actionId: command.id,
    appliedValue: requestedValue,
    confirmation: "accepted",
    outcome: "requested",
    previousValue,
    receiptId,
    recordId: cleanOrderId,
    sectionId: command.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO admin_ai_action_receipts (
            id, audit_reference, action_id, handler_id, section_id, admin_email,
            record_id, previous_value, applied_value, recommendation_reference,
            rollback_available, created_at, rolled_back_at, rollback_audit_reference
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11, NULL, NULL)`
        )
        .bind(
          receiptId,
          auditReference,
          command.id,
          command.handlerId,
          command.sectionId,
          normalizedEmail,
          cleanOrderId,
          previousValue,
          requestedValue,
          `command:${command.id}`,
          now
        ),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           SELECT ?1, 'ai_action', ?3, ?4, ?5
           FROM admin_ai_action_receipts
           WHERE id = ?2 AND applied_value = 'retry_requested'`
        )
        .bind(auditReference, receiptId, normalizedEmail, requestedReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 2)) {
      return failure(
        command.failureMessage,
        "The durable retry receipt could not be created. No publish retry started.",
        503
      );
    }
  } catch {
    return failure(
      command.failureMessage,
      "The durable retry receipt could not be created. No publish retry started.",
      503
    );
  }

  let retryResult: Awaited<ReturnType<typeof retryShopPublish>>;
  let verified: Awaited<ReturnType<typeof getVerifiedPublishedShopOrder>> = null;
  try {
    retryResult = await retryShopPublish({
      adminEmail: normalizedEmail,
      env: shopEnv,
      orderId: cleanOrderId
    });
    if (retryResult.ok) {
      verified = await getVerifiedPublishedShopOrder(shopEnv, cleanOrderId);
    }
  } catch {
    retryResult = { ok: false, error: "The existing publish path failed safely." };
  }

  const completed = Boolean(retryResult.ok && verified);
  const appliedValue = completed ? "published" : "publish_failed";
  const outcome = completed ? "completed_verified" : "failed_or_unverified";
  const completedReason = buildAuditReason({
    actionId: command.id,
    appliedValue,
    confirmation: "accepted",
    outcome,
    previousValue,
    receiptId,
    recordId: cleanOrderId,
    sectionId: command.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `UPDATE admin_audit_events
           SET reason = ?1
           WHERE id = ?2
             AND email = ?3
             AND reason = ?4
             AND EXISTS (
               SELECT 1
               FROM admin_ai_action_receipts
               WHERE id = ?5
                 AND admin_email = ?3
                 AND applied_value = 'retry_requested'
                 AND rollback_available = 0
             )`
        )
        .bind(completedReason, auditReference, normalizedEmail, requestedReason, receiptId),
      db
        .prepare(
          `UPDATE admin_ai_action_receipts
           SET applied_value = CASE
             WHEN admin_email = ?3
              AND applied_value = 'retry_requested'
              AND rollback_available = 0
              AND changes() = 1
              AND EXISTS (
                SELECT 1
                FROM admin_audit_events
                WHERE id = ?4 AND email = ?3 AND reason = ?5
              )
             THEN ?1
             ELSE NULL
           END
           WHERE id = ?2`
        )
        .bind(appliedValue, receiptId, normalizedEmail, auditReference, completedReason)
    ]);
    if (!hasOneChangePerStatement(results, 2)) {
      return failure(
        command.failureMessage,
        "The publish result could not be durably confirmed. No success is claimed; review the selected order.",
        503
      );
    }
  } catch {
    return failure(
      command.failureMessage,
      "The publish result could not be durably confirmed. No success is claimed; review the selected order.",
      503
    );
  }

  if (!completed || !verified) {
    return failure(
      command.failureMessage,
      retryResult.ok
        ? "The existing publish path returned without a verified published order. No success is claimed."
        : retryResult.error,
      409,
      "action-failed",
      buildApprovalReceipt({
        affectedRecords: [cleanOrderId],
        auditReference,
        command,
        currentState: `Payment/site state: ${previousValue}`,
        executionStatus: "failure",
        outcome: completedReason,
        proposedState: "Payment/site state: published/published",
        recordsChanged: 0,
        requestedBy: normalizedEmail,
        reversible: false,
        rollbackAvailable: false,
        timestamp: now
      })
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        affectedRecords: [cleanOrderId],
        auditReference,
        command,
        currentState: `Payment/site state: ${previousValue}`,
        executionStatus: "success",
        outcome: command.successMessage,
        proposedState: "Payment/site state: published/published",
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        reversible: false,
        rollbackAvailable: false,
        timestamp: now
      }),
      body: `Paid Shop order ${cleanOrderId} is verified published.`,
      items: [
        "The server retried exactly one paid publish_failed order through the existing Shop publish path.",
        "The durable receipt and audit were created before execution and updated only after published-state verification."
      ],
      state: "action-complete",
      title: command.successMessage
    },
    status: 200
  };
}

async function executeProactiveSuggestionsUpdate({
  adminEmail,
  command,
  currentValue,
  db,
  proposedValue,
  settingKey
}: {
  adminEmail: string;
  command: AdminAIServerActionCommand;
  currentValue: unknown;
  db: D1Database;
  proposedValue: unknown;
  settingKey: string | undefined;
}): Promise<AdminAIRegisteredActionResult> {
  if (
    settingKey !== PROACTIVE_SUGGESTIONS_KEY ||
    typeof currentValue !== "boolean" ||
    typeof proposedValue !== "boolean" ||
    currentValue === proposedValue
  ) {
    return failure(
      command.failureMessage,
      "Provide one exact proactiveSuggestionsEnabled before-and-after boolean change.",
      400
    );
  }

  const normalizedEmail = normalizeEmail(adminEmail);
  let currentJson: string | null;
  let actualValue: boolean;
  let nextJson: string;
  try {
    const center = await getAdminAISettingsCenter({
      actor: { email: normalizedEmail, isOwner: false },
      db
    });
    const row = await db
      .prepare(
        `SELECT preferences_json FROM admin_ai_admin_settings WHERE admin_email = ?1 LIMIT 1`
      )
      .bind(normalizedEmail)
      .first<SettingsRow>();
    currentJson = row?.preferences_json || null;
    actualValue = center.preferences.proactiveSuggestionsEnabled;
    nextJson = JSON.stringify({
      ...center.preferences,
      proactiveSuggestionsEnabled: proposedValue
    });
    await ensureAdminAIActionReceiptSchema(db);
  } catch {
    return failure(
      command.failureMessage,
      "The current durable setting could not be verified. No data changed.",
      503
    );
  }

  if (actualValue !== currentValue) {
    const body =
      "The setting changed before approval. Refresh the exact current value and try again.";
    return failure(
      command.failureMessage,
      body,
      409,
      "action-failed",
      buildApprovalReceipt({
        affectedRecords: [PROACTIVE_SUGGESTIONS_RECORD_ID],
        auditReference: null,
        command,
        currentState: `${PROACTIVE_SUGGESTIONS_KEY}: ${actualValue}`,
        executionStatus: "failure",
        outcome: body,
        proposedState: `${PROACTIVE_SUGGESTIONS_KEY}: ${proposedValue}`,
        recordsChanged: 0,
        requestedBy: normalizedEmail,
        rollbackAvailable: false,
        timestamp: getNowSeconds()
      })
    );
  }

  const freezeFailure = await getIncidentFreezeFailure(command, db);
  if (freezeFailure) return freezeFailure;
  const now = getNowSeconds();
  const receiptId = `admin-ai-receipt-${crypto.randomUUID()}`;
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const auditReason = buildAuditReason({
    actionId: command.id,
    appliedValue: String(proposedValue),
    confirmation: "accepted",
    outcome: "completed",
    previousValue: String(currentValue),
    receiptId,
    recordId: PROACTIVE_SUGGESTIONS_RECORD_ID,
    sectionId: command.sectionId
  });
  const mutation = currentJson
    ? db
        .prepare(
          `UPDATE admin_ai_admin_settings
           SET preferences_json = ?1, updated_at = ?2, updated_by = ?3
           WHERE admin_email = ?3 AND preferences_json = ?4`
        )
        .bind(nextJson, now, normalizedEmail, currentJson)
    : db
        .prepare(
          `INSERT INTO admin_ai_admin_settings (
             admin_email, preferences_json, clear_safe_memory_requested_at,
             created_at, updated_at, updated_by
           )
           SELECT ?1, ?2, NULL, ?3, ?3, ?1
           WHERE NOT EXISTS (
             SELECT 1 FROM admin_ai_admin_settings WHERE admin_email = ?1
           )`
        )
        .bind(normalizedEmail, nextJson, now);

  try {
    const results = await db.batch([
      mutation,
      db
        .prepare(
          `INSERT INTO admin_ai_settings_events (
             id, scope, event_type, actor_email, version, occurred_at
           )
           SELECT ?1, 'admin', 'preferences-updated', ?2, ?3, ?3
           WHERE changes() = 1`
        )
        .bind(`admin-ai-settings-event-${crypto.randomUUID()}`, normalizedEmail, now),
      db
        .prepare(
          `INSERT INTO admin_ai_action_receipts (
            id, audit_reference, action_id, handler_id, section_id, admin_email,
            record_id, previous_value, applied_value, recommendation_reference,
            rollback_available, created_at, rolled_back_at, rollback_audit_reference
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, NULL, NULL
          WHERE changes() = 1`
        )
        .bind(
          receiptId,
          auditReference,
          command.id,
          command.handlerId,
          command.sectionId,
          normalizedEmail,
          PROACTIVE_SUGGESTIONS_RECORD_ID,
          String(currentValue),
          String(proposedValue),
          `command:${command.id}`,
          now
        ),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           SELECT ?1, 'ai_action', ?3, ?4, ?5
           FROM admin_ai_action_receipts
           WHERE id = ?2`
        )
        .bind(auditReference, receiptId, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 4)) {
      const body = "The setting changed before execution. No success is claimed.";
      return failure(
        command.failureMessage,
        body,
        409,
        "action-failed",
        buildApprovalReceipt({
          affectedRecords: [PROACTIVE_SUGGESTIONS_RECORD_ID],
          auditReference: null,
          command,
          currentState: `${PROACTIVE_SUGGESTIONS_KEY}: ${currentValue}`,
          executionStatus: "failure",
          outcome: body,
          proposedState: `${PROACTIVE_SUGGESTIONS_KEY}: ${proposedValue}`,
          recordsChanged: 0,
          requestedBy: normalizedEmail,
          rollbackAvailable: false,
          timestamp: now
        })
      );
    }
  } catch {
    const body = "The setting action could not be audited and persisted. No data changed.";
    return failure(
      command.failureMessage,
      body,
      503,
      "action-failed",
      buildApprovalReceipt({
        affectedRecords: [PROACTIVE_SUGGESTIONS_RECORD_ID],
        auditReference: null,
        command,
        currentState: `${PROACTIVE_SUGGESTIONS_KEY}: ${currentValue}`,
        executionStatus: "failure",
        outcome: body,
        proposedState: `${PROACTIVE_SUGGESTIONS_KEY}: ${proposedValue}`,
        recordsChanged: 0,
        requestedBy: normalizedEmail,
        rollbackAvailable: false,
        timestamp: now
      })
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        affectedRecords: [PROACTIVE_SUGGESTIONS_RECORD_ID],
        auditReference,
        command,
        currentState: `${PROACTIVE_SUGGESTIONS_KEY}: ${currentValue}`,
        executionStatus: "success",
        outcome: command.successMessage,
        proposedState: `${PROACTIVE_SUGGESTIONS_KEY}: ${proposedValue}`,
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        rollbackAvailable: true,
        timestamp: now
      }),
      body: `${PROACTIVE_SUGGESTIONS_KEY} is now ${proposedValue}.`,
      items: [
        "The server changed exactly one non-critical preference.",
        "The mutation, settings event, durable receipt, and audit row were committed atomically."
      ],
      rollbackAction: {
        label: `Restore ${PROACTIVE_SUGGESTIONS_KEY} to ${currentValue}`,
        receiptId,
        recordId: PROACTIVE_SUGGESTIONS_RECORD_ID
      },
      state: "action-complete",
      title: command.successMessage
    },
    status: 200
  };
}

export async function rollbackAdminAIRegisteredAction({
  adminEmail,
  db,
  receiptId
}: {
  adminEmail: string;
  db: D1Database;
  receiptId: string;
}): Promise<AdminAIRegisteredActionResult> {
  const receipt = await getAdminAIActionReceipt(db, receiptId);
  if (!receipt) return failure("Rollback failed", "The rollback receipt was not found.", 404);
  const normalizedEmail = normalizeEmail(adminEmail);
  if (receipt.adminEmail !== normalizedEmail) {
    return failure(
      "Rollback blocked",
      "This rollback receipt belongs to a different admin.",
      403,
      "insufficient-permission"
    );
  }
  if (!receipt.rollbackAvailable || receipt.rolledBackAt !== null) {
    return failure("Rollback unavailable", "This rollback receipt has already been used.", 409);
  }
  const command = getAdminAIServerActionCommand(receipt.actionId);
  if (
    !command ||
    !hasAdminAIExecutableActionContract(command) ||
    command.handlerId !== receipt.handlerId ||
    command.sectionId !== receipt.sectionId ||
    receipt.recommendationReference !== `command:${command.id}`
  ) {
    return failure(
      "Rollback blocked",
      "The registered action no longer matches this receipt.",
      409
    );
  }
  if (command.handlerId === "settings-proactive-suggestions-update") {
    return rollbackProactiveSuggestionsUpdate({
      command,
      db,
      normalizedEmail,
      receipt
    });
  }
  if (command.handlerId === "settings-support-defaults-update") {
    return rollbackSupportDefaultsUpdate({
      command,
      db,
      normalizedEmail,
      receipt
    });
  }

  let current: { reference_id: string; status: string } | null;
  try {
    await ensureErrorReportsSchema(db);
    current = await db
      .prepare(
        `SELECT reference_id, status
         FROM error_reports
         WHERE reference_id = ?1
         LIMIT 1`
      )
      .bind(receipt.recordId)
      .first<{ reference_id: string; status: string }>();
  } catch {
    return failure("Rollback failed", "The current record state could not be verified.", 503);
  }
  if (!current || current.status !== receipt.appliedValue) {
    return failure(
      "Rollback blocked",
      "The record changed after this action, so rollback cannot overwrite the newer state.",
      409
    );
  }

  const now = getNowSeconds();
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const auditReason = buildAuditReason({
    actionId: receipt.actionId,
    confirmation: "accepted",
    outcome: "rollback_completed",
    receiptId: receipt.id,
    recordId: receipt.recordId,
    sectionId: receipt.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `UPDATE error_reports
           SET status = ?1, updated_at = ?2
           WHERE reference_id = ?3 AND status = ?4`
        )
        .bind(receipt.previousValue, now, receipt.recordId, receipt.appliedValue),
      db
        .prepare(
          `UPDATE admin_ai_action_receipts
           SET rolled_back_at = ?1,
               rollback_audit_reference = ?2,
               rollback_available = 0
           WHERE id = ?3
             AND admin_email = ?4
             AND rolled_back_at IS NULL
             AND rollback_available = 1
             AND changes() = 1`
        )
        .bind(now, auditReference, receipt.id, normalizedEmail),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           VALUES (
             ?1,
             (SELECT 'ai_action'
              FROM admin_ai_action_receipts
              WHERE id = ?2 AND rollback_audit_reference = ?3),
             ?4,
             ?5,
             ?6
           )`
        )
        .bind(auditReference, receipt.id, auditReference, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 3)) {
      return failure(
        "Rollback blocked",
        "The rollback receipt or record changed before execution.",
        409
      );
    }
  } catch {
    return failure(
      "Rollback failed",
      "Rollback could not be audited and persisted. The applied state was preserved.",
      503
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        action: `Restore ${command.label}`,
        affectedRecords: [receipt.recordId],
        auditReference,
        command,
        currentState: `Status: ${receipt.appliedValue}`,
        executionStatus: "success",
        impact: `Restore the receipt-bound status to ${receipt.previousValue}.`,
        outcome: `Report status restored to ${receipt.previousValue}`,
        otpRequired: false,
        proposedState: `Status: ${receipt.previousValue}`,
        recommendedByAI: `Rollback option for ${command.label}`,
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        reversible: false,
        rollbackAvailable: false,
        timestamp: now
      }),
      body: `Error report ${receipt.recordId} is now ${receipt.previousValue}.`,
      items: [
        "The rollback used only its durable server receipt.",
        "The receipt cannot be replayed."
      ],
      state: "action-complete",
      title: `Report status restored to ${receipt.previousValue}`
    },
    status: 200
  };
}

async function rollbackSupportDefaultsUpdate({
  command,
  db,
  normalizedEmail,
  receipt
}: {
  command: AdminAIServerActionCommand;
  db: D1Database;
  normalizedEmail: string;
  receipt: AdminAIActionReceipt;
}): Promise<AdminAIRegisteredActionResult> {
  const previous = parseSupportDefaultsSnapshot(receipt.previousValue);
  const applied = parseSupportDefaultsSnapshot(receipt.appliedValue);
  if (
    receipt.recordId !== SUPPORT_DEFAULTS_RECORD_ID ||
    !previous ||
    !applied ||
    serializeSupportDefaults(previous) === serializeSupportDefaults(applied)
  ) {
    return failure("Rollback blocked", "The support-default receipt binding is invalid.", 409);
  }

  let current: AdminSupportDefaults;
  try {
    current = await getAdminSupportDefaults({ ADMIN_DB: db });
  } catch {
    return failure("Rollback failed", "The current support defaults could not be verified.", 503);
  }
  if (serializeSupportDefaults(supportDefaultsSnapshot(current)) !== receipt.appliedValue) {
    return failure(
      "Rollback blocked",
      "The support defaults changed after this action, so rollback cannot overwrite the newer state.",
      409
    );
  }

  const now = getNowSeconds();
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const auditReason = buildAuditReason({
    actionId: receipt.actionId,
    confirmation: "accepted",
    outcome: "rollback_completed",
    receiptId: receipt.id,
    recordId: receipt.recordId,
    sectionId: receipt.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `UPDATE admin_ai_action_receipts
           SET rolled_back_at = ?1,
               rollback_audit_reference = ?2,
               rollback_available = 0
           WHERE id = ?3
             AND admin_email = ?4
             AND handler_id = ?5
             AND record_id = ?6
             AND applied_value = ?7
             AND rolled_back_at IS NULL
             AND rollback_available = 1`
        )
        .bind(
          now,
          auditReference,
          receipt.id,
          normalizedEmail,
          command.handlerId,
          SUPPORT_DEFAULTS_RECORD_ID,
          receipt.appliedValue
        ),
      db
        .prepare(
          `UPDATE admin_support_defaults
           SET support_name = CASE
                 WHEN support_name = ?8
                  AND support_email = ?9
                  AND support_phone = ?10
                  AND support_whatsapp = ?11
                  AND support_message = ?12
                  AND changes() = 1
                  AND EXISTS (
                    SELECT 1
                    FROM admin_ai_action_receipts
                    WHERE id = ?13
                      AND rollback_audit_reference = ?14
                      AND rollback_available = 0
                  )
                 THEN ?1
                 ELSE NULL
               END,
               support_email = ?2,
               support_phone = ?3,
               support_whatsapp = ?4,
               support_message = ?5,
               updated_at = ?6,
               updated_by = ?7
           WHERE id = 'default'`
        )
        .bind(
          previous.supportName,
          previous.supportEmail,
          previous.supportPhone,
          previous.supportWhatsapp,
          previous.supportMessage,
          now,
          normalizedEmail,
          applied.supportName,
          applied.supportEmail,
          applied.supportPhone,
          applied.supportWhatsapp,
          applied.supportMessage,
          receipt.id,
          auditReference
        ),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           VALUES (
             ?1,
             CASE WHEN changes() = 1 THEN 'ai_action' ELSE NULL END,
             ?2,
             ?3,
             ?4
           )`
        )
        .bind(auditReference, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 3)) {
      return failure(
        "Rollback blocked",
        "The support defaults or rollback receipt changed before execution.",
        409
      );
    }
  } catch {
    return failure(
      "Rollback failed",
      "Rollback could not be audited and persisted. The applied support defaults were preserved.",
      503
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        action: `Restore ${command.label}`,
        affectedRecords: [SUPPORT_DEFAULTS_RECORD_ID],
        auditReference,
        command,
        currentState: "Applied validated support-default snapshot",
        executionStatus: "success",
        impact: "Restore the exact receipt-bound support-default snapshot.",
        outcome: "Support defaults restored",
        otpRequired: false,
        proposedState: "Previous validated support-default snapshot",
        recommendedByAI: `Rollback option for ${command.label}`,
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        reversible: false,
        rollbackAvailable: false,
        timestamp: now
      }),
      body: "The previous validated support-default snapshot is now active.",
      items: [
        "The rollback used only its durable server receipt.",
        "The receipt cannot be replayed."
      ],
      state: "action-complete",
      title: "Support defaults restored"
    },
    status: 200
  };
}

async function rollbackProactiveSuggestionsUpdate({
  command,
  db,
  normalizedEmail,
  receipt
}: {
  command: AdminAIServerActionCommand;
  db: D1Database;
  normalizedEmail: string;
  receipt: AdminAIActionReceipt;
}): Promise<AdminAIRegisteredActionResult> {
  if (receipt.recordId !== PROACTIVE_SUGGESTIONS_RECORD_ID) {
    return failure("Rollback blocked", "The settings receipt record binding is invalid.", 409);
  }
  const previousValue = receipt.previousValue === "true";
  const appliedValue = receipt.appliedValue === "true";
  let currentJson: string;
  let nextJson: string;
  try {
    const center = await getAdminAISettingsCenter({
      actor: { email: normalizedEmail, isOwner: false },
      db
    });
    const row = await db
      .prepare(
        `SELECT preferences_json FROM admin_ai_admin_settings WHERE admin_email = ?1 LIMIT 1`
      )
      .bind(normalizedEmail)
      .first<SettingsRow>();
    if (!row || center.preferences.proactiveSuggestionsEnabled !== appliedValue) {
      return failure(
        "Rollback blocked",
        "The setting changed after this action, so rollback cannot overwrite the newer state.",
        409
      );
    }
    currentJson = row.preferences_json;
    nextJson = JSON.stringify({
      ...center.preferences,
      proactiveSuggestionsEnabled: previousValue
    });
  } catch {
    return failure("Rollback failed", "The current setting state could not be verified.", 503);
  }

  const now = getNowSeconds();
  const auditReference = `admin-ai-${crypto.randomUUID()}`;
  const auditReason = buildAuditReason({
    actionId: receipt.actionId,
    appliedValue: String(previousValue),
    confirmation: "accepted",
    outcome: "rollback_completed",
    previousValue: String(appliedValue),
    receiptId: receipt.id,
    recordId: receipt.recordId,
    sectionId: receipt.sectionId
  });

  try {
    const results = await db.batch([
      db
        .prepare(
          `UPDATE admin_ai_admin_settings
           SET preferences_json = ?1, updated_at = ?2, updated_by = ?3
           WHERE admin_email = ?3 AND preferences_json = ?4`
        )
        .bind(nextJson, now, normalizedEmail, currentJson),
      db
        .prepare(
          `INSERT INTO admin_ai_settings_events (
             id, scope, event_type, actor_email, version, occurred_at
           )
           SELECT ?1, 'admin', 'preferences-updated', ?2, ?3, ?3
           WHERE changes() = 1`
        )
        .bind(`admin-ai-settings-event-${crypto.randomUUID()}`, normalizedEmail, now),
      db
        .prepare(
          `UPDATE admin_ai_action_receipts
           SET rolled_back_at = ?1,
               rollback_audit_reference = ?2,
               rollback_available = 0
           WHERE id = ?3
             AND admin_email = ?4
             AND rolled_back_at IS NULL
             AND rollback_available = 1
             AND changes() = 1`
        )
        .bind(now, auditReference, receipt.id, normalizedEmail),
      db
        .prepare(
          `INSERT INTO admin_audit_events (id, event_type, email, reason, created_at)
           VALUES (
             ?1,
             (SELECT 'ai_action'
              FROM admin_ai_action_receipts
              WHERE id = ?2 AND rollback_audit_reference = ?3),
             ?4,
             ?5,
             ?6
           )`
        )
        .bind(auditReference, receipt.id, auditReference, normalizedEmail, auditReason, now)
    ]);
    if (!hasOneChangePerStatement(results, 4)) {
      return failure(
        "Rollback blocked",
        "The rollback receipt or setting changed before execution.",
        409
      );
    }
  } catch {
    return failure(
      "Rollback failed",
      "Rollback could not be audited and persisted. The applied setting was preserved.",
      503
    );
  }

  return {
    ok: true,
    response: {
      approvalReceipt: buildApprovalReceipt({
        action: `Restore ${command.label}`,
        affectedRecords: [receipt.recordId],
        auditReference,
        command,
        currentState: `${PROACTIVE_SUGGESTIONS_KEY}: ${appliedValue}`,
        executionStatus: "success",
        impact: `Restore the receipt-bound preference to ${previousValue}.`,
        outcome: `${PROACTIVE_SUGGESTIONS_KEY} restored to ${previousValue}`,
        otpRequired: false,
        proposedState: `${PROACTIVE_SUGGESTIONS_KEY}: ${previousValue}`,
        recommendedByAI: `Rollback option for ${command.label}`,
        recordsChanged: 1,
        requestedBy: normalizedEmail,
        reversible: false,
        rollbackAvailable: false,
        timestamp: now
      }),
      body: `${PROACTIVE_SUGGESTIONS_KEY} is now ${previousValue}.`,
      items: [
        "The rollback used only its durable server receipt.",
        "The receipt cannot be replayed."
      ],
      state: "action-complete",
      title: `${PROACTIVE_SUGGESTIONS_KEY} restored to ${previousValue}`
    },
    status: 200
  };
}

export async function getAdminAIActionReceipt(
  db: D1Database,
  receiptId: string
): Promise<AdminAIActionReceipt | null> {
  const cleanReceiptId = parseIdentifier(receiptId, 120);
  if (!cleanReceiptId) return null;
  try {
    await ensureAdminAIActionReceiptSchema(db);
    const row = await db
      .prepare(
        `SELECT id, audit_reference, action_id, handler_id, section_id, admin_email,
                record_id, previous_value, applied_value, recommendation_reference,
                rollback_available,
                created_at, rolled_back_at, rollback_audit_reference
         FROM admin_ai_action_receipts
         WHERE id = ?1 AND created_at > ?2
         LIMIT 1`
      )
      .bind(cleanReceiptId, getAdminAIRetentionCutoffSeconds())
      .first<AdminAIActionReceiptRow>();
    return mapReceipt(row);
  } catch {
    return null;
  }
}

export async function ensureAdminAIActionReceiptSchema(db: D1Database) {
  await runCachedD1SchemaSetup({
    cache: receiptSchemaCache,
    db,
    setup: async () => {
      for (const statement of ACTION_RECEIPT_SCHEMA) await db.prepare(statement).run();
    }
  });
}

export function hasAdminAIExecutableActionContract(
  command: AdminAICommand | AdminAIServerActionCommand
): command is AdminAIServerActionCommand & {
  failureMessage: string;
  successMessage: string;
} {
  const handlerId = command.handlerId;
  const registeredContract = getAdminAIServerActionContract(handlerId);
  if (!registeredContract) return false;
  return (
    command.kind === "registered-action" &&
    command.type === "write" &&
    command.auditLogEnabled &&
    command.confirmationRequired === true &&
    registeredContract.actionId === command.id &&
    registeredContract.handlerId === handlerId &&
    registeredContract.sectionId === command.sectionId &&
    registeredContract.successMessage === command.successMessage &&
    registeredContract.failureMessage === command.failureMessage &&
    sameStringRecord(registeredContract.inputSchema, command.inputSchema) &&
    sameStrings(registeredContract.requiredPermissions, command.requiredPermissions || []) &&
    sameExecutionContract(registeredContract.executionContract, command.executionContract)
  );
}

function getAdminAIServerActionContract(
  handlerId: string | undefined
): AdminAIServerActionContract | null {
  if (handlerId === "shop-paid-order-publish-retry") {
    return SHOP_PAID_ORDER_PUBLISH_RETRY_CONTRACT;
  }
  if (handlerId === "settings-support-defaults-update") {
    return SETTINGS_SUPPORT_DEFAULTS_UPDATE_CONTRACT;
  }
  if (
    handlerId === "error-report-status-reviewing" ||
    handlerId === "settings-proactive-suggestions-update"
  ) {
    return ADMIN_AI_REGISTERED_ACTION_CONTRACTS[handlerId];
  }
  return null;
}

function sameExecutionContract(
  expected: AdminAICommand["executionContract"],
  actual: AdminAICommand["executionContract"] | undefined
) {
  if (!actual) return false;
  return (
    expected.availability === actual.availability &&
    expected.blockedReason === actual.blockedReason &&
    expected.currentStateLabel === actual.currentStateLabel &&
    sameStrings(expected.dependencies, actual.dependencies) &&
    expected.issueClassification === actual.issueClassification &&
    expected.maxBatchSize === actual.maxBatchSize &&
    expected.maxSelectedRecords === actual.maxSelectedRecords &&
    expected.minSelectedRecords === actual.minSelectedRecords &&
    expected.proposedStateLabel === actual.proposedStateLabel
  );
}

function sameStrings(expected: string[], actual: string[]) {
  return (
    expected.length === actual.length && expected.every((value, index) => value === actual[index])
  );
}

function sameStringRecord(expected: Record<string, string>, actual: Record<string, string>) {
  const expectedEntries = Object.entries(expected);
  const actualEntries = Object.entries(actual);
  return (
    expectedEntries.length === actualEntries.length &&
    expectedEntries.every(([key, value]) => actual[key] === value)
  );
}

async function getIncidentFreezeFailure(
  command: AdminAICommand | AdminAIServerActionCommand,
  db: D1Database
): Promise<AdminAIRegisteredActionResult | null> {
  if (!isAdminAICommandFrozen(command as AdminAICommand)) return null;
  try {
    if (!(await hasActiveAdminAIIncidentFreeze(db))) return null;
  } catch {
    return failure(
      command.failureMessage || "Registered action failed",
      "Durable incident freeze state could not be verified. No data changed.",
      503
    );
  }
  return failure(
    "Action frozen by active incident",
    "An active high-priority incident freezes optional Admin AI write and dangerous actions. No data changed.",
    423
  );
}

function mapReceipt(row: AdminAIActionReceiptRow | null): AdminAIActionReceipt | null {
  if (!row || !row.recommendation_reference || !hasAdminAIRegisteredActionHandler(row.handler_id)) {
    return null;
  }
  const previousValue = row.previous_value;
  const appliedValue = row.applied_value;
  const validValues =
    row.handler_id === "error-report-status-reviewing"
      ? Boolean(parseErrorReportStatus(previousValue) && parseErrorReportStatus(appliedValue))
      : row.handler_id === "settings-proactive-suggestions-update"
        ? row.record_id === PROACTIVE_SUGGESTIONS_RECORD_ID &&
          [previousValue, appliedValue].every((value) => value === "true" || value === "false") &&
          previousValue !== appliedValue
        : row.handler_id === "settings-support-defaults-update"
          ? row.record_id === SUPPORT_DEFAULTS_RECORD_ID &&
            Boolean(parseSupportDefaultsSnapshot(previousValue)) &&
            Boolean(parseSupportDefaultsSnapshot(appliedValue)) &&
            previousValue !== appliedValue
          : row.handler_id === "shop-paid-order-publish-retry" &&
            /^(paid|publishing)\/publish_failed$/.test(previousValue) &&
            ["publish_failed", "published", "retry_requested"].includes(appliedValue);
  if (!validValues) return null;
  return {
    actionId: row.action_id,
    adminEmail: normalizeEmail(row.admin_email),
    appliedValue,
    auditReference: row.audit_reference,
    createdAt: Number(row.created_at),
    handlerId: row.handler_id,
    id: row.id,
    previousValue,
    recommendationReference: row.recommendation_reference,
    recordId: row.record_id,
    rollbackAuditReference: row.rollback_audit_reference || null,
    rollbackAvailable: Number(row.rollback_available) === 1,
    rolledBackAt: row.rolled_back_at === null ? null : Number(row.rolled_back_at),
    sectionId: row.section_id
  };
}

function hasOneChangePerStatement(results: D1Result<unknown>[], expectedCount: number) {
  return (
    results.length === expectedCount &&
    results.every((result) => result.success && Number(result.meta.changes) === 1)
  );
}

function buildApprovalReceipt({
  action,
  affectedRecords,
  auditReference,
  command,
  currentState,
  executionStatus,
  impact,
  outcome,
  otpRequired,
  proposedState,
  recommendedByAI,
  recordsChanged,
  requestedBy,
  reversible = command.rollback === "available-after-persist",
  rollbackAvailable,
  timestamp
}: {
  action?: string;
  affectedRecords: string[];
  auditReference: string | null;
  command: AdminAICommand | AdminAIServerActionCommand;
  currentState: string;
  executionStatus: CompleteAdminAIApprovalReceipt["executionStatus"];
  impact?: string;
  outcome: string;
  otpRequired?: boolean;
  proposedState: string;
  recommendedByAI?: string;
  recordsChanged: number;
  requestedBy: string;
  reversible?: boolean;
  rollbackAvailable: boolean;
  timestamp: number;
}): CompleteAdminAIApprovalReceipt {
  return {
    action: action || command.label,
    affectedRecords,
    approvalLevel: command.approvalLevel,
    auditReference,
    confirmationTimestamp: new Date(timestamp * 1000).toISOString(),
    currentState,
    executionStatus,
    impact: impact || command.description,
    impactLabel: "Impact",
    outcome,
    otpRequired: otpRequired ?? Boolean(command.otpRequired),
    permissionCheck: command.requiredPermissions?.join(", ") || "Authenticated admin",
    proposedState,
    recommendedByAI: recommendedByAI || command.label,
    recordsChanged,
    requestedBy,
    reversible,
    rollbackAvailable: reversible && rollbackAvailable
  };
}

function failure(
  title: string,
  body: string,
  status: number,
  state: AdminAIResponse["state"] = "action-failed",
  approvalReceipt?: CompleteAdminAIApprovalReceipt
): AdminAIRegisteredActionResult {
  return {
    ok: false,
    response: { approvalReceipt, body, items: [], state, title },
    status
  };
}

function buildAuditReason(input: {
  actionId: string;
  appliedValue?: string;
  confirmation: string;
  outcome: string;
  previousValue?: string;
  receiptId: string;
  recordId: string;
  sectionId: string;
}) {
  return [
    `action:${input.actionId}`,
    `section:${input.sectionId}`,
    `record:${input.recordId}`,
    ...(input.previousValue === undefined ? [] : [`previous:${input.previousValue}`]),
    ...(input.appliedValue === undefined ? [] : [`applied:${input.appliedValue}`]),
    `confirmation:${input.confirmation}`,
    `outcome:${input.outcome}`,
    `receipt:${input.receiptId}`
  ]
    .map((value) => value.replace(/[^a-zA-Z0-9:./@_-]/g, "_").slice(0, 160))
    .join("|")
    .slice(0, 480);
}

function parseIdentifier(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized.slice(0, maxLength) : "";
}

function parseErrorReportStatus(value: unknown): ErrorReportStatus | null {
  return typeof value === "string" && ERROR_REPORT_STATUSES.has(value as ErrorReportStatus)
    ? (value as ErrorReportStatus)
    : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}
