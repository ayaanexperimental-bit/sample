import type { AnalyticsDateRangeId, AnalyticsTimeSeriesPoint } from "./analytics-events";

export type AdminV2ActivityRangeId = "1d" | "1m" | "1y" | "3m" | "7d";

export type AdminV2ActivityPoint = {
  bucketEnd: string;
  bucketStart: string;
  currentVisits: number;
  previousRangeRegisterClicks: number;
  previousRangeVisits: number;
  registerClicks: number;
  source: string;
  timestamp: number;
};

export const ADMIN_V2_ACTIVITY_RANGE_OPTIONS: Array<{
  analyticsRange: AnalyticsDateRangeId;
  id: AdminV2ActivityRangeId;
  label: string;
}> = [
  { analyticsRange: "today", id: "1d", label: "1D" },
  { analyticsRange: "7d", id: "7d", label: "7D" },
  { analyticsRange: "30d", id: "1m", label: "1M" },
  { analyticsRange: "90d", id: "3m", label: "3M" },
  { analyticsRange: "365d", id: "1y", label: "1Y" },
];

export function getAdminV2ActivityRangeId(range: AnalyticsDateRangeId): AdminV2ActivityRangeId {
  if (range === "today") return "1d";
  if (range === "30d") return "1m";
  if (range === "90d") return "3m";
  if (range === "365d" || range === "all") return "1y";
  return "7d";
}

export function getAdminV2AnalyticsRange(id: AdminV2ActivityRangeId): AnalyticsDateRangeId {
  return ADMIN_V2_ACTIVITY_RANGE_OPTIONS.find((option) => option.id === id)?.analyticsRange || "7d";
}

export function normalizeAdminV2ActivityPoints(points: AnalyticsTimeSeriesPoint[]) {
  return points
    .map((point) => ({
      bucketEnd: point.bucketEnd,
      bucketStart: point.bucketStart,
      currentVisits: finiteCount(point.currentVisits),
      previousRangeRegisterClicks: finiteCount(point.previousRangeRegisterClicks),
      previousRangeVisits: finiteCount(point.previousRangeVisits),
      registerClicks: finiteCount(point.registerClicks),
      source: cleanSource(point.source),
      timestamp: Date.parse(point.bucketStart),
    }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((first, second) => first.timestamp - second.timestamp);
}

export function summarizeAdminV2ActivityPoints(points: AdminV2ActivityPoint[]) {
  const visits = sum(points, (point) => point.currentVisits);
  const registerClicks = sum(points, (point) => point.registerClicks);
  const peak = points.reduce<AdminV2ActivityPoint | null>(
    (current, point) => (!current || point.currentVisits > current.currentVisits ? point : current),
    null
  );
  const sourceCounts = points.reduce<Record<string, number>>((counts, point) => {
    if (point.source && point.source !== "No source") {
      counts[point.source] = (counts[point.source] || 0) + point.currentVisits;
    }
    return counts;
  }, {});
  const bestSource = Object.entries(sourceCounts).sort(([, first], [, second]) => second - first)[0]?.[0];

  return {
    bestSource: bestSource || "No source data",
    peakWindow: peak && peak.currentVisits > 0 ? formatAdminV2ActivityWindow(peak) : "No activity",
    registerClicks,
    visits,
  };
}

export function getAdminV2ActivityTicks(maxValue: number, targetCount = 6) {
  const safeMax = Math.max(1, maxValue);
  const rawStep = safeMax / Math.max(2, targetCount - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  const top = Math.ceil(safeMax / step) * step;
  const ticks: number[] = [];

  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(value);
  }
  return ticks;
}

export function getAdminV2NearestActivityIndex(total: number, progress: number) {
  if (total <= 1) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(progress * (total - 1))));
}

export function formatAdminV2ActivityDelta(current: number, previous: number) {
  if (!current && !previous) return "No change";
  if (!previous) return `+${current.toLocaleString()} new`;
  const delta = current - previous;
  const percent = Math.abs((delta / previous) * 100).toFixed(1);
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toLocaleString()} (${sign}${percent}%)`;
}

export function formatAdminV2ActivityTimestamp(point: AdminV2ActivityPoint) {
  const start = new Date(point.timestamp);
  const end = new Date(point.bucketEnd);
  const startLabel = start.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
  if (!Number.isFinite(end.getTime())) return startLabel;
  return `${startLabel} - ${end.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatAdminV2ActivityAxisLabel(point: AdminV2ActivityPoint) {
  const start = new Date(point.timestamp);
  const end = Date.parse(point.bucketEnd);
  const duration = Number.isFinite(end) ? end - point.timestamp : 0;
  const intraday = duration > 0 && duration <= 60 * 60 * 1000;
  return start.toLocaleString("en-IN", {
    day: intraday ? undefined : "2-digit",
    hour: intraday ? "2-digit" : undefined,
    minute: intraday ? "2-digit" : undefined,
    month: intraday ? undefined : "short",
  });
}

export function getAdminV2ActivityAxisIndexes(total: number, compact = false) {
  if (total <= 1) return total ? [0] : [];
  const divisions = compact ? 2 : 4;
  return Array.from(
    new Set(
      Array.from({ length: divisions + 1 }, (_, index) =>
        Math.round(((total - 1) * index) / divisions)
      )
    )
  );
}

function formatAdminV2ActivityWindow(point: AdminV2ActivityPoint) {
  return new Date(point.timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function finiteCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function cleanSource(value: string) {
  const source = value.replace(/\s+/g, " ").trim().slice(0, 80);
  return source || "No source";
}

function sum<TItem>(items: TItem[], select: (item: TItem) => number) {
  return items.reduce((total, item) => total + select(item), 0);
}
