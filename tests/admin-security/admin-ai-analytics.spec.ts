import { expect, test } from "@playwright/test";
import {
  analyzeSelectedSitePerformance,
  explainAdminAIAnalytics
} from "../../lib/admin-ai/adminAIAnalytics";

test.describe("Admin AI analytics explanation", () => {
  test("grounds trends, peaks, drops, comparisons, and anomalies in exact windows", () => {
    const result = explainAdminAIAnalytics({
      points: [
        {
          bucketEnd: "2026-07-20T08:00:00.000Z",
          bucketStart: "2026-07-20T07:00:00.000Z",
          currentRegistrationClicks: 10,
          currentVisits: 100,
          previousRegistrationClicks: 12,
          previousVisits: 80,
          source: "WhatsApp",
          sourceAttributed: true
        },
        {
          bucketEnd: "2026-07-20T09:00:00.000Z",
          bucketStart: "2026-07-20T08:00:00.000Z",
          currentRegistrationClicks: 9,
          currentVisits: 180,
          previousRegistrationClicks: 13,
          previousVisits: 120,
          source: "WhatsApp",
          sourceAttributed: true
        },
        {
          bucketEnd: "2026-07-20T10:00:00.000Z",
          bucketStart: "2026-07-20T09:00:00.000Z",
          currentRegistrationClicks: 7,
          currentVisits: 90,
          previousRegistrationClicks: 8,
          previousVisits: 100,
          source: "Direct",
          sourceAttributed: true
        }
      ],
      refreshedAt: "2026-07-20T10:48:00.000Z",
      now: "2026-07-20T11:00:00.000Z"
    });

    expect(result.status).toBe("ready");
    expect(result.trend).toMatchObject({
      currentRegistrationClicks: 26,
      currentVisits: 370,
      previousRegistrationClicks: 33,
      previousVisits: 300,
      registrationClicksChangePercent: -21.2,
      visitsChangePercent: 23.3
    });
    expect(result.importantWindows).toEqual([
      expect.objectContaining({
        bucketEnd: "2026-07-20T09:00:00.000Z",
        bucketStart: "2026-07-20T08:00:00.000Z",
        change: 80,
        kind: "peak"
      }),
      expect.objectContaining({
        bucketEnd: "2026-07-20T10:00:00.000Z",
        bucketStart: "2026-07-20T09:00:00.000Z",
        change: -90,
        kind: "drop"
      })
    ]);
    expect(result.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseline: 13,
          dataRange: "2026-07-20T08:00:00.000Z to 2026-07-20T09:00:00.000Z",
          detectionMethod: "Current bucket versus the matching previous-period bucket",
          observedValue: 9,
          type: "conversion-collapse"
        })
      ])
    );
    expect(result.evidence).toMatchObject({
      dataRange: "2026-07-20T07:00:00.000Z to 2026-07-20T10:00:00.000Z",
      freshness: "Refreshed 12 minutes ago"
    });
    expect(result.sourceComparison).toEqual({
      differenceFromOverallPercent: -0.2,
      highestTrafficSource: "WhatsApp",
      highestTrafficSourceConversionPercent: 6.8,
      highestTrafficSourceVisits: 280,
      message:
        "WhatsApp supplied the most attributed traffic and converted 0.2 percentage points below the site average.",
      overallConversionPercent: 7,
      status: "available"
    });
    expect(result.correlation?.caveat).toContain("does not establish causation");
    expect(result.investigationSteps.length).toBeGreaterThan(0);
  });

  test("reports source conversion and missing-data warnings without inventing facts", () => {
    const result = explainAdminAIAnalytics({
      points: [
        {
          bucketEnd: "2026-07-20T08:00:00.000Z",
          bucketStart: "2026-07-20T07:00:00.000Z",
          currentRegistrationClicks: 4,
          currentVisits: 100,
          previousRegistrationClicks: null,
          previousVisits: null,
          source: "WhatsApp",
          sourceAttributed: true
        },
        {
          bucketEnd: "2026-07-20T09:00:00.000Z",
          bucketStart: "2026-07-20T08:00:00.000Z",
          currentRegistrationClicks: 10,
          currentVisits: 100,
          previousRegistrationClicks: null,
          previousVisits: null,
          source: "Direct",
          sourceAttributed: true
        }
      ]
    });

    expect(result.status).toBe("insufficient-baseline");
    expect(result.sourcePerformance).toEqual([
      { conversionPercent: 10, registrationClicks: 10, source: "Direct", visits: 100 },
      { conversionPercent: 4, registrationClicks: 4, source: "WhatsApp", visits: 100 }
    ]);
    expect(result.missingDataWarnings).toContain(
      "Previous-period visits and registration clicks are unavailable for 2 of 2 buckets."
    );
    expect(result.trend.visitsChangePercent).toBeNull();
  });

  test("does not infer traffic-source performance from non-attributed bucket labels", () => {
    const result = explainAdminAIAnalytics({
      points: [
        {
          bucketEnd: "2026-07-20T08:00:00.000Z",
          bucketStart: "2026-07-20T07:00:00.000Z",
          currentRegistrationClicks: 10,
          currentVisits: 100,
          previousRegistrationClicks: 8,
          previousVisits: 100,
          source: "d1_analytics_events"
        }
      ]
    });

    expect(result.sourcePerformance).toEqual([]);
    expect(result.sourceComparison).toEqual({
      differenceFromOverallPercent: null,
      highestTrafficSource: null,
      highestTrafficSourceConversionPercent: null,
      highestTrafficSourceVisits: null,
      message:
        "Traffic-source attribution is unavailable for one or more buckets, so no source-versus-site conversion comparison was inferred.",
      overallConversionPercent: 10,
      status: "unavailable"
    });
  });

  test("returns an honest empty result when no analytics buckets are available", () => {
    expect(explainAdminAIAnalytics({ points: [] })).toMatchObject({
      anomalies: [],
      importantWindows: [],
      missingDataWarnings: ["No analytics buckets are available for this chart."],
      status: "insufficient-baseline"
    });
  });

  test("explains selected-site performance from five distinct trusted evidence categories", () => {
    const result = analyzeSelectedSitePerformance({
      filters: { period: "last-30-days", region: "west" },
      now: "2026-07-21T12:00:00.000Z",
      payment: {
        source: "shop-orders",
        status: "paid",
        updatedAt: "2026-07-21T10:00:00.000Z"
      },
      permissionVisible: true,
      publishState: {
        source: "coach-sites",
        status: "draft",
        updatedAt: "2026-07-21T10:00:00.000Z"
      },
      refreshedAt: "2026-07-21T11:00:00.000Z",
      registrationConversion: {
        currentRegistrations: 3,
        currentVisits: 60,
        dateRange: "2026-06-22 to 2026-07-21",
        previousRegistrations: 10,
        previousVisits: 100,
        source: "analytics-events"
      },
      selectedCoach: { id: "coach-7", name: "Asha" },
      selectedSite: { id: "site-9", name: "Asha Wellness" },
      traffic: {
        currentVisits: 60,
        dateRange: "2026-06-22 to 2026-07-21",
        previousVisits: 100,
        source: "analytics-events"
      }
    });

    expect(result.status).toBe("ready");
    expect(result.selectedCoach).toEqual({ id: "coach-7", name: "Asha" });
    expect(result.selectedSite).toEqual({ id: "site-9", name: "Asha Wellness" });
    expect(
      result.factors.map(({ category, classification }) => [category, classification])
    ).toEqual([
      ["traffic", "cause"],
      ["registration-conversion", "cause"],
      ["payment", "not-indicated"],
      ["publish-state", "cause"],
      ["freshness", "not-indicated"]
    ]);
    expect(result.missingEvidence).toEqual([]);
    expect(result.provenance).toEqual({
      filters: { period: "last-30-days", region: "west" },
      permissionVisible: true
    });
    expect(result.caveat).toContain("does not infer deployment or code facts");
  });

  test("does not widen scope or invent causes when selection or evidence is missing", () => {
    const noSelection = analyzeSelectedSitePerformance({
      filters: {},
      permissionVisible: true
    });
    expect(noSelection).toMatchObject({
      factors: [],
      missingEvidence: ["selected-coach", "selected-site"],
      selectedCoach: null,
      selectedSite: null,
      status: "insufficient-evidence"
    });

    const partial = analyzeSelectedSitePerformance({
      filters: {},
      permissionVisible: true,
      selectedCoach: { id: "coach-7", name: "Asha" },
      selectedSite: { id: "site-9", name: "Asha Wellness" },
      traffic: {
        currentVisits: 100,
        dateRange: "2026-06-22 to 2026-07-21",
        previousVisits: 100,
        source: "analytics-events"
      }
    });
    expect(partial.status).toBe("insufficient-evidence");
    expect(partial.missingEvidence).toEqual([
      "registration-conversion",
      "payment",
      "publish-state",
      "freshness"
    ]);
    expect(partial.factors).toEqual([
      expect.objectContaining({ category: "traffic", classification: "not-indicated" })
    ]);
  });
});
