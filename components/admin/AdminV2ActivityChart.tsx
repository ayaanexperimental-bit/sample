"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useId,
  useMemo,
  useState,
} from "react";
import type { AnalyticsDateRangeId, AnalyticsTimeSeriesPoint } from "../../lib/analytics-events";
import {
  ADMIN_V2_ACTIVITY_RANGE_OPTIONS,
  formatAdminV2ActivityAxisLabel,
  formatAdminV2ActivityDelta,
  formatAdminV2ActivityTimestamp,
  getAdminV2ActivityAxisIndexes,
  getAdminV2ActivityRangeId,
  getAdminV2ActivityTicks,
  getAdminV2AnalyticsRange,
  getAdminV2NearestActivityIndex,
  normalizeAdminV2ActivityPoints,
  summarizeAdminV2ActivityPoints,
} from "../../lib/admin-v2-activity-chart";
import { AdminAIAskButton } from "./admin-ai/AdminAIAskButton";
import styles from "./admin-v2-activity-chart.module.css";

const WIDTH = 760;
const HEIGHT = 320;
const PADDING = { bottom: 48, left: 58, right: 20, top: 20 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export function AdminV2ActivityChart({
  dataFreshness,
  loading,
  onRangeChange,
  range,
  rangeLabel,
  source,
  timeSeries,
}: {
  dataFreshness: string;
  loading: boolean;
  onRangeChange: (range: AnalyticsDateRangeId) => void;
  range: AnalyticsDateRangeId;
  rangeLabel: string;
  source: string;
  timeSeries: AnalyticsTimeSeriesPoint[];
}) {
  const gradientSeed = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradientId = `admin-v2-activity-area-${gradientSeed}`;
  const points = useMemo(() => normalizeAdminV2ActivityPoints(timeSeries), [timeSeries]);
  const summary = useMemo(() => summarizeAdminV2ActivityPoints(points), [points]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [scrubberFocused, setScrubberFocused] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true);
  const [showPrevious, setShowPrevious] = useState(true);
  const boundedIndex = Math.min(
    Math.max(0, activeIndex ?? points.length - 1),
    Math.max(0, points.length - 1)
  );
  const tooltipIndex = Math.min(pinnedIndex ?? boundedIndex, Math.max(0, points.length - 1));
  const activePoint = points[tooltipIndex];
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [
      showCurrent ? point.currentVisits : 0,
      showPrevious ? point.previousRangeVisits : 0,
    ])
  );
  const yTicks = getAdminV2ActivityTicks(maxValue, 6);
  const chartTop = yTicks[yTicks.length - 1] || 1;
  const coords = points.map((point, index) => ({
    current: getCoord(point.currentVisits, index, points.length, chartTop),
    previous: getCoord(point.previousRangeVisits, index, points.length, chartTop),
  }));
  const currentPath = buildLinePath(coords.map((point) => point.current));
  const previousPath = buildLinePath(coords.map((point) => point.previous));
  const areaPath = coords.length
    ? `${currentPath} L ${coords[coords.length - 1].current.x.toFixed(2)} ${(HEIGHT - PADDING.bottom).toFixed(2)} L ${PADDING.left.toFixed(2)} ${(HEIGHT - PADDING.bottom).toFixed(2)} Z`
    : "";
  const activeCoord = coords[tooltipIndex];
  const showTooltip = Boolean(
    activePoint && activeCoord && (hovered || scrubberFocused || pinnedIndex !== null)
  );
  const axisIndexes = getAdminV2ActivityAxisIndexes(points.length);
  const hasActivity = summary.visits > 0 || points.some((point) => point.previousRangeVisits > 0);
  const activeRange = getAdminV2ActivityRangeId(range);

  function getPointerIndex(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const progress = (svgX - PADDING.left) / PLOT_WIDTH;
    return getAdminV2NearestActivityIndex(points.length, progress);
  }

  function inspectPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    setHovered(true);
    setActiveIndex(getPointerIndex(event));
  }

  function pinPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!points.length) return;
    const index = getPointerIndex(event);
    setActiveIndex(index);
    setPinnedIndex((current) => (current === index ? null : index));
  }

  function toggleCurrent() {
    if (showCurrent && !showPrevious) return;
    setShowCurrent((current) => !current);
  }

  function togglePrevious() {
    if (showPrevious && !showCurrent) return;
    setShowPrevious((current) => !current);
  }

  return (
    <section
      aria-labelledby="activity-chart-title"
      className={styles.chart}
      data-loading={loading ? "true" : "false"}
      data-point-count={points.length}
    >
      <header className={styles.header}>
        <div>
          <small>Real backend time series</small>
          <h3 id="activity-chart-title">Coach Site Activity</h3>
          <p>Every displayed bucket is returned by the analytics API. No points are interpolated or invented.</p>
        </div>
        <div className={styles.headerActions}>
          <AdminAIAskButton
            className={styles.askCopilot}
            query="Explain this chart, compare the current and previous periods, and identify evidence-backed anomalies."
          />
          <div className={styles.rangeTabs} role="tablist" aria-label="Coach Site Activity time range">
            {ADMIN_V2_ACTIVITY_RANGE_OPTIONS.map((option) => (
              <button
                aria-selected={activeRange === option.id}
                data-active={activeRange === option.id ? "true" : "false"}
                key={option.id}
                onClick={() => onRangeChange(getAdminV2AnalyticsRange(option.id))}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div aria-label="Chart series" className={styles.legend}>
          <button aria-pressed={showCurrent} data-series="current" onClick={toggleCurrent} type="button">
            Current visits
          </button>
          <button aria-pressed={showPrevious} data-series="previous" onClick={togglePrevious} type="button">
            Previous range
          </button>
        </div>
        <span>{points.length.toLocaleString()} inspectable buckets / {rangeLabel}</span>
      </div>

      {points.length >= 2 ? (
        <div className={styles.viewport}>
          <svg
            aria-describedby="activity-chart-text-summary"
            aria-label={`Coach Site Activity, ${points.length} inspectable real buckets`}
            className={styles.svg}
            data-pinned={pinnedIndex !== null ? "true" : "false"}
            onClick={pinPointer}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onPointerMove={inspectPointer}
            role="img"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#b7ff3c" stopOpacity="0.38" />
                <stop offset="70%" stopColor="#54f88a" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#54f88a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect className={styles.interactionPlane} height={PLOT_HEIGHT} width={PLOT_WIDTH} x={PADDING.left} y={PADDING.top} />
            <g className={styles.minorGrid}>
              {yTicks.slice(0, -1).map((tick, index) => {
                const next = yTicks[index + 1];
                const midpoint = (tick + next) / 2;
                const y = getY(midpoint, chartTop);
                return <line key={`minor-${midpoint}`} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} />;
              })}
            </g>
            <g className={styles.grid}>
              {yTicks.map((tick) => {
                const y = getY(tick, chartTop);
                return <line key={tick} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} />;
              })}
            </g>
            <g className={styles.yLabels}>
              {yTicks.map((tick) => <text key={tick} x={PADDING.left - 12} y={getY(tick, chartTop) + 4}>{formatCompact(tick)}</text>)}
            </g>
            {showCurrent && areaPath ? <path className={styles.area} d={areaPath} fill={`url(#${gradientId})`} /> : null}
            {showPrevious ? <path className={styles.previousLine} d={previousPath} /> : null}
            {showCurrent ? <path className={styles.currentLine} d={currentPath} /> : null}
            {showTooltip && activeCoord ? (
              <>
                <line className={styles.crosshair} x1={activeCoord.current.x} x2={activeCoord.current.x} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} />
                {showPrevious ? <circle className={styles.previousPoint} cx={activeCoord.previous.x} cy={activeCoord.previous.y} r="4" /> : null}
                {showCurrent ? (
                  <>
                    <circle className={styles.halo} cx={activeCoord.current.x} cy={activeCoord.current.y} r="10" />
                    <circle className={styles.activePoint} cx={activeCoord.current.x} cy={activeCoord.current.y} r="5" />
                  </>
                ) : null}
              </>
            ) : null}
            <g className={styles.xLabels}>
              {axisIndexes.map((index) => {
                const point = points[index];
                const coord = coords[index]?.current;
                return point && coord ? <text data-edge={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} key={point.bucketStart} x={coord.x} y={HEIGHT - 14}>{formatAdminV2ActivityAxisLabel(point)}</text> : null;
              })}
            </g>
          </svg>

          {activePoint && activeCoord ? (
            <div
              aria-hidden={showTooltip ? undefined : "true"}
              className={styles.tooltip}
              data-activity-tooltip="true"
              data-pinned={pinnedIndex !== null ? "true" : "false"}
              data-visible={showTooltip ? "true" : "false"}
              style={{ "--activity-tooltip-x": `${(activeCoord.current.x / WIDTH) * 100}%` } as CSSProperties}
            >
              <strong>{formatAdminV2ActivityTimestamp(activePoint)}</strong>
              <span>Current visits: {activePoint.currentVisits.toLocaleString()}</span>
              <span>Previous range: {activePoint.previousRangeVisits.toLocaleString()}</span>
              <span>Delta: {formatAdminV2ActivityDelta(activePoint.currentVisits, activePoint.previousRangeVisits)}</span>
              <span>Register clicks: {activePoint.registerClicks.toLocaleString()}</span>
              <span>Source: {activePoint.source}</span>
              {pinnedIndex !== null ? <em>Pinned. Select another point to move it.</em> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.emptyState} role="status">
          No real analytics buckets are available for this range.
        </div>
      )}

      {points.length >= 2 ? (
        <div className={styles.scrubber}>
          <label htmlFor={`activity-scrubber-${gradientSeed}`}>Inspect exact bucket</label>
          <input
            aria-valuetext={activePoint ? formatAdminV2ActivityTimestamp(activePoint) : "No point"}
            id={`activity-scrubber-${gradientSeed}`}
            max={Math.max(0, points.length - 1)}
            min="0"
            onBlur={() => setScrubberFocused(false)}
            onChange={(event) => {
              const index = Number(event.currentTarget.value);
              setActiveIndex(index);
              setPinnedIndex(index);
            }}
            onFocus={() => setScrubberFocused(true)}
            step="1"
            type="range"
            value={tooltipIndex}
          />
          {pinnedIndex !== null ? <button onClick={() => setPinnedIndex(null)} type="button">Clear pin</button> : null}
        </div>
      ) : null}

      <p className={styles.textSummary} id="activity-chart-text-summary">
        {hasActivity
          ? `${rangeLabel}: ${summary.visits.toLocaleString()} visits and ${summary.registerClicks.toLocaleString()} register clicks across ${points.length.toLocaleString()} real buckets.`
          : `${rangeLabel}: no visit or comparison events in ${points.length.toLocaleString()} real buckets.`}
      </p>

      <div className={styles.summaryGrid} aria-label="Selected range chart summary">
        <Summary label="Visits" value={summary.visits.toLocaleString()} />
        <Summary label="Register clicks" value={summary.registerClicks.toLocaleString()} />
        <Summary label="Peak window" value={summary.peakWindow} />
        <Summary label="Best source" value={summary.bestSource} />
      </div>

      <footer className={styles.footer}>
        <span>{loading ? "Loading range" : `Source: ${source}`}</span>
        <span>{dataFreshness || "Freshness unavailable"}</span>
      </footer>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function getCoord(value: number, index: number, total: number, maxValue: number) {
  const x = total <= 1 ? PADDING.left + PLOT_WIDTH / 2 : PADDING.left + (index / (total - 1)) * PLOT_WIDTH;
  return { x, y: getY(value, maxValue) };
}

function getY(value: number, maxValue: number) {
  return PADDING.top + PLOT_HEIGHT - (Math.max(0, value) / Math.max(1, maxValue)) * PLOT_HEIGHT;
}

function buildLinePath(coords: Array<{ x: number; y: number }>) {
  return coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return Math.round(value).toLocaleString();
}
