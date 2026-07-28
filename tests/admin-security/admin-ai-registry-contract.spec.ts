import { expect, test } from "@playwright/test";
import { adminV2ViewTitles } from "../../lib/admin-v2-access";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import {
  ADMIN_AI_SECTION_ALIASES,
  adminAIRegistry,
  getAdminAISectionByAlias,
  globalAdminAICommands,
  type AdminAICommand
} from "../../lib/admin-ai/adminAIRegistry";
import { runAdminAICommand } from "../../lib/admin-ai/adminAIService";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";

test.describe("Admin AI registry contracts", () => {
  test("keeps every native Admin V2 navigation view registered with Copilot", () => {
    expect(Object.keys(adminAIRegistry).sort()).toEqual(Object.keys(adminV2ViewTitles).sort());
  });

  test("registers a context builder and supported report formats for every section", () => {
    for (const section of Object.values(adminAIRegistry)) {
      expect(section.contextBuilder).toBe(section.id);
      expect(section.reportFormats).toEqual(["operations", "summary"]);
      expect(section.commands.some((command) => command.kind === "report")).toBe(true);
    }
  });

  test("resolves required product-language aliases to native Admin V2 sections", () => {
    expect(ADMIN_AI_SECTION_ALIASES).toMatchObject({
      analytics: "coach-analytics",
      payments: "paid-masterclass-settings",
      reports: "error-reports",
      revenue: "paid-masterclass-settings",
      "support defaults": "settings"
    });
    expect(getAdminAISectionByAlias("Analytics")).toBe(adminAIRegistry["coach-analytics"]);
    expect(getAdminAISectionByAlias("Revenue")).toBe(adminAIRegistry["paid-masterclass-settings"]);
    expect(getAdminAISectionByAlias("Support Defaults")).toBe(adminAIRegistry.settings);
  });

  test("registers exact settings and admin-user safety analysis commands", () => {
    expect(adminAIRegistry.settings.commands.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "settings.explain-setting",
        "settings.analyze-risk",
        "settings.validate-configuration",
        "settings.find-required-configuration"
      ])
    );
    expect(adminAIRegistry["admin-users"].commands.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "admin-users.check-permission-risk",
        "admin-users.explain-suspend-remove",
        "admin-users.prepare-suspend-admin"
      ])
    );
    expect(
      adminAIRegistry.settings.commands.find(({ id }) => id === "settings.explain-setting")
    ).toMatchObject({ label: "Explain this setting" });
    expect(
      adminAIRegistry["admin-users"].commands.find(
        ({ id }) => id === "admin-users.prepare-suspend-admin"
      )
    ).toMatchObject({
      approvalLevel: 3,
      confirmationRequired: true,
      otpRequired: true,
      ownerOnly: true,
      type: "dangerous"
    });
  });

  test("gives every section distinct Level 0 report previews and safe validation", () => {
    for (const section of Object.values(adminAIRegistry)) {
      const preview = section.commands.find(({ id }) => id === `${section.id}.preview-report`)!;
      expect(preview).toMatchObject({
        approvalLevel: 0,
        executionContract: { availability: "not-applicable" },
        kind: "report",
        label: "Preview report",
        type: "read"
      });
      expect(preview.confirmationRequired).toBeUndefined();
      expect(preview.handlerId).toBeUndefined();

      const validation = section.commands.find(
        ({ id }) => id === `${section.id}.safe-validation`
      )!;
      expect(validation).toMatchObject({
        approvalLevel: 0,
        executionContract: { availability: "not-applicable" },
        label: "Run safe validation",
        type: "read"
      });
      expect(validation.confirmationRequired).toBeUndefined();
      expect(validation.handlerId).toBeUndefined();
    }
  });

  test("keeps Website Creator draft text preview ephemeral and non-executable", () => {
    const preview = adminAIRegistry["create-coach-site"].commands.find(
      ({ id }) => id === "create-coach-site.preview-draft-text"
    )!;
    expect(preview).toMatchObject({
      approvalLevel: 0,
      executionContract: { availability: "not-applicable" },
      kind: "summarize",
      label: "Preview draft text",
      type: "read"
    });
    expect(preview.confirmationRequired).toBeUndefined();
    expect(preview.handlerId).toBeUndefined();
  });

  test("gives every command an exact response handler and result contract", () => {
    const commands = [
      ...Object.values(adminAIRegistry).flatMap((section) => section.commands),
      ...globalAdminAICommands
    ];
    for (const command of commands) assertCommandContract(command);
  });

  test("keeps sensitive workflows review-only and exposes only bounded mutations", () => {
    const commands = [
      ...Object.values(adminAIRegistry).flatMap((section) => section.commands),
      ...globalAdminAICommands
    ];
    const sensitiveCommands = commands.filter((command) => command.type === "dangerous");
    const executableCommands = commands.filter(
      (command) => command.executionContract.availability === "executable"
    );

    expect(sensitiveCommands.length).toBeGreaterThan(0);
    for (const command of sensitiveCommands) {
      expect(command.executionContract).toMatchObject({
        availability: "review-only",
        maxBatchSize: 0
      });
      expect(command.executionContract.blockedReason).toContain(
        "Direct Copilot execution is disabled"
      );
      expect(command.handlerId).toBeUndefined();
    }

    expect(
      executableCommands.map((command) => ({
        actionId: command.id,
        handlerId: command.handlerId,
        maxBatchSize: command.executionContract.maxBatchSize,
        maxSelectedRecords: command.executionContract.maxSelectedRecords
      }))
    ).toEqual([
      {
        actionId: "shop.retry-publish",
        handlerId: "shop-paid-order-publish-retry",
        maxBatchSize: 1,
        maxSelectedRecords: 1
      },
      {
        actionId: "error-reports.mark-reviewing",
        handlerId: "error-report-status-reviewing",
        maxBatchSize: 1,
        maxSelectedRecords: 1
      },
      {
        actionId: "settings.update-proactive-suggestions",
        handlerId: "settings-proactive-suggestions-update",
        maxBatchSize: 1,
        maxSelectedRecords: 0
      }
    ]);
  });

  test("registers one exact Level 2 non-critical settings executor", () => {
    const settingsActions = adminAIRegistry.settings.commands.filter(
      (command) => command.executionContract.availability === "executable"
    );

    expect(settingsActions).toEqual([
      expect.objectContaining({
        approvalLevel: 2,
        confirmationRequired: true,
        handlerId: "settings-proactive-suggestions-update",
        id: "settings.update-proactive-suggestions",
        inputSchema: {
          currentValue: "boolean",
          proposedValue: "boolean",
          settingKey: "string"
        },
        requiredPermissions: ["settings.support"],
        rollback: "available-after-persist",
        type: "write"
      })
    ]);
  });

  test("honors the selected report format without inventing unsupported fields", () => {
    const command = adminAIRegistry.overview.commands.find(
      (candidate) => candidate.kind === "report"
    )!;
    const operations = runAdminAICommand(command, context(), DEFAULT_ADMIN_AI_PREFERENCES);
    const summary = runAdminAICommand(command, context(), {
      ...DEFAULT_ADMIN_AI_PREFERENCES,
      reportFormat: "summary"
    });

    expect(operations.report?.actionItems).not.toEqual([]);
    expect(operations.report?.recommendations).not.toEqual([]);
    expect(summary.report?.actionItems).toEqual([]);
    expect(summary.report?.recommendations).toEqual([]);
    expect(summary.report?.keyMetrics).toEqual(operations.report?.keyMetrics);
    expect(summary.report?.observations).toEqual(operations.report?.observations);
  });
});

function assertCommandContract(command: AdminAICommand) {
  expect(command.id).not.toBe("");
  expect(command.label).not.toBe("");
  expect(command.description).not.toBe("");
  expect(command.requiredPermissions?.length ?? 0).toBeGreaterThan(0);
  expect(command.auditLogEnabled).toBe(true);
  expect(command.responseHandlerId).toBe(command.kind);
  expect(command.successMessage).toBeTruthy();
  expect(command.failureMessage).toBeTruthy();
  expect(command.inputSchema).toBeTruthy();
  expect(command.executionContract.currentStateLabel).not.toBe("");
  expect(command.executionContract.proposedStateLabel).not.toBe("");
  expect(command.executionContract.issueClassification).not.toBe("");
  expect(command.executionContract.dependencies.length).toBeGreaterThan(0);
  expect(command.executionContract.minSelectedRecords).toBeGreaterThanOrEqual(0);
  expect(command.executionContract.maxSelectedRecords).toBeGreaterThanOrEqual(
    command.executionContract.minSelectedRecords
  );
  expect(command.executionContract.maxBatchSize).toBeGreaterThanOrEqual(0);

  if (command.kind === "registered-action") {
    expect(command.handlerId).toBeTruthy();
  }
}

function context(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: ["Open reports"],
    currentRoute: "/admin/dashboard",
    dataFreshness: "Current",
    dateRange: "July 1-7",
    emptyState: false,
    entities: [],
    errors: [],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: [],
      registeredActions: [],
      visibleDataSummary: [],
      warnings: []
    },
    lastUpdated: "2026-07-21T10:00:00.000Z",
    loadingState: false,
    knowledge: [],
    permissions: ["overview.view"],
    relatedAPIs: ["/api/admin/dashboard/overview"],
    registeredActions: [],
    sectionId: "overview",
    sectionName: "Admin Overview",
    selectedRows: [],
    userRole: "owner",
    visibleDataSummary: [{ label: "Coach sites", source: "coach-sites", value: 4 }],
    warnings: ["One site needs review."]
  };
}
