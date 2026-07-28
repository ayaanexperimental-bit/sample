import { expect, test } from "@playwright/test";
import type { D1Database, D1Result } from "@cloudflare/workers-types";
import { onRequest as handleAdminAIIncident } from "../../functions/api/admin/ai-incidents";
import type { AdminAIHealthEvidenceInput } from "../../lib/admin-ai/adminAIHealth";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import {
  getActiveAdminAIIncident,
  resolveAdminAIIncident,
  syncAdminAIIncident,
  updateAdminAIIncidentChecklist
} from "../../lib/server/admin-ai-incidents";

const OWNER_EMAIL = "incident-owner@example.com";
const VIEWER_EMAIL = "incident-viewer@example.com";
const NOW = "2026-07-21T12:00:00.000Z";
const authBase = {
  ADMIN_ALLOWED_EMAILS: `${OWNER_EMAIL},${VIEWER_EMAIL}`,
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_REQUIRE_DB_ADMIN_ROLES: "true",
  ADMIN_SESSION_SECRET: "admin-ai-incident-persistence-secret",
  ROOT_OWNER_EMAIL: OWNER_EMAIL
};

test.describe("Admin AI incident persistence", () => {
  test("persists incident state, checklist changes, append-only events, and explicit resolution", async () => {
    const db = new AdminAIIncidentFakeD1();
    const opened = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });

    expect(opened).toMatchObject({
      ok: true,
      status: 201,
      incident: {
        incident: {
          actionFreeze: { active: true, enforcement: "required" },
          classification: "analytics-ingestion-outage",
          status: "active"
        },
        openedBy: OWNER_EMAIL,
        status: "active",
        version: 1
      }
    });
    if (!opened.ok) throw new Error("Expected the incident to open.");

    const active = await getActiveAdminAIIncident(db.asD1());
    expect(active).toMatchObject({
      incident: { incidentId: opened.incident.incident.incidentId },
      events: [{ eventType: "incident-opened" }],
      version: 1
    });

    const updated = await updateAdminAIIncidentChecklist({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      expectedVersion: 1,
      incidentId: opened.incident.incident.incidentId,
      itemId: "confirm-impact",
      status: "complete"
    });
    expect(updated).toMatchObject({ ok: true, incident: { version: 2 } });
    if (!updated.ok) throw new Error("Expected the checklist update to persist.");
    expect(
      updated.incident.incident.checklist.find(({ id }) => id === "confirm-impact")?.status
    ).toBe("complete");
    expect(updated.incident.events.map(({ eventType }) => eventType)).toEqual([
      "incident-opened",
      "checklist-updated"
    ]);

    const idempotent = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });
    expect(idempotent).toMatchObject({ ok: true, status: 200, incident: { version: 2 } });
    if (!idempotent.ok) throw new Error("Expected idempotent sync to succeed.");
    expect(idempotent.incident.events).toHaveLength(2);

    const resolved = await resolveAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      expectedVersion: 2,
      incidentId: opened.incident.incident.incidentId,
      reason: "Protected analytics ingestion was verified healthy."
    });
    expect(resolved).toMatchObject({
      ok: true,
      incident: {
        incident: { actionFreeze: { active: false }, status: "monitoring" },
        resolutionReason: "Protected analytics ingestion was verified healthy.",
        status: "resolved",
        version: 3
      }
    });
    expect(await getActiveAdminAIIncident(db.asD1())).toBeNull();
  });

  test("does not persist request language without validated high-priority evidence", async () => {
    const db = new AdminAIIncidentFakeD1();
    const result = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });

    expect(result).toMatchObject({ ok: false, code: "not-declared", status: 422 });
    expect(await getActiveAdminAIIncident(db.asD1())).toBeNull();
  });

  test("refreshes the durable snapshot when operational alert metadata changes", async () => {
    const db = new AdminAIIncidentFakeD1();
    const opened = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });
    if (!opened.ok) throw new Error("Expected the incident to open.");

    const refreshed = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [
        {
          ...incidentEvidence(),
          directRoute: "/admin/dashboard?view=error-reports",
          impact: "Analytics failures now block the owner recovery workflow.",
          suggestedNextStep: "Open Error Reports and verify the protected recovery workflow."
        }
      ],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });

    expect(refreshed).toMatchObject({
      ok: true,
      status: 200,
      incident: {
        incident: {
          alerts: [
            expect.objectContaining({
              directRoute: "/admin/dashboard?view=error-reports",
              impact: "Analytics failures now block the owner recovery workflow.",
              suggestedNextStep: "Open Error Reports and verify the protected recovery workflow."
            })
          ],
          impactSummary: "Analytics failures now block the owner recovery workflow."
        },
        events: expect.arrayContaining([
          expect.objectContaining({ eventType: "incident-refreshed" })
        ]),
        version: 2
      }
    });
  });

  test("hydrates complete provenance when restoring a legacy durable incident snapshot", async () => {
    const db = new AdminAIIncidentFakeD1();
    const opened = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });
    if (!opened.ok) throw new Error("Expected the incident to open.");

    const row = db.findActive();
    if (!row) throw new Error("Expected an active incident row.");
    const legacy = JSON.parse(row.snapshot_json) as {
      evidence: Array<Record<string, unknown>>;
    };
    legacy.evidence = legacy.evidence.map((item) => {
      const legacyItem = { ...item };
      delete legacyItem.dateRange;
      delete legacyItem.entityRoute;
      delete legacyItem.freshness;
      delete legacyItem.recordCount;
      return {
        ...legacyItem,
        entityReference: 42,
        filters: { unsafe: { nested: true } },
        sourceRoute: "https://example.invalid/admin"
      };
    });
    row.snapshot_json = JSON.stringify(legacy);

    const restored = await getActiveAdminAIIncident(db.asD1());
    expect(restored?.incident.evidence[0]).toMatchObject({
      dateRange: `${NOW} to ${NOW}`,
      entityReference: "analytics-events",
      filters: {
        alertId: "analytics-source-unavailable",
        incidentKind: "analytics-ingestion-outage",
        minimumSeverity: "high"
      },
      freshness: `Last observed at ${NOW}`,
      recordCount: 1,
      sourceRoute: "/admin/dashboard?view=coach-analytics"
    });
    expect(restored?.incident.evidence[0].entityRoute).toBeUndefined();
  });

  test("reports a durable storage failure as unavailable instead of a false conflict", async () => {
    const db = new AdminAIIncidentFakeD1();
    db.failNextBatch = true;

    const result = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });

    expect(result).toMatchObject({ ok: false, code: "unavailable", status: 503 });
    expect(await getActiveAdminAIIncident(db.asD1())).toBeNull();
  });

  test("rejects stale checklist and resolution versions without losing current state", async () => {
    const db = new AdminAIIncidentFakeD1();
    const opened = await syncAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      evidence: [incidentEvidence()],
      query: "Analytics ingestion outage",
      requestedAt: NOW
    });
    if (!opened.ok) throw new Error("Expected the incident to open.");
    const incidentId = opened.incident.incident.incidentId;

    const first = await updateAdminAIIncidentChecklist({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      expectedVersion: 1,
      incidentId,
      itemId: "confirm-impact",
      status: "complete"
    });
    expect(first.ok).toBe(true);
    const stale = await resolveAdminAIIncident({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      expectedVersion: 1,
      incidentId,
      reason: "Stale client resolution must not win."
    });

    expect(stale).toMatchObject({ ok: false, code: "conflict", status: 409 });
    expect(await getActiveAdminAIIncident(db.asD1())).toMatchObject({ version: 2 });
  });
});

test.describe("Admin AI incident API authorization", () => {
  test("allows an owner to sync and read the active incident through the authenticated API", async () => {
    const db = new AdminAIIncidentFakeD1();
    const env = { ...authBase, ADMIN_DB: db.asD1() };
    const owner = await createSession(OWNER_EMAIL, env);
    const post = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "POST", {
        evidence: [incidentEvidence()],
        mode: "sync",
        query: "Analytics ingestion outage"
      })
    });

    expect(post.status).toBe(201);
    await expect(post.json()).resolves.toMatchObject({
      incident: { incident: { classification: "analytics-ingestion-outage" }, version: 1 },
      ok: true
    });

    const get = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "GET")
    });
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      incident: { incident: { actionFreeze: { active: true } } },
      ok: true
    });
  });

  test("persists checklist and resolution operations through the protected API contract", async () => {
    const db = new AdminAIIncidentFakeD1();
    const env = { ...authBase, ADMIN_DB: db.asD1() };
    const owner = await createSession(OWNER_EMAIL, env);
    const openedResponse = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "POST", {
        evidence: [incidentEvidence()],
        mode: "sync",
        query: "Analytics ingestion outage"
      })
    });
    const opened = (await openedResponse.json()) as {
      incident: { incident: { incidentId: string }; version: number };
    };

    const checklist = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "POST", {
        expectedVersion: opened.incident.version,
        incidentId: opened.incident.incident.incidentId,
        itemId: "confirm-impact",
        mode: "checklist",
        status: "complete"
      })
    });
    expect(checklist.status).toBe(200);
    await expect(checklist.json()).resolves.toMatchObject({
      incident: {
        incident: {
          checklist: expect.arrayContaining([
            expect.objectContaining({ id: "confirm-impact", status: "complete" })
          ])
        },
        version: 2
      },
      ok: true
    });

    const resolved = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "POST", {
        expectedVersion: 2,
        incidentId: opened.incident.incident.incidentId,
        mode: "resolve",
        reason: "Protected analytics ingestion was verified healthy."
      })
    });
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({
      incident: {
        incident: { actionFreeze: { active: false }, status: "monitoring" },
        status: "resolved",
        version: 3
      },
      ok: true
    });

    const get = await handleAdminAIIncident({
      env,
      request: incidentRequest(owner, "GET")
    });
    await expect(get.json()).resolves.toEqual({ incident: null, ok: true });
  });

  test("requires owner RBAC and CSRF before incident state can change", async () => {
    const db = new AdminAIIncidentFakeD1();
    const env = { ...authBase, ADMIN_DB: db.asD1() };
    const owner = await createSession(OWNER_EMAIL, env);
    const viewer = await createSession(VIEWER_EMAIL, env);
    const body = {
      evidence: [incidentEvidence()],
      mode: "sync",
      query: "Analytics ingestion outage"
    };

    const noCsrf = await handleAdminAIIncident({
      env,
      request: incidentRequest({ ...owner, csrfToken: "" }, "POST", body)
    });
    const nonOwner = await handleAdminAIIncident({
      env,
      request: incidentRequest(viewer, "POST", body)
    });

    expect(noCsrf.status).toBe(403);
    expect(nonOwner.status).toBe(403);
    expect(await getActiveAdminAIIncident(db.asD1())).toBeNull();
  });
});

function incidentEvidence(): AdminAIHealthEvidenceInput {
  return {
    affectedEntity: "analytics-events",
    category: "analytics-ingestion-failures",
    directRoute: "/admin/dashboard?view=coach-analytics",
    evidence: [
      {
        observedAt: NOW,
        source: "analytics-events",
        summary: "Protected analytics ingestion is unavailable.",
        value: "unavailable"
      }
    ],
    firstDetected: NOW,
    id: "analytics-source-unavailable",
    impact: "Current analytics and trend explanations are unavailable.",
    lastDetected: NOW,
    module: "analytics-events",
    recurrenceCount: 2,
    severity: "high",
    suggestedNextStep: "Verify the protected analytics source and recovery runbook.",
    whatHappened: "Analytics event ingestion outage"
  };
}

type IncidentRow = {
  classification: string;
  evidence_fingerprint: string;
  freeze_active: number;
  id: string;
  opened_at: number;
  opened_by: string;
  resolution_reason: string | null;
  resolved_at: number | null;
  scope: string;
  severity: string;
  snapshot_json: string;
  status: string;
  updated_at: number;
  updated_by: string;
  version: number;
};

type IncidentEventRow = {
  actor_email: string;
  detail: string;
  event_type: string;
  id: string;
  incident_id: string;
  occurred_at: number;
};

type IncidentState = {
  events: Map<string, IncidentEventRow>;
  incidents: Map<string, IncidentRow>;
};

class AdminAIIncidentFakeD1 {
  failNextBatch = false;
  private state: IncidentState = { events: new Map(), incidents: new Map() };
  private readonly users = new Map([
    [
      OWNER_EMAIL,
      {
        email: OWNER_EMAIL,
        first_name: "Incident",
        is_owner: 1,
        last_name: "Owner",
        role: "owner",
        role_key: "owner",
        status: "active"
      }
    ],
    [
      VIEWER_EMAIL,
      {
        email: VIEWER_EMAIL,
        first_name: "Incident",
        is_owner: 0,
        last_name: "Viewer",
        role: "admin",
        role_key: "reports",
        status: "active"
      }
    ]
  ]);

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new IncidentStatement(this, sql);
  }

  async batch(statements: IncidentStatement[]) {
    if (this.failNextBatch) {
      this.failNextBatch = false;
      throw new Error("forced_incident_storage_failure");
    }
    const draft = cloneIncidentState(this.state);
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

  findActive(classification?: string) {
    return (
      Array.from(this.state.incidents.values())
        .filter(
          (row) =>
            row.status === "active" &&
            row.freeze_active === 1 &&
            (!classification || row.classification === classification)
        )
        .sort((left, right) => right.updated_at - left.updated_at)[0] || null
    );
  }

  findIncident(id: string) {
    return this.state.incidents.get(id) || null;
  }

  incidentEvents(id: string) {
    return Array.from(this.state.events.values())
      .filter((event) => event.incident_id === id)
      .sort(
        (left, right) => left.occurred_at - right.occurred_at || left.id.localeCompare(right.id)
      );
  }

  adminUser(email: string) {
    return this.users.get(email) || null;
  }
}

class IncidentStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: AdminAIIncidentFakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes("FROM admin_users")) {
      return this.db.adminUser(String(this.params[0] || "")) as T | null;
    }
    if (!this.sql.includes("FROM admin_ai_incidents")) return null;
    if (this.sql.includes("classification = ?1")) {
      return this.db.findActive(String(this.params[0] || "")) as T | null;
    }
    if (this.sql.includes("WHERE id = ?1")) {
      return this.db.findIncident(String(this.params[0] || "")) as T | null;
    }
    return this.db.findActive() as T | null;
  }

  async all<T>() {
    if (
      this.sql.includes("admin_role_permissions") ||
      this.sql.includes("admin_user_permissions")
    ) {
      return { results: [] as T[] };
    }
    if (!this.sql.includes("FROM admin_ai_incident_events")) return { results: [] as T[] };
    return { results: this.db.incidentEvents(String(this.params[0] || "")) as T[] };
  }

  async run() {
    return d1Result(0);
  }

  runInBatch(state: IncidentState, previousChanges: number) {
    if (this.sql.includes("INSERT INTO admin_ai_incidents")) {
      const [
        id,
        classification,
        severity,
        status,
        freezeActive,
        scope,
        snapshotJson,
        evidenceFingerprint,
        version,
        openedBy,
        updatedBy,
        openedAt,
        updatedAt,
        resolvedAt,
        resolutionReason
      ] = this.params;
      if (state.incidents.has(String(id))) return d1Result(0);
      state.incidents.set(String(id), {
        classification: String(classification),
        evidence_fingerprint: String(evidenceFingerprint),
        freeze_active: Number(freezeActive),
        id: String(id),
        opened_at: Number(openedAt),
        opened_by: String(openedBy),
        resolution_reason: resolutionReason === null ? null : String(resolutionReason),
        resolved_at: resolvedAt === null ? null : Number(resolvedAt),
        scope: String(scope),
        severity: String(severity),
        snapshot_json: String(snapshotJson),
        status: String(status),
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy),
        version: Number(version)
      });
      return d1Result(1);
    }

    if (
      this.sql.includes("UPDATE admin_ai_incidents") &&
      this.sql.includes("status = 'resolved'")
    ) {
      if (previousChanges !== 0 && this.sql.includes("changes()")) return d1Result(0);
      const [
        snapshotJson,
        version,
        updatedBy,
        updatedAt,
        resolvedAt,
        resolutionReason,
        id,
        expectedVersion
      ] = this.params;
      const row = state.incidents.get(String(id));
      if (!row || row.status !== "active" || row.version !== Number(expectedVersion))
        return d1Result(0);
      Object.assign(row, {
        freeze_active: 0,
        resolution_reason: String(resolutionReason),
        resolved_at: Number(resolvedAt),
        snapshot_json: String(snapshotJson),
        status: "resolved",
        updated_at: Number(updatedAt),
        updated_by: String(updatedBy),
        version: Number(version)
      });
      return d1Result(1);
    }

    if (this.sql.includes("UPDATE admin_ai_incidents")) {
      const evidenceRefresh = this.sql.includes("evidence_fingerprint");
      const [
        snapshotJson,
        fingerprintOrVersion,
        versionOrUpdatedBy,
        updatedByOrAt,
        updatedAtOrId,
        idOrExpected,
        maybeExpected
      ] = this.params;
      const id = String(evidenceRefresh ? idOrExpected : updatedAtOrId);
      const expectedVersion = Number(evidenceRefresh ? maybeExpected : idOrExpected);
      const row = state.incidents.get(id);
      if (!row || row.status !== "active" || row.version !== expectedVersion) return d1Result(0);
      row.snapshot_json = String(snapshotJson);
      if (evidenceRefresh) {
        row.evidence_fingerprint = String(fingerprintOrVersion);
        row.version = Number(versionOrUpdatedBy);
        row.updated_by = String(updatedByOrAt);
        row.updated_at = Number(updatedAtOrId);
      } else {
        row.version = Number(fingerprintOrVersion);
        row.updated_by = String(versionOrUpdatedBy);
        row.updated_at = Number(updatedByOrAt);
      }
      return d1Result(1);
    }

    if (this.sql.includes("INSERT INTO admin_ai_incident_events")) {
      if (this.sql.includes("changes() = 1") && previousChanges !== 1) return d1Result(0);
      const [id, incidentId, eventType, detail, actorEmail, occurredAt] = this.params;
      if (state.events.has(String(id))) return d1Result(0);
      state.events.set(String(id), {
        actor_email: String(actorEmail),
        detail: String(detail),
        event_type: String(eventType),
        id: String(id),
        incident_id: String(incidentId),
        occurred_at: Number(occurredAt)
      });
      return d1Result(1);
    }

    return d1Result(0);
  }
}

function d1Result(changes: number): D1Result<unknown> {
  return { meta: { changes } as D1Result<unknown>["meta"], results: [], success: true };
}

function cloneIncidentState(state: IncidentState): IncidentState {
  return {
    events: new Map(Array.from(state.events, ([key, value]) => [key, { ...value }])),
    incidents: new Map(Array.from(state.incidents, ([key, value]) => [key, { ...value }]))
  };
}

async function createSession(email: string, env: typeof authBase & { ADMIN_DB: D1Database }) {
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
  if (!cookie || !csrfToken) throw new Error("Expected incident API session credentials.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function incidentRequest(
  session: { cookie: string; csrfToken: string },
  method: "GET" | "POST",
  body?: Record<string, unknown>
) {
  return new Request("http://127.0.0.1:4802/api/admin/ai-incidents", {
    ...(body ? { body: JSON.stringify(body) } : {}),
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      cookie: session.cookie,
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      ...(session.csrfToken ? { "x-yw-admin-csrf": session.csrfToken } : {})
    },
    method
  });
}
