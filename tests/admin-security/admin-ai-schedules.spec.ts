import { expect, test } from "@playwright/test";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { onRequest as handleAdminAISchedules } from "../../functions/api/admin/ai-schedules";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import {
  calculateAdminAIJobRetryAt,
  calculateNextAdminAIScheduleRun,
  getAdminAISchedules,
  mutateAdminAISchedule,
  type AdminAIScheduleCapabilities
} from "../../lib/server/admin-ai-schedules";

const OWNER_EMAIL = "schedule-owner@example.com";
const ADMIN_EMAIL = "schedule-admin@example.com";
const capabilities: AdminAIScheduleCapabilities = {
  approvedEmailWorkflow: true,
  secureScheduledJobs: true
};
const authBase = {
  ADMIN_ALLOWED_EMAILS: `${OWNER_EMAIL},${ADMIN_EMAIL}`,
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_REQUIRE_DB_ADMIN_ROLES: "true",
  ADMIN_SESSION_SECRET: "admin-ai-schedule-lifecycle-secret",
  ROOT_OWNER_EMAIL: OWNER_EMAIL
};

test.describe("Admin AI schedule lifecycle", () => {
  test("calculates deterministic daily, weekly, and monthly next runs in the configured timezone", () => {
    expect(
      calculateNextAdminAIScheduleRun(
        { frequency: "daily", localTime: "09:00", timeZone: "Asia/Kolkata" },
        "2026-07-21T02:00:00.000Z"
      )
    ).toBe("2026-07-21T03:30:00.000Z");
    expect(
      calculateNextAdminAIScheduleRun(
        {
          frequency: "weekly",
          localTime: "08:15",
          timeZone: "UTC",
          weekday: "monday"
        },
        "2026-07-21T02:00:00.000Z"
      )
    ).toBe("2026-07-27T08:15:00.000Z");
    expect(
      calculateNextAdminAIScheduleRun(
        {
          dayOfMonth: 1,
          frequency: "monthly",
          localTime: "00:05",
          timeZone: "UTC"
        },
        "2026-07-21T02:00:00.000Z"
      )
    ).toBe("2026-08-01T00:05:00.000Z");
  });

  test("creates, updates, and disables an owner schedule with durable versions and audit events", async () => {
    const db = createDb();
    const created = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input: {
        cadence: { frequency: "daily", localTime: "09:00", timeZone: "Asia/Kolkata" },
        delivery: { channel: "in-app" },
        enabled: true,
        operation: "create",
        reportType: "Daily Briefing"
      }
    });
    expect(created).toMatchObject({
      ok: true,
      schedule: {
        delivery: { channel: "in-app", status: "not-attempted" },
        enabled: true,
        nextRunAt: expect.any(String),
        reportType: "Daily Briefing",
        version: 1
      },
      status: 201
    });
    if (!created.ok) throw new Error("Expected schedule creation to succeed.");

    const updated = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input: {
        expectedVersion: 1,
        operation: "update",
        patch: {
          cadence: { frequency: "daily", localTime: "10:30", timeZone: "Asia/Kolkata" }
        },
        scheduleId: created.schedule.id
      }
    });
    expect(updated).toMatchObject({
      ok: true,
      schedule: {
        cadence: { localTime: "10:30" },
        enabled: true,
        version: 2
      },
      status: 200
    });

    const disabled = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input: {
        expectedVersion: 2,
        operation: "disable",
        scheduleId: created.schedule.id
      }
    });
    expect(disabled).toMatchObject({
      ok: true,
      schedule: { enabled: false, nextRunAt: null, version: 3 },
      status: 200
    });
    expect(db.eventTypes()).toEqual(["schedule-created", "schedule-updated", "schedule-disabled"]);

    const listed = await getAdminAISchedules({ actor: ownerActor(), db: db.asD1() });
    expect(listed).toMatchObject({
      ok: true,
      schedules: [{ id: created.schedule.id, enabled: false, version: 3 }]
    });
  });

  test("persists delivered and failed statuses and fail-closes a delivery when capability disappears", async () => {
    const db = createDb();
    const first = await createEnabledSchedule(db, "Weekly Admin Operations Report", {
      channel: "email",
      recipientEmails: ["ops@example.com"]
    });
    const delivered = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input: {
        detail: "Accepted by approved email workflow.",
        expectedVersion: 1,
        operation: "record-delivery",
        scheduleId: first.id,
        status: "delivered"
      }
    });
    expect(delivered).toMatchObject({
      ok: true,
      schedule: {
        delivery: {
          attemptedAt: expect.any(String),
          deliveredAt: expect.any(String),
          status: "delivered"
        },
        enabled: true,
        nextRunAt: expect.any(String),
        version: 2
      }
    });

    const second = await createEnabledSchedule(db, "Error and Reliability Report", {
      channel: "in-app"
    });
    const failed = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input: {
        detail: "Report generation timed out.",
        expectedVersion: 1,
        operation: "record-delivery",
        scheduleId: second.id,
        status: "failed"
      }
    });
    expect(failed).toMatchObject({
      ok: true,
      schedule: { delivery: { status: "failed" }, enabled: true, version: 2 }
    });

    const blocked = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities: { ...capabilities, secureScheduledJobs: false },
      db: db.asD1(),
      input: {
        expectedVersion: 2,
        operation: "record-delivery",
        scheduleId: second.id,
        status: "delivered"
      }
    });
    expect(blocked).toMatchObject({
      ok: true,
      schedule: {
        delivery: { detail: expect.stringContaining("Secure scheduled jobs"), status: "blocked" },
        enabled: false,
        nextRunAt: null,
        version: 3
      }
    });
    expect(db.eventTypes()).toContain("delivery-blocked");
  });

  test("rejects non-owners, enabled schedules without secure jobs, stale writes, and non-durable writes", async () => {
    const db = createDb();
    const input = {
      cadence: { frequency: "daily", localTime: "09:00", timeZone: "UTC" },
      delivery: { channel: "in-app" },
      enabled: true,
      operation: "create",
      reportType: "Daily Briefing"
    };
    expect(
      await mutateAdminAISchedule({
        actor: { email: ADMIN_EMAIL, isOwner: false },
        capabilities,
        db: db.asD1(),
        input
      })
    ).toMatchObject({ code: "forbidden", ok: false, status: 403 });
    expect(
      await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities: { ...capabilities, secureScheduledJobs: false },
        db: db.asD1(),
        input
      })
    ).toMatchObject({ code: "unavailable", ok: false, status: 503 });
    expect(
      await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities: { ...capabilities, approvedEmailWorkflow: false },
        db: db.asD1(),
        input: {
          ...input,
          delivery: { channel: "email", recipientEmails: ["ops@example.com"] }
        }
      })
    ).toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("approved email workflow"),
      ok: false,
      status: 503
    });
    expect(db.scheduleRows()).toHaveLength(0);

    const created = await mutateAdminAISchedule({
      actor: ownerActor(),
      capabilities,
      db: db.asD1(),
      input
    });
    if (!created.ok) throw new Error("Expected schedule creation to succeed.");
    expect(
      await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          expectedVersion: 99,
          operation: "disable",
          scheduleId: created.schedule.id
        }
      })
    ).toMatchObject({ code: "conflict", ok: false, status: 409 });

    db.failNextBatch();
    expect(
      await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          expectedVersion: 1,
          operation: "disable",
          scheduleId: created.schedule.id
        }
      })
    ).toMatchObject({ code: "unavailable", ok: false, status: 503 });
    expect(db.scheduleRows()[0]).toMatchObject({ version: 1, enabled: 1 });
  });

  test("persists run IDs, checkpoints, resume state, and bounded retry backoff", async () => {
    const db = createDb();
    const originalNow = Date.now;
    let now = Date.parse("2026-07-21T12:00:00.000Z");
    Date.now = () => now;
    try {
      const schedule = await createEnabledSchedule(db, "Weekly Admin Operations Report", {
        channel: "in-app"
      });
      const started = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          expectedVersion: 1,
          maxAttempts: 3,
          operation: "start-run",
          scheduleId: schedule.id
        }
      });
      if (!started.ok) throw new Error(started.message);
      const runId = started.schedule.runs[0].id;
      expect(started.schedule).toMatchObject({
        runs: [{ attempt: 1, checkpoint: null, id: runId, maxAttempts: 3, status: "running" }],
        version: 2
      });

      const paused = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          checkpoint: "records:25",
          expectedVersion: 2,
          operation: "checkpoint-run",
          pause: true,
          runId,
          scheduleId: schedule.id
        }
      });
      expect(paused).toMatchObject({
        ok: true,
        schedule: { runs: [{ checkpoint: "records:25", status: "paused" }], version: 3 }
      });

      const resumed = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: { expectedVersion: 3, operation: "resume-run", runId, scheduleId: schedule.id }
      });
      expect(resumed).toMatchObject({
        ok: true,
        schedule: {
          runs: [{ attempt: 1, checkpoint: "records:25", status: "running" }],
          version: 4
        }
      });

      const retry = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          errorCode: "provider_timeout",
          expectedVersion: 4,
          operation: "record-run-result",
          result: "retryable-failure",
          runId,
          scheduleId: schedule.id
        }
      });
      if (!retry.ok) throw new Error(retry.message);
      const retryAt = calculateAdminAIJobRetryAt(1, now);
      if (!retryAt) throw new Error("Expected bounded retry time.");
      expect(retry.schedule).toMatchObject({
        runs: [{ errorCode: "provider_timeout", nextAttemptAt: retryAt, status: "retry-wait" }],
        version: 5
      });
      expect(
        await mutateAdminAISchedule({
          actor: ownerActor(),
          capabilities,
          db: db.asD1(),
          input: { expectedVersion: 5, operation: "resume-run", runId, scheduleId: schedule.id }
        })
      ).toMatchObject({ code: "conflict", ok: false, status: 409 });

      now = Date.parse(retryAt) + 1_000;
      const retried = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: { expectedVersion: 5, operation: "resume-run", runId, scheduleId: schedule.id }
      });
      expect(retried).toMatchObject({
        ok: true,
        schedule: {
          runs: [{ attempt: 2, checkpoint: "records:25", status: "running" }],
          version: 6
        }
      });

      const completed = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          expectedVersion: 6,
          operation: "record-run-result",
          result: "completed",
          runId,
          scheduleId: schedule.id
        }
      });
      expect(completed).toMatchObject({
        ok: true,
        schedule: { runs: [{ completedAt: expect.any(String), status: "completed" }], version: 7 }
      });
      expect(
        await mutateAdminAISchedule({
          actor: ownerActor(),
          capabilities: { ...capabilities, secureScheduledJobs: false },
          db: db.asD1(),
          input: {
            expectedVersion: 7,
            maxAttempts: 2,
            operation: "start-run",
            scheduleId: schedule.id
          }
        })
      ).toMatchObject({ code: "unavailable", ok: false, status: 503 });

      const finalAttempt = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          expectedVersion: 7,
          maxAttempts: 1,
          operation: "start-run",
          scheduleId: schedule.id
        }
      });
      if (!finalAttempt.ok) throw new Error(finalAttempt.message);
      const deadLettered = await mutateAdminAISchedule({
        actor: ownerActor(),
        capabilities,
        db: db.asD1(),
        input: {
          errorCode: "permanent_provider_failure",
          expectedVersion: 8,
          operation: "record-run-result",
          result: "retryable-failure",
          runId: finalAttempt.schedule.runs[0].id,
          scheduleId: schedule.id
        }
      });
      if (!deadLettered.ok) throw new Error(deadLettered.message);
      expect(deadLettered.schedule.version).toBe(9);
      expect(deadLettered.schedule.runs[0]).toMatchObject({
        errorCode: "permanent_provider_failure",
        status: "dead-letter"
      });
    } finally {
      Date.now = originalNow;
    }
  });

  test("protects the API with owner role, CSRF, durable storage, and server-only capability flags", async () => {
    const db = createDb();
    const env = {
      ...authBase,
      ADMIN_AI_EMAIL_WORKFLOW_APPROVED: "true",
      ADMIN_AI_SCHEDULED_JOBS_ENABLED: "true",
      ADMIN_DB: db.asD1()
    };
    const unauthenticated = await handleAdminAISchedules({
      env,
      request: scheduleRequest(null, "POST", createRequestBody())
    });
    expect(unauthenticated.status).toBe(401);

    const adminSession = await createSession(ADMIN_EMAIL, env);
    const forbidden = await handleAdminAISchedules({
      env,
      request: scheduleRequest(adminSession, "POST", createRequestBody())
    });
    expect(forbidden.status).toBe(403);

    const ownerSession = await createSession(OWNER_EMAIL, env);
    const missingCsrf = await handleAdminAISchedules({
      env,
      request: scheduleRequest({ ...ownerSession, csrfToken: "" }, "POST", createRequestBody())
    });
    expect(missingCsrf.status).toBe(403);

    const created = await handleAdminAISchedules({
      env,
      request: scheduleRequest(ownerSession, "POST", createRequestBody())
    });
    expect(created.status).toBe(201);
    const payload = (await created.json()) as {
      ok?: boolean;
      schedule?: { enabled?: boolean; id?: string; version?: number };
    };
    expect(payload).toMatchObject({ ok: true, schedule: { enabled: true } });
    if (!payload.schedule?.id || !payload.schedule.version) {
      throw new Error("Expected a durable schedule identity and version.");
    }

    const selfAttestedDelivery = await handleAdminAISchedules({
      env,
      request: scheduleRequest(ownerSession, "PATCH", {
        detail: "Owner browser claims the provider delivered it.",
        expectedVersion: payload.schedule.version,
        operation: "record-delivery",
        scheduleId: payload.schedule.id,
        status: "delivered"
      })
    });
    expect(selfAttestedDelivery.status).toBe(403);
    expect(await selfAttestedDelivery.json()).toMatchObject({
      code: "forbidden",
      error: expect.stringContaining("secure scheduled-job runner"),
      ok: false
    });
    expect(db.scheduleRows()[0]).toMatchObject({ version: 1 });

    const disabled = await handleAdminAISchedules({
      env,
      request: scheduleRequest(ownerSession, "PATCH", {
        expectedVersion: payload.schedule.version,
        operation: "disable",
        scheduleId: payload.schedule.id
      })
    });
    expect(disabled.status).toBe(200);
    expect(await disabled.json()).toMatchObject({
      ok: true,
      schedule: { enabled: false, version: 2 }
    });

    const listed = await handleAdminAISchedules({
      env,
      request: scheduleRequest(ownerSession, "GET")
    });
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ ok: true, schedules: [expect.any(Object)] });

    const missingDbEnv = {
      ...authBase,
      ADMIN_AI_SCHEDULED_JOBS_ENABLED: "true",
      ADMIN_REQUIRE_DB_ADMIN_ROLES: "false"
    };
    const missingDb = await handleAdminAISchedules({
      env: missingDbEnv,
      request: scheduleRequest(
        await createSession(OWNER_EMAIL, missingDbEnv),
        "POST",
        createRequestBody()
      )
    });
    expect(missingDb.status).toBe(503);
  });
});

async function createEnabledSchedule(
  db: ScheduleFakeD1,
  reportType: string,
  delivery: Record<string, unknown>
) {
  const created = await mutateAdminAISchedule({
    actor: ownerActor(),
    capabilities,
    db: db.asD1(),
    input: {
      cadence: { frequency: "weekly", localTime: "09:00", timeZone: "UTC", weekday: "monday" },
      delivery,
      enabled: true,
      operation: "create",
      reportType
    }
  });
  if (!created.ok) throw new Error("Expected schedule creation to succeed.");
  return created.schedule;
}

function ownerActor() {
  return { email: OWNER_EMAIL, isOwner: true };
}

function createRequestBody() {
  return {
    cadence: { frequency: "daily", localTime: "09:00", timeZone: "Asia/Kolkata" },
    delivery: { channel: "in-app" },
    enabled: true,
    operation: "create",
    reportType: "Daily Briefing"
  };
}

type ScheduleRow = {
  created_at: number;
  created_by: string;
  enabled: number;
  id: string;
  next_run_at: number | null;
  report_type: string;
  state_json: string;
  updated_at: number;
  updated_by: string;
  version: number;
};

type ScheduleEventRow = {
  actor_email: string;
  event_type: string;
  id: string;
  occurred_at: number;
  schedule_id: string;
  schedule_version: number;
};

class ScheduleFakeD1 {
  private failBatch = false;
  private state = {
    events: new Map<string, ScheduleEventRow>(),
    schedules: new Map<string, ScheduleRow>()
  };

  constructor(
    private readonly users = [user(OWNER_EMAIL, true, "owner"), user(ADMIN_EMAIL, false, "admin")]
  ) {}

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new ScheduleStatement(this, sql);
  }

  async batch(statements: ScheduleStatement[]) {
    if (this.failBatch) {
      this.failBatch = false;
      throw new Error("D1 batch unavailable");
    }
    const draft = cloneScheduleState(this.state);
    const results: D1Result<unknown>[] = [];
    let previousChanges = 0;
    for (const statement of statements) {
      const result = statement.runInBatch(draft, previousChanges);
      previousChanges = Number(result.meta.changes || 0);
      results.push(result);
    }
    this.state = draft;
    return results;
  }

  failNextBatch() {
    this.failBatch = true;
  }

  adminUser(email: string) {
    return this.users.find((candidate) => candidate.email === email) || null;
  }

  schedule(id: string) {
    return this.state.schedules.get(id) || null;
  }

  scheduleRows() {
    return Array.from(this.state.schedules.values());
  }

  eventRows(scheduleId?: string) {
    return Array.from(this.state.events.values())
      .filter((event) => !scheduleId || event.schedule_id === scheduleId)
      .sort(
        (left, right) =>
          left.schedule_version - right.schedule_version || left.id.localeCompare(right.id)
      );
  }

  eventTypes() {
    return this.eventRows().map((event) => event.event_type);
  }
}

type ScheduleState = {
  events: Map<string, ScheduleEventRow>;
  schedules: Map<string, ScheduleRow>;
};

class ScheduleStatement {
  private params: unknown[] = [];
  private readonly sql: string;

  constructor(
    private readonly db: ScheduleFakeD1,
    sql: string
  ) {
    this.sql = sql.replace(/\s+/g, " ").trim();
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes("FROM admin_users")) {
      return this.db.adminUser(String(this.params[0] || "")) as T | null;
    }
    if (this.sql.includes("FROM admin_ai_schedules")) {
      return this.db.schedule(String(this.params[0] || "")) as T | null;
    }
    return null;
  }

  async all<T>() {
    if (this.sql.includes("PRAGMA table_info")) return { results: [] as T[] };
    if (
      this.sql.includes("admin_role_permissions") ||
      this.sql.includes("admin_user_permissions")
    ) {
      return { results: [] as T[] };
    }
    if (this.sql.includes("FROM admin_ai_schedule_events")) {
      return { results: this.db.eventRows(String(this.params[0] || "")) as T[] };
    }
    if (this.sql.includes("FROM admin_ai_schedules")) {
      return { results: this.db.scheduleRows() as T[] };
    }
    return { results: [] as T[] };
  }

  async run() {
    return d1Result(0);
  }

  runInBatch(state: ScheduleState, previousChanges: number) {
    if (this.sql.includes("INSERT INTO admin_ai_schedules")) {
      const [
        id,
        reportType,
        enabled,
        nextRunAt,
        stateJson,
        version,
        createdBy,
        updatedBy,
        createdAt,
        updatedAt
      ] = this.params;
      if (state.schedules.has(String(id))) return d1Result(0);
      state.schedules.set(String(id), {
        created_at: Number(createdAt),
        created_by: String(createdBy),
        enabled: Number(enabled),
        id: String(id),
        next_run_at: nextRunAt === null ? null : Number(nextRunAt),
        report_type: String(reportType),
        state_json: String(stateJson),
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy),
        version: Number(version)
      });
      return d1Result(1);
    }
    if (this.sql.includes("UPDATE admin_ai_schedules")) {
      const [
        reportType,
        enabled,
        nextRunAt,
        stateJson,
        version,
        updatedBy,
        updatedAt,
        id,
        expectedVersion
      ] = this.params;
      const row = state.schedules.get(String(id));
      if (!row || row.version !== Number(expectedVersion)) return d1Result(0);
      state.schedules.set(String(id), {
        ...row,
        enabled: Number(enabled),
        next_run_at: nextRunAt === null ? null : Number(nextRunAt),
        report_type: String(reportType),
        state_json: String(stateJson),
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy),
        version: Number(version)
      });
      return d1Result(1);
    }
    if (this.sql.includes("INSERT INTO admin_ai_schedule_events")) {
      if (this.sql.includes("WHERE changes() = 1") && previousChanges !== 1) return d1Result(0);
      const [id, scheduleId, eventType, actorEmail, scheduleVersion, occurredAt] = this.params;
      state.events.set(String(id), {
        actor_email: String(actorEmail),
        event_type: String(eventType),
        id: String(id),
        occurred_at: Number(occurredAt),
        schedule_id: String(scheduleId),
        schedule_version: Number(scheduleVersion)
      });
      return d1Result(1);
    }
    return d1Result(0);
  }
}

function cloneScheduleState(state: ScheduleState): ScheduleState {
  return {
    events: new Map(Array.from(state.events, ([key, value]) => [key, { ...value }])),
    schedules: new Map(Array.from(state.schedules, ([key, value]) => [key, { ...value }]))
  };
}

function d1Result(changes: number): D1Result<unknown> {
  return {
    meta: { changes } as D1Result<unknown>["meta"],
    results: [],
    success: true
  };
}

function createDb() {
  return new ScheduleFakeD1();
}

function user(email: string, isOwner: boolean, role: "admin" | "owner") {
  return {
    email,
    first_name: "Schedule",
    is_owner: isOwner ? 1 : 0,
    last_name: isOwner ? "Owner" : "Admin",
    role,
    role_key: isOwner ? "owner" : "reports",
    status: "active"
  };
}

async function createSession(
  email: string,
  env: typeof authBase & { ADMIN_DB?: D1Database; ADMIN_REQUIRE_DB_ADMIN_ROLES?: string }
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    email,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const cookie = await createAdminSessionCookie({
    email,
    env,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env, session: payload });
  if (!cookie || !csrfToken) throw new Error("Expected schedule API session credentials.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function scheduleRequest(
  session: { cookie: string; csrfToken: string } | null,
  method: "GET" | "PATCH" | "POST",
  body?: Record<string, unknown>
) {
  return new Request("http://127.0.0.1:4802/api/admin/ai-schedules", {
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      ...(session ? { cookie: session.cookie } : {}),
      ...(session?.csrfToken ? { "x-yw-admin-csrf": session.csrfToken } : {})
    },
    method
  });
}
