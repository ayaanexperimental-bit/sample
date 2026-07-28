import { expect, test } from "@playwright/test";
import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import {
  ADMIN_AI_RETENTION_DAYS,
  ADMIN_AI_RETENTION_PURGE_STATEMENTS,
  getAdminAIRetentionCutoffSeconds,
  isAdminAIRetainedAt,
  purgeExpiredAdminAIRecords
} from "../../lib/server/admin-ai-retention";
import { normalizeAdminAIObservabilityRange } from "../../lib/server/admin-ai-observability";

test("locks the shared Admin AI retention boundary to exactly 90 days", () => {
  const day = 24 * 60 * 60;
  const now = 200 * day;

  expect(ADMIN_AI_RETENTION_DAYS).toBe(90);
  expect(getAdminAIRetentionCutoffSeconds(now)).toBe(110 * day);
  expect(isAdminAIRetainedAt(110 * day + 1, now)).toBe(true);
  expect(isAdminAIRetainedAt(110 * day, now)).toBe(false);
});

test("observability ranges cannot expose data at or before the day-90 boundary", () => {
  const now = Date.UTC(2026, 6, 28, 12, 0, 0);
  const cutoff = now - 90 * 24 * 60 * 60 * 1_000;
  const normalized = normalizeAdminAIObservabilityRange(
    {
      from: new Date(cutoff - 30 * 24 * 60 * 60 * 1_000).toISOString(),
      to: new Date(now).toISOString()
    },
    now
  );

  expect(Date.parse(normalized.from)).toBe(cutoff + 1_000);
  expect(Date.parse(normalized.to)).toBe(now);
});

test("purge plan covers AI-owned retention data without deleting durable business configuration", () => {
  const sql = ADMIN_AI_RETENTION_PURGE_STATEMENTS.join("\n");

  for (const table of [
    "admin_ai_artifact_events",
    "admin_ai_artifacts",
    "admin_ai_observations",
    "admin_ai_evaluation_inputs",
    "admin_ai_improvement_records",
    "admin_ai_corrections",
    "admin_ai_action_receipts",
    "admin_ai_settings_events",
    "admin_ai_schedule_events",
    "admin_ai_incident_events",
    "admin_ai_incidents"
  ]) {
    expect(sql).toContain(`DELETE FROM ${table}`);
  }

  expect(sql).not.toContain("DELETE FROM admin_ai_artifact_reports");
  expect(sql).not.toContain("DELETE FROM admin_ai_admin_settings");
  expect(sql).not.toContain("DELETE FROM admin_ai_owner_settings");
  expect(sql).not.toContain("DELETE FROM admin_ai_schedules");
  expect(sql).toContain("DELETE FROM admin_audit_events");
  expect(sql).toContain("event_type = 'ai_action'");
  expect(sql).toContain("status = 'resolved'");
});

test("bounded purge binds the fixed cutoff and leaves shared audit scope explicit", async () => {
  const db = new RecordingD1();
  const nowSeconds = 20_000_000;
  const deleted = await purgeExpiredAdminAIRecords({
    batchSize: 2_000,
    db: db as unknown as D1Database,
    nowSeconds
  });

  const deletes = db.executed.filter((statement) => statement.sql.startsWith("DELETE FROM"));
  expect(deleted).toBe(deletes.length);
  expect(deletes).toHaveLength(ADMIN_AI_RETENTION_PURGE_STATEMENTS.length);
  expect(deletes.every((statement) => statement.params.at(-1) === 1_000)).toBe(true);
  expect(
    deletes.every(
      (statement) => statement.params[0] === getAdminAIRetentionCutoffSeconds(nowSeconds)
    )
  ).toBe(true);
  expect(
    deletes.find((statement) => statement.sql.startsWith("DELETE FROM admin_audit_events"))?.sql
  ).toContain("event_type = 'ai_action'");
});

class RecordingD1 {
  readonly executed: Array<{ params: unknown[]; sql: string }> = [];

  prepare(sql: string) {
    return new RecordingStatement(this, sql) as unknown as D1PreparedStatement;
  }

  async batch(statements: D1PreparedStatement[]) {
    return Promise.all(
      statements.map((statement) =>
        (statement as unknown as RecordingStatement).run() as Promise<D1Result<unknown>>
      )
    );
  }
}

class RecordingStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: RecordingD1,
    readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async all<T>() {
    return { results: [] as T[], success: true };
  }

  async first<T>() {
    return null as T | null;
  }

  async run<T>() {
    const normalized = this.sql.replace(/\s+/g, " ").trim();
    this.db.executed.push({ params: [...this.params], sql: normalized });
    const changes = normalized.startsWith("DELETE FROM") ? 1 : 0;
    return { meta: { changes }, results: [] as T[], success: true };
  }
}
