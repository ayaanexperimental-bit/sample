import { expect, test } from "@playwright/test";
import {
  DEFAULT_ADMIN_AI_PREFERENCES,
  applyApprovedAdminAIPreferenceCorrections,
  buildAdminAIMemoryGuidance,
  loadAdminAIPreferences,
  normalizeAdminAIPreferences,
  saveAdminAIPreferences
} from "../../lib/admin-ai/adminAIMemory";

test.describe("Admin AI safe preference memory", () => {
  test("persists only the opt-out marker when safe memory is disabled", () => {
    const storage = memoryStorage();
    const disabled = {
      ...DEFAULT_ADMIN_AI_PREFERENCES,
      memoryEnabled: false,
      preferredLanguage: "hi" as const,
      reportStyle: "detailed" as const,
      responseLength: "detailed" as const
    };

    expect(saveAdminAIPreferences(storage, disabled)).toBe(true);
    expect(storage.getItem("yw-admin-ai-preferences-v1")).toBe(
      JSON.stringify({ memoryEnabled: false })
    );
    expect(loadAdminAIPreferences(storage)).toEqual({
      ...DEFAULT_ADMIN_AI_PREFERENCES,
      memoryEnabled: false
    });
  });

  test("persists the allowlisted preference schema when memory is enabled", () => {
    const storage = memoryStorage();
    expect(
      saveAdminAIPreferences(storage, {
        ...DEFAULT_ADMIN_AI_PREFERENCES,
        preferredLanguage: "hi",
        reportFormat: "summary"
      })
    ).toBe(true);
    expect(loadAdminAIPreferences(storage)).toMatchObject({
      memoryEnabled: true,
      preferredLanguage: "hi",
      reportFormat: "summary"
    });
    expect(storage.getItem("yw-admin-ai-preferences-v1")).not.toContain("secret");
  });

  test("learns approved structured patterns and derives duplicate and triage guidance", () => {
    const learned = applyApprovedAdminAIPreferenceCorrections(DEFAULT_ADMIN_AI_PREFERENCES, [
      approvedCorrection("known-issue-classification", {
        bugCategory: "authentication",
        occurrences: 3
      }),
      approvedCorrection("known-issue-classification", {
        bugCategory: "authentication",
        occurrences: 2
      }),
      approvedCorrection("workflow-preference", { uiPainPoint: "table-filtering" }),
      approvedCorrection("preferred-wording", {
        copyStyle: "direct",
        rejectedPhrasingPattern: "generic-intro"
      }),
      approvedCorrection("report-interpretation", {
        coachReportStyle: "concise-metrics-first",
        recommendationPriority: "reliability"
      })
    ]);
    const storage = memoryStorage();
    expect(saveAdminAIPreferences(storage, learned)).toBe(true);
    const reloaded = loadAdminAIPreferences(storage);

    expect(reloaded.safeLearning).toEqual({
      bugCategories: ["authentication"],
      coachReportStyle: "concise-metrics-first",
      copyStyle: "direct",
      recommendationPriorities: ["reliability"],
      rejectedPhrasingPatterns: ["generic-intro"],
      repeatedIssues: [{ category: "authentication", occurrences: 5 }],
      uiPainPoints: ["table-filtering"]
    });
    expect(buildAdminAIMemoryGuidance(reloaded)).toEqual({
      coachReportStyle: "concise-metrics-first",
      copyStyle: "direct",
      duplicateIssueCategories: ["authentication"],
      recommendationPriorities: ["reliability", "safety"],
      rejectedPhrasingPatterns: ["generic-intro"],
      repeatedErrorTriage: [{ category: "authentication", occurrences: 5 }],
      uiPainPoints: ["table-filtering"]
    });
  });

  test("rejects free-form or sensitive learning and forgets learning while opted out", () => {
    const unsafe = normalizeAdminAIPreferences({
      safeLearning: {
        bugCategories: ["authentication", "owner-secret-token"],
        coachReportStyle: "raw coach prompt",
        copyStyle: "owner@example.com",
        recommendationPriorities: ["safety", "call +91 98765 43210"],
        rejectedPhrasingPatterns: ["generic-intro", "paste the private prompt"],
        repeatedIssues: [
          { category: "payment", occurrences: 4, rawPrompt: "card 4111 1111 1111 1111" },
          { category: "private admin note", occurrences: 9 }
        ],
        secret: "sk_live_1234567890123456",
        uiPainPoints: ["table-filtering", "private coach note"]
      }
    } as never);
    const corrected = applyApprovedAdminAIPreferenceCorrections(unsafe, [
      approvedCorrection("known-issue-classification", {
        bugCategory: "publishing",
        occurrences: 2,
        prompt: "store this raw failure text"
      }),
      approvedCorrection("preferred-wording", {
        copyStyle: "professional",
        secret: "owner-secret-token"
      })
    ]);
    const storage = memoryStorage();

    expect(corrected.safeLearning).toEqual({
      bugCategories: ["authentication"],
      coachReportStyle: "concise-actions-first",
      copyStyle: "concise",
      recommendationPriorities: ["safety"],
      rejectedPhrasingPatterns: ["generic-intro"],
      repeatedIssues: [{ category: "payment", occurrences: 4 }],
      uiPainPoints: ["table-filtering"]
    });
    expect(saveAdminAIPreferences(storage, corrected)).toBe(true);
    const persisted = storage.getItem("yw-admin-ai-preferences-v1") || "";
    expect(persisted).not.toMatch(/secret|prompt|owner@|98765|4111|sk_live|private/i);

    const optedOut = applyApprovedAdminAIPreferenceCorrections(
      { ...corrected, memoryEnabled: false },
      [
        approvedCorrection("known-issue-classification", {
          bugCategory: "publishing",
          occurrences: 2
        })
      ]
    );
    expect(optedOut.safeLearning).toEqual(DEFAULT_ADMIN_AI_PREFERENCES.safeLearning);
  });
});

function approvedCorrection(
  category:
    | "known-issue-classification"
    | "preferred-wording"
    | "report-interpretation"
    | "workflow-preference",
  correction: Record<string, unknown>
) {
  return {
    automaticRetraining: false,
    category,
    correction: JSON.stringify(correction),
    reviewStatus: "approved" as const,
    securityOverride: false
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
