import { expect, test } from "@playwright/test";
import type { CoachSiteRecord } from "../../lib/admin-coach-sites";
import type { AdminErrorReport } from "../../lib/admin-control-center";
import type { AdminAIAnalyticsPoint } from "../../lib/admin-ai/adminAIAnalytics";
import type { AdminAIBuilderInspectionInput } from "../../lib/admin-ai/adminAIBuilderInspection";
import {
  buildAdminAIIntelligenceContext,
  type AdminAISectionContext
} from "../../lib/admin-ai/adminAIContext";
import type { AdminAIErrorReportFact } from "../../lib/admin-ai/adminAIErrorInvestigation";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import {
  ADMIN_AI_ANOMALY_CATEGORIES,
  ADMIN_AI_HEALTH_SCORE_DIMENSIONS,
  buildAdminAIHealthScore,
  type AdminAIAnomalyAnalysis,
  type AdminAIHealthEvidenceInput,
  type AdminAIHealthScoreInput
} from "../../lib/admin-ai/adminAIHealth";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import { runAdminAINaturalLanguageQuery } from "../../lib/admin-ai/adminAIOrchestrator";
import type { AdminAIResponse } from "../../lib/admin-ai/adminAIService";
import type { AdminAITableContext } from "../../lib/admin-ai/adminAITableCopilot";

type IntelligenceContext = AdminAISectionContext & {
  intelligence: {
    analyticsPoints: AdminAIAnalyticsPoint[];
    anomalyAnalysis: AdminAIAnomalyAnalysis;
    builderInspection: AdminAIBuilderInspectionInput | null;
    errorReports: AdminAIErrorReportFact[];
    healthEvidence: AdminAIHealthEvidenceInput[];
    healthScore: AdminAIHealthScoreInput;
    table: AdminAITableContext | null;
  };
};

type IntelligenceResponse = AdminAIResponse & {
  analyticsExplanation?: {
    evidence: { sources: string[] };
    status: string;
    trend: { currentVisits: number; previousVisits: number | null };
  };
  builderInspection?: { checks: Array<{ id: string }>; outcome: string };
  errorInvestigation?: { relatedErrors: string[]; status: string; summary: string };
  structuredReport?: {
    kind: string;
    reportType?: string;
    sections: Array<{ classification?: string; id: string; title: string }>;
  };
  tableAnalysis?: { rowResults: Array<{ id: string }>; selectedCount: number };
};

test.describe("Admin AI intelligence engine integration", () => {
  test("routes real analytics buckets through the complete explanation engine", () => {
    const response = ask(
      createContext("coach-analytics"),
      "Explain chart trends, drops, peaks, and anomalies"
    );

    expect(response.analyticsExplanation).toMatchObject({
      evidence: { sources: ["d1_analytics_events"] },
      status: "ready",
      trend: { currentVisits: 150, previousVisits: 200 }
    });
    expect(response.analyticsExplanation?.trend).not.toHaveProperty("fabricated");
  });

  test("surfaces the exact stale-error classification in the selected Error Reports flow", () => {
    const context = createContext("error-reports");
    context.selectedRows = ["ERR-1"];
    context.lastUpdated = "2026-07-21T12:00:00.000Z";
    context.intelligence.errorReports[0] = {
      ...context.intelligence.errorReports[0],
      status: "Reviewing",
      statusTrusted: true,
      updatedAt: "2026-06-21T12:00:00.000Z"
    };

    const response = ask(context, "Investigate the selected stale error");

    expect(response.body).toContain("stale");
    expect(response.items).toContain("Stale threshold: 30 days");
  });

  test("generates the exact daily briefing and executive report structures", () => {
    const context = createContext("error-reports");
    const briefing = ask(context, "Generate today's Daily Briefing");
    expect(briefing.structuredReport?.kind).toBe("daily-briefing");
    expect(briefing.structuredReport?.sections.map(({ title }) => title)).toEqual([
      "Platform health",
      "New coach sites",
      "Sites published",
      "Shop purchases",
      "Payment/publish exceptions",
      "Top-performing sites",
      "Low-performing sites",
      "New high-priority errors",
      "Pending admin actions",
      "Backup status",
      "Recommended focus for today"
    ]);

    const executive = ask(context, "Generate the Monthly Growth Report");
    expect(executive.structuredReport).toMatchObject({
      kind: "executive",
      reportType: "Monthly Growth Report"
    });
    expect(
      executive.structuredReport?.sections.map(({ classification }) => classification)
    ).toEqual(["observed", "computed", "interpretation", "recommendation", "missing"]);
  });

  test("renders only evidence-backed health alerts and all eight transparent score dimensions", () => {
    const response = ask(createContext("overview"), "Show platform health and reliability");

    expect(response.healthSignals).toEqual([
      expect.objectContaining({
        affectedEntity: "ERR-1",
        firstDetected: "2026-07-20T08:00:00.000Z",
        lastDetected: "2026-07-20T09:00:00.000Z",
        recurrenceCount: 3,
        severity: "high",
        title: "Repeated protected API failures"
      })
    ]);
    expect(response.healthScore?.components).toHaveLength(8);
    expect(response.healthScore?.score).toBe(90);
    expect(
      (response.healthScore as typeof response.healthScore & { calculation?: string | null })
        ?.calculation
    ).toContain("Weighted average");
    expect(
      response.healthScore?.components[0] as
        | (NonNullable<typeof response.healthScore>["components"][number] & {
            calculation?: string | null;
            howToImprove?: string[];
            weight?: number | null;
          })
        | undefined
    ).toMatchObject({
      calculation: expect.any(String),
      howToImprove: [expect.any(String)],
      weight: 1
    });
  });

  test("derives all eleven anomaly categories from source histories without caller assertions", () => {
    const operationalHealthCategories = [
      "failed-publishes",
      "payment-success-publish-pending-mismatches",
      "broken-public-routes",
      "repeated-failed-otp-attempts",
      "unusual-permission-changes",
      "backup-failures",
      "analytics-ingestion-failures"
    ] as const;
    const healthEvidence = operationalHealthCategories.map((category, index) => ({
      affectedEntity: `source-${category}`,
      category,
      directRoute: "/admin/dashboard?view=overview",
      evidence: [10, 10, 10, 20].map((value, observationIndex) => ({
        observedAt: new Date(
          Date.parse("2026-07-17T08:00:00.000Z") + observationIndex * 86_400_000
        ).toISOString(),
        source: `source:${category}`,
        summary: `Observed ${category} count ${value}`,
        value
      })),
      firstDetected: "2026-07-17T08:00:00.000Z",
      id: `health-${index}`,
      impact: "The source-backed count increased.",
      lastDetected: "2026-07-20T08:00:00.000Z",
      module: "overview",
      recurrenceCount: 20,
      severity: "high" as const,
      suggestedNextStep: "Verify the permission-visible source records.",
      whatHappened: `Observed ${category}`
    }));
    const editEntities = [
      "2026-07-17T08:00:00.000Z",
      "2026-07-18T08:00:00.000Z",
      "2026-07-20T08:00:00.000Z",
      "2026-07-20T09:00:00.000Z",
      "2026-07-20T10:00:00.000Z",
      "2026-07-20T11:00:00.000Z"
    ].map((updatedAt, index) => ({
      id: `audit-${index}`,
      label: "Coach Sites activity",
      matchReason: "A permission-visible Admin edit was observed.",
      module: "coach-sites" as const,
      route: "/admin/dashboard?view=coach-sites",
      searchableText: "audit admin edit coach sites",
      source: "admin-action-activity",
      status: "success",
      updatedAt
    }));
    const intelligence = buildAdminAIIntelligenceContext({
      analyticsStatus: "d1_analytics_events",
      calculatedAt: "2026-07-20T12:00:00.000Z",
      coachSites: [],
      errorReportStatus: "d1_error_reports",
      errorReports: [],
      operational: { entities: editEntities, healthEvidence, scoreDimensions: [] },
      timeSeries: [
        {
          bucketEnd: "2026-07-20T08:00:00.000Z",
          bucketStart: "2026-07-20T07:00:00.000Z",
          currentVisits: 40,
          previousRangeRegisterClicks: 10,
          previousRangeVisits: 100,
          registerClicks: 4,
          source: "direct"
        },
        {
          bucketEnd: "2026-07-20T09:00:00.000Z",
          bucketStart: "2026-07-20T08:00:00.000Z",
          currentVisits: 100,
          previousRangeRegisterClicks: 10,
          previousRangeVisits: 100,
          registerClicks: 20,
          source: "direct"
        },
        {
          bucketEnd: "2026-07-20T10:00:00.000Z",
          bucketStart: "2026-07-20T09:00:00.000Z",
          currentVisits: 100,
          previousRangeRegisterClicks: 10,
          previousRangeVisits: 100,
          registerClicks: 5,
          source: "direct"
        }
      ]
    });

    expect(intelligence.anomalyAnalysis.status).toBe("ready");
    expect(intelligence.anomalyAnalysis.insufficientBaselineCategories).toEqual([]);
    expect(intelligence.anomalyAnalysis.anomalies.map(({ category }) => category)).toEqual(
      ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }) => id)
    );
  });

  test("keeps selected table analysis and error investigation bounded to selected records", () => {
    const table = ask(
      createContext("coach-sites", ["site-1"]),
      "Analyze selected rows in this table and explain why they need attention",
      "selection"
    );
    expect(table.tableAnalysis).toMatchObject({ selectedCount: 1 });
    expect(table.tableAnalysis?.rowResults.map(({ id }) => id)).toEqual(["site-1"]);

    const error = ask(
      createContext("error-reports", ["ERR-1"]),
      "Investigate the selected error and prepare a developer-ready bug summary",
      "selection"
    );
    expect(error.errorInvestigation).toMatchObject({
      relatedErrors: [],
      status: "ready",
      summary: "ERR-1: Safe API failure."
    });
    expect(error.errorInvestigation?.summary).not.toContain("ERR-2");
    for (const expected of [
      "Summary:",
      "Severity:",
      "Impact:",
      "Affected users or entities:",
      "Evidence:",
      "Likely cause:",
      "Reproduction:",
      "Recommended fix:",
      "Safe temporary action:",
      "Related errors:",
      "Resolution status:"
    ]) {
      expect(error.artifact?.content).toContain(expected);
    }
  });

  test("runs the fourteen-check Builder inspection without bypassing production validation", () => {
    const response = ask(
      createContext("create-coach-site"),
      "Run the complete pre-publish Builder inspection"
    );

    expect(response.builderInspection?.checks).toHaveLength(14);
    expect(response.builderInspection?.checks.map(({ id }) => id)).toContain(
      "production-validation"
    );
    expect(response.builderInspection?.outcome).toBe("ready");
  });

  test("builds the live intelligence envelope from allowlisted source facts only", () => {
    const table: AdminAITableContext = {
      filters: { status: "published" },
      rows: [
        {
          id: "site-live",
          label: "Live Coach",
          linkValid: false,
          requiredDataComplete: true,
          status: "published"
        }
      ],
      selectedIds: ["site-live"],
      sort: null,
      tableId: "coach-sites"
    };
    const intelligence = buildAdminAIIntelligenceContext({
      analyticsStatus: "d1_analytics_events",
      calculatedAt: "2026-07-20T10:00:00.000Z",
      coachSites: [
        {
          analytics: { lastUpdated: "2026-05-01T00:00:00.000Z" },
          bio: "Complete public coach bio.",
          coachName: "Live Coach",
          googleFormUrl: "http://invalid.example/register",
          heroMediaType: "none",
          id: "site-live",
          logoUrl: "",
          niche: "Women wellness",
          photoUrl: "",
          slug: "live-coach",
          status: "published",
          updatedAt: "2026-07-19T09:00:00.000Z",
          videoUrl: "",
          vision: "Practical education and support."
        } as CoachSiteRecord
      ],
      errorReportStatus: "d1_error_reports",
      errorReports: [
        {
          adminNotes: "private note",
          category: "API error",
          coachSlug: "live-coach",
          createdAt: "2026-07-20T08:00:00.000Z",
          errorCode: "API_ERROR",
          pagePath: "/api/admin/coach-sites",
          referenceId: "ERR-LIVE-1",
          safeMessage: "Safe failure one.",
          sessionId: "private-session",
          severity: "high",
          status: "New",
          technicalDetails: "secret=do-not-copy"
        } as AdminErrorReport,
        {
          category: "API error",
          createdAt: "2026-07-20T09:00:00.000Z",
          errorCode: "API_ERROR",
          pagePath: "/api/admin/coach-sites",
          referenceId: "ERR-LIVE-2",
          safeMessage: "Safe failure two.",
          severity: "medium",
          status: "Reviewing"
        } as AdminErrorReport
      ],
      table,
      timeSeries: [
        {
          bucketEnd: "2026-07-20T10:00:00.000Z",
          bucketStart: "2026-07-20T09:00:00.000Z",
          currentVisits: 12,
          previousRangeRegisterClicks: 2,
          previousRangeVisits: 8,
          registerClicks: 3,
          source: "d1_analytics_events"
        }
      ]
    });

    expect(intelligence.analyticsPoints[0]).toMatchObject({
      currentRegistrationClicks: 3,
      currentVisits: 12,
      previousRegistrationClicks: 2,
      previousVisits: 8
    });
    expect(intelligence.errorReports[0]).toMatchObject({
      referenceId: "ERR-LIVE-1",
      safeMessage: "Safe failure one.",
      sourceFiles: [],
      sourceFilesTrusted: false
    });
    expect(intelligence.errorReports[0]).not.toHaveProperty("adminNotes");
    expect(intelligence.errorReports[0]).not.toHaveProperty("sessionId");
    expect(intelligence.errorReports[0]).not.toHaveProperty("technicalDetails");
    expect(intelligence.healthEvidence.map(({ category }) => category)).toEqual(
      expect.arrayContaining([
        "repeated-api-failures",
        "invalid-cta-links",
        "sites-without-recent-analytics"
      ])
    );
    expect(intelligence.table?.selectedIds).toEqual(["site-live"]);

    const score = buildAdminAIHealthScore(intelligence.healthScore);
    expect(score.components).toHaveLength(8);
    expect(score.components.find(({ id }) => id === "backup-freshness")?.score).toBeNull();
    expect(score.components.find(({ id }) => id === "security-configuration")?.score).toBeNull();
    expect(score.score).toBeNull();
  });
});

function ask(
  context: IntelligenceContext,
  query: string,
  scope: "global" | "module" | "page" | "selection" = "page"
) {
  return runAdminAINaturalLanguageQuery({
    context,
    featureFlags: getAdminAIFeatureFlags(),
    preferences: DEFAULT_ADMIN_AI_PREFERENCES,
    query,
    scope
  }) as IntelligenceResponse;
}

function createContext(
  sectionId: AdminAISectionContext["sectionId"],
  selectedRows: string[] = []
): IntelligenceContext {
  const analyticsPoints: AdminAIAnalyticsPoint[] = [
    {
      bucketEnd: "2026-07-19T23:59:59.000Z",
      bucketStart: "2026-07-19T00:00:00.000Z",
      currentRegistrationClicks: 10,
      currentVisits: 120,
      previousRegistrationClicks: 12,
      previousVisits: 100,
      source: "d1_analytics_events"
    },
    {
      bucketEnd: "2026-07-20T23:59:59.000Z",
      bucketStart: "2026-07-20T00:00:00.000Z",
      currentRegistrationClicks: 1,
      currentVisits: 30,
      previousRegistrationClicks: 10,
      previousVisits: 100,
      source: "d1_analytics_events"
    }
  ];
  const healthScore: AdminAIHealthScoreInput = {
    calculatedAt: "2026-07-20T09:00:00.000Z",
    dimensions: ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id, label }) => ({
      calculation: `${label} is supplied by the current protected source fixture.`,
      dimension: id,
      exactInputs: [
        {
          label,
          observedAt: "2026-07-20T09:00:00.000Z",
          source: `fixture:${id}`,
          value: 90
        }
      ],
      howToImprove: [`Resolve evidence-backed ${label.toLowerCase()} findings.`],
      missingInputs: [],
      score: 90,
      weight: 1
    }))
  };
  const healthEvidence: AdminAIHealthEvidenceInput[] = [
    {
      affectedEntity: "ERR-1",
      category: "repeated-api-failures",
      directRoute: "/admin/dashboard?view=error-reports&report=ERR-1",
      evidence: [
        {
          observedAt: "2026-07-20T09:00:00.000Z",
          source: "error-reports",
          summary: "Three permission-visible API failures share ERR-1.",
          value: 3
        }
      ],
      firstDetected: "2026-07-20T08:00:00.000Z",
      id: "health-api-ERR-1",
      impact: "The protected Admin operation may be unreliable.",
      lastDetected: "2026-07-20T09:00:00.000Z",
      module: "error-reports",
      recurrenceCount: 3,
      safeActionId: "error-reports.triage",
      severity: "high",
      suggestedNextStep: "Open the grouped safe reports and reproduce the protected route.",
      whatHappened: "Repeated protected API failures"
    }
  ];
  const table: AdminAITableContext = {
    filters: { status: "all" },
    rows: [
      {
        id: "site-1",
        label: "Gyana",
        linkValid: false,
        requiredDataComplete: false,
        status: "draft"
      },
      {
        id: "site-2",
        label: "Healthy Site",
        linkValid: true,
        requiredDataComplete: true,
        status: "published"
      }
    ],
    selectedIds: selectedRows,
    sort: null,
    tableId: sectionId
  };

  return {
    analyticsSeries: analyticsPoints.map((point) => ({
      current: point.currentVisits,
      label: point.bucketStart,
      previous: point.previousVisits || 0,
      registerClicks: point.currentRegistrationClicks
    })),
    availableActions: ["Summarize this page", "Find problems", "Generate report"],
    currentRoute: `/admin/dashboard?view=${sectionId}`,
    dataFreshness: "Updated less than a minute ago",
    dateRange: "2026-07-19 to 2026-07-20",
    emptyState: false,
    entities: [],
    errors: [],
    filters: { status: "all" },
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: ["/api/admin/analytics-events", "/api/admin/error-reports"],
      registeredActions: [],
      visibleDataSummary: [
        { label: "Coach sites", source: "coach-sites", value: 2 },
        { label: "Published", source: "coach-sites", value: 1 },
        { label: "Shop purchases", source: "shop", value: 3 }
      ],
      warnings: ["One draft site needs registration-link review."]
    },
    intelligence: {
      analyticsPoints,
      anomalyAnalysis: {
        anomalies: [],
        insufficientBaselineCategories: ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }) => id),
        message: "Insufficient baseline",
        status: "insufficient-baseline"
      },
      builderInspection: builderInspection(),
      errorReports: [
        {
          affectedEntity: "Coach site Gyana",
          createdAt: "2026-07-20T09:00:00.000Z",
          errorCode: "API_ERROR",
          module: "error-reports",
          referenceId: "ERR-1",
          route: "/api/admin/coach-sites",
          safeMessage: "Safe API failure.",
          severity: "high",
          sourceFiles: [],
          sourceFilesTrusted: false
        },
        {
          affectedEntity: "Another module",
          createdAt: "2026-07-20T09:05:00.000Z",
          errorCode: "OTHER_ERROR",
          module: "shop",
          referenceId: "ERR-2",
          route: "/api/admin/shop",
          safeMessage: "Unrelated safe failure.",
          severity: "medium",
          sourceFiles: [],
          sourceFilesTrusted: false
        }
      ],
      healthEvidence,
      healthScore,
      table
    },
    lastUpdated: "2026-07-20T09:00:00.000Z",
    loadingState: false,
    knowledge: [],
    permissions: ["coach_sites.view", "error_reports.view"],
    relatedAPIs: ["/api/admin/analytics-events", "/api/admin/error-reports"],
    registeredActions: [],
    sectionId,
    sectionName: sectionId,
    selectedRows,
    userRole: "owner",
    visibleDataSummary: [
      { label: "Coach sites", source: "coach-sites", value: 2 },
      { label: "Published", source: "coach-sites", value: 1 },
      { label: "Shop purchases", source: "shop", value: 3 }
    ],
    warnings: ["One draft site needs registration-link review."]
  };
}

function builderInspection(): AdminAIBuilderInspectionInput {
  return {
    bonusServiceTitles: [
      "Life-Long Health Calculators",
      "Lifetime Support Sessions",
      "Lifestyle Success Toolkit"
    ],
    copyText: "A focused women wellness coaching page with clear benefits and practical guidance.",
    ctaText: "Register Now",
    faq: Array.from({ length: 5 }, (_, index) => ({
      answer: `Use the secure registration link for step ${index + 1}.`,
      question: `How do I begin step ${index + 1}?`
    })),
    footer: {
      brandLine: "YW Nutritech Coach Referral",
      privacyNote: "Public support details only.",
      text: "Wellness education is not medical advice."
    },
    media: { height: 1200, ready: true, width: 1200 },
    missingFields: [],
    mobileContentLength: 800,
    navbarSections: ["intro", "benefits", "faq", "register"],
    niche: "Women wellness",
    previewDigest: "same-digest",
    productionValidationError: "",
    publicDigest: "same-digest",
    registrationUrl: "https://example.com/register",
    visibleSections: ["intro", "benefits", "faq", "register"]
  };
}
