import { expect, test } from "@playwright/test";
import type { D1Database } from "@cloudflare/workers-types";
import type { AdminSessionPayload } from "../../lib/server/admin-auth";
import { createAdminCsrfToken, createAdminSessionCookie } from "../../lib/server/admin-auth";
import { onRequest as handleAdminAIAction } from "../../functions/api/admin/ai-actions";
import { executeRegisteredAdminAIAction } from "../../lib/admin-ai/adminAIActions";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import {
  adminAIRegistry,
  getAdminAICommand,
  type AdminAICommand
} from "../../lib/admin-ai/adminAIRegistry";
import {
  executeAdminAIRegisteredAction,
  hasAdminAIRegisteredActionHandler,
  rollbackAdminAIRegisteredAction
} from "../../lib/server/admin-ai-actions";

const OWNER_EMAIL = "copilot-owner@example.com";
const authEnv = {
  ADMIN_ALLOWED_EMAILS: OWNER_EMAIL,
  ADMIN_AUTH_DEMO_ENABLED: "true",
  ADMIN_REQUIRE_DB_ADMIN_ROLES: "false",
  ADMIN_SESSION_SECRET: "admin-ai-action-safety-test-secret"
};

test.describe("Admin AI registered action safety", () => {
  test("requires a complete server handler and message contract for every registered action", () => {
    const actions = Object.values(adminAIRegistry)
      .flatMap((section) => section.commands)
      .filter((command) => command.kind === "registered-action");

    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action).toMatchObject({
        auditLogEnabled: true,
        confirmationRequired: true,
        failureMessage: expect.any(String),
        handlerId: expect.any(String),
        successMessage: expect.any(String)
      });
      expect(action.failureMessage?.trim()).not.toBe("");
      expect(action.successMessage?.trim()).not.toBe("");
      expect(hasAdminAIRegisteredActionHandler(action.handlerId)).toBe(true);
    }
  });

  test("never routes a sensitive review-only workflow to server execution", async () => {
    const command = adminAIRegistry["coach-sites"].commands.find(
      (candidate) => candidate.id === "coach-sites.prepare-archive"
    );
    if (!command) throw new Error("Expected the archive review command.");
    let fetchCalls = 0;

    const response = await executeRegisteredAdminAIAction(command, createContext(), {
      csrfToken: "csrf-test",
      fetcher: async () => {
        fetchCalls += 1;
        return Response.json({ ok: true });
      }
    });

    expect(command.executionContract).toMatchObject({
      availability: "review-only",
      maxBatchSize: 0
    });
    expect(fetchCalls).toBe(0);
    expect(response).toMatchObject({
      state: "action-failed",
      title: "Registered action unavailable"
    });
  });

  test("sends a registered write only to the server-owned Admin AI action endpoint", async () => {
    const command = getRegisteredCommand();
    const calls: Array<{ body: Record<string, unknown>; method: string; url: string }> = [];
    const response = await executeRegisteredAdminAIAction(command, createContext(), {
      csrfToken: "csrf-test",
      fetcher: async (input, init) => {
        calls.push({
          body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown>,
          method: init?.method || "",
          url: String(input)
        });
        return Response.json({
          ok: true,
          response: {
            approvalReceipt: {
              action: command.label,
              affectedRecords: ["ERR-1"],
              approvalLevel: 2,
              auditReference: "admin-ai-audit-1",
              confirmationTimestamp: "2026-07-21T00:00:00.000Z",
              currentState: "Status: New",
              impact: command.description,
              outcome: command.successMessage,
              otpRequired: false,
              permissionCheck: "error_reports.mark_status",
              proposedState: "Status: Reviewing",
              recordsChanged: 1,
              requestedBy: OWNER_EMAIL,
              reversible: true
            },
            body: "Error report ERR-1 is now Reviewing.",
            items: [],
            rollbackAction: {
              label: "Restore status to New",
              receiptId: "admin-ai-receipt-1",
              recordId: "ERR-1"
            },
            state: "action-complete",
            title: command.successMessage
          }
        });
      }
    });

    expect(response).toMatchObject({
      approvalReceipt: { auditReference: "admin-ai-audit-1", recordsChanged: 1 },
      state: "action-complete"
    });
    expect(calls).toEqual([
      {
        body: {
          actionId: "error-reports.mark-reviewing",
          confirmationResult: "accepted",
          mode: "execute",
          referenceId: "ERR-1",
          sectionId: "error-reports"
        },
        method: "POST",
        url: "/api/admin/ai-actions"
      }
    ]);
  });

  test("returns 503 before execution when the durable Admin DB is missing", async () => {
    const session = await createAdminTestSession();
    const response = await handleAdminAIAction({
      env: authEnv,
      request: actionRequest(session, {
        actionId: "error-reports.mark-reviewing",
        confirmationResult: "accepted",
        mode: "execute",
        referenceId: "ERR-1",
        sectionId: "error-reports"
      })
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      response: {
        state: "action-failed",
        title: "Report status update failed"
      }
    });
  });

  test("requires explicit confirmation before the bounded settings mutation", async () => {
    const db = new AdminAIActionFakeD1({}, { [OWNER_EMAIL]: true });
    const session = await createAdminTestSession();
    const response = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, {
        actionId: "settings.update-proactive-suggestions",
        confirmationResult: "declined",
        currentValue: true,
        mode: "execute",
        proposedValue: false,
        sectionId: "settings",
        settingKey: "proactiveSuggestionsEnabled"
      })
    });

    expect(response.status).toBe(400);
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(true);
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("atomically applies and receipt-rolls back one exact non-critical setting", async () => {
    const db = new AdminAIActionFakeD1({}, { [OWNER_EMAIL]: true });
    const session = await createAdminTestSession();
    const response = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, {
        actionId: "settings.update-proactive-suggestions",
        confirmationResult: "accepted",
        currentValue: true,
        mode: "execute",
        proposedValue: false,
        sectionId: "settings",
        settingKey: "proactiveSuggestionsEnabled"
      })
    });
    const payload = (await response.json()) as {
      response?: {
        approvalReceipt?: { auditReference?: string };
        rollbackAction?: { receiptId?: string };
      };
    };
    const receiptId = payload.response?.rollbackAction?.receiptId || "";
    const auditReference = payload.response?.approvalReceipt?.auditReference || "";

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      response: {
        approvalReceipt: {
          currentState: "proactiveSuggestionsEnabled: true",
          permissionCheck: "settings.support",
          proposedState: "proactiveSuggestionsEnabled: false",
          recordsChanged: 1,
          rollbackAvailable: true
        },
        rollbackAction: { recordId: "settings:proactiveSuggestionsEnabled" },
        state: "action-complete"
      }
    });
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(false);
    expect(db.settingsEvents.size).toBe(1);
    expect(db.receipts.get(receiptId)).toMatchObject({
      actionId: "settings.update-proactive-suggestions",
      adminEmail: OWNER_EMAIL,
      appliedValue: "false",
      auditReference,
      previousValue: "true",
      recordId: "settings:proactiveSuggestionsEnabled"
    });
    expect(db.audits.has(auditReference)).toBe(true);

    const wrongActor = await rollbackAdminAIRegisteredAction({
      adminEmail: "other-admin@example.com",
      db: db.asD1(),
      receiptId
    });
    expect(wrongActor).toMatchObject({ ok: false, status: 403 });
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(false);

    const rolledBack = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });
    expect(rolledBack).toMatchObject({
      ok: true,
      response: {
        approvalReceipt: {
          currentState: "proactiveSuggestionsEnabled: false",
          proposedState: "proactiveSuggestionsEnabled: true",
          recordsChanged: 1
        },
        state: "action-complete"
      },
      status: 200
    });
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(true);
    expect(db.settingsEvents.size).toBe(2);

    await expect(
      rollbackAdminAIRegisteredAction({ adminEmail: OWNER_EMAIL, db: db.asD1(), receiptId })
    ).resolves.toMatchObject({ ok: false, status: 409 });
  });

  test("retries one paid unpublished Shop order and durably confirms the verified result", async () => {
    const db = new ShopPaidRetryFakeD1();

    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getShopRetryCommand(),
      db: db.asD1(),
      referenceId: "SHOP-PAID-1"
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        approvalReceipt: {
          affectedRecords: ["SHOP-PAID-1"],
          auditReference: expect.stringMatching(/^admin-ai-/),
          executionStatus: "success",
          recordsChanged: 1,
          reversible: false,
          rollbackAvailable: false
        },
        state: "action-complete",
        title: "Paid Shop order published"
      },
      status: 200
    });
    expect(db.orderState()).toEqual({ paymentStatus: "published", siteStatus: "published" });
    expect(db.receiptCount()).toBe(1);
    expect(db.completedAuditCount()).toBe(1);
  });

  test("rechecks the registered Shop permission and exact server state through the action API", async () => {
    const db = new ShopPaidRetryFakeD1();
    const command = getShopRetryCommand();
    const session = await createAdminTestSession();
    adminAIRegistry.shop.commands.push(command);

    try {
      const response = await handleAdminAIAction({
        env: { ...authEnv, ADMIN_DB: db.asD1() },
        request: actionRequest(session, {
          actionId: command.id,
          confirmationResult: "accepted",
          mode: "execute",
          referenceId: "SHOP-PAID-1",
          sectionId: command.sectionId
        })
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        response: {
          approvalReceipt: {
            permissionCheck: "shop.recovery",
            recordsChanged: 1
          },
          state: "action-complete"
        }
      });
    } finally {
      const index = adminAIRegistry.shop.commands.indexOf(command);
      if (index >= 0) adminAIRegistry.shop.commands.splice(index, 1);
    }
  });

  test("never claims paid-order retry success when durable result confirmation fails", async () => {
    const db = new ShopPaidRetryFakeD1();
    db.failCompletionAuditUpdate = true;

    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getShopRetryCommand(),
      db: db.asD1(),
      referenceId: "SHOP-PAID-1"
    });

    expect(result).toMatchObject({
      ok: false,
      response: {
        body: expect.stringContaining("No success is claimed"),
        state: "action-failed"
      },
      status: 503
    });
    expect(db.orderState()).toEqual({ paymentStatus: "published", siteStatus: "published" });
    expect(db.receiptCount()).toBe(1);
    expect(db.receiptValue()).toBe("retry_requested");
    expect(db.completedAuditCount()).toBe(0);
  });

  test("rejects oversized Shop action identifiers instead of truncating or retargeting them", async () => {
    const db = new ShopPaidRetryFakeD1();
    const session = await createAdminTestSession();
    const response = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, {
        actionId: "shop.retry-publish",
        confirmationResult: "accepted",
        mode: "execute",
        referenceId: `SHOP-PAID-1${"x".repeat(150)}`,
        sectionId: "shop"
      })
    });

    expect(response.status).toBe(400);
    expect(db.orderState()).toEqual({ paymentStatus: "paid", siteStatus: "publish_failed" });
    expect(db.receiptCount()).toBe(0);
  });

  test("atomically applies and receipt-rolls back one support-default text snapshot", async () => {
    const db = new SupportDefaultsActionFakeD1();
    const command = getSupportDefaultsCommand();

    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command,
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: db.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });

    expect(executed).toMatchObject({
      ok: true,
      response: {
        approvalReceipt: {
          affectedRecords: ["settings:supportDefaults"],
          recordsChanged: 1,
          rollbackAvailable: true
        },
        rollbackAction: { recordId: "settings:supportDefaults" },
        state: "action-complete"
      },
      status: 200
    });
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_AFTER);

    const rolledBack = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId: executed.response.rollbackAction?.receiptId || ""
    });
    expect(rolledBack).toMatchObject({
      ok: true,
      response: { approvalReceipt: { recordsChanged: 1 }, state: "action-complete" },
      status: 200
    });
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_BEFORE);
  });

  test("compares support-default CAS against the effective environment fallback before first D1 write", async () => {
    const db = new SupportDefaultsActionFakeD1(false);
    const session = await createAdminTestSession();
    const effective = {
      supportEmail: "environment-support@ywcoach.com",
      supportMessage: "Contact the environment support team for help with this step.",
      supportName: "Environment Support",
      supportPhone: "+918888888888",
      supportWhatsapp: "https://wa.me/918888888888"
    };
    const proposed = {
      ...effective,
      supportMessage: "Contact the priority environment support team for help with this step."
    };

    const response = await handleAdminAIAction({
      env: {
        ...authEnv,
        ADMIN_DB: db.asD1(),
        NEXT_PUBLIC_SUPPORT_EMAIL: effective.supportEmail,
        NEXT_PUBLIC_SUPPORT_MESSAGE: effective.supportMessage,
        NEXT_PUBLIC_SUPPORT_NAME: effective.supportName,
        NEXT_PUBLIC_SUPPORT_PHONE: effective.supportPhone,
        NEXT_PUBLIC_SUPPORT_WHATSAPP: effective.supportWhatsapp
      },
      request: actionRequest(session, {
        actionId: "settings.update-support-defaults",
        confirmationResult: "accepted",
        currentValue: JSON.stringify(effective),
        mode: "execute",
        proposedValue: JSON.stringify(proposed),
        sectionId: "settings",
        settingKey: "supportDefaults"
      })
    });

    expect(response.status).toBe(200);
    expect(db.defaults()).toEqual(proposed);
  });

  test("rejects non-string or mis-keyed support-default snapshots at the action API", async () => {
    const db = new SupportDefaultsActionFakeD1();
    const session = await createAdminTestSession();
    const baseBody = {
      actionId: "settings.update-support-defaults",
      confirmationResult: "accepted",
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      mode: "execute",
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      sectionId: "settings",
      settingKey: "supportDefaults"
    };

    const nonString = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, { ...baseBody, proposedValue: SUPPORT_DEFAULTS_AFTER })
    });
    const wrongKey = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, { ...baseBody, settingKey: "supportMessage" })
    });

    expect(nonString.status).toBe(400);
    expect(wrongKey.status).toBe(400);
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_BEFORE);
  });

  test("binds support-default rollback to its actor and rejects replay", async () => {
    const db = new SupportDefaultsActionFakeD1();
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSupportDefaultsCommand(),
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: db.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";

    await expect(
      rollbackAdminAIRegisteredAction({
        adminEmail: "other-admin@example.com",
        db: db.asD1(),
        receiptId
      })
    ).resolves.toMatchObject({ ok: false, status: 403 });
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_AFTER);

    await expect(
      rollbackAdminAIRegisteredAction({ adminEmail: OWNER_EMAIL, db: db.asD1(), receiptId })
    ).resolves.toMatchObject({ ok: true, status: 200 });
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_BEFORE);

    await expect(
      rollbackAdminAIRegisteredAction({ adminEmail: OWNER_EMAIL, db: db.asD1(), receiptId })
    ).resolves.toMatchObject({ ok: false, status: 409 });
  });

  test("blocks stale support-default rollback without overwriting newer state", async () => {
    const db = new SupportDefaultsActionFakeD1();
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSupportDefaultsCommand(),
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: db.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    const newer = {
      ...SUPPORT_DEFAULTS_AFTER,
      supportMessage: "Contact the newest support team for help with this paid order."
    };
    db.setDefaults(newer);

    const stale = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });

    expect(stale).toMatchObject({ ok: false, status: 409 });
    expect(db.defaults()).toEqual(newer);
    expect(db.receiptAvailable(receiptId)).toBe(true);
  });

  test("preserves applied support defaults when the rollback receipt guard loses its race", async () => {
    const db = new SupportDefaultsActionFakeD1();
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSupportDefaultsCommand(),
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: db.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    db.failRollbackReceiptGuard = true;

    const failed = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });

    expect(failed).toMatchObject({ ok: false, status: 503 });
    expect(db.defaults()).toEqual(SUPPORT_DEFAULTS_AFTER);
    expect(db.receiptAvailable(receiptId)).toBe(true);
  });

  test("keeps support-default mutation and rollback atomic when audit persistence fails", async () => {
    const executionDb = new SupportDefaultsActionFakeD1();
    executionDb.failAuditInsert = true;
    const failedExecution = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSupportDefaultsCommand(),
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: executionDb.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });
    expect(failedExecution).toMatchObject({ ok: false, status: 503 });
    expect(executionDb.defaults()).toEqual(SUPPORT_DEFAULTS_BEFORE);

    const rollbackDb = new SupportDefaultsActionFakeD1();
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSupportDefaultsCommand(),
      currentValue: JSON.stringify(SUPPORT_DEFAULTS_BEFORE),
      db: rollbackDb.asD1(),
      proposedValue: JSON.stringify(SUPPORT_DEFAULTS_AFTER),
      settingKey: "supportDefaults"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    rollbackDb.failAuditInsert = true;

    const failedRollback = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: rollbackDb.asD1(),
      receiptId
    });
    expect(failedRollback).toMatchObject({ ok: false, status: 503 });
    expect(rollbackDb.defaults()).toEqual(SUPPORT_DEFAULTS_AFTER);
    expect(rollbackDb.receiptAvailable(receiptId)).toBe(true);
  });

  test("does not claim or keep a settings mutation when durable audit persistence fails", async () => {
    const db = new AdminAIActionFakeD1({}, { [OWNER_EMAIL]: true });
    db.failAuditInsert = true;
    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSettingsCommand(),
      currentValue: true,
      db: db.asD1(),
      proposedValue: false,
      settingKey: "proactiveSuggestionsEnabled"
    });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(true);
    expect(db.settingsEvents.size).toBe(0);
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("uses an optimistic settings-state check and never overwrites a concurrent value", async () => {
    const db = new AdminAIActionFakeD1({}, { [OWNER_EMAIL]: true });
    db.proactiveSettingBeforeBatch = false;
    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getSettingsCommand(),
      currentValue: true,
      db: db.asD1(),
      proposedValue: false,
      settingKey: "proactiveSuggestionsEnabled"
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(db.proactiveSuggestionsEnabled(OWNER_EMAIL)).toBe(false);
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("API fails closed when the registered execution contract no longer matches its handler", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    const session = await createAdminTestSession();
    const command = getRegisteredCommand();
    const originalContract = command.executionContract;
    command.executionContract = { ...originalContract, maxBatchSize: 2 };

    try {
      const response = await handleAdminAIAction({
        env: { ...authEnv, ADMIN_DB: db.asD1() },
        request: actionRequest(session, {
          actionId: command.id,
          confirmationResult: "accepted",
          mode: "execute",
          referenceId: "ERR-1",
          sectionId: command.sectionId
        })
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "Invalid registered Copilot action.",
        ok: false
      });
    } finally {
      command.executionContract = originalContract;
    }

    expect(db.reportStatus("ERR-1")).toBe("New");
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("atomically persists the mutation, durable receipt, and exact audit reference", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New", "ERR-2": "Fixed" });
    const command = getRegisteredCommand();
    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command,
      db: db.asD1(),
      referenceId: "ERR-1"
    });

    expect(result).toMatchObject({
      ok: true,
      response: {
        approvalReceipt: {
          action: command.label,
          affectedRecords: ["ERR-1"],
          approvalLevel: command.approvalLevel,
          auditReference: expect.stringMatching(/^admin-ai-/),
          confirmationTimestamp: expect.any(String),
          currentState: "Status: New",
          executionStatus: "success",
          impact: command.description,
          impactLabel: "Impact",
          outcome: command.successMessage,
          otpRequired: Boolean(command.otpRequired),
          permissionCheck: "error_reports.mark_status",
          proposedState: "Status: Reviewing",
          recommendedByAI: command.label,
          recordsChanged: 1,
          requestedBy: OWNER_EMAIL,
          reversible: true,
          rollbackAvailable: true
        },
        rollbackAction: { recordId: "ERR-1" },
        state: "action-complete",
        title: command.successMessage
      },
      status: 200
    });
    const auditReference = result.response.approvalReceipt?.auditReference || "";
    const receiptId = result.response.rollbackAction?.receiptId || "";
    expect(db.reportStatus("ERR-1")).toBe("Reviewing");
    expect(db.reportStatus("ERR-2")).toBe("Fixed");
    expect(db.audits.get(auditReference)).toMatchObject({
      email: OWNER_EMAIL,
      id: auditReference
    });
    expect(db.receipts.get(receiptId)).toMatchObject({
      actionId: command.id,
      adminEmail: OWNER_EMAIL,
      appliedValue: "Reviewing",
      auditReference,
      previousValue: "New",
      recommendationReference: `command:${command.id}`,
      recordId: "ERR-1",
      rolledBackAt: null
    });
  });

  test("fails closed before a registered mutation when an incident freeze is active", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    db.setIncidentFreeze(true);

    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });

    expect(result).toMatchObject({
      ok: false,
      response: { state: "action-failed", title: "Action frozen by active incident" },
      status: 423
    });
    expect(db.reportStatus("ERR-1")).toBe("New");
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("propagates the incident freeze through the protected action API", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    db.setIncidentFreeze(true);
    const session = await createAdminTestSession();
    const response = await handleAdminAIAction({
      env: { ...authEnv, ADMIN_DB: db.asD1() },
      request: actionRequest(session, {
        actionId: "error-reports.mark-reviewing",
        confirmationResult: "accepted",
        mode: "execute",
        referenceId: "ERR-1",
        sectionId: "error-reports"
      })
    });

    expect(response.status).toBe(423);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      response: { state: "action-failed", title: "Action frozen by active incident" }
    });
    expect(db.reportStatus("ERR-1")).toBe("New");
  });

  test("keeps the freeze atomic when an incident activates after the pre-check", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    db.activateIncidentFreezeBeforeBatch = true;

    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });

    expect(result).toMatchObject({ ok: false, status: 423 });
    expect(db.reportStatus("ERR-1")).toBe("New");
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("fails closed when durable incident freeze state cannot be read", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    db.failIncidentRead = true;

    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });

    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(db.reportStatus("ERR-1")).toBe("New");
  });

  test("rolls back the entire batch when durable audit persistence fails", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    db.failAuditInsert = true;
    const result = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });

    expect(result).toMatchObject({
      ok: false,
      response: {
        approvalReceipt: {
          action: getRegisteredCommand().label,
          affectedRecords: ["ERR-1"],
          approvalLevel: getRegisteredCommand().approvalLevel,
          auditReference: null,
          confirmationTimestamp: expect.any(String),
          currentState: "Status: New",
          executionStatus: "failure",
          impact: getRegisteredCommand().description,
          impactLabel: "Impact",
          outcome: "The protected action could not be audited and persisted. No data changed.",
          otpRequired: Boolean(getRegisteredCommand().otpRequired),
          permissionCheck: "error_reports.mark_status",
          proposedState: "Status: Reviewing",
          recommendedByAI: getRegisteredCommand().label,
          recordsChanged: 0,
          requestedBy: OWNER_EMAIL,
          reversible: true,
          rollbackAvailable: false
        },
        state: "action-failed"
      },
      status: 503
    });
    expect(db.reportStatus("ERR-1")).toBe("New");
    expect(db.receipts.size).toBe(0);
    expect(db.audits.size).toBe(0);
  });

  test("binds rollback to its actor, action, record and applied state and rejects replay", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New", "ERR-2": "Fixed" });
    const command = getRegisteredCommand();
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command,
      db: db.asD1(),
      referenceId: "ERR-1"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";

    const wrongActor = await rollbackAdminAIRegisteredAction({
      adminEmail: "other-admin@example.com",
      db: db.asD1(),
      receiptId
    });
    expect(wrongActor).toMatchObject({ ok: false, status: 403 });
    expect(db.reportStatus("ERR-1")).toBe("Reviewing");

    const rolledBack = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });
    expect(rolledBack).toMatchObject({
      ok: true,
      response: {
        approvalReceipt: {
          action: `Restore ${command.label}`,
          affectedRecords: ["ERR-1"],
          auditReference: expect.stringMatching(/^admin-ai-/),
          currentState: "Status: Reviewing",
          executionStatus: "success",
          impact: "Restore the receipt-bound status to New.",
          impactLabel: "Impact",
          outcome: "Report status restored to New",
          proposedState: "Status: New",
          recommendedByAI: `Rollback option for ${command.label}`,
          recordsChanged: 1,
          requestedBy: OWNER_EMAIL,
          reversible: false,
          rollbackAvailable: false
        },
        state: "action-complete",
        title: "Report status restored to New"
      }
    });
    expect(db.reportStatus("ERR-1")).toBe("New");
    expect(db.reportStatus("ERR-2")).toBe("Fixed");
    expect(db.audits.has(rolledBack.response.approvalReceipt?.auditReference || "")).toBe(true);

    const replay = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });
    expect(replay).toMatchObject({ ok: false, status: 409 });
    expect(db.reportStatus("ERR-1")).toBe("New");
  });

  test("allows a receipt-bound rollback as recovery while an incident freeze is active", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    db.setIncidentFreeze(true);

    const rolledBack = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });

    expect(rolledBack).toMatchObject({ ok: true, status: 200 });
    expect(db.reportStatus("ERR-1")).toBe("New");
  });

  test("rejects a rollback receipt whose durable AI recommendation binding changed", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    const receipt = db.receipts.get(receiptId);
    if (!receipt) throw new Error("Expected durable approval receipt.");
    receipt.recommendationReference = "command:forged-action";

    const result = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(db.reportStatus("ERR-1")).toBe("Reviewing");
    expect(receipt.rollbackAvailable).toBe(1);
  });

  test("rejects stale or forged rollback receipts without overwriting newer state", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    db.setReportStatus("ERR-1", "Fixed");

    const stale = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });
    expect(stale).toMatchObject({ ok: false, status: 409 });
    expect(db.reportStatus("ERR-1")).toBe("Fixed");

    const forged = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId: `${receiptId}-forged`
    });
    expect(forged).toMatchObject({ ok: false, status: 404 });
    expect(db.reportStatus("ERR-1")).toBe("Fixed");
  });

  test("keeps rollback and its receipt reusable when rollback audit persistence fails", async () => {
    const db = new AdminAIActionFakeD1({ "ERR-1": "New" });
    const executed = await executeAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      command: getRegisteredCommand(),
      db: db.asD1(),
      referenceId: "ERR-1"
    });
    const receiptId = executed.response.rollbackAction?.receiptId || "";
    db.failAuditInsert = true;

    const failed = await rollbackAdminAIRegisteredAction({
      adminEmail: OWNER_EMAIL,
      db: db.asD1(),
      receiptId
    });
    expect(failed).toMatchObject({ ok: false, status: 503 });
    expect(db.reportStatus("ERR-1")).toBe("Reviewing");
    expect(db.receipts.get(receiptId)?.rolledBackAt).toBeNull();
    expect(db.audits.size).toBe(1);
  });
});

type ErrorReportStatus = "Fixed" | "Ignored" | "New" | "Reviewing";

type FakeReceipt = {
  actionId: string;
  adminEmail: string;
  appliedValue: string;
  auditReference: string;
  createdAt: number;
  handlerId: string;
  id: string;
  previousValue: string;
  recommendationReference: string;
  recordId: string;
  rollbackAuditReference: string | null;
  rollbackAvailable: number;
  rolledBackAt: number | null;
  sectionId: string;
};

type FakeAudit = {
  createdAt: number;
  email: string;
  eventType: string;
  id: string;
  reason: string;
};

type FakeState = {
  audits: Map<string, FakeAudit>;
  incidentFreezeActive: boolean;
  receipts: Map<string, FakeReceipt>;
  reports: Map<string, ErrorReportStatus>;
  settings: Map<string, string>;
  settingsEvents: Set<string>;
};

class AdminAIActionFakeD1 {
  activateIncidentFreezeBeforeBatch = false;
  failAuditInsert = false;
  failIncidentRead = false;
  proactiveSettingBeforeBatch: boolean | null = null;
  private state: FakeState;

  constructor(reports: Record<string, ErrorReportStatus>, settings: Record<string, boolean> = {}) {
    this.state = {
      audits: new Map(),
      incidentFreezeActive: false,
      receipts: new Map(),
      reports: new Map(Object.entries(reports)),
      settings: new Map(
        Object.entries(settings).map(([email, enabled]) => [email, settingsJson(enabled)])
      ),
      settingsEvents: new Set()
    };
  }

  get audits() {
    return this.state.audits;
  }

  get receipts() {
    return this.state.receipts;
  }

  get settingsEvents() {
    return this.state.settingsEvents;
  }

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: FakeStatement[]) {
    const draft = cloneState(this.state);
    if (this.proactiveSettingBeforeBatch !== null) {
      draft.settings.set(OWNER_EMAIL, settingsJson(this.proactiveSettingBeforeBatch));
      this.proactiveSettingBeforeBatch = null;
    }
    if (this.activateIncidentFreezeBeforeBatch) {
      draft.incidentFreezeActive = true;
      this.activateIncidentFreezeBeforeBatch = false;
    }
    const results: Array<Record<string, unknown>> = [];
    let previousChanges = 0;

    for (const statement of statements) {
      const result = statement.runInBatch(draft, previousChanges);
      previousChanges = Number((result.meta as { changes?: number }).changes || 0);
      results.push(result);
    }

    this.state = draft;
    return results;
  }

  reportStatus(referenceId: string) {
    return this.state.reports.get(referenceId);
  }

  proactiveSuggestionsEnabled(email: string) {
    const value = this.state.settings.get(email);
    return value
      ? Boolean(
          (JSON.parse(value) as { proactiveSuggestionsEnabled: boolean })
            .proactiveSuggestionsEnabled
        )
      : undefined;
  }

  rawSettings(email: string) {
    return this.state.settings.get(email);
  }

  setReportStatus(referenceId: string, status: ErrorReportStatus) {
    this.state.reports.set(referenceId, status);
  }

  setIncidentFreeze(active: boolean) {
    this.state.incidentFreezeActive = active;
  }

  hasIncidentFreeze() {
    if (this.failIncidentRead) throw new Error("forced_incident_read_failure");
    return this.state.incidentFreezeActive;
  }
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly db: AdminAIActionFakeD1,
    private readonly sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes("FROM admin_ai_incidents")) {
      return (this.db.hasIncidentFreeze() ? { id: "incident-active" } : null) as T | null;
    }
    if (this.sql.includes("FROM error_reports")) {
      const referenceId = String(this.params[0] || "");
      const status = this.db.reportStatus(referenceId);
      return (status ? { reference_id: referenceId, status } : null) as T | null;
    }
    if (this.sql.includes("FROM admin_ai_admin_settings")) {
      const email = String(this.params[0] || "");
      const preferencesJson = this.db.rawSettings(email);
      return (
        preferencesJson
          ? {
              admin_email: email,
              clear_safe_memory_requested_at: null,
              preferences_json: preferencesJson,
              updated_at: 1,
              updated_by: email
            }
          : null
      ) as T | null;
    }
    if (this.sql.includes("FROM admin_ai_action_receipts")) {
      const receipt = this.db.receipts.get(String(this.params[0] || ""));
      return (
        receipt
          ? {
              action_id: receipt.actionId,
              admin_email: receipt.adminEmail,
              applied_value: receipt.appliedValue,
              audit_reference: receipt.auditReference,
              created_at: receipt.createdAt,
              handler_id: receipt.handlerId,
              id: receipt.id,
              previous_value: receipt.previousValue,
              recommendation_reference: receipt.recommendationReference,
              record_id: receipt.recordId,
              rollback_audit_reference: receipt.rollbackAuditReference,
              rollback_available: receipt.rollbackAvailable,
              rolled_back_at: receipt.rolledBackAt,
              section_id: receipt.sectionId
            }
          : null
      ) as T | null;
    }
    return null;
  }

  async run() {
    return d1Result(0);
  }

  async all<T>() {
    return { results: [] as T[], success: true };
  }

  runInBatch(state: FakeState, previousChanges: number) {
    if (this.sql.includes("UPDATE error_reports")) {
      const [status, , referenceId, expectedStatus] = this.params.map(String);
      const current = state.reports.get(referenceId);
      if (
        current !== expectedStatus ||
        (this.sql.includes("NOT EXISTS") && state.incidentFreezeActive)
      ) {
        return d1Result(0);
      }
      state.reports.set(referenceId, status as ErrorReportStatus);
      return d1Result(1);
    }

    if (this.sql.includes("UPDATE admin_ai_admin_settings")) {
      const [preferencesJson, , email, expectedJson] = this.params;
      if (state.settings.get(String(email)) !== String(expectedJson)) return d1Result(0);
      state.settings.set(String(email), String(preferencesJson));
      return d1Result(1);
    }

    if (this.sql.includes("INSERT INTO admin_ai_admin_settings")) {
      const [email, preferencesJson] = this.params;
      if (state.settings.has(String(email))) return d1Result(0);
      state.settings.set(String(email), String(preferencesJson));
      return d1Result(1);
    }

    if (this.sql.includes("INSERT INTO admin_ai_settings_events")) {
      if (previousChanges !== 1) return d1Result(0);
      state.settingsEvents.add(String(this.params[0]));
      return d1Result(1);
    }

    if (this.sql.includes("INSERT INTO admin_ai_action_receipts")) {
      if (previousChanges !== 1) return d1Result(0);
      const [
        id,
        auditReference,
        actionId,
        handlerId,
        sectionId,
        adminEmail,
        recordId,
        previousValue,
        appliedValue,
        recommendationReference,
        createdAt
      ] = this.params;
      state.receipts.set(String(id), {
        actionId: String(actionId),
        adminEmail: String(adminEmail),
        appliedValue: String(appliedValue),
        auditReference: String(auditReference),
        createdAt: Number(createdAt),
        handlerId: String(handlerId),
        id: String(id),
        previousValue: String(previousValue),
        recommendationReference: String(recommendationReference),
        recordId: String(recordId),
        rollbackAuditReference: null,
        rollbackAvailable: 1,
        rolledBackAt: null,
        sectionId: String(sectionId)
      });
      return d1Result(1);
    }

    if (this.sql.includes("UPDATE admin_ai_action_receipts")) {
      if (previousChanges !== 1) return d1Result(0);
      const [rolledBackAt, rollbackAuditReference, receiptId, adminEmail] = this.params;
      const receipt = state.receipts.get(String(receiptId));
      if (
        !receipt ||
        receipt.adminEmail !== String(adminEmail) ||
        receipt.rolledBackAt !== null ||
        receipt.rollbackAvailable !== 1
      ) {
        return d1Result(0);
      }
      receipt.rolledBackAt = Number(rolledBackAt);
      receipt.rollbackAuditReference = String(rollbackAuditReference);
      receipt.rollbackAvailable = 0;
      return d1Result(1);
    }

    if (this.sql.includes("INSERT INTO admin_audit_events")) {
      if (this.db.failAuditInsert) throw new Error("forced_audit_failure");
      const [id, receiptId, rollbackAuditReference, email, reason, createdAt] =
        this.params.length === 6
          ? this.params
          : [this.params[0], this.params[1], null, ...this.params.slice(2)];
      if (!state.receipts.has(String(receiptId))) return d1Result(0);
      if (
        rollbackAuditReference !== null &&
        state.receipts.get(String(receiptId))?.rollbackAuditReference !==
          String(rollbackAuditReference)
      ) {
        throw new Error("missing_rollback_receipt_guard");
      }
      state.audits.set(String(id), {
        createdAt: Number(createdAt),
        email: String(email),
        eventType: "ai_action",
        id: String(id),
        reason: String(reason)
      });
      return d1Result(1);
    }

    return d1Result(0);
  }
}

function d1Result(changes: number) {
  return {
    meta: { changes },
    results: [],
    success: true
  };
}

function cloneState(state: FakeState): FakeState {
  return {
    audits: new Map(Array.from(state.audits, ([key, value]) => [key, { ...value }])),
    incidentFreezeActive: state.incidentFreezeActive,
    receipts: new Map(Array.from(state.receipts, ([key, value]) => [key, { ...value }])),
    reports: new Map(state.reports),
    settings: new Map(state.settings),
    settingsEvents: new Set(state.settingsEvents)
  };
}

function getRegisteredCommand() {
  const command = getAdminAICommand("error-reports.mark-reviewing");
  if (!command) throw new Error("Expected registered error-report action.");
  return command;
}

function getSettingsCommand() {
  const command = getAdminAICommand("settings.update-proactive-suggestions");
  if (!command) throw new Error("Expected registered settings action.");
  return command;
}

function getShopRetryCommand() {
  return {
    approvalLevel: 2,
    auditLogEnabled: true,
    confirmationRequired: true,
    description:
      "Retry one permission-visible paid Shop order through the existing protected publish path.",
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
    id: "shop.retry-publish",
    inputSchema: { orderId: "string" },
    kind: "registered-action",
    label: "Retry paid-order publish",
    requiredPermissions: ["shop.recovery"],
    responseHandlerId: "registered-action",
    rollback: "not-available",
    sectionId: "shop",
    successMessage: "Paid Shop order published",
    type: "write"
  } as unknown as AdminAICommand;
}

const SUPPORT_DEFAULTS_BEFORE = {
  supportEmail: "support@ywcoach.com",
  supportMessage: "Contact our support team for help with this step.",
  supportName: "Yours Wellness Support",
  supportPhone: "+919999999999",
  supportWhatsapp: "https://wa.me/919999999999"
};

const SUPPORT_DEFAULTS_AFTER = {
  ...SUPPORT_DEFAULTS_BEFORE,
  supportMessage: "Contact our priority support team for help with this paid order."
};

function getSupportDefaultsCommand() {
  return {
    approvalLevel: 2,
    auditLogEnabled: true,
    confirmationRequired: true,
    description:
      "Update one validated support-default snapshot after exact before-and-after review.",
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
    id: "settings.update-support-defaults",
    inputSchema: {
      currentValue: "string",
      proposedValue: "string",
      settingKey: "string"
    },
    kind: "registered-action",
    label: "Update support defaults",
    requiredPermissions: ["settings.support"],
    responseHandlerId: "registered-action",
    rollback: "available-after-persist",
    sectionId: "settings",
    successMessage: "Support defaults updated",
    type: "write"
  } as unknown as AdminAICommand;
}

class SupportDefaultsActionFakeD1 {
  failAuditInsert = false;
  failRollbackReceiptGuard = false;
  private state = {
    audits: new Map<string, FakeAudit>(),
    defaults: { ...SUPPORT_DEFAULTS_BEFORE },
    hasDefaultsRow: true,
    receipts: new Map<string, FakeReceipt>(),
    updatedAt: 1,
    updatedBy: OWNER_EMAIL
  };

  constructor(hasDefaultsRow = true) {
    this.state.hasDefaultsRow = hasDefaultsRow;
  }

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new SupportDefaultsActionStatement(this, sql);
  }

  async batch(statements: SupportDefaultsActionStatement[]) {
    const snapshot = {
      audits: new Map(Array.from(this.state.audits, ([key, value]) => [key, { ...value }])),
      defaults: { ...this.state.defaults },
      hasDefaultsRow: this.state.hasDefaultsRow,
      receipts: new Map(Array.from(this.state.receipts, ([key, value]) => [key, { ...value }])),
      updatedAt: this.state.updatedAt,
      updatedBy: this.state.updatedBy
    };
    const results = [];
    let previousChanges = 0;
    for (const statement of statements) {
      const result = statement.runInBatch(snapshot, previousChanges);
      results.push(result);
      previousChanges = Number(result.meta.changes);
    }
    this.state = snapshot;
    return results;
  }

  defaults() {
    return { ...this.state.defaults };
  }

  setDefaults(defaults: typeof SUPPORT_DEFAULTS_BEFORE) {
    this.state.defaults = { ...defaults };
  }

  receiptAvailable(receiptId: string) {
    return this.state.receipts.get(receiptId)?.rollbackAvailable === 1;
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes("from admin_ai_incidents")) return null;
    if (sql.includes("from admin_support_defaults")) {
      if (!this.state.hasDefaultsRow) return null;
      return {
        support_email: this.state.defaults.supportEmail,
        support_message: this.state.defaults.supportMessage,
        support_name: this.state.defaults.supportName,
        support_phone: this.state.defaults.supportPhone,
        support_whatsapp: this.state.defaults.supportWhatsapp,
        updated_at: this.state.updatedAt,
        updated_by: this.state.updatedBy
      };
    }
    if (sql.includes("from admin_ai_action_receipts")) {
      const receipt = this.state.receipts.get(String(values[0]));
      return receipt
        ? {
            action_id: receipt.actionId,
            admin_email: receipt.adminEmail,
            applied_value: receipt.appliedValue,
            audit_reference: receipt.auditReference,
            created_at: receipt.createdAt,
            handler_id: receipt.handlerId,
            id: receipt.id,
            previous_value: receipt.previousValue,
            recommendation_reference: receipt.recommendationReference,
            record_id: receipt.recordId,
            rollback_audit_reference: receipt.rollbackAuditReference,
            rollback_available: receipt.rollbackAvailable,
            rolled_back_at: receipt.rolledBackAt,
            section_id: receipt.sectionId
          }
        : null;
    }
    return null;
  }

  run(sql: string) {
    if (sql.startsWith("create ") || sql.startsWith("alter ")) return d1Result(0);
    return d1Result(0);
  }

  runBatch(
    sql: string,
    values: unknown[],
    state: {
      audits: Map<string, FakeAudit>;
      defaults: typeof SUPPORT_DEFAULTS_BEFORE;
      hasDefaultsRow: boolean;
      receipts: Map<string, FakeReceipt>;
      updatedAt: number;
      updatedBy: string;
    },
    previousChanges: number
  ) {
    if (sql.startsWith("update admin_support_defaults")) {
      const isRollback = sql.includes("support_name = case");
      const [
        supportName,
        supportEmail,
        supportPhone,
        supportWhatsapp,
        supportMessage,
        updatedAt,
        updatedBy,
        expectedName,
        expectedEmail,
        expectedPhone,
        expectedWhatsapp,
        expectedMessage
      ] = values;
      const rollbackReceipt = isRollback ? state.receipts.get(String(values[12])) : null;
      if (
        (isRollback &&
          (previousChanges !== 1 ||
            rollbackReceipt?.rollbackAuditReference !== String(values[13]) ||
            rollbackReceipt.rollbackAvailable !== 0)) ||
        state.defaults.supportName !== String(expectedName) ||
        state.defaults.supportEmail !== String(expectedEmail) ||
        state.defaults.supportPhone !== String(expectedPhone) ||
        state.defaults.supportWhatsapp !== String(expectedWhatsapp) ||
        state.defaults.supportMessage !== String(expectedMessage)
      ) {
        if (isRollback) throw new Error("support_defaults_not_null_guard");
        return d1Result(0);
      }
      state.defaults = {
        supportEmail: String(supportEmail),
        supportMessage: String(supportMessage),
        supportName: String(supportName),
        supportPhone: String(supportPhone),
        supportWhatsapp: String(supportWhatsapp)
      };
      state.updatedAt = Number(updatedAt);
      state.updatedBy = String(updatedBy);
      state.hasDefaultsRow = true;
      return d1Result(1);
    }
    if (sql.startsWith("insert into admin_support_defaults")) {
      if (state.hasDefaultsRow) return d1Result(0);
      const [
        supportName,
        supportEmail,
        supportPhone,
        supportWhatsapp,
        supportMessage,
        updatedAt,
        updatedBy
      ] = values;
      state.defaults = {
        supportEmail: String(supportEmail),
        supportMessage: String(supportMessage),
        supportName: String(supportName),
        supportPhone: String(supportPhone),
        supportWhatsapp: String(supportWhatsapp)
      };
      state.hasDefaultsRow = true;
      state.updatedAt = Number(updatedAt);
      state.updatedBy = String(updatedBy);
      return d1Result(1);
    }
    if (sql.startsWith("insert into admin_ai_action_receipts")) {
      if (previousChanges !== 1) return d1Result(0);
      const [
        id,
        auditReference,
        actionId,
        handlerId,
        sectionId,
        adminEmail,
        recordId,
        previousValue,
        appliedValue,
        recommendationReference,
        createdAt
      ] = values;
      state.receipts.set(String(id), {
        actionId: String(actionId),
        adminEmail: String(adminEmail),
        appliedValue: String(appliedValue),
        auditReference: String(auditReference),
        createdAt: Number(createdAt),
        handlerId: String(handlerId),
        id: String(id),
        previousValue: String(previousValue),
        recommendationReference: String(recommendationReference),
        recordId: String(recordId),
        rollbackAuditReference: null,
        rollbackAvailable: 1,
        rolledBackAt: null,
        sectionId: String(sectionId)
      });
      return d1Result(1);
    }
    if (sql.startsWith("update admin_ai_action_receipts")) {
      if (this.failRollbackReceiptGuard) return d1Result(0);
      const [
        rolledBackAt,
        rollbackAuditReference,
        receiptId,
        adminEmail,
        handlerId,
        recordId,
        appliedValue
      ] = values;
      const receipt = state.receipts.get(String(receiptId));
      if (
        !receipt ||
        receipt.adminEmail !== String(adminEmail) ||
        receipt.handlerId !== String(handlerId) ||
        receipt.recordId !== String(recordId) ||
        receipt.appliedValue !== String(appliedValue) ||
        receipt.rolledBackAt !== null ||
        receipt.rollbackAvailable !== 1
      ) {
        return d1Result(0);
      }
      receipt.rolledBackAt = Number(rolledBackAt);
      receipt.rollbackAuditReference = String(rollbackAuditReference);
      receipt.rollbackAvailable = 0;
      return d1Result(1);
    }
    if (sql.startsWith("insert into admin_audit_events")) {
      if (this.failAuditInsert) throw new Error("forced_audit_failure");
      const rollback = sql.includes("case when changes() = 1");
      if (rollback && previousChanges !== 1) throw new Error("audit_event_type_not_null_guard");
      const id = String(values[0]);
      const receiptId = rollback ? "" : String(values[1]);
      const email = String(values[rollback ? 1 : 2]);
      const reason = String(values[rollback ? 2 : 3]);
      const createdAt = Number(values[rollback ? 3 : 4]);
      if (!rollback && !state.receipts.has(receiptId)) {
        return d1Result(0);
      }
      state.audits.set(id, {
        createdAt,
        email,
        eventType: "ai_action",
        id,
        reason
      });
      return d1Result(1);
    }
    return d1Result(0);
  }
}

class SupportDefaultsActionStatement {
  private values: unknown[] = [];
  private readonly sql: string;

  constructor(
    private readonly db: SupportDefaultsActionFakeD1,
    sql: string
  ) {
    this.sql = sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql, this.values) as T | null;
  }

  async all<T>() {
    return { results: [] as T[], success: true };
  }

  async run() {
    return this.db.run(this.sql);
  }

  runInBatch(
    state: Parameters<SupportDefaultsActionFakeD1["runBatch"]>[2],
    previousChanges: number
  ) {
    return this.db.runBatch(this.sql, this.values, state, previousChanges);
  }
}

class ShopPaidRetryFakeD1 {
  failCompletionAuditUpdate = false;
  private audits = new Map<string, { email: string; reason: string }>();
  private coachSite: Record<string, unknown> | null = null;
  private order: Record<string, unknown> = {
    builder_json: JSON.stringify({
      coachEmail: "paid@example.com",
      coachName: "Paid Coach",
      coachPhone: "+919999999999",
      location: "Mumbai",
      niche: "Wellness",
      orderId: "SHOP-PAID-1",
      selectedThemeId: "canonical-coach-site-template",
      slug: "paid-coach",
      status: "publish_failed"
    }),
    client_access_key: "client-access-key",
    coach_email: "paid@example.com",
    coach_name: "Paid Coach",
    coach_phone: "+919999999999",
    contact_link: "https://wa.me/919999999999",
    content_json: "{}",
    created_at: 1,
    id: "shop-site-paid-coach",
    idempotency_key: "idem-shop-paid-1",
    issue_status: "Publish failed after payment verification.",
    location: "Mumbai",
    locked_at: null,
    niche: "Wellness",
    order_id: "SHOP-PAID-1",
    payment_date: 1,
    payment_reference: "pay_1",
    payment_status: "paid",
    public_url: "",
    published_at: null,
    retry_count: 1,
    selected_theme_id: "canonical-coach-site-template",
    site_status: "publish_failed",
    slug: "paid-coach",
    updated_at: 1,
    workflow_stage: "publish_failed"
  };
  private receipts = new Map<
    string,
    {
      adminEmail: string;
      appliedValue: string;
      auditReference: string;
      id: string;
    }
  >();

  asD1() {
    return this as unknown as D1Database;
  }

  prepare(sql: string) {
    return new ShopPaidRetryStatement(this, sql);
  }

  async batch(statements: ShopPaidRetryStatement[]) {
    const snapshot = {
      audits: new Map(Array.from(this.audits, ([key, value]) => [key, { ...value }])),
      receipts: new Map(Array.from(this.receipts, ([key, value]) => [key, { ...value }]))
    };
    const results = [];
    let previousChanges = 0;
    for (const statement of statements) {
      const result = statement.runInBatch(snapshot, previousChanges);
      results.push(result);
      previousChanges = Number(result.meta.changes);
    }
    this.audits = snapshot.audits;
    this.receipts = snapshot.receipts;
    return results;
  }

  orderState() {
    return {
      paymentStatus: String(this.order.payment_status),
      siteStatus: String(this.order.site_status)
    };
  }

  receiptCount() {
    return this.receipts.size;
  }

  receiptValue() {
    return [...this.receipts.values()][0]?.appliedValue || null;
  }

  completedAuditCount() {
    return [...this.audits.values()].filter((audit) =>
      audit.reason.includes("outcome:completed_verified")
    ).length;
  }

  first(sql: string, values: unknown[]) {
    if (sql.includes("from admin_ai_incidents")) return null;
    if (sql.includes("from shop_sites") && sql.includes("where order_id")) {
      return String(values[0]) === this.order.order_id ? { ...this.order } : null;
    }
    if (sql.includes("from coach_sites") && sql.includes("where slug")) {
      return this.coachSite && String(values[0]) === this.coachSite.slug
        ? { ...this.coachSite }
        : null;
    }
    if (sql.includes("from coach_sites") && sql.includes("where id = ?1 or slug = ?2")) {
      return null;
    }
    return null;
  }

  all(sql: string) {
    if (sql.includes("from coach_sites")) return [];
    return [];
  }

  run(sql: string, values: unknown[]) {
    if (sql.startsWith("create ") || sql.startsWith("alter ")) return d1Result(0);
    if (sql.startsWith("update shop_sites") && sql.includes("admin_retry_publish")) {
      if (
        String(values[1]) !== this.order.order_id ||
        this.order.site_status !== "publish_failed" ||
        !["paid", "publishing"].includes(String(this.order.payment_status))
      ) {
        return d1Result(0);
      }
      Object.assign(this.order, {
        issue_status: "",
        site_status: "publishing",
        updated_at: values[0],
        workflow_stage: "admin_retry_publish"
      });
      return d1Result(1);
    }
    if (sql.startsWith("insert into coach_sites")) {
      this.coachSite = {
        analytics_json: values[24] || "{}",
        archived_at: values[28] || null,
        bio: values[7] || "",
        coach_email: values[9] || "",
        coach_id: values[1] || "",
        coach_name: values[2] || "",
        coach_phone: values[10] || "",
        content_json: values[23] || "{}",
        created_at: values[25] || 1,
        created_by: values[29] || OWNER_EMAIL,
        existing_paid_funnel_url: values[15] || "",
        google_form_url: values[16] || "",
        hero_media_type: values[17] || "image",
        id: values[0],
        location: values[6] || "",
        logo_url: values[13] || "",
        niche: values[5] || "",
        paid_funnel_context: values[21] || "",
        photo_url: values[12] || "",
        public_url: values[18] || `/coach/${String(values[3])}`,
        published_at: values[27] || 1,
        register_button_text: values[19] || "Register Now",
        selected_theme_id: values[20] || "canonical-coach-site-template",
        slug: values[3],
        status: values[4],
        support_text: values[22] || "",
        updated_at: values[26] || 1,
        updated_by: values[30] || OWNER_EMAIL,
        video_url: values[14] || "",
        vision: values[8] || "",
        whatsapp_link: values[11] || ""
      };
      return d1Result(1);
    }
    if (sql.startsWith("update shop_sites") && sql.includes("published_verified")) {
      if (String(values[2]) !== this.order.order_id) return d1Result(0);
      Object.assign(this.order, {
        locked_at: values[1],
        payment_status: "published",
        public_url: values[0],
        published_at: values[1],
        site_status: "published",
        updated_at: values[1],
        workflow_stage: "published_verified"
      });
      return d1Result(1);
    }
    return d1Result(0);
  }

  runBatch(
    sql: string,
    values: unknown[],
    state: {
      audits: Map<string, { email: string; reason: string }>;
      receipts: Map<
        string,
        { adminEmail: string; appliedValue: string; auditReference: string; id: string }
      >;
    },
    previousChanges: number
  ) {
    if (sql.startsWith("insert into admin_ai_action_receipts")) {
      const [id, auditReference, , , , adminEmail, , , appliedValue] = values;
      state.receipts.set(String(id), {
        adminEmail: String(adminEmail),
        appliedValue: String(appliedValue),
        auditReference: String(auditReference),
        id: String(id)
      });
      return d1Result(1);
    }
    if (sql.startsWith("insert into admin_audit_events")) {
      const [id, receiptId, email, reason] = values;
      if (!state.receipts.has(String(receiptId))) return d1Result(0);
      state.audits.set(String(id), { email: String(email), reason: String(reason) });
      return d1Result(1);
    }
    if (sql.startsWith("update admin_audit_events")) {
      if (this.failCompletionAuditUpdate) return d1Result(0);
      const [reason, auditReference, email, expectedReason, receiptId] = values;
      const audit = state.audits.get(String(auditReference));
      const receipt = state.receipts.get(String(receiptId));
      if (
        !audit ||
        audit.email !== String(email) ||
        audit.reason !== String(expectedReason) ||
        !receipt ||
        receipt.adminEmail !== String(email) ||
        receipt.appliedValue !== "retry_requested"
      ) {
        return d1Result(0);
      }
      audit.reason = String(reason);
      return d1Result(1);
    }
    if (sql.startsWith("update admin_ai_action_receipts")) {
      const [appliedValue, receiptId, adminEmail, auditReference, completedReason] = values;
      const receipt = state.receipts.get(String(receiptId));
      const audit = state.audits.get(String(auditReference));
      if (
        previousChanges !== 1 ||
        !receipt ||
        receipt.adminEmail !== String(adminEmail) ||
        receipt.appliedValue !== "retry_requested" ||
        !audit ||
        audit.email !== String(adminEmail) ||
        audit.reason !== String(completedReason)
      ) {
        throw new Error("shop_receipt_applied_value_not_null_guard");
      }
      receipt.appliedValue = String(appliedValue);
      return d1Result(1);
    }
    return d1Result(0);
  }
}

class ShopPaidRetryStatement {
  private values: unknown[] = [];
  private readonly sql: string;

  constructor(
    private readonly db: ShopPaidRetryFakeD1,
    sql: string
  ) {
    this.sql = sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql, this.values) as T | null;
  }

  async all<T>() {
    return { results: this.db.all(this.sql) as T[], success: true };
  }

  async run() {
    return this.db.run(this.sql, this.values);
  }

  runInBatch(state: Parameters<ShopPaidRetryFakeD1["runBatch"]>[2], previousChanges: number) {
    return this.db.runBatch(this.sql, this.values, state, previousChanges);
  }
}

function settingsJson(proactiveSuggestionsEnabled: boolean) {
  return JSON.stringify({
    aiPillEnabled: true,
    dailyBriefingEnabled: false,
    memoryEnabled: true,
    notificationPreference: "in-app",
    preferredLanguage: "en",
    proactiveSuggestionsEnabled,
    reportFormat: "markdown",
    responseLength: "balanced"
  });
}

function createContext(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: ["Mark selected report Reviewing"],
    currentRoute: "/admin/dashboard?view=error-reports",
    dataFreshness: "Updated less than a minute ago",
    dateRange: "Current view",
    emptyState: false,
    entities: [
      {
        id: "ERR-1",
        label: "ERR-1",
        matchReason: "Selected error report",
        module: "error-reports",
        route: "/admin/dashboard?view=error-reports&referenceId=ERR-1",
        searchableText: "ERR-1 New",
        source: "/api/admin/error-reports",
        status: "Status / New",
        updatedAt: "2026-07-21T00:00:00.000Z"
      }
    ],
    errors: [],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: ["/api/admin/error-reports", "/api/admin/ai-actions"],
      registeredActions: [],
      visibleDataSummary: [],
      warnings: []
    },
    knowledge: [],
    lastUpdated: "2026-07-21T00:00:00.000Z",
    loadingState: false,
    permissions: ["error_reports.view", "error_reports.mark_status"],
    relatedAPIs: ["/api/admin/error-reports", "/api/admin/ai-actions"],
    registeredActions: [],
    sectionId: "error-reports",
    sectionName: "Reports",
    selectedRows: ["ERR-1"],
    userRole: "owner",
    visibleDataSummary: [],
    warnings: []
  };
}

async function createAdminTestSession() {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSessionPayload = {
    email: OWNER_EMAIL,
    expiresAt: now + 8 * 60 * 60,
    issuedAt: now,
    otpVerified: true,
    source: "admin_auth"
  };
  const cookie = await createAdminSessionCookie({
    email: OWNER_EMAIL,
    env: authEnv,
    nowSeconds: now,
    rememberDevice: false,
    secure: false
  });
  const csrfToken = await createAdminCsrfToken({ env: authEnv, session });
  if (!cookie || !csrfToken) throw new Error("Expected admin session credentials.");
  return { cookie: cookie.split(";")[0], csrfToken };
}

function actionRequest(
  session: { cookie: string; csrfToken: string },
  body: Record<string, unknown>
) {
  return new Request("http://127.0.0.1:4802/api/admin/ai-actions", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: session.cookie,
      host: "127.0.0.1:4802",
      origin: "http://127.0.0.1:4802",
      "x-yw-admin-csrf": session.csrfToken
    },
    method: "POST"
  });
}
