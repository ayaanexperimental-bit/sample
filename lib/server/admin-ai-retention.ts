import type { D1Database } from "@cloudflare/workers-types";
import { ensureAdminAIActionReceiptSchema } from "./admin-ai-actions";
import { ensureAdminAIArtifactSchema } from "./admin-ai-artifacts";
import {
  ADMIN_AI_CONTINUITY_PURGE_STATEMENTS,
  ensureAdminAIContinuitySchema
} from "./admin-ai-continuity";
import { ensureAdminAIIncidentSchema } from "./admin-ai-incidents";
import { ensureAdminAIObservabilitySchema } from "./admin-ai-observability";
import { ensureAdminAIScheduleSchema } from "./admin-ai-schedules";
import { ensureAdminAISettingsSchema } from "./admin-ai-settings";
import { getAdminAIRetentionCutoffSeconds } from "./admin-ai-retention-policy";

export {
  ADMIN_AI_RETENTION_DAYS,
  ADMIN_AI_RETENTION_SECONDS,
  getAdminAIRetentionCutoffSeconds,
  isAdminAIRetainedAt
} from "./admin-ai-retention-policy";

const ADMIN_AI_NON_CONTINUITY_PURGE_STATEMENTS = [
  `DELETE FROM admin_ai_artifact_events WHERE rowid IN (
    SELECT rowid FROM admin_ai_artifact_events WHERE occurred_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_artifacts WHERE rowid IN (
    SELECT rowid FROM admin_ai_artifacts WHERE updated_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_evaluation_inputs WHERE rowid IN (
    SELECT evaluation.rowid
    FROM admin_ai_evaluation_inputs AS evaluation
    LEFT JOIN admin_ai_corrections AS correction
      ON correction.id = evaluation.correction_id
    WHERE COALESCE(correction.created_at, evaluation.created_at) <= ?1
    LIMIT ?2
  )`,
  `DELETE FROM admin_ai_improvement_records WHERE rowid IN (
    SELECT improvement.rowid
    FROM admin_ai_improvement_records AS improvement
    LEFT JOIN admin_ai_corrections AS correction
      ON correction.id = improvement.correction_id
    WHERE COALESCE(correction.created_at, improvement.approved_at) <= ?1
      AND (correction.id IS NULL OR correction.review_status != 'approved')
    LIMIT ?2
  )`,
  `DELETE FROM admin_ai_corrections WHERE rowid IN (
    SELECT rowid FROM admin_ai_corrections
    WHERE created_at <= ?1 AND review_status != 'approved'
    LIMIT ?2
  )`,
  `DELETE FROM admin_ai_observations WHERE rowid IN (
    SELECT rowid FROM admin_ai_observations WHERE created_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_action_receipts WHERE rowid IN (
    SELECT rowid FROM admin_ai_action_receipts WHERE created_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_settings_events WHERE rowid IN (
    SELECT rowid FROM admin_ai_settings_events WHERE occurred_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_schedule_events WHERE rowid IN (
    SELECT rowid FROM admin_ai_schedule_events WHERE occurred_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_incident_events WHERE rowid IN (
    SELECT rowid FROM admin_ai_incident_events WHERE occurred_at <= ?1 LIMIT ?2
  )`,
  `DELETE FROM admin_ai_incidents WHERE rowid IN (
    SELECT rowid FROM admin_ai_incidents
    WHERE status = 'resolved' AND updated_at <= ?1
    LIMIT ?2
  )`,
  `DELETE FROM admin_audit_events WHERE rowid IN (
    SELECT rowid FROM admin_audit_events
    WHERE event_type = 'ai_action' AND created_at <= ?1
    LIMIT ?2
  )`
] as const;

export const ADMIN_AI_RETENTION_PURGE_STATEMENTS = [
  ...ADMIN_AI_CONTINUITY_PURGE_STATEMENTS,
  ...ADMIN_AI_NON_CONTINUITY_PURGE_STATEMENTS
] as const;

export async function purgeExpiredAdminAIRecords({
  batchSize = 250,
  db,
  nowSeconds = currentSeconds()
}: {
  batchSize?: number;
  db: D1Database;
  nowSeconds?: number;
}) {
  await ensureAdminAIContinuitySchema(db);
  await ensureAdminAIArtifactSchema(db);
  await ensureAdminAIObservabilitySchema(db);
  await ensureAdminAIActionReceiptSchema(db);
  await ensureAdminAISettingsSchema(db);
  await ensureAdminAIScheduleSchema(db);
  await ensureAdminAIIncidentSchema(db);
  const limit = Math.max(1, Math.min(1_000, Math.floor(batchSize)));
  const cutoff = getAdminAIRetentionCutoffSeconds(nowSeconds);
  const results = await db.batch(
    ADMIN_AI_RETENTION_PURGE_STATEMENTS.map((sql) => db.prepare(sql).bind(cutoff, limit))
  );
  return results.reduce((total, result) => total + Number(result.meta?.changes || 0), 0);
}

function currentSeconds() {
  return Math.floor(Date.now() / 1000);
}
