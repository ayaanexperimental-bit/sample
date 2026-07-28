import { expect, test } from "@playwright/test";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import {
  ADMIN_AI_SETTINGS_FIELD_DEFINITIONS,
  buildAdminAIOperationalContext
} from "../../lib/admin-ai/adminAIOperationalContext";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import { runAdminAINaturalLanguageQuery } from "../../lib/admin-ai/adminAIOrchestrator";
import {
  adminAIRegistry,
  getAdminAICommand,
  type AdminAICommand
} from "../../lib/admin-ai/adminAIRegistry";
import { runAdminAICommand } from "../../lib/admin-ai/adminAIService";

const NOW = "2026-07-22T08:00:00.000Z";

test.describe("Admin AI settings capabilities and exact quick actions", () => {
  test("carries only allowlisted setting-presence signals into operational context", () => {
    const context = buildAdminAIOperationalContext({
      actionActivity: [],
      backupData: null,
      backupStatus: "ready",
      calculatedAt: NOW,
      coachSites: [],
      errorReports: [],
      profile: { email: "owner@example.com", isOwner: true, permissions: [] },
      settingsSnapshot: {
        configuredFieldCount: 3,
        fieldCount: 5,
        fieldPresence: {
          supportEmail: true,
          supportMessage: false,
          supportName: true,
          supportPhone: false,
          supportWhatsapp: true
        },
        status: "idle"
      },
      settingsStatus: "ready",
      usersData: null,
      usersStatus: "ready"
    });
    const settings = context.entities.filter(({ module }) => module === "settings");

    expect(ADMIN_AI_SETTINGS_FIELD_DEFINITIONS.map(({ key }) => key)).toEqual([
      "supportName",
      "supportEmail",
      "supportPhone",
      "supportWhatsapp",
      "supportMessage"
    ]);
    expect(settings.map(({ id, status }) => [id, status])).toEqual([
      ["settings:configuration", "ready"],
      ["settings:supportName", "configured"],
      ["settings:supportEmail", "configured"],
      ["settings:supportPhone", "missing-optional"],
      ["settings:supportWhatsapp", "configured"],
      ["settings:supportMessage", "missing-required"]
    ]);
    expect(JSON.stringify(settings)).not.toMatch(/support@example\.com|\+1555|wa\.me/i);
  });

  test("explains effects and performs honest presence-only settings analysis", () => {
    const context = settingsContext();
    const explain = run("settings.explain-setting", context);
    const risk = run("settings.analyze-risk", context);
    const validation = run("settings.validate-configuration", context);
    const missing = run("settings.find-required-configuration", context);
    const safeValidation = run("settings.safe-validation", context);
    const preparedChange = run("settings.prepare-change", context);

    expect(explain).toMatchObject({ state: "ready", title: "Settings explained" });
    expect(explain.items).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Support email: configured\./),
        expect.stringContaining("public support email"),
        expect.stringMatching(/^Support message: missing required\./),
        expect.stringContaining("fallback help copy")
      ])
    );
    expect(risk.title).toBe("Settings risk review");
    expect(risk.items).toEqual(
      expect.arrayContaining([
        "Support message is missing; public error states may lack the approved fallback help copy.",
        expect.stringContaining("Support WhatsApp URL")
      ])
    );
    expect(validation).toMatchObject({
      state: "ready",
      title: "Settings validation found issues"
    });
    expect(validation.items).toContain("Missing required setting: Support message.");
    expect(validation.body).toContain("presence-only");
    expect(missing).toMatchObject({
      items: ["Support message"],
      state: "ready",
      title: "Required configuration is missing"
    });
    expect(safeValidation.items).toEqual(validation.items);
    expect(preparedChange.title).toBe("Settings risk review");
    expect(JSON.stringify({ explain, risk, validation, missing })).not.toContain("private-value");
  });

  test("registers and runs exact production quick actions", () => {
    for (const section of Object.values(adminAIRegistry)) {
      expect(section.commands).toContainEqual(
        expect.objectContaining({
          id: `${section.id}.explain-data`,
          label: "Explain this data",
          type: "read"
        })
      );
      expect(section.commands).toContainEqual(
        expect.objectContaining({
          id: `${section.id}.safe-validation`,
          label: "Run safe validation",
          type: "read"
        })
      );
    }
    expect(adminAIRegistry.settings.commands).toContainEqual(
      expect.objectContaining({ id: "settings.explain-setting", label: "Explain this setting" })
    );
    expect(adminAIRegistry["coach-analytics"].commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coach-analytics.review-selected-coach",
          label: "Review selected coach"
        }),
        expect.objectContaining({
          id: "coach-analytics.copyable-coach-report",
          label: "Create copyable coach report"
        })
      ])
    );

    const analytics = analyticsContext();
    const explanation = run("coach-analytics.explain-data", analytics);
    const review = run("coach-analytics.review-selected-coach", analytics);
    const report = run("coach-analytics.copyable-coach-report", analytics);

    expect(explanation).toMatchObject({ state: "ready", title: "Coach Analytics data explained" });
    expect(review).toMatchObject({
      items: ["Selected Coach: needs-review. Selected coach conversion is below target."],
      state: "ready",
      title: "Selected coach review"
    });
    expect(JSON.stringify(review)).not.toContain("Other Coach");
    expect(report.report?.keyMetrics).toEqual(["Selected Coach: needs-review (analytics-events)"]);
    expect(JSON.stringify(report.report)).not.toContain("Other Coach");
  });

  test("surfaces risky-role evidence and target-specific suspend/remove impact", () => {
    const context: AdminAISectionContext = {
      ...baseContext(),
      currentRoute: "/admin/dashboard?view=admin-users",
      entities: [
        {
          id: "admin-risk",
          label: "Website Creator admin",
          matchReason: "Selected active admin account.",
          module: "admin-users",
          route: "/admin/dashboard?view=admin-users",
          searchableText: "selected active website creator admin",
          source: "admin-users",
          status: "active",
          updatedAt: NOW
        }
      ],
      intelligence: {
        analyticsPoints: [],
        builderInspection: null,
        errorReports: [],
        healthEvidence: [
          {
            affectedEntity: "Website Creator role",
            category: "unusual-permission-changes",
            directRoute: "/admin/dashboard?view=admin-users",
            evidence: [
              {
                observedAt: NOW,
                source: "admin-users",
                summary: "Website Creator role includes owner-only permissions: Manage admin users."
              }
            ],
            firstDetected: NOW,
            id: "risky-role-owner-only",
            impact: "Owner-only controls conflict with least-privilege access.",
            lastDetected: NOW,
            module: "admin-users",
            recurrenceCount: 1,
            safeActionId: "admin-users.find-problems",
            severity: "high",
            suggestedNextStep: "Review the role assignment in Admin Users.",
            whatHappened: "Risky role assignment detected"
          }
        ],
        healthScore: { calculatedAt: NOW, dimensions: [] },
        table: null
      },
      isOwner: true,
      permissions: ["admin_users.manage"],
      registeredActions: [
        actionView("admin-users.prepare-suspend-admin"),
        actionView("admin-users.prepare-delete-admin")
      ],
      sectionId: "admin-users",
      sectionName: "Admin Users",
      selectedRows: ["admin-risk"]
    };

    const risk = run("admin-users.check-permission-risk", context);
    const impact = run("admin-users.explain-suspend-remove", context);
    const suspendPlan = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Suspend the selected admin",
      scope: "selection"
    });
    const removalPlan = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Remove the selected admin",
      scope: "selection"
    });

    expect(risk).toMatchObject({ state: "ready", title: "Admin permission risk review" });
    expect(risk.items).toContain(
      "Website Creator role includes owner-only permissions: Manage admin users."
    );
    expect(impact.items).toEqual(
      expect.arrayContaining([
        "Target: Website Creator admin (active).",
        expect.stringContaining("revokes active Admin sessions"),
        expect.stringContaining("root-owner protection")
      ])
    );
    expect(suspendPlan.plan?.risks).toContain(
      "Suspension impact for Website Creator admin: Admin access is disabled and active sessions must be revoked after protected confirmation."
    );
    expect(removalPlan.plan?.risks).toContain(
      "Removal impact for Website Creator admin: Admin access is removed; root-owner and last-owner protections remain authoritative."
    );
  });
});

function run(id: string, context: AdminAISectionContext) {
  return runAdminAICommand(command(id), context, DEFAULT_ADMIN_AI_PREFERENCES);
}

function command(id: string): AdminAICommand {
  const match = getAdminAICommand(id);
  if (!match) throw new Error(`Missing command ${id}`);
  return match;
}

function actionView(id: string) {
  const action = command(id);
  return {
    id: action.id,
    label: action.label,
    relatedAPI: null,
    requiredPermissions: action.requiredPermissions || [],
    searchText: `${action.id} ${action.label} ${action.description}`,
    type: action.type
  };
}

function settingsContext(): AdminAISectionContext {
  const fields = [
    ["supportName", "Support name", "configured"],
    ["supportEmail", "Support email", "configured"],
    ["supportPhone", "Support phone", "missing-optional"],
    ["supportWhatsapp", "Support WhatsApp URL", "configured"],
    ["supportMessage", "Support message", "missing-required"]
  ] as const;

  return {
    ...baseContext(),
    currentRoute: "/admin/dashboard?view=settings",
    entities: fields.map(([key, label, status]) => ({
      id: `settings:${key}`,
      label,
      matchReason: `${label} is ${status.replace("-", " ")}; values remain private.`,
      module: "settings" as const,
      route: "/admin/dashboard?view=settings",
      searchableText: `settings support defaults ${key} ${status}`,
      source: "settings",
      status,
      updatedAt: NOW
    })),
    filters: { settingKey: "supportEmail" },
    permissions: ["settings.view", "settings.support"],
    relatedAPIs: ["/api/admin/support-defaults"],
    sectionId: "settings",
    sectionName: "Settings",
    selectedRows: ["settings:supportEmail"],
    visibleDataSummary: [
      { label: "Admin role", source: "admin-session", value: "Owner" },
      { label: "Settings source", source: "admin-session", value: "ready" }
    ]
  };
}

function analyticsContext(): AdminAISectionContext {
  return {
    ...baseContext(),
    availableActions: ["Review selected coach", "Create copyable coach report"],
    currentRoute: "/admin/dashboard?view=coach-analytics",
    entities: [
      {
        id: "coach-1",
        label: "Selected Coach",
        matchReason: "Selected coach conversion is below target.",
        module: "coach-analytics",
        route: "/admin/dashboard?view=coach-analytics&coach=coach-1",
        searchableText: "selected coach needs review",
        source: "analytics-events",
        status: "needs-review",
        updatedAt: NOW
      },
      {
        id: "coach-2",
        label: "Other Coach",
        matchReason: "Other coach is healthy.",
        module: "coach-analytics",
        route: "/admin/dashboard?view=coach-analytics&coach=coach-2",
        searchableText: "other coach healthy",
        source: "analytics-events",
        status: "healthy",
        updatedAt: NOW
      }
    ],
    filters: { status: "needs-review" },
    permissions: ["coach_analytics.view"],
    relatedAPIs: ["/api/admin/analytics-events"],
    sectionId: "coach-analytics",
    sectionName: "Coach Analytics",
    selectedRows: ["coach-1"],
    visibleDataSummary: [{ label: "Platform visits", source: "analytics-events", value: 999 }],
    warnings: ["Selected coach needs conversion review."]
  };
}

function baseContext(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: [],
    currentRoute: "/admin/dashboard",
    dataFreshness: "Current",
    dateRange: "Current view",
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
    lastUpdated: NOW,
    loadingState: false,
    knowledge: [],
    permissions: [],
    relatedAPIs: [],
    registeredActions: [],
    sectionId: "overview",
    sectionName: "Admin Overview",
    selectedRows: [],
    userRole: "owner",
    visibleDataSummary: [],
    warnings: []
  };
}
