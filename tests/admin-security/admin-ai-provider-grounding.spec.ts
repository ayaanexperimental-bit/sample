import { expect, test } from "@playwright/test";
import type { AdminAISectionContext } from "../../lib/admin-ai/adminAIContext";
import { getAdminAIFeatureFlags } from "../../lib/admin-ai/adminAIFeatureFlags";
import { DEFAULT_ADMIN_AI_PREFERENCES } from "../../lib/admin-ai/adminAIMemory";
import {
  runAdminAINaturalLanguageQuery,
  runAdminAINaturalLanguageQueryWithModel
} from "../../lib/admin-ai/adminAIOrchestrator";
import { buildAdminAIRejectedProviderResponse } from "../../lib/admin-ai/adminAIProviderGrounding";

test.describe("Admin AI provider numeric grounding", () => {
  test("rejects unsupported provider numbers and returns the deterministic fallback", async () => {
    const context = createContext();
    const deterministic = runAdminAINaturalLanguageQuery({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      query: "Summarize this page",
      scope: "page"
    });

    const response = await runAdminAINaturalLanguageQueryWithModel({
      context,
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () => "There were 9,999 visits with an 87% conversion rate."
      },
      query: "Summarize this page",
      scope: "page"
    });

    expect(response.body).toBe(deterministic.body);
    expect(response.body).not.toMatch(/9,999|87%/);
    expect(response.confidence).toEqual(deterministic.confidence);
    expect(response.conclusions).toEqual(deterministic.conclusions);
    expect(response.evidence).toEqual(deterministic.evidence);
    expect(response.modelRoute?.reason).toContain("invalid-provider-response");
    expect(response.providerFallbackReason).toBe("invalid-provider-response");
  });

  test("accepts sanitized numeric facts from explicit compatibility requirements", async () => {
    let protectedInput = "";
    const providerText =
      "The 90-day saved-task retention requirement is compatible with the 90-day audit-retention requirement.";
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async (request) => {
          protectedInput = request.input;
          return providerText;
        }
      },
      query:
        "Check whether the 90-day saved-task retention requirement conflicts with the 90-day audit-retention requirement.",
      scope: "global"
    });

    expect(response.body).toContain(`Model-assisted summary: ${providerText}`);
    expect(response.providerFallbackReason).toBeUndefined();
    expect(JSON.parse(protectedInput)).toMatchObject({
      requirementFacts: [
        { id: "requirement-a", unit: "day", value: 90 },
        { id: "requirement-b", unit: "day", value: 90 }
      ],
      task: "requirement-conflict-analysis"
    });
  });

  test("rejects provider numbers that are not in the allowlisted requirement facts", async () => {
    const providerText =
      "The 90-day retention requirement conflicts with a separate 365-day policy.";
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: { openai: async () => providerText },
      query:
        "Check whether the 90-day saved-task retention requirement conflicts with the 90-day audit-retention requirement.",
      scope: "global"
    });

    expect(response.body).not.toContain(providerText);
    expect(response.modelRoute?.reason).toContain("invalid-provider-response");
    expect(response.providerFallbackReason).toBe("invalid-provider-response");
  });

  test("rejects a requirement value when the provider changes its unit", async () => {
    const providerText =
      "The 90-year saved-task retention requirement is compatible with the 90-day audit-retention requirement.";
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: { openai: async () => providerText },
      query:
        "Check whether the 90-day saved-task retention requirement conflicts with the 90-day audit-retention requirement.",
      scope: "global"
    });

    expect(response.body).not.toContain(providerText);
    expect(response.modelRoute?.reason).toContain("invalid-provider-response");
    expect(response.providerFallbackReason).toBe("invalid-provider-response");
  });

  test("removes rejected provider narrative while preserving safe routing metadata", () => {
    expect(
      buildAdminAIRejectedProviderResponse({
        model: "gpt-5.6-luna",
        modelVersion: "2026-07-30",
        output: "Unsupported 365-day policy and sensitive narrative.",
        provider: "openai",
        usage: { inputTokens: 120, outputTokens: 18 }
      })
    ).toEqual({
      model: "gpt-5.6-luna",
      modelVersion: "2026-07-30",
      output: "",
      provider: "openai",
      usage: { inputTokens: 120, outputTokens: 18 }
    });
  });

  test("rejects malformed provider output and exposes a failed-safe reason", async () => {
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () => ({ output: 90 }) as never
      },
      query:
        "Check whether the 90-day saved-task retention requirement conflicts with the 90-day audit-retention requirement.",
      scope: "global"
    });

    expect(response.body).not.toContain("Model-assisted summary:");
    expect(response.modelRoute?.reason).toContain("invalid-provider-response");
    expect(response.providerFallbackReason).toBe("invalid-provider-response");
  });

  test("accepts direct counts and a ratio derived from the protected scoped evidence", async () => {
    const response = await runAdminAINaturalLanguageQueryWithModel({
      context: createContext(),
      featureFlags: getAdminAIFeatureFlags(),
      preferences: DEFAULT_ADMIN_AI_PREFERENCES,
      providers: {
        openai: async () =>
          "There are 4 permission-visible entities and 1 source error, so the error-to-entity ratio is 25%."
      },
      query: "Summarize this page",
      scope: "page"
    });

    expect(response.body).toContain("Model-assisted summary:");
    expect(response.body).toContain("4 permission-visible entities");
    expect(response.body).toContain("25%");
    expect(response.confidence).toEqual({
      level: "medium",
      reason:
        "The response combines a deterministic result with a validated but model-generated narrative."
    });
    expect(response.conclusions).toEqual([
      {
        confidence: {
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence matches coach-sites for this conclusion."
        },
        evidenceSources: ["coach-sites"],
        id: "summary-claim-1",
        text: "Coach sites: 4 (coach-sites)"
      },
      {
        confidence: {
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence matches admin-context for this conclusion."
        },
        evidenceSources: ["admin-context"],
        id: "summary-claim-2",
        text: "Open errors: 1 (admin-context)"
      },
      {
        confidence: {
          level: "medium",
          reason:
            "This model-generated claim passed bounded safety and numeric-grounding checks against /api/admin/dashboard/overview, but should still be verified."
        },
        evidenceSources: ["/api/admin/dashboard/overview"],
        id: "model-assisted-claim-1",
        text: "There are 4 permission-visible entities."
      },
      {
        confidence: {
          level: "medium",
          reason:
            "This model-generated claim passed bounded safety and numeric-grounding checks against /api/admin/dashboard/overview, but should still be verified."
        },
        evidenceSources: ["/api/admin/dashboard/overview"],
        id: "model-assisted-claim-2",
        text: "1 source error."
      },
      {
        confidence: {
          level: "medium",
          reason:
            "This model-generated claim passed bounded safety and numeric-grounding checks against /api/admin/dashboard/overview, but should still be verified."
        },
        evidenceSources: ["/api/admin/dashboard/overview"],
        id: "model-assisted-claim-3",
        text: "The error-to-entity ratio is 25%."
      }
    ]);
    for (const conclusion of response.conclusions || []) {
      expect(conclusion.evidenceSources?.length).toBeGreaterThan(0);
      const allSourcesSupported = conclusion.evidenceSources?.every((source) =>
        response.evidence?.some((item) => item.source === source)
      );
      expect(allSourcesSupported).toBe(conclusion.confidence.level !== "insufficient-data");
    }
  });

  test("rejects unrelated arithmetic and date-range numbers as grounded metrics", async () => {
    for (const providerText of ["There are 5 failed payments.", "There were 21 failed payments."]) {
      const response = await runAdminAINaturalLanguageQueryWithModel({
        context: createContext(),
        featureFlags: getAdminAIFeatureFlags(),
        preferences: DEFAULT_ADMIN_AI_PREFERENCES,
        providers: { openai: async () => providerText },
        query: "Summarize this page",
        scope: "page"
      });

      expect(response.body).not.toContain("Model-assisted summary:");
      expect(response.body).not.toContain(providerText);
      expect(response.modelRoute?.reason).toContain("invalid-provider-response");
    }
  });
});

function createContext(): AdminAISectionContext {
  return {
    analyticsSeries: [],
    availableActions: [],
    currentRoute: "/admin/dashboard?view=overview",
    dataFreshness: "Current",
    dateRange: "July 1-21, 2026",
    emptyState: false,
    entities: Array.from({ length: 4 }, (_, index) => ({
      id: `site-${index + 1}`,
      label: `Coach site ${index + 1}`,
      matchReason: "Permission-visible coach site",
      module: "overview" as const,
      route: `/admin/dashboard?view=coach-sites&site=${index + 1}`,
      searchableText: `coach site ${index + 1}`,
      source: "coach-sites",
      status: "active",
      updatedAt: "2026-07-21T12:00:00.000Z"
    })),
    errors: ["One source is unavailable."],
    filters: {},
    globalContext: {
      emptyState: false,
      errors: [],
      relatedAPIs: [],
      registeredActions: [],
      visibleDataSummary: [],
      warnings: []
    },
    isOwner: true,
    lastUpdated: "2026-07-21T12:00:00.000Z",
    loadingState: false,
    knowledge: [],
    permissions: ["overview.view"],
    relatedAPIs: ["/api/admin/dashboard/overview"],
    registeredActions: [],
    sectionId: "overview",
    sectionName: "Admin Overview",
    selectedRows: [],
    userRole: "owner",
    visibleDataSummary: [
      { label: "Coach sites", source: "coach-sites", value: 4 },
      { label: "Open errors", source: "admin-context", value: 1 }
    ],
    warnings: ["One record needs attention."]
  };
}
