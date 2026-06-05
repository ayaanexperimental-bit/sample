"use client";

import { type CSSProperties, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
import {
  AdminActionDialog,
  AdminActionIcon,
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
  type CoachAnalyticsPerformanceBand,
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
  paymentPageConfigured: boolean;
  paymentPageStorageSource: "d1_table" | "none";
  paymentPageUpdatedAt: string | null;
  paymentPageUpdatedBy: string;
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

type AnalyticsAiMenuAction = {
  description?: string;
  label: string;
  onSelect?: () => void;
};

type AdminMaintenanceRoleChecklist = {
  adminEmailPresent: boolean;
  adminEmailRole: string;
  adminEmailStatus: string;
  adminRoleTableExists: boolean;
  currentAdminEmailMasked: string;
  lockoutRisk: "high" | "low" | "medium";
  rollbackInstructions: string[];
  roleRequirementMet: boolean;
  strictDbRolesEnabled: boolean;
};

type AdminMaintenanceStatus = {
  activeAdminRecipientCount: number;
  backupDestination: string;
  backupDownloadUrl: string | null;
  backupXlsDownloadUrl: string | null;
  backupEmailConfigured: boolean;
  cleanupEligibleAnalyticsEvents: number;
  cleanupStatus: string;
  failedRecipients: string[];
  lastBackupAt: string;
  lastBackupRecordCount: number;
  lastBackupStatus: string;
  lastCleanupAt: string;
  lastCleanupDeletedCount: number;
  lastErrorReportCleanupAt: string;
  lastErrorReportCleanupDeletedCount: number;
  maskedRecipients: string[];
  rawRecipientRoles: Array<{
    maskedEmail: string;
    role: string;
    status: string;
  }>;
  retentionDays: number;
  roleChecklist: AdminMaintenanceRoleChecklist;
  scheduledCleanup: string;
};

type BackupCleanupPayload = {
  backupCleanup?: AdminMaintenanceStatus;
  deletedCount?: number;
  error?: string;
  failedRecipients?: string[];
  notificationStatus?: string;
  ok?: boolean;
  recordCount?: number;
};

const analyticsRangeOptions: Array<{ label: string; value: AnalyticsDateRangeId }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "Custom", value: "custom" },
  { label: "All stored", value: "all" }
];

type AnalyticsChartPoint = {
  compareValue?: number;
  detail?: string;
  label: string;
  value: number;
};

type AnalyticsChartRangeId = "1d" | "5d" | "1m" | "1y" | "5y" | "max";

const analyticsChartRangeOptions: Array<{ label: string; value: AnalyticsChartRangeId }> = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
  { label: "Max", value: "max" }
];

const ADMIN_CSRF_HEADER_NAME = "x-yw-admin-csrf";
const ERROR_REPORT_CLEANUP_CONFIRMATION = "CLEAR OLD REPORTS";

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
          setAnalyticsSource(
            payload.source || (payload.configured ? "d1_analytics_events" : "not-configured")
          );
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
          <BackupCleanupView control={control} csrfToken={csrfToken} />
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
  const [overviewChartRange, setOverviewChartRange] = useState<AnalyticsChartRangeId>("max");
  const [overviewCompareEnabled, setOverviewCompareEnabled] = useState(true);
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
  const overviewTrendPoints = useMemo(
    () => buildOverviewTrendPoints(overview, overviewChartRange),
    [overview, overviewChartRange]
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
          <AnalyticsAiWidget
            actions={[
              {
                description: "Summarize the current production snapshot.",
                label: "Generate Overview Summary"
              },
              {
                description: "Look for visit/click movement and anomalies.",
                label: "Review Trends"
              },
              {
                description: "Create prioritized admin next steps.",
                label: "Generate Recommendations"
              },
              {
                description: "Estimate next-week risk from available counters.",
                label: "Predict Next 7 Days"
              },
              {
                description: "Find coaches or funnels needing attention.",
                label: "Find Underperforming Areas"
              },
              {
                description: "Prepare a compact report for admin review.",
                label: "Create Admin Report"
              }
            ]}
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
            sparkPoints={metric.sparkPoints}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className={styles.twoColumn}>
        <article className={`${styles.section} ${styles.analyticsGraphSection}`}>
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
          <InteractiveTrendChart
            compareEnabled={overviewCompareEnabled}
            compareLabel="Click / previous signal"
            emptyLabel="No stored performance data yet."
            onCompareToggle={setOverviewCompareEnabled}
            onRangeChange={setOverviewChartRange}
            points={overviewTrendPoints}
            primaryLabel="Visits / selected signal"
            range={overviewChartRange}
            subtitle="Hover the chart to inspect the current real aggregate signal."
            title="Traffic and conversion trend"
          />
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
        <AnalyticsWidget
          eyebrow="Data Quality"
          items={overview.dataQualityWarnings}
          title="Production readiness"
        />
        <AnalyticsWidget
          eyebrow="Anomaly Watch"
          items={overview.anomalySignals}
          title="Signals to review"
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Coach Performance Heatmap</p>
            <h2>Conversion opportunity map</h2>
          </div>
          <button
            className={styles.secondaryAction}
            onClick={() => onSelect("coach-analytics")}
            type="button"
          >
            Open Coach Analytics
          </button>
        </div>
        <PerformanceHeatmap rows={overview.heatmapRows} />
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
                <div className={styles.analyticsRankIdentity}>
                  <CoachAvatar name={row.coachName} photoUrl={row.photoUrl} size="small" />
                  <div>
                    <strong>{row.coachName}</strong>
                    <small>
                      {row.combined.visits.toLocaleString()} visits / {row.combined.conversionRate}{" "}
                      click-through / {row.bestFunnel}
                    </small>
                  </div>
                </div>
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
                  <td>
                    <div className={styles.tableCoachCell}>
                      <CoachAvatar name={coach.coachName} photoUrl={coach.photoUrl} size="small" />
                      <strong>{coach.coachName}</strong>
                    </div>
                  </td>
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
  const highVisitNoClickRows = rows.filter(
    (row) => row.combined.visits >= 10 && row.combined.clicks === 0
  );
  const missingFormRows = rows.filter(
    (row) => row.hasFreeGuestLink && row.freeMetrics.googleFormStatus === "missing"
  );
  const missingSupportRows = rows.filter(
    (row) => row.hasFreeGuestLink && row.freeMetrics.supportStatus === "fallback support used"
  );
  const inactiveRows = rows.filter((row) => row.combined.visits === 0 && row.combined.clicks === 0);

  return {
    activeFunnels,
    anomalySignals: [
      highVisitNoClickRows.length
        ? `${highVisitNoClickRows.length} coach page${highVisitNoClickRows.length === 1 ? "" : "s"} have visits but no clicks.`
        : "No high-visit/no-click anomaly in the selected period.",
      analyticsRangeMeta?.id !== "all" && previousVisits > totalVisits
        ? `Visits are down versus previous period: ${visitDelta}.`
        : "No previous-period traffic drop signal detected.",
      unresolvedErrors
        ? `${unresolvedErrors} unresolved error report${unresolvedErrors === 1 ? "" : "s"} remain open.`
        : "No unresolved error-report spike visible."
    ],
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
    dataQualityWarnings: [
      missingFormRows.length
        ? `${missingFormRows.length} free coach site${missingFormRows.length === 1 ? "" : "s"} missing Google Form link.`
        : "All current free coach sites have Google Form status resolved.",
      missingSupportRows.length
        ? `${missingSupportRows.length} coach site${missingSupportRows.length === 1 ? "" : "s"} using default support fallback.`
        : "Coach-specific support fallback is configured where needed.",
      inactiveRows.length
        ? `${inactiveRows.length} current coach record${inactiveRows.length === 1 ? "" : "s"} have no activity in this range.`
        : "Every current coach has some activity in this range."
    ],
    heatmapRows: buildCoachHeatmapRows(rows),
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
        sparkPoints: [
          { label: "Previous", value: previousVisits },
          { label: rangeLabel, value: totalVisits }
        ],
        tone: "neutral" as const,
        value: totalVisits.toLocaleString()
      },
      {
        detail: `Free Google Form opens plus paid register CTA clicks; ${registerDelta}.`,
        label: "Register clicks",
        sparkPoints: [
          { label: "Previous", value: previousRegisterClicks },
          { label: rangeLabel, value: totalRegisterClicks }
        ],
        tone: totalRegisterClicks ? ("success" as const) : ("neutral" as const),
        value: totalRegisterClicks.toLocaleString()
      },
      {
        detail:
          totalPaidConversions > 0
            ? `Recorded from paid success events; ${conversionDelta}.`
            : "No paid success events recorded in this admin yet.",
        label: "Paid conversions",
        sparkPoints: [
          { label: "Previous", value: previousPaidConversions },
          { label: rangeLabel, value: totalPaidConversions }
        ],
        tone: totalPaidConversions ? ("success" as const) : ("neutral" as const),
        value: totalPaidConversions.toLocaleString()
      },
      {
        detail: `${publishedCoaches.toLocaleString()} active/current coach records`,
        label: "Active coaches",
        sparkPoints: [
          { label: "Current coaches", value: rows.length },
          { label: "Active coaches", value: publishedCoaches }
        ],
        tone: publishedCoaches ? ("success" as const) : ("neutral" as const),
        value: publishedCoaches.toLocaleString()
      },
      {
        detail: `${paidOnly} paid-only / ${freeOnly} free-only / ${bothFunnels} both`,
        label: "Active funnels",
        sparkPoints: [
          { label: "Paid only", value: paidOnly },
          { label: "Free only", value: freeOnly },
          { label: "Both", value: bothFunnels },
          { label: "Active funnels", value: activeFunnels }
        ],
        tone: activeFunnels ? ("success" as const) : ("neutral" as const),
        value: activeFunnels.toLocaleString()
      },
      {
        detail: `Based on selected event range; ${clickDelta} total-click movement.`,
        label: "Click-through rate",
        sparkPoints: [
          { label: "Previous clicks", value: previousClicks },
          { label: "Current clicks", value: totalClicks }
        ],
        tone: totalRegisterClicks ? ("success" as const) : ("neutral" as const),
        value: conversionRate
      }
    ],
    previousClicks,
    previousPaidConversions,
    previousRegisterClicks,
    previousVisits,
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
    totalClicks,
    totalPaidConversions,
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
      unresolvedCategories: Array.from(
        new Set(unresolvedErrors.map((report) => report.category))
      ).slice(0, 8)
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

function buildOverviewTrendPoints(
  overview: ReturnType<typeof buildOverviewAnalytics>,
  range: AnalyticsChartRangeId
): AnalyticsChartPoint[] {
  const points: AnalyticsChartPoint[] = [
    {
      compareValue: overview.previousClicks,
      detail: "Matched previous stored period where available.",
      label: "Previous",
      value: overview.previousVisits
    },
    {
      compareValue: overview.totalClicks,
      detail: overview.rangeLabel,
      label: "Selected",
      value: overview.totalVisits
    },
    {
      compareValue: overview.totalWhatsappClicks,
      detail: "Current CTA/register signal.",
      label: "Register",
      value: overview.totalRegisterClicks
    },
    {
      compareValue: overview.activeFunnels,
      detail: "Paid success events currently stored in this admin.",
      label: "Paid success",
      value: overview.totalPaidConversions
    }
  ];

  return sliceChartPointsByRange(points, range);
}

function buildCoachListTrendPoints(
  rows: CoachAnalyticsRow[],
  range: AnalyticsChartRangeId
): AnalyticsChartPoint[] {
  const topRows = rows
    .filter((row) => row.combined.visits > 0 || row.combined.clicks > 0)
    .sort((a, b) => b.combined.visits - a.combined.visits)
    .slice(0, 6);

  if (topRows.length > 0) {
    if (topRows.length === 1) {
      const row = topRows[0];

      return sliceChartPointsByRange(
        [
          {
            compareValue: row.freeMetrics.clicks,
            detail: "Free guest-link visits and click signal.",
            label: "Free",
            value: row.freeMetrics.visits
          },
          {
            compareValue: row.paidMetrics.clicks,
            detail: "Paid masterclass visits and click signal.",
            label: "Paid",
            value: row.paidMetrics.visits
          },
          {
            compareValue: row.combined.clicks,
            detail: `${row.coachName} combined funnel signal.`,
            label: "Combined",
            value: row.combined.visits
          }
        ],
        range
      );
    }

    return sliceChartPointsByRange(
      topRows.map((row) => ({
        compareValue: row.combined.clicks,
        detail: row.bestFunnel,
        label: row.coachName.split(/\s+/)[0] || row.coachName,
        value: row.combined.visits
      })),
      range
    );
  }

  return [];
}

function buildCoachTrendPoints(
  coach: CoachAnalyticsRow,
  range: AnalyticsChartRangeId
): AnalyticsChartPoint[] {
  const freeDailyVisits = sumNumbers(
    coach.freeGuestLinks.map((site) => site.analytics.dailyVisits)
  );
  const freeWeeklyVisits = sumNumbers(
    coach.freeGuestLinks.map((site) => site.analytics.weeklyVisits)
  );
  const freeMonthlyVisits = sumNumbers(
    coach.freeGuestLinks.map((site) => site.analytics.monthlyVisits)
  );
  const freeTotalRegisterClicks = coach.freeMetrics.registerClicks;
  const paidTotalClicks =
    coach.paidMetrics.registerClicks +
    coach.paidMetrics.paymentButtonClicks +
    coach.paidMetrics.whatsappClicks;
  const aggregatePoints: AnalyticsChartPoint[] = [
    {
      compareValue: 0,
      detail: "Stored daily free guest-link counter.",
      label: "Today",
      value: freeDailyVisits
    },
    {
      compareValue: 0,
      detail: "Stored weekly free guest-link counter.",
      label: "7D",
      value: freeWeeklyVisits
    },
    {
      compareValue: 0,
      detail: "Stored monthly free guest-link counter.",
      label: "1M",
      value: freeMonthlyVisits
    },
    {
      compareValue: freeTotalRegisterClicks + paidTotalClicks,
      detail: "All stored paid/free aggregate activity.",
      label: "Max",
      value: coach.combined.visits
    }
  ];

  const hasAggregateActivity = aggregatePoints.some(
    (point) => point.value > 0 || (point.compareValue || 0) > 0
  );

  if (hasAggregateActivity) {
    return sliceChartPointsByRange(aggregatePoints, range);
  }

  return sliceChartPointsByRange(
    [
      {
        compareValue: coach.freeMetrics.registerClicks,
        detail: "Free guest-link funnel.",
        label: "Free",
        value: coach.freeMetrics.visits
      },
      {
        compareValue: coach.paidMetrics.registerClicks,
        detail: "Paid masterclass funnel.",
        label: "Paid",
        value: coach.paidMetrics.visits
      },
      {
        compareValue: coach.freeMetrics.whatsappClicks + coach.paidMetrics.whatsappClicks,
        detail: "All available stored counters.",
        label: "Combined",
        value: coach.combined.visits
      }
    ],
    range
  );
}

function buildCoachSparklinePoints(row: CoachAnalyticsRow): AnalyticsChartPoint[] {
  return [
    { label: "Free visits", value: row.freeMetrics.visits },
    { label: "Paid visits", value: row.paidMetrics.visits },
    { label: "Total clicks", value: row.combined.clicks },
    { label: "Total visits", value: row.combined.visits }
  ];
}

function buildFunnelCountSparkline(
  rows: CoachAnalyticsRow[],
  type: "both" | "free" | "none" | "paid"
): AnalyticsChartPoint[] {
  const counts = {
    both: rows.filter((row) => row.combinedAvailable).length,
    free: rows.filter((row) => row.hasFreeGuestLink && !row.hasPaidMasterclass).length,
    none: rows.filter((row) => !row.hasFreeGuestLink && !row.hasPaidMasterclass).length,
    paid: rows.filter((row) => row.hasPaidMasterclass && !row.hasFreeGuestLink).length
  };

  return [
    { label: "Paid", value: counts.paid },
    { label: "Free", value: counts.free },
    { label: "Both", value: counts.both },
    { label: "None", value: counts.none },
    { label: "Selected", value: counts[type] }
  ];
}

function sliceChartPointsByRange(points: AnalyticsChartPoint[], range: AnalyticsChartRangeId) {
  const cleanPoints = points.filter((point) => Number.isFinite(point.value));

  if (range === "1d") return cleanPoints.slice(-2);
  if (range === "5d") return cleanPoints.slice(-3);
  if (range === "1m") return cleanPoints.slice(-4);
  if (range === "1y") return cleanPoints.slice(-5);
  return cleanPoints;
}

function buildCoachHeatmapRows(rows: CoachAnalyticsRow[]) {
  return rows
    .map((row) => {
      const conversion = percentToNumber(row.combined.conversionRate);
      const activityScore = Math.min(55, Math.log10(row.combined.visits + 1) * 22);
      const clickScore = Math.min(35, conversion * 1.4);
      const issuePenalty = Math.min(30, row.lowActivityReasons.length * 10);

      return {
        band: row.performanceBand,
        clickRate: row.combined.conversionRate,
        coachName: row.coachName,
        funnel: getCoachFunnelLabels(row).join(" + ") || "No funnel",
        issues: row.lowActivityReasons,
        score: Math.max(
          8,
          Math.min(100, Math.round(activityScore + clickScore + 10 - issuePenalty))
        ),
        slug: row.coachSlug,
        visits: row.combined.visits
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
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

function percentToNumber(value: string) {
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [coachChartCompareEnabled, setCoachChartCompareEnabled] = useState(true);
  const [coachChartRange, setCoachChartRange] = useState<AnalyticsChartRangeId>("max");
  const [coachAiItems, setCoachAiItems] = useState<string[]>([
    "Choose an AI action to inspect the currently filtered coach list."
  ]);
  const [coachAiStatus, setCoachAiStatus] = useState("");
  const [coachAiCache, setCoachAiCache] = useState("");
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
  const coachListTrendPoints = useMemo(
    () => buildCoachListTrendPoints(filteredRows, coachChartRange),
    [coachChartRange, filteredRows]
  );

  function openCoachAnalytics(row: CoachAnalyticsRow) {
    setSelectedCoachId(row.coachId);
    setActiveTab(row.availableTabs[0] || "combined");
  }

  function runCoachAnalyticsAssistant(label: string) {
    const visibleRows = filteredRows;
    const totalVisits = sumNumbers(visibleRows.map((row) => row.combined.visits));
    const totalClicks = sumNumbers(visibleRows.map((row) => row.combined.clicks));
    const attention = visibleRows.filter((row) => row.lowActivityReasons.length > 0);
    const best = visibleRows[0];
    const paidCount = visibleRows.filter((row) => row.hasPaidMasterclass).length;
    const freeCount = visibleRows.filter((row) => row.hasFreeGuestLink).length;

    let items: string[];

    if (visibleRows.length === 0) {
      items = ["No coaches match the current filters."];
    } else if (label.includes("Paid")) {
      items = [
        `Paid funnels visible: ${paidCount}.`,
        `Payment-related counters are shown only from stored admin analytics/payment events.`,
        best?.hasPaidMasterclass
          ? `${best.coachName} has paid-funnel data available.`
          : "No paid-only winner found in the current filtered list."
      ];
    } else if (label.includes("Free")) {
      items = [
        `Free Guest Link funnels visible: ${freeCount}.`,
        `Free tracking counts visits and register/Google Form opens, not form submissions.`,
        best?.hasFreeGuestLink
          ? `${best.coachName} is the first visible free-funnel row after sorting.`
          : "No free-funnel winner found in the current filtered list."
      ];
    } else if (label.includes("Recommendations")) {
      items = [
        attention.length
          ? `${attention.length} visible coach records need attention.`
          : "No visible coach-level issue detected from current counters.",
        "Open a coach detail drawer before making coach-specific changes.",
        "Use Manage only when link/contact/site settings need updates."
      ];
    } else if (label.includes("Report")) {
      items = [
        `Filtered coaches: ${visibleRows.length}.`,
        `Visits: ${totalVisits.toLocaleString()} / Clicks: ${totalClicks.toLocaleString()}.`,
        `Paid visible: ${paidCount} / Free visible: ${freeCount}.`
      ];
    } else {
      items = [
        `Filtered coaches: ${visibleRows.length}.`,
        `Visits: ${totalVisits.toLocaleString()} / Clicks: ${totalClicks.toLocaleString()}.`,
        `Best visible row: ${best ? `${best.coachName} (${best.bestFunnel})` : "not available"}.`
      ];
    }

    setCoachAiItems(items);
    setCoachAiStatus(`${label} ready from the current filtered rows.`);
    setCoachAiCache("local filtered data");
  }

  return (
    <AdminPageShell
      actions={
        <AnalyticsAiWidget
          actions={[
            {
              description: "Summarize the visible coach list.",
              label: "Generate Coach Summary"
            },
            {
              description: "Review visible paid funnel counters.",
              label: "Review Paid Funnel"
            },
            {
              description: "Review visible Free Guest Link counters.",
              label: "Review Free Guest Link"
            },
            {
              description: "Create coach-level next-step guidance.",
              label: "Generate Coach Recommendations"
            },
            {
              description: "Create a compact admin report from the filtered rows.",
              label: "Create Coach Report"
            }
          ]}
          cacheLabel={coachAiCache}
          eyebrow="AI Coach Analytics"
          fallbackItems={coachAiItems}
          insight={null}
          onGenerate={() => runCoachAnalyticsAssistant("Generate Coach Summary")}
          onRefresh={() => runCoachAnalyticsAssistant("Generate Coach Summary")}
          status={coachAiStatus}
          title="On-demand coach list assistant"
        />
      }
      eyebrow="Coach Sites"
      title="Coach Analytics"
    >
      <p className={styles.inlineNote}>
        Source:{" "}
        {source === "live-database" ? "Live coach-site database + paid funnel config" : source}.
        Analytics stream: {analyticsSource}. Selected range:{" "}
        {analyticsRangeOptions.find((option) => option.value === analyticsRange)?.label ||
          analyticsRange}
        . Every coach is detected dynamically from coach-site records and paid funnel configuration.
      </p>

      <section className={styles.analyticsKpiGrid} aria-label="Coach analytics summary">
        <AnalyticsKpiCard
          label="Total coaches"
          sparkPoints={[
            { label: "Filtered", value: filteredRows.length },
            { label: "Current", value: currentRows.length }
          ]}
          value={currentRows.length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Paid only"
          sparkPoints={buildFunnelCountSparkline(currentRows, "paid")}
          value={currentRows
            .filter((row) => row.hasPaidMasterclass && !row.hasFreeGuestLink)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Free only"
          sparkPoints={buildFunnelCountSparkline(currentRows, "free")}
          value={currentRows
            .filter((row) => row.hasFreeGuestLink && !row.hasPaidMasterclass)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Both funnels"
          sparkPoints={buildFunnelCountSparkline(currentRows, "both")}
          value={currentRows.filter((row) => row.combinedAvailable).length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="No funnel"
          sparkPoints={buildFunnelCountSparkline(currentRows, "none")}
          value={currentRows
            .filter((row) => !row.hasPaidMasterclass && !row.hasFreeGuestLink)
            .length.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Needs attention"
          sparkPoints={[
            { label: "Clear", value: Math.max(0, currentRows.length - needsAttentionRows.length) },
            { label: "Needs attention", value: needsAttentionRows.length }
          ]}
          value={needsAttentionRows.length.toLocaleString()}
        />
      </section>

      <InteractiveTrendChart
        compareEnabled={coachChartCompareEnabled}
        compareLabel="Clicks"
        emptyLabel="No coach performance data available for the current filters yet."
        onCompareToggle={setCoachChartCompareEnabled}
        onRangeChange={setCoachChartRange}
        points={coachListTrendPoints}
        primaryLabel="Visits"
        range={coachChartRange}
        subtitle="Filtered coach list trend. Change filters to inspect different coach cohorts."
        title="Coach performance movement"
      />

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
            onChange={(event) => onAnalyticsRangeChange(event.target.value as AnalyticsDateRangeId)}
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

      <section className={styles.analyticsCoachListPanel} aria-label="Coach analytics list">
        {filteredRows.length > 0 ? (
          <>
            <div className={styles.analyticsListHeader}>
              <div>
                <p className={styles.kicker}>All Coaches</p>
                <h2>Coach performance list</h2>
              </div>
              <span>
                Showing {filteredRows.length.toLocaleString()} of{" "}
                {currentRows.length.toLocaleString()} current coach records
              </span>
            </div>
            <div className={styles.analyticsCoachTableScroll}>
              <table className={styles.analyticsCoachTable}>
                <thead>
                  <tr>
                    <th scope="col">Coach</th>
                    <th scope="col">Region</th>
                    <th scope="col">Funnels</th>
                    <th scope="col">Status</th>
                    <th scope="col">Visits</th>
                    <th scope="col">Clicks</th>
                    <th scope="col">CTR</th>
                    <th scope="col">Best funnel</th>
                    <th scope="col">Last activity</th>
                    <th scope="col">Source</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const publicHref = getCoachPublicHref(row);

                    return (
                      <tr key={row.coachId}>
                        <td data-label="Coach">
                          <div className={styles.analyticsTableCoach}>
                            <CoachAvatar name={row.coachName} photoUrl={row.photoUrl} />
                            <div>
                              <strong>{row.coachName}</strong>
                              <span>{row.niche}</span>
                              <code>{row.coachSlug}</code>
                            </div>
                          </div>
                        </td>
                        <td data-label="Region">{getCoachRegionLabel(row)}</td>
                        <td data-label="Funnels">
                          <div className={styles.funnelBadgeRow}>
                            <FunnelBadges row={row} />
                          </div>
                        </td>
                        <td data-label="Status">
                          <span className={styles.statusBadge} data-status={row.status}>
                            {row.status}
                          </span>
                        </td>
                        <td data-label="Visits">{row.combined.visits.toLocaleString()}</td>
                        <td data-label="Clicks">{row.combined.clicks.toLocaleString()}</td>
                        <td data-label="Click-through">{row.combined.conversionRate}</td>
                        <td data-label="Best funnel">{row.bestFunnel}</td>
                        <td data-label="Last activity">
                          {formatCoachActivity(row.combined.lastActivity)}
                        </td>
                        <td data-label="Source">{row.source}</td>
                        <td data-label="Actions">
                          <div className={styles.analyticsCoachActions}>
                            <button
                              aria-label={`View analytics for ${row.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="View analytics"
                              onClick={() => openCoachAnalytics(row)}
                              type="button"
                            >
                              <AdminActionIcon name="chart" />
                              <span className={styles.visuallyHidden}>View Analytics</span>
                            </button>
                            <button
                              aria-label={`Manage ${row.coachName}`}
                              className={styles.iconAction}
                              data-admin-tooltip="Manage coach site"
                              onClick={() => onSelect("coach-sites")}
                              type="button"
                            >
                              <AdminActionIcon name="settings" />
                              <span className={styles.visuallyHidden}>Manage</span>
                            </button>
                            {publicHref ? (
                              <a
                                aria-label={`Open public site for ${row.coachName}`}
                                className={styles.iconAction}
                                data-admin-tooltip="Open public site"
                                href={publicHref}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                <AdminActionIcon name="open" />
                                <span className={styles.visuallyHidden}>Open Site</span>
                              </a>
                            ) : (
                              <button
                                aria-label={`No public site for ${row.coachName}`}
                                className={styles.iconAction}
                                data-admin-tooltip="No public site yet"
                                disabled
                                type="button"
                              >
                                <AdminActionIcon name="open" />
                                <span className={styles.visuallyHidden}>Open Site</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>No coaches found yet.</div>
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
                  <div className={styles.analyticsRankIdentity}>
                    <CoachAvatar name={row.coachName} photoUrl={row.photoUrl} size="small" />
                    <div>
                      <strong>{row.coachName}</strong>
                      <small>
                        {row.bestFunnel} / {row.combined.visits.toLocaleString()} visits /{" "}
                        {row.combined.conversionRate} click-through
                      </small>
                    </div>
                  </div>
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
                  <CoachAvatar name={row.coachName} photoUrl={row.photoUrl} size="small" />
                  <div className={styles.analyticsRankIdentity}>
                    <div>
                      <strong>{row.coachName}</strong>
                      <small>{row.lowActivityReasons.join(" / ")}</small>
                    </div>
                  </div>
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
  sparkPoints,
  tone = "neutral",
  value
}: {
  detail?: string;
  label: string;
  sparkPoints?: AnalyticsChartPoint[];
  tone?: "attention" | "neutral" | "success" | "warning";
  value: string;
}) {
  return (
    <article className={styles.metricCard} data-tone={tone}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {sparkPoints ? <MiniSparkline points={sparkPoints} /> : null}
      {detail ? <em>{detail}</em> : null}
    </article>
  );
}

function getCoachPublicHref(row: CoachAnalyticsRow) {
  return (
    row.publicLink || row.paidFunnels.find((funnel) => funnel.canonicalPath)?.canonicalPath || ""
  );
}

function getCoachRegionLabel(row: CoachAnalyticsRow) {
  return row.region !== "Not available" ? row.region : row.location || "Not available";
}

function formatCoachActivity(value: string) {
  if (!value || value === "No activity yet" || value === "Not connected") return "No activity yet";
  if (value === "Paid funnel configured") return value;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function CoachAvatar({
  name,
  photoUrl,
  size = "medium"
}: {
  name: string;
  photoUrl?: string;
  size?: "large" | "medium" | "small";
}) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const cleanPhotoUrl = photoUrl?.trim();
  const imageFailed = Boolean(cleanPhotoUrl && failedPhotoUrl === cleanPhotoUrl);

  return (
    <span aria-hidden="true" className={styles.coachAvatar} data-size={size}>
      {cleanPhotoUrl && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- Uploaded/R2/external coach avatar URLs are dynamic and must fall back safely on load failure.
        <img
          alt=""
          loading="lazy"
          onError={() => setFailedPhotoUrl(cleanPhotoUrl)}
          src={cleanPhotoUrl}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </span>
  );
}

function MiniSparkline({ points }: { points: AnalyticsChartPoint[] }) {
  const cleanPoints = points.filter((point) => Number.isFinite(point.value));
  const hasActivity = cleanPoints.some((point) => point.value > 0);

  if (cleanPoints.length < 2 || !hasActivity) {
    return <span aria-hidden="true" className={styles.miniSparklineEmpty} />;
  }

  const width = 116;
  const height = 38;
  const rawValues = cleanPoints.map((point) => point.value);
  const rawMinValue = Math.min(...rawValues);
  const rawMaxValue = Math.max(...rawValues);
  const range = Math.max(1, rawMaxValue - rawMinValue);
  const minValue = Math.max(0, rawMinValue - range * 0.12);
  const maxValue = rawMaxValue + range * 0.12;
  const coords = cleanPoints.map((point, index) => {
    const x = cleanPoints.length === 1 ? width / 2 : (index / (cleanPoints.length - 1)) * width;
    const y = height - ((point.value - minValue) / (maxValue - minValue)) * (height - 8) - 4;

    return { x, y };
  });
  const linePath = formatChartPath(coords);
  const areaPath = `${linePath} L ${width.toFixed(1)},${height.toFixed(1)} L 0,${height.toFixed(1)} Z`;

  return (
    <svg
      aria-hidden="true"
      className={styles.miniSparkline}
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path className={styles.miniSparklineArea} d={areaPath} />
      <path className={styles.miniSparklineLine} d={linePath} />
    </svg>
  );
}

function InteractiveTrendChart({
  compareEnabled,
  compareLabel,
  emptyLabel,
  onCompareToggle,
  onRangeChange,
  points,
  primaryLabel,
  range,
  subtitle,
  title
}: {
  compareEnabled: boolean;
  compareLabel: string;
  emptyLabel: string;
  onCompareToggle: (value: boolean) => void;
  onRangeChange: (value: AnalyticsChartRangeId) => void;
  points: AnalyticsChartPoint[];
  primaryLabel: string;
  range: AnalyticsChartRangeId;
  subtitle: string;
  title: string;
}) {
  const cleanPoints = points.filter((point) => Number.isFinite(point.value));
  const hasActivity = cleanPoints.some(
    (point) => point.value > 0 || (compareEnabled && (point.compareValue || 0) > 0)
  );
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, cleanPoints.length - 1));
  const [isGraphHovered, setIsGraphHovered] = useState(false);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverIndexRef = useRef<number | null>(null);
  const width = 640;
  const height = 260;
  const padding = {
    bottom: 42,
    left: 58,
    right: 20,
    top: 26
  };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = cleanPoints.flatMap((point) =>
    compareEnabled && typeof point.compareValue === "number"
      ? [point.value, point.compareValue]
      : [point.value]
  );
  const safeValues = values.length > 0 ? values : [0];
  const rawMinValue = Math.min(...safeValues);
  const rawMaxValue = Math.max(...safeValues);
  const rawRange = Math.max(1, rawMaxValue - rawMinValue);
  const minValue = Math.max(0, rawMinValue - rawRange * 0.12);
  const maxValue = rawMaxValue + rawRange * 0.12;
  const yTicks = getChartTicks(minValue, maxValue, 4);
  const xAxisLabelIndexes = getXAxisLabelIndexes(cleanPoints.length);
  const boundedActiveIndex = Math.min(activeIndex, Math.max(0, cleanPoints.length - 1));
  const activePoint = cleanPoints[boundedActiveIndex];
  const activeCoord = activePoint
    ? getChartCoord(activePoint.value, boundedActiveIndex, cleanPoints.length, {
        maxValue,
        minValue,
        padding,
        plotHeight,
        plotWidth
      })
    : null;
  const primaryCoords = cleanPoints.map((point, index) =>
    getChartCoord(point.value, index, cleanPoints.length, {
      maxValue,
      minValue,
      padding,
      plotHeight,
      plotWidth
    })
  );
  const compareCoords =
    compareEnabled && cleanPoints.some((point) => typeof point.compareValue === "number")
      ? cleanPoints.map((point, index) =>
          getChartCoord(point.compareValue || 0, index, cleanPoints.length, {
            maxValue,
            minValue,
            padding,
            plotHeight,
            plotWidth
          })
        )
      : [];
  const primaryPath = formatChartPath(primaryCoords);
  const comparePath = formatChartPath(compareCoords);
  const areaPath =
    primaryCoords.length > 1
      ? `${primaryPath} L ${primaryCoords[primaryCoords.length - 1].x.toFixed(1)},${(height - padding.bottom).toFixed(1)} L ${padding.left.toFixed(1)},${(height - padding.bottom).toFixed(1)} Z`
      : "";

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    []
  );

  function handleMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (cleanPoints.length < 2) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    const nextIndex = primaryCoords.reduce(
      (closest, coord, index) =>
        Math.abs(coord.x - localX) < Math.abs(primaryCoords[closest].x - localX) ? index : closest,
      0
    );

    pendingHoverIndexRef.current = nextIndex;

    if (hoverFrameRef.current !== null) return;

    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const queuedIndex = pendingHoverIndexRef.current;
      if (queuedIndex === null) return;

      pendingHoverIndexRef.current = null;
      setIsGraphHovered(true);
      setActiveIndex((currentIndex) => (currentIndex === queuedIndex ? currentIndex : queuedIndex));
    });
  }

  function handleMouseLeave() {
    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }

    pendingHoverIndexRef.current = null;
    setIsGraphHovered(false);
  }

  return (
    <article className={styles.analyticsChartCard}>
      <header className={styles.analyticsChartHeader}>
        <div>
          <p className={styles.kicker}>Interactive graph</p>
          <h3>{title}</h3>
          <span>{subtitle}</span>
        </div>
        <div className={styles.chartControls}>
          <div className={styles.chartRangeTabs} role="tablist" aria-label={`${title} range`}>
            {analyticsChartRangeOptions.map((option) => (
              <button
                aria-selected={range === option.value}
                data-active={range === option.value ? "true" : "false"}
                key={option.value}
                onClick={() => onRangeChange(option.value)}
                role="tab"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            aria-pressed={compareEnabled}
            className={styles.chartCompareToggle}
            onClick={() => onCompareToggle(!compareEnabled)}
            type="button"
          >
            Compare
          </button>
        </div>
      </header>
      {cleanPoints.length > 1 && hasActivity ? (
        <div className={styles.chartFrame}>
          <svg
            aria-label={title}
            focusable="false"
            onMouseEnter={() => setIsGraphHovered(true)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            role="img"
            viewBox={`0 0 ${width} ${height}`}
          >
            <g className={styles.chartGridLines}>
              {yTicks.map((tick) => {
                const y = getChartY(tick, { maxValue, minValue, padding, plotHeight });
                return (
                  <line
                    key={tick.toFixed(4)}
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y}
                    y2={y}
                  />
                );
              })}
            </g>
            <g className={styles.chartYAxisLabels}>
              {yTicks.map((tick) => {
                const y = getChartY(tick, { maxValue, minValue, padding, plotHeight });
                return (
                  <text key={tick.toFixed(4)} x={padding.left - 14} y={y + 4}>
                    {formatCompactGraphValue(tick)}
                  </text>
                );
              })}
            </g>
            {compareCoords.length > 1 ? (
              <path className={styles.chartCompareLine} d={comparePath} />
            ) : null}
            <path className={styles.chartArea} d={areaPath} />
            {isGraphHovered && activeCoord ? (
              <line
                className={styles.chartCursorLine}
                x1={activeCoord.x}
                x2={activeCoord.x}
                y1={padding.top}
                y2={height - padding.bottom}
              />
            ) : null}
            <path className={styles.chartPrimaryLine} d={primaryPath} />
            {primaryCoords.map((coord, index) => (
              <circle
                className={styles.chartPoint}
                data-active={isGraphHovered && index === boundedActiveIndex ? "true" : "false"}
                key={`${cleanPoints[index]?.label || index}-${index}`}
                r={isGraphHovered && index === boundedActiveIndex ? 5.5 : 3.5}
                cx={coord.x}
                cy={coord.y}
              />
            ))}
            <g className={styles.chartAxisLabels}>
              {xAxisLabelIndexes.map((index) => {
                const point = cleanPoints[index];
                const coord = primaryCoords[index];
                return (
                  <text
                    data-edge={
                      index === 0 ? "start" : index === cleanPoints.length - 1 ? "end" : "middle"
                    }
                    key={`${point.label}-${index}`}
                    x={coord.x}
                    y={height - 12}
                  >
                    {formatXAxisLabel(point.label)}
                  </text>
                );
              })}
            </g>
          </svg>
          {isGraphHovered && activePoint && activeCoord ? (
            <div
              className={styles.chartTooltip}
              style={
                {
                  "--tooltip-left": `${Math.min(84, Math.max(16, (activeCoord.x / width) * 100))}%`,
                  "--tooltip-top": `${Math.min(78, Math.max(18, (activeCoord.y / height) * 100))}%`,
                  "--tooltip-transform":
                    activeCoord.y < height * 0.35
                      ? "translate(-50%, 14%)"
                      : "translate(-50%, -112%)"
                } as CSSProperties
              }
            >
              <strong>{activePoint.label}</strong>
              <span>
                {primaryLabel}: {activePoint.value.toLocaleString()}
              </span>
              {compareEnabled && typeof activePoint.compareValue === "number" ? (
                <span>
                  {compareLabel}: {activePoint.compareValue.toLocaleString()}
                </span>
              ) : null}
              {activePoint.detail ? <em>{activePoint.detail}</em> : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.chartEmptyState}>{emptyLabel}</div>
      )}
      <footer className={styles.chartLegend}>
        <span data-series="primary">{primaryLabel}</span>
        {compareEnabled ? <span data-series="compare">{compareLabel}</span> : null}
      </footer>
    </article>
  );
}

function getChartCoord(
  value: number,
  index: number,
  total: number,
  {
    maxValue,
    minValue,
    padding,
    plotHeight,
    plotWidth
  }: {
    maxValue: number;
    minValue: number;
    padding: {
      bottom: number;
      left: number;
      right: number;
      top: number;
    };
    plotHeight: number;
    plotWidth: number;
  }
) {
  const x =
    total === 1 ? padding.left + plotWidth / 2 : padding.left + (index / (total - 1)) * plotWidth;
  const y = getChartY(value, {
    maxValue,
    minValue,
    padding,
    plotHeight
  });

  return { x, y };
}

function getChartY(
  value: number,
  {
    maxValue,
    minValue,
    padding,
    plotHeight
  }: {
    maxValue: number;
    minValue: number;
    padding: {
      bottom: number;
      left: number;
      right: number;
      top: number;
    };
    plotHeight: number;
  }
) {
  const safeRange = Math.max(1, maxValue - minValue);
  const normalized = Math.min(1, Math.max(0, (value - minValue) / safeRange));

  return padding.top + plotHeight - normalized * plotHeight;
}

function formatChartPath(coords: Array<{ x: number; y: number }>) {
  if (coords.length === 0) return "";

  return coords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");
}

function getChartTicks(minValue: number, maxValue: number, count: number) {
  if (count <= 1) return [maxValue];

  const step = (maxValue - minValue) / (count - 1);
  return Array.from({ length: count }, (_, index) => maxValue - step * index);
}

function getXAxisLabelIndexes(total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index);

  return Array.from(new Set([0, Math.floor((total - 1) / 2), total - 1]));
}

function formatCompactGraphValue(value: number) {
  const safeValue = Math.max(0, value);
  if (safeValue >= 1_000_000) return `${(safeValue / 1_000_000).toFixed(1)}M`;
  if (safeValue >= 10_000) return `${Math.round(safeValue / 1_000)}k`;
  if (safeValue >= 1_000) return `${(safeValue / 1_000).toFixed(1)}k`;
  if (safeValue >= 100) return `${Math.round(safeValue)}`;
  if (safeValue >= 10) return `${Math.round(safeValue)}`;
  return safeValue.toFixed(safeValue % 1 === 0 ? 0 : 1);
}

function formatXAxisLabel(label: string) {
  const cleanLabel = label.trim();
  if (cleanLabel.length <= 12) return cleanLabel;
  return `${cleanLabel.slice(0, 11)}...`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return (parts.map((part) => part[0]).join("") || "YW").toUpperCase();
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
  actions,
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
  actions?: AnalyticsAiMenuAction[];
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
  const [open, setOpen] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const items = insight ? formatAiInsightItems(insight) : fallbackItems;
  const menuActions =
    actions && actions.length > 0
      ? actions
      : [
          {
            description: insight ? "Refresh the current AI output." : "Generate a new AI review.",
            label: insight ? "Refresh AI Overview" : "Generate AI Overview"
          }
        ];

  function runAction(action: AnalyticsAiMenuAction) {
    setActiveAction(action.label);
    setOpen(true);

    if (action.onSelect) {
      action.onSelect();
      return;
    }

    if (insight) {
      onRefresh();
    } else {
      onGenerate();
    }
  }

  return (
    <div className={styles.aiAssistant} data-open={open ? "true" : "false"}>
      <button
        aria-expanded={open}
        aria-label={eyebrow}
        className={styles.aiAssistantButton}
        data-admin-tooltip={eyebrow}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        AI
      </button>
      {open ? (
        <div className={styles.aiAssistantPanel} role="menu">
          <div className={styles.aiAssistantHeader}>
            <p className={styles.kicker}>{eyebrow}</p>
            <h3>{title}</h3>
            <button aria-label="Close AI assistant" onClick={() => setOpen(false)} type="button">
              Close
            </button>
          </div>
          <div className={styles.aiAssistantActions}>
            {menuActions.map((action) => (
              <button key={action.label} onClick={() => runAction(action)} role="menuitem" type="button">
                <strong>{action.label}</strong>
                {action.description ? <span>{action.description}</span> : null}
              </button>
            ))}
          </div>
          <div className={styles.aiAssistantResult}>
            <strong>{activeAction || "Latest result"}</strong>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {status || usageEstimate || cacheLabel ? (
            <p className={styles.aiAssistantMeta}>
              {status || "AI ready."}
              {cacheLabel ? ` Cache: ${cacheLabel}.` : ""}
              {usageEstimate
                ? ` Estimate: ${usageEstimate.approximateCostLevel}, ${usageEstimate.estimatedInputTokens} input / ${usageEstimate.estimatedOutputTokens} output tokens.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PerformanceHeatmap({
  rows
}: {
  rows: Array<{
    band: CoachAnalyticsPerformanceBand;
    clickRate: string;
    coachName: string;
    funnel: string;
    issues: string[];
    score: number;
    slug: string;
    visits: number;
  }>;
}) {
  if (rows.length === 0) {
    return <p className={styles.inlineNote}>No heatmap data available yet.</p>;
  }

  return (
    <div className={styles.analyticsHeatmapGrid}>
      {rows.map((row) => (
        <article
          data-band={row.band}
          key={row.slug || row.coachName}
          style={{ "--score": row.score } as CSSProperties}
        >
          <span />
          <div>
            <strong>{row.coachName}</strong>
            <small>{row.funnel}</small>
          </div>
          <p>
            {row.visits.toLocaleString()} visits / {row.clickRate}
          </p>
          <em>{row.issues[0] || "Stable"}</em>
        </article>
      ))}
    </div>
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
  const [detailChartCompareEnabled, setDetailChartCompareEnabled] = useState(true);
  const [detailChartRange, setDetailChartRange] = useState<AnalyticsChartRangeId>("max");
  const analyticsRangeLabel =
    analyticsRangeOptions.find((option) => option.value === analyticsRange)?.label ||
    analyticsRange;
  const coachTrendPoints = useMemo(
    () => buildCoachTrendPoints(coach, detailChartRange),
    [coach, detailChartRange]
  );
  const csvReportText = useMemo(
    () => buildCoachCsvReport(coach, insights, analyticsRangeLabel),
    [analyticsRangeLabel, coach, insights]
  );
  const excelReportText = useMemo(
    () => buildCoachExcelReport(coach, reportFormat, insights, analyticsRangeLabel),
    [analyticsRangeLabel, coach, insights, reportFormat]
  );
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
    try {
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${coach.coachSlug || "coach"}-analytics-report.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setCopyMessage("Text report downloaded.");
    } catch {
      setCopyMessage("Download unavailable. Report remains visible.");
    }
  }

  function downloadCsvReport() {
    try {
      const blob = new Blob([csvReportText], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${coach.coachSlug || "coach"}-analytics-report.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setCopyMessage("Sheet CSV downloaded.");
    } catch {
      setCopyMessage("Sheet CSV download unavailable. Report remains visible.");
    }
  }

  function downloadExcelReport() {
    try {
      const blob = new Blob([excelReportText], {
        type: "application/vnd.ms-excel;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${coach.coachSlug || "coach"}-analytics-report.xls`;
      link.click();
      URL.revokeObjectURL(url);
      setCopyMessage("Excel workbook downloaded.");
    } catch {
      setCopyMessage("Excel download unavailable. Report remains visible.");
    }
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
          <CoachAvatar name={coach.coachName} photoUrl={coach.photoUrl} size="large" />
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
        <button
          className={styles.secondaryAction}
          onClick={() => setCopyMessage("Coach report generated from current selected range.")}
          type="button"
        >
          Generate Coach Report
        </button>
        <button className={styles.secondaryAction} onClick={() => void copyReport()} type="button">
          Copy Report
        </button>
        <button className={styles.secondaryAction} onClick={downloadReport} type="button">
          Download Report
        </button>
        <button className={styles.secondaryAction} onClick={downloadCsvReport} type="button">
          Download Sheet CSV
        </button>
        <button className={styles.secondaryAction} onClick={downloadExcelReport} type="button">
          Download Excel
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

      <InteractiveTrendChart
        compareEnabled={detailChartCompareEnabled}
        compareLabel="Clicks / funnel signal"
        emptyLabel="No stored coach trend data yet."
        onCompareToggle={setDetailChartCompareEnabled}
        onRangeChange={setDetailChartRange}
        points={coachTrendPoints}
        primaryLabel="Visits"
        range={detailChartRange}
        subtitle="Uses the coach's stored Website Builder analytics and paid/free aggregate events."
        title={`${coach.coachName} performance trend`}
      />

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
        <AnalyticsKpiCard
          label="Combined visits"
          sparkPoints={buildCoachSparklinePoints(coach)}
          value={coach.combined.visits.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Combined clicks"
          sparkPoints={[
            { label: "Free clicks", value: coach.freeMetrics.clicks },
            { label: "Paid clicks", value: coach.paidMetrics.clicks },
            { label: "Combined clicks", value: coach.combined.clicks }
          ]}
          value={coach.combined.clicks.toLocaleString()}
        />
        <AnalyticsKpiCard label="Click-through rate" value={coach.combined.conversionRate} />
        <AnalyticsKpiCard
          label="Best funnel"
          sparkPoints={[
            { label: "Free", value: coach.freeMetrics.visits },
            { label: "Paid", value: coach.paidMetrics.visits }
          ]}
          value={coach.bestFunnel}
        />
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
        <AnalyticsKpiCard
          label="Landing visits"
          sparkPoints={[
            { label: "Landing", value: metrics.visits },
            { label: "Register", value: metrics.registerClicks },
            { label: "Payment", value: metrics.paymentButtonClicks }
          ]}
          value={metrics.visits.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Register CTA clicks"
          sparkPoints={[
            { label: "Visits", value: metrics.visits },
            { label: "Register clicks", value: metrics.registerClicks }
          ]}
          value={metrics.registerClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Payment clicks"
          sparkPoints={[
            { label: "Register", value: metrics.registerClicks },
            { label: "Payment click", value: metrics.paymentButtonClicks }
          ]}
          value={metrics.paymentButtonClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Payment success"
          sparkPoints={[
            { label: "Initiated", value: metrics.paymentInitiated },
            { label: "Success", value: metrics.paymentSuccess }
          ]}
          value={metrics.paymentSuccess.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Success page views"
          sparkPoints={[
            { label: "Payment success", value: metrics.paymentSuccess },
            { label: "Success page", value: metrics.successPageViews }
          ]}
          value={metrics.successPageViews.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="WhatsApp clicks"
          sparkPoints={[
            { label: "Success page", value: metrics.successPageViews },
            { label: "WhatsApp", value: metrics.whatsappClicks }
          ]}
          value={metrics.whatsappClicks.toLocaleString()}
        />
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
        <AnalyticsKpiCard
          label="Coach page visits"
          sparkPoints={[
            { label: "Visits", value: metrics.visits },
            { label: "Register", value: metrics.registerClicks },
            { label: "Google Form", value: metrics.googleFormClicks }
          ]}
          value={metrics.visits.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Register CTA clicks"
          sparkPoints={[
            { label: "Visits", value: metrics.visits },
            { label: "Register", value: metrics.registerClicks }
          ]}
          value={metrics.registerClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Google Form opens"
          sparkPoints={[
            { label: "Register", value: metrics.registerClicks },
            { label: "Google Form", value: metrics.googleFormClicks }
          ]}
          value={metrics.googleFormClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="WhatsApp/contact clicks"
          sparkPoints={[
            { label: "Register", value: metrics.registerClicks },
            { label: "WhatsApp", value: metrics.whatsappClicks }
          ]}
          value={metrics.whatsappClicks.toLocaleString()}
        />
        <AnalyticsKpiCard
          label="Video plays"
          sparkPoints={[
            { label: "Visits", value: metrics.visits },
            { label: "Video", value: metrics.videoPlays }
          ]}
          value={metrics.videoPlays.toLocaleString()}
        />
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

function buildCoachCsvReport(coach: CoachAnalyticsRow, insights: string[], dateRangeLabel: string) {
  const rows = [
    ["Field", "Value"],
    ["Coach name", coach.coachName],
    ["Niche", coach.niche],
    ["Date range", dateRangeLabel],
    ["Active funnels", getCoachFunnelLabels(coach).join(", ") || "No active funnel"],
    ["Total visits", String(coach.combined.visits)],
    ["Register/CTA clicks", String(coach.combined.clicks)],
    ["Free register clicks", String(coach.freeMetrics.registerClicks)],
    ["Paid register clicks", String(coach.paidMetrics.registerClicks)],
    [
      "WhatsApp/contact clicks",
      String(coach.freeMetrics.whatsappClicks + coach.paidMetrics.whatsappClicks)
    ],
    ["Payment success events", String(coach.paidMetrics.paymentSuccess)],
    ["Conversion rate", coach.combined.conversionRate],
    ["Top traffic source", coach.source],
    ["Top region", coach.region],
    ["Device breakdown", formatDeviceBreakdown(coach.deviceBreakdown)],
    ["Trend summary", coach.trend],
    ["AI insights", insights.length ? insights.join(" ") : "Not enough data for AI insights yet."],
    [
      "Recommended next actions",
      coach.lowActivityReasons.join("; ") || "Continue weekly sharing and compare click-through."
    ]
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function buildCoachExcelReport(
  coach: CoachAnalyticsRow,
  format: "admin" | "detailed" | "whatsapp",
  insights: string[],
  dateRangeLabel: string
) {
  const summaryRows = buildCoachReportRows(coach, insights, dateRangeLabel);
  const funnelRows = [
    ["Metric", "Free Guest Link", "Paid Masterclass", "Combined"],
    [
      "Visits",
      String(coach.freeMetrics.visits),
      String(coach.paidMetrics.visits),
      String(coach.combined.visits)
    ],
    [
      "Register/CTA clicks",
      String(coach.freeMetrics.registerClicks),
      String(coach.paidMetrics.registerClicks),
      String(coach.combined.clicks)
    ],
    [
      "WhatsApp/contact clicks",
      String(coach.freeMetrics.whatsappClicks),
      String(coach.paidMetrics.whatsappClicks),
      String(coach.freeMetrics.whatsappClicks + coach.paidMetrics.whatsappClicks)
    ],
    [
      "Video plays",
      String(coach.freeMetrics.videoPlays),
      "0",
      String(coach.freeMetrics.videoPlays)
    ],
    [
      "Payment initiated",
      "0",
      String(coach.paidMetrics.paymentInitiated),
      String(coach.paidMetrics.paymentInitiated)
    ],
    [
      "Payment success",
      "0",
      String(coach.paidMetrics.paymentSuccess),
      String(coach.paidMetrics.paymentSuccess)
    ],
    [
      "Conversion rate",
      coach.freeMetrics.conversionRate,
      coach.paidMetrics.conversionRate,
      coach.combined.conversionRate
    ]
  ];
  const reportRows = buildCoachReport(coach, format, insights, dateRangeLabel)
    .split("\n")
    .map((line) => [line]);

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#F2F4F7" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#FFF4E6" ss:Pattern="Solid"/></Style>',
    "</Styles>",
    renderExcelWorksheet("Coach Summary", [["YW Coach Analytics Report"], ...summaryRows], true),
    renderExcelWorksheet("Funnel Metrics", funnelRows, false),
    renderExcelWorksheet("Shareable Report", reportRows, false),
    "</Workbook>"
  ].join("");
}

function buildCoachReportRows(
  coach: CoachAnalyticsRow,
  insights: string[],
  dateRangeLabel: string
) {
  return [
    ["Field", "Value"],
    ["Coach name", coach.coachName],
    ["Niche", coach.niche],
    ["Date range", dateRangeLabel],
    ["Active funnels", getCoachFunnelLabels(coach).join(", ") || "No active funnel"],
    ["Total visits", String(coach.combined.visits)],
    ["Register/CTA clicks", String(coach.combined.clicks)],
    ["Free register clicks", String(coach.freeMetrics.registerClicks)],
    ["Paid register clicks", String(coach.paidMetrics.registerClicks)],
    [
      "WhatsApp/contact clicks",
      String(coach.freeMetrics.whatsappClicks + coach.paidMetrics.whatsappClicks)
    ],
    ["Payment success events", String(coach.paidMetrics.paymentSuccess)],
    ["Conversion rate", coach.combined.conversionRate],
    ["Top traffic source", coach.source],
    ["Top region", coach.region],
    ["Device breakdown", formatDeviceBreakdown(coach.deviceBreakdown)],
    ["Trend summary", coach.trend],
    ["AI insights", insights.length ? insights.join(" ") : "Not enough data for AI insights yet."],
    [
      "Recommended next actions",
      coach.lowActivityReasons.join("; ") || "Continue weekly sharing and compare click-through."
    ],
    [
      "Safety note",
      "Coach-facing report excludes private links, payment details, OTPs, secrets, raw user data, and internal logs."
    ]
  ];
}

function renderExcelWorksheet(name: string, rows: string[][], titleFirstRow: boolean) {
  const renderedRows = rows
    .map((row, rowIndex) => {
      const style = titleFirstRow && rowIndex === 0 ? ' ss:StyleID="Title"' : "";
      return `<Row${style}>${row
        .map((cell) => `<Cell><Data ss:Type="String">${escapeXmlCell(cell)}</Data></Cell>`)
        .join("")}</Row>`;
    })
    .join("");

  return `<Worksheet ss:Name="${escapeXmlAttribute(name)}"><Table>${renderedRows}</Table></Worksheet>`;
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeXmlCell(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlCell(value).replace(/"/g, "&quot;");
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
  const [paymentPageDraft, setPaymentPageDraft] = useState("");
  const [paymentUpdateMessage, setPaymentUpdateMessage] = useState("");
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
      paymentLastChangedAt: metadata.paymentPageUpdatedAt,
      paymentLastChangedBy: metadata.paymentPageUpdatedBy,
      paymentStorageSource: metadata.paymentPageStorageSource,
      paymentStatus: metadata.paymentPageConfigured
        ? "D1 server table"
        : link.paymentStatus === "Server redirect configured"
          ? "Server redirect configured"
          : "Not configured",
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

  async function updatePaymentPageLink(link: AdminPaidMasterclassLink) {
    setPrivateRevealBusy(true);
    setPaymentUpdateMessage("");
    setPrivateRevealUrl("");

    try {
      const response = await fetch("/api/admin/masterclass-private-link", {
        body: JSON.stringify({
          action: "update_payment",
          entryCode: link.entryCode,
          otp: privateOtp,
          paymentPageUrl: paymentPageDraft
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
        currentPaymentLinkPreserved?: boolean;
        error?: string;
        metadata?: PrivateLinkMetadata;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.metadata) {
        setPaymentUpdateMessage(
          payload.currentPaymentLinkPreserved
            ? `${payload.error || "Could not save the payment link."} Current checkout remains active.`
            : payload.error || "Could not save the payment link."
        );
        return;
      }

      setPrivateLinkMetadata((current) => ({
        ...current,
        [payload.metadata!.funnelId]: payload.metadata!
      }));
      setPaymentPageDraft("");
      setPaymentUpdateMessage("Payment page link saved server-side after OTP verification.");
    } catch {
      setPaymentUpdateMessage(
        "Could not reach the payment link save API. Current checkout remains active."
      );
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

  function formatPrivateChangedAt(value: string | null) {
    if (!value) return "Not recorded yet";

    const changedAt = new Date(value);
    if (Number.isNaN(changedAt.getTime())) return value;

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
                  setPaymentPageDraft("");
                  setPaymentUpdateMessage("");
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
                <dt>Payment link</dt>
                <dd>
                  <span className={styles.metaValue}>{currentManagedLink.paymentStatus}</span>
                  <small>Stored source: {currentManagedLink.paymentStorageSource}</small>
                </dd>
              </div>
              <div>
                <dt>Payment last changed</dt>
                <dd>
                  <span className={styles.metaValue}>
                    {formatPrivateChangedAt(currentManagedLink.paymentLastChangedAt)}
                  </span>
                  {currentManagedLink.paymentLastChangedAt ? (
                    <small>Changed by {currentManagedLink.paymentLastChangedBy}</small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>WhatsApp last changed</dt>
                <dd>
                  <span className={styles.metaValue}>
                    {formatPrivateChangedAt(currentManagedLink.privateWhatsappLastChangedAt)}
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
                <p className={styles.kicker}>OTP Protected Payment</p>
                <h4>Update payment link</h4>
                <p>
                  Use the OTP field above. The new URL is validated as a trusted Razorpay link
                  before saving. If validation fails, the current checkout link remains active.
                </p>
              </div>
              <label className={styles.compactField}>
                <span>Razorpay payment URL</span>
                <input
                  onChange={(event) => setPaymentPageDraft(event.target.value)}
                  placeholder="https://pages.razorpay.com/..."
                  type="url"
                  value={paymentPageDraft}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.primaryAction}
                  disabled={
                    privateRevealBusy || privateOtp.length !== 6 || !paymentPageDraft.trim()
                  }
                  onClick={() => void updatePaymentPageLink(currentManagedLink)}
                  type="button"
                >
                  Update Payment Link
                </button>
              </div>
              {paymentUpdateMessage ? (
                <p className={styles.inlineStatus}>{paymentUpdateMessage}</p>
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
              Payment and WhatsApp private destinations stay server-side. OTP reveals or updates do
              not expose secrets publicly, and link change time is tracked separately from reveal
              attempts.
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
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupFilter, setCleanupFilter] = useState<
    "fixed_ignored" | "older_30" | "older_90" | "stale_all"
  >("fixed_ignored");
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorAiItems, setErrorAiItems] = useState<string[]>([
    "Choose an AI action to review the currently loaded error reports."
  ]);
  const [errorAiStatus, setErrorAiStatus] = useState("");
  const [errorAiCache, setErrorAiCache] = useState("");
  const isLiveSource = source === "d1_table";
  const isLoadingSource = source === "loading";
  const cleanupConfirmed =
    cleanupConfirmation.trim().toUpperCase() === ERROR_REPORT_CLEANUP_CONFIRMATION;

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

  function runErrorReportsAssistant(label: string) {
    if (errorReports.length === 0) {
      setErrorAiItems(["No error reports are currently loaded."]);
      setErrorAiStatus(`${label} checked the current report list.`);
      setErrorAiCache("current list");
      return;
    }

    const openReports = errorReports.filter((report) => report.status === "New");
    const byCode = new Map<string, number>();
    const byCategory = new Map<string, number>();

    errorReports.forEach((report) => {
      const code = report.errorCode || report.referenceId || "Unknown";
      byCode.set(code, (byCode.get(code) || 0) + 1);
      byCategory.set(report.category || "uncategorized", (byCategory.get(report.category || "uncategorized") || 0) + 1);
    });

    const topCode = Array.from(byCode.entries()).sort((a, b) => b[1] - a[1])[0];
    const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];
    const latest = errorReports[0];

    if (label.includes("Codex")) {
      if (latest) {
        void copyAdminText("Codex prompt", createErrorReportBugPrompt(latest));
      }
      setErrorAiItems([
        latest
          ? `Copied a safe Codex fix prompt for ${latest.errorCode || latest.referenceId}.`
          : "No report was available for prompt creation.",
        "Prompt uses safe admin report fields only."
      ]);
    } else if (label.includes("Group")) {
      setErrorAiItems([
        `Top repeated code: ${topCode ? `${topCode[0]} (${topCode[1]})` : "none"}.`,
        `Top category: ${topCategory ? `${topCategory[0]} (${topCategory[1]})` : "none"}.`,
        `New reports still open: ${openReports.length}.`
      ]);
    } else {
      setErrorAiItems([
        `Loaded reports: ${errorReports.length}.`,
        `New reports: ${openReports.length}.`,
        latest
          ? `Latest safe issue: ${latest.errorCode || latest.referenceId} on ${latest.pagePath}.`
          : "No latest issue available."
      ]);
    }

    setErrorAiStatus(`${label} ready from current protected report data.`);
    setErrorAiCache("current reports");
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
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
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

  async function refreshReports() {
    try {
      const response = await fetch("/api/admin/error-reports", {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        errorReports?: AdminErrorReport[];
      };
      if (response.ok && Array.isArray(payload.errorReports)) {
        onReportsChange(payload.errorReports);
      }
    } catch {
      setStatusMessage("Cleanup completed, but the refreshed list could not be loaded.");
    }
  }

  async function clearOldReports() {
    if (!cleanupConfirmed) {
      setStatusMessage(`Type ${ERROR_REPORT_CLEANUP_CONFIRMATION} to enable cleanup.`);
      return;
    }

    setCleanupBusy(true);
    setStatusMessage("Clearing selected old error reports...");

    try {
      const response = await fetch("/api/admin/error-reports", {
        body: JSON.stringify({
          action: "clear_old",
          cleanupFilter
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        deletedCount?: number;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        setStatusMessage(payload.error || "Could not clear selected old reports.");
        return;
      }

      await refreshReports();
      setCleanupDialogOpen(false);
      setCleanupConfirmation("");
      setStatusMessage(`${payload.deletedCount || 0} old error reports cleared.`);
    } catch {
      setStatusMessage("Could not clear selected old reports. No other production data was touched.");
    } finally {
      setCleanupBusy(false);
    }
  }

  return (
    <AdminPageShell
      actions={
        <div className={styles.pageActionCluster}>
          <AnalyticsAiWidget
            actions={[
              {
                description: "Summarize visible safe report fields.",
                label: "Summarize Recent Errors"
              },
              {
                description: "Group reports by repeated codes and categories.",
                label: "Group Similar Issues"
              },
              {
                description: "Copy a safe Codex prompt for the newest report.",
                label: "Create Codex Fix Prompt"
              }
            ]}
            cacheLabel={errorAiCache}
            eyebrow="AI Error Review"
            fallbackItems={errorAiItems}
            insight={null}
            onGenerate={() => runErrorReportsAssistant("Summarize Recent Errors")}
            onRefresh={() => runErrorReportsAssistant("Summarize Recent Errors")}
            status={errorAiStatus}
            title="On-demand report assistant"
          />
          <button
            className={styles.dangerAction}
            data-admin-tooltip="Clear selected old reports after confirmation"
            disabled={!isLiveSource}
            onClick={() => {
              setCleanupDialogOpen(true);
              setCleanupConfirmation("");
              setStatusMessage("");
            }}
            type="button"
          >
            Clear Old Error Reports
          </button>
        </div>
      }
      eyebrow="Reports"
      title="Error Reports"
    >
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
                        aria-label={`Copy ${report.errorCode || report.referenceId}`}
                        data-admin-tooltip="Copy error code"
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
                        aria-label={`View details for ${report.errorCode || report.referenceId}`}
                        className={styles.iconAction}
                        data-admin-tooltip="View error details"
                        onClick={() => {
                          setSelectedReport(report);
                          setStatusMessage("");
                        }}
                        type="button"
                      >
                        <AdminActionIcon name="eye" />
                        <span className={styles.visuallyHidden}>View</span>
                      </button>
                      <button
                        aria-label={`Mark ${report.errorCode || report.referenceId} fixed`}
                        className={styles.iconAction}
                        data-admin-tooltip="Mark fixed"
                        onClick={() => void updateReportStatus(report, "Fixed")}
                        type="button"
                      >
                        <AdminActionIcon name="check" />
                        <span className={styles.visuallyHidden}>Mark Fixed</span>
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
      {statusMessage ? <p className={styles.inlineStatus}>{statusMessage}</p> : null}
      <AdminActionDialog
        footer={
          <>
            <button onClick={() => setCleanupDialogOpen(false)} type="button">
              Cancel
            </button>
            <button
              data-tone="danger"
              disabled={cleanupBusy || !isLiveSource || !cleanupConfirmed}
              onClick={() => void clearOldReports()}
              type="button"
            >
              {cleanupBusy ? "Clearing..." : "Clear Selected Reports"}
            </button>
          </>
        }
        onClose={() => setCleanupDialogOpen(false)}
        open={cleanupDialogOpen}
        title="Clear Old Error Reports"
        tone="danger"
      >
        <div className={styles.maintenanceDialog}>
          <p className={styles.dialogCopy}>
            This will permanently clear selected old error reports. This action cannot be undone.
          </p>
          <label className={styles.compactField}>
            Cleanup option
            <select
              onChange={(event) =>
                setCleanupFilter(
                  event.target.value as "fixed_ignored" | "older_30" | "older_90" | "stale_all"
                )
              }
              value={cleanupFilter}
            >
              <option value="fixed_ignored">Clear Fixed/Ignored reports</option>
              <option value="older_30">Clear reports older than 30 days</option>
              <option value="older_90">Clear reports older than 90 days</option>
              <option value="stale_all">Clear all old/stale reports</option>
            </select>
            <small>
              Fresh New reports are kept. Analytics, coach sites, admins, payment data, and audit
              logs are never touched by this cleanup.
            </small>
          </label>
          <label className={styles.compactField}>
            Type {ERROR_REPORT_CLEANUP_CONFIRMATION} to confirm
            <input
              autoComplete="off"
              onChange={(event) => setCleanupConfirmation(event.target.value)}
              placeholder={ERROR_REPORT_CLEANUP_CONFIRMATION}
              value={cleanupConfirmation}
            />
            <small>
              This confirmation is required because clearing reports is permanent.
            </small>
          </label>
        </div>
      </AdminActionDialog>
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
  csrfToken
}: {
  control: typeof adminControlCenterData;
  csrfToken: string;
}) {
  const [status, setStatus] = useState<AdminMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"backup" | "cleanup" | "test_backup_email" | "">("");
  const [errorCleanupBusy, setErrorCleanupBusy] = useState(false);
  const [errorCleanupConfirmOpen, setErrorCleanupConfirmOpen] = useState(false);
  const [errorCleanupFilter, setErrorCleanupFilter] = useState<
    "fixed_ignored" | "older_30" | "older_90" | "stale_all"
  >("fixed_ignored");
  const [errorCleanupConfirmation, setErrorCleanupConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [testBackupEmailConfirmOpen, setTestBackupEmailConfirmOpen] = useState(false);
  const errorCleanupConfirmed =
    errorCleanupConfirmation.trim().toUpperCase() === ERROR_REPORT_CLEANUP_CONFIRMATION;

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/backup-cleanup", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as BackupCleanupPayload;
        if (!active) return;
        if (response.ok && payload.backupCleanup) {
          setStatus(payload.backupCleanup);
        } else {
          setMessage(payload.error || "Backup/Cleanup status could not be loaded.");
        }
      } catch {
        if (active) setMessage("Backup/Cleanup status could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, []);

  async function clearOldReportsFromMaintenance() {
    if (!errorCleanupConfirmed) {
      setMessage(`Type ${ERROR_REPORT_CLEANUP_CONFIRMATION} to enable cleanup.`);
      return;
    }

    setErrorCleanupBusy(true);
    setMessage("Clearing selected old error reports...");

    try {
      const response = await fetch("/api/admin/error-reports", {
        body: JSON.stringify({
          action: "clear_old",
          cleanupFilter: errorCleanupFilter
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        deletedCount?: number;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Could not clear selected old error reports.");
        return;
      }

      const deletedCount = payload.deletedCount || 0;
      setStatus((current) =>
        current
          ? {
              ...current,
              lastErrorReportCleanupAt: new Date().toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short"
              }),
              lastErrorReportCleanupDeletedCount: deletedCount
            }
          : current
      );
      setErrorCleanupConfirmOpen(false);
      setErrorCleanupConfirmation("");
      setMessage(`${deletedCount} old error reports cleared. No analytics or coach data was touched.`);
    } catch {
      setMessage("Could not clear selected old reports. No other production data was touched.");
    } finally {
      setErrorCleanupBusy(false);
    }
  }

  async function runMaintenanceAction(action: "backup" | "cleanup" | "test_backup_email") {
    setBusyAction(action);
    setMessage(
      action === "backup"
        ? "Creating analytics backup..."
        : action === "cleanup"
          ? "Checking backup and active-admin notification before cleanup..."
          : "Sending test backup email..."
    );

    try {
      const response = await fetch("/api/admin/backup-cleanup", {
        body: JSON.stringify({ action }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as BackupCleanupPayload;
      if (payload.backupCleanup) setStatus(payload.backupCleanup);

      if (!response.ok || !payload.ok) {
        setMessage(payload.error || "Maintenance action could not complete.");
        return;
      }

      if (action === "backup") {
        setBackupConfirmOpen(false);
        setMessage(
          `Backup completed for ${payload.recordCount || 0} analytics records. Notification status: ${
            payload.notificationStatus || "not recorded"
          }.`
        );
      } else if (action === "cleanup") {
        setCleanupConfirmOpen(false);
        setMessage(`${payload.deletedCount || 0} old analytics events cleaned after backup.`);
      } else {
        setTestBackupEmailConfirmOpen(false);
        setMessage("Test backup email sent to all active admin recipients.");
      }
    } catch {
      setMessage("Maintenance action failed safely. No destructive cleanup was run.");
    } finally {
      setBusyAction("");
    }
  }

  const activeStatus =
    status ||
    ({
      activeAdminRecipientCount: 0,
      backupDestination: control.backupCleanup.backupDestination,
      backupDownloadUrl: null,
      backupXlsDownloadUrl: null,
      backupEmailConfigured: false,
      cleanupEligibleAnalyticsEvents: 0,
      cleanupStatus: control.backupCleanup.cleanupStatus,
      failedRecipients: [],
      lastBackupAt: control.backupCleanup.lastBackupAt,
      lastBackupRecordCount: 0,
      lastBackupStatus: "Not loaded",
      lastCleanupAt: control.backupCleanup.lastCleanupAt,
      lastCleanupDeletedCount: 0,
      lastErrorReportCleanupAt: "No error report cleanup run yet",
      lastErrorReportCleanupDeletedCount: 0,
      maskedRecipients: [],
      rawRecipientRoles: [],
      retentionDays: control.backupCleanup.retentionDays,
      roleChecklist: {
        adminEmailPresent: false,
        adminEmailRole: "Not loaded",
        adminEmailStatus: "Not loaded",
        adminRoleTableExists: false,
        currentAdminEmailMasked: "not loaded",
        lockoutRisk: "medium",
        rollbackInstructions: [
          "Set ADMIN_REQUIRE_DB_ADMIN_ROLES=false in Cloudflare Pages variables.",
          "Redeploy or wait for the variable update to take effect.",
          "Keep ADMIN_ALLOWED_EMAILS configured until DB-role login is verified."
        ],
        roleRequirementMet: false,
        strictDbRolesEnabled: false
      },
      scheduledCleanup: control.backupCleanup.scheduledCleanup
    } satisfies AdminMaintenanceStatus);

  return (
    <AdminPageShell eyebrow="Reports" title="Backup & Cleanup">
      <div className={styles.noticeCard} data-tone={loading ? "warning" : "success"}>
        <strong>{loading ? "Loading maintenance status" : "Maintenance controls are protected"}</strong>
        <p>
          Error Reports cleanup is separate and does not require backup. Raw analytics cleanup is
          blocked unless backup creation and active-admin notification both succeed.
        </p>
      </div>

      <section className={styles.maintenanceGrid}>
        <article className={styles.maintenanceCard}>
          <span>Retention</span>
          <strong>{activeStatus.retentionDays} days</strong>
          <p>Raw analytics older than this can be cleaned only after backup.</p>
        </article>
        <article className={styles.maintenanceCard}>
          <span>Destination</span>
          <strong>{activeStatus.backupDestination}</strong>
          <p>
            Backup data is emailed to active admins as CSV and XLS attachments. Protected
            dashboard downloads remain available as fallbacks.
          </p>
        </article>
        <article className={styles.maintenanceCard}>
          <span>Active admin recipients</span>
          <strong>{activeStatus.activeAdminRecipientCount}</strong>
          <p>{activeStatus.backupEmailConfigured ? "Email provider configured." : "Email provider missing."}</p>
        </article>
        <article className={styles.maintenanceCard}>
          <span>Eligible old analytics</span>
          <strong>{activeStatus.cleanupEligibleAnalyticsEvents}</strong>
          <p>{activeStatus.cleanupStatus}</p>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Backup recipients</p>
            <h2>Active admins from DB role table</h2>
          </div>
        </div>
        {activeStatus.maskedRecipients.length > 0 ? (
          <div className={styles.recipientList}>
            {activeStatus.rawRecipientRoles.map((recipient) => (
              <span key={`${recipient.maskedEmail}-${recipient.role}`}>
                {recipient.maskedEmail} <small>{recipient.role} / {recipient.status}</small>
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.linkWarning}>No active admin backup recipient found.</p>
        )}
        {activeStatus.failedRecipients.length > 0 ? (
          <p className={styles.linkWarning}>
            Failed recipients: {activeStatus.failedRecipients.join(", ")}
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Manual maintenance</p>
            <h2>Backup-first analytics cleanup</h2>
          </div>
        </div>
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Last backup</dt>
            <dd>{activeStatus.lastBackupAt}</dd>
          </div>
          <div>
            <dt>Backup status</dt>
            <dd>{activeStatus.lastBackupStatus}</dd>
          </div>
          <div>
            <dt>Backed up records</dt>
            <dd>{activeStatus.lastBackupRecordCount}</dd>
          </div>
          <div>
            <dt>Last cleanup</dt>
            <dd>{activeStatus.lastCleanupAt}</dd>
          </div>
          <div>
            <dt>Deleted analytics records</dt>
            <dd>{activeStatus.lastCleanupDeletedCount}</dd>
          </div>
          <div>
            <dt>Scheduled cleanup</dt>
            <dd>{activeStatus.scheduledCleanup}</dd>
          </div>
        </dl>
        <div className={styles.formActions}>
          <button
            className={styles.secondaryAction}
            disabled={Boolean(busyAction)}
            onClick={() => setBackupConfirmOpen(true)}
            type="button"
          >
            {busyAction === "backup" ? "Running Backup..." : "Run Backup Now"}
          </button>
          <button
            className={styles.secondaryAction}
            disabled={Boolean(busyAction) || !activeStatus.backupEmailConfigured}
            onClick={() => setTestBackupEmailConfirmOpen(true)}
            type="button"
          >
            {busyAction === "test_backup_email" ? "Sending..." : "Send Test Backup Email"}
          </button>
          <button
            className={styles.dangerAction}
            disabled={Boolean(busyAction)}
            onClick={() => setCleanupConfirmOpen(true)}
            type="button"
          >
            Run Cleanup After Backup
          </button>
          {activeStatus.backupDownloadUrl ? (
            <a className={styles.secondaryAction} href={activeStatus.backupDownloadUrl}>
              Download Latest CSV
            </a>
          ) : null}
          {activeStatus.backupXlsDownloadUrl ? (
            <a className={styles.secondaryAction} href={activeStatus.backupXlsDownloadUrl}>
              Download Latest XLS
            </a>
          ) : null}
        </div>
        {message ? <p className={styles.inlineStatus}>{message}</p> : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Error Reports cleanup</p>
            <h2>Separate no-backup cleanup</h2>
          </div>
        </div>
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Last stale-report cleanup</dt>
            <dd>{activeStatus.lastErrorReportCleanupAt}</dd>
          </div>
          <div>
            <dt>Reports deleted</dt>
            <dd>{activeStatus.lastErrorReportCleanupDeletedCount}</dd>
          </div>
        </dl>
        <p className={styles.linkWarning}>
          Use Admin Panel - Error Reports - Clear Old Error Reports. That flow never deletes
          analytics, coach sites, admin users, payment data, private links, or audit logs.
        </p>
        <div className={styles.formActions}>
          <button
            className={styles.dangerAction}
            disabled={errorCleanupBusy}
            onClick={() => {
              setErrorCleanupConfirmation("");
              setErrorCleanupConfirmOpen(true);
            }}
            type="button"
          >
            Clear Old Error Reports
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>DB role enforcement</p>
            <h2>Strict admin-role readiness checklist</h2>
          </div>
        </div>
        <div className={styles.roleChecklist}>
          {[
            ["Admin role table exists", activeStatus.roleChecklist.adminRoleTableExists],
            ["Current admin email present", activeStatus.roleChecklist.adminEmailPresent],
            ["Role requirement met", activeStatus.roleChecklist.roleRequirementMet],
            ["ADMIN_REQUIRE_DB_ADMIN_ROLES enabled", activeStatus.roleChecklist.strictDbRolesEnabled]
          ].map(([label, passed]) => (
            <div data-state={passed ? "pass" : "wait"} key={String(label)}>
              <strong>{String(label)}</strong>
              <span>{passed ? "Ready" : "Not ready"}</span>
            </div>
          ))}
        </div>
        <dl className={styles.definitionGrid}>
          <div>
            <dt>Current admin</dt>
            <dd>{activeStatus.roleChecklist.currentAdminEmailMasked}</dd>
          </div>
          <div>
            <dt>DB role</dt>
            <dd>{activeStatus.roleChecklist.adminEmailRole}</dd>
          </div>
          <div>
            <dt>DB status</dt>
            <dd>{activeStatus.roleChecklist.adminEmailStatus}</dd>
          </div>
          <div>
            <dt>Lockout risk</dt>
            <dd>{activeStatus.roleChecklist.lockoutRisk}</dd>
          </div>
        </dl>
        <div className={styles.noticeCard} data-tone="warning">
          <strong>Do not enable strict DB roles blindly.</strong>
          <p>
            Needed before enabling: final admin email, verified active role row, confirmed login and
            OTP, plus rollback readiness. Current production schema may use owner as the existing
            super-admin equivalent until a safe role migration is approved.
          </p>
          <ul className={styles.maintenanceList}>
            {activeStatus.roleChecklist.rollbackInstructions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <p className={styles.linkWarning}>
        Raw analytics cleanup must never delete coach profiles, coach sites, active links, or
        lifetime summaries.
      </p>
      <AdminActionDialog
        footer={
          <>
            <button onClick={() => setBackupConfirmOpen(false)} type="button">
              Cancel
            </button>
            <button
              disabled={Boolean(busyAction)}
              onClick={() => void runMaintenanceAction("backup")}
              type="button"
            >
              {busyAction === "backup" ? "Running..." : "Run Backup"}
            </button>
          </>
        }
        onClose={() => setBackupConfirmOpen(false)}
        open={backupConfirmOpen}
        title="Run Analytics Backup"
      >
        <div className={styles.maintenanceDialog}>
          <p className={styles.dialogCopy}>
            This creates CSV and XLS backup files for current analytics data and emails them to
            active admin recipients. No cleanup runs from this action.
          </p>
        </div>
      </AdminActionDialog>
      <AdminActionDialog
        footer={
          <>
            <button onClick={() => setTestBackupEmailConfirmOpen(false)} type="button">
              Cancel
            </button>
            <button
              disabled={Boolean(busyAction) || !activeStatus.backupEmailConfigured}
              onClick={() => void runMaintenanceAction("test_backup_email")}
              type="button"
            >
              {busyAction === "test_backup_email" ? "Sending..." : "Send Test Email"}
            </button>
          </>
        }
        onClose={() => setTestBackupEmailConfirmOpen(false)}
        open={testBackupEmailConfirmOpen}
        title="Send Test Backup Email"
      >
        <div className={styles.maintenanceDialog}>
          <p className={styles.dialogCopy}>
            This sends a test backup email to active admin recipients so the email backup channel can
            be verified before cleanup is used.
          </p>
        </div>
      </AdminActionDialog>
      <AdminActionDialog
        footer={
          <>
            <button onClick={() => setCleanupConfirmOpen(false)} type="button">
              Cancel
            </button>
            <button
              data-tone="danger"
              disabled={Boolean(busyAction)}
              onClick={() => void runMaintenanceAction("cleanup")}
              type="button"
            >
              {busyAction === "cleanup" ? "Checking..." : "Run Protected Cleanup"}
            </button>
          </>
        }
        onClose={() => setCleanupConfirmOpen(false)}
        open={cleanupConfirmOpen}
        title="Run Analytics Cleanup"
        tone="danger"
      >
        <div className={styles.maintenanceDialog}>
          <p className={styles.dialogCopy}>
            This deletes only raw analytics/events older than {activeStatus.retentionDays} days.
            It will not run unless the latest backup and active-admin notification succeeded.
          </p>
          <p className={styles.linkWarning}>
            Coach profiles, coach sites, slugs, settings, payment links, private links, admins, and
            audit logs are not part of this cleanup.
          </p>
        </div>
      </AdminActionDialog>
      <AdminActionDialog
        footer={
          <>
            <button onClick={() => setErrorCleanupConfirmOpen(false)} type="button">
              Cancel
            </button>
            <button
              data-tone="danger"
              disabled={errorCleanupBusy || !errorCleanupConfirmed}
              onClick={() => void clearOldReportsFromMaintenance()}
              type="button"
            >
              {errorCleanupBusy ? "Clearing..." : "Clear Selected Reports"}
            </button>
          </>
        }
        onClose={() => setErrorCleanupConfirmOpen(false)}
        open={errorCleanupConfirmOpen}
        title="Clear Old Error Reports"
        tone="danger"
      >
        <div className={styles.maintenanceDialog}>
          <p className={styles.dialogCopy}>
            This will permanently clear selected old error reports. This action cannot be undone.
          </p>
          <label className={styles.compactField}>
            Cleanup option
            <select
              onChange={(event) =>
                setErrorCleanupFilter(
                  event.target.value as "fixed_ignored" | "older_30" | "older_90" | "stale_all"
                )
              }
              value={errorCleanupFilter}
            >
              <option value="fixed_ignored">Clear Fixed/Ignored reports</option>
              <option value="older_30">Clear reports older than 30 days</option>
              <option value="older_90">Clear reports older than 90 days</option>
              <option value="stale_all">Clear all old/stale reports</option>
            </select>
            <small>
              This cleanup never deletes analytics events, coach data, payment data, admin users,
              coach sites, or audit logs.
            </small>
          </label>
          <label className={styles.compactField}>
            Type {ERROR_REPORT_CLEANUP_CONFIRMATION} to confirm
            <input
              autoComplete="off"
              onChange={(event) => setErrorCleanupConfirmation(event.target.value)}
              placeholder={ERROR_REPORT_CLEANUP_CONFIRMATION}
              value={errorCleanupConfirmation}
            />
            <small>
              This confirmation is required because clearing reports is permanent.
            </small>
          </label>
        </div>
      </AdminActionDialog>
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
      <section className={styles.settingsPanelList} aria-label="Admin settings summary">
        <article data-tone="success">
          <div>
            <strong>Admin access</strong>
            <span>Admin routes and write APIs remain protected by the current auth foundation.</span>
          </div>
          <em>Protected</em>
        </article>
        <article data-tone="success">
          <div>
            <strong>Hidden error support</strong>
            <span>
              Error fallback pages try coach phone, WhatsApp, email, image/logo, and support text
              first.
            </span>
          </div>
          <em>Coach-specific</em>
        </article>
        <article data-tone="warning">
          <div>
            <strong>Default YW support fallback</strong>
            <span>Used only when an error fallback has no coach-specific support details.</span>
          </div>
          <em>Fallback</em>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Security Settings</p>
            <h2>Current protection status</h2>
          </div>
        </div>
        <div className={styles.statusList}>
          {control.security.map((item) => (
            <div data-tone={item.tone} key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.status}</span>
            </div>
          ))}
        </div>
      </section>
      <p className={styles.securityNote}>
        Strict DB admin role enforcement should stay disabled until the real admin row is verified.
      </p>
    </AdminPageShell>
  );
}
