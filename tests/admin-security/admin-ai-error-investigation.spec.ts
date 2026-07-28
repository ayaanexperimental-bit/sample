import { expect, test } from "@playwright/test";
import {
  ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS,
  detectStaleAdminAIError,
  investigateAdminAIError,
  resolveTrustedAdminAIErrorModule
} from "../../lib/admin-ai/adminAIErrorInvestigation";

const reports = [
  {
    affectedEntity: "coach:gyana",
    changeSummary: "Analytics route validation changed",
    createdAt: "2026-07-20T09:00:00.000Z",
    deployId: "deploy-123",
    errorCode: "YW-API-001",
    module: "coach-analytics",
    referenceId: "ERR-1",
    route: "/admin/dashboard?view=coach-analytics",
    safeMessage: "Analytics request returned a safe API failure.",
    severity: "high" as const,
    sourceFiles: ["functions/api/admin/analytics-events.ts"],
    sourceFilesTrusted: true
  },
  {
    affectedEntity: "coach:maya",
    createdAt: "2026-07-20T09:10:00.000Z",
    errorCode: "YW-API-001",
    module: "coach-analytics",
    referenceId: "ERR-2",
    route: "/admin/dashboard?view=coach-analytics",
    safeMessage: "The same analytics request failed.",
    severity: "medium" as const,
    sourceFiles: [],
    sourceFilesTrusted: false
  },
  {
    affectedEntity: "shop:order-1",
    createdAt: "2026-07-20T09:20:00.000Z",
    errorCode: "YW-PAY-002",
    module: "shop",
    referenceId: "ERR-3",
    route: "/admin/dashboard?view=shop",
    safeMessage: "Unrelated payment failure.",
    severity: "high" as const,
    sourceFiles: [],
    sourceFilesTrusted: false
  }
];

test.describe("Admin AI selected-error investigation", () => {
  test("builds the complete developer artifact from the selected error only", () => {
    const result = investigateAdminAIError({ reports, selectedReferenceId: "ERR-1" });

    expect(result).toMatchObject({
      affectedUsersOrEntities: ["coach:gyana", "coach:maya"],
      impactSummary:
        "High-severity error in coach-analytics on /admin/dashboard?view=coach-analytics. The selected and related permission-visible reports represent 2 affected entities and 1 related error.",
      relatedErrors: ["ERR-2"],
      resolutionStatus: "Investigated, not fixed",
      severity: "high",
      summary: expect.stringContaining("ERR-1")
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        "Route: /admin/dashboard?view=coach-analytics",
        "Module: coach-analytics",
        "Deploy: deploy-123",
        "Trusted likely source file: functions/api/admin/analytics-events.ts"
      ])
    );
    expect(result.likelyCause).toContain("Likely");
    expect(result.reproduction.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendedFix).toContain("verify");
    expect(result.safeTemporaryAction).toContain("does not mutate");
    expect(JSON.stringify(result)).not.toContain("ERR-3");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("fixed and tested");
  });

  test("marks unavailable deploy and code evidence instead of fabricating it", () => {
    const result = investigateAdminAIError({ reports, selectedReferenceId: "ERR-2" });

    expect(result.evidence).toContain("Recent deploy/change metadata: Unavailable");
    expect(result.evidence).toContain("Likely source files: Unavailable");
    expect(result.resolutionStatus).toBe("Investigated, not fixed");
  });

  test("derives affected modules only from trusted route mappings", () => {
    expect(resolveTrustedAdminAIErrorModule("/admin/dashboard?view=coach-analytics")).toBe(
      "coach-analytics"
    );
    expect(resolveTrustedAdminAIErrorModule("/api/admin/coach-sites/publish")).toBe("coach-sites");
    expect(
      resolveTrustedAdminAIErrorModule("//attacker.example/admin/dashboard?view=shop")
    ).toBeNull();
    expect(resolveTrustedAdminAIErrorModule("/admin/dashboard?view=../../secrets")).toBeNull();

    const result = investigateAdminAIError({
      reports: [
        {
          ...reports[0],
          module: "error-reports",
          route: "/api/admin/coach-sites/publish"
        }
      ],
      selectedReferenceId: "ERR-1"
    });

    expect(result.evidence).toContain("Module: coach-sites");
    expect(result.impactSummary).toContain("error in coach-sites");
  });

  test("returns a bounded missing-selection result without widening scope", () => {
    const result = investigateAdminAIError({ reports, selectedReferenceId: "UNKNOWN" });

    expect(result).toMatchObject({
      affectedUsersOrEntities: [],
      evidence: [],
      impactSummary: "Impact unavailable because the selected error is not permission-visible.",
      relatedErrors: [],
      resolutionStatus: "Investigated, not fixed",
      status: "missing-selected-error"
    });
  });
});

test.describe("Admin AI stale-error detection", () => {
  test("classifies a trusted unresolved error as stale at the explicit 30-day threshold", () => {
    const result = detectStaleAdminAIError({
      evaluatedAt: "2026-07-21T12:00:00.000Z",
      report: {
        ...reports[0],
        status: "Reviewing",
        statusTrusted: true,
        updatedAt: "2026-06-21T12:00:00.000Z"
      }
    });

    expect(ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS).toBe(30);
    expect(result).toMatchObject({
      classification: "stale",
      evaluatedAt: "2026-07-21T12:00:00.000Z",
      referenceId: "ERR-1",
      reportStatus: "Reviewing",
      thresholdDays: 30,
      updatedAt: "2026-06-21T12:00:00.000Z"
    });
    expect(result.evidence).toEqual([
      "Trusted status: Reviewing",
      "Last updated: 2026-06-21T12:00:00.000Z",
      "Stale threshold: 30 days"
    ]);
    expect(JSON.stringify(result).toLowerCase()).not.toMatch(/deploy|source file|code change/);
  });

  test("does not mark a trusted unresolved error stale before the threshold", () => {
    const result = detectStaleAdminAIError({
      evaluatedAt: "2026-07-21T11:59:59.999Z",
      report: {
        ...reports[0],
        status: "New",
        statusTrusted: true,
        updatedAt: "2026-06-21T12:00:00.000Z"
      }
    });

    expect(result.classification).toBe("current");
  });

  test("excludes a resolved error only when trusted resolution evidence is explicit", () => {
    const result = detectStaleAdminAIError({
      evaluatedAt: "2026-07-21T12:00:00.000Z",
      report: {
        ...reports[0],
        resolutionEvidence: {
          resolvedAt: "2026-07-20T10:00:00.000Z",
          summary: "The protected request was reproduced and verified after the fix.",
          trusted: true
        },
        status: "Fixed",
        statusTrusted: true,
        updatedAt: "2026-07-20T10:00:00.000Z"
      }
    });

    expect(result).toMatchObject({
      classification: "resolved-excluded",
      referenceId: "ERR-1",
      reportStatus: "Fixed",
      resolutionEvidence: {
        resolvedAt: "2026-07-20T10:00:00.000Z",
        summary: "The protected request was reproduced and verified after the fix."
      }
    });
  });

  test("returns insufficient evidence for untrusted, missing, or malformed stale inputs", () => {
    const cases = [
      {
        ...reports[0],
        status: "Reviewing" as const,
        statusTrusted: false,
        updatedAt: "2026-06-01T00:00:00.000Z"
      },
      {
        ...reports[0],
        status: "New" as const,
        statusTrusted: true
      },
      {
        ...reports[0],
        status: "New" as const,
        statusTrusted: true,
        updatedAt: "not-a-date"
      },
      {
        ...reports[0],
        status: "Fixed" as const,
        statusTrusted: true,
        updatedAt: "2026-06-01T00:00:00.000Z"
      },
      {
        ...reports[0],
        resolutionEvidence: {
          resolvedAt: "not-a-date",
          summary: "Claimed resolved without valid dated evidence.",
          trusted: true
        },
        status: "Fixed" as const,
        statusTrusted: true,
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ];

    for (const report of cases) {
      expect(
        detectStaleAdminAIError({
          evaluatedAt: "2026-07-21T12:00:00.000Z",
          report
        }).classification
      ).toBe("insufficient-evidence");
    }
  });
});
