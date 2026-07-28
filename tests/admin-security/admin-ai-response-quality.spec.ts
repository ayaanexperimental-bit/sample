import { expect, test } from "@playwright/test";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import {
  runAdminAINaturalLanguageQuery,
  runAdminAINaturalLanguageQueryWithModel
} from "../../lib/admin-ai/adminAIOrchestrator";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";
import {
  ensureAdminAIConclusions,
  normalizeAdminAIResponseCopy,
  runAdminAICommand
} from "../../lib/admin-ai/adminAIService";

test.describe("Admin AI shared response quality", () => {
  test("centrally removes filler, bounds copy, and deduplicates action items", () => {
    const normalized = normalizeAdminAIResponseCopy({
      body: `Certainly! As an AI copilot, ${"use the current admin controls. ".repeat(100)}`,
      items: [" Review the selected record. ", "Review the selected record."],
      state: "ready",
      title: ` Sure! ${"Admin result ".repeat(30)}`
    });

    expect(normalized.title).not.toMatch(/^\s*(?:sure|certainly)/i);
    expect(normalized.title.length).toBeLessThanOrEqual(140);
    expect(normalized.body).not.toMatch(/^\s*(?:sure|certainly|as an ai)/i);
    expect(normalized.body.length).toBeLessThanOrEqual(1_200);
    expect(normalized.items).toEqual(["Review the selected record."]);
  });

  test("removes provider filler on the live natural-language response path", async () => {
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: adminContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () => "Certainly! As an AI copilot, review the selected record."
      },
      query: "Explain the selected coach",
      scope: "selection"
    });

    expect(response.body).not.toMatch(/Certainly|As an AI/i);
    expect(response.body).toContain("Model-assisted summary: review the selected record.");
  });

  test("keeps a generated report strictly scoped to the selected coach", () => {
    const context = adminContext();
    const response = runAdminAICommand(
      getAdminAICommand("coach-analytics.report")!,
      context,
      DEFAULT_ADMIN_AI_PREFERENCES
    );

    expect(response.report?.keyMetrics).toEqual([
      "Selected Coach: needs-review (analytics-events)"
    ]);
    expect(response.report?.observations).toContain("Selected coach conversion is below target.");
    expect(JSON.stringify(response.report)).not.toContain("Other Coach");
    expect(JSON.stringify(response.report)).not.toContain("Platform visits");
  });

  test("prioritizes the next action from active selection and filters", () => {
    const response = runAdminAICommand(
      getAdminAICommand("coach-analytics.next-action")!,
      adminContext(),
      DEFAULT_ADMIN_AI_PREFERENCES
    );

    expect(response.body).toContain("Scoped to 1 selected record.");
    expect(response.items[0]).toBe("Review selected coach site");
  });

  test("emits a separately supported conclusion for every material summary claim", () => {
    const context = adminContext();
    context.relatedAPIs = ["/api/admin/analytics-events", "/api/admin/coach-sites"];
    context.selectedRows = [];
    context.visibleDataSummary = [
      { label: "Registration conversion", source: "analytics-events", value: "8.4%" },
      { label: "Published coach sites", source: "coach-sites", value: 12 }
    ];

    const response = runAdminAICommand(
      getAdminAICommand("coach-analytics.summarize")!,
      context,
      DEFAULT_ADMIN_AI_PREFERENCES
    );

    expect(response.conclusions).toEqual([
      {
        confidence: {
          level: "high",
          reason:
            "This claim is directly derived from the cited permission-filtered analytics-events summary."
        },
        evidenceSources: ["analytics-events"],
        id: "summary-claim-1",
        text: "Registration conversion: 8.4% (analytics-events)"
      },
      {
        confidence: {
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence matches coach-sites for this conclusion."
        },
        evidenceSources: ["coach-sites"],
        id: "summary-claim-2",
        text: "Published coach sites: 12 (coach-sites)"
      }
    ]);
    expect(response.confidence).toEqual({
      level: "medium",
      reason:
        "The response contains both supported and unsupported material conclusions; review claim-level confidence."
    });
  });

  test("calibrates every production natural-language summary claim against its own source", () => {
    const context = adminContext();
    context.selectedRows = [];
    context.visibleDataSummary = [
      { label: "Registration conversion", source: "analytics-events", value: "8.4%" },
      { label: "Published coach sites", source: "coach-sites", value: 12 }
    ];

    const response = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Give me a grounded summary",
      scope: "page"
    });

    expect(response.conclusions).toEqual([
      {
        confidence: {
          level: "high",
          reason:
            "This claim is directly derived from the cited permission-filtered analytics-events summary."
        },
        evidenceSources: ["analytics-events"],
        id: "summary-claim-1",
        text: "Registration conversion: 8.4% (analytics-events)"
      },
      {
        confidence: {
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence matches coach-sites for this conclusion."
        },
        evidenceSources: ["coach-sites"],
        id: "summary-claim-2",
        text: "Published coach sites: 12 (coach-sites)"
      }
    ]);
  });

  test("calibrates high, medium, and low claims against their own cited evidence", () => {
    const confidenceLevels = ["high", "medium", "low"] as const;
    const response = ensureAdminAIConclusions({
      body: "Six independently testable claims.",
      conclusions: confidenceLevels.flatMap((level) => [
        {
          confidence: {
            level,
            reason: `Requested ${level} because source-a directly supports this claim.`
          },
          evidenceSources: ["source-a"],
          id: `supported-${level}`,
          text: `Supported ${level} claim.`
        },
        {
          confidence: {
            level,
            reason: `Requested ${level} without matching evidence.`
          },
          evidenceSources: ["missing-source"],
          id: `unsupported-${level}`,
          text: `Unsupported ${level} claim.`
        },
        {
          confidence: {
            level,
            reason: `Requested ${level} without citing evidence.`
          },
          id: `uncited-${level}`,
          text: `Uncited ${level} claim.`
        }
      ]),
      confidence: {
        level: "medium",
        reason: "The response contains independently calibrated claims."
      },
      evidence: [
        {
          dateRange: "July 1-21",
          freshness: "Current",
          label: "Source A",
          module: "coach-analytics",
          recordCount: 4,
          source: "source-a"
        }
      ],
      items: [],
      state: "ready",
      title: "Claim calibration"
    });

    expect(
      response.conclusions?.map(({ confidence, evidenceSources, id }) => ({
        evidenceSources,
        id,
        level: confidence.level,
        reason: confidence.reason
      }))
    ).toEqual(
      confidenceLevels.flatMap((level) => [
        {
          evidenceSources: ["source-a"],
          id: `supported-${level}`,
          level,
          reason: `Requested ${level} because source-a directly supports this claim.`
        },
        {
          evidenceSources: ["missing-source"],
          id: `unsupported-${level}`,
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence matches missing-source for this conclusion."
        },
        {
          evidenceSources: undefined,
          id: `uncited-${level}`,
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence source was supplied for this conclusion."
        }
      ])
    );
  });

  test("downgrades overall certainty when every material conclusion is unsupported", () => {
    const response = ensureAdminAIConclusions({
      body: "The response contains one unsupported material claim.",
      conclusions: [
        {
          confidence: { level: "high", reason: "A cited source should support this claim." },
          evidenceSources: ["missing-source"],
          id: "unsupported",
          text: "An unsupported production condition exists."
        }
      ],
      confidence: { level: "high", reason: "The response was initially treated as certain." },
      evidence: [
        {
          dateRange: "July 1-21",
          freshness: "Current",
          label: "Trusted source",
          module: "overview",
          recordCount: 1,
          source: "trusted-source"
        }
      ],
      items: [],
      state: "ready",
      title: "Unsupported response"
    });

    expect(response.conclusions?.[0].confidence.level).toBe("insufficient-data");
    expect(response.confidence).toEqual({
      level: "insufficient-data",
      reason: "Every material conclusion lacks matching internal evidence."
    });
  });

  test("does not accept an arbitrary prefixed source as a canonical evidence alias", () => {
    const response = ensureAdminAIConclusions({
      body: "A source alias must be explicit.",
      conclusions: [
        {
          confidence: { level: "high", reason: "The source name appears similar." },
          evidenceSources: ["coach-sites"],
          id: "prefixed-alias",
          text: "Coach Sites evidence is available."
        }
      ],
      evidence: [
        {
          dateRange: "July 1-21",
          freshness: "Current",
          label: "Unrelated prefixed source",
          module: "overview",
          recordCount: 1,
          source: "untrusted-coach-sites"
        }
      ],
      items: [],
      state: "ready",
      title: "Canonical source matching"
    });

    expect(response.conclusions?.[0].confidence).toEqual({
      level: "insufficient-data",
      reason:
        "Insufficient data: no cited internal evidence matches coach-sites for this conclusion."
    });
  });

  test("previews only the current unsaved Builder text without creating an action payload", () => {
    const context = adminContext();
    const builderInspection = {
      bonusServiceTitles: [],
      copyText: "  Current unsaved Builder draft.  ",
      ctaText: "Register",
      faq: [],
      footer: { brandLine: "Brand", privacyNote: "Privacy", text: "Footer" },
      media: { ready: true },
      missingFields: [],
      mobileContentLength: 30,
      navbarSections: [],
      niche: "wellness",
      previewDigest: "preview",
      productionValidationError: "",
      publicDigest: "public",
      registrationUrl: "https://example.com/register",
      visibleSections: []
    };
    context.sectionId = "create-coach-site";
    context.sectionName = "Website Creator";
    context.intelligence = {
      analyticsPoints: [],
      builderInspection,
      errorReports: [],
      healthEvidence: [],
      healthScore: { calculatedAt: "2026-07-21T10:00:00.000Z", dimensions: [] },
      table: null
    };

    const response = runAdminAICommand(
      getAdminAICommand("create-coach-site.preview-draft-text")!,
      context,
      DEFAULT_ADMIN_AI_PREFERENCES
    );

    expect(response).toMatchObject({
      body: "This is the current unsaved Builder text. No suggestion, apply, artifact, plan, or mutation was created.",
      items: ["Current unsaved Builder draft."],
      state: "ready",
      title: "Draft text preview"
    });
    expect(response).not.toHaveProperty("approvalReceipt");
    expect(response).not.toHaveProperty("artifact");
    expect(response).not.toHaveProperty("plan");
    expect(response).not.toHaveProperty("proposal");

    builderInspection.copyText = "   ";
    const missing = runAdminAICommand(
      getAdminAICommand("create-coach-site.preview-draft-text")!,
      context,
      DEFAULT_ADMIN_AI_PREFERENCES
    );
    expect(missing).toMatchObject({
      items: [],
      state: "missing-data",
      title: "Draft text unavailable"
    });
  });
});

function adminContext(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: ["Open all analytics", "Review selected coach site", "Export table"],
    currentRoute: "/admin/dashboard?view=coach-analytics",
    dataFreshness: "Current",
    dateRange: "July 1-21",
    emptyState: false,
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
        updatedAt: "2026-07-21T10:00:00.000Z"
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
        updatedAt: "2026-07-21T10:00:00.000Z"
      }
    ],
    errors: [],
    filters: { status: "needs-review" },
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
    permissions: ["coach_analytics.view"],
    relatedAPIs: ["/api/admin/analytics-events"],
    registeredActions: [],
    sectionId: "coach-analytics",
    sectionName: "Coach Analytics",
    selectedRows: ["coach-1"],
    userRole: "owner",
    visibleDataSummary: [{ label: "Platform visits", source: "analytics-events", value: 999 }],
    warnings: ["Selected coach needs conversion review."]
  };
}
