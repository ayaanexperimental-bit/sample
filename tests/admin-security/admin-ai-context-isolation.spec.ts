import { expect, test } from "@playwright/test";
import { scopeAdminAIContext, type AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import { getAdminAISection } from "../../lib/admin-ai/adminAIRegistry";
import { runAdminAICommand } from "../../lib/admin-ai/adminAIService";

const NOW = "2026-07-21T12:00:00.000Z";

test.describe("Admin AI context isolation and source outages", () => {
  test("removes restricted intelligence from every non-selection scope while preserving permitted facts", () => {
    const context = createRichContext({
      isOwner: false,
      permissions: ["coach_sites.view"],
      userRole: "limited-admin"
    });

    for (const scope of ["page", "module", "global"] as const) {
      const scoped = scopeAdminAIContext(context, scope);

      expect(scoped.analyticsSeries, scope).toEqual([]);
      expect(scoped.intelligence?.analyticsPoints, scope).toEqual([]);
      expect(scoped.intelligence?.errorReports, scope).toEqual([]);
      expect(scoped.intelligence?.builderInspection, scope).toBeNull();
      expect(scoped.intelligence?.healthEvidence, scope).toEqual([
        expect.objectContaining({ id: "health-coach-site", module: "coach-sites" })
      ]);
      const restrictedDimension = scoped.intelligence?.healthScore.dimensions.find(
        ({ dimension }) => dimension === "analytics-reliability"
      );
      if (scope === "global") {
        expect(restrictedDimension, scope).toMatchObject({
          calculation: "",
          exactInputs: [],
          score: null
        });
      } else {
        expect(restrictedDimension, scope).toBeUndefined();
      }
      expect(
        scoped.intelligence?.healthScore.dimensions.find(
          ({ dimension }) => dimension === "site-health"
        ),
        scope
      ).toMatchObject({ score: 100 });
      expect(scoped.intelligence?.table?.tableId, scope).toBe("coach-sites");
      expect(JSON.stringify(scoped), scope).not.toContain("Restricted analytics source");
      expect(JSON.stringify(scoped), scope).not.toContain("ERR-RESTRICTED");
      expect(JSON.stringify(scoped), scope).not.toContain("private builder copy");
    }
  });

  test("keeps the complete intelligence payload for an owner", () => {
    const context = createRichContext({ isOwner: true, permissions: [], userRole: "owner" });
    const scoped = scopeAdminAIContext(context, "global");

    expect(scoped.analyticsSeries).toHaveLength(1);
    expect(scoped.intelligence?.analyticsPoints).toHaveLength(1);
    expect(scoped.intelligence?.errorReports).toHaveLength(1);
    expect(scoped.intelligence?.builderInspection?.copyText).toBe("private builder copy");
    expect(scoped.intelligence?.healthEvidence).toHaveLength(2);
    expect(
      scoped.intelligence?.healthScore.dimensions.find(
        ({ dimension }) => dimension === "analytics-reliability"
      )?.score
    ).toBe(100);
  });

  test("bounds page, module, selection, and global context to relevant records and state", () => {
    const base = createRichContext({ isOwner: true, permissions: [], userRole: "owner" });
    const context: AdminAISectionContext = {
      ...base,
      entities: [
        {
          id: "site-1",
          label: "Visible coach site",
          matchReason: "Coach site status is draft.",
          module: "coach-sites",
          route: "/admin/dashboard?view=coach-sites&coach=site-1",
          searchableText: "visible coach site draft",
          source: "coach-sites",
          status: "draft",
          updatedAt: NOW
        },
        {
          id: "ERR-RESTRICTED",
          label: "Restricted error",
          matchReason: "Restricted error detail.",
          module: "error-reports",
          route: "/admin/dashboard?view=error-reports&report=ERR-RESTRICTED",
          searchableText: "restricted error",
          source: "error-reports",
          status: "high / New",
          updatedAt: NOW
        }
      ],
      errors: ["Coach Sites data is unavailable.", "Error Reports data is unavailable."],
      filters: { query: "visible", status: "draft" },
      globalContext: {
        ...base.globalContext,
        errors: ["Error Reports data is unavailable.", "Shop data is unavailable."]
      },
      selectedRows: ["site-1", "ERR-RESTRICTED"]
    };

    for (const scope of ["page", "module"] as const) {
      const scoped = scopeAdminAIContext(context, scope);
      expect(
        scoped.entities.map(({ id }) => id),
        scope
      ).toEqual(["site-1"]);
      expect(scoped.selectedRows, scope).toEqual(["site-1"]);
      expect(scoped.filters, scope).toEqual({ query: "visible", status: "draft" });
      expect(scoped.errors, scope).toEqual(["Coach Sites data is unavailable."]);
      expect(scoped.intelligence?.errorReports, scope).toEqual([]);
      expect(
        scoped.intelligence?.healthEvidence.map(({ id }) => id),
        scope
      ).toEqual(["health-coach-site"]);
      expect(
        scoped.intelligence?.healthScore.dimensions.map(({ dimension }) => dimension),
        scope
      ).toEqual(["site-health"]);
    }

    const selectedError = scopeAdminAIContext(context, "selection", [
      "ERR-RESTRICTED",
      "ERR-RESTRICTED",
      "unknown"
    ]);
    expect(selectedError.entities.map(({ id }) => id)).toEqual(["ERR-RESTRICTED"]);
    expect(selectedError.selectedRows).toEqual(["ERR-RESTRICTED"]);
    expect(selectedError.filters).toEqual({});
    expect(selectedError.errors).toEqual(["Error Reports data is unavailable."]);
    expect(selectedError.intelligence?.errorReports.map(({ referenceId }) => referenceId)).toEqual([
      "ERR-RESTRICTED"
    ]);
    expect(selectedError.intelligence?.healthEvidence).toEqual([]);
    expect(selectedError.intelligence?.healthScore.dimensions).toEqual([]);
    expect(selectedError.analyticsSeries).toEqual([]);
    expect(selectedError.visibleDataSummary).toEqual([
      { label: "Restricted error", source: "error-reports", value: "high / New" }
    ]);

    const selectedSite = scopeAdminAIContext(context, "selection", ["site-1"]);
    expect(selectedSite.filters).toEqual({ query: "visible", status: "draft" });
    expect(selectedSite.errors).toEqual(["Coach Sites data is unavailable."]);
    expect(selectedSite.intelligence?.errorReports).toEqual([]);
    expect(selectedSite.intelligence?.healthEvidence.map(({ id }) => id)).toEqual([
      "health-coach-site"
    ]);
    expect(
      selectedSite.intelligence?.healthScore.dimensions.map(({ dimension }) => dimension)
    ).toEqual(["site-health"]);

    const global = scopeAdminAIContext(context, "global");
    expect(global.entities.map(({ id }) => id)).toEqual(["site-1", "ERR-RESTRICTED"]);
    expect(global.selectedRows).toEqual([]);
    expect(global.filters).toEqual({});
    expect(global.errors).toEqual([
      "Error Reports data is unavailable.",
      "Shop data is unavailable."
    ]);
    expect(global.intelligence?.healthEvidence).toHaveLength(2);
    expect(global.intelligence?.healthScore.dimensions).toHaveLength(2);

    const analyticsPage = scopeAdminAIContext(
      { ...context, sectionId: "coach-analytics", sectionName: "Coach Analytics" },
      "page"
    );
    expect(analyticsPage.intelligence?.healthEvidence.map(({ id }) => id)).toEqual([
      "health-analytics"
    ]);
    expect(
      analyticsPage.intelligence?.healthScore.dimensions.map(({ dimension }) => dimension)
    ).toEqual(["analytics-reliability"]);
  });

  test("returns an honest retryable offline response when a module source is unavailable", () => {
    const context: AdminAISectionContext = {
      ...createRichContext({
        isOwner: false,
        permissions: ["coach_analytics.view"],
        userRole: "analytics-admin"
      }),
      analyticsSeries: [],
      emptyState: true,
      entities: [],
      errors: ["Analytics Events data is unavailable."],
      intelligence: undefined,
      visibleDataSummary: []
    };
    const reportCommand = getAdminAISection("coach-analytics").commands.find(
      ({ responseHandlerId }) => responseHandlerId === "report"
    );
    if (!reportCommand) throw new Error("Expected a Coach Analytics report command.");

    const result = runAdminAICommand(reportCommand, context, DEFAULT_ADMIN_AI_PREFERENCES);

    expect(result).toMatchObject({
      state: "offline-error",
      title: "Coach Analytics source unavailable"
    });
    expect(result.report).toBeUndefined();
    expect(result.body).toContain("cannot produce a reliable result");
    expect(result.body).toContain("Retry");
    expect(result.body).toContain("manual");
    expect(result.items).toContain("Analytics Events data is unavailable.");
    expect(JSON.stringify(result)).not.toContain("Report generated");
  });
});

function createRichContext({
  isOwner,
  permissions,
  userRole
}: {
  isOwner: boolean;
  permissions: string[];
  userRole: string;
}): AdminAISectionContext {
  return {
    analyticsSeries: [{ current: 42, label: "2026-07-21", previous: 21, registerClicks: 7 }],
    availableActions: ["Open coach sites"],
    currentRoute: "/admin/dashboard?view=coach-sites",
    dataFreshness: "Updated less than a minute ago",
    dateRange: "2026-07-21",
    emptyState: false,
    entities: [],
    errors: [],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: ["/api/admin/coach-sites", "/api/admin/analytics-events"],
      registeredActions: [],
      visibleDataSummary: [{ label: "Coach sites", source: "coach-sites", value: 1 }],
      warnings: []
    },
    intelligence: {
      analyticsPoints: [
        {
          bucketEnd: NOW,
          bucketStart: "2026-07-21T11:00:00.000Z",
          currentRegistrationClicks: 7,
          currentVisits: 42,
          previousRegistrationClicks: 3,
          previousVisits: 21,
          source: "Restricted analytics source"
        }
      ],
      anomalyAnalysis: {
        anomalies: [],
        insufficientBaselineCategories: [],
        message: null,
        status: "ready"
      },
      builderInspection: {
        bonusServiceTitles: [],
        copyText: "private builder copy",
        ctaText: "Register",
        faq: [],
        footer: { brandLine: "Brand", privacyNote: "Private", text: "Footer" },
        media: { ready: true },
        missingFields: [],
        mobileContentLength: 20,
        navbarSections: [],
        niche: "wellness",
        previewDigest: "preview",
        productionValidationError: "",
        publicDigest: "public",
        registrationUrl: "https://example.com/register",
        visibleSections: []
      },
      errorReports: [
        {
          affectedEntity: "Restricted operation",
          createdAt: NOW,
          errorCode: "RESTRICTED",
          module: "error-reports",
          referenceId: "ERR-RESTRICTED",
          route: "/api/admin/restricted",
          safeMessage: "Restricted error detail",
          severity: "high",
          sourceFiles: [],
          sourceFilesTrusted: false
        }
      ],
      healthEvidence: [
        {
          affectedEntity: "Restricted analytics source",
          category: "analytics-ingestion-failures",
          directRoute: "/admin/dashboard?view=coach-analytics",
          evidence: [
            {
              observedAt: NOW,
              source: "analytics-events",
              summary: "Restricted analytics source failed.",
              value: 1
            }
          ],
          firstDetected: NOW,
          id: "health-analytics",
          impact: "Analytics are unavailable.",
          lastDetected: NOW,
          module: "analytics-events",
          recurrenceCount: 1,
          severity: "high",
          suggestedNextStep: "Inspect analytics.",
          whatHappened: "Analytics source failed"
        },
        {
          affectedEntity: "Visible coach site",
          category: "missing-registration-links",
          directRoute: "/admin/dashboard?view=coach-sites",
          evidence: [
            {
              observedAt: NOW,
              source: "coach-sites",
              summary: "Visible coach site needs a registration link.",
              value: 1
            }
          ],
          firstDetected: NOW,
          id: "health-coach-site",
          impact: "Registration is blocked.",
          lastDetected: NOW,
          module: "coach-sites",
          recurrenceCount: 1,
          severity: "medium",
          suggestedNextStep: "Add a registration link.",
          whatHappened: "Registration link is missing"
        }
      ],
      healthScore: {
        calculatedAt: NOW,
        dimensions: [
          {
            calculation: "Restricted analytics source is healthy.",
            dimension: "analytics-reliability",
            exactInputs: [
              {
                label: "Restricted analytics source",
                observedAt: NOW,
                source: "analytics-events",
                value: "available"
              }
            ],
            howToImprove: [],
            missingInputs: [],
            score: 100,
            weight: 1
          },
          {
            calculation: "The visible coach site passed its checks.",
            dimension: "site-health",
            exactInputs: [
              {
                label: "Visible coach sites",
                observedAt: NOW,
                source: "coach-sites",
                value: 1
              }
            ],
            howToImprove: [],
            missingInputs: [],
            score: 100,
            weight: 1
          }
        ]
      },
      table: {
        filters: {},
        rows: [{ id: "site-1", label: "Visible coach site", status: "draft" }],
        selectedIds: ["site-1"],
        sort: null,
        tableId: "coach-sites"
      }
    },
    isOwner,
    lastUpdated: NOW,
    loadingState: false,
    knowledge: [],
    permissions,
    relatedAPIs: ["/api/admin/coach-sites", "/api/admin/analytics-events"],
    registeredActions: [],
    sectionId: "coach-sites",
    sectionName: "Coach Analytics",
    selectedRows: [],
    userRole,
    visibleDataSummary: [{ label: "Coach sites", source: "coach-sites", value: 1 }],
    warnings: []
  };
}
