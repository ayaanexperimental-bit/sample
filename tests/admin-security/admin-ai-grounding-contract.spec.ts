import { expect, test } from "@playwright/test";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import { adminAIRegistry, globalAdminAICommands } from "../../lib/admin-ai/adminAIRegistry";
import {
  ensureAdminAIConclusions,
  groundAdminAIResponse,
  runAdminAICommand,
  type AdminAIResponse
} from "../../lib/admin-ai/adminAIService";

test.describe("Admin AI confidence and provenance contract", () => {
  test("grounds every registered command with confidence and auditable context", () => {
    const current = context();
    const commands = [
      ...Object.values(adminAIRegistry).flatMap((section) => section.commands),
      ...globalAdminAICommands
    ];

    for (const command of commands) {
      const response = runAdminAICommand(command, current, DEFAULT_ADMIN_AI_PREFERENCES);
      expect(response.confidence?.level, command.id).toBeTruthy();
      expect(response.confidence?.reason, command.id).toBeTruthy();
      expect(response.conclusions?.length, command.id).toBeGreaterThan(0);
      for (const conclusion of response.conclusions || []) {
        expect(conclusion.text, command.id).toBeTruthy();
        expect(conclusion.confidence.level, command.id).toBeTruthy();
        expect(conclusion.confidence.reason, command.id).toBeTruthy();
      }
      expect(response.modelRoute?.mode, command.id).toBe("deterministic");
      expect(response.evidence?.[0], command.id).toMatchObject({
        dateRange: "July 1-7",
        entityReferences: ["site-1"],
        filters: { status: "draft" },
        freshness: "Current",
        module: "overview",
        observedAt: "2026-07-21T10:00:00.000Z",
        sourceRoute: "/admin/dashboard?view=overview"
      });
    }
  });

  test("uses low confidence for an unavailable live-model result without changing its safe fallback", () => {
    const response = groundAdminAIResponse(
      {
        body: "Deterministic commands remain available.",
        items: [],
        state: "offline-error",
        title: "Live AI service offline"
      } satisfies AdminAIResponse,
      context()
    );

    expect(response.confidence).toEqual({
      level: "low",
      reason: "The requested AI service did not return a usable result."
    });
    expect(response.conclusions).toEqual([
      {
        confidence: response.confidence,
        id: "primary-conclusion",
        text: "Deterministic commands remain available."
      }
    ]);
    expect(response.state).toBe("offline-error");
    expect(response.evidence?.[0].recordCount).toBe(1);
  });

  test("keeps uncapped record counts and entity references specific to each source", () => {
    const current = multiSourceContext();
    const response = groundAdminAIResponse(
      {
        body: "Cross-module records were analyzed.",
        items: [],
        state: "ready",
        title: "Cross-module answer"
      } satisfies AdminAIResponse,
      current
    );
    const evidenceBySource = new Map(response.evidence?.map((item) => [item.source, item]) ?? []);

    expect(response.evidence).toHaveLength(3);
    expect(evidenceBySource.get("/api/admin/coach-sites")).toMatchObject({
      dateRange: "July 1-21",
      entityReferences: Array.from({ length: 15 }, (_, index) => `site-${index + 1}`),
      filters: { region: "all", status: "attention" },
      freshness: "Refreshed 5 minutes ago",
      module: "coach-sites",
      observedAt: "2026-07-21T10:00:00.000Z",
      recordCount: 15,
      sourceRoute: "/admin/dashboard?view=coach-sites"
    });
    expect(evidenceBySource.get("/api/admin/analytics-events")).toMatchObject({
      entityReferences: ["analytics-1", "analytics-2", "analytics-3"],
      module: "coach-analytics",
      recordCount: 3,
      sourceRoute: "/admin/dashboard?view=coach-analytics"
    });
    expect(evidenceBySource.get("/api/admin/error-reports")).toMatchObject({
      entityReferences: ["ERR-1", "ERR-2"],
      module: "error-reports",
      recordCount: 2,
      sourceRoute: "/admin/dashboard?view=error-reports"
    });
  });

  test("downgrades unsupported high-certainty conclusions without internal evidence", () => {
    const response = ensureAdminAIConclusions({
      body: "This conclusion has no cited internal evidence.",
      conclusions: [
        {
          confidence: { level: "high", reason: "The model is certain." },
          id: "unsupported-certainty",
          text: "A production issue definitely exists."
        }
      ],
      confidence: { level: "high", reason: "The model is certain." },
      items: [],
      state: "ready",
      title: "Unsupported certainty"
    });

    expect(response.confidence).toEqual({
      level: "medium",
      reason: "High confidence requires a cited internal evidence reference."
    });
    expect(response.conclusions?.[0].confidence).toEqual(response.confidence);
  });
});

function multiSourceContext(): AdminAISectionContext {
  return {
    ...context(),
    currentRoute: "/admin/dashboard?view=overview",
    dataFreshness: "Refreshed 5 minutes ago",
    dateRange: "July 1-21",
    entities: [
      ...Array.from({ length: 15 }, (_, index) => ({
        id: `site-${index + 1}`,
        label: `Coach site ${index + 1}`,
        matchReason: "Coach site record",
        module: "coach-sites" as const,
        route: `/admin/dashboard?view=coach-sites&coach=site-${index + 1}`,
        searchableText: `coach site ${index + 1}`,
        source: "coach-sites",
        status: "draft",
        updatedAt: "2026-07-21T09:00:00.000Z"
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `analytics-${index + 1}`,
        label: `Analytics row ${index + 1}`,
        matchReason: "Analytics summary row",
        module: "coach-analytics" as const,
        route: `/admin/dashboard?view=coach-analytics&coach=coach-${index + 1}`,
        searchableText: `analytics row ${index + 1}`,
        source: "analytics-events",
        status: "active",
        updatedAt: "2026-07-21T09:30:00.000Z"
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        id: `ERR-${index + 1}`,
        label: `Error report ${index + 1}`,
        matchReason: "Open error report",
        module: "error-reports" as const,
        route: `/admin/dashboard?view=error-reports&report=ERR-${index + 1}`,
        searchableText: `error report ${index + 1}`,
        source: "error-reports",
        status: "open",
        updatedAt: "2026-07-21T09:45:00.000Z"
      }))
    ],
    filters: { region: "all", status: "attention" },
    lastUpdated: "2026-07-21T10:00:00.000Z",
    relatedAPIs: [
      "/api/admin/coach-sites",
      "/api/admin/analytics-events",
      "/api/admin/error-reports"
    ],
    selectedRows: [],
    visibleDataSummary: [
      { label: "Coach sites", source: "coach-sites", value: 15 },
      { label: "Analytics rows", source: "analytics-events", value: 3 },
      { label: "Error reports", source: "error-reports", value: 2 }
    ]
  };
}

function context(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: ["Open reports"],
    currentRoute: "/admin/dashboard?view=overview",
    dataFreshness: "Current",
    dateRange: "July 1-7",
    emptyState: false,
    entities: [
      {
        id: "site-1",
        label: "Gyana",
        matchReason: "Draft site",
        module: "coach-sites",
        route: "/admin/dashboard?view=coach-sites&coach=gyana",
        searchableText: "gyana draft",
        source: "coach-sites",
        status: "draft",
        updatedAt: "2026-07-21T09:00:00.000Z"
      }
    ],
    errors: [],
    filters: { status: "draft" },
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: ["/api/admin/dashboard/overview"],
      registeredActions: [],
      visibleDataSummary: [],
      warnings: []
    },
    isOwner: true,
    lastUpdated: "2026-07-21T10:00:00.000Z",
    loadingState: false,
    knowledge: [],
    permissions: ["overview.view"],
    relatedAPIs: ["/api/admin/dashboard/overview"],
    registeredActions: [],
    sectionId: "overview",
    sectionName: "Admin Overview",
    selectedRows: ["site-1"],
    userRole: "owner",
    visibleDataSummary: [{ label: "Coach sites", source: "coach-sites", value: 1 }],
    warnings: ["One site needs review."]
  };
}
