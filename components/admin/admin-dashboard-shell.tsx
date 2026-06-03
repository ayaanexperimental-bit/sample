"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
import {
  AdminActionDialog,
  AdminHeader,
  type AdminNavSection,
  AdminPageShell,
  AdminSidebar
} from "./admin-dashboard-layout";
import styles from "./admin-dashboard-shell.module.css";
import {
  adminControlCenterData,
  type AdminErrorReport,
  type AdminPaidMasterclassLink,
  createErrorReportBugPrompt
} from "../../lib/admin-control-center";
import type {
  AnalyticsDateRangeId,
  AnalyticsEventRange,
  AnalyticsMetricSummary,
  AnalyticsRecentEvent
} from "../../lib/analytics-events";
import type { CoachSiteRecord } from "../../lib/admin-coach-sites";
import {
  buildCoachAnalyticsRows,
  filterCoachAnalyticsRows,
  getNeedsAttentionRows,
  getTopCoachAnalyticsRows,
  type CoachAnalyticsFunnelType,
  type CoachAnalyticsRow
} from "../../lib/admin-coach-analytics";
import { adminDashboardData } from "../../lib/admin-dashboard-data";

type AdminDashboardShellProps = {
  csrfToken: string;
  onLogout: () => void;
  sessionEmail?: string;
};

type AdminViewId =
  | "backup-cleanup"
  | "coach-analytics"
  | "coach-sites"
  | "create-coach-site"
  | "error-reports"
  | "overview"
  | "paid-masterclass-settings"
  | "settings"
  | "top-coaches";

type ActionDialogState = {
  body: string;
  title: string;
  tone?: "danger" | "standard";
} | null;

type PrivateLinkMetadata = {
  configured: boolean;
  entryCode: string;
  funnelId: string;
  storageSource: "d1_table" | "none";
  updatedAt: string | null;
  updatedBy: string;
};

type CoachSitesApiPayload = {
  coachSites?: CoachSiteRecord[];
  configured?: boolean;
  ok?: boolean;
};

type AnalyticsEventsApiPayload = {
  analyticsSummaries?: AnalyticsMetricSummary[];
  configured?: boolean;
  ok?: boolean;
  previousAnalyticsSummaries?: AnalyticsMetricSummary[];
  range?: AnalyticsEventRange;
  recentEvents?: AnalyticsRecentEvent[];
  source?: string;
};

type AdminAiAnalyticsInsight = {
  dataHash: string;
  generatedAt: string;
  keyTrends: string[];
  model: string;
  predictions: string[];
  recommendations: string[];
  summary: string;
  warnings: string[];
};

type AdminAiAnalyticsPayload = {
  cache?: "hit" | "miss";
  configured?: boolean;
  insight?: AdminAiAnalyticsInsight;
  message?: string;
  ok?: boolean;
  usageEstimate?: {
    approximateCostLevel: "High" | "Low" | "Medium";
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };
};

const analyticsRangeOptions: Array<{ label: string; value: AnalyticsDateRangeId }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "Custom", value: "custom" },
  { label: "All stored", value: "all" }
];

const navSections: AdminNavSection[] = [
  {
    id: "admin-workflow",
    label: "Admin",
    items: [
      { id: "overview", label: "Overview", description: "Key metrics and alerts" },
      { id: "coach-sites", label: "Coach Sites", description: "Search and manage sites" },
      { id: "create-coach-site", label: "Create Coach Site", description: "Open builder wizard" },
      { id: "coach-analytics", label: "Coach Analytics", description: "Coach-wise metrics" },
      { id: "top-coaches", label: "Top Performers", description: "Best coaches" },
      {
        id: "paid-masterclass-settings",
        label: "Paid Masterclass Links/Settings",
        description: "Links and settings"
      },
      { id: "error-reports", label: "Error Reports", description: "Recent issues" },
      { id: "backup-cleanup", label: "Backup/Cleanup", description: "Retention controls" },
      { id: "settings", label: "Settings", description: "Admin and support basics" }
    ]
  }
];

const viewTitles: Record<AdminViewId, string> = {
  "backup-cleanup": "Backup & Cleanup",
  "coach-analytics": "Coach Analytics",
  "coach-sites": "Coach Sites",
  "create-coach-site": "Create Coach Site",
  "error-reports": "Error Reports",
  overview: "Overview",
  "paid-masterclass-settings": "Paid Masterclass Links/Settings",
  settings: "Settings",
  "top-coaches": "Top Performing Coaches"
};

export function AdminDashboardShell({
  csrfToken,
  onLogout,
  sessionEmail
}: AdminDashboardShellProps) {
  const data = adminDashboardData;
  const control = adminControlCenterData;
  const [activeView, setActiveView] = useState<AdminViewId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>(null);
  const [errorReports, setErrorReports] = useState<AdminErrorReport[]>([]);
  const [errorReportSource, setErrorReportSource] = useState("loading");
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState("");
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState("");
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsDateRangeId>("7d");
  const [analyticsRangeMeta, setAnalyticsRangeMeta] = useState<AnalyticsEventRange | null>(null);
  const [analyticsSource, setAnalyticsSource] = useState("loading");
  const [analyticsSummaries, setAnalyticsSummaries] = useState<AnalyticsMetricSummary[]>([]);
  const [previousAnalyticsSummaries, setPreviousAnalyticsSummaries] = useState<
    AnalyticsMetricSummary[]
  >([]);
  const [recentAnalyticsEvents, setRecentAnalyticsEvents] = useState<AnalyticsRecentEvent[]>([]);
  const [liveCoachSites, setLiveCoachSites] = useState<CoachSiteRecord[]>([]);
  const [coachSiteSource, setCoachSiteSource] = useState("loading");

  useEffect(() => {
    let active = true;

    async function loadErrorReports() {
      try {
        const response = await fetch("/api/admin/error-reports", {
          cache: "no-store"
        });
        const payload = (await response.json()) as {
          errorReports?: AdminErrorReport[];
          persistence?: string;
        };

        if (!active) return;
        if (response.ok && Array.isArray(payload.errorReports)) {
          setErrorReports(payload.errorReports);
          setErrorReportSource(payload.persistence || "unknown");
        } else {
          setErrorReportSource("unavailable");
        }
      } catch {
        if (active) setErrorReportSource("unavailable");
      }
    }

    void loadErrorReports();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAnalyticsEvents() {
      try {
        const params = new URLSearchParams({ range: analyticsRange });
        if (analyticsRange === "custom") {
          if (analyticsCustomStart) params.set("customStart", analyticsCustomStart);
          if (analyticsCustomEnd) params.set("customEnd", analyticsCustomEnd);
        }
        const response = await fetch(`/api/admin/analytics-events?${params.toString()}`, {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as AnalyticsEventsApiPayload;

        if (!active) return;
        if (response.ok && payload.ok && Array.isArray(payload.analyticsSummaries)) {
          setAnalyticsSummaries(payload.analyticsSummaries);
          setPreviousAnalyticsSummaries(payload.previousAnalyticsSummaries || []);
          setRecentAnalyticsEvents(payload.recentEvents || []);
          setAnalyticsRangeMeta(payload.range || null);
          setAnalyticsSource(payload.source || (payload.configured ? "d1_analytics_events" : "not-configured"));
        } else {
          setAnalyticsSummaries([]);
          setPreviousAnalyticsSummaries([]);
          setRecentAnalyticsEvents([]);
          setAnalyticsRangeMeta(null);
          setAnalyticsSource("unavailable");
        }
      } catch {
        if (active) {
          setAnalyticsSummaries([]);
          setPreviousAnalyticsSummaries([]);
          setRecentAnalyticsEvents([]);
          setAnalyticsRangeMeta(null);
          setAnalyticsSource("unavailable");
        }
      }
    }

    void loadAnalyticsEvents();

    return () => {
      active = false;
    };
  }, [analyticsCustomEnd, analyticsCustomStart, analyticsRange]);

  useEffect(() => {
    let active = true;

    async function loadCoachSites() {
      try {
        const response = await fetch("/api/admin/coach-sites", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;

        if (!active) return;
        if (response.ok && payload.ok && Array.isArray(payload.coachSites)) {
          setLiveCoachSites(payload.coachSites);
          setCoachSiteSource(payload.configured ? "live-database" : "not-configured");
        } else {
          setLiveCoachSites([]);
          setCoachSiteSource("unavailable");
        }
      } catch {
        if (active) {
          setLiveCoachSites([]);
          setCoachSiteSource("unavailable");
        }
      }
    }

    void loadCoachSites();

    return () => {
      active = false;
    };
  }, []);

  function openAction(title: string, body: string, tone: "danger" | "standard" = "standard") {
    setActionDialog({ body, title, tone });
  }

  function selectView(viewId: string) {
    setActiveView(viewId as AdminViewId);
  }

  return (
    <section className={styles.adminApp} aria-label="YW Coach admin dashboard">
      <AdminSidebar
        activeView={activeView}
        mobileOpen={mobileNavOpen}
        nav={navSections}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelect={selectView}
      />

      <div className={styles.adminMain}>
        <AdminHeader
          activeTitle={viewTitles[activeView]}
          onLogout={onLogout}
          onMenu={() => setMobileNavOpen(true)}
          sessionEmail={sessionEmail}
        />

        <p className={styles.dataNotice}>{data.dataNotice}</p>

        {activeView === "overview" ? (
          <OverviewView
            analyticsCustomEnd={analyticsCustomEnd}
            analyticsCustomStart={analyticsCustomStart}
            analyticsRange={analyticsRange}
            analyticsRangeMeta={analyticsRangeMeta}
            analyticsSource={analyticsSource}
            analyticsSummaries={analyticsSummaries}
            coachSites={liveCoachSites}
            csrfToken={csrfToken}
            errorReports={errorReports}
            onSelect={setActiveView}
            onAnalyticsRangeChange={setAnalyticsRange}
            onAnalyticsCustomEndChange={setAnalyticsCustomEnd}
            onAnalyticsCustomStartChange={setAnalyticsCustomStart}
            previousAnalyticsSummaries={previousAnalyticsSummaries}
            recentEvents={recentAnalyticsEvents}
            source={coachSiteSource}
          />
        ) : null}

        {activeView === "coach-sites" ? (
          <AdminPageShell
            actions={
              <button
                className={styles.primaryAction}
                onClick={() => setActiveView("create-coach-site")}
                type="button"
              >
                Create Coach Site
              </button>
            }
            eyebrow="Coach Sites"
            title="All Coach Sites"
          >
            <AdminCoachSitesManager csrfToken={csrfToken} mode="list" />
          </AdminPageShell>
        ) : null}

        {activeView === "create-coach-site" ? (
          <AdminPageShell eyebrow="Coach Sites" title="Create Coach Site">
            <AdminCoachSitesManager csrfToken={csrfToken} mode="create" />
          </AdminPageShell>
        ) : null}

        {activeView === "top-coaches" ? (
          <TopCoachesView
            analyticsSource={analyticsSource}
            analyticsSummaries={analyticsSummaries}
            coachSites={liveCoachSites}
          />
        ) : null}
        {activeView === "coach-analytics" ? (
          <CoachAnalyticsView
            analyticsCustomEnd={analyticsCustomEnd}
            analyticsCustomStart={analyticsCustomStart}
            analyticsRange={analyticsRange}
            analyticsSource={analyticsSource}
            analyticsSummaries={analyticsSummaries}
            coachSites={liveCoachSites}
            csrfToken={csrfToken}
            onAnalyticsCustomEndChange={setAnalyticsCustomEnd}
            onAnalyticsCustomStartChange={setAnalyticsCustomStart}
            onAnalyticsRangeChange={setAnalyticsRange}
            onSelect={setActiveView}
            source={coachSiteSource}
          />
        ) : null}
        {activeView === "paid-masterclass-settings" ? (
          <MasterclassLinksView control={control} csrfToken={csrfToken} />
        ) : null}
        {activeView === "error-reports" ? (
          <ErrorReportsView
            csrfToken={csrfToken}
            errorReports={errorReports}
            onReportsChange={setErrorReports}
            source={errorReportSource}
          />
        ) : null}
        {activeView === "backup-cleanup" ? (
          <BackupCleanupView control={control} onAction={openAction} />
        ) : null}
        {activeView === "settings" ? (
          <SettingsView control={control} onAction={openAction} />
        ) : null}
      </div>

      <AdminActionDialog
        onClose={() => setActionDialog(null)}
        open={Boolean(actionDialog)}
        title={actionDialog?.title || ""}
        tone={actionDialog?.tone}
      >
        <p className={styles.dialogCopy}>{actionDialog?.body}</p>
      </AdminActionDialog>
    </section>
  );
}

function OverviewView({
  analyticsCustomEnd,
  analyticsCustomStart,
  analyticsRange,
  analyticsRangeMeta,
  analyticsSource,
  analyticsSummaries,
  coachSites,
  csrfToken,
  errorReports,
  onSelect,
  onAnalyticsRangeChange,
  onAnalyticsCustomEndChange,
  onAnalyticsCustomStartChange,
  previousAnalyticsSummaries,
  recentEvents,
  source
}: {
  analyticsCustomEnd: string;
  analyticsCustomStart: string;
  analyticsRange: AnalyticsDateRangeId;
  analyticsRangeMeta: AnalyticsEventRange | null;
  analyticsSource: string;
  analyticsSummaries: AnalyticsMetricSummary[];
  coachSites: CoachSiteRecord[];
  csrfToken: string;
  errorReports: AdminErrorReport[];
  onAnalyticsCustomEndChange: (value: string) => void;
  onAnalyticsCustomStartChange: (value: string) => void;
  onAnalyticsRangeChange: (value: AnalyticsDateRangeId) => void;
  onSelect: (view: AdminViewId) => void;
  previousAnalyticsSummaries: AnalyticsMetricSummary[];
  recentEvents: AnalyticsRecentEvent[];
  source: string;
}) {
  const [overviewAiCache, setOverviewAiCache] = useState("");
  const [overviewAiInsight, setOverviewAiInsight] = useState<AdminAiAnalyticsInsight | null>(null);
  const [overviewAiStatus, setOverviewAiStatus] = useState("");
  const [overviewAiUsage, setOverviewAiUsage] =
    useState<AdminAiAnalyticsPayload["usageEstimate"]>(undefined);
  const preferEventSummaries = analyticsSource === "d1_analytics_events";
  const rows = useMemo(
    () => buildCoachAnalyticsRows(coachSites, analyticsSummaries, { preferEventSummaries }),
    [analyticsSummaries, coachSites, preferEventSummaries]
  );
  const previousRows = useMemo(
    () =>
      buildCoachAnalyticsRows(coachSites, previousAnalyticsSummaries, {
        preferEventSummaries
      }),
    [coachSites, preferEventSummaries, previousAnalyticsSummaries]
  );
  const currentRows = useMemo(() => getCurrentAnalyticsRows(rows), [rows]);
  const previousCurrentRows = useMemo(() => getCurrentAnalyticsRows(previousRows), [previousRows]);
  const overview = useMemo(
    () =>
      buildOverviewAnalytics(
        currentRows,
        errorReports,
        source,
        analyticsSource,
        previousCurrentRows,
        recentEvents,
        analyticsRangeMeta
      ),
    [
      analyticsRangeMeta,
      analyticsSource,
      currentRows,
      errorReports,
      previousCurrentRows,
      recentEvents,
      source
    ]
  );

  async function generateOverviewAiInsights(forceRefresh = false) {
    if (!csrfToken) {
      setOverviewAiStatus("Admin verification token is not ready yet.");
      return;
    }

    setOverviewAiStatus(forceRefresh ? "Refreshing AI overview..." : "Generating AI overview...");

    try {
      const response = await fetch("/api/admin/analytics-insights", {
        body: JSON.stringify({
          dateRange: overview.rangeLabel,
          forceRefresh,
          payload: buildOverviewAiPayload({
            analyticsRangeMeta,
            errorReports,
            overview,
            rows: currentRows
          }),
          scope: "overview"
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminAiAnalyticsPayload;

      if (response.ok && payload.ok && payload.insight) {
        setOverviewAiInsight(payload.insight);
        setOverviewAiCache(payload.cache || "");
        setOverviewAiUsage(payload.usageEstimate);
        setOverviewAiStatus(
          `${payload.cache === "hit" ? "Cached" : "Generated"} with ${payload.insight.model}.`
        );
        return;
      }

      setOverviewAiStatus(
        payload.configured === false
          ? "AI Analytics is not configured yet."
          : payload.message || "AI overview could not be generated right now."
      );
    } catch {
      setOverviewAiStatus("AI overview could not be generated right now.");
    }
  }

  return (
    <AdminPageShell
      actions={
        <div className={styles.pageActionCluster}>
          <label className={styles.compactSelectLabel}>
            Date range
            <select
              onChange={(event) =>
                onAnalyticsRangeChange(event.target.value as AnalyticsDateRangeId)
              }
              value={analyticsRange}
            >
              {analyticsRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {analyticsRange === "custom" ? (
            <>
              <label className={styles.compactSelectLabel}>
                Start
                <input
                  onChange={(event) => onAnalyticsCustomStartChange(event.target.value)}
                  type="date"
                  value={analyticsCustomStart}
                />
              </label>
              <label className={styles.compactSelectLabel}>
                End
                <input
                  onChange={(event) => onAnalyticsCustomEndChange(event.target.value)}
                  type="date"
                  value={analyticsCustomEnd}
                />
              </label>
            </>
          ) : null}
          <button
            className={styles.primaryAction}
            onClick={() => onSelect("create-coach-site")}
            type="button"
          >
            Create Coach Site
          </button>
        </div>
      }
      eyebrow="Verified Admin Session"
      title="Admin Overview"
    >
      <section className={styles.analyticsHeroPanel} aria-label="Executive analytics summary">
        <div>
          <p className={styles.kicker}>Business command center</p>
          <h2>Today&apos;s production snapshot</h2>
          <p>
            {overview.sourceLabel}. Metrics below come from live coach-site records and stored
            analytics events for {overview.rangeLabel.toLowerCase()}.
          </p>
        </div>
        <div className={styles.analyticsHeroStats}>
          <span>
            <strong>{overview.totalVisits.toLocaleString()}</strong>
            Total visits
          </span>
          <span>
            <strong>{overview.totalRegisterClicks.toLocaleString()}</strong>
            Register clicks
          </span>
          <span>
            <strong>{overview.conversionRate}</strong>
            Click-through
          </span>
        </div>
      </section>

      <section className={styles.analyticsKpiGrid} aria-label="KPI summary row">
        {overview.kpis.map((metric) => (
          <AnalyticsKpiCard
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Performance Trends</p>
              <h2>Visits and click momentum</h2>
            </div>
            <button
              className={styles.secondaryAction}
              onClick={() => onSelect("coach-analytics")}
              type="button"
            >
              Open Analytics
            </button>
          </div>
          <ComparisonBars items={overview.trendBars} />
        </article>

        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Funnel Intelligence</p>
              <h2>Paid vs free split</h2>
            </div>
            <button
              className={styles.secondaryAction}
              onClick={() => onSelect("paid-masterclass-settings")}
              type="button"
            >
              Link Settings
            </button>
          </div>
          <div className={styles.analyticsDonutGrid}>
            {overview.funnelSplit.map((item) => (
              <article key={item.label}>
                <span style={{ "--value": item.percent } as CSSProperties} />
                <strong>{item.value.toLocaleString()}</strong>
                <p>{item.label}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.analyticsDashboardGrid}>
        <AnalyticsAiWidget
          cacheLabel={overviewAiCache}
          eyebrow="AI Executive Summary"
          fallbackItems={overview.aiSummary}
          insight={overviewAiInsight}
          onGenerate={() => void generateOverviewAiInsights(false)}
          onRefresh={() => void generateOverviewAiInsights(true)}
          status={overviewAiStatus}
          title={
            overviewAiInsight
              ? `Last generated ${new Date(overviewAiInsight.generatedAt).toLocaleString()}`
              : "On-demand aggregate analysis"
          }
          usageEstimate={overviewAiUsage}
        />
        <AnalyticsWidget
          eyebrow="Recommended Actions"
          items={overview.recommendations}
          title="Highest-leverage next moves"
        />
        <AnalyticsWidget
          eyebrow="System Health"
          items={overview.healthAlerts}
          title="Alerts and quality checks"
        />
        <AnalyticsWidget
          eyebrow="Regions / Devices"
          items={overview.breakdownNotes}
          title="Audience signal"
        />
        <AnalyticsWidget
          eyebrow="Recent Activity"
          items={overview.recentActivity}
          title="Latest stored events"
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Top Performing Coaches</p>
            <h2>Real recorded activity</h2>
          </div>
          <button
            className={styles.secondaryAction}
            onClick={() => onSelect("top-coaches")}
            type="button"
          >
            Open Details
          </button>
        </div>
        <div className={styles.analyticsRankList}>
          {overview.topRows.length > 0 ? (
            overview.topRows.map((row, index) => (
              <button key={row.coachId} onClick={() => onSelect("coach-analytics")} type="button">
                <span>#{index + 1}</span>
                <strong>{row.coachName}</strong>
                <small>
                  {row.combined.visits.toLocaleString()} visits / {row.combined.conversionRate}{" "}
                  click-through / {row.bestFunnel}
                </small>
              </button>
            ))
          ) : (
            <p>No top performer data available yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Quick Actions</p>
            <h2>Action center</h2>
          </div>
        </div>
        <div className={styles.quickActions}>
          {[
            ["Create Coach Site", "create-coach-site"],
            ["Coach Sites", "coach-sites"],
            ["Coach Analytics", "coach-analytics"],
            ["Top Performers", "top-coaches"],
            ["Paid Settings", "paid-masterclass-settings"],
            ["Error Reports", "error-reports"],
            ["Backup/Cleanup", "backup-cleanup"]
          ].map(([label, view]) => (
            <button key={view} onClick={() => onSelect(view as AdminViewId)} type="button">
              {label}
            </button>
          ))}
        </div>
      </section>
    </AdminPageShell>
  );
}

function TopCoachesView({
  analyticsSource,
  analyticsSummaries,
  coachSites
}: {
  analyticsSource: string;
  analyticsSummaries: AnalyticsMetricSummary[];
  coachSites: CoachSiteRecord[];
}) {
  const preferEventSummaries = analyticsSource === "d1_analytics_events";
  const rows = useMemo(
    () =>
      getTopCoachAnalyticsRows(
        getCurrentAnalyticsRows(
          buildCoachAnalyticsRows(coachSites, analyticsSummaries, { preferEventSummaries })
        )
      ),
    [analyticsSummaries, coachSites, preferEventSummaries]
  );

  return (
    <AdminPageShell eyebrow="Coach Sites" title="Top Performing Coaches">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Coach</th>
              <th>Niche</th>
              <th>Public link</th>
              <th>Visits</th>
              <th>Clicks</th>
              <th>Click-through</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((coach, index) => (
                <tr key={coach.coachId}>
                  <td>{index + 1}</td>
                  <td>{coach.coachName}</td>
                  <td>{coach.niche}</td>
                  <td>
                    <code>{coach.publicLink || coach.coachSlug}</code>
                  </td>
                  <td>{coach.combined.visits.toLocaleString()}</td>
                  <td>{coach.combined.clicks.toLocaleString()}</td>
                  <td>{coach.combined.conversionRate}</td>
                  <td>{coach.trend}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No top performer data available yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

function getCurrentAnalyticsRows(rows: CoachAnalyticsRow[]) {
  return rows.filter((row) => row.status !== "archived" && row.status !== "removed");
}

function buildOverviewAnalytics(
  rows: CoachAnalyticsRow[],
  errorReports: AdminErrorReport[],
  source: string,
  analyticsSource: string,
  previousRows: CoachAnalyticsRow[],
  recentEvents: AnalyticsRecentEvent[],
  analyticsRangeMeta: AnalyticsEventRange | null
) {
  const topRows = getTopCoachAnalyticsRows(rows);
  const needsAttentionRows = getNeedsAttentionRows(rows);
  const totalVisits = sumNumbers(rows.map((row) => row.combined.visits));
  const previousVisits = sumNumbers(previousRows.map((row) => row.combined.visits));
  const totalRegisterClicks = sumNumbers(
    rows.map((row) => row.freeMetrics.registerClicks + row.paidMetrics.registerClicks)
  );
  const previousRegisterClicks = sumNumbers(
    previousRows.map((row) => row.freeMetrics.registerClicks + row.paidMetrics.registerClicks)
  );
  const totalClicks = sumNumbers(rows.map((row) => row.combined.clicks));
  const previousClicks = sumNumbers(previousRows.map((row) => row.combined.clicks));
  const totalWhatsappClicks = sumNumbers(
    rows.map((row) => row.freeMetrics.whatsappClicks + row.paidMetrics.whatsappClicks)
  );
  const totalPaidConversions = sumNumbers(rows.map((row) => row.paidMetrics.paymentSuccess));
  const previousPaidConversions = sumNumbers(
    previousRows.map((row) => row.paidMetrics.paymentSuccess)
  );
  const publishedCoaches = rows.filter(
    (row) => row.status === "published" || row.status === "active"
  ).length;
  const paidOnly = rows.filter((row) => row.hasPaidMasterclass && !row.hasFreeGuestLink).length;
  const freeOnly = rows.filter((row) => row.hasFreeGuestLink && !row.hasPaidMasterclass).length;
  const bothFunnels = rows.filter((row) => row.combinedAvailable).length;
  const noFunnel = rows.filter((row) => !row.hasFreeGuestLink && !row.hasPaidMasterclass).length;
  const activeFunnels =
    rows.filter((row) => row.hasPaidMasterclass).length +
    rows.filter((row) => row.hasFreeGuestLink).length;
  const unresolvedErrors = errorReports.filter((report) => report.status !== "Fixed").length;
  const conversionRate = getRate(totalRegisterClicks, totalVisits);
  const sourceLabel =
    source === "live-database"
      ? analyticsSource === "d1_analytics_events"
        ? "Live coach-site database and analytics event stream are connected"
        : "Live coach-site database is connected"
      : source === "loading"
        ? "Loading live coach-site data"
        : "Live coach-site source is unavailable";
  const deviceTotals = rows.reduce(
    (total, row) => ({
      desktop: total.desktop + row.deviceBreakdown.desktop,
      mobile: total.mobile + row.deviceBreakdown.mobile,
      tablet: total.tablet + row.deviceBreakdown.tablet
    }),
    { desktop: 0, mobile: 0, tablet: 0 }
  );
  const topDevice = getTopBreakdownLabel(deviceTotals, "No device data yet");
  const regionCounts = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.region !== "Not available") acc[row.region] = (acc[row.region] || 0) + 1;
    return acc;
  }, {});
  const topRegion = getTopBreakdownLabel(regionCounts, "No region data yet");
  const enoughActivity = totalVisits > 0 || totalClicks > 0;
  const rangeLabel = analyticsRangeMeta?.label || "Selected period";
  const visitDelta = getDeltaLabel(totalVisits, previousVisits);
  const clickDelta = getDeltaLabel(totalClicks, previousClicks);
  const registerDelta = getDeltaLabel(totalRegisterClicks, previousRegisterClicks);
  const conversionDelta = getDeltaLabel(totalPaidConversions, previousPaidConversions);

  return {
    activeFunnels,
    breakdownNotes: [
      `Top device: ${topDevice}.`,
      `Top region: ${topRegion}.`,
      `Traffic source signal: ${getTopSource(rows)}.`,
      "Visitor-level personal data is not shown in this dashboard."
    ],
    conversionRate,
    funnelSplit: getFunnelSplit([
      ["Paid only", paidOnly],
      ["Free only", freeOnly],
      ["Both", bothFunnels],
      ["No funnel", noFunnel]
    ]),
    healthAlerts: [
      unresolvedErrors
        ? `${unresolvedErrors} unresolved fallback/error report${unresolvedErrors === 1 ? "" : "s"} need review.`
        : "No unresolved fallback reports in the current admin list.",
      needsAttentionRows.length
        ? `${needsAttentionRows.length} coach record${needsAttentionRows.length === 1 ? "" : "s"} need configuration or activity review.`
        : "No coach-level configuration warning detected.",
      noFunnel
        ? `${noFunnel} coach record${noFunnel === 1 ? "" : "s"} have no active funnel connected.`
        : "Every listed coach has at least one active funnel."
    ],
    kpis: [
      {
        detail: `${rangeLabel}; ${visitDelta} vs previous period`,
        label: "Total visitors",
        tone: "neutral" as const,
        value: totalVisits.toLocaleString()
      },
      {
        detail: `Free Google Form opens plus paid register CTA clicks; ${registerDelta}.`,
        label: "Register clicks",
        tone: totalRegisterClicks ? ("success" as const) : ("neutral" as const),
        value: totalRegisterClicks.toLocaleString()
      },
      {
        detail:
          totalPaidConversions > 0
            ? `Recorded from paid success events; ${conversionDelta}.`
            : "No paid success events recorded in this admin yet.",
        label: "Paid conversions",
        tone: totalPaidConversions ? ("success" as const) : ("neutral" as const),
        value: totalPaidConversions.toLocaleString()
      },
      {
        detail: `${publishedCoaches.toLocaleString()} active/current coach records`,
        label: "Active coaches",
        tone: publishedCoaches ? ("success" as const) : ("neutral" as const),
        value: publishedCoaches.toLocaleString()
      },
      {
        detail: `${paidOnly} paid-only / ${freeOnly} free-only / ${bothFunnels} both`,
        label: "Active funnels",
        tone: activeFunnels ? ("success" as const) : ("neutral" as const),
        value: activeFunnels.toLocaleString()
      },
      {
        detail: `Based on selected event range; ${clickDelta} total-click movement.`,
        label: "Click-through rate",
        tone: totalRegisterClicks ? ("success" as const) : ("neutral" as const),
        value: conversionRate
      }
    ],
    recommendations: [
      needsAttentionRows[0]?.lowActivityReasons[0]
        ? `Fix ${needsAttentionRows[0].coachName}: ${needsAttentionRows[0].lowActivityReasons[0]}.`
        : "No urgent coach-site configuration fix found.",
      topRows[0]
        ? `Use ${topRows[0].coachName}'s strongest funnel as the current benchmark.`
        : "Share published coach links to start collecting performance data.",
      previousVisits > totalVisits && analyticsRangeMeta?.id !== "all"
        ? "Traffic is lower than the previous matched period. Check share activity and CTA visibility."
        : "Keep comparing the selected range against the previous period before making changes.",
      unresolvedErrors
        ? "Review Error Reports before the next public launch."
        : "Keep monitoring error reports after each publish."
    ],
    aiSummary: enoughActivity
      ? [
          `Likely trend: ${conversionRate} click-through from recorded coach referral visits.`,
          analyticsRangeMeta?.id === "all"
            ? "Comparison: all stored data selected, so previous-period comparison is disabled."
            : `Comparison: visits are ${visitDelta} and clicks are ${clickDelta}.`,
          topRows[0]
            ? `Best current signal: ${topRows[0].coachName} leads by recorded activity.`
            : "No coach has enough activity for a performer ranking yet.",
          "Prediction quality is limited until more visits and click events are recorded."
        ]
      : ["Not enough data for AI insights yet.", "Publish/share coach links to collect signal."],
    rangeLabel,
    recentActivity:
      recentEvents.length > 0
        ? recentEvents.slice(0, 6).map(formatAnalyticsEventActivity)
        : ["No recent analytics events recorded yet."],
    sourceLabel,
    topRows,
    totalRegisterClicks,
    totalVisits,
    totalWhatsappClicks,
    trendBars: [
      { label: "Selected visits", value: totalVisits },
      { label: "Previous visits", value: previousVisits },
      { label: "Selected clicks", value: totalClicks },
      { label: "Previous clicks", value: previousClicks },
      { label: "Register clicks", value: totalRegisterClicks },
      { label: "WhatsApp clicks", value: totalWhatsappClicks }
    ]
  };
}

function buildOverviewAiPayload({
  analyticsRangeMeta,
  errorReports,
  overview,
  rows
}: {
  analyticsRangeMeta: AnalyticsEventRange | null;
  errorReports: AdminErrorReport[];
  overview: ReturnType<typeof buildOverviewAnalytics>;
  rows: CoachAnalyticsRow[];
}) {
  const unresolvedErrors = errorReports.filter((report) => report.status !== "Fixed");

  return {
    activeFunnels: overview.activeFunnels,
    dateRange: analyticsRangeMeta?.label || overview.rangeLabel,
    funnelSplit: overview.funnelSplit,
    healthAlerts: overview.healthAlerts,
    lowPerformingCoaches: getNeedsAttentionRows(rows).map((row) => ({
      coachName: row.coachName,
      issues: row.lowActivityReasons.slice(0, 3),
      slug: row.coachSlug
    })),
    recentActivity: overview.recentActivity,
    regionDeviceNotes: overview.breakdownNotes,
    systemIssues: {
      unresolvedCount: unresolvedErrors.length,
      unresolvedCategories: Array.from(new Set(unresolvedErrors.map((report) => report.category))).slice(0, 8)
    },
    topCoaches: overview.topRows.slice(0, 5).map((row) => ({
      bestFunnel: row.bestFunnel,
      coachName: row.coachName,
      clicks: row.combined.clicks,
      conversionRate: row.combined.conversionRate,
      slug: row.coachSlug,
      visits: row.combined.visits
    })),
    totals: {
      registerClicks: overview.totalRegisterClicks,
      visits: overview.totalVisits,
      whatsappClicks: overview.totalWhatsappClicks
    },
    trendBars: overview.trendBars
  };
}

function getFunnelSplit(items: Array<[string, number]>) {
  const total = Math.max(1, sumNumbers(items.map(([, value]) => value)));
  return items.map(([label, value]) => ({
    label,
    percent: Math.max(0, Math.round((value / total) * 100)),
    value
  }));
}

function getTopSource(rows: CoachAnalyticsRow[]) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.source !== "Not available") acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {});

  return getTopBreakdownLabel(counts, "No source data yet");
}

function getTopBreakdownLabel(values: Record<string, number>, fallback: string) {
  const [label, value] = Object.entries(values).sort(([, a], [, b]) => b - a)[0] || [];
  return label ? `${label} (${value})` : fallback;
}

function getRate(clicks: number, visits: number) {
  if (!visits) return "0%";
  return `${((clicks / visits) * 100).toFixed(1)}%`;
}

function getDeltaLabel(current: number, previous: number) {
  if (!previous && !current) return "no change";
  if (!previous) return `${current.toLocaleString()} new`;
  const delta = current - previous;
  const percent = Math.abs((delta / previous) * 100).toFixed(1);
  if (delta === 0) return "flat";
  return `${delta > 0 ? "+" : "-"}${percent}%`;
}

function formatAnalyticsEventActivity(event: AnalyticsRecentEvent) {
  const label = getEventDisplayName(event.eventName);
  const coach = event.coachSlug || event.coachId || "system";
  const when = event.createdAt ? new Date(event.createdAt).toLocaleString() : "recently";
  const funnel = event.funnelType === "paid_masterclass" ? "Paid" : "Free";
  const device = event.deviceType !== "unknown" ? ` / ${event.deviceType}` : "";

  return `${label} - ${coach} - ${funnel}${device} - ${when}`;
}

function getEventDisplayName(eventName: AnalyticsRecentEvent["eventName"]) {
  const labels: Record<AnalyticsRecentEvent["eventName"], string> = {
    coach_google_form_click: "Google Form opened",
    coach_register_click: "Register CTA clicked",
    coach_register_missing_link: "Register link missing",
    coach_site_archived: "Coach site archived",
    coach_site_created: "Coach site created",
    coach_site_paused: "Coach site paused",
    coach_site_published: "Coach site published",
    coach_site_removed: "Coach site removed",
    coach_site_resumed: "Coach site resumed",
    coach_site_updated: "Coach site updated",
    coach_site_view: "Coach page viewed",
    coach_video_play: "Coach video played",
    coach_whatsapp_click: "Coach WhatsApp clicked",
    paid_landing_view: "Paid landing viewed",
    paid_payment_click: "Payment CTA clicked",
    paid_register_click: "Paid register clicked",
    paid_whatsapp_click: "Paid WhatsApp clicked",
    payment_initiated: "Payment initiated",
    payment_success: "Payment success recorded",
    success_page_view: "Success page viewed"
  };

  return labels[eventName] || "Analytics event";
}

function sumNumbers(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function CoachAnalyticsView({
  analyticsCustomEnd,
  analyticsCustomStart,
  analyticsRange,
  analyticsSource,
  analyticsSummaries,
  coachSites,
  csrfToken,
  onAnalyticsCustomEndChange,
  onAnalyticsCustomStartChange,
  onAnalyticsRangeChange,
  onSelect,
  source
}: {
  analyticsCustomEnd: string;
  analyticsCustomStart: string;
  analyticsRange: AnalyticsDateRangeId;
  analyticsSource: string;
  analyticsSummaries: AnalyticsMetricSummary[];
  coachSites: CoachSiteRecord[];
  csrfToken: string;
  onAnalyticsCustomEndChange: (value: string) => void;
  onAnalyticsCustomStartChange: (value: string) => void;
  onAnalyticsRangeChange: (value: AnalyticsDateRangeId) => void;
  onSelect: (view: AdminViewId) => void;
  source: string;
}) {
  const [activeTab, setActiveTab] = useState<CoachAnalyticsFunnelType>("free");
  const [funnelFilter, setFunnelFilter] = useState<"all" | "both" | "free" | "none" | "paid">(
    "all"
  );
  const [performanceFilter, setPerformanceFilter] = useState<
    "all" | "high" | "low" | "medium" | "none"
  >("all");
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<
    "clicks" | "conversion" | "monthly" | "recent" | "visits" | "weekly"
  >("visits");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "all" | "draft" | "paused" | "published"
  >("all");
  const preferEventSummaries = analyticsSource === "d1_analytics_events";
  const rows = useMemo(
    () => buildCoachAnalyticsRows(coachSites, analyticsSummaries, { preferEventSummaries }),
    [analyticsSummaries, coachSites, preferEventSummaries]
  );
  const currentRows = useMemo(
    () => rows.filter((row) => row.status !== "archived" && row.status !== "removed"),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      filterCoachAnalyticsRows({
        dateRange: analyticsRange,
        funnelFilter,
        performanceFilter,
        query,
        regionFilter,
        rows: currentRows,
        sortBy,
        statusFilter
      }),
    [
      analyticsRange,
      currentRows,
      funnelFilter,
      performanceFilter,
      query,
      regionFilter,
      sortBy,
      statusFilter
    ]
  );
  const topRows = useMemo(() => getTopCoachAnalyticsRows(currentRows), [currentRows]);
  const needsAttentionRows = useMemo(() => getNeedsAttentionRows(currentRows), [currentRows]);
  const regions = useMemo(
    () =>
      Array.from(
        new Set(currentRows.map((row) => row.region).filter((region) => region !== "Not available"))
      ),
    [currentRows]
  );
  const selectedCoach = useMemo(
    () => currentRows.find((row) => row.coachId === selectedCoachId) || null,
    [currentRows, selectedCoachId]
  );

  function openCoachAnalytics(row: CoachAnalyticsRow) {
    setSelectedCoachId(row.coachId);
    setActiveTab(row.availableTabs[0] || "free");
  }

  function openPublicSite(row: CoachAnalyticsRow) {
    if (!row.publicLink) return;
    window.open(row.publicLink, "_blank", "noopener,noreferrer");
  }

  return (
    <AdminPageShell eyebrow="Coach Sites" title="Coach Analytics">
      <p className={styles.inlineNote}>
        Source:{" "}
        {source === "live-database" ? "Live coach-site database + paid funnel config" : source}.
        Analytics stream: {analyticsSource}. Selected range:{" "}
        {analyticsRangeOptions.find((option) => option.value === analyticsRange)?.label ||
          analyticsRange}
        . Every coach is detected dynamically from coach-site records and paid funnel
        configuration.
      </p>

      <section className={styles.analyticsKpiGrid} aria-label="Coach analytics summary">
        <AnalyticsKpiCard label="Total coaches" value={currentRows.length.toLocaleString()} />
        <AnalyticsKpiCard
          label="Paid only"
          value={currentRows
            .filter((row) => row.hasPaidMasterclass && !row.hasFreeGuestLink)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Free only"
          value={currentRows
            .filter((row) => row.hasFreeGuestLink && !row.hasPaidMasterclass)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Both funnels"
          value={currentRows.filter((row) => row.combinedAvailable).length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="No funnel"
          value={currentRows
            .filter((row) => !row.hasPaidMasterclass && !row.hasFreeGuestLink)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Needs attention"
          value={needsAttentionRows.length.toLocaleString()}
        />
      </section>

      <section className={styles.analyticsFilters} aria-label="Coach analytics filters">
        <label>
          Search coach
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, niche, or slug"
            type="search"
            value={query}
          />
        </label>
        <label>
          Funnel type
          <select
            onChange={(event) => setFunnelFilter(event.target.value as typeof funnelFilter)}
            value={funnelFilter}
          >
            <option value="all">All funnels</option>
            <option value="paid">Paid only</option>
            <option value="free">Free only</option>
            <option value="both">Both</option>
            <option value="none">No funnel</option>
          </select>
        </label>
        <label>
          Status
          <select
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            value={statusFilter}
          >
            <option value="all">Current records</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label>
          Date range
          <select
            onChange={(event) =>
              onAnalyticsRangeChange(event.target.value as AnalyticsDateRangeId)
            }
            value={analyticsRange}
          >
            {analyticsRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {analyticsRange === "custom" ? (
          <>
            <label>
              Start date
              <input
                onChange={(event) => onAnalyticsCustomStartChange(event.target.value)}
                type="date"
                value={analyticsCustomStart}
              />
            </label>
            <label>
              End date
              <input
                onChange={(event) => onAnalyticsCustomEndChange(event.target.value)}
                type="date"
                value={analyticsCustomEnd}
              />
            </label>
          </>
        ) : null}
        <label>
          Region
          <select onChange={(event) => setRegionFilter(event.target.value)} value={regionFilter}>
            <option value="all">All regions</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label>
          Performance
          <select
            onChange={(event) =>
              setPerformanceFilter(event.target.value as typeof performanceFilter)
            }
            value={performanceFilter}
          >
            <option value="all">All performance</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">No activity</option>
          </select>
        </label>
        <label>
          Sort by
          <select
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            value={sortBy}
          >
            <option value="visits">Visits</option>
            <option value="clicks">Clicks</option>
            <option value="conversion">Click-through rate</option>
            <option value="recent">Recent activity</option>
            <option value="weekly">Weekly growth</option>
            <option value="monthly">Monthly performance</option>
          </select>
        </label>
      </section>

      <section className={styles.analyticsGrid} aria-label="Coach analytics list">
        {filteredRows.length > 0 ? (
          filteredRows.map((row) => (
            <article className={styles.analyticsCoachCard} key={row.coachId}>
              <div className={styles.analyticsCoachIdentity}>
                {row.photoUrl ? (
                  <span
                    aria-hidden="true"
                    className={styles.analyticsAvatar}
                    style={{ backgroundImage: `url(${row.photoUrl})` }}
                  />
                ) : (
                  <span>{row.coachName[0]}</span>
                )}
                <div>
                  <h3>{row.coachName}</h3>
                  <p>{row.niche}</p>
                  <small>{row.location || row.coachSlug}</small>
                </div>
              </div>
              <div className={styles.funnelBadgeRow}>
                <FunnelBadges row={row} />
                <span className={styles.statusBadge} data-status={row.status}>
                  {row.status}
                </span>
              </div>
              <div className={styles.analyticsMiniMetrics}>
                <span>
                  <strong>{row.combined.visits.toLocaleString()}</strong>
                  Visits
                </span>
                <span>
                  <strong>{row.combined.clicks.toLocaleString()}</strong>
                  Clicks
                </span>
                <span>
                  <strong>{row.combined.conversionRate}</strong>
                  Click-through
                </span>
              </div>
              <div className={styles.analyticsMetaGrid}>
                <span>Best funnel: {row.bestFunnel}</span>
                <span>Last activity: {row.combined.lastActivity}</span>
                <span>Region: {row.region}</span>
                <span>Source: {row.source}</span>
              </div>
              <div className={styles.analyticsCardActions}>
                <button
                  className={styles.primaryAction}
                  onClick={() => openCoachAnalytics(row)}
                  type="button"
                >
                  View Analytics
                </button>
                <button
                  className={styles.secondaryAction}
                  onClick={() => onSelect("coach-sites")}
                  type="button"
                >
                  Manage
                </button>
                <button
                  className={styles.secondaryAction}
                  disabled={!row.publicLink}
                  onClick={() => openPublicSite(row)}
                  type="button"
                >
                  Open Site
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className={styles.emptyState}>No coaches match this filter.</div>
        )}
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Top Performers</p>
              <h2>Real recorded activity</h2>
            </div>
          </div>
          <div className={styles.analyticsRankList}>
            {topRows.length > 0 ? (
              topRows.map((row, index) => (
                <button key={row.coachId} onClick={() => openCoachAnalytics(row)} type="button">
                  <span>#{index + 1}</span>
                  <strong>{row.coachName}</strong>
                  <small>
                    {row.bestFunnel} / {row.combined.visits.toLocaleString()} visits /{" "}
                    {row.combined.conversionRate} click-through
                  </small>
                </button>
              ))
            ) : (
              <p>No top performer data available yet.</p>
            )}
          </div>
        </article>

        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Needs Attention</p>
              <h2>Coach-level action list</h2>
            </div>
          </div>
          <div className={styles.analyticsAttentionList}>
            {needsAttentionRows.length > 0 ? (
              needsAttentionRows.map((row) => (
                <button key={row.coachId} onClick={() => openCoachAnalytics(row)} type="button">
                  <strong>{row.coachName}</strong>
                  <span>{row.lowActivityReasons.join(" / ")}</span>
                </button>
              ))
            ) : (
              <p>No coach-level issues detected from current records.</p>
            )}
          </div>
        </article>
      </section>

      <p className={styles.inlineNote}>
        Free-funnel analytics track visits, register CTA clicks, and Google Form opens only. They
        stop at click/open counts. Paid panel uses recorded paid page/payment events in this admin;
        Razorpay/Sheets remains the payment truth source unless webhook sync is connected here.
      </p>

      <AdminActionDialog
        onClose={() => setSelectedCoachId(null)}
        open={Boolean(selectedCoach)}
        size="large"
        title={selectedCoach ? `${selectedCoach.coachName} Analytics` : "Coach Analytics"}
      >
        {selectedCoach ? (
          <CoachAnalyticsDetailPanel
            activeTab={activeTab}
            analyticsRange={analyticsRange}
            coach={selectedCoach}
            csrfToken={csrfToken}
            onTabChange={setActiveTab}
          />
        ) : null}
      </AdminActionDialog>
    </AdminPageShell>
  );
}

function AnalyticsKpiCard({
  detail,
  label,
  tone = "neutral",
  value
}: {
  detail?: string;
  label: string;
  tone?: "attention" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <article className={styles.metricCard} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

function AnalyticsWidget({
  eyebrow,
  items,
  title
}: {
  eyebrow: string;
  items: string[];
  title: string;
}) {
  return (
    <article className={styles.analyticsWidget}>
      <p className={styles.kicker}>{eyebrow}</p>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function AnalyticsAiWidget({
  cacheLabel,
  eyebrow,
  fallbackItems,
  insight,
  onGenerate,
  onRefresh,
  status,
  title,
  usageEstimate
}: {
  cacheLabel: string;
  eyebrow: string;
  fallbackItems: string[];
  insight: AdminAiAnalyticsInsight | null;
  onGenerate: () => void;
  onRefresh: () => void;
  status: string;
  title: string;
  usageEstimate?: AdminAiAnalyticsPayload["usageEstimate"];
}) {
  const items = insight ? formatAiInsightItems(insight) : fallbackItems;

  return (
    <article className={styles.analyticsWidget}>
      <p className={styles.kicker}>{eyebrow}</p>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className={styles.analyticsWidgetActions}>
        <button className={styles.primaryAction} onClick={insight ? onRefresh : onGenerate} type="button">
          {insight ? "Refresh AI Overview" : "Generate AI Overview"}
        </button>
      </div>
      {status || usageEstimate ? (
        <p className={styles.inlineNote}>
          {status || "AI ready."}
          {cacheLabel ? ` Cache: ${cacheLabel}.` : ""}
          {usageEstimate
            ? ` Estimate: ${usageEstimate.approximateCostLevel}, ${usageEstimate.estimatedInputTokens} input / ${usageEstimate.estimatedOutputTokens} output tokens.`
            : ""}
        </p>
      ) : null}
    </article>
  );
}

function FunnelBadges({ row }: { row: CoachAnalyticsRow }) {
  if (!row.hasPaidMasterclass && !row.hasFreeGuestLink) {
    return (
      <span className={styles.funnelBadge} data-funnel="none">
        None
      </span>
    );
  }

  return (
    <>
      {row.hasPaidMasterclass ? (
        <span className={styles.funnelBadge} data-funnel="paid">
          Paid
        </span>
      ) : null}
      {row.hasFreeGuestLink ? (
        <span className={styles.funnelBadge} data-funnel="free">
          Free
        </span>
      ) : null}
      {row.combinedAvailable ? (
        <span className={styles.funnelBadge} data-funnel="both">
          Both
        </span>
      ) : null}
    </>
  );
}

function CoachAnalyticsDetailPanel({
  activeTab,
  analyticsRange,
  coach,
  csrfToken,
  onTabChange
}: {
  activeTab: CoachAnalyticsFunnelType;
  analyticsRange: AnalyticsDateRangeId;
  coach: CoachAnalyticsRow;
  csrfToken: string;
  onTabChange: (tab: CoachAnalyticsFunnelType) => void;
}) {
  const [copyMessage, setCopyMessage] = useState("");
  const [insightCache, setInsightCache] = useState("");
  const [insightGeneratedAt, setInsightGeneratedAt] = useState("");
  const [insightStatus, setInsightStatus] = useState("");
  const [insightUsage, setInsightUsage] =
    useState<AdminAiAnalyticsPayload["usageEstimate"]>(undefined);
  const [insights, setInsights] = useState<string[]>([]);
  const [reportFormat, setReportFormat] = useState<"admin" | "detailed" | "whatsapp">("whatsapp");
  const analyticsRangeLabel =
    analyticsRangeOptions.find((option) => option.value === analyticsRange)?.label ||
    analyticsRange;
  const reportText = useMemo(
    () => buildCoachReport(coach, reportFormat, insights, analyticsRangeLabel),
    [analyticsRangeLabel, coach, insights, reportFormat]
  );
  const hasEnoughData = coach.combined.visits > 0 || coach.combined.clicks > 0;

  async function generateInsights(forceRefresh = false) {
    if (!hasEnoughData) {
      setInsights(["Not enough data for AI insights yet."]);
      setInsightGeneratedAt(new Date().toLocaleString());
      return;
    }

    if (!csrfToken) {
      setInsightStatus("Admin verification token is not ready yet.");
      return;
    }

    setInsightStatus(forceRefresh ? "Refreshing AI insights..." : "Generating AI insights...");

    try {
      const response = await fetch("/api/admin/analytics-insights", {
        body: JSON.stringify({
          dateRange: analyticsRange,
          forceRefresh,
          payload: buildCoachAiPayload(coach, activeTab),
          scope: "coach"
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminAiAnalyticsPayload;

      if (response.ok && payload.ok && payload.insight) {
        setInsights(formatAiInsightItems(payload.insight));
        setInsightCache(payload.cache || "");
        setInsightGeneratedAt(new Date(payload.insight.generatedAt).toLocaleString());
        setInsightUsage(payload.usageEstimate);
        setInsightStatus(
          `${payload.cache === "hit" ? "Cached" : "Generated"} with ${payload.insight.model}.`
        );
        return;
      }

      setInsightStatus(
        payload.configured === false
          ? "AI Analytics is not configured yet."
          : payload.message || "AI insights could not be generated right now."
      );
    } catch {
      setInsightStatus("AI insights could not be generated right now.");
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyMessage("Coach report copied.");
    } catch {
      setCopyMessage("Copy unavailable. Report remains visible.");
    }
  }

  function downloadReport() {
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${coach.coachSlug || "coach"}-analytics-report.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareSummary() {
    const summary = buildCoachReport(coach, "whatsapp", insights, analyticsRangeLabel);
    if ("share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          text: summary,
          title: `${coach.coachName} coach report`
        });
        setCopyMessage("Share sheet opened.");
        return;
      } catch {
        // Fall back to clipboard below.
      }
    }

    try {
      await navigator.clipboard.writeText(summary);
      setCopyMessage("Share summary copied.");
    } catch {
      setCopyMessage("Share unavailable. Summary remains visible.");
    }
  }

  return (
    <div className={styles.analyticsDetail}>
      <header className={styles.analyticsDetailHeader}>
        <div className={styles.analyticsCoachIdentity}>
          {coach.photoUrl ? (
            <span
              aria-hidden="true"
              className={styles.analyticsAvatar}
              style={{ backgroundImage: `url(${coach.photoUrl})` }}
            />
          ) : (
            <span>{coach.coachName[0]}</span>
          )}
          <div>
            <p className={styles.kicker}>Coach-wise analytics</p>
            <h3>{coach.coachName}</h3>
            <p>{coach.niche}</p>
            <code>{coach.publicLink || coach.coachSlug}</code>
          </div>
        </div>
        <div className={styles.funnelBadgeRow}>
          <FunnelBadges row={coach} />
          <span className={styles.statusBadge} data-status={coach.status}>
            {coach.status}
          </span>
        </div>
      </header>

      <section className={styles.analyticsDetailActions}>
        <button
          className={styles.primaryAction}
          onClick={() => void generateInsights(Boolean(insightGeneratedAt))}
          type="button"
        >
          {insightGeneratedAt ? "Refresh AI Insights" : "Generate AI Insights"}
        </button>
        <label>
          Report format
          <select
            onChange={(event) => setReportFormat(event.target.value as typeof reportFormat)}
            value={reportFormat}
          >
            <option value="whatsapp">Short WhatsApp summary</option>
            <option value="detailed">Detailed coach report</option>
            <option value="admin">Admin internal report</option>
          </select>
        </label>
        <button className={styles.secondaryAction} onClick={() => void copyReport()} type="button">
          Copy Report
        </button>
        <button className={styles.secondaryAction} onClick={downloadReport} type="button">
          Download Report
        </button>
        <button
          className={styles.secondaryAction}
          onClick={() => void shareSummary()}
          type="button"
        >
          Share Summary
        </button>
      </section>

      <section className={styles.analyticsDashboardGrid}>
        <AnalyticsWidget
          eyebrow="AI Coach Summary"
          items={
            insights.length
              ? insights
              : ["Click Generate AI Insights to analyze compact aggregate data."]
          }
          title={
            insightGeneratedAt
              ? `Last generated ${insightGeneratedAt}${insightCache ? ` / ${insightCache}` : ""}`
              : "On-demand only"
          }
        />
        {insightStatus || insightUsage ? (
          <AnalyticsWidget
            eyebrow="AI Status"
            items={[
              insightStatus || "No AI request made yet.",
              insightUsage
                ? `Estimate: ${insightUsage.approximateCostLevel} / ${insightUsage.estimatedInputTokens} input tokens / ${insightUsage.estimatedOutputTokens} output tokens.`
                : "Token estimate appears after generation."
            ]}
            title="Server-side only"
          />
        ) : null}
        <AnalyticsWidget
          eyebrow="Prediction"
          items={buildCoachPredictionItems(coach)}
          title="Based on available counters"
        />
        <article className={styles.analyticsReportCard}>
          <p className={styles.kicker}>Coach Report</p>
          <h3>Safe to copy after review</h3>
          <pre>{reportText}</pre>
          {copyMessage ? <p className={styles.inlineStatus}>{copyMessage}</p> : null}
        </article>
      </section>

      {coach.availableTabs.length > 0 ? (
        <div className={styles.analyticsTabs} role="tablist" aria-label="Coach analytics tabs">
          {coach.availableTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              data-active={activeTab === tab ? "true" : "false"}
              key={tab}
              onClick={() => onTabChange(tab)}
              role="tab"
              type="button"
            >
              {getAnalyticsTabLabel(tab)}
            </button>
          ))}
        </div>
      ) : null}

      {coach.availableTabs.length === 0 ? (
        <div className={styles.emptyState}>
          No funnel connected yet. This coach can stay listed here until a paid funnel or free guest
          website is connected.
        </div>
      ) : null}

      {activeTab === "combined" && coach.combinedAvailable ? (
        <CombinedAnalyticsTab coach={coach} />
      ) : null}
      {activeTab === "paid" && coach.hasPaidMasterclass ? <PaidAnalyticsTab coach={coach} /> : null}
      {activeTab === "free" && coach.hasFreeGuestLink ? <FreeAnalyticsTab coach={coach} /> : null}
    </div>
  );
}

function CombinedAnalyticsTab({ coach }: { coach: CoachAnalyticsRow }) {
  return (
    <section className={styles.analyticsTabPanel}>
      <div className={styles.analyticsKpiGrid}>
        <AnalyticsKpiCard label="Combined visits" value={coach.combined.visits.toLocaleString()} />
        <AnalyticsKpiCard label="Combined clicks" value={coach.combined.clicks.toLocaleString()} />
        <AnalyticsKpiCard label="Click-through rate" value={coach.combined.conversionRate} />
        <AnalyticsKpiCard label="Best funnel" value={coach.bestFunnel} />
      </div>
      <ComparisonBars
        items={[
          { label: "Paid visits", value: coach.paidMetrics.visits },
          { label: "Free visits", value: coach.freeMetrics.visits },
          { label: "Paid clicks", value: coach.paidMetrics.clicks },
          { label: "Free clicks", value: coach.freeMetrics.clicks }
        ]}
      />
      <BreakdownGrid coach={coach} />
      <InsightList coach={coach} />
    </section>
  );
}

function PaidAnalyticsTab({ coach }: { coach: CoachAnalyticsRow }) {
  const metrics = coach.paidMetrics;

  return (
    <section className={styles.analyticsTabPanel}>
      <div className={styles.analyticsKpiGrid}>
        <AnalyticsKpiCard label="Landing visits" value={metrics.visits.toLocaleString()} />
        <AnalyticsKpiCard
          label="Register CTA clicks"
          value={metrics.registerClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Payment clicks"
          value={metrics.paymentButtonClicks.toLocaleString()}
        />
        <AnalyticsKpiCard label="Payment success" value={metrics.paymentSuccess.toLocaleString()} />
        <AnalyticsKpiCard
          label="Success page views"
          value={metrics.successPageViews.toLocaleString()}
        />
        <AnalyticsKpiCard label="WhatsApp clicks" value={metrics.whatsappClicks.toLocaleString()} />
      </div>
      <FunnelSteps
        steps={[
          ["Landing page visit", metrics.visits],
          ["Register CTA click", metrics.registerClicks],
          ["Payment click", metrics.paymentButtonClicks],
          ["Payment initiated", metrics.paymentInitiated],
          ["Payment success", metrics.paymentSuccess],
          ["Success page viewed", metrics.successPageViews],
          ["WhatsApp clicked", metrics.whatsappClicks]
        ]}
      />
      <p className={styles.inlineNote}>
        This panel does not expose or replace paid payment data. Completed payment and paid
        registration truth should stay in the existing Razorpay-to-Sheet analytics system.
      </p>
    </section>
  );
}

function FreeAnalyticsTab({ coach }: { coach: CoachAnalyticsRow }) {
  const metrics = coach.freeMetrics;

  return (
    <section className={styles.analyticsTabPanel}>
      <div className={styles.analyticsKpiGrid}>
        <AnalyticsKpiCard label="Coach page visits" value={metrics.visits.toLocaleString()} />
        <AnalyticsKpiCard
          label="Register CTA clicks"
          value={metrics.registerClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Google Form opens"
          value={metrics.googleFormClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="WhatsApp/contact clicks"
          value={metrics.whatsappClicks.toLocaleString()}
        />
        <AnalyticsKpiCard label="Video plays" value={metrics.videoPlays.toLocaleString()} />
        <AnalyticsKpiCard label="Click-through rate" value={metrics.conversionRate} />
      </div>
      <FunnelSteps
        steps={[
          ["Coach public page visit", metrics.visits],
          ["Register CTA click", metrics.registerClicks],
          ["Google Form opened", metrics.googleFormClicks]
        ]}
      />
      <div className={styles.analyticsMetaGrid}>
        <span>Public URL: {coach.publicLink || "Not published"}</span>
        <span>Google Form: {metrics.googleFormStatus}</span>
        <span>Support: {metrics.supportStatus}</span>
        <span>Device: {formatDeviceBreakdown(coach.deviceBreakdown)}</span>
      </div>
      <p className={styles.inlineNote}>
        This panel tracks only the visitor opening the Google Form from the coach site. It stops at
        click/open counts.
      </p>
    </section>
  );
}

function ComparisonBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className={styles.analyticsBars}>
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value.toLocaleString()}</strong>
          <i style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function FunnelSteps({ steps }: { steps: Array<[string, number]> }) {
  const maxValue = Math.max(1, ...steps.map(([, value]) => value));

  return (
    <div className={styles.analyticsFunnelSteps}>
      {steps.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value.toLocaleString()}</strong>
          <i style={{ width: `${Math.max(4, (value / maxValue) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function BreakdownGrid({ coach }: { coach: CoachAnalyticsRow }) {
  return (
    <div className={styles.analyticsMetaGrid}>
      <span>Top region: {coach.region}</span>
      <span>Top device: {formatDeviceBreakdown(coach.deviceBreakdown)}</span>
      <span>Traffic source: {coach.source}</span>
      <span>Last activity: {coach.combined.lastActivity}</span>
    </div>
  );
}

function InsightList({ coach }: { coach: CoachAnalyticsRow }) {
  const insights = [
    coach.combined.visits > 0
      ? `${coach.bestFunnel} is currently the strongest recorded funnel.`
      : "Not enough data yet.",
    coach.freeMetrics.visits > coach.paidMetrics.visits
      ? "Free Guest Link is getting more visits."
      : "Not enough paid/free traffic data for comparison yet.",
    coach.deviceBreakdown.mobile > coach.deviceBreakdown.desktop
      ? "Most recorded visitors are coming from mobile."
      : "Not enough device data yet.",
    coach.lowActivityReasons.length
      ? coach.lowActivityReasons.join(" / ")
      : "No immediate action detected."
  ];

  return (
    <div className={styles.analyticsInsightList}>
      {insights.map((insight) => (
        <p key={insight}>{insight}</p>
      ))}
    </div>
  );
}

function formatAiInsightItems(insight: AdminAiAnalyticsInsight) {
  return [
    `Summary: ${insight.summary}`,
    ...insight.keyTrends.map((item) => `Trend: ${item}`),
    ...insight.recommendations.map((item) => `Action: ${item}`),
    ...insight.predictions.map((item) => `Likely prediction: ${item}`),
    ...insight.warnings.map((item) => `Warning: ${item}`)
  ].slice(0, 10);
}

function buildCoachAiPayload(coach: CoachAnalyticsRow, activeTab: CoachAnalyticsFunnelType) {
  return {
    activeTab,
    coach: {
      funnelTypes: getCoachFunnelLabels(coach),
      name: coach.coachName,
      niche: coach.niche,
      slug: coach.coachSlug,
      status: coach.status
    },
    combined: {
      clicks: coach.combined.clicks,
      conversionRate: coach.combined.conversionRate,
      lastActivity: coach.combined.lastActivity,
      visits: coach.combined.visits
    },
    deviceBreakdown: coach.deviceBreakdown,
    freeFunnel: coach.hasFreeGuestLink
      ? {
          googleFormStatus: coach.freeMetrics.googleFormStatus,
          registerClicks: coach.freeMetrics.registerClicks,
          supportStatus: coach.freeMetrics.supportStatus,
          videoPlays: coach.freeMetrics.videoPlays,
          visits: coach.freeMetrics.visits,
          whatsappClicks: coach.freeMetrics.whatsappClicks
        }
      : null,
    lowActivityReasons: coach.lowActivityReasons,
    paidFunnel: coach.hasPaidMasterclass
      ? {
          paymentButtonClicks: coach.paidMetrics.paymentButtonClicks,
          paymentInitiated: coach.paidMetrics.paymentInitiated,
          paymentSuccess: coach.paidMetrics.paymentSuccess,
          paymentToSuccessDropOff: coach.paidMetrics.paymentToSuccessDropOff,
          registerClicks: coach.paidMetrics.registerClicks,
          successPageViews: coach.paidMetrics.successPageViews,
          visits: coach.paidMetrics.visits,
          whatsappClicks: coach.paidMetrics.whatsappClicks
        }
      : null,
    region: coach.region,
    source: coach.source
  };
}

function buildCoachPredictionItems(coach: CoachAnalyticsRow) {
  if (coach.combined.visits === 0) {
    return ["Not enough data for prediction yet."];
  }

  const weeklyVisits = sumNumbers(coach.freeGuestLinks.map((site) => site.analytics.weeklyVisits));
  const projectedClicks = Math.round(
    weeklyVisits * (Number.parseFloat(coach.combined.conversionRate) / 100)
  );

  return [
    `Likely next 7 days: ${weeklyVisits.toLocaleString()} visits if current weekly pace holds.`,
    `Projected register clicks: ${Number.isFinite(projectedClicks) ? projectedClicks : 0}.`,
    `Best-performing funnel signal: ${coach.bestFunnel}.`
  ];
}

function buildCoachReport(
  coach: CoachAnalyticsRow,
  format: "admin" | "detailed" | "whatsapp",
  insights: string[],
  dateRangeLabel: string
) {
  const activeFunnels = getCoachFunnelLabels(coach).join(", ") || "No active funnel";
  const topDevice = formatDeviceBreakdown(coach.deviceBreakdown);
  const insightText = insights.length ? insights.join(" ") : "Not enough data for AI insights yet.";

  if (format === "whatsapp") {
    return [
      `${coach.coachName} performance summary`,
      `Date range: ${dateRangeLabel}`,
      `Visits: ${coach.combined.visits.toLocaleString()}`,
      `Register/CTA clicks: ${coach.combined.clicks.toLocaleString()}`,
      `Click-through: ${coach.combined.conversionRate}`,
      `Active funnel: ${activeFunnels}`,
      `Top region/device: ${coach.region} / ${topDevice}`,
      `Suggested next step: ${coach.lowActivityReasons[0] || "keep sharing the coach link and monitor clicks weekly."}`
    ].join("\n");
  }

  const common = [
    `Coach: ${coach.coachName}`,
    `Niche: ${coach.niche}`,
    `Date range: ${dateRangeLabel}`,
    `Active funnel types: ${activeFunnels}`,
    `Total visits: ${coach.combined.visits.toLocaleString()}`,
    `Register/CTA clicks: ${coach.combined.clicks.toLocaleString()}`,
    `WhatsApp/contact clicks: ${coach.freeMetrics.whatsappClicks.toLocaleString()}`,
    `Conversion rate: ${coach.combined.conversionRate}`,
    `Top traffic source: ${coach.source}`,
    `Top region/device: ${coach.region} / ${topDevice}`,
    `Trend summary: ${coach.trend}`,
    `AI insights: ${insightText}`,
    `Recommended next actions: ${coach.lowActivityReasons.join("; ") || "Continue weekly sharing and compare click-through."}`
  ];

  if (format === "admin") {
    common.push(
      `Admin notes: ${coach.lowActivityReasons.join("; ") || "No current admin-only warning."}`,
      "Private data, payment details, OTPs, secrets, raw user data, and private WhatsApp links are intentionally excluded."
    );
  }

  return common.join("\n");
}

function getCoachFunnelLabels(coach: CoachAnalyticsRow) {
  return [
    coach.hasPaidMasterclass ? "Paid Masterclass" : "",
    coach.hasFreeGuestLink ? "Free Guest Link" : ""
  ].filter(Boolean);
}

function getAnalyticsTabLabel(tab: CoachAnalyticsFunnelType) {
  if (tab === "combined") return "Combined Overview";
  if (tab === "paid") return "Paid Masterclass";
  return "Free Guest Link";
}

function formatDeviceBreakdown(deviceBreakdown: CoachSiteRecord["analytics"]["deviceBreakdown"]) {
  return `Mobile ${deviceBreakdown.mobile} / Desktop ${deviceBreakdown.desktop} / Tablet ${deviceBreakdown.tablet}`;
}

function MasterclassLinksView({
  control,
  csrfToken
}: {
  control: typeof adminControlCenterData;
  csrfToken: string;
}) {
  const [managedLink, setManagedLink] = useState<AdminPaidMasterclassLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [privateOtp, setPrivateOtp] = useState("");
  const [privateWhatsappDraft, setPrivateWhatsappDraft] = useState("");
  const [privateRevealUrl, setPrivateRevealUrl] = useState("");
  const [privateRevealMessage, setPrivateRevealMessage] = useState("");
  const [privateRevealBusy, setPrivateRevealBusy] = useState(false);
  const [privateUpdateMessage, setPrivateUpdateMessage] = useState("");
  const [privateLinkMetadata, setPrivateLinkMetadata] = useState<
    Record<string, PrivateLinkMetadata>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadPrivateLinkMetadata() {
      try {
        const response = await fetch("/api/admin/masterclass-private-link", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          links?: PrivateLinkMetadata[];
          ok?: boolean;
        };

        if (!cancelled && response.ok && payload.ok && Array.isArray(payload.links)) {
          setPrivateLinkMetadata(
            Object.fromEntries(payload.links.map((item) => [item.funnelId, item]))
          );
        }
      } catch {
        // Keep static metadata visible if the protected metadata API is unavailable.
      }
    }

    void loadPrivateLinkMetadata();

    return () => {
      cancelled = true;
    };
  }, []);

  const paidMasterclassLinks = control.paidMasterclassLinks.map(applyPrivateLinkMetadata);
  const currentManagedLink = managedLink ? applyPrivateLinkMetadata(managedLink) : null;

  function applyPrivateLinkMetadata(link: AdminPaidMasterclassLink) {
    const metadata = privateLinkMetadata[link.funnelId];
    if (!metadata) return link;

    return {
      ...link,
      privateWhatsappLastChangedAt: metadata.updatedAt,
      privateWhatsappLastChangedBy: metadata.updatedBy,
      privateWhatsappSecretName: "private_funnel_links",
      privateWhatsappStorageSource: metadata.storageSource,
      privateWhatsappStatus: metadata.configured ? "D1 server table" : "Not configured"
    };
  }

  async function sendPrivateRevealOtp(link: AdminPaidMasterclassLink) {
    setPrivateRevealBusy(true);
    setPrivateRevealMessage("");
    setPrivateRevealUrl("");

    try {
      const response = await fetch("/api/admin/masterclass-private-link", {
        body: JSON.stringify({
          action: "send_otp",
          entryPath: link.entryPath
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        ok?: boolean;
      };

      setPrivateRevealMessage(
        response.ok && payload.ok
          ? payload.message || "OTP sent to the current admin email."
          : payload.error || "Could not send OTP."
      );
    } catch {
      setPrivateRevealMessage("Could not reach the reveal OTP API.");
    } finally {
      setPrivateRevealBusy(false);
    }
  }

  async function revealPrivateWhatsapp(link: AdminPaidMasterclassLink) {
    setPrivateRevealBusy(true);
    setPrivateRevealMessage("");
    setPrivateRevealUrl("");

    try {
      const response = await fetch("/api/admin/masterclass-private-link", {
        body: JSON.stringify({
          action: "reveal",
          entryPath: link.entryPath,
          otp: privateOtp
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        expiresInSeconds?: number;
        joinUrl?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.joinUrl) {
        setPrivateRevealMessage(payload.error || "Could not reveal the private WhatsApp link.");
        return;
      }

      setPrivateRevealUrl(payload.joinUrl);
      setPrivateRevealMessage(
        `Private link revealed. It will hide automatically in ${
          payload.expiresInSeconds || 20
        } seconds.`
      );
      window.setTimeout(
        () => {
          setPrivateRevealUrl("");
          setPrivateOtp("");
        },
        (payload.expiresInSeconds || 20) * 1000
      );
    } catch {
      setPrivateRevealMessage("Could not reach the private reveal API.");
    } finally {
      setPrivateRevealBusy(false);
    }
  }

  async function updatePrivateWhatsapp(link: AdminPaidMasterclassLink) {
    setPrivateRevealBusy(true);
    setPrivateUpdateMessage("");
    setPrivateRevealUrl("");

    try {
      const response = await fetch("/api/admin/masterclass-private-link", {
        body: JSON.stringify({
          action: "update_whatsapp",
          entryCode: link.entryCode,
          otp: privateOtp,
          whatsappGroupUrl: privateWhatsappDraft
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        metadata?: PrivateLinkMetadata;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.metadata) {
        setPrivateUpdateMessage(payload.error || "Could not save the private WhatsApp link.");
        return;
      }

      setPrivateLinkMetadata((current) => ({
        ...current,
        [payload.metadata!.funnelId]: payload.metadata!
      }));
      setPrivateWhatsappDraft("");
      setPrivateUpdateMessage("Private WhatsApp link saved server-side in D1.");
    } catch {
      setPrivateUpdateMessage("Could not reach the private link save API.");
    } finally {
      setPrivateRevealBusy(false);
    }
  }

  async function copyPrivateWhatsappLink() {
    if (!privateRevealUrl) return;

    try {
      await navigator.clipboard.writeText(privateRevealUrl);
      setPrivateRevealMessage("Private WhatsApp link copied.");
    } catch {
      setPrivateRevealMessage(`Private WhatsApp link: ${privateRevealUrl}`);
    }
  }

  async function copyMasterclassPath(label: string, path: string) {
    const value =
      typeof window === "undefined" || path.startsWith("http")
        ? path
        : new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`${label}: ${value}`);
    }
  }

  function openMasterclassPath(path: string) {
    if (typeof window === "undefined") return;
    window.open(path, "_blank", "noopener,noreferrer");
  }

  function formatPrivateWhatsappChangedAt(link: AdminPaidMasterclassLink) {
    if (!link.privateWhatsappLastChangedAt) return "Not recorded yet";

    const changedAt = new Date(link.privateWhatsappLastChangedAt);
    if (Number.isNaN(changedAt.getTime())) return link.privateWhatsappLastChangedAt;

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(changedAt);
  }

  return (
    <AdminPageShell eyebrow="Paid Masterclass" title="Link Settings">
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Live Paid Websites</p>
            <h2>Public links and private-link status</h2>
          </div>
        </div>
        <div className={styles.paidLinkList}>
          {paidMasterclassLinks.map((link) => (
            <article className={styles.paidLinkCard} key={link.entryPath}>
              <div>
                <p className={styles.kicker}>Masterclass</p>
                <h3>{link.displayName}</h3>
                <p>{link.coachName}</p>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Public entry</span>
                <code>{link.entryPath}</code>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Paid page</span>
                <code>{link.paidPagePath}</code>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Payment</span>
                <strong>{link.paymentStatus}</strong>
              </div>
              <button
                className={styles.primaryAction}
                onClick={() => {
                  setCopyMessage("");
                  setPrivateOtp("");
                  setPrivateWhatsappDraft("");
                  setPrivateRevealMessage("");
                  setPrivateRevealUrl("");
                  setPrivateUpdateMessage("");
                  setManagedLink(link);
                }}
                type="button"
              >
                Manage
              </button>
            </article>
          ))}
        </div>
        <p className={styles.inlineNote}>
          Public entry links can be shared. Private WhatsApp invite values are intentionally hidden
          and resolved only by the server after paid access verification.
        </p>
      </section>

      <div className={styles.statusGrid}>
        {control.masterclassSettings.map((item) => (
          <article className={styles.statusCard} data-tone={item.tone} key={item.label}>
            <span>{item.status}</span>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
      <p className={styles.inlineStatus}>
        Paid landing pages remain custom jobs. Private paid links stay server-side only.
      </p>

      <AdminActionDialog
        onClose={() => setManagedLink(null)}
        open={Boolean(managedLink)}
        title="Manage Paid Masterclass"
      >
        {currentManagedLink ? (
          <div className={styles.manageDialog}>
            <div>
              <p className={styles.kicker}>Paid Website</p>
              <h3>{currentManagedLink.displayName}</h3>
              <p>{currentManagedLink.coachName}</p>
            </div>

            <dl className={styles.definitionGrid}>
              <div>
                <dt>Public entry</dt>
                <dd>
                  <code>{currentManagedLink.entryPath}</code>
                </dd>
              </div>
              <div>
                <dt>Paid page</dt>
                <dd>
                  <code>{currentManagedLink.paidPagePath}</code>
                </dd>
              </div>
              <div>
                <dt>Success page</dt>
                <dd>
                  <code>{currentManagedLink.successPath}</code>
                </dd>
              </div>
              <div>
                <dt>Private WhatsApp</dt>
                <dd>
                  {currentManagedLink.privateWhatsappStatus}
                  <code>{currentManagedLink.privateWhatsappSecretName}</code>
                </dd>
              </div>
              <div>
                <dt>Last changed</dt>
                <dd>
                  <span className={styles.metaValue}>
                    {formatPrivateWhatsappChangedAt(currentManagedLink)}
                  </span>
                  {currentManagedLink.privateWhatsappLastChangedAt ? (
                    <small>Changed by {currentManagedLink.privateWhatsappLastChangedBy}</small>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className={styles.formActions}>
              <button
                className={styles.primaryAction}
                onClick={() => openMasterclassPath(currentManagedLink.entryPath)}
                type="button"
              >
                Preview / Go To Site
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() => openMasterclassPath(currentManagedLink.paidPagePath)}
                type="button"
              >
                Open Paid Page
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() =>
                  void copyMasterclassPath("Public entry link", currentManagedLink.entryPath)
                }
                type="button"
              >
                Copy Entry Link
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() =>
                  void copyMasterclassPath("Paid page link", currentManagedLink.paidPagePath)
                }
                type="button"
              >
                Copy Paid Page
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() =>
                  void copyMasterclassPath("Success page link", currentManagedLink.successPath)
                }
                type="button"
              >
                Copy Success Link
              </button>
            </div>

            {copyMessage ? <p className={styles.inlineStatus}>{copyMessage}</p> : null}
            <div className={styles.privateRevealPanel}>
              <div>
                <p className={styles.kicker}>Admin OTP Reveal</p>
                <h4>Reveal private WhatsApp invite</h4>
                <p>
                  The real invite is fetched only after a fresh OTP check. It is never printed in
                  the table or public code.
                </p>
              </div>
              <div className={styles.formActions}>
                <button
                  className={styles.secondaryAction}
                  disabled={privateRevealBusy}
                  onClick={() => void sendPrivateRevealOtp(currentManagedLink)}
                  type="button"
                >
                  {privateRevealBusy ? "Working..." : "Send OTP"}
                </button>
                <label className={styles.compactField}>
                  <span>OTP</span>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setPrivateOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    type="password"
                    value={privateOtp}
                  />
                </label>
                <button
                  className={styles.primaryAction}
                  disabled={privateRevealBusy || privateOtp.length !== 6}
                  onClick={() => void revealPrivateWhatsapp(currentManagedLink)}
                  type="button"
                >
                  Reveal Link
                </button>
              </div>
              {privateRevealUrl ? (
                <div className={styles.revealedSecretBox}>
                  <code>{privateRevealUrl}</code>
                  <button
                    className={styles.primaryAction}
                    onClick={() => void copyPrivateWhatsappLink()}
                    type="button"
                  >
                    Copy Private Link
                  </button>
                </div>
              ) : null}
              {privateRevealMessage ? (
                <p className={privateRevealUrl ? styles.inlineStatus : styles.linkWarning}>
                  {privateRevealMessage}
                </p>
              ) : null}
            </div>
            <div className={styles.privateRevealPanel}>
              <div>
                <p className={styles.kicker}>Server-Side Table</p>
                <h4>Save private WhatsApp link</h4>
                <p>
                  Use the same OTP field above. The saved URL goes into the protected D1 server
                  table for this masterclass.
                </p>
              </div>
              <label className={styles.compactField}>
                <span>WhatsApp invite URL</span>
                <input
                  onChange={(event) => setPrivateWhatsappDraft(event.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  type="url"
                  value={privateWhatsappDraft}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.primaryAction}
                  disabled={
                    privateRevealBusy || privateOtp.length !== 6 || !privateWhatsappDraft.trim()
                  }
                  onClick={() => void updatePrivateWhatsapp(currentManagedLink)}
                  type="button"
                >
                  Save Server Link
                </button>
              </div>
              {privateUpdateMessage ? (
                <p className={styles.inlineStatus}>{privateUpdateMessage}</p>
              ) : null}
            </div>
            <p className={styles.linkWarning}>
              The real WhatsApp invite stays server-side and is only shown here after OTP. Link
              change time is tracked separately from reveal attempts.
            </p>
          </div>
        ) : null}
      </AdminActionDialog>
    </AdminPageShell>
  );
}

function ErrorReportsView({
  csrfToken,
  errorReports,
  onReportsChange,
  source
}: {
  csrfToken: string;
  errorReports: AdminErrorReport[];
  onReportsChange: (reports: AdminErrorReport[]) => void;
  source: string;
}) {
  const [selectedReport, setSelectedReport] = useState<AdminErrorReport | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const isLiveSource = source === "d1_table";
  const isLoadingSource = source === "loading";

  useEffect(() => {
    if (!copyMessage) return;

    const timeout = window.setTimeout(() => setCopyMessage(""), 1800);

    return () => window.clearTimeout(timeout);
  }, [copyMessage]);

  async function copyAdminText(label: string, value: string) {
    try {
      await window.navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage("Copy unavailable.");
    }
  }

  async function updateReportStatus(report: AdminErrorReport, status: AdminErrorReport["status"]) {
    setStatusMessage("Updating error report...");

    try {
      const response = await fetch("/api/admin/error-reports", {
        body: JSON.stringify({
          adminNotes:
            status === "Fixed"
              ? "Marked fixed from Admin Error Reports."
              : `Marked ${status} from Admin Error Reports.`,
          referenceId: report.referenceId,
          status
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error || "Could not update this report.");
        return;
      }

      onReportsChange(
        errorReports.map((item) =>
          item.referenceId === report.referenceId
            ? { ...item, status, updatedAt: new Date().toISOString() }
            : item
        )
      );
      setSelectedReport((current) =>
        current?.referenceId === report.referenceId
          ? { ...current, status, updatedAt: new Date().toISOString() }
          : current
      );
      setStatusMessage(`Marked ${status}.`);
    } catch {
      setStatusMessage(
        "Could not update this report. The API stayed safe and no public data leaked."
      );
    }
  }

  return (
    <AdminPageShell eyebrow="Reports" title="Error Reports">
      <div className={styles.noticeCard} data-tone={isLiveSource ? "success" : "warning"}>
        <strong>
          {isLiveSource
            ? "Live D1 error reports"
            : isLoadingSource
              ? "Loading error reports"
              : "Error report storage unavailable"}
        </strong>
        <p>
          {isLiveSource
            ? "Public fallback events are being saved server-side with safe details only."
            : isLoadingSource
              ? "Checking the protected Admin Error Reports API."
              : "D1 reports are not available in this environment. No fallback rows are shown."}
        </p>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Error code</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Page</th>
              <th>Support</th>
              <th>User action</th>
              <th>Safe message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {errorReports.length > 0 ? (
              errorReports.map((report) => (
                <tr key={report.referenceId}>
                  <td>
                    <div className={styles.codeStack}>
                      <code>{report.errorCode || report.referenceId}</code>
                      <small>{report.referenceId}</small>
                      <button
                        onClick={() =>
                          void copyAdminText("Error code", report.errorCode || report.referenceId)
                        }
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td>{report.status}</td>
                  <td>{report.severity}</td>
                  <td>{report.category}</td>
                  <td>{report.pagePath}</td>
                  <td>{report.supportSource || "default"}</td>
                  <td>{report.userAction}</td>
                  <td>{report.safeMessage}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setStatusMessage("");
                        }}
                        type="button"
                      >
                        View
                      </button>
                      <button
                        onClick={() => void updateReportStatus(report, "Fixed")}
                        type="button"
                      >
                        Mark Fixed
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>
                  {isLiveSource
                    ? "No live error reports yet. This is the correct production state until a fallback event is recorded."
                    : isLoadingSource
                      ? "Loading protected error reports..."
                      : "No fallback reports available in this environment."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className={styles.reportPrompt}>
        <strong>Codex-ready bug prompt</strong>
        <code>
          {errorReports[0] ? createErrorReportBugPrompt(errorReports[0]) : "No reports yet."}
        </code>
        {errorReports[0] ? (
          <button
            onClick={() =>
              void copyAdminText("Codex prompt", createErrorReportBugPrompt(errorReports[0]))
            }
            type="button"
          >
            Copy Prompt
          </button>
        ) : null}
      </div>
      <AdminActionDialog
        footer={
          selectedReport ? (
            <>
              <button
                onClick={() => void updateReportStatus(selectedReport, "Reviewing")}
                type="button"
              >
                Mark Reviewing
              </button>
              <button
                onClick={() => void updateReportStatus(selectedReport, "Fixed")}
                type="button"
              >
                Mark Fixed
              </button>
              <button
                onClick={() => void updateReportStatus(selectedReport, "Ignored")}
                type="button"
              >
                Ignore
              </button>
            </>
          ) : null
        }
        onClose={() => setSelectedReport(null)}
        open={Boolean(selectedReport)}
        size="large"
        title="Error Details"
      >
        {selectedReport ? (
          <div className={styles.definitionGrid}>
            <div>
              <dt>Error code</dt>
              <dd className={styles.copyableValue}>
                <span>{selectedReport.errorCode || "Not recorded"}</span>
                {selectedReport.errorCode ? (
                  <button
                    onClick={() => void copyAdminText("Error code", selectedReport.errorCode || "")}
                    type="button"
                  >
                    Copy
                  </button>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd className={styles.copyableValue}>
                <span>{selectedReport.referenceId}</span>
                <button
                  onClick={() => void copyAdminText("Reference", selectedReport.referenceId)}
                  type="button"
                >
                  Copy
                </button>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selectedReport.status}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{selectedReport.createdAt}</dd>
            </div>
            <div>
              <dt>Page</dt>
              <dd>{selectedReport.pagePath}</dd>
            </div>
            <div>
              <dt>User action</dt>
              <dd>{selectedReport.userAction}</dd>
            </div>
            <div>
              <dt>Device</dt>
              <dd>
                {selectedReport.deviceType}, {selectedReport.screenSize}
              </dd>
            </div>
            <div>
              <dt>Browser</dt>
              <dd>{selectedReport.browser}</dd>
            </div>
            <div>
              <dt>Coach slug</dt>
              <dd>{selectedReport.coachSlug || "Not coach-specific"}</dd>
            </div>
            <div>
              <dt>Support shown</dt>
              <dd>{selectedReport.supportSource || "default"}</dd>
            </div>
            <div>
              <dt>Missing support fields</dt>
              <dd>{selectedReport.missingSupportFields || "None recorded"}</dd>
            </div>
            <div>
              <dt>Safe message</dt>
              <dd>{selectedReport.safeMessage}</dd>
            </div>
            <div>
              <dt>Admin-only masked details</dt>
              <dd>{selectedReport.technicalDetails || "No technical detail recorded."}</dd>
            </div>
            <div>
              <dt>Codex Fix Prompt</dt>
              <dd className={styles.copyableValue}>
                <span>{createErrorReportBugPrompt(selectedReport)}</span>
                <button
                  onClick={() =>
                    void copyAdminText("Codex prompt", createErrorReportBugPrompt(selectedReport))
                  }
                  type="button"
                >
                  Copy
                </button>
              </dd>
            </div>
            {copyMessage ? (
              <div>
                <dt>Copy</dt>
                <dd>{copyMessage}</dd>
              </div>
            ) : null}
            {statusMessage ? (
              <div>
                <dt>Status update</dt>
                <dd>{statusMessage}</dd>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminActionDialog>
    </AdminPageShell>
  );
}

function BackupCleanupView({
  control,
  onAction
}: {
  control: typeof adminControlCenterData;
  onAction: (title: string, body: string, tone?: "danger" | "standard") => void;
}) {
  return (
    <AdminPageShell eyebrow="Reports" title="Backup & Cleanup">
      <dl className={styles.definitionGrid}>
        <div>
          <dt>Retention period</dt>
          <dd>{control.backupCleanup.retentionDays} days</dd>
        </div>
        <div>
          <dt>Backup destination</dt>
          <dd>{control.backupCleanup.backupDestination}</dd>
        </div>
        <div>
          <dt>Last backup</dt>
          <dd>{control.backupCleanup.lastBackupAt}</dd>
        </div>
        <div>
          <dt>Cleanup status</dt>
          <dd>{control.backupCleanup.cleanupStatus}</dd>
        </div>
      </dl>
      <div className={styles.formActions}>
        <button
          className={styles.secondaryAction}
          onClick={() =>
            onAction("Backup Data", "Backup storage is not configured yet. No backup was created.")
          }
          type="button"
        >
          Backup Data
        </button>
        <button
          className={styles.dangerAction}
          onClick={() =>
            onAction(
              "Cleanup Old Data",
              "Cleanup is disabled until backup storage succeeds. No data was deleted.",
              "danger"
            )
          }
          type="button"
        >
          Cleanup Old Data
        </button>
      </div>
      <p className={styles.linkWarning}>
        Raw analytics cleanup must never delete coach profiles, coach sites, active links, or
        lifetime summaries.
      </p>
    </AdminPageShell>
  );
}

function SettingsView({
  control,
  onAction
}: {
  control: typeof adminControlCenterData;
  onAction: (title: string, body: string) => void;
}) {
  return (
    <AdminPageShell
      actions={
        <button
          className={styles.secondaryAction}
          onClick={() =>
            onAction(
              "Support Settings",
              "Default Yours Wellness support is used only on error or unavailable fallback pages when coach-specific support details are missing. Coach details stay editable inside the Coach Site builder."
            )
          }
          type="button"
        >
          Support Settings
        </button>
      }
      eyebrow="Settings"
      title="Settings"
    >
      <section className={styles.statusGrid}>
        <article className={styles.statusCard} data-tone="success">
          <span>Protected</span>
          <h3>Admin access</h3>
          <p>Admin routes and write APIs remain protected behind the current auth foundation.</p>
        </article>
        <article className={styles.statusCard} data-tone="success">
          <span>Coach-specific</span>
          <h3>Hidden error support</h3>
          <p>
            Error fallback pages use coach phone, WhatsApp, email, image/logo, and support text
            first.
          </p>
        </article>
        <article className={styles.statusCard} data-tone="warning">
          <span>Fallback</span>
          <h3>Yours Wellness support</h3>
          <p>
            Default support appears only when an error fallback has no coach-specific support
            details.
          </p>
        </article>
      </section>

      <div className={styles.statusList}>
        {control.security.map((item) => (
          <div data-tone={item.tone} key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.status}</span>
          </div>
        ))}
      </div>
      <p className={styles.securityNote}>
        Strict DB admin role enforcement should stay disabled until the real admin row is verified.
      </p>
    </AdminPageShell>
  );
}
