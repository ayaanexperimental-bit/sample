import { expect, test } from "@playwright/test";
import type { D1Database } from "@cloudflare/workers-types";
import { onRequest as handleAdminAISettings } from "../../functions/api/admin/ai-settings";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import {
  getAdminAISettingsCenter,
  updateAdminAISettingsCenter,
  validateAdminAISettingsMutation
} from "../../lib/server/admin-ai-settings";
import { AdminAIPersistenceFakeD1 } from "./admin-ai-persistence-fake";

const OWNER_EMAIL = "settings-owner@example.com";
const ADMIN_EMAIL = "settings-admin@example.com";
const OTHER_EMAIL = "settings-other@example.com";
const authBase = {
  ADMIN_ALLOWED_EMAILS: `${OWNER_EMAIL},${ADMIN_EMAIL},${OTHER_EMAIL}`,
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_REQUIRE_DB_ADMIN_ROLES: "true",
  ADMIN_SESSION_SECRET: "admin-ai-settings-persistence-secret",
  ROOT_OWNER_EMAIL: OWNER_EMAIL
};

test.describe("Admin AI settings persistence", () => {
  test("persists per-admin preferences and a durable clear-safe-memory request", async () => {
    const db = createDb();
    db.addObservation({
      action_outcome: "success",
      admin_email: ADMIN_EMAIL,
      approval_count: 1,
      command: "generate-report",
      created_at: 1_776_000_000,
      estimated_cost_microusd: 2500,
      id: "observation-admin",
      outcome: "success",
      tool_call_count: 2
    });
    db.addObservation({
      action_outcome: "failed",
      admin_email: OTHER_EMAIL,
      approval_count: 0,
      command: "unrelated-private-command",
      created_at: 1_776_000_100,
      estimated_cost_microusd: 9999,
      id: "observation-other",
      outcome: "failed",
      tool_call_count: 4
    });

    const defaults = await getAdminAISettingsCenter({ actor: actor(ADMIN_EMAIL), db: db.asD1() });
    expect(defaults).toMatchObject({
      actionHistory: { available: true, entries: [{ command: "generate-report" }], scope: "self" },
      preferences: {
        aiPillEnabled: true,
        memoryEnabled: true,
        reportFormat: "markdown",
        responseLength: "balanced"
      },
      privacy: { memory: expect.any(String), retention: expect.any(String) },
      usage: {
        approvals: 1,
        estimatedCostMicrousd: 2500,
        requests: 1,
        scope: "self",
        toolCalls: 2
      }
    });
    expect(defaults).not.toHaveProperty("ownerConfig");
    expect(JSON.stringify(defaults)).not.toContain("unrelated-private-command");

    const updated = await updateAdminAISettingsCenter({
      actor: actor(ADMIN_EMAIL),
      db: db.asD1(),
      input: {
        clearSafeMemory: true,
        preferences: {
          aiPillEnabled: false,
          dailyBriefingEnabled: true,
          memoryEnabled: false,
          notificationPreference: "in-app",
          preferredLanguage: "en-IN",
          proactiveSuggestionsEnabled: false,
          reportFormat: "json",
          responseLength: "detailed"
        }
      }
    });
    expect(updated).toMatchObject({
      ok: true,
      settings: {
        clearSafeMemoryRequestedAt: expect.any(String),
        preferences: {
          aiPillEnabled: false,
          dailyBriefingEnabled: true,
          memoryEnabled: false,
          reportFormat: "json",
          responseLength: "detailed"
        }
      },
      status: 200
    });

    const reloaded = await getAdminAISettingsCenter({ actor: actor(ADMIN_EMAIL), db: db.asD1() });
    expect(reloaded).toMatchObject({
      clearSafeMemoryRequestedAt: expect.any(String),
      preferences: { aiPillEnabled: false, memoryEnabled: false, preferredLanguage: "en-IN" },
      updatedBy: ADMIN_EMAIL
    });
    expect(db.settingsEventRows().map(({ event_type }) => event_type)).toEqual([
      "preferences-updated",
      "safe-memory-clear-requested"
    ]);
  });

  test("clear safe memory disables memory even without a separate preferences patch", async () => {
    const db = createDb();
    const cleared = await updateAdminAISettingsCenter({
      actor: actor(ADMIN_EMAIL),
      db: db.asD1(),
      input: { clearSafeMemory: true }
    });

    expect(cleared).toMatchObject({
      ok: true,
      settings: {
        approvedCorrections: [],
        clearSafeMemoryRequestedAt: expect.any(String),
        preferences: { memoryEnabled: false }
      }
    });
  });

  test("keeps owner policy controls owner-only and strictly validates every nested section", async () => {
    const db = createDb();
    const forbidden = await updateAdminAISettingsCenter({
      actor: actor(ADMIN_EMAIL),
      db: db.asD1(),
      input: { expectedVersion: 0, ownerConfig: { retentionPeriodDays: 90 } }
    });
    expect(forbidden).toMatchObject({ ok: false, status: 403 });

    const updated = await updateAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1(),
      input: {
        expectedVersion: 0,
        ownerConfig: {
          actionPermissions: { dangerousEnabled: false, readEnabled: true, writeEnabled: false },
          approvedKnowledgeSources: [
            { id: "admin-runbooks", label: "Admin runbooks", type: "internal" }
          ],
          auditConfiguration: {
            enabled: true,
            recordDeniedAttempts: true,
            recordReadEvents: false,
            retentionDays: 90
          },
          featureAvailability: {
            artifacts: true,
            dailyBriefing: true,
            proactiveSuggestions: true,
            streaming: false,
            voice: false
          },
          modelRouting: {
            complexModel: "complex-default",
            defaultModel: "balanced-default",
            fallbackModel: "safe-fallback"
          },
          retentionPeriodDays: 90,
          usageLimits: {
            dailyRequestsPerAdmin: 200,
            maxTokensPerRequest: 8192,
            monthlyRequestsGlobal: 10000
          }
        }
      }
    });
    expect(updated).toMatchObject({
      ok: true,
      settings: {
        ownerConfig: {
          actionPermissions: { dangerousEnabled: false, writeEnabled: false },
          retentionPeriodDays: 90,
          version: 1
        }
      }
    });

    const viewerCenter = await getAdminAISettingsCenter({
      actor: actor(ADMIN_EMAIL),
      db: db.asD1()
    });
    expect(viewerCenter).not.toHaveProperty("ownerConfig");
    const ownerCenter = await getAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1()
    });
    expect(ownerCenter).toMatchObject({
      actionHistory: { scope: "all-admins" },
      ownerConfig: { retentionPeriodDays: 90, updatedBy: OWNER_EMAIL, version: 1 },
      usage: { scope: "all-admins" }
    });

    const stale = await updateAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1(),
      input: { expectedVersion: 0, ownerConfig: { retentionPeriodDays: 90 } }
    });
    expect(stale).toMatchObject({ code: "conflict", ok: false, status: 409 });
    const afterStale = await getAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1()
    });
    expect(afterStale).toMatchObject({
      ownerConfig: { retentionPeriodDays: 90, version: 1 }
    });
    expect(db.settingsEventRows()).toHaveLength(1);

    const fresh = await updateAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: db.asD1(),
      input: { expectedVersion: 1, ownerConfig: { retentionPeriodDays: 90 } }
    });
    expect(fresh).toMatchObject({
      ok: true,
      settings: { ownerConfig: { retentionPeriodDays: 90, version: 2 } },
      status: 200
    });
    expect(db.settingsEventRows()).toHaveLength(2);

    expect(
      validateAdminAISettingsMutation({ ownerConfig: { retentionPeriodDays: 30 } })
    ).toMatchObject({ ok: false });
    expect(
      validateAdminAISettingsMutation({
        expectedVersion: -1,
        ownerConfig: { retentionPeriodDays: 30 }
      })
    ).toMatchObject({ ok: false });
    expect(validateAdminAISettingsMutation({ preferences: { aiPillEnabled: true } })).toMatchObject(
      { ok: true }
    );

    expect(
      validateAdminAISettingsMutation({
        ownerConfig: { auditConfiguration: { enabled: true, hiddenSink: "https://evil.invalid" } }
      })
    ).toMatchObject({ ok: false });
    expect(
      validateAdminAISettingsMutation({
        ownerConfig: {
          approvedKnowledgeSources: [
            { id: "bad", label: "Bad", type: "internal", unsafeToken: "secret" }
          ]
        }
      })
    ).toMatchObject({ ok: false });
    expect(
      validateAdminAISettingsMutation({
        preferences: { aiPillEnabled: true, mysteryPreference: true }
      })
    ).toMatchObject({ ok: false });
  });

  test("fails closed when an owner policy compare-and-swap loses a concurrent race", async () => {
    const db = createDb();
    const durable = db.asD1();
    const racedDb = {
      batch: async (statements: unknown[]) =>
        statements.map(() => ({ meta: { changes: 0 }, success: true })),
      prepare: durable.prepare.bind(durable)
    } as unknown as D1Database;

    const raced = await updateAdminAISettingsCenter({
      actor: actor(OWNER_EMAIL, true),
      db: racedDb,
      input: { expectedVersion: 0, ownerConfig: { retentionPeriodDays: 90 } }
    });

    expect(raced).toMatchObject({ code: "conflict", ok: false, status: 409 });
    expect(db.settingsEventRows()).toHaveLength(0);
    expect(
      await getAdminAISettingsCenter({ actor: actor(OWNER_EMAIL, true), db: durable })
    ).toMatchObject({ ownerConfig: { version: 0 } });
  });
});

test.describe("Admin AI settings API protection", () => {
  test("requires authentication, CSRF, durable storage, and owner authority", async () => {
    const unauthenticated = await handleAdminAISettings({
      env: {},
      request: settingsRequest(null, { preferences: { aiPillEnabled: false } })
    });
    expect(unauthenticated.status).toBe(401);

    const db = createDb();
    const env = { ...authBase, ADMIN_DB: db.asD1() };
    const adminSession = await createSession(ADMIN_EMAIL, env);
    const missingCsrf = await handleAdminAISettings({
      env,
      request: settingsRequest(
        { ...adminSession, csrfToken: "" },
        { preferences: { aiPillEnabled: false } }
      )
    });
    expect(missingCsrf.status).toBe(403);

    const ownerOnly = await handleAdminAISettings({
      env,
      request: settingsRequest(adminSession, {
        expectedVersion: 0,
        ownerConfig: { retentionPeriodDays: 30 }
      })
    });
    expect(ownerOnly.status).toBe(403);

    const unknownField = await handleAdminAISettings({
      env,
      request: settingsRequest(adminSession, { preferences: { aiPillEnabled: true, hidden: true } })
    });
    expect(unknownField.status).toBe(400);

    const noDbEnv = { ...authBase, ADMIN_REQUIRE_DB_ADMIN_ROLES: "false" };
    const noDbSession = await createSession(OWNER_EMAIL, noDbEnv);
    const unavailable = await handleAdminAISettings({
      env: noDbEnv,
      request: settingsRequest(noDbSession, { preferences: { aiPillEnabled: false } })
    });
    expect(unavailable.status).toBe(503);

    const ownerSession = await createSession(OWNER_EMAIL, env);
    const initialOwnerWrite = await handleAdminAISettings({
      env,
      request: settingsRequest(ownerSession, {
        expectedVersion: 0,
        ownerConfig: { retentionPeriodDays: 90 }
      })
    });
    expect(initialOwnerWrite.status).toBe(200);

    const staleOwnerWrite = await handleAdminAISettings({
      env,
      request: settingsRequest(ownerSession, {
        expectedVersion: 0,
        ownerConfig: { retentionPeriodDays: 90 }
      })
    });
    expect(staleOwnerWrite.status).toBe(409);
    expect(await staleOwnerWrite.json()).toMatchObject({ code: "conflict", ok: false });
    expect(
      await getAdminAISettingsCenter({ actor: actor(OWNER_EMAIL, true), db: db.asD1() })
    ).toMatchObject({ ownerConfig: { retentionPeriodDays: 90, version: 1 } });
  });
});

function actor(email: string, isOwner = false) {
  return { email, isOwner };
}

function createDb() {
  return new AdminAIPersistenceFakeD1([
    user(OWNER_EMAIL, true, "owner"),
    user(ADMIN_EMAIL),
    user(OTHER_EMAIL)
  ]);
}

function user(email: string, isOwner = false, role = "admin") {
  return {
    email,
    first_name: "Settings",
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
  if (!cookie || !csrfToken) throw new Error("Expected settings API session credentials.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function settingsRequest(
  session: { cookie: string; csrfToken: string } | null,
  body: Record<string, unknown>
) {
  return new Request("http://127.0.0.1:4802/api/admin/ai-settings", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      ...(session ? { cookie: session.cookie } : {}),
      ...(session?.csrfToken ? { "x-yw-admin-csrf": session.csrfToken } : {})
    },
    method: "PATCH"
  });
}
