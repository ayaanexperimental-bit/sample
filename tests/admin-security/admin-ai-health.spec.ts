import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  ADMIN_AI_ANOMALY_CATEGORIES,
  ADMIN_AI_HEALTH_CATEGORIES,
  ADMIN_AI_HEALTH_SAFE_ACTION_IDS,
  ADMIN_AI_HEALTH_SCORE_DIMENSIONS,
  ADMIN_AI_HEALTH_SEVERITIES,
  analyzeAdminAIAnomalies,
  buildAdminAIHealthAlerts,
  buildAdminAIHealthScore,
  type AdminAIAnomalyHistoryInput,
  type AdminAIHealthEvidenceInput,
  type AdminAIHealthScoreDimensionInput
} from "../../lib/admin-ai/adminAIHealth";
import { getAdminAICommand } from "../../lib/admin-ai/adminAIRegistry";
import { countAdminAIProactiveSignals } from "../../lib/admin-ai/adminAIProactiveSignals";

const FIRST_DETECTED = "2026-07-20T08:00:00.000Z";
const LAST_DETECTED = "2026-07-21T08:00:00.000Z";

function evidence(summary: string) {
  return [
    {
      observedAt: LAST_DETECTED,
      source: "admin-observability",
      summary,
      value: 3
    }
  ] as const;
}

function healthEvidence(
  category: (typeof ADMIN_AI_HEALTH_CATEGORIES)[number]["id"],
  index = 0
): AdminAIHealthEvidenceInput {
  return {
    affectedEntity: `entity-${index}`,
    category,
    directRoute: "/admin/dashboard?view=overview",
    evidence: evidence(`Observed ${category}`),
    firstDetected: FIRST_DETECTED,
    id: `health-${index}`,
    lastDetected: LAST_DETECTED,
    impact: "The affected admin workflow may be delayed.",
    module: "overview",
    recurrenceCount: index + 1,
    safeActionId: "global.investigate",
    severity: "medium",
    suggestedNextStep: "Verify the source records before taking action.",
    whatHappened: `Detected ${category}`
  };
}

function anomalyHistory(
  category: (typeof ADMIN_AI_ANOMALY_CATEGORIES)[number]["id"],
  index = 0
): AdminAIAnomalyHistoryInput {
  const direction = ["unexpected-traffic-drop", "conversion-collapse"].includes(category)
    ? "decrease"
    : "increase";
  const baselineObservations = Array.from({ length: 30 }, (_, observationIndex) => ({
    observedAt: new Date(Date.parse(FIRST_DETECTED) + observationIndex * 60_000).toISOString(),
    source: "admin-observability",
    summary: `Historical observation ${observationIndex + 1} for ${category}`,
    value: 100
  }));
  return {
    affectedEntity: `entity-${index}`,
    baselineDescription: "Trailing 30-day daily average",
    baselineObservations,
    category,
    direction,
    id: `anomaly-${index}`,
    minimumBaselineSize: 14,
    module: "coach-analytics",
    observed: {
      observedAt: LAST_DETECTED,
      source: "admin-observability",
      summary: `Current source observation for ${category}`,
      value: direction === "decrease" ? 40 : 160
    },
    recommendedVerification: "Compare the raw event stream with the analytics aggregate.",
    thresholdPercent: 30
  };
}

function scoreDimension(
  dimension: (typeof ADMIN_AI_HEALTH_SCORE_DIMENSIONS)[number]["id"],
  score: number
): AdminAIHealthScoreDimensionInput {
  return {
    calculation: `${score} verified healthy units out of 100`,
    dimension,
    exactInputs: [
      {
        label: "Verified health units",
        observedAt: LAST_DETECTED,
        source: "admin-health-source",
        value: score
      }
    ],
    howToImprove: [`Resolve the verified ${dimension} failures.`],
    missingInputs: [],
    score,
    weight: 1
  };
}

test.describe("Admin AI health intelligence", () => {
  test("counts typed health evidence and exact analytics anomalies as proactive pill signals", () => {
    const count = countAdminAIProactiveSignals({
      errors: ["Current source failure"],
      intelligence: {
        analyticsPoints: [
          {
            bucketEnd: "2026-07-21T23:59:59.000Z",
            bucketStart: "2026-07-21T00:00:00.000Z",
            currentRegistrationClicks: 4,
            currentVisits: 60,
            previousRegistrationClicks: 5,
            previousVisits: 100,
            source: "analytics-events",
            sourceAttributed: true
          }
        ],
        healthEvidence: [healthEvidence("missing-backup-destination")]
      },
      lastUpdated: LAST_DETECTED,
      warnings: ["Current operational warning"]
    });

    expect(count).toBe(4);
  });

  test("exposes every authoritative health category and all five severities", () => {
    expect(ADMIN_AI_HEALTH_CATEGORIES.map(({ label }) => label)).toEqual([
      "Failed publishes",
      "Repeated API failures",
      "Payment-success/publish-pending mismatches",
      "Broken public routes",
      "Invalid CTA links",
      "Missing registration links",
      "Unusually high error count",
      "Backup failures",
      "Missing backup destination",
      "Backup delay",
      "Analytics ingestion failures",
      "Stale drafts",
      "Sites without recent analytics",
      "Unusual permission changes",
      "Repeated failed OTP attempts",
      "Admin action failure spikes"
    ]);
    expect(ADMIN_AI_HEALTH_SEVERITIES).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "informational"
    ]);
  });

  test("keeps its safe action allowlist registered and non-mutating", () => {
    for (const actionId of ADMIN_AI_HEALTH_SAFE_ACTION_IDS) {
      const command = getAdminAICommand(actionId);
      expect(command?.id).toBe(actionId);
      expect(["read", "suggest"]).toContain(command?.type);
    }
  });

  test("creates complete evidence-backed alerts for every health category", () => {
    const alerts = buildAdminAIHealthAlerts(
      ADMIN_AI_HEALTH_CATEGORIES.map(({ id }, index) => healthEvidence(id, index))
    );

    expect(alerts).toHaveLength(ADMIN_AI_HEALTH_CATEGORIES.length);
    expect(new Set(alerts.map(({ category }) => category))).toEqual(
      new Set(ADMIN_AI_HEALTH_CATEGORIES.map(({ id }) => id))
    );
    for (const alert of alerts) {
      expect(alert.affectedEntity).toBeTruthy();
      expect(alert.module).toBe("overview");
      expect(alert.evidence.length).toBeGreaterThan(0);
      expect(alert.firstDetected).toBe(FIRST_DETECTED);
      expect(alert.lastDetected).toBe(LAST_DETECTED);
      expect(alert.recurrenceCount).toBeGreaterThan(0);
      expect(alert.impact).toBeTruthy();
      expect(alert.suggestedNextStep).toBeTruthy();
      expect(alert.directRoute).toMatch(/^\/admin/);
      expect(alert.safeActionId).toBe("global.investigate");
    }
  });

  test("emits no alert without evidence and strips actions outside the registered safe allowlist", () => {
    const noEvidence = {
      ...healthEvidence("failed-publishes", 1),
      evidence: []
    } satisfies AdminAIHealthEvidenceInput;
    const unsafeAction = {
      ...healthEvidence("unusually-high-error-count", 2),
      safeActionId: "error-reports.mark-reviewing"
    } as unknown as AdminAIHealthEvidenceInput;
    const safeAction = {
      ...healthEvidence("unusually-high-error-count", 3),
      safeActionId: "error-reports.triage"
    } satisfies AdminAIHealthEvidenceInput;

    const alerts = buildAdminAIHealthAlerts([noEvidence, unsafeAction, safeAction]);

    expect(alerts).toHaveLength(2);
    expect(alerts.find(({ id }) => id === unsafeAction.id)?.safeActionId).toBeNull();
    expect(alerts.find(({ id }) => id === safeAction.id)?.safeActionId).toBe(
      "error-reports.triage"
    );
  });

  test("supports every authoritative anomaly category with the required explanation", () => {
    expect(ADMIN_AI_ANOMALY_CATEGORIES.map(({ label }) => label)).toEqual([
      "Unexpected traffic drop",
      "Click spike",
      "Conversion collapse",
      "Repeated publish failure",
      "Payment mismatch",
      "Unusually frequent admin edits",
      "Sudden rise in 404 errors",
      "Repeated OTP failure",
      "Unusual role change",
      "Backup delay",
      "Analytics event interruption"
    ]);

    const histories = ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }, index) => anomalyHistory(id, index));
    const result = analyzeAdminAIAnomalies({ histories });

    expect(result.status).toBe("ready");
    expect(result.message).toBeNull();
    expect(result.anomalies).toHaveLength(ADMIN_AI_ANOMALY_CATEGORIES.length);
    for (const anomaly of result.anomalies) {
      expect(anomaly.detectionMethod).toBeTruthy();
      expect(anomaly.baseline.description).toBeTruthy();
      expect(anomaly.observedValue).toBeGreaterThan(0);
      expect(anomaly.deviation).toMatch(/60% (?:above|below) baseline/);
      expect(anomaly.confidence).toBe("high");
      expect(anomaly.dataRange.from).toBeTruthy();
      expect(anomaly.dataRange.to).toBeTruthy();
      expect(anomaly.recommendedVerification).toBeTruthy();
      expect(anomaly.evidence.length).toBeGreaterThan(0);
    }
    expect(histories.every((history) => !("detected" in history))).toBe(true);
  });

  test("reports Insufficient baseline instead of inventing an anomaly", () => {
    const insufficient = {
      ...anomalyHistory("unexpected-traffic-drop"),
      baselineDescription: "Only one historical bucket",
      baselineObservations: [
        {
          observedAt: FIRST_DETECTED,
          source: "admin-observability",
          summary: "Only one historical observation is available.",
          value: 100
        }
      ]
    } satisfies AdminAIAnomalyHistoryInput;

    const result = analyzeAdminAIAnomalies({ histories: [insufficient] });

    expect(result.status).toBe("insufficient-baseline");
    expect(result.message).toBe("Insufficient baseline");
    expect(result.insufficientBaselineCategories).toEqual(
      ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }) => id)
    );
    expect(result.anomalies).toEqual([]);
  });

  test("builds the eight exact, explainable health-score dimensions", () => {
    const scores = [80, 90, 70, 100, 60, 50, 100, 90] as const;
    const result = buildAdminAIHealthScore({
      calculatedAt: LAST_DETECTED,
      dimensions: ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id }, index) =>
        scoreDimension(id, scores[index])
      )
    });

    expect(result.components.map(({ label }) => label)).toEqual([
      "Site health",
      "Publish health",
      "Payment reconciliation",
      "Analytics reliability",
      "Error backlog",
      "Backup freshness",
      "Security configuration",
      "Data completeness"
    ]);
    expect(result.score).toBe(80);
    expect(result.calculation).toBe(
      "Weighted average of 8 component scores using caller-supplied weights (total weight: 8)."
    );
    expect(result.missingInputs).toEqual([]);
    expect(result.calculatedAt).toBe(LAST_DETECTED);
    for (const component of result.components) {
      expect(component.exactInputs.length).toBeGreaterThan(0);
      expect(component.calculation).toBeTruthy();
      expect(component.howToImprove.length).toBeGreaterThan(0);
      expect(component.missingInputs).toEqual([]);
      expect(component.weight).toBe(1);
    }
  });

  test("exposes per-component improvement guidance through the shared response contract", () => {
    const responseTypes = readFileSync(
      resolve(process.cwd(), "lib/admin-ai/adminAITypes.ts"),
      "utf8"
    );
    const componentType = responseTypes.slice(
      responseTypes.indexOf("export type AdminAIHealthScoreComponent"),
      responseTypes.indexOf("export type AdminAIHealthScore =")
    );
    const result = buildAdminAIHealthScore({
      calculatedAt: LAST_DETECTED,
      dimensions: ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id }) => scoreDimension(id, 90))
    });

    expect(componentType).toContain("howToImprove: string[];");
    expect(result.components.map(({ howToImprove }) => howToImprove)).toEqual(
      ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id }) => [`Resolve the verified ${id} failures.`])
    );
  });

  test("does not invent a total-score weighting policy", () => {
    const dimensions = ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id }) => scoreDimension(id, 90));
    dimensions[0] = {
      ...dimensions[0],
      weight: undefined
    } as unknown as AdminAIHealthScoreDimensionInput;

    const result = buildAdminAIHealthScore({
      calculatedAt: LAST_DETECTED,
      dimensions
    });

    expect(result.score).toBeNull();
    expect(result.calculation).toBeNull();
    expect(result.missingInputs).toContain("Site health weight greater than 0");
  });

  test("keeps an incomplete health score honest instead of fabricating values", () => {
    const supplied = ADMIN_AI_HEALTH_SCORE_DIMENSIONS.slice(0, -1).map(({ id }) =>
      scoreDimension(id, 90)
    );
    supplied[0] = {
      ...supplied[0],
      missingInputs: ["Public route probe"]
    };

    const result = buildAdminAIHealthScore({
      calculatedAt: LAST_DETECTED,
      dimensions: supplied
    });

    expect(result.components).toHaveLength(8);
    expect(result.score).toBeNull();
    expect(result.components[0].score).toBeNull();
    expect(result.components.at(-1)?.score).toBeNull();
    expect(result.missingInputs).toContain("Public route probe");
    expect(result.missingInputs).toContain("Data completeness score and exact inputs");
    expect(result.components.at(-1)?.howToImprove.length).toBeGreaterThan(0);
  });

  test("is deterministic and does not mutate caller-owned evidence", () => {
    const input = healthEvidence("backup-failures");
    const snapshot = structuredClone(input);

    const first = buildAdminAIHealthAlerts([input]);
    const second = buildAdminAIHealthAlerts([input]);

    expect(first).toEqual(second);
    expect(input).toEqual(snapshot);
  });
});
