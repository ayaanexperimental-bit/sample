import { expect, test } from "@playwright/test";
import {
  ADMIN_V2_ACTIVITY_RANGE_OPTIONS,
  formatAdminV2ActivityDelta,
  getAdminV2ActivityTicks,
  getAdminV2AnalyticsRange,
  getAdminV2NearestActivityIndex,
  normalizeAdminV2ActivityPoints,
  summarizeAdminV2ActivityPoints,
} from "../../lib/admin-v2-activity-chart";
import { getAnalyticsTimeSeriesBucketSize } from "../../lib/server/analytics-events";
import type { AnalyticsTimeSeriesPoint } from "../../lib/analytics-events";

test.describe("Admin V2 real activity chart", () => {
  test("maps every UI range to the real analytics API range", () => {
    expect(ADMIN_V2_ACTIVITY_RANGE_OPTIONS.map((option) => option.label)).toEqual([
      "1D",
      "7D",
      "1M",
      "3M",
      "1Y",
    ]);
    expect(getAdminV2AnalyticsRange("1d")).toBe("today");
    expect(getAdminV2AnalyticsRange("7d")).toBe("7d");
    expect(getAdminV2AnalyticsRange("1m")).toBe("30d");
    expect(getAdminV2AnalyticsRange("3m")).toBe("90d");
    expect(getAdminV2AnalyticsRange("1y")).toBe("365d");
  });

  test("uses adaptive backend density without exceeding the 220 bucket guard", () => {
    const day = 86400;
    const cases = [
      { duration: day, expected: 144 },
      { duration: 7 * day, expected: 168 },
      { duration: 30 * day, expected: 120 },
      { duration: 90 * day, expected: 90 },
      { duration: 365 * day, expected: 122 },
    ];

    for (const item of cases) {
      const bucketSize = getAnalyticsTimeSeriesBucketSize(item.duration);
      const bucketCount = Math.ceil(item.duration / bucketSize);
      expect(bucketCount).toBe(item.expected);
      expect(bucketCount).toBeLessThanOrEqual(220);
    }
  });

  test("normalizes every real bucket exactly once and never fabricates density", () => {
    const input: AnalyticsTimeSeriesPoint[] = [
      point("2026-07-10T00:10:00.000Z", 4, 2, 1, "direct"),
      point("2026-07-10T00:00:00.000Z", 3, 1, 2, "share"),
      point("invalid", 999, 999, 999, "invalid"),
    ];
    const normalized = normalizeAdminV2ActivityPoints(input);

    expect(normalized).toHaveLength(2);
    expect(normalized.map((item) => item.currentVisits)).toEqual([3, 4]);
    expect(normalized.map((item) => item.bucketStart)).toEqual([
      "2026-07-10T00:00:00.000Z",
      "2026-07-10T00:10:00.000Z",
    ]);
    expect(normalized.every((item) => !("isInterpolated" in item))).toBe(true);
  });

  test("keeps summaries, ticks, nearest point, and delta synchronized", () => {
    const normalized = normalizeAdminV2ActivityPoints([
      point("2026-07-10T00:00:00.000Z", 3, 1, 2, "share"),
      point("2026-07-10T00:10:00.000Z", 7, 2, 4, "share"),
      point("2026-07-10T00:20:00.000Z", 2, 6, 1, "direct"),
    ]);
    const summary = summarizeAdminV2ActivityPoints(normalized);

    expect(summary.visits).toBe(12);
    expect(summary.registerClicks).toBe(7);
    expect(summary.bestSource).toBe("share");
    expect(summary.peakWindow).toContain("10 Jul");
    expect(getAdminV2ActivityTicks(57)).toEqual([0, 20, 40, 60]);
    expect(getAdminV2NearestActivityIndex(168, 0)).toBe(0);
    expect(getAdminV2NearestActivityIndex(168, 0.5)).toBe(84);
    expect(getAdminV2NearestActivityIndex(168, 1)).toBe(167);
    expect(formatAdminV2ActivityDelta(7, 2)).toBe("+5 (+250.0%)");
  });
});

function point(
  bucketStart: string,
  currentVisits: number,
  previousRangeVisits: number,
  registerClicks: number,
  source: string
): AnalyticsTimeSeriesPoint {
  const timestamp = Date.parse(bucketStart);
  return {
    bucketEnd: Number.isFinite(timestamp)
      ? new Date(timestamp + 10 * 60 * 1000).toISOString()
      : "invalid",
    bucketStart,
    currentVisits,
    previousRangeRegisterClicks: 0,
    previousRangeVisits,
    registerClicks,
    source,
  };
}
