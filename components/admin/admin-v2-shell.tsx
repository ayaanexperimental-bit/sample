"use client";

import Image from "next/image";
import {
  type ComponentProps,
  type CSSProperties,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal, flushSync } from "react-dom";
import {
  adminV2MergedNavViews,
  adminV2NavSections,
  adminV2ViewTitles,
  canAccessAdminV2View,
  hasAdminV2Permission,
  type AdminV2ActionActivity,
  type AdminV2ActionActivityInput,
  type AdminV2CoachSiteFocus,
  type AdminV2NavItem,
  type AdminV2NavSection,
  type AdminV2ShellProps,
  type AdminV2ViewId
} from "../../lib/admin-v2-access";
import { AdminOdV2Style } from "./admin-od-v2-style";
import { AdminV2PortalScope } from "./admin-v2-portal-scope";
import styles from "./admin-v2-shell.module.css";
import {
  createErrorReportBugPrompt,
  type AdminErrorReport,
  type AdminPaidMasterclassLink
} from "../../lib/admin-control-center";
import {
  EMPTY_COACH_SITE_FORM,
  createCoachSiteFromForm,
  createFormFromCoachSite,
  normalizeCoachSlug,
  toPublicCoachSiteRecord,
  type CoachSiteFormState,
  type CoachSiteRecord,
  type CoachSiteStatus
} from "../../lib/admin-coach-sites";
import { productionReadyCoachTemplateThemes } from "../../lib/coach-template-themes";
import {
  PublicCoachSitePage,
  type CoachTemplatePreviewInspectTarget
} from "../coach/public-coach-site-page";
import {
  buildCoachAnalyticsRows,
  filterCoachAnalyticsRows,
  type CoachAnalyticsFunnelType,
  type CoachAnalyticsPerformanceBand,
  type CoachAnalyticsRow
} from "../../lib/admin-coach-analytics";
import {
  getAdminV2AvailableModuleActions,
  resolveAdminV2CoachSiteFocus,
  type AdminV2ModuleAction
} from "../../lib/admin-v2-navigation";
import {
  getAdminV2DashboardData,
  type AdminV2DashboardData,
  type AdminV2DataStatus
} from "../../lib/admin-v2-dashboard-data";
import { getAdminV2FeatureFlags } from "../../lib/admin-v2-feature-flags";
import type {
  AnalyticsDateRangeId,
  AnalyticsEventRange,
  AnalyticsAudienceRegion,
  AnalyticsMetricSummary,
  AnalyticsRecentEvent,
  AnalyticsTimeSeriesPoint
} from "../../lib/analytics-events";
import { AdminAIAskButton, AdminAIPill } from "./admin-ai";
import { AdminV2ActivityChart } from "./AdminV2ActivityChart";
import {
  AdminV2AdminUsersPanel,
  AdminV2MaintenancePanel,
  AdminV2PaidMasterclassPanel
} from "./admin-v2-production-parity";
import {
  buildAdminAIIntelligenceContext,
  buildAdminAISectionContext,
  getAdminAIAnalyticsEntityId,
  type AdminAIBuilderSnapshot,
  type AdminAIShopSnapshot
} from "../../lib/admin-ai/adminAIContext";
import {
  buildAdminAIOperationalContext,
  type AdminAISettingsSnapshot
} from "../../lib/admin-ai/adminAIOperationalContext";
import { requestAdminCoachCopyWithConfirmation } from "../../lib/admin-ai/adminAICoachCopyRequest";
import type { AdminAITableContext } from "../../lib/admin-ai/adminAITableCopilot";
import {
  canonicalCoachSectionRegistry,
  getCanonicalCoachNavbarSections,
  universalCoachBonuses
} from "../../lib/coach-canonical-template";
import { getAllowedAdminAICommands } from "../../lib/admin-ai/adminAIPermissions";
import { adminAIRegistry, getAdminAISection } from "../../lib/admin-ai/adminAIRegistry";
import { groundAdminAIResponse, type AdminAIResponse } from "../../lib/admin-ai/adminAIService";
import {
  applyAdminAIBuilderSuggestions,
  buildAdminAIBuilderSuggestions,
  type AdminAIBuilderSuggestion
} from "../../lib/admin-ai/adminAIBuilderSuggestions";
import { reviewAdminAIForm } from "../../lib/admin-ai/adminAIFormCopilot";

type LeafletModule = typeof import("leaflet");

type AdminV2ActionDialogState = {
  body: string;
  title: string;
  tone?: "danger" | "standard";
} | null;

type AdminV2ViewTransition = {
  ready: Promise<void>;
};

type AdminV2ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => AdminV2ViewTransition;
};

type CoachSitesApiPayload = {
  coachSites?: CoachSiteRecord[];
  configured?: boolean;
  ok?: boolean;
};

type AdminV2CoachDangerAction = "archive" | "delete_draft" | "remove";

type AdminV2CoachDangerDialogState = {
  action: AdminV2CoachDangerAction;
  site: CoachSiteRecord;
} | null;

type AnalyticsEventsApiPayload = {
  analyticsSummaries?: AnalyticsMetricSummary[];
  configured?: boolean;
  ok?: boolean;
  previousAnalyticsSummaries?: AnalyticsMetricSummary[];
  range?: AnalyticsEventRange;
  recentEvents?: AnalyticsRecentEvent[];
  source?: string;
  timeSeries?: AnalyticsTimeSeriesPoint[];
};

type AdminV2AiInsight = {
  cache?: "hit" | "miss";
  dataHash?: string;
  generatedAt?: string;
  keyTrends: string[];
  model?: string;
  predictions: string[];
  recommendations: string[];
  summary: string;
  warnings: string[];
};

type AdminV2AiInsightApiPayload = {
  cache?: "hit" | "miss";
  configured?: boolean;
  error?: string;
  failure?: {
    attempts: number;
    code: string;
    retryable: boolean;
  };
  insight?: AdminV2AiInsight;
  message?: string;
  ok?: boolean;
  usageEstimate?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

type AdminV2AiAssistantState =
  | "confused"
  | "focus"
  | "hover"
  | "idle"
  | "listen"
  | "sleep"
  | "success"
  | "thinking"
  | "warning";

type AdminV2CoachIntelligenceRow = {
  clicks: number;
  coachName: string;
  ctr: number;
  hasPaidFunnel: boolean;
  id: string;
  lastActivity: string;
  publicUrl: string;
  region: string;
  risk: AdminV2CoachRiskSignal;
  slug: string;
  source: string;
  status: CoachSiteStatus;
  visits: number;
};

type AdminV2CoachRiskSignal = {
  action: string;
  label: string;
  priority: "critical" | "good" | "high" | "medium";
  reason: string;
  score: number;
};

type AdminV2CoachAnalyticsFunnelFilter = "all" | "both" | "free" | "none" | "paid";
type AdminV2CoachAnalyticsPerformanceFilter = "all" | CoachAnalyticsPerformanceBand;
type AdminV2CoachAnalyticsSortBy =
  | "clicks"
  | "conversion"
  | "monthly"
  | "recent"
  | "visits"
  | "weekly";
type AdminV2CoachAnalyticsStatusFilter = "active" | "all" | CoachSiteStatus;
type AdminV2CoachReportFormat = "admin" | "detailed" | "whatsapp";
type AdminV2ErrorReportFilter = "active" | "all" | "fixed" | "ignored" | "new" | "reviewing";
type AdminV2CoachAnalyticsAIContext = {
  filters: Record<string, string>;
  selectedIds: string[];
};

const ADMIN_CSRF_HEADER_NAME = "x-yw-admin-csrf";
const PUBLIC_SHOP_SITE_PATH = "/shop";
const ADMIN_V2_COACH_SITE_PAGE_SIZE = 6;

const ADMIN_V2_ERROR_REPORT_FILTERS: Array<{
  id: AdminV2ErrorReportFilter;
  label: string;
}> = [
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "fixed", label: "Fixed" },
  { id: "ignored", label: "Ignored" },
  { id: "all", label: "All" }
];

const ADMIN_V2_SECURITY_STATUS_ITEMS = [
  {
    label: "Admin session cookies",
    status: "httpOnly, SameSite, Secure in production",
    tone: "success"
  },
  {
    label: "Admin write CSRF",
    status: "Required on protected write APIs",
    tone: "success"
  },
  {
    label: "Strict DB admin roles",
    status: "Active admin_users rows are the source of truth",
    tone: "success"
  },
  {
    label: "AI API key",
    status: "Server-side env only",
    tone: "success"
  },
  {
    label: "Private paid resources",
    status: "Server-side only",
    tone: "success"
  },
  {
    label: "Permanent removal",
    status: "OTP-gated before destructive action",
    tone: "attention"
  }
] as const;

const ERROR_REPORT_CLEANUP_FILTERS = [
  { id: "fixed_ignored", label: "Fixed or ignored" },
  { id: "older_30", label: "Older than 30 days" },
  { id: "older_90", label: "Older than 90 days" }
] as const;

type ErrorReportCleanupFilter = (typeof ERROR_REPORT_CLEANUP_FILTERS)[number]["id"];

type AdminSupportDefaultsForm = {
  supportEmail: string;
  supportMessage: string;
  supportName: string;
  supportPhone: string;
  supportWhatsapp: string;
};

type AdminV2UnknownRecord = Record<string, unknown>;
type AdminV2FormAIReviewResult = ReturnType<typeof reviewAdminAIForm>;

type AdminV2ShopPaymentSettings = {
  active: boolean;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string;
  packageLabel: string;
  paymentPageUrl: string;
  providerLabel: string;
  storageSource: string;
};

type AdminV2ShopSite = {
  coachEmail: string;
  coachName: string;
  createdAt: string;
  issueStatus: string;
  niche: string;
  orderId: string;
  paymentDate: string | null;
  paymentStatus: string;
  publicUrl: string;
  publishedAt: string | null;
  selectedThemeId: string;
  siteStatus: string;
  slug: string;
  source: string;
  workflowStage: string;
};

type AdminV2ShopFailure = {
  coachEmail: string;
  coachName: string;
  createdAt: string;
  message: string;
  orderId: string;
  recoveryStatus: string;
  severity: string;
  stage: string;
};

type AdminV2ShopAudit = {
  action: string;
  adminEmail: string;
  createdAt: string;
  newUrlSummary: string;
  oldUrlSummary: string;
};

type AdminV2ShopSnapshot = {
  audits: AdminV2ShopAudit[];
  failures: AdminV2ShopFailure[];
  paymentSettings: AdminV2ShopPaymentSettings;
  reports: {
    analyticsSummaryCount: number;
    failureCount: number;
    paymentSettingsAuditCount: number;
    purchaseCount: number;
    siteCount: number;
  };
  sites: AdminV2ShopSite[];
};

type AdminV2ShopApiPayload = {
  error?: string;
  ok?: boolean;
  shop?: AdminV2ShopSnapshot;
};

type AdminAIPillHostProps = Omit<ComponentProps<typeof AdminAIPill>, "onOpenChange" | "open"> & {
  onOpenStateChange: (open: boolean) => void;
};

type AdminAIPillHostHandle = {
  close: () => void;
  open: () => void;
};

const AdminAIPillHost = forwardRef<AdminAIPillHostHandle, AdminAIPillHostProps>(
  function AdminAIPillHost({ onOpenStateChange, ...props }, ref) {
    const [open, setOpen] = useState(false);
    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        setOpen(nextOpen);
        onOpenStateChange(nextOpen);
      },
      [onOpenStateChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        close: () => handleOpenChange(false),
        open: () => handleOpenChange(true)
      }),
      [handleOpenChange]
    );

    return <AdminAIPill {...props} onOpenChange={handleOpenChange} open={open} />;
  }
);

export function AdminV2DashboardShell(props: AdminV2ShellProps) {
  const {
    adminAccess,
    csrfToken,
    onActiveViewChange,
    onLogout,
    requestedCoachSiteFocus,
    requestedView,
    sessionEmail
  } = props;
  const [snapshotStatus, setSnapshotStatus] = useState<AdminV2DataStatus | "loading">("loading");
  const [snapshot, setSnapshot] = useState<AdminV2DashboardData | null>(null);
  const [activeView, setActiveView] = useState<AdminV2ViewId>(requestedView || "overview");
  const [adminTheme, setAdminTheme] = useState<"dark" | "light">("dark");
  const [themeSweepActive, setThemeSweepActive] = useState(false);
  const themeSweepTimeoutRef = useRef<number | null>(null);
  const aiStateResetTimerRef = useRef<number | null>(null);
  const activityCenterRef = useRef<AdminAIPillHostHandle>(null);
  const activityCenterOpenRef = useRef(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<AdminV2ActionDialogState>(null);
  const [adminActionActivity, setAdminActionActivity] = useState<AdminV2ActionActivity[]>([]);
  const [errorReports, setErrorReports] = useState<AdminErrorReport[]>([]);
  const [errorReportSource, setErrorReportSource] = useState("loading");
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState("");
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState("");
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsDateRangeId>("7d");
  const [analyticsRangeMeta, setAnalyticsRangeMeta] = useState<AnalyticsEventRange | null>(null);
  const [analyticsSource, setAnalyticsSource] = useState("loading");
  const [analyticsSummaries, setAnalyticsSummaries] = useState<AnalyticsMetricSummary[]>([]);
  const [, setPreviousAnalyticsSummaries] = useState<AnalyticsMetricSummary[]>([]);
  const [analyticsTimeSeries, setAnalyticsTimeSeries] = useState<AnalyticsTimeSeriesPoint[]>([]);
  const [recentAnalyticsEvents, setRecentAnalyticsEvents] = useState<AnalyticsRecentEvent[]>([]);
  const [liveCoachSites, setLiveCoachSites] = useState<CoachSiteRecord[]>([]);
  const [coachSiteFocus, setCoachSiteFocus] = useState<AdminV2CoachSiteFocus | null>(
    requestedCoachSiteFocus || null
  );
  const [builderEditingSite, setBuilderEditingSite] = useState<CoachSiteRecord | null>(null);
  const [coachSiteSource, setCoachSiteSource] = useState("loading");
  const [dashboardDataUpdatedAt, setDashboardDataUpdatedAt] = useState("");
  const featureFlags = getAdminV2FeatureFlags();
  const moduleActions = getAdminV2AvailableModuleActions(adminAccess);
  const adminDisplayName = adminAccess?.displayName || sessionEmail || "Admin user";
  const adminRoleLabel = adminAccess?.isOwner
    ? "Owner"
    : adminAccess?.role || adminAccess?.roleKey || "Admin";
  const dashboardDataLoading =
    analyticsSource === "loading" ||
    coachSiteSource === "loading" ||
    errorReportSource === "loading";
  const shellCoachRows = useMemo(
    () => getAdminV2CoachRows(liveCoachSites, analyticsSummaries),
    [analyticsSummaries, liveCoachSites]
  );
  const shellProductionRows = useMemo(
    () =>
      buildCoachAnalyticsRows(liveCoachSites, analyticsSummaries, {
        preferEventSummaries: true
      }),
    [analyticsSummaries, liveCoachSites]
  );
  const shellIntelligenceRows = useMemo(
    () => buildAdminV2CoachIntelligenceRows(shellCoachRows, shellProductionRows),
    [shellCoachRows, shellProductionRows]
  );
  const shellMetrics = useMemo(() => getAdminV2OdMetrics(snapshot), [snapshot]);
  const shellHighRiskRows = useMemo(
    () =>
      shellIntelligenceRows
        .filter((row) => row.risk.priority !== "good")
        .sort((a, b) => b.risk.score - a.risk.score)
        .slice(0, 6),
    [shellIntelligenceRows]
  );
  const shellLocalAiInsight = useMemo(
    () =>
      buildAdminV2LocalAiInsight({
        metrics: shellMetrics,
        recentEvents: recentAnalyticsEvents,
        rows: shellIntelligenceRows,
        scope: "overview",
        selectedCoach: null
      }),
    [recentAnalyticsEvents, shellIntelligenceRows, shellMetrics]
  );
  const canUseAiInsights =
    featureFlags.aiInsights && hasAdminV2Permission(adminAccess, "coach_analytics.ai_insights");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssistantState, setAiAssistantState] = useState<AdminV2AiAssistantState>("idle");
  const [builderAiContext, setBuilderAiContext] = useState<AdminAIBuilderSnapshot | null>(null);
  const [coachSitesAiTableContext, setCoachSitesAiTableContext] =
    useState<AdminAITableContext | null>(null);
  const [adminAiTableContexts, setAdminAiTableContexts] = useState<
    Partial<Record<AdminV2ViewId, AdminAITableContext>>
  >({});
  const [coachAnalyticsAiContext, setCoachAnalyticsAiContext] =
    useState<AdminV2CoachAnalyticsAIContext | null>(null);
  const [, setErrorReportAiContext] = useState<{
    filter: AdminV2ErrorReportFilter;
    selectedReferenceId: string;
  }>({ filter: "active", selectedReferenceId: "" });
  const [settingsAiContext, setSettingsAiContext] = useState<AdminAISettingsSnapshot | null>(null);
  const registerAdminAiTableContext = useCallback(
    (viewId: AdminV2ViewId, context: AdminAITableContext) => {
      setAdminAiTableContexts((current) =>
        current[viewId] === context ? current : { ...current, [viewId]: context }
      );
    },
    []
  );
  const setOverviewAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("overview", context),
    [registerAdminAiTableContext]
  );
  const setTopCoachesAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("top-coaches", context),
    [registerAdminAiTableContext]
  );
  const setCoachAnalyticsAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("coach-analytics", context),
    [registerAdminAiTableContext]
  );
  const setShopAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("shop", context),
    [registerAdminAiTableContext]
  );
  const setErrorReportsAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("error-reports", context),
    [registerAdminAiTableContext]
  );
  const setPaidMasterclassAiTableContext = useCallback(
    (context: AdminAITableContext) =>
      registerAdminAiTableContext("paid-masterclass-settings", context),
    [registerAdminAiTableContext]
  );
  const setAdminUsersAiTableContext = useCallback(
    (context: AdminAITableContext) => registerAdminAiTableContext("admin-users", context),
    [registerAdminAiTableContext]
  );
  const activeAdminAiTableContext =
    activeView === "coach-sites"
      ? coachSitesAiTableContext
      : adminAiTableContexts[activeView] || null;
  const visibleNavSections = useMemo(
    () =>
      adminV2NavSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            const viewId = item.id as AdminV2ViewId;
            return canAccessAdminV2View(adminAccess, viewId) && !adminV2MergedNavViews.has(viewId);
          })
        }))
        .filter((section) => section.items.length > 0),
    [adminAccess]
  );
  const setAiAssistantMood = useCallback((state: AdminV2AiAssistantState, resetMs = 0) => {
    if (aiStateResetTimerRef.current !== null) {
      window.clearTimeout(aiStateResetTimerRef.current);
      aiStateResetTimerRef.current = null;
    }

    setAiAssistantState(state);

    if (resetMs > 0) {
      aiStateResetTimerRef.current = window.setTimeout(() => {
        setAiAssistantState(activityCenterOpenRef.current ? "listen" : "idle");
        aiStateResetTimerRef.current = null;
      }, resetMs);
    }
  }, []);
  const trackActivityCenterOpen = useCallback((open: boolean) => {
    activityCenterOpenRef.current = open;
  }, []);
  const hasVisibleAdminViews = visibleNavSections.length > 0;
  const activeCopilotSection = getAdminAISection(activeView);
  const shellShopAiSnapshot = useMemo(
    () => getAdminV2ShopAiSnapshot(snapshot?.sources.shop.data),
    [snapshot?.sources.shop.data]
  );
  const adminAiOperational = useMemo(
    () =>
      buildAdminAIOperationalContext({
        actionActivity: adminActionActivity,
        backupData: snapshot?.sources.backupCleanup.data,
        backupStatus: snapshot?.sources.backupCleanup.status || snapshotStatus,
        calculatedAt: dashboardDataUpdatedAt || snapshot?.generatedAt || new Date().toISOString(),
        coachSites: liveCoachSites,
        errorReports,
        profile: adminAccess,
        settingsSnapshot: settingsAiContext,
        settingsStatus: snapshot?.sources.authSession.status || snapshotStatus,
        usersData: snapshot?.sources.users.data,
        usersStatus: snapshot?.sources.users.status || snapshotStatus
      }),
    [
      adminAccess,
      adminActionActivity,
      dashboardDataUpdatedAt,
      errorReports,
      liveCoachSites,
      settingsAiContext,
      snapshot,
      snapshotStatus
    ]
  );
  const adminAiIntelligence = useMemo(
    () =>
      buildAdminAIIntelligenceContext({
        analyticsStatus: analyticsSource,
        builderInspection:
          activeView === "create-coach-site" ? builderAiContext?.inspection || null : null,
        calculatedAt: dashboardDataUpdatedAt || snapshot?.generatedAt || new Date().toISOString(),
        coachSites: liveCoachSites,
        errorReportStatus: errorReportSource,
        errorReports,
        operational: adminAiOperational,
        shop: shellShopAiSnapshot,
        table: activeAdminAiTableContext,
        timeSeries: analyticsTimeSeries
      }),
    [
      activeView,
      adminAiOperational,
      analyticsSource,
      analyticsTimeSeries,
      builderAiContext?.inspection,
      activeAdminAiTableContext,
      dashboardDataUpdatedAt,
      errorReportSource,
      errorReports,
      liveCoachSites,
      shellShopAiSnapshot,
      snapshot?.generatedAt
    ]
  );
  const adminAiContext = useMemo(() => {
    const allowedCommands = getAllowedAdminAICommands(adminAccess, activeCopilotSection.commands);
    const globalAllowedCommands = Object.values(adminAIRegistry).flatMap((section) =>
      getAllowedAdminAICommands(adminAccess, section.commands)
    );
    const sourceStatuses = {
      analyticsEvents: analyticsSource,
      authSession: snapshot?.sources.authSession.status || snapshotStatus,
      backupCleanup: snapshot?.sources.backupCleanup.status || snapshotStatus,
      coachSites: coachSiteSource,
      errorReports: errorReportSource,
      masterclassPrivateLinks: snapshot?.sources.masterclassPrivateLinks.status || snapshotStatus,
      masterclassSettings: snapshot?.sources.masterclassSettings.status || snapshotStatus,
      shop: snapshot?.sources.shop.status || snapshotStatus,
      users: snapshot?.sources.users.status || snapshotStatus
    };

    return buildAdminAISectionContext({
      activeView,
      analytics: analyticsSummaries,
      availableActions: allowedCommands.map((command) => command.label),
      builder: builderAiContext,
      coachSites: liveCoachSites,
      currentRoute: `/admin/dashboard?view=${activeView}`,
      dateRange: analyticsRangeMeta?.label || analyticsRange.toUpperCase(),
      errorReports,
      filters:
        activeView === "coach-analytics"
          ? coachAnalyticsAiContext?.filters || {
              dateRange: analyticsRangeMeta?.label || analyticsRange.toUpperCase()
            }
          : activeView === "create-coach-site" && builderAiContext
            ? { creatorStep: builderAiContext.currentStep }
            : activeAdminAiTableContext
              ? Object.fromEntries(
                  Object.entries(activeAdminAiTableContext.filters).map(([key, value]) => [
                    key,
                    String(value)
                  ])
                )
              : {},
      globalRegisteredCommands: globalAllowedCommands,
      highRiskCount: shellHighRiskRows.length,
      intelligence: adminAiIntelligence,
      lastUpdated: dashboardDataUpdatedAt || snapshot?.generatedAt || "",
      loading: isAdminV2CopilotContextLoading(activeView, {
        analyticsSource,
        coachSiteSource,
        errorReportSource,
        snapshotStatus
      }),
      metrics: snapshot?.metrics || [],
      operational: adminAiOperational,
      profile: adminAccess,
      relatedAPIs: activeCopilotSection.relatedAPIs,
      registeredCommands: allowedCommands,
      sectionName: activeCopilotSection.name,
      selectedRows:
        activeView === "create-coach-site" && builderAiContext?.coachName
          ? [builderAiContext.coachName]
          : activeAdminAiTableContext?.selectedIds ||
            (activeView === "coach-analytics" ? coachAnalyticsAiContext?.selectedIds : []) ||
            [],
      shop: shellShopAiSnapshot,
      sourceStatuses,
      timeSeries: analyticsTimeSeries
    });
  }, [
    activeCopilotSection,
    activeView,
    adminAccess,
    adminAiOperational,
    analyticsRange,
    analyticsRangeMeta?.label,
    analyticsSource,
    analyticsSummaries,
    analyticsTimeSeries,
    adminAiIntelligence,
    builderAiContext,
    activeAdminAiTableContext,
    coachAnalyticsAiContext,
    coachSiteSource,
    dashboardDataUpdatedAt,
    errorReportSource,
    errorReports,
    liveCoachSites,
    shellHighRiskRows.length,
    shellShopAiSnapshot,
    snapshot,
    snapshotStatus
  ]);

  useEffect(() => {
    let active = true;

    getAdminV2DashboardData({ adminAccess })
      .then((nextSnapshot) => {
        if (!active) return;
        setSnapshot(nextSnapshot);
        setSnapshotStatus(nextSnapshot.status);
      })
      .catch(() => {
        if (active) setSnapshotStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, [adminAccess]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedTheme = window.localStorage.getItem("yw-admin-v2-theme");
        if (storedTheme === "dark" || storedTheme === "light") setAdminTheme(storedTheme);
      } catch {
        // Local storage can be blocked; keep the default dark V2 theme.
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootScrollBehavior = root.style.scrollBehavior;
    const previousBodyScrollBehavior = body.style.scrollBehavior;

    root.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";

    return () => {
      root.style.scrollBehavior = previousRootScrollBehavior;
      body.style.scrollBehavior = previousBodyScrollBehavior;
    };
  }, []);

  useEffect(() => {
    let lastPointerFocusAt = 0;

    function markPointerFocus() {
      lastPointerFocusAt = Date.now();
    }

    function keepFocusedControlInView(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (Date.now() - lastPointerFocusAt < 250) return;
      if (!target.closest('[data-admin-v2="true"]')) return;
      if (
        !target.matches(
          'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="option"], [tabindex]:not([tabindex="-1"])'
        )
      ) {
        return;
      }

      const chromeTarget = target.closest(".topbar, .sidebar, .mobile-bottom");
      if (chromeTarget) {
        window.scrollTo({ left: 0, top: 0 });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else {
        target.scrollIntoView({ block: "center", inline: "center" });
      }

      window.requestAnimationFrame(() => {
        if (chromeTarget) {
          window.scrollTo({ left: 0, top: 0 });
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
          target.scrollIntoView({ block: "center", inline: "center" });
        }
      });
    }

    document.addEventListener("pointerdown", markPointerFocus, true);
    document.addEventListener("touchstart", markPointerFocus, true);
    document.addEventListener("focusin", keepFocusedControlInView);
    return () => {
      document.removeEventListener("pointerdown", markPointerFocus, true);
      document.removeEventListener("touchstart", markPointerFocus, true);
      document.removeEventListener("focusin", keepFocusedControlInView);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ left: 0, top: 0 });
      document.querySelector<HTMLElement>('[data-admin-v2="true"] .content')?.scrollTo({
        left: 0,
        top: 0
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView]);

  useEffect(
    () => () => {
      if (themeSweepTimeoutRef.current !== null) {
        window.clearTimeout(themeSweepTimeoutRef.current);
      }
      if (aiStateResetTimerRef.current !== null) {
        window.clearTimeout(aiStateResetTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!requestedView || requestedView === activeView) return;
    if (!canAccessAdminV2View(adminAccess, requestedView)) return;

    const frame = window.requestAnimationFrame(() => {
      setActiveView(requestedView as AdminV2ViewId);
      onActiveViewChange?.(requestedView as AdminV2ViewId);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, adminAccess, onActiveViewChange, requestedView]);

  useEffect(() => {
    if (requestedView !== "coach-sites") return;
    const frame = window.requestAnimationFrame(() => {
      setCoachSiteFocus(requestedCoachSiteFocus || null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedCoachSiteFocus, requestedView]);

  useEffect(() => {
    if (canAccessAdminV2View(adminAccess, activeView)) return;
    const firstAllowed = visibleNavSections[0]?.items[0]?.id as AdminV2ViewId | undefined;
    if (!firstAllowed) return;

    const frame = window.requestAnimationFrame(() => {
      setActiveView(firstAllowed);
      onActiveViewChange?.(firstAllowed);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, adminAccess, onActiveViewChange, visibleNavSections]);

  useEffect(() => {
    if (!hasAdminV2Permission(adminAccess, "error_reports.view")) {
      const frame = window.requestAnimationFrame(() => {
        setErrorReports([]);
        setErrorReportSource("not-authorized");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    let active = true;

    async function loadErrorReports() {
      try {
        const response = await fetch("/api/admin/error-reports", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          errorReports?: AdminErrorReport[];
          persistence?: string;
        };

        if (!active) return;
        if (response.ok && Array.isArray(payload.errorReports)) {
          setErrorReports(payload.errorReports);
          setErrorReportSource(payload.persistence || "unknown");
          setDashboardDataUpdatedAt(new Date().toISOString());
        } else {
          setErrorReports([]);
          setErrorReportSource("unavailable");
        }
      } catch {
        if (active) {
          setErrorReports([]);
          setErrorReportSource("unavailable");
        }
      }
    }

    void loadErrorReports();

    return () => {
      active = false;
    };
  }, [adminAccess]);

  useEffect(() => {
    if (!hasAdminV2Permission(adminAccess, "coach_analytics.view")) {
      const frame = window.requestAnimationFrame(() => {
        setAnalyticsSummaries([]);
        setPreviousAnalyticsSummaries([]);
        setAnalyticsTimeSeries([]);
        setRecentAnalyticsEvents([]);
        setAnalyticsRangeMeta(null);
        setAnalyticsSource("not-authorized");
      });
      return () => window.cancelAnimationFrame(frame);
    }

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
          setAnalyticsTimeSeries(payload.timeSeries || []);
          setRecentAnalyticsEvents(payload.recentEvents || []);
          setAnalyticsRangeMeta(payload.range || null);
          setAnalyticsSource(
            payload.source || (payload.configured ? "d1_analytics_events" : "not-configured")
          );
          setDashboardDataUpdatedAt(new Date().toISOString());
        } else {
          setAnalyticsSummaries([]);
          setPreviousAnalyticsSummaries([]);
          setAnalyticsTimeSeries([]);
          setRecentAnalyticsEvents([]);
          setAnalyticsRangeMeta(null);
          setAnalyticsSource("unavailable");
        }
      } catch {
        if (active) {
          setAnalyticsSummaries([]);
          setPreviousAnalyticsSummaries([]);
          setAnalyticsTimeSeries([]);
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
  }, [analyticsCustomEnd, analyticsCustomStart, analyticsRange, adminAccess]);

  useEffect(() => {
    if (!hasAdminV2Permission(adminAccess, "coach_sites.view")) {
      const frame = window.requestAnimationFrame(() => {
        setLiveCoachSites([]);
        setCoachSiteSource("not-authorized");
      });
      return () => window.cancelAnimationFrame(frame);
    }

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
          setDashboardDataUpdatedAt(new Date().toISOString());
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
  }, [adminAccess]);

  function openAction(title: string, body: string, tone: "danger" | "standard" = "standard") {
    setActionDialog({ body, title, tone });
  }

  function recordAdminV2ActionActivity(activity: AdminV2ActionActivityInput) {
    const timestamp = new Date().toISOString();
    const id = `${timestamp}-${activity.label}-${Math.random().toString(36).slice(2, 8)}`;

    setAdminActionActivity((current) =>
      [
        {
          ...activity,
          id,
          timestamp
        },
        ...current
      ].slice(0, 8)
    );
  }

  async function generateFloatingAiInsight(
    forceRefresh = false,
    signal?: AbortSignal
  ): Promise<AdminAIResponse> {
    if (aiBusy) {
      return groundAdminAIResponse(
        {
          body: "An aggregate insight request is already running.",
          items: [],
          state: "loading",
          title: "AI insight in progress"
        },
        adminAiContext
      );
    }
    if (!featureFlags.aiInsights) {
      setAiAssistantMood("warning", 2600);
      return groundAdminAIResponse(
        {
          body: "The live model feature flag is off. Deterministic Copilot commands remain available.",
          items: [],
          state: "offline-error",
          title: "Live AI insight is disabled"
        },
        adminAiContext
      );
    }
    if (!canUseAiInsights) {
      setAiAssistantMood("warning", 2600);
      return groundAdminAIResponse(
        {
          body: "This admin is not assigned coach_analytics.ai_insights.",
          items: [],
          state: "insufficient-permission",
          title: "AI permission required"
        },
        adminAiContext
      );
    }

    setAiAssistantMood("thinking");
    setAiBusy(true);
    recordAdminV2ActionActivity({
      detail: "Floating AI assistant started a production-counter insight request.",
      label: "AI Assistant",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/analytics-insights", {
        body: JSON.stringify({
          dateRange: analyticsRangeMeta?.label || analyticsRange.toUpperCase(),
          forceRefresh,
          payload: buildAdminV2AiAnalyticsPayload({
            highRiskRows: shellHighRiskRows,
            metrics: shellMetrics,
            recentEvents: recentAnalyticsEvents,
            rows: shellIntelligenceRows,
            selectedCoach: null,
            snapshot
          }),
          scope: "overview"
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST",
        signal
      });
      const payload = (await response.json().catch(() => ({}))) as AdminV2AiInsightApiPayload;

      if (!response.ok || !payload.ok || !payload.insight) {
        const fallbackMessage =
          payload.message || payload.error || "AI insight unavailable; local rules remain active.";
        const retryable = payload.failure?.retryable ?? response.status === 503;
        setAiAssistantMood(retryable ? "confused" : "warning", 3200);
        recordAdminV2ActionActivity({
          detail: payload.message || "Floating AI returned a safe fallback state.",
          label: "AI Assistant",
          status: "error"
        });
        return groundAdminAIResponse(
          {
            body: fallbackMessage,
            items: [
              ...(retryable ? ["Retry manually after the provider recovery window."] : []),
              ...shellLocalAiInsight.recommendations.slice(0, 3)
            ],
            state: retryable ? "offline-error" : "action-failed",
            title: "Live AI insight unavailable"
          },
          adminAiContext
        );
      }

      setAiAssistantMood("success", 2400);
      recordAdminV2ActionActivity({
        detail: "Floating AI insight generated from current production counters.",
        label: "AI Assistant",
        status: "success"
      });
      return groundAdminAIResponse(
        {
          body: payload.insight.summary,
          confidence: {
            level: "medium",
            reason:
              "The live-model interpretation is grounded in bounded aggregate counters and still requires source verification."
          },
          items: [
            ...payload.insight.keyTrends,
            ...payload.insight.recommendations,
            ...payload.insight.warnings
          ].slice(0, 6),
          state: "ready",
          title: payload.cache === "hit" ? "Cached live insight" : "Live aggregate insight"
        },
        adminAiContext
      );
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return groundAdminAIResponse(
          {
            body: "The stale read request was cancelled. Core admin controls remain available.",
            items: [],
            state: "cancelled",
            title: "AI request cancelled"
          },
          adminAiContext
        );
      }
      setAiAssistantMood("confused", 3200);
      recordAdminV2ActionActivity({
        detail: "Floating AI insight request failed safely.",
        label: "AI Assistant",
        status: "error"
      });
      return groundAdminAIResponse(
        {
          body: "The model endpoint could not be reached. Deterministic Copilot commands remain available.",
          items: shellLocalAiInsight.recommendations.slice(0, 3),
          state: "offline-error",
          title: "Live AI service offline"
        },
        adminAiContext
      );
    } finally {
      setAiBusy(false);
    }
  }

  function selectView(
    viewId: string,
    preserveBuilderEdit = false,
    nextCoachSiteFocus: AdminV2CoachSiteFocus | null = null
  ) {
    const nextView = viewId as AdminV2ViewId;
    if (!canAccessAdminV2View(adminAccess, nextView)) return;
    if (nextView === "create-coach-site" && !preserveBuilderEdit) {
      setBuilderEditingSite(null);
    }
    setActionDialog(null);
    activityCenterRef.current?.close();
    window.scrollTo({ left: 0, top: 0 });
    document.querySelector<HTMLElement>('[data-admin-v2="true"] .content')?.scrollTo({
      left: 0,
      top: 0
    });
    setCoachSiteFocus(nextView === "coach-sites" ? nextCoachSiteFocus : null);
    setActiveView(nextView);
    onActiveViewChange?.(nextView, nextView === "coach-sites" ? nextCoachSiteFocus : null);
  }

  function openCoachSitesForAnalyticsRow(row: CoachAnalyticsRow) {
    const exactMatches = liveCoachSites.filter(
      (site) =>
        site.coachId === row.coachId ||
        normalizeCoachSlug(site.slug) === normalizeCoachSlug(row.coachSlug)
    );
    selectView("coach-sites", false, {
      coachId: row.coachId,
      coachSlug: row.coachSlug,
      ...(exactMatches.length === 1 ? { siteId: exactMatches[0].id } : {})
    });
  }

  function setThemeSweepDomState(active: boolean) {
    const mount = document.querySelector<HTMLElement>('[data-admin-v2="true"]');
    const themeButton = mount?.querySelector<HTMLElement>(".top-actions > .theme-btn.btn");

    if (active) {
      mount?.setAttribute("data-theme-sweep", "active");
      themeButton?.setAttribute("data-theme-sweep", "active");
      return;
    }

    mount?.removeAttribute("data-theme-sweep");
    themeButton?.removeAttribute("data-theme-sweep");
  }

  function toggleAdminTheme(originElement?: HTMLElement) {
    if (themeSweepTimeoutRef.current !== null) {
      window.clearTimeout(themeSweepTimeoutRef.current);
    }
    const nextTheme = adminTheme === "dark" ? "light" : "dark";
    const commitTheme = () => {
      try {
        window.localStorage.setItem("yw-admin-v2-theme", nextTheme);
      } catch {
        // Theme still changes for the current session.
      }
      setAdminTheme(nextTheme);
    };

    setThemeSweepActive(true);
    setThemeSweepDomState(true);
    themeSweepTimeoutRef.current = window.setTimeout(() => {
      setThemeSweepActive(false);
      setThemeSweepDomState(false);
      themeSweepTimeoutRef.current = null;
    }, 460);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as AdminV2ViewTransitionDocument;
    const canUseViewTransition =
      Boolean(originElement && transitionDocument.startViewTransition) && !reducedMotion;

    if (!canUseViewTransition || !originElement || !transitionDocument.startViewTransition) {
      commitTheme();
      return;
    }

    const rect = originElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const transition = transitionDocument.startViewTransition(() => {
      flushSync(commitTheme);
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
          },
          {
            duration: 720,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)"
          }
        );
      })
      .catch(() => {});
  }

  const pageContent: ReactNode = !hasVisibleAdminViews ? (
    <section className="console-card" aria-label="No admin permissions assigned">
      <div className="section-head">
        <div>
          <p className="console-kicker">Admin access</p>
          <h2>No permissions assigned</h2>
          <p>This admin account is active, but no dashboard sections are assigned.</p>
        </div>
      </div>
      <div className={styles.v2EmptyState}>
        Ask the owner to add at least one permission before using the admin console.
      </div>
    </section>
  ) : (
    <>
      {activeView === "overview" ? (
        <AdminV2DashboardAddon
          actions={moduleActions}
          analyticsRange={analyticsRange}
          analyticsRangeMeta={analyticsRangeMeta}
          analyticsSource={analyticsSource}
          dataUpdatedAt={dashboardDataUpdatedAt}
          onAnalyticsRangeChange={setAnalyticsRange}
          onAIContextChange={setOverviewAiTableContext}
          onSelect={selectView}
          selectedView={activeView}
          snapshot={snapshot}
          status={snapshotStatus}
          timeSeries={analyticsTimeSeries}
        />
      ) : null}

      {activeView === "coach-sites" ? (
        <AdminV2CoachSitesPage
          analyticsSummaries={analyticsSummaries}
          canArchive={hasAdminV2Permission(adminAccess, "coach_sites.archive")}
          canCreate={hasAdminV2Permission(adminAccess, "website_creator.create")}
          canDeleteDraft={hasAdminV2Permission(adminAccess, "website_creator.save_draft")}
          canEdit={hasAdminV2Permission(adminAccess, "coach_sites.edit")}
          canPublish={hasAdminV2Permission(adminAccess, "website_creator.publish")}
          canRemove={hasAdminV2Permission(adminAccess, "coach_sites.remove")}
          coachSites={liveCoachSites}
          csrfToken={csrfToken}
          errorReports={errorReports}
          focusTarget={coachSiteFocus}
          onAIContextChange={setCoachSitesAiTableContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onEditSite={(site) => {
            setBuilderEditingSite(site);
            selectView("create-coach-site", true);
          }}
          onSelect={selectView}
          onSitesChange={setLiveCoachSites}
          source={coachSiteSource}
          theme={adminTheme}
        />
      ) : null}

      {activeView === "create-coach-site" ? (
        <AdminV2CreateSitePage
          csrfToken={csrfToken}
          editingSite={builderEditingSite}
          initialSites={liveCoachSites}
          initialSource={coachSiteSource}
          key={builderEditingSite?.id || "new-coach-site"}
          onAIContextChange={setBuilderAiContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onSelect={selectView}
          onSitesChange={(sites) => {
            setLiveCoachSites(sites);
            if (builderEditingSite) {
              setBuilderEditingSite(
                sites.find((site) => site.id === builderEditingSite.id) || null
              );
            }
          }}
        />
      ) : null}

      {activeView === "top-coaches" ? (
        <AdminV2TopPerformersPage
          analyticsSource={analyticsSource}
          analyticsSummaries={analyticsSummaries}
          coachSites={liveCoachSites}
          dataLoading={analyticsSource === "loading" || coachSiteSource === "loading"}
          onAIContextChange={setTopCoachesAiTableContext}
        />
      ) : null}

      {activeView === "coach-analytics" ? (
        <AdminV2CoachAnalyticsPage
          analyticsCustomEnd={analyticsCustomEnd}
          analyticsCustomStart={analyticsCustomStart}
          analyticsRange={analyticsRange}
          analyticsRangeMeta={analyticsRangeMeta}
          analyticsSource={analyticsSource}
          analyticsSummaries={analyticsSummaries}
          coachSites={liveCoachSites}
          dataLoading={analyticsSource === "loading" || coachSiteSource === "loading"}
          dataUpdatedAt={dashboardDataUpdatedAt}
          onAnalyticsCustomEndChange={setAnalyticsCustomEnd}
          onAnalyticsCustomStartChange={setAnalyticsCustomStart}
          onAnalyticsRangeChange={setAnalyticsRange}
          onAIContextChange={setCoachAnalyticsAiContext}
          onTableAIContextChange={setCoachAnalyticsAiTableContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onOpenCoachOps={openCoachSitesForAnalyticsRow}
          recentEvents={recentAnalyticsEvents}
          source={coachSiteSource}
          snapshot={snapshot}
          timeSeries={analyticsTimeSeries}
        />
      ) : null}

      {activeView === "paid-masterclass-settings" ? (
        <AdminV2PaidMasterclassPage
          csrfToken={csrfToken}
          links={snapshot?.sources.masterclassPrivateLinks.data || []}
          onAIContextChange={setPaidMasterclassAiTableContext}
          onAdminActivity={recordAdminV2ActionActivity}
          source={
            snapshot?.sources.masterclassPrivateLinks.source ||
            snapshot?.sources.masterclassPrivateLinks.status ||
            "loading"
          }
          theme={adminTheme}
        />
      ) : null}

      {activeView === "shop" ? (
        <AdminV2ShopPage
          csrfToken={csrfToken}
          onAIContextChange={setShopAiTableContext}
          onAdminActivity={recordAdminV2ActionActivity}
          snapshot={snapshot}
        />
      ) : null}

      {activeView === "error-reports" ? (
        <AdminV2ReportsPage
          canClear={hasAdminV2Permission(adminAccess, "error_reports.clear_stale")}
          canMark={hasAdminV2Permission(adminAccess, "error_reports.mark_status")}
          canViewTechnical={hasAdminV2Permission(adminAccess, "error_reports.technical_details")}
          csrfToken={csrfToken}
          errorReports={errorReports}
          maintenanceStatus={snapshot?.sources.backupCleanup.status || "unavailable"}
          onAIContextChange={setErrorReportAiContext}
          onTableAIContextChange={setErrorReportsAiTableContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onReportsChange={setErrorReports}
          onSelect={selectView}
          source={errorReportSource}
          theme={adminTheme}
        />
      ) : null}

      {activeView === "backup-cleanup" ? (
        <AdminV2ReportsPage
          canClear={hasAdminV2Permission(adminAccess, "error_reports.clear_stale")}
          canMark={hasAdminV2Permission(adminAccess, "error_reports.mark_status")}
          canViewTechnical={hasAdminV2Permission(adminAccess, "error_reports.technical_details")}
          csrfToken={csrfToken}
          errorReports={errorReports}
          focusMaintenance
          maintenanceStatus={snapshot?.sources.backupCleanup.status || "unavailable"}
          onAIContextChange={setErrorReportAiContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onReportsChange={setErrorReports}
          onSelect={selectView}
          source={errorReportSource}
          theme={adminTheme}
        />
      ) : null}

      {activeView === "settings" ? (
        <AdminV2SettingsPage
          adminAccess={adminAccess}
          csrfToken={csrfToken}
          onAction={openAction}
          onAIContextChange={setSettingsAiContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onOpenAdminUsers={() => selectView("admin-users")}
          snapshot={snapshot}
          theme={adminTheme}
        />
      ) : null}

      {activeView === "admin-users" ? (
        <AdminV2SettingsPage
          adminAccess={adminAccess}
          csrfToken={csrfToken}
          focusAdminUsers
          onAction={openAction}
          onAIContextChange={setSettingsAiContext}
          onAdminActivity={recordAdminV2ActionActivity}
          onOpenAdminUsers={() => selectView("admin-users")}
          onTableAIContextChange={setAdminUsersAiTableContext}
          snapshot={snapshot}
          theme={adminTheme}
        />
      ) : null}
    </>
  );

  return (
    <div
      className={`${styles.adminV2Mount}${mobileNavOpen ? " sidebar-open" : ""}`}
      data-admin-v2="true"
      data-admin-v2-advanced-analytics={featureFlags.advancedAnalytics ? "enabled" : "disabled"}
      data-admin-v2-data-status={snapshotStatus}
      data-admin-v2-experimental-charts={featureFlags.experimentalCharts ? "enabled" : "disabled"}
      data-admin-v2-snapshot-at={snapshot?.generatedAt || ""}
      data-od-theme={adminTheme}
      data-theme-sweep={themeSweepActive ? "active" : undefined}
    >
      <AdminOdV2Style />
      <AdminV2OdRuntimeStyle />
      <section
        aria-label="YW Coach admin dashboard"
        className="app"
        data-admin-theme={adminTheme}
        data-admin-v2-module-view={activeView !== "overview" ? "true" : undefined}
        data-admin-version="v2"
        data-od-theme={adminTheme}
      >
        <AdminV2Sidebar
          activeView={activeView}
          adminDisplayName={adminDisplayName}
          adminRoleLabel={adminRoleLabel}
          mobileOpen={mobileNavOpen}
          nav={visibleNavSections}
          onCloseMobile={() => setMobileNavOpen(false)}
          onSelect={selectView}
          sessionEmail={sessionEmail}
        />

        <div className="main-shell">
          <AdminV2Header
            activeTitle={adminV2ViewTitles[activeView]}
            activityCount={adminActionActivity.length}
            adminDisplayName={adminDisplayName}
            adminRoleLabel={adminRoleLabel}
            canCreateSite={canAccessAdminV2View(adminAccess, "create-coach-site")}
            canOpenReports={canAccessAdminV2View(adminAccess, "error-reports")}
            mobileOpen={mobileNavOpen}
            nav={visibleNavSections}
            onActivityToggle={() => activityCenterRef.current?.open()}
            onLogout={onLogout}
            onMenu={() => setMobileNavOpen(true)}
            onSelect={selectView}
            onThemeToggle={toggleAdminTheme}
            sessionEmail={sessionEmail}
            showQuickActions={featureFlags.quickActions}
            theme={adminTheme}
            themeSweepActive={themeSweepActive}
          />

          {dashboardDataLoading && activeView !== "overview" ? (
            <p className={styles.v2DataNotice} role="status">
              Loading production data sources.
            </p>
          ) : null}

          <div className="content">
            <div
              className={
                activeView === "overview" ? "page is-active" : "page is-active v2-module-page"
              }
            >
              {pageContent}
            </div>
          </div>
        </div>

        <AdminV2MobileQuickNav
          activeView={activeView}
          nav={visibleNavSections}
          onSelect={selectView}
        />

        <AdminV2ActionDialog
          onClose={() => setActionDialog(null)}
          open={Boolean(actionDialog)}
          theme={adminTheme}
          title={actionDialog?.title || ""}
          tone={actionDialog?.tone}
        >
          <p className={styles.v2DialogCopy}>{actionDialog?.body}</p>
        </AdminV2ActionDialog>
        <AdminAIPillHost
          activity={adminActionActivity}
          assistantState={aiAssistantState}
          context={adminAiContext}
          csrfToken={csrfToken}
          onActivity={recordAdminV2ActionActivity}
          onAssistantStateChange={setAiAssistantMood}
          onExternalCommand={(_command, _context, options) =>
            generateFloatingAiInsight(false, options.signal)
          }
          onNavigate={selectView}
          onOpenStateChange={trackActivityCenterOpen}
          orbContent={
            <AdminV2AiBotSvg className={styles.aiAssistantRobot} state={aiAssistantState} />
          }
          profile={adminAccess}
          ref={activityCenterRef}
          theme={adminTheme}
        />
      </section>
    </div>
  );
}

function AdminV2Sidebar({
  activeView,
  adminDisplayName,
  adminRoleLabel,
  mobileOpen,
  nav,
  onCloseMobile,
  onSelect,
  sessionEmail
}: {
  activeView: AdminV2ViewId;
  adminDisplayName?: string;
  adminRoleLabel?: string;
  mobileOpen: boolean;
  nav: AdminV2NavSection[];
  onCloseMobile: () => void;
  onSelect: (viewId: string) => void;
  sessionEmail?: string;
}) {
  const navItems = nav.flatMap((section) => section.items);
  const displayName = adminDisplayName || sessionEmail || "Admin user";
  const roleLabel = adminRoleLabel || "Admin";
  const initials = getAdminV2Initials(displayName);

  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close admin menu"
          className={styles.v2SidebarScrim}
          onClick={onCloseMobile}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Admin navigation"
        className="sidebar"
        data-open={mobileOpen ? "true" : "false"}
        id="admin-sidebar"
      >
        <div className="brand">
          <div className="brand-mark logo-mark" aria-label="YW Nutritech">
            <Image
              alt="YW Nutritech"
              aria-label="Close navigation panel"
              height={34}
              onClick={onCloseMobile}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onCloseMobile();
              }}
              role="button"
              src="/assets/yw-nutritech-logo.png"
              tabIndex={0}
              title="Close navigation panel"
              unoptimized
              width={34}
            />
          </div>
          <div>
            <strong>YWcoach Admin</strong>
            <span>Production operations</span>
          </div>
        </div>

        <nav className="nav-section" aria-label="Primary admin rail">
          <div className="nav-title">Admin navigation</div>
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const iconName = getAdminV2Icon(item.id);

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className={`nav-btn${isActive ? " is-active" : ""}`}
                data-subtitle={item.description}
                data-title={item.label}
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onCloseMobile();
                }}
                type="button"
              >
                <span className="nav-icon" data-icon={iconName}>
                  <AdminV2RailIcon name={iconName} />
                </span>
                <span className="nav-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <button
          aria-label={`${displayName} verified session`}
          className="sidebar-footer"
          onClick={onCloseMobile}
          title={`${displayName} - verified session`}
          type="button"
        >
          <span className="sidebar-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="sidebar-user-tip" aria-hidden="true">
            <strong>{displayName}</strong>
            <span>{sessionEmail || "Verified session"}</span>
          </span>
          <span className="secure-row">
            <span>Session</span>
            <strong>Verified</strong>
          </span>
          <span className="secure-row">
            <span>Role</span>
            <strong>{roleLabel}</strong>
          </span>
        </button>
      </aside>
    </>
  );
}

function AdminV2Header({
  activeTitle,
  activityCount = 0,
  adminDisplayName,
  adminRoleLabel,
  canCreateSite = false,
  canOpenReports = false,
  mobileOpen = false,
  nav,
  onActivityToggle,
  onLogout,
  onMenu,
  onSelect,
  onThemeToggle,
  sessionEmail,
  showQuickActions = false,
  theme,
  themeSweepActive = false
}: {
  activeTitle: string;
  activityCount?: number;
  adminDisplayName?: string;
  adminRoleLabel?: string;
  canCreateSite?: boolean;
  canOpenReports?: boolean;
  mobileOpen?: boolean;
  nav: AdminV2NavSection[];
  onActivityToggle?: () => void;
  onLogout: () => void;
  onMenu: () => void;
  onSelect?: (viewId: string) => void;
  onThemeToggle?: (originElement?: HTMLElement) => void;
  sessionEmail?: string;
  showQuickActions?: boolean;
  theme?: "dark" | "light";
  themeSweepActive?: boolean;
}) {
  const displayName = adminDisplayName || sessionEmail || "Admin user";
  const roleLabel = adminRoleLabel || "Admin";
  const initials = getAdminV2Initials(displayName);
  const quickActionsAvailable = showQuickActions && onSelect && (canOpenReports || canCreateSite);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const suppressCommandOpenRef = useRef(false);
  const [localThemeSweepActive, setLocalThemeSweepActive] = useState(false);
  const localThemeSweepTimeoutRef = useRef<number | null>(null);
  const navItems = useMemo(() => nav.flatMap((section) => section.items), [nav]);
  const normalizedCommandQuery = commandQuery.trim().toLowerCase();
  const commandResults = useMemo(
    () =>
      navItems
        .filter((item) => {
          if (!normalizedCommandQuery) return true;
          const haystack = [item.label, item.description, ...getAdminV2CommandAliases(item)]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedCommandQuery);
        })
        .slice(0, 8),
    [navItems, normalizedCommandQuery]
  );
  const resolvedActiveCommandIndex = Math.min(
    activeCommandIndex,
    Math.max(0, commandResults.length - 1)
  );
  const activeCommand = commandResults[resolvedActiveCommandIndex];
  const sweepActive = themeSweepActive || localThemeSweepActive;

  useEffect(
    () => () => {
      if (localThemeSweepTimeoutRef.current !== null) {
        window.clearTimeout(localThemeSweepTimeoutRef.current);
      }
    },
    []
  );

  function selectCommand(viewId: AdminV2ViewId) {
    if (!onSelect) return;
    onSelect(viewId);
    setCommandQuery("");
    setCommandOpen(false);
  }

  function triggerThemeToggle(event: ReactMouseEvent<HTMLButtonElement>) {
    if (localThemeSweepTimeoutRef.current !== null) {
      window.clearTimeout(localThemeSweepTimeoutRef.current);
    }
    setLocalThemeSweepActive(true);
    localThemeSweepTimeoutRef.current = window.setTimeout(() => {
      setLocalThemeSweepActive(false);
      localThemeSweepTimeoutRef.current = null;
    }, 460);
    onThemeToggle?.(event.currentTarget);
  }

  return (
    <>
      <button
        aria-controls="admin-sidebar"
        aria-expanded={mobileOpen}
        aria-label="Open navigation"
        className="mobile-menu"
        id="mobile-menu"
        onClick={onMenu}
        title="Open navigation"
        type="button"
      >
        <span className="menu-lines" aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </button>
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">
            <div className="page-kicker">Verified admin session</div>
            <div className="page-heading-row">
              <h1 className="page-title">{activeTitle}</h1>
              <span className="page-dropdown" aria-label="Admin workspace">
                <span>Admin</span>
                <span className="page-chevron" aria-hidden="true" />
              </span>
            </div>
            <p className="page-subtitle">
              Manage coach pages, reports, payments, and admin actions.
            </p>
          </div>
        </div>
        <div className="top-actions">
          {onSelect && navItems.length ? (
            <div
              className="top-search-wrap smart-search"
              data-smart-search-wrap=""
              onBlur={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                  setCommandOpen(false);
                }
              }}
            >
              <label htmlFor="admin-v2-global-command-search">Search</label>
              <input
                aria-activedescendant={
                  commandOpen && activeCommand
                    ? `admin-v2-command-option-${activeCommand.id}`
                    : undefined
                }
                aria-controls="admin-v2-global-command-results"
                aria-expanded={commandOpen}
                aria-haspopup="listbox"
                aria-label="Search admin modules"
                id="admin-v2-global-command-search"
                onChange={(event) => {
                  setCommandQuery(event.currentTarget.value);
                  setActiveCommandIndex(0);
                  if (suppressCommandOpenRef.current) {
                    suppressCommandOpenRef.current = false;
                    setCommandOpen(false);
                    return;
                  }
                  setCommandOpen(true);
                }}
                onFocus={() => setCommandOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    suppressCommandOpenRef.current = true;
                    setCommandOpen(false);
                    return;
                  }
                  if (event.key === "ArrowDown" && commandResults.length) {
                    event.preventDefault();
                    setCommandOpen(true);
                    setActiveCommandIndex((index) =>
                      Math.min(commandResults.length - 1, index + 1)
                    );
                    return;
                  }
                  if (event.key === "ArrowUp" && commandResults.length) {
                    event.preventDefault();
                    setCommandOpen(true);
                    setActiveCommandIndex((index) => Math.max(0, index - 1));
                    return;
                  }
                  if (event.key === "Enter" && activeCommand) {
                    event.preventDefault();
                    selectCommand(activeCommand.id);
                  }
                }}
                placeholder="Search admin modules..."
                role="combobox"
                type="search"
                value={commandQuery}
              />
              <div
                className="smart-search-results"
                hidden={!commandOpen}
                id="admin-v2-global-command-results"
                role="listbox"
              >
                {commandResults.length ? (
                  commandResults.map((item, index) => (
                    <button
                      aria-selected={resolvedActiveCommandIndex === index}
                      className="smart-search-option console-command-btn"
                      id={`admin-v2-command-option-${item.id}`}
                      key={item.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveCommandIndex(index)}
                      onClick={() => selectCommand(item.id)}
                      role="option"
                      type="button"
                    >
                      <AdminV2ActionGlyph name={getAdminV2Icon(item.id)} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      <span className="badge">{adminV2ViewTitles[item.id]}</span>
                    </button>
                  ))
                ) : (
                  <div className="smart-search-empty">No matching command found.</div>
                )}
              </div>
            </div>
          ) : null}
          {quickActionsAvailable ? (
            <div className="quick-action-group" aria-label="Quick actions">
              {canOpenReports ? (
                <button
                  className="btn btn-sm console-command-btn"
                  onClick={() => onSelect?.("error-reports")}
                  type="button"
                >
                  <AdminV2ActionGlyph name="reports" />
                  <span>Reports</span>
                </button>
              ) : null}
              {canCreateSite ? (
                <button
                  className="btn btn-sm btn-primary console-command-btn"
                  onClick={() => onSelect?.("create-coach-site")}
                  type="button"
                >
                  <AdminV2ActionGlyph name="plus" />
                  <span>Create Site</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {activityCount > 0 ? (
            <button
              aria-label="Admin action activity"
              className="btn btn-icon notification-btn"
              onClick={onActivityToggle}
              type="button"
            >
              <span>{activityCount}</span>
            </button>
          ) : null}
          <div className="profile-menu" aria-label={`${displayName}, ${roleLabel}`} role="status">
            <span className="profile-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="profile-name">{displayName}</span>
            <span className="sr-only">{roleLabel}</span>
          </div>
          {theme && onThemeToggle ? (
            <button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} admin theme`}
              aria-pressed={theme === "light"}
              className={`btn theme-btn${sweepActive ? " is-transitioning" : ""}`}
              data-theme-sweep={sweepActive ? "active" : undefined}
              onClick={triggerThemeToggle}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} admin theme`}
              type="button"
            >
              <svg className="theme-toggle__within" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="toggle-sun" cx="12" cy="12" r="3.35" />
                <g className="toggle-rays" strokeLinecap="round">
                  <path d="M12 4.1v1.55" />
                  <path d="M12 18.35v1.55" />
                  <path d="M6.4 6.4l1.1 1.1" />
                  <path d="M16.5 16.5l1.1 1.1" />
                  <path d="M4.1 12h1.55" />
                  <path d="M18.35 12h1.55" />
                  <path d="M6.4 17.6l1.1-1.1" />
                  <path d="M16.5 7.5l1.1-1.1" />
                </g>
                <path
                  className="toggle-moon"
                  d="M16.75 15.15A5.75 5.75 0 0 1 8.85 7.25 5.75 5.75 0 1 0 16.75 15.15Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">Toggle color theme</span>
            </button>
          ) : null}
          <button className="btn btn-sm logout-action" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>
    </>
  );
}

function AdminV2MobileQuickNav({
  activeView,
  nav,
  onSelect
}: {
  activeView: AdminV2ViewId;
  nav: AdminV2NavSection[];
  onSelect: (viewId: AdminV2ViewId) => void;
}) {
  const navItems = nav.flatMap((section) => section.items);
  const quickOrder: AdminV2ViewId[] = [
    "overview",
    "coach-analytics",
    "coach-sites",
    "create-coach-site",
    "error-reports"
  ];
  const quickItems = quickOrder
    .map((viewId) => navItems.find((item) => item.id === viewId))
    .filter((item): item is AdminV2NavItem => Boolean(item));

  if (!quickItems.length) return null;

  return (
    <div className="mobile-bottom" aria-label="Mobile quick navigation">
      {quickItems.map((item) => (
        <button
          aria-label={`Open ${item.label}`}
          className={activeView === item.id ? "is-active" : ""}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          {getAdminV2MobileLabel(item.id)}
        </button>
      ))}
    </div>
  );
}

function AdminV2ActionDialog({
  children,
  onClose,
  open,
  size = "standard",
  theme = "dark",
  title,
  tone = "standard"
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "standard" | "wide";
  theme?: "dark" | "light";
  title: string;
  tone?: "danger" | "standard";
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  const dialog = (
    <div className={styles.v2DialogLayer} data-od-theme={theme} role="presentation">
      <button
        aria-label="Dismiss action dialog"
        className={styles.v2DialogScrim}
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.v2DialogPanel}
        data-size={size}
        data-tone={tone}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.v2DialogHeader}>
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="Close action dialog"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </header>
        <div className={styles.v2DialogBody}>{children}</div>
      </section>
    </div>
  );

  return typeof document === "undefined"
    ? dialog
    : createPortal(<AdminV2PortalScope theme={theme}>{dialog}</AdminV2PortalScope>, document.body);
}

type AdminV2IconName =
  | "chart"
  | "dashboard"
  | "payments"
  | "plus"
  | "reports"
  | "settings"
  | "shield"
  | "shop"
  | "site"
  | "users";

function AdminV2RailIcon({ name }: { name: AdminV2IconName }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24"
  };

  if (name === "dashboard") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...commonProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <rect x="7" y="13" width="2.8" height="4.2" rx=".8" />
        <rect x="11" y="9" width="2.8" height="8.2" rx=".8" />
        <rect x="15" y="6" width="2.8" height="11.2" rx=".8" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...commonProps}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M14.5 17.8a4.2 4.2 0 0 1 6 2.2" />
      </svg>
    );
  }

  if (name === "site") {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9h17" />
        <path d="M8 14h5" />
        <path d="M8 17h8" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="6" width="12" height="14" rx="2" />
        <path d="M7 10h6M7 14h4" />
        <path d="M18 13v6M15 16h6" />
      </svg>
    );
  }

  if (name === "shop") {
    return (
      <svg {...commonProps}>
        <path className="shop-handle" d="M8 9.2a4 4 0 0 1 8 0" />
        <path className="shop-basket" d="M5 9.2h14l-1.4 10.3H6.4L5 9.2Z" />
        <path className="shop-basket" d="M8.2 12.2h7.6" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg {...commonProps}>
        <path className="report-page" d="M7 3.8h7l3 3V20H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" />
        <path className="report-corner" d="M14 3.8V7h3" />
        <path className="report-line" d="M8 9.4h4.6" />
        <path className="report-line" d="M8 12.8h5.8" />
        <circle className="report-alert" cx="16.6" cy="15.8" r="2" />
      </svg>
    );
  }

  if (name === "payments") {
    return (
      <svg {...commonProps}>
        <rect className="payment-card" x="3.8" y="6" width="16.4" height="12" rx="2" />
        <path className="payment-strip" d="M3.8 9.5h16.4" />
        <rect className="payment-chip" x="7" y="12.7" width="3.5" height="2.7" rx=".7" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...commonProps}>
        <path
          className="settings-gear"
          d="M10.65 2.65h2.7l.62 2.45c.55.16 1.07.38 1.56.65l2.18-1.3 1.9 1.9-1.3 2.18c.27.49.49 1.01.65 1.56l2.45.62v2.7l-2.45.62a7.42 7.42 0 0 1-.65 1.56l1.3 2.18-1.9 1.9-2.18-1.3c-.49.27-1.01.49-1.56.65l-.62 2.45h-2.7l-.62-2.45a7.42 7.42 0 0 1-1.56-.65l-2.18 1.3-1.9-1.9 1.3-2.18a7.42 7.42 0 0 1-.65-1.56l-2.45-.62v-2.7l2.45-.62c.16-.55.38-1.07.65-1.56l-1.3-2.18 1.9-1.9 2.18 1.3c.49-.27 1.01-.49 1.56-.65l.62-2.45Z"
        />
        <circle className="settings-core" cx="12" cy="12" r="3.05" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3.8l7.5 3.1v5.6c0 3.8-2.5 6.4-7.5 7.7-5-1.3-7.5-3.9-7.5-7.7V6.9L12 3.8Z" />
      <circle cx="12" cy="10.3" r="2.1" />
    </svg>
  );
}

function AdminV2ActionGlyph({ name }: { name: AdminV2IconName }) {
  return (
    <span className="console-action-glyph" data-icon={name} aria-hidden="true">
      <AdminV2RailIcon name={name} />
    </span>
  );
}

function getAdminV2Icon(viewId: string): AdminV2IconName {
  const icons: Record<string, AdminV2IconName> = {
    "coach-analytics": "chart",
    "coach-sites": "site",
    "create-coach-site": "plus",
    "error-reports": "reports",
    overview: "dashboard",
    "paid-masterclass-settings": "payments",
    settings: "settings",
    shop: "shop",
    "top-coaches": "users"
  };

  return icons[viewId] || "dashboard";
}

function getAdminV2MobileLabel(viewId: AdminV2ViewId) {
  const labels: Partial<Record<AdminV2ViewId, string>> = {
    "coach-analytics": "Data",
    "coach-sites": "Sites",
    "create-coach-site": "Create",
    "error-reports": "Reports",
    overview: "Home"
  };

  return labels[viewId] || adminV2ViewTitles[viewId];
}

function getAdminV2CommandAliases(item: AdminV2NavItem) {
  const aliases: Partial<Record<AdminV2ViewId, string[]>> = {
    "coach-analytics": ["coach analytics", "data", "metrics", "audience", "map"],
    "coach-sites": ["sites", "referral", "paid filter", "manage sites"],
    "create-coach-site": [
      "create coach site",
      "builder",
      "website creator",
      "draft",
      "preview",
      "publish"
    ],
    "error-reports": ["error reports", "reports", "issues", "cleanup", "backup"],
    "paid-masterclass-settings": ["paid masterclass", "payments", "links", "redirects", "otp"],
    shop: ["orders", "website builder purchases", "payment page", "exports"],
    "top-coaches": ["top performers", "coaches", "leaderboard", "roster"]
  };

  return aliases[item.id] || [];
}

function getAdminV2Initials(value: string) {
  const parts = value
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean);

  return (parts.map((part) => part.charAt(0)).join("") || "A").slice(0, 2).toUpperCase();
}

const ADMIN_V2_OD_RUNTIME_CSS = `
  html:has([data-admin-v2="true"]) {
    scroll-behavior: auto !important;
  }

  [data-admin-v2="true"],
  [data-admin-v2="true"] * {
    scroll-behavior: auto !important;
  }

  [data-admin-v2="true"] {
    width: 100%;
    max-width: 100%;
  }

  [data-admin-v2="true"] .app,
  [data-admin-v2="true"] .content,
  [data-admin-v2="true"] .page,
  [data-admin-v2="true"] .dashboard-console,
  [data-admin-v2="true"] .console-card {
    min-width: 0;
  }

  [data-admin-v2="true"] .content {
    width: 100%;
    max-width: 1440px;
    margin-inline: auto;
  }

  [data-admin-v2="true"] .topbar {
    width: min(100%, 1440px);
    margin-inline: auto;
    grid-template-columns: minmax(260px, .72fr) minmax(0, 1.28fr);
    gap: 14px;
    padding-right: 16px;
    overflow: visible;
    position: relative;
    z-index: 70;
  }

  [data-admin-v2="true"] .topbar-left,
  [data-admin-v2="true"] .topbar-title,
  [data-admin-v2="true"] .top-actions {
    min-width: 0;
  }

  [data-admin-v2="true"] .top-actions {
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 8px;
    overflow: visible;
  }

  @media (max-width: 1100px) {
    [data-admin-v2="true"] .sidebar[data-open="false"] {
      visibility: hidden;
      pointer-events: none;
      transform: translateX(calc(-100% - 24px));
    }

    [data-admin-v2="true"] .sidebar[data-open="true"],
    [data-admin-v2="true"].sidebar-open .sidebar {
      visibility: visible;
      pointer-events: auto;
    }

    [data-admin-v2="true"] .mobile-menu {
      z-index: 126;
      pointer-events: auto;
    }
  }

  [data-admin-v2="true"] .top-search-wrap {
    flex: 1 1 260px;
    min-width: 230px;
    max-width: 360px;
    position: relative;
    z-index: 90;
  }

  [data-admin-v2="true"] .search {
    width: 100%;
    min-width: 0;
  }

  [data-admin-v2="true"] .top-search-wrap .smart-search-results {
    width: min(420px, 92vw);
    max-height: min(420px, 64vh);
    overflow: auto;
  }

  [data-admin-v2="true"] .top-search-wrap .smart-search-option {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    text-align: left;
  }

  [data-admin-v2="true"] .top-search-wrap .smart-search-option .console-action-glyph {
    width: 22px;
    height: 22px;
  }

  [data-admin-v2="true"] .top-filter-group,
  [data-admin-v2="true"] .quick-action-group {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
  }

  [data-admin-v2="true"] .profile-menu {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 142px;
  }

  [data-admin-v2="true"] .profile-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .top-actions > .theme-btn.btn {
    position: relative !important;
    inset: auto !important;
    display: inline-grid;
    flex: 0 0 42px;
    order: 8;
    width: 42px;
    min-width: 42px;
    height: 42px;
    min-height: 42px;
    margin: 0;
    padding: 0;
    place-items: center;
    align-self: center;
    overflow: hidden;
    isolation: isolate;
  }

  [data-admin-v2="true"] .top-actions > .theme-btn.btn::before {
    content: "";
    position: absolute;
    inset: -45% -135%;
    z-index: 0;
    border-radius: 999px;
    opacity: 0;
    transform: translateX(-72%) rotate(18deg);
    background:
      linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, .5) 48%, transparent 100%),
      linear-gradient(90deg, transparent 0%, rgba(183, 255, 60, .44) 50%, transparent 100%);
    pointer-events: none;
  }

  [data-admin-v2="true"] .top-actions > .theme-btn.btn::after {
    content: "";
    position: absolute;
    inset: 6px;
    z-index: 0;
    border-radius: 999px;
    border: 1px solid rgba(183, 255, 60, .18);
    background:
      radial-gradient(circle at 38% 36%, rgba(183, 255, 60, .18), transparent 58%),
      radial-gradient(circle at 66% 64%, rgba(51, 245, 197, .11), transparent 60%);
    opacity: .58;
    transition: opacity var(--fast) var(--ease), transform var(--fast) var(--ease);
  }

  [data-admin-v2="true"] .top-actions > .theme-btn.btn svg {
    position: relative;
    z-index: 1;
    width: 20px;
    height: 20px;
    transition: transform var(--base) var(--ease), filter var(--base) var(--ease);
  }

  [data-admin-v2="true"] .top-actions > .theme-btn.btn.is-transitioning svg,
  [data-admin-v2="true"] .top-actions > .theme-btn.btn[data-theme-sweep="active"] svg {
    animation: admin-v2-theme-icon-pop 420ms var(--ease);
    filter: drop-shadow(0 0 11px rgba(183, 255, 60, .38));
  }

  @keyframes admin-v2-theme-icon-pop {
    0% {
      transform: scale(.88) rotate(-8deg);
    }
    45% {
      transform: scale(1.16) rotate(10deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  @supports (view-transition-name: root) {
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }

    ::view-transition-old(root) {
      z-index: 0;
    }

    ::view-transition-new(root) {
      z-index: 1;
    }
  }

  [data-admin-v2="true"] .console-command-pill,
  [data-admin-v2="true"] .console-command-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  [data-admin-v2="true"] .console-action-glyph {
    display: inline-grid;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    place-items: center;
    color: currentColor;
  }

  [data-admin-v2="true"] .console-action-glyph svg {
    display: block;
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }

  [data-admin-v2="true"] .console-icon-action {
    display: inline-grid !important;
    width: 42px;
    min-width: 42px;
    max-width: none !important;
    height: 42px;
    min-height: 42px;
    padding: 0 !important;
    place-items: center;
  }

  [data-admin-v2="true"] .radial-card .console-icon-action {
    max-width: none !important;
    overflow: hidden;
  }

  [data-admin-v2="true"] .top-actions > .logout-action {
    position: static !important;
    inset: auto !important;
    flex: 0 0 auto;
    order: 9;
    min-height: 42px;
    margin: 0;
    align-self: center;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .dashboard-console {
    width: 100%;
    overflow: visible;
  }

  [data-admin-v2="true"] .v2-search-panel,
  [data-admin-v2="true"] .v2-search-panel .smart-search,
  [data-admin-v2="true"] .v2-sites-table-card,
  [data-admin-v2="true"] .v2-sites-search,
  [data-admin-v2="true"] [data-smart-search-wrap] {
    position: relative;
    overflow: visible !important;
  }

  [data-admin-v2="true"] .v2-search-panel {
    z-index: 32;
  }

  [data-admin-v2="true"] .v2-sites-table-card,
  [data-admin-v2="true"] .v2-sites-search,
  [data-admin-v2="true"] [data-smart-search-wrap] {
    z-index: 36;
  }

  [data-admin-v2="true"] .smart-search-results {
    z-index: 180;
  }

  [data-admin-v2="true"] .dashboard-grid {
    min-width: 0;
    align-items: start;
    grid-auto-flow: row;
  }

  [data-admin-v2="true"] .dashboard-grid > * {
    align-self: start;
  }

  [data-admin-v2="true"] .dashboard-wallet,
  [data-admin-v2="true"] .console-hero {
    min-height: 0;
  }

  [data-admin-v2="true"] .dashboard-wallet {
    align-content: start;
    gap: 18px;
  }

  [data-admin-v2="true"] .dashboard-wallet h2 {
    font-size: clamp(2rem, 3.2vw, 2.7rem);
    max-width: 10ch;
  }

  [data-admin-v2="true"] .dashboard-wallet .balance {
    margin-top: 18px;
  }

  [data-admin-v2="true"] .dashboard-wallet .balance strong {
    font-size: clamp(2.2rem, 4vw, 3.4rem);
  }

  [data-admin-v2="true"] .dashboard-wallet .finance-actions,
  [data-admin-v2="true"] .dashboard-wallet .finance-ledger {
    margin-top: 16px;
  }

  [data-admin-v2="true"] .dashboard-wallet .finance-card {
    min-height: 64px;
    padding: 12px 14px;
    border-radius: 16px;
  }

  [data-admin-v2="true"] .dashboard-wallet .finance-card strong {
    font-size: 18px;
  }

  @media (min-width: 1181px) {
    [data-admin-v2="true"] .dashboard-wallet {
      grid-column: span 4;
    }

    [data-admin-v2="true"] .dashboard-primary {
      grid-column: span 5;
    }

    [data-admin-v2="true"] .dashboard-right {
      grid-column: span 3;
    }

    [data-admin-v2="true"] .dashboard-table {
      grid-column: span 8;
    }

    [data-admin-v2="true"] .dashboard-activity {
      grid-column: span 4;
    }
  }

  [data-admin-v2="true"] .dashboard-right,
  [data-admin-v2="true"] .risk-stack {
    min-width: 0;
  }

  [data-admin-v2="true"] .dashboard-right.risk-stack {
    grid-template-columns: minmax(0, 1fr) !important;
    align-content: start;
  }

  [data-admin-v2="true"] .dashboard-right .radial-card {
    min-height: 0;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] {
    gap: 12px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-card {
    gap: 10px;
    padding: 13px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-card-body {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 10px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-ring {
    width: 76px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-ring strong {
    font-size: 21px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-copy > strong {
    font-size: 15px;
  }

  [data-admin-v2="true"] .dashboard-right[data-gauge-density="expanded"] .score-copy > span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-size: 11px;
    line-height: 1.3;
  }

  [data-admin-v2="true"] .radial-card {
    padding: 16px;
  }

  [data-admin-v2="true"] .score-card {
    display: grid;
    gap: 14px;
    border-color: rgba(183, 255, 60, .18);
    background:
      radial-gradient(circle at 86% 14%, rgba(183, 255, 60, .11), transparent 34%),
      linear-gradient(180deg, rgba(16, 39, 25, .92), rgba(6, 17, 11, .97));
  }

  [data-admin-v2="true"] .score-card[data-score-tone="cyan"] {
    border-color: rgba(51, 245, 197, .24);
  }

  [data-admin-v2="true"] .score-card[data-score-tone="warning"] {
    border-color: rgba(247, 201, 72, .26);
  }

  [data-admin-v2="true"] .score-card[data-score-tone="danger"] {
    border-color: rgba(255, 90, 95, .3);
  }

  [data-admin-v2="true"] .radial-card-head {
    align-items: flex-start;
  }

  [data-admin-v2="true"] .radial-card-head > div {
    flex: 1 1 auto;
    min-width: 0;
  }

  [data-admin-v2="true"] .radial-card .console-pill {
    flex: 0 0 auto;
    max-width: 128px;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .radial-card h3 {
    margin: 4px 0 0;
    line-height: 1.16;
    word-break: normal;
  }

  [data-admin-v2="true"] .radial-body {
    display: grid;
    grid-template-columns: minmax(92px, 108px) minmax(0, 1fr);
    align-items: center;
    gap: 14px;
    margin-top: 18px;
    min-height: 0;
  }

  [data-admin-v2="true"] .radial-orb {
    width: 108px;
  }

  [data-admin-v2="true"] .radial-orb::before {
    width: 78px;
    height: 78px;
  }

  [data-admin-v2="true"] .radial-value {
    width: 74px;
    min-height: 74px;
    font-size: 22px;
  }

  [data-admin-v2="true"] .score-card-body {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    align-items: center;
    gap: 15px;
    min-width: 0;
  }

  [data-admin-v2="true"] .score-ring {
    --value: 0;
    position: relative;
    width: 92px;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background:
      radial-gradient(circle, rgba(5, 18, 11, .98) 0 57%, transparent 58%),
      conic-gradient(
        from -90deg,
        var(--score-tone, var(--dash-accent)) calc(var(--value) * 1%),
        rgba(183, 255, 60, .12) 0 100%
      );
    box-shadow:
      0 0 28px rgba(183, 255, 60, .14),
      inset 0 0 0 1px rgba(255, 255, 255, .05);
    overflow: hidden;
  }

  [data-admin-v2="true"] .score-ring::after {
    content: "";
    position: absolute;
    inset: 13px;
    border-radius: inherit;
    border: 1px solid rgba(183, 255, 60, .14);
    background:
      radial-gradient(circle at 50% 0%, rgba(183, 255, 60, .12), transparent 56%),
      rgba(4, 14, 8, .96);
  }

  [data-admin-v2="true"] .score-ring strong {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: baseline;
    gap: 1px;
    color: var(--console-text);
    font: 900 26px/1 var(--font-mono);
    letter-spacing: 0;
  }

  [data-admin-v2="true"] .score-ring span {
    color: var(--score-tone, var(--dash-accent));
    font-size: 13px;
  }

  [data-admin-v2="true"] .score-copy {
    display: grid;
    gap: 7px;
    min-width: 0;
  }

  [data-admin-v2="true"] .score-copy > strong {
    color: var(--console-text);
    font-size: 18px;
    line-height: 1.12;
  }

  [data-admin-v2="true"] .score-copy > span {
    color: var(--console-muted);
    font-size: 12px;
    line-height: 1.35;
  }

  [data-admin-v2="true"] .score-progress {
    height: 8px;
    border-radius: 999px;
    background: rgba(183, 255, 60, .10);
    overflow: hidden;
    box-shadow: inset 0 0 0 1px rgba(183, 255, 60, .08);
  }

  [data-admin-v2="true"] .score-progress i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--score-tone, var(--dash-accent)), var(--dash-accent-cyan));
    box-shadow: 0 0 18px rgba(183, 255, 60, .28);
  }

  [data-admin-v2="true"] .radial-card {
    min-width: 0;
    overflow: hidden;
  }

  [data-admin-v2="true"] .radial-card h3,
  [data-admin-v2="true"] .radial-card small,
  [data-admin-v2="true"] .radial-card .console-pill {
    overflow-wrap: anywhere;
  }

  @media (min-width: 1181px) and (max-width: 1500px) {
    [data-admin-v2="true"] .topbar {
      grid-template-columns: minmax(230px, .62fr) minmax(0, 1.38fr);
    }

    [data-admin-v2="true"] .top-search-wrap {
      max-width: 300px;
      min-width: 210px;
    }

    [data-admin-v2="true"] .top-filter-group .btn,
    [data-admin-v2="true"] .quick-action-group .btn,
    [data-admin-v2="true"] .profile-menu,
    [data-admin-v2="true"] .logout-action {
      padding-inline: 11px;
    }

    [data-admin-v2="true"] .dashboard-right {
      gap: 12px;
    }

    [data-admin-v2="true"] .radial-body {
      min-height: 0;
    }

    [data-admin-v2="true"] .radial-orb {
      width: min(104px, 78%);
    }

    [data-admin-v2="true"] .score-card-body {
      grid-template-columns: 84px minmax(0, 1fr);
      gap: 12px;
    }

    [data-admin-v2="true"] .score-ring {
      width: 84px;
    }

    [data-admin-v2="true"] .score-copy > strong {
      font-size: 16px;
    }
  }

  @media (min-width: 1181px) and (max-width: 1599px) {
    [data-admin-v2="true"] .dashboard-wallet {
      grid-column: span 3;
      gap: 14px;
    }

    [data-admin-v2="true"] .dashboard-primary {
      grid-column: span 6;
      gap: 12px;
    }

    [data-admin-v2="true"] .dashboard-right.risk-stack {
      grid-column: span 3;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 12px;
    }

    [data-admin-v2="true"] .dashboard-wallet h2 {
      max-width: 100%;
      font-size: 36px;
      line-height: 1.05;
    }

    [data-admin-v2="true"] .dashboard-wallet p {
      line-height: 1.45;
    }

    [data-admin-v2="true"] .dashboard-wallet .balance,
    [data-admin-v2="true"] .dashboard-wallet .finance-actions,
    [data-admin-v2="true"] .dashboard-wallet .finance-ledger {
      margin-top: 12px;
    }

    [data-admin-v2="true"] .dashboard-wallet .finance-ledger {
      gap: 8px;
    }

    [data-admin-v2="true"] .dashboard-wallet .finance-card {
      min-height: 58px;
      padding: 10px 12px;
    }

    [data-admin-v2="true"] .kpi-row {
      gap: 10px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini {
      min-height: 118px;
      padding: 12px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini strong {
      font-size: 22px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini svg {
      height: 38px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini small,
    [data-admin-v2="true"] .kpi-row .console-mini .kpi-meta {
      font-size: 10px;
      line-height: 1.22;
    }

    [data-admin-v2="true"] .main-activity-chart {
      padding: 16px;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head {
      min-height: 0;
      gap: 10px;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head > div:first-child {
      max-width: 270px;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head h3 {
      font-size: 17px;
      line-height: 1.2;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head p,
    [data-admin-v2="true"] .main-activity-chart .chart-summary {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-filter-group {
      max-width: 100%;
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-filter-group::-webkit-scrollbar {
      display: none;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-viewport {
      height: clamp(214px, 16vw, 244px);
      min-height: 0;
      margin-top: 10px;
    }

    [data-admin-v2="true"] .main-activity-chart .activity-chart-svg {
      height: 100%;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-foot {
      gap: 8px;
      margin-top: 10px;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-foot-item {
      min-height: 54px;
      padding: 8px 9px;
    }

    [data-admin-v2="true"] .dashboard-right .radial-card {
      padding: 14px;
      gap: 10px;
    }

    [data-admin-v2="true"] .dashboard-right .score-card-body {
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 10px;
    }

    [data-admin-v2="true"] .dashboard-right .score-ring {
      width: 72px;
    }

    [data-admin-v2="true"] .dashboard-right .score-ring strong {
      font-size: 20px;
    }

    [data-admin-v2="true"] .dashboard-right .score-copy > strong {
      font-size: 14px;
    }

    [data-admin-v2="true"] .dashboard-right .score-copy > span {
      font-size: 11px;
      line-height: 1.3;
    }

    [data-admin-v2="true"] .dashboard-right .radial-card h3 {
      font-size: 15px;
    }

    [data-admin-v2="true"] .dashboard-right .radial-card .console-pill {
      max-width: 104px;
      min-height: 27px;
      padding-inline: 9px;
    }

    [data-admin-v2="true"] .dashboard-table {
      grid-column: span 8;
    }

    [data-admin-v2="true"] .dashboard-activity {
      grid-column: span 4;
    }
  }

  @media (max-width: 1320px) {
    [data-admin-v2="true"] .topbar {
      grid-template-columns: 1fr;
      align-items: start;
    }

    [data-admin-v2="true"] .top-actions {
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    [data-admin-v2="true"] .top-search-wrap {
      flex: 1 1 320px;
      max-width: none;
    }
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] {
    background:
      radial-gradient(circle at 46% 0%, rgba(183, 255, 60, .13), transparent 30%),
      radial-gradient(circle at 94% 16%, rgba(51, 245, 197, .09), transparent 28%),
      linear-gradient(180deg, #06110b 0%, #08120d 100%) !important;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 20px;
    align-items: start;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid,
  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .kpi-row,
  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .console-card {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid {
    display: grid;
    gap: 20px;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  [data-admin-v2="true"] .v2-settings-security-grid .finance-card {
    grid-template-columns: 1fr;
    align-content: start;
    justify-items: start;
    gap: 8px;
    min-height: 92px;
  }

  [data-admin-v2="true"] .v2-settings-security-grid .finance-card small,
  [data-admin-v2="true"] .v2-settings-security-grid .finance-card strong {
    max-width: 100%;
    text-align: left;
    white-space: normal;
  }

  [data-admin-v2="true"] .v2-settings-security-grid .finance-card strong {
    font-size: 16px;
    line-height: 1.22;
  }

  @media (max-width: 1180px) {
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-3,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-2,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-3,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .dashboard-console > .dashboard-grid > .grid-4 {
      grid-template-columns: 1fr;
    }
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table {
    width: 100%;
    min-width: 780px;
    border-collapse: collapse;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] th {
    background: rgba(10, 23, 16, .96) !important;
    color: rgba(244, 255, 233, .68) !important;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] td {
    color: rgba(244, 255, 233, .88) !important;
  }

  @media (max-width: 900px) {
    [data-admin-v2="true"] .dashboard-console > .console-tabs,
    [data-admin-v2="true"] .console-chrome .console-tabs,
    [data-admin-v2="true"] .console-chart-head .console-tabs {
      flex-wrap: wrap;
      overflow-x: visible;
    }

    [data-admin-v2="true"] .dashboard-console > .console-tabs .console-pill,
    [data-admin-v2="true"] .console-chrome .console-tabs .console-pill,
    [data-admin-v2="true"] .console-chart-head .console-tabs .console-pill {
      flex: 0 1 auto;
      min-width: 0;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table-wrap,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap {
      max-height: none !important;
      overflow: visible !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table {
      display: block !important;
      width: 100%;
      min-width: 0 !important;
      table-layout: auto !important;
      border-collapse: separate !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table thead,
    [data-admin-v2="true"] .dashboard-table .admin-table colgroup,
    [data-admin-v2="true"] .dashboard-table .admin-table col,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table thead,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table colgroup,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table col,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table thead,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table colgroup,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table col {
      display: none !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody {
      display: grid !important;
      gap: 10px;
      padding: 10px !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody tr,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody tr,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody tr {
      display: grid !important;
      gap: 9px;
      min-width: 0;
      padding: 12px !important;
      border: 1px solid rgba(183, 255, 60, .14) !important;
      border-radius: 16px !important;
      background: rgba(4, 12, 7, .68) !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td {
      display: grid !important;
      grid-template-columns: minmax(96px, .36fr) minmax(0, 1fr) !important;
      align-items: start;
      gap: 8px;
      width: 100% !important;
      min-width: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td::before {
      content: attr(data-label);
      display: block;
      color: var(--console-muted);
      font: 900 10px/1.2 var(--font-mono);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:not([data-label]),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td[colspan],
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td:not([data-label]),
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td[colspan],
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td:not([data-label]),
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td[colspan] {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:not([data-label])::before,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td[colspan]::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td:not([data-label])::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td[colspan]::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td:not([data-label])::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td[colspan]::before {
      display: none;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td.row-actions,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:last-child,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td:last-child,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td:last-child {
      grid-template-columns: 1fr !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td.row-actions::before,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:last-child::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .table-wrap table tbody td:last-child::before,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] .admin-table-wrap table tbody td:last-child::before {
      margin-bottom: 2px;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table .person,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table .person {
      grid-template-columns: 38px minmax(0, 1fr);
      min-width: 0;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table .row-actions,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      width: 100%;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td > .btn,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td > button,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td > a,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table tbody td > .btn,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table tbody td > button,
    [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] table tbody td > a {
      max-width: 100%;
      justify-content: center;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] [class*="compactField"],
  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] [class*="adminFormGrid"] label {
    border: 1px solid rgba(183, 255, 60, .13) !important;
    border-radius: 16px !important;
    background: rgba(4, 12, 7, .78) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035) !important;
  }

  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] input,
  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] select,
  [data-admin-v2="true"] [data-admin-version="v2"][data-admin-v2-module-view="true"] textarea {
    border-color: rgba(183, 255, 60, .18) !important;
    background: rgba(3, 10, 6, .78) !important;
    color: var(--console-text) !important;
  }

  [data-admin-v2="true"] .dashboard-map.console-card {
    background:
      radial-gradient(circle at 22% 18%, rgba(183, 255, 60, .10), transparent 34%),
      linear-gradient(180deg, rgba(16, 39, 25, .92), rgba(6, 17, 11, .96)) !important;
    color: var(--console-text);
  }

  [data-admin-v2="true"] .console-chart {
    min-height: 0;
  }

  [data-admin-v2="true"] .main-activity-chart {
    padding: 18px;
  }

  [data-admin-v2="true"] .main-activity-chart .console-chart-head {
    position: relative;
    z-index: 1;
  }

  [data-admin-v2="true"] .main-activity-chart .chart-filter-group {
    position: relative;
    z-index: 3;
    pointer-events: auto;
  }

  [data-admin-v2="true"] .main-activity-chart .chart-filter-group .console-pill {
    position: relative;
    z-index: 4;
    pointer-events: auto;
  }

  @media (min-width: 901px) {
    [data-admin-v2="true"] .main-activity-chart .chart-filter-group {
      overflow: visible !important;
    }
  }

  [data-admin-v2="true"] .main-activity-chart .chart-viewport {
    margin-top: 12px;
  }

  [data-admin-v2="true"] .main-activity-chart .activity-chart-svg {
    height: 238px;
  }

  [data-admin-v2="true"] .main-activity-chart .chart-summary {
    margin-top: 10px;
  }

  [data-admin-v2="true"] .main-activity-chart .console-chart-foot {
    gap: 10px;
  }

  [data-admin-v2="true"] .main-activity-chart .chart-foot-item {
    min-height: 58px;
    padding: 10px 12px;
  }

  [data-admin-v2="true"] .dashboard-table,
  [data-admin-v2="true"] .dashboard-activity,
  [data-admin-v2="true"] .dashboard-map,
  [data-admin-v2="true"] .dashboard-admin-addon {
    min-height: 0;
  }

  [data-admin-v2="true"] .dashboard-table {
    padding: 18px;
    align-self: start;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table-shell {
    margin-top: 12px;
    gap: 10px;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table-wrap {
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table {
    display: table !important;
    min-width: 760px !important;
    width: 100%;
    table-layout: fixed !important;
    border-collapse: collapse !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table thead {
    display: table-header-group !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table tbody {
    display: table-row-group !important;
    padding: 0 !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table tbody tr {
    display: table-row !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table td,
  [data-admin-v2="true"] .dashboard-table .admin-table th {
    display: table-cell !important;
    position: static !important;
    width: auto !important;
    padding: 10px 12px !important;
    border-bottom: 1px solid rgba(183, 255, 60, .10) !important;
    vertical-align: middle !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table td::before,
  [data-admin-v2="true"] .dashboard-table .admin-table th::before {
    display: none !important;
  }

  [data-admin-v2="true"] .dashboard-table .table-toolbar {
    grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(112px, .58fr)) auto;
    gap: 10px;
  }

  [data-admin-v2="true"] .dashboard-table th,
  [data-admin-v2="true"] .dashboard-table td {
    padding: 10px 12px;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(1),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(1) {
    width: 35% !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(2),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(2) {
    width: 16% !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(3),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(3) {
    width: 14% !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(4),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(4),
  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(5),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(5) {
    width: 10% !important;
  }

  [data-admin-v2="true"] .dashboard-table .admin-table th:nth-child(6),
  [data-admin-v2="true"] .dashboard-table .admin-table td:nth-child(6) {
    width: 15% !important;
  }

  [data-admin-v2="true"] .dashboard-table .avatar {
    width: 32px;
    height: 32px;
  }

  [data-admin-v2="true"] .dashboard-table .person {
    gap: 10px;
    min-width: 0;
  }

  [data-admin-v2="true"] .dashboard-table .person > div {
    min-width: 0;
  }

  [data-admin-v2="true"] .dashboard-table .person strong {
    display: block;
    font-size: 13px;
    line-height: 1.15;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .dashboard-table .person small {
    display: block;
    font-size: 11px;
    line-height: 1.25;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .dashboard-table .admin-pagination {
    margin-top: 10px;
  }

  [data-admin-v2="true"] .dashboard-activity {
    padding: 18px;
    align-self: start;
    gap: 12px;
    max-height: 540px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(183, 255, 60, .32) rgba(4, 12, 7, .45);
  }

  [data-admin-v2="true"] .dashboard-activity::-webkit-scrollbar {
    width: 8px;
  }

  [data-admin-v2="true"] .dashboard-activity::-webkit-scrollbar-track {
    background: rgba(4, 12, 7, .45);
    border-radius: 999px;
  }

  [data-admin-v2="true"] .dashboard-activity::-webkit-scrollbar-thumb {
    background: rgba(183, 255, 60, .32);
    border-radius: 999px;
  }

  [data-admin-v2="true"] .dashboard-activity .insight-card {
    padding: 13px;
    gap: 10px;
  }

  [data-admin-v2="true"] .dashboard-activity .insight-card p {
    margin: 0;
    line-height: 1.38;
  }

  [data-admin-v2="true"] .dashboard-activity .signal-row,
  [data-admin-v2="true"] .dashboard-activity .source-row {
    padding: 8px 10px;
    border-radius: 12px;
  }

  [data-admin-v2="true"] .dashboard-activity .console-progress {
    height: 5px;
    margin-top: 5px;
  }

  [data-admin-v2="true"] .dashboard-map {
    padding: 18px;
  }

  [data-admin-v2="true"] .dashboard-map .audience-map-canvas {
    min-height: 360px;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table-card {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    align-self: start;
    max-height: clamp(340px, 42vh, 420px);
    overflow: hidden;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table-wrap {
    min-height: 0;
    max-height: clamp(260px, 34vh, 334px);
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(183, 255, 60, .32) rgba(4, 12, 7, .45);
  }

  [data-admin-v2="true"] .dashboard-map .audience-table-wrap::-webkit-scrollbar {
    width: 8px;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table-wrap::-webkit-scrollbar-track {
    background: rgba(4, 12, 7, .45);
    border-radius: 999px;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table-wrap::-webkit-scrollbar-thumb {
    background: rgba(183, 255, 60, .32);
    border-radius: 999px;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table {
    width: 100%;
    border-collapse: collapse;
  }

  [data-admin-v2="true"] .dashboard-map .audience-table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: rgba(9, 20, 13, .96);
    box-shadow: 0 1px 0 rgba(183, 255, 60, .13);
  }

  [data-admin-v2="true"] .dashboard-map .audience-table th,
  [data-admin-v2="true"] .dashboard-map .audience-table td {
    padding: 10px 14px;
  }

  @media (min-width: 1021px) {
    [data-admin-v2="true"] .audience-map-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(270px, 330px);
      align-items: start;
      gap: 14px;
    }

    [data-admin-v2="true"] .audience-map-canvas {
      height: clamp(360px, 30vw, 430px);
      min-height: 360px !important;
    }

    [data-admin-v2="true"] .audience-detail {
      max-height: 430px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(183, 255, 60, .32) rgba(4, 12, 7, .45);
    }

    [data-admin-v2="true"] .audience-table-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      max-height: clamp(340px, 42vh, 420px);
      overflow: hidden;
    }
  }

  [data-admin-v2="true"] .dashboard-admin-addon {
    padding: 18px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .admin-addon-shell {
    gap: 14px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-header h3 {
    font-size: clamp(1.35rem, 2vw, 1.9rem);
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-module-grid {
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-panel {
    min-height: 0;
    padding: 12px 14px;
    border-radius: 16px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-module-shortcut {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-height: 104px;
    text-align: left;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-shortcut-icon {
    display: inline-grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid rgba(183, 255, 60, .28);
    border-radius: 14px;
    color: var(--accent);
    background:
      radial-gradient(circle at 30% 22%, rgba(183, 255, 60, .28), transparent 54%),
      rgba(183, 255, 60, .08);
    box-shadow:
      0 12px 24px rgba(0, 0, 0, .16),
      inset 0 1px 0 rgba(255, 255, 255, .1);
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-shortcut-icon svg {
    width: 24px;
    height: 24px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-shortcut-copy {
    min-width: 0;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-panel-head {
    margin-bottom: 8px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-panel h4 {
    font-size: 14px;
    line-height: 1.25;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-mini-list {
    gap: 7px;
  }

  [data-admin-v2="true"] .dashboard-admin-addon .addon-mini-row {
    padding: 8px 10px;
    border-radius: 12px;
  }

  [data-admin-v2="true"] .audience-map-layout,
  [data-admin-v2="true"] .audience-map-layout > div {
    min-width: 0;
  }

  [data-admin-v2="true"] .audience-map-canvas {
    background:
      radial-gradient(circle at 28% 34%, rgba(183,255,60,.22), transparent 24%),
      radial-gradient(circle at 64% 48%, rgba(51,245,197,.16), transparent 28%),
      linear-gradient(90deg, rgba(183,255,60,.12) 1px, transparent 1px),
      linear-gradient(180deg, rgba(183,255,60,.12) 1px, transparent 1px),
      #0a1710 !important;
    background-size: auto, auto, 44px 44px, 44px 44px, auto !important;
  }

  [data-admin-v2="true"] .audience-leaflet-map,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-container,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-tile {
    background: #0a1710 !important;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: grab;
    font: inherit;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-dragging .leaflet-container,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-dragging .leaflet-interactive {
    cursor: grabbing;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-pane,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-map-pane,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-tile,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-marker-icon,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-marker-shadow,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-tile-container,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-pane > svg,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-pane > canvas,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-zoom-box,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-image-layer,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-layer {
    position: absolute;
    top: 0;
    left: 0;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-tile {
    width: 256px !important;
    height: 256px !important;
    max-width: none !important;
    max-height: none !important;
    user-select: none;
    visibility: inherit;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-marker-icon,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-marker-shadow {
    display: block;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-interactive {
    cursor: pointer;
    filter: drop-shadow(0 0 7px rgba(183, 255, 60, .58));
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-pane > svg,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-pane > canvas {
    max-width: none !important;
    max-height: none !important;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-tile-pane {
    z-index: 200;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-overlay-pane {
    z-index: 400;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-shadow-pane {
    z-index: 500;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-marker-pane {
    z-index: 600;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-tooltip-pane {
    z-index: 650;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-container {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-container .leaflet-top,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-container .leaflet-bottom {
    position: absolute;
    z-index: 800;
    pointer-events: none;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-top {
    top: 16px;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-right {
    right: 16px;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-bottom {
    bottom: 12px;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control {
    position: relative;
    z-index: 800;
    clear: both;
    pointer-events: auto;
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-tooltip {
    position: absolute;
    pointer-events: none;
    white-space: nowrap;
  }

  [data-admin-v2="true"][data-od-theme="dark"] .audience-map-canvas .leaflet-tile-pane {
    opacity: .86;
    filter: grayscale(.32) sepia(.42) hue-rotate(50deg) saturate(1.18) brightness(.72) contrast(.98);
  }

  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas .leaflet-tile-pane {
    opacity: 1;
    filter: saturate(.9) contrast(1.02) brightness(1.01);
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-zoom {
    border: 1px solid rgba(183, 255, 60, .18);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 14px 32px rgba(0, 0, 0, .30);
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-zoom a {
    width: 40px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-bottom: 1px solid rgba(183, 255, 60, .12);
    background: rgba(4, 12, 7, .94) !important;
    color: var(--console-text) !important;
    font: 900 18px/1 var(--font-mono);
  }

  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-zoom a:hover,
  [data-admin-v2="true"] .audience-map-canvas .leaflet-control-zoom a:focus-visible {
    background: rgba(183, 255, 60, .16) !important;
    color: var(--dash-accent) !important;
  }

  [data-admin-v2="true"] button.step-chip {
    font: 750 var(--text-xs)/1.2 var(--font-body);
    text-align: left;
  }

  [data-admin-v2="true"] .v2-creator-page {
    display: grid;
    gap: 16px;
  }

  [data-admin-v2="true"] .v2-creator-page .split {
    grid-template-columns: minmax(0, 1.36fr) minmax(320px, .74fr);
    gap: clamp(16px, 1.6vw, 22px);
    align-items: stretch;
  }

  @media (max-width: 1180px) {
    [data-admin-v2="true"] .v2-creator-page .split {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  [data-admin-v2="true"] .v2-creator-page .panel {
    align-self: start;
    min-width: 0;
  }

  [data-admin-v2="true"] .v2-creator-page .section-head {
    margin-bottom: var(--space-3);
  }

  [data-admin-v2="true"] .v2-creator-page .steps {
    gap: 10px;
    margin-bottom: var(--space-4);
  }

  [data-admin-v2="true"] .v2-creator-page .field-row {
    min-width: 0;
  }

  [data-admin-v2="true"] .v2-creator-page .grid {
    gap: var(--space-4);
  }

  [data-admin-v2="true"] .v2-creator-page textarea {
    min-height: 118px;
  }

  [data-admin-v2="true"] .v2-creator-page .field-row input[readonly],
  [data-admin-v2="true"] .v2-creator-page .field-row textarea[readonly] {
    opacity: .82;
    cursor: pointer;
  }

  [data-admin-v2="true"] .v2-creator-step-card {
    min-height: 172px;
    display: grid;
    align-content: center;
    gap: var(--space-3);
  }

  [data-admin-v2="true"] .v2-creator-step-card h3,
  [data-admin-v2="true"] .v2-creator-step-card p {
    margin: 0;
  }

  [data-admin-v2="true"] .v2-creator-step-card p {
    color: var(--muted);
  }

  [data-admin-v2="true"] .v2-creator-page .modal-actions {
    margin-top: var(--space-4);
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result {
    display: grid;
    grid-column: 1 / -1;
    gap: 12px;
    min-width: 0;
    border: 1px solid color-mix(in oklab, var(--dash-warning), transparent 68%);
    border-radius: 8px;
    padding: 14px;
    background: color-mix(in oklab, var(--dash-warning), transparent 94%);
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result[data-status="cutout_ready"] {
    border-color: color-mix(in oklab, var(--dash-accent), transparent 62%);
    background: color-mix(in oklab, var(--dash-accent), transparent 94%);
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result > div:first-child {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result strong,
  [data-admin-v2="true"] .v2-creator-page .v2-media-result span {
    overflow-wrap: anywhere;
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result span {
    color: var(--muted);
    line-height: 1.45;
  }

  [data-admin-v2="true"] .v2-creator-page .v2-media-result .modal-actions {
    margin-top: 0;
  }

  [data-admin-v2="true"] .v2-preview-card {
    display: grid;
    gap: var(--space-3);
  }

  [data-admin-v2="true"] .v2-preview-card h3,
  [data-admin-v2="true"] .v2-preview-card p {
    margin: 0;
  }

  [data-admin-v2="true"] .v2-preview-card p {
    color: var(--muted);
  }

  [data-admin-v2="true"] .v2-preview-state {
    min-height: 200px;
    margin-top: var(--space-4);
  }

  [data-admin-v2="true"] .v2-creator-footer {
    display: flex;
    justify-content: flex-end;
  }

  [data-admin-v2="true"] .v2-coach-sites-page {
    display: grid;
    gap: 18px;
    padding: clamp(16px, 1.5vw, 22px);
    border: 1px solid rgba(183, 255, 60, .18);
    border-radius: 30px;
    background:
      radial-gradient(circle at 18% 10%, rgba(183, 255, 60, .11), transparent 34%),
      radial-gradient(circle at 88% 16%, rgba(51, 245, 197, .08), transparent 32%),
      linear-gradient(180deg, rgba(13, 31, 21, .92), rgba(4, 12, 7, .97));
    box-shadow:
      0 28px 80px rgba(0, 0, 0, .38),
      inset 0 1px 0 rgba(255, 255, 255, .055);
  }

  [data-admin-v2="true"] .v2-coach-sites-page .console-chrome {
    min-height: 0;
    align-items: flex-start;
    border-color: rgba(183, 255, 60, .15);
    background:
      linear-gradient(135deg, rgba(183, 255, 60, .08), transparent 42%),
      rgba(4, 12, 7, .62);
  }

  [data-admin-v2="true"] .v2-coach-sites-page .console-chrome h2 {
    margin: 4px 0 8px;
    font-size: clamp(1.55rem, 1.1rem + 1.1vw, 2.35rem);
    line-height: 1;
  }

  [data-admin-v2="true"] .v2-coach-sites-page .console-chrome p,
  [data-admin-v2="true"] .v2-sites-table-card .section-head p,
  [data-admin-v2="true"] .v2-sites-focus .section-head p {
    max-width: 68ch;
    color: color-mix(in oklab, var(--console-muted), white 4%);
    line-height: 1.45;
  }

  [data-admin-v2="true"] .v2-sites-kpis {
    display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  [data-admin-v2="true"] .v2-sites-kpis .console-mini {
    min-height: 126px;
  }

  [data-admin-v2="true"] .v2-sites-focus,
  [data-admin-v2="true"] .v2-sites-table-card {
    overflow: visible;
    border-color: rgba(183, 255, 60, .17);
    background:
      radial-gradient(circle at 14% 0%, rgba(183, 255, 60, .08), transparent 36%),
      linear-gradient(180deg, rgba(12, 29, 19, .88), rgba(3, 10, 6, .96));
  }

  [data-admin-v2="true"] .v2-sites-focus-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  [data-admin-v2="true"] .v2-sites-focus-grid .finance-card {
    min-height: 96px;
    background: rgba(4, 12, 7, .7);
  }

  [data-admin-v2="true"] .v2-sites-tabs,
  [data-admin-v2="true"] .v2-sites-type-tabs {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  [data-admin-v2="true"] .v2-sites-tabs::-webkit-scrollbar,
  [data-admin-v2="true"] .v2-sites-type-tabs::-webkit-scrollbar {
    display: none;
  }

  [data-admin-v2="true"] .v2-sites-filters {
    position: relative;
    z-index: 92;
    display: grid;
    grid-template-columns: minmax(260px, 1fr) auto minmax(160px, 210px) auto;
    align-items: end;
    gap: 12px;
    margin: 18px 0;
    overflow: visible;
  }

  [data-admin-v2="true"] .v2-sites-search {
    position: relative;
    z-index: 96;
    min-width: 0;
  }

  [data-admin-v2="true"] #v2-coach-sites-suggestions {
    z-index: 460 !important;
  }

  [data-admin-v2="true"] .v2-sites-search label {
    display: block;
    margin: 0 0 8px;
    color: var(--console-muted);
    font: 900 .7rem/1 var(--font-mono);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-sites-filters input,
  [data-admin-v2="true"] .v2-sites-filters select {
    width: 100%;
    min-height: 46px;
    border: 1px solid rgba(183, 255, 60, .17);
    border-radius: 16px;
    padding: 0 14px;
    color: var(--console-text);
    background: rgba(3, 10, 6, .76);
    font: inherit;
  }

  [data-admin-v2="true"] .v2-sites-filters input:focus,
  [data-admin-v2="true"] .v2-sites-filters select:focus {
    border-color: rgba(183, 255, 60, .38);
    outline: none;
    box-shadow: 0 0 0 3px rgba(183, 255, 60, .1);
  }

  [data-admin-v2="true"] .v2-sites-table-wrap {
    overflow: auto;
    border: 1px solid rgba(183, 255, 60, .14);
    border-radius: 22px;
    background:
      linear-gradient(180deg, rgba(3, 10, 6, .82), rgba(5, 14, 9, .92));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035);
  }

  [data-admin-v2="true"] .v2-sites-table {
    width: 100%;
    min-width: 980px !important;
    border-collapse: collapse;
    color: var(--console-text);
  }

  [data-admin-v2="true"] .v2-sites-table th,
  [data-admin-v2="true"] .v2-sites-table td {
    padding: 15px 16px;
    border-bottom: 1px solid rgba(183, 255, 60, .1);
    text-align: left;
    vertical-align: middle;
  }

  [data-admin-v2="true"] .v2-sites-table th {
    position: sticky;
    top: 0;
    z-index: 2;
    color: color-mix(in oklab, var(--console-muted), white 8%);
    background: rgba(6, 17, 11, .96);
    font: 900 .72rem/1 var(--font-mono);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-sites-table tbody tr {
    cursor: pointer;
    transition: background var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
  }

  [data-admin-v2="true"] .v2-sites-table tbody tr:hover,
  [data-admin-v2="true"] .v2-sites-table tbody tr[data-selected="true"] {
    background: rgba(183, 255, 60, .055);
  }

  [data-admin-v2="true"] .v2-sites-table tbody tr[data-selected="true"] {
    box-shadow: inset 3px 0 0 var(--dash-accent);
  }

  [data-admin-v2="true"] .v2-sites-table code {
    display: block;
    max-width: 260px;
    overflow: hidden;
    color: color-mix(in oklab, var(--console-text), var(--dash-accent-cyan) 16%);
    font-size: .76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-sites-table small {
    display: block;
    margin-top: 5px;
    color: var(--console-muted);
    font-size: .74rem;
    line-height: 1.35;
  }

  [data-admin-v2="true"] .v2-sites-table .person {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  [data-admin-v2="true"] .v2-sites-table .person strong,
  [data-admin-v2="true"] .v2-sites-table .person small {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-sites-table .avatar {
    width: 42px;
    height: 42px;
    border-radius: 16px;
    box-shadow: 0 0 22px rgba(183, 255, 60, .18);
  }

  [data-admin-v2="true"] .v2-sites-table .row-actions {
    display: flex;
    flex-wrap: nowrap;
    gap: 7px;
  }

  [data-admin-v2="true"] .v2-sites-table .btn-sm {
    min-height: 34px;
    padding: 8px 10px;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-sites-table .badge-warning {
    border-color: rgba(247, 201, 72, .34);
    color: var(--dash-warning);
    background: rgba(247, 201, 72, .09);
  }

  [data-admin-v2="true"] .v2-sites-table .badge-danger {
    border-color: rgba(255, 90, 95, .34);
    color: var(--dash-danger);
    background: rgba(255, 90, 95, .09);
  }

  [data-admin-v2="true"] .v2-sites-table-card .pagination {
    margin-top: 14px;
  }

  [data-admin-v2="true"] .v2-sites-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    color: var(--console-muted);
  }

  [data-admin-v2="true"] .v2-sites-page-actions {
    align-items: center;
    flex-wrap: wrap;
  }

  [data-admin-v2="true"] .v2-sites-page-actions .btn-sm:disabled {
    opacity: .46;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  [data-admin-v2="true"] :is(button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="option"], [tabindex]:not([tabindex="-1"])) {
    scroll-margin: 96px 24px;
  }

  @media (max-width: 900px) {
    [data-admin-v2="true"] .v2-sites-tabs,
    [data-admin-v2="true"] .v2-sites-type-tabs {
      flex-wrap: wrap;
      overflow: visible;
    }

    [data-admin-v2="true"] .v2-sites-table-wrap {
      overflow: visible;
    }

    [data-admin-v2="true"] .v2-sites-table {
      display: block;
      min-width: 0 !important;
    }

    [data-admin-v2="true"] .v2-sites-table thead {
      display: none;
    }

    [data-admin-v2="true"] .v2-sites-table tbody {
      display: grid;
      gap: 12px;
      padding: 10px;
    }

    [data-admin-v2="true"] .v2-sites-table tr {
      display: grid;
      gap: 10px;
      border: 1px solid rgba(183, 255, 60, .15);
      border-radius: 18px;
      padding: 12px;
      background: rgba(4, 12, 7, .74);
    }

    [data-admin-v2="true"] .v2-sites-table th,
    [data-admin-v2="true"] .v2-sites-table td {
      display: grid;
      grid-template-columns: minmax(82px, .36fr) minmax(0, 1fr);
      align-items: start;
      gap: 8px;
      width: 100%;
      padding: 0;
      border: 0;
      min-width: 0;
    }

    [data-admin-v2="true"] .v2-sites-table td::before {
      color: var(--console-muted);
      font: 900 .62rem/1.2 var(--font-mono);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(1)::before {
      content: "Coach";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(2)::before {
      content: "Status";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(3)::before {
      content: "Link";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(4)::before {
      content: "Performance";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(5)::before {
      content: "Updated";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(6)::before {
      content: "Actions";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(6) {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(6)::before {
      margin-bottom: 2px;
    }

    [data-admin-v2="true"] .v2-sites-table .person {
      grid-template-columns: 40px minmax(0, 1fr);
    }

    [data-admin-v2="true"] .v2-sites-table .person strong,
    [data-admin-v2="true"] .v2-sites-table .person small,
    [data-admin-v2="true"] .v2-sites-table code {
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    [data-admin-v2="true"] .v2-sites-table .row-actions {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
    }

    [data-admin-v2="true"] .v2-sites-table .row-actions .btn-sm {
      flex: 1 1 96px;
      justify-content: center;
      max-width: 100%;
    }
  }

  @media (max-width: 1120px) {
    [data-admin-v2="true"] .v2-sites-kpis,
    [data-admin-v2="true"] .v2-sites-focus-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .v2-sites-filters {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
  }

  @media (max-width: 680px) {
    [data-admin-v2="true"] .topbar {
      overflow: visible;
      gap: 12px;
      padding: 14px 16px 16px calc(16px + 42px);
    }

    [data-admin-v2="true"] .top-actions {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px 74px;
      gap: 8px;
      overflow: visible !important;
      width: 100%;
    }

    [data-admin-v2="true"] .top-search-wrap {
      grid-column: 1 / -1;
      max-width: none;
      min-width: 0;
      width: 100%;
    }

    [data-admin-v2="true"] .top-filter-group,
    [data-admin-v2="true"] .quick-action-group {
      grid-column: 1 / -1;
      display: grid;
      width: 100%;
      gap: 8px;
    }

    [data-admin-v2="true"] .top-filter-group {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .quick-action-group {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .top-filter-group .btn,
    [data-admin-v2="true"] .quick-action-group .btn {
      min-width: 0;
      width: 100%;
      min-height: 38px;
      padding-inline: 8px;
      justify-content: center;
    }

    [data-admin-v2="true"] .top-actions > .notification-btn {
      order: 6;
      grid-column: 1;
      width: 44px;
      min-width: 44px;
      justify-self: stretch;
    }

    [data-admin-v2="true"] .top-actions > .profile-menu {
      flex: none;
      width: 100%;
      order: 7;
      max-width: none;
      grid-column: 2;
    }

    [data-admin-v2="true"] .top-actions > .theme-btn.btn {
      position: static !important;
      top: auto !important;
      right: auto !important;
      flex: none;
      order: 8;
      width: 44px;
      min-width: 44px;
      height: 44px;
      min-height: 44px;
      justify-self: stretch;
      grid-column: 3;
    }

    [data-admin-v2="true"] .top-actions > .logout-action {
      flex: none;
      grid-column: 4;
      order: 10;
      width: 100%;
      min-height: 44px;
      padding-inline: 10px;
      justify-content: center;
    }

    [data-admin-v2="true"] .page-subtitle {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    [data-admin-v2="true"] .dashboard-console {
      padding: 14px;
      border-radius: 22px;
    }

    [data-admin-v2="true"] .dashboard-grid {
      gap: 12px;
      padding-top: 12px;
    }

    [data-admin-v2="true"] .console-card,
    [data-admin-v2="true"] .console-chart {
      padding: 14px;
      border-radius: 18px;
    }

    [data-admin-v2="true"] .console-chrome {
      gap: 10px;
      padding: 14px;
    }

    [data-admin-v2="true"] .dashboard-console > .console-tabs,
    [data-admin-v2="true"] .console-chrome .console-tabs,
    [data-admin-v2="true"] .console-chart-head .console-tabs {
      flex-wrap: wrap;
      overflow-x: visible;
      scrollbar-width: none;
    }

    [data-admin-v2="true"] .dashboard-wallet {
      gap: 12px;
    }

    [data-admin-v2="true"] .dashboard-wallet h2 {
      max-width: 100%;
      font-size: clamp(2rem, 10vw, 2.55rem);
    }

    [data-admin-v2="true"] .dashboard-wallet .balance,
    [data-admin-v2="true"] .dashboard-wallet .finance-actions,
    [data-admin-v2="true"] .dashboard-wallet .finance-ledger {
      margin-top: 12px;
    }

    [data-admin-v2="true"] .dashboard-wallet .finance-ledger {
      gap: 8px;
    }

    [data-admin-v2="true"] .dashboard-wallet .finance-card {
      min-height: 0;
      padding: 10px 12px;
    }

    [data-admin-v2="true"] .kpi-row {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini {
      min-height: 108px;
      padding: 12px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini small,
    [data-admin-v2="true"] .kpi-row .console-mini .kpi-meta {
      font-size: 10px;
      line-height: 1.25;
    }

    [data-admin-v2="true"] .kpi-row .console-mini strong {
      font-size: 24px;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head {
      display: grid;
      gap: 10px;
    }

    [data-admin-v2="true"] .main-activity-chart .activity-chart-svg {
      height: 210px;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-summary {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    [data-admin-v2="true"] .score-card-body {
      grid-template-columns: 76px minmax(0, 1fr);
    }

    [data-admin-v2="true"] .score-ring {
      width: 76px;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table-wrap {
      max-height: 390px;
      overflow: auto;
    }

    [data-admin-v2="true"] .dashboard-table .table-toolbar {
      grid-template-columns: 1fr !important;
    }

    [data-admin-v2="true"] .audience-map-layout {
      display: grid;
      grid-template-columns: 1fr !important;
      gap: 10px;
    }

    [data-admin-v2="true"] .dashboard-map .audience-map-canvas,
    [data-admin-v2="true"] .audience-map-canvas {
      height: 300px;
      min-height: 300px !important;
    }

    [data-admin-v2="true"] .audience-detail,
    [data-admin-v2="true"] .audience-table-card {
      max-height: 360px;
      overflow: auto;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-module-grid {
      grid-template-columns: 1fr !important;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-panel {
      padding: 10px 12px;
    }

    [data-admin-v2="true"] .v2-coach-sites-page {
      padding: 12px;
      border-radius: 24px;
    }

    [data-admin-v2="true"] .v2-sites-kpis,
    [data-admin-v2="true"] .v2-sites-focus-grid {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-sites-table {
      display: block;
      min-width: 0 !important;
    }

    [data-admin-v2="true"] .v2-sites-table thead {
      display: none;
    }

    [data-admin-v2="true"] .v2-sites-table tbody {
      display: grid;
      gap: 12px;
      padding: 10px;
    }

    [data-admin-v2="true"] .v2-sites-table tr {
      display: grid;
      gap: 10px;
      border: 1px solid rgba(183, 255, 60, .15);
      border-radius: 18px;
      padding: 12px;
      background: rgba(4, 12, 7, .74);
    }

    [data-admin-v2="true"] .v2-sites-table th,
    [data-admin-v2="true"] .v2-sites-table td {
      display: grid;
      grid-template-columns: minmax(82px, .36fr) minmax(0, 1fr);
      align-items: start;
      gap: 8px;
      width: 100%;
      padding: 0;
      border: 0;
      min-width: 0;
    }

    [data-admin-v2="true"] .v2-sites-table td::before {
      color: var(--console-muted);
      font: 900 .62rem/1.2 var(--font-mono);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(1)::before {
      content: "Coach";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(2)::before {
      content: "Status";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(3)::before {
      content: "Link";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(4)::before {
      content: "Performance";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(5)::before {
      content: "Updated";
    }

    [data-admin-v2="true"] .v2-sites-table td:nth-child(6)::before {
      content: "Actions";
    }

    [data-admin-v2="true"] .v2-sites-table .person {
      grid-template-columns: 40px minmax(0, 1fr);
    }

    [data-admin-v2="true"] .v2-sites-table .person strong,
    [data-admin-v2="true"] .v2-sites-table .person small,
    [data-admin-v2="true"] .v2-sites-table code {
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    [data-admin-v2="true"] .v2-sites-table .row-actions {
      flex-wrap: wrap;
    }

    [data-admin-v2="true"] .v2-creator-page .modal-actions,
    [data-admin-v2="true"] .v2-creator-secondary-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      width: 100%;
    }

    [data-admin-v2="true"] .v2-creator-page .modal-actions .btn {
      width: 100%;
      min-width: 0;
      justify-content: center;
      white-space: normal;
    }
  }

  @media (max-width: 1180px) {
    [data-admin-v2="true"] .dashboard-primary {
      gap: 14px;
    }

    [data-admin-v2="true"] .main-activity-chart {
      display: grid;
      gap: 12px;
      padding: 16px;
      align-content: start;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head {
      min-height: 0 !important;
      gap: 10px;
      margin: 0;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-filter-group {
      max-width: 100%;
      flex-wrap: wrap;
      overflow-x: visible;
      scrollbar-width: none;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-filter-group::-webkit-scrollbar {
      display: none;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-filter-group .console-pill {
      flex: 0 1 auto;
      min-width: 0;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-viewport {
      height: clamp(220px, 30vw, 280px) !important;
      min-height: 0;
    }

    [data-admin-v2="true"] .main-activity-chart .activity-chart-svg {
      height: 100% !important;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-foot {
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 8px;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-foot-item {
      min-height: 58px;
      padding: 9px 10px;
    }

    [data-admin-v2="true"] .dashboard-map {
      align-content: start;
    }

    [data-admin-v2="true"] .dashboard-map .audience-map-layout {
      align-items: start;
    }

    [data-admin-v2="true"] .dashboard-map .audience-detail {
      max-height: 320px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(183, 255, 60, .32) rgba(4, 12, 7, .45);
    }

    [data-admin-v2="true"] .dashboard-map .audience-table-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      max-height: 280px;
      overflow: hidden;
    }

    [data-admin-v2="true"] .dashboard-map .audience-table-wrap {
      max-height: 210px;
      overflow: auto;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .admin-addon-shell {
      gap: 12px;
    }
  }

  @media (min-width: 681px) and (max-width: 1180px) {
    [data-admin-v2="true"] .kpi-row .console-mini {
      min-height: 116px;
      padding: 14px;
    }

    [data-admin-v2="true"] .dashboard-map .audience-map-canvas {
      height: 320px !important;
      min-height: 320px !important;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-panel {
      min-height: 0;
      padding: 10px 12px;
    }
  }

  @media (max-width: 680px) {
    [data-admin-v2="true"] .topbar {
      gap: 10px;
      padding: 12px 16px 14px calc(16px + 42px) !important;
    }

    [data-admin-v2="true"] .topbar-title {
      display: grid;
      gap: 5px;
    }

    [data-admin-v2="true"] .page-kicker {
      font-size: 9px;
      letter-spacing: .1em;
      line-height: 1;
    }

    [data-admin-v2="true"] .page-heading-row {
      gap: 8px;
      align-items: center;
    }

    [data-admin-v2="true"] .page-title {
      font-size: clamp(1.35rem, 7vw, 1.65rem) !important;
      line-height: 1.05;
    }

    [data-admin-v2="true"] .page-dropdown {
      min-height: 30px;
      padding: 6px 9px;
    }

    [data-admin-v2="true"] .page-subtitle {
      font-size: 13px;
      line-height: 1.4;
    }

    [data-admin-v2="true"] .top-actions {
      gap: 6px;
    }

    [data-admin-v2="true"] .top-filter-group,
    [data-admin-v2="true"] .quick-action-group {
      gap: 6px;
    }

    [data-admin-v2="true"] .top-filter-group .btn,
    [data-admin-v2="true"] .quick-action-group .btn,
    [data-admin-v2="true"] .top-actions > .logout-action {
      min-height: 34px;
      padding-inline: 7px;
      font-size: 11px;
    }

    [data-admin-v2="true"] .top-actions > .notification-btn,
    [data-admin-v2="true"] .top-actions > .theme-btn.btn {
      width: 38px;
      min-width: 38px;
      height: 38px;
      min-height: 38px;
    }

    [data-admin-v2="true"] .top-actions > .profile-menu {
      min-height: 38px;
      padding-inline: 8px;
      justify-content: center;
    }

    [data-admin-v2="true"] .top-actions > .profile-menu .profile-name {
      display: none;
    }

    [data-admin-v2="true"] .dashboard-console {
      padding: 12px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini {
      min-height: 96px;
      padding: 10px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini svg {
      height: 28px;
      min-height: 0;
    }

    [data-admin-v2="true"] .kpi-row .console-mini strong {
      font-size: 21px;
    }

    [data-admin-v2="true"] .kpi-row .console-mini .kpi-meta {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head,
    [data-admin-v2="true"] .dashboard-table .console-chart-head {
      padding-left: 0 !important;
      grid-template-columns: minmax(0, 1fr) !important;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-head p,
    [data-admin-v2="true"] .dashboard-table .console-chart-head p {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-viewport {
      height: 180px !important;
    }

    [data-admin-v2="true"] .main-activity-chart .console-chart-foot {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    [data-admin-v2="true"] .main-activity-chart .chart-foot-item {
      min-height: 50px;
      padding: 8px;
    }

    [data-admin-v2="true"] .dashboard-table .console-chart-head {
      display: grid;
      min-height: 0 !important;
      gap: 8px;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table-shell {
      gap: 10px;
    }

    [data-admin-v2="true"] .dashboard-table .table-toolbar {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px;
    }

    [data-admin-v2="true"] .dashboard-table .table-toolbar .smart-search,
    [data-admin-v2="true"] .dashboard-table .table-toolbar .console-btn {
      grid-column: 1 / -1;
    }

    [data-admin-v2="true"] .dashboard-table .table-toolbar input,
    [data-admin-v2="true"] .dashboard-table .table-toolbar select,
    [data-admin-v2="true"] .dashboard-table .table-toolbar button {
      min-height: 34px;
      font-size: 12px;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table-wrap {
      max-height: 320px;
      margin-inline: 0 !important;
      border-radius: 16px !important;
      overflow: auto;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table {
      display: block !important;
      width: 100%;
      min-width: 0 !important;
      table-layout: auto !important;
      border-collapse: separate !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table thead,
    [data-admin-v2="true"] .dashboard-table .admin-table colgroup,
    [data-admin-v2="true"] .dashboard-table .admin-table col {
      display: none !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody {
      display: grid !important;
      gap: 8px;
      padding: 8px !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tr {
      display: grid !important;
      gap: 7px;
      padding: 10px !important;
      border: 1px solid rgba(183, 255, 60, .14) !important;
      border-radius: 14px !important;
      background: rgba(4, 12, 7, .62) !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody tr {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 7px !important;
      padding: 10px !important;
      border: 1px solid rgba(183, 255, 60, .14) !important;
      border-radius: 14px !important;
      background: rgba(4, 12, 7, .62) !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table td {
      display: grid !important;
      grid-template-columns: 78px minmax(0, 1fr) !important;
      align-items: center;
      gap: 8px;
      width: 100% !important;
      min-width: 0;
      padding: 0 !important;
      border: 0 !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table tbody td,
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(1),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(2),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(3),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(4),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(5),
    [data-admin-v2="true"] .dashboard-table .admin-table tbody td:nth-child(6) {
      display: grid !important;
      width: 100% !important;
      min-width: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table td::before {
      content: attr(data-label);
      display: block !important;
      color: var(--console-muted);
      font: 900 10px/1.2 var(--font-mono);
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table td:first-child {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table td:first-child::before {
      display: none !important;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table .person {
      grid-template-columns: 38px minmax(0, 1fr);
    }

    [data-admin-v2="true"] .dashboard-table .admin-table .person strong,
    [data-admin-v2="true"] .dashboard-table .admin-table .person small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [data-admin-v2="true"] .dashboard-table .admin-table .row-actions {
      display: flex;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    [data-admin-v2="true"] .dashboard-map .audience-head {
      display: grid;
      gap: 8px;
      min-height: 0;
    }

    [data-admin-v2="true"] .dashboard-map .audience-head p {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    [data-admin-v2="true"] .dashboard-map .audience-map-canvas {
      height: 260px !important;
      min-height: 260px !important;
    }

    [data-admin-v2="true"] .dashboard-map .audience-detail {
      max-height: 260px;
      padding: 12px;
    }

    [data-admin-v2="true"] .dashboard-map .audience-table-card {
      max-height: 230px;
    }

    [data-admin-v2="true"] .dashboard-map .audience-table-wrap {
      max-height: 165px;
    }

    [data-admin-v2="true"] .dashboard-admin-addon {
      max-height: 980px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(183, 255, 60, .32) rgba(4, 12, 7, .45);
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-header {
      gap: 8px;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-module-grid {
      max-height: 360px;
      overflow: auto;
      gap: 8px;
      padding-right: 2px;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-panel {
      padding: 9px 10px;
    }

    [data-admin-v2="true"] .dashboard-admin-addon .addon-mini-row {
      min-height: 0;
    }
  }

  [data-admin-v2="true"][data-od-theme="light"] {
    color-scheme: light;
    --bg: #f2f8ed;
    --surface: #e8f3e2;
    --panel: #ffffff;
    --fg: #092016;
    --muted: #53675d;
    --border: rgba(34, 114, 64, .2);
    --accent: #167a3b;
    --accent-on: #f8fff1;
    --console-bg: #eef7e8;
    --console-panel: #ffffff;
    --console-panel-2: #f5fbf1;
    --console-panel-3: #e5f5df;
    --console-line: #167a3b;
    --console-line-2: #087c68;
    --console-cyan: #087c68;
    --console-text: #092016;
    --console-muted: #53675d;
    --console-border: rgba(34, 114, 64, .24);
    --console-soft: rgba(22, 122, 59, .12);
    --console-softer: rgba(22, 122, 59, .07);
    --console-card-glint: rgba(255, 255, 255, .94);
    --console-ink: #f8fff1;
    --dash-bg: #eef7e8;
    --dash-panel: #ffffff;
    --dash-panel-soft: #f5fbf1;
    --dash-border: rgba(34, 114, 64, .22);
    --dash-border-strong: rgba(22, 122, 59, .42);
    --dash-accent: #167a3b;
    --dash-accent-soft: #23a869;
    --dash-accent-cyan: #087c68;
    --dash-text: #092016;
    --dash-muted: #53675d;
    --dash-shadow-card: 0 22px 54px rgba(24, 62, 40, .14);
    background:
      radial-gradient(circle at 18% -8%, rgba(35, 168, 105, .2), transparent 32%),
      radial-gradient(circle at 92% 16%, rgba(8, 124, 104, .13), transparent 28%),
      linear-gradient(180deg, #f8fcf5 0%, #eef7e8 100%) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .app,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] {
    color: var(--console-text);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, .7), transparent 540px),
      radial-gradient(circle at 44% 0%, rgba(35, 168, 105, .14), transparent 34%),
      radial-gradient(circle at 95% 18%, rgba(8, 124, 104, .1), transparent 30%),
      linear-gradient(180deg, #f8fcf5 0%, #eef7e8 100%) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .sidebar,
  [data-admin-v2="true"][data-od-theme="light"] .topbar,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-console,
  [data-admin-v2="true"][data-od-theme="light"] .console-card,
  [data-admin-v2="true"][data-od-theme="light"] .console-chart,
  [data-admin-v2="true"][data-od-theme="light"] .console-mini,
  [data-admin-v2="true"][data-od-theme="light"] .finance-card,
  [data-admin-v2="true"][data-od-theme="light"] .radial-card,
  [data-admin-v2="true"][data-od-theme="light"] .panel,
  [data-admin-v2="true"][data-od-theme="light"] .card,
  [data-admin-v2="true"][data-od-theme="light"] .addon-panel,
  [data-admin-v2="true"][data-od-theme="light"] .insight-card,
  [data-admin-v2="true"][data-od-theme="light"] .audience-detail,
  [data-admin-v2="true"][data-od-theme="light"] .audience-table-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-sites-page,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-focus,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .admin-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .table-wrap {
    border-color: rgba(34, 114, 64, .2) !important;
    color: var(--console-text) !important;
    background:
      radial-gradient(circle at 18% 0%, rgba(35, 168, 105, .1), transparent 36%),
      linear-gradient(180deg, rgba(255, 255, 255, .96), rgba(245, 251, 241, .92)) !important;
    box-shadow:
      0 20px 52px rgba(24, 62, 40, .12),
      inset 0 1px 0 rgba(255, 255, 255, .86) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .sidebar {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(237, 248, 231, .96)) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .score-card,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-map.console-card {
    background:
      radial-gradient(circle at 86% 14%, rgba(35, 168, 105, .14), transparent 34%),
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(240, 249, 235, .95)) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .score-ring {
    background:
      radial-gradient(circle, rgba(255, 255, 255, .98) 0 57%, transparent 58%),
      conic-gradient(from -90deg, var(--score-tone, var(--dash-accent)) calc(var(--value) * 1%), rgba(22, 122, 59, .13) 0 100%);
  }

  [data-admin-v2="true"][data-od-theme="light"] .score-ring::after {
    border-color: rgba(22, 122, 59, .18);
    background:
      radial-gradient(circle at 50% 0%, rgba(35, 168, 105, .13), transparent 56%),
      rgba(255, 255, 255, .96);
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-pill,
  [data-admin-v2="true"][data-od-theme="light"] .console-btn,
  [data-admin-v2="true"][data-od-theme="light"] .btn,
  [data-admin-v2="true"][data-od-theme="light"] .tab {
    border-color: rgba(34, 114, 64, .22) !important;
    color: #123324 !important;
    background: rgba(255, 255, 255, .82) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .92);
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-pill.is-active,
  [data-admin-v2="true"][data-od-theme="light"] .console-btn.is-primary,
  [data-admin-v2="true"][data-od-theme="light"] .btn-primary,
  [data-admin-v2="true"][data-od-theme="light"] .tab.is-active {
    border-color: rgba(22, 122, 59, .44) !important;
    color: #f8fff1 !important;
    background: linear-gradient(135deg, #167a3b, #23a869) !important;
    box-shadow: 0 14px 28px rgba(22, 122, 59, .18);
  }

  [data-admin-v2="true"][data-od-theme="light"] .page-kicker,
  [data-admin-v2="true"][data-od-theme="light"] .page-subtitle,
  [data-admin-v2="true"][data-od-theme="light"] p,
  [data-admin-v2="true"][data-od-theme="light"] small,
  [data-admin-v2="true"][data-od-theme="light"] .console-muted,
  [data-admin-v2="true"][data-od-theme="light"] .kpi-meta,
  [data-admin-v2="true"][data-od-theme="light"] .score-copy > span,
  [data-admin-v2="true"][data-od-theme="light"] .chart-summary {
    color: var(--console-muted) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] h1,
  [data-admin-v2="true"][data-od-theme="light"] h2,
  [data-admin-v2="true"][data-od-theme="light"] h3,
  [data-admin-v2="true"][data-od-theme="light"] h4,
  [data-admin-v2="true"][data-od-theme="light"] strong,
  [data-admin-v2="true"][data-od-theme="light"] .page-title,
  [data-admin-v2="true"][data-od-theme="light"] .score-copy > strong,
  [data-admin-v2="true"][data-od-theme="light"] .score-ring strong {
    color: var(--console-text) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] input,
  [data-admin-v2="true"][data-od-theme="light"] select,
  [data-admin-v2="true"][data-od-theme="light"] textarea,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] input,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] select,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] textarea {
    border-color: rgba(34, 114, 64, .24) !important;
    color: var(--console-text) !important;
    background: rgba(255, 255, 255, .92) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] input:focus,
  [data-admin-v2="true"][data-od-theme="light"] select:focus,
  [data-admin-v2="true"][data-od-theme="light"] textarea:focus {
    border-color: rgba(22, 122, 59, .54) !important;
    outline: none;
    box-shadow: 0 0 0 3px rgba(22, 122, 59, .12) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] th,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table th,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-map .audience-table thead,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] th {
    color: rgba(9, 32, 22, .66) !important;
    background: rgba(239, 248, 232, .96) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] td,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table td,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] td {
    border-color: rgba(34, 114, 64, .13) !important;
    color: rgba(9, 32, 22, .88) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults {
    border-color: rgba(34, 114, 64, .24) !important;
    color: var(--console-text) !important;
    background:
      radial-gradient(circle at 16% 0%, rgba(35, 168, 105, .14), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(240, 249, 235, .98)) !important;
    box-shadow:
      0 24px 58px rgba(24, 62, 40, .2),
      inset 0 1px 0 rgba(255, 255, 255, .88) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results button,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults button {
    color: var(--console-text) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas {
    background:
      radial-gradient(circle at 28% 34%, rgba(35, 168, 105, .18), transparent 24%),
      radial-gradient(circle at 64% 48%, rgba(8, 124, 104, .12), transparent 28%),
      linear-gradient(90deg, rgba(22, 122, 59, .1) 1px, transparent 1px),
      linear-gradient(180deg, rgba(22, 122, 59, .1) 1px, transparent 1px),
      #eef7e8 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .audience-leaflet-map,
  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas .leaflet-container,
  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas .leaflet-tile {
    background: #eef7e8 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas .leaflet-control-zoom a {
    background: rgba(255, 255, 255, .94) !important;
    color: var(--console-text) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .mobile-menu,
  [data-admin-v2="true"][data-od-theme="light"] .profile-menu,
  [data-admin-v2="true"][data-od-theme="light"] .page-dropdown {
    border-color: rgba(34, 114, 64, .22) !important;
    color: var(--console-text) !important;
    background: rgba(255, 255, 255, .86) !important;
  }

  @media (max-width: 560px) {
    [data-admin-v2="true"] .app,
    [data-admin-v2="true"] .content {
      padding-bottom: 132px !important;
    }

    [data-admin-v2="true"] .dashboard-admin-addon,
    [data-admin-v2="true"] .dashboard-admin-addon .addon-module-shortcut {
      scroll-margin: 96px 16px 152px;
    }

    [data-admin-v2="true"] .topbar {
      overflow: visible !important;
    }

    [data-admin-v2="true"] .top-search-wrap .smart-search-results {
      left: auto !important;
      right: 0 !important;
      width: min(360px, calc(100vw - 32px));
      max-width: calc(100vw - 32px);
      max-height: 54vh;
    }

    [data-admin-v2="true"] .v2-search-panel .smart-search-results {
      position: fixed !important;
      left: 16px !important;
      right: 16px !important;
      top: auto !important;
      bottom: max(16px, env(safe-area-inset-bottom)) !important;
      width: auto !important;
      max-width: calc(100vw - 32px);
      max-height: min(320px, 44vh);
      overflow-y: auto;
      z-index: 220;
    }
  }

  [data-admin-v2="true"][data-theme-sweep="active"]::after {
    content: none;
    display: none;
  }

  [data-admin-v2="true"][data-theme-sweep="active"][data-od-theme="dark"]::after {
    content: none;
    display: none;
  }

  [data-admin-v2="true"][data-od-theme="light"] {
    color-scheme: light;
    --bg: #f6f8f3;
    --surface: #eef3ea;
    --panel: #ffffff;
    --fg: #0c1712;
    --muted: #55635d;
    --border: rgba(29, 54, 42, .14);
    --accent: #087a3f;
    --accent-on: #ffffff;
    --console-bg: #f6f8f3;
    --console-panel: #ffffff;
    --console-panel-2: #f7faf5;
    --console-panel-3: #e9f2e9;
    --console-line: #087a3f;
    --console-line-2: #0f9b7a;
    --console-cyan: #0f7d8c;
    --console-text: #0c1712;
    --console-muted: #55635d;
    --console-border: rgba(29, 54, 42, .16);
    --console-soft: rgba(8, 122, 63, .1);
    --console-softer: rgba(8, 122, 63, .055);
    --console-card-glint: rgba(255, 255, 255, .94);
    --console-ink: #ffffff;
    --dash-bg: #f6f8f3;
    --dash-panel: #ffffff;
    --dash-panel-soft: #f7faf5;
    --dash-border: rgba(29, 54, 42, .16);
    --dash-border-strong: rgba(8, 122, 63, .36);
    --dash-accent: #087a3f;
    --dash-accent-soft: #12a165;
    --dash-accent-cyan: #0f7d8c;
    --dash-text: #0c1712;
    --dash-muted: #55635d;
    --dash-shadow-card: 0 18px 42px rgba(38, 58, 47, .11);
    color: var(--console-text);
    background:
      linear-gradient(90deg, rgba(8, 122, 63, .045) 1px, transparent 1px),
      linear-gradient(180deg, rgba(8, 122, 63, .045) 1px, transparent 1px),
      linear-gradient(180deg, #fbfcf8 0%, #f3f6ef 44%, #eef4ea 100%) !important;
    background-size: 34px 34px, 34px 34px, auto;
  }

  [data-admin-v2="true"][data-od-theme="light"] .app {
    background:
      linear-gradient(90deg, rgba(10, 72, 42, .08), transparent 360px),
      linear-gradient(180deg, rgba(255, 255, 255, .72), rgba(238, 244, 234, .7)) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .topbar {
    border: 1px solid rgba(29, 54, 42, .13) !important;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, .98), rgba(252, 255, 248, .94)) !important;
    box-shadow:
      0 16px 36px rgba(31, 48, 39, .1),
      0 1px 0 rgba(255, 255, 255, .9) inset !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .topbar::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: inherit;
    background: linear-gradient(180deg, #087a3f, #0f9b7a);
  }

  [data-admin-v2="true"][data-od-theme="light"] .sidebar {
    border-color: rgba(29, 54, 42, .13) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(244, 248, 240, .96)) !important;
    box-shadow:
      0 18px 44px rgba(31, 48, 39, .12),
      inset 0 1px 0 rgba(255, 255, 255, .92) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .brand > div:not(.brand-mark),
  [data-admin-v2="true"][data-od-theme="light"] .nav-copy {
    border-color: rgba(29, 54, 42, .15) !important;
    color: #0c1712 !important;
    background:
      radial-gradient(circle at 16% 0%, rgba(8, 122, 63, .09), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(247, 251, 244, .96)) !important;
    box-shadow:
      0 18px 42px rgba(31, 48, 39, .14),
      inset 0 1px 0 rgba(255, 255, 255, .96) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .brand > div:not(.brand-mark) span,
  [data-admin-v2="true"][data-od-theme="light"] .nav-copy span {
    color: #55635d !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .brand {
    border-bottom-color: rgba(29, 54, 42, .12) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .nav-btn {
    color: #20362b !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .nav-btn:hover,
  [data-admin-v2="true"][data-od-theme="light"] .nav-btn:focus-visible,
  [data-admin-v2="true"][data-od-theme="light"] .nav-btn.is-active {
    color: #075b34 !important;
    border-color: rgba(8, 122, 63, .28) !important;
    background: rgba(8, 122, 63, .08) !important;
    box-shadow: 0 10px 24px rgba(8, 122, 63, .12) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .nav-btn.is-active::after {
    background:
      radial-gradient(circle, rgba(8, 122, 63, .18), rgba(15, 155, 122, .09) 64%, transparent 68%) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-card,
  [data-admin-v2="true"][data-od-theme="light"] .console-chart,
  [data-admin-v2="true"][data-od-theme="light"] .console-mini,
  [data-admin-v2="true"][data-od-theme="light"] .radial-card,
  [data-admin-v2="true"][data-od-theme="light"] .insight-card,
  [data-admin-v2="true"][data-od-theme="light"] .addon-panel,
  [data-admin-v2="true"][data-od-theme="light"] .panel,
  [data-admin-v2="true"][data-od-theme="light"] .card,
  [data-admin-v2="true"][data-od-theme="light"] .finance-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-focus,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .admin-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .audience-detail,
  [data-admin-v2="true"][data-od-theme="light"] .audience-table-card {
    border-color: rgba(29, 54, 42, .14) !important;
    color: var(--console-text) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .98), rgba(249, 251, 247, .95)) !important;
    box-shadow:
      0 16px 34px rgba(31, 48, 39, .1),
      0 1px 0 rgba(255, 255, 255, .94) inset !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-module-shortcut {
    border-color: rgba(29, 54, 42, .14) !important;
    background:
      linear-gradient(135deg, #ffffff 0%, #fbfdf9 58%, rgba(8, 122, 63, .055) 100%) !important;
    box-shadow:
      0 14px 28px rgba(31, 48, 39, .09),
      inset 0 1px 0 rgba(255, 255, 255, .98) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-module-shortcut:hover,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-module-shortcut:focus-visible,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-module-shortcut[data-active="true"] {
    border-color: rgba(8, 122, 63, .42) !important;
    background:
      linear-gradient(135deg, #ffffff 0%, #f6fbf2 52%, rgba(8, 122, 63, .12) 100%) !important;
    box-shadow:
      0 18px 34px rgba(8, 122, 63, .14),
      inset 0 1px 0 rgba(255, 255, 255, .98) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-shortcut-icon {
    border-color: rgba(8, 122, 63, .26) !important;
    color: #087a3f !important;
    background:
      radial-gradient(circle at 30% 22%, rgba(172, 235, 102, .42), transparent 56%),
      linear-gradient(135deg, rgba(8, 122, 63, .1), rgba(15, 155, 122, .08)) !important;
    box-shadow:
      0 12px 24px rgba(8, 122, 63, .11),
      inset 0 1px 0 rgba(255, 255, 255, .88) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-admin-addon .addon-module-shortcut[data-active="true"] .addon-shortcut-icon {
    color: #ffffff !important;
    background: linear-gradient(135deg, #087a3f, #12a165) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet {
    border-color: rgba(8, 122, 63, .26) !important;
    color: #0c1712 !important;
    background:
      radial-gradient(circle at 18% 8%, rgba(18, 161, 101, .18), transparent 38%),
      linear-gradient(135deg, #ffffff 0%, #f7fbf4 54%, #edf7e8 100%) !important;
    box-shadow:
      0 22px 54px rgba(31, 48, 39, .12),
      inset 0 1px 0 rgba(255, 255, 255, .98) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet h2,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet strong,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet .balance,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet .console-eyebrow {
    color: #0c1712 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet p,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet span,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet small {
    color: #55635d !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet .finance-card {
    border-color: rgba(8, 122, 63, .16) !important;
    background: rgba(255, 255, 255, .88) !important;
    box-shadow:
      0 10px 22px rgba(31, 48, 39, .08),
      inset 0 1px 0 rgba(255, 255, 255, .96) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet .console-btn:not(.is-primary) {
    border-color: rgba(8, 122, 63, .22) !important;
    color: #075b34 !important;
    background: #ffffff !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-mini {
    border-color: rgba(8, 122, 63, .36) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .score-card,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-map.console-card {
    background:
      linear-gradient(180deg, #ffffff, #f8fbf6) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .chart-viewport,
  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas {
    border-color: rgba(29, 54, 42, .14) !important;
    background:
      linear-gradient(90deg, rgba(8, 122, 63, .06) 1px, transparent 1px),
      linear-gradient(180deg, rgba(8, 122, 63, .06) 1px, transparent 1px),
      linear-gradient(180deg, #f6faf3, #edf3eb) !important;
    background-size: 48px 48px, 48px 48px, auto !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .area {
    opacity: .18;
  }

  [data-admin-v2="true"][data-od-theme="light"] .line-main,
  [data-admin-v2="true"][data-od-theme="light"] .mini-spark polyline {
    stroke: #087a3f !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .line-prev {
    stroke: #b98312 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .chart-grid-line {
    stroke: rgba(29, 54, 42, .11) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-pill,
  [data-admin-v2="true"][data-od-theme="light"] .console-btn,
  [data-admin-v2="true"][data-od-theme="light"] .btn,
  [data-admin-v2="true"][data-od-theme="light"] .tab {
    border-color: rgba(29, 54, 42, .16) !important;
    color: #16261d !important;
    background: #ffffff !important;
    box-shadow:
      0 8px 18px rgba(31, 48, 39, .07),
      inset 0 1px 0 rgba(255, 255, 255, .96) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .console-pill.is-active,
  [data-admin-v2="true"][data-od-theme="light"] .console-btn.is-primary,
  [data-admin-v2="true"][data-od-theme="light"] .btn-primary,
  [data-admin-v2="true"][data-od-theme="light"] .tab.is-active,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet .console-btn.is-primary {
    border-color: rgba(8, 122, 63, .52) !important;
    color: #ffffff !important;
    background: linear-gradient(135deg, #087a3f, #12a165) !important;
    box-shadow:
      0 12px 24px rgba(8, 122, 63, .22),
      inset 0 1px 0 rgba(255, 255, 255, .2) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .badge,
  [data-admin-v2="true"][data-od-theme="light"] .kpi-meta,
  [data-admin-v2="true"][data-od-theme="light"] .chart-summary,
  [data-admin-v2="true"][data-od-theme="light"] .page-subtitle,
  [data-admin-v2="true"][data-od-theme="light"] p,
  [data-admin-v2="true"][data-od-theme="light"] small {
    color: #55635d !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] h1,
  [data-admin-v2="true"][data-od-theme="light"] h2,
  [data-admin-v2="true"][data-od-theme="light"] h3,
  [data-admin-v2="true"][data-od-theme="light"] h4,
  [data-admin-v2="true"][data-od-theme="light"] strong,
  [data-admin-v2="true"][data-od-theme="light"] .page-title,
  [data-admin-v2="true"][data-od-theme="light"] .score-ring strong {
    color: #0c1712 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] input,
  [data-admin-v2="true"][data-od-theme="light"] select,
  [data-admin-v2="true"][data-od-theme="light"] textarea {
    border-color: rgba(29, 54, 42, .18) !important;
    color: #0c1712 !important;
    background: #ffffff !important;
    box-shadow: 0 1px 0 rgba(255, 255, 255, .96) inset !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] input:focus,
  [data-admin-v2="true"][data-od-theme="light"] select:focus,
  [data-admin-v2="true"][data-od-theme="light"] textarea:focus {
    border-color: rgba(8, 122, 63, .58) !important;
    box-shadow:
      0 0 0 3px rgba(8, 122, 63, .12),
      0 10px 24px rgba(31, 48, 39, .08) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] th,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table th,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-map .audience-table thead {
    color: #34463b !important;
    background: #f0f5ee !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] td,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table td {
    border-color: rgba(29, 54, 42, .1) !important;
    color: #18251e !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults,
  [data-admin-v2="true"][data-od-theme="light"] .coach-search-results {
    border-color: rgba(29, 54, 42, .18) !important;
    color: #0c1712 !important;
    background: #ffffff !important;
    box-shadow: 0 24px 54px rgba(31, 48, 39, .18) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results button,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults button,
  [data-admin-v2="true"][data-od-theme="light"] .coach-search-option {
    color: #0c1712 !important;
    background: transparent !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results button:hover,
  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results button:focus-visible,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults button:hover,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults button:focus-visible,
  [data-admin-v2="true"][data-od-theme="light"] .coach-search-option:hover,
  [data-admin-v2="true"][data-od-theme="light"] .coach-search-option:focus-visible {
    background: rgba(8, 122, 63, .08) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .theme-btn.btn {
    color: #075b34 !important;
    border-color: rgba(8, 122, 63, .24) !important;
    background: #ffffff !important;
    box-shadow:
      0 10px 22px rgba(31, 48, 39, .12),
      inset 0 1px 0 rgba(255, 255, 255, .96) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .profile-menu,
  [data-admin-v2="true"][data-od-theme="light"] .page-dropdown,
  [data-admin-v2="true"][data-od-theme="light"] .mobile-menu,
  [data-admin-v2="true"][data-od-theme="light"] .mobile-bottom {
    border-color: rgba(29, 54, 42, .15) !important;
    color: #0c1712 !important;
    background: rgba(255, 255, 255, .94) !important;
    box-shadow: 0 14px 30px rgba(31, 48, 39, .12) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .mobile-bottom button.is-active {
    color: #ffffff !important;
    background: linear-gradient(135deg, #087a3f, #12a165) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] {
    --bg: #edf8df;
    --surface: #e0f0d2;
    --panel: #f7fff0;
    --fg: #07160c;
    --muted: #506555;
    --border: #b0d39e;
    --accent: #228c24;
    --accent-on: #f8fff1;
    --console-bg: #d9edc8;
    --console-panel: #f4ffe9;
    --console-panel-2: #e8f8db;
    --console-panel-3: #d7efc2;
    --console-line: #22922c;
    --console-line-2: #0f8061;
    --console-cyan: #087c68;
    --console-text: #07160c;
    --console-muted: #506555;
    --console-border: rgba(34, 146, 44, .28);
    --console-soft: rgba(34, 146, 44, .12);
    --console-softer: rgba(34, 146, 44, .065);
    --console-card-glint: rgba(255, 255, 255, .84);
    --console-ink: #06110b;
    --dash-bg: #edf8df;
    --dash-panel: #f4ffe9;
    --dash-panel-soft: #e8f8db;
    --dash-border: rgba(34, 146, 44, .24);
    --dash-border-strong: rgba(34, 146, 44, .44);
    --dash-accent: #22922c;
    --dash-accent-soft: #11a96f;
    --dash-accent-cyan: #087c68;
    --dash-text: #07160c;
    --dash-muted: #506555;
    --dash-shadow-card: 0 22px 54px rgba(36, 68, 36, .16);
    color: var(--console-text) !important;
    background:
      radial-gradient(circle at 18% -8%, rgba(34, 146, 44, .22), transparent 34%),
      radial-gradient(circle at 95% 18%, rgba(8, 124, 104, .13), transparent 28%),
      linear-gradient(180deg, #f8fff1 0%, #edf8df 100%) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .app,
  [data-admin-v2="true"][data-od-theme="light"] [data-admin-version="v2"][data-admin-v2-module-view="true"] {
    background:
      linear-gradient(90deg, rgba(244, 255, 233, .92), transparent 520px),
      linear-gradient(180deg, rgba(224, 240, 210, .7), rgba(237, 248, 223, .86)) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .topbar,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-console,
  [data-admin-v2="true"][data-od-theme="light"] .console-card,
  [data-admin-v2="true"][data-od-theme="light"] .console-chart,
  [data-admin-v2="true"][data-od-theme="light"] .console-mini,
  [data-admin-v2="true"][data-od-theme="light"] .radial-card,
  [data-admin-v2="true"][data-od-theme="light"] .panel,
  [data-admin-v2="true"][data-od-theme="light"] .card,
  [data-admin-v2="true"][data-od-theme="light"] .finance-card,
  [data-admin-v2="true"][data-od-theme="light"] .addon-panel,
  [data-admin-v2="true"][data-od-theme="light"] .insight-card,
  [data-admin-v2="true"][data-od-theme="light"] .audience-detail,
  [data-admin-v2="true"][data-od-theme="light"] .audience-table-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-focus,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-sites-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .admin-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .table-wrap {
    border-color: rgba(34, 146, 44, .24) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 18% 0%, rgba(34, 146, 44, .10), transparent 36%),
      linear-gradient(180deg, rgba(255, 255, 250, .98), rgba(244, 255, 233, .94)) !important;
    box-shadow:
      0 20px 48px rgba(36, 68, 36, .14),
      inset 0 1px 0 rgba(255, 255, 255, .9) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .sidebar {
    border-color: rgba(34, 146, 44, .24) !important;
    color: #07160c !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 250, .98), rgba(232, 248, 219, .96)) !important;
    box-shadow:
      0 22px 56px rgba(36, 68, 36, .16),
      inset 0 1px 0 rgba(255, 255, 255, .92) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .dashboard-wallet,
  [data-admin-v2="true"][data-od-theme="light"] .score-card,
  [data-admin-v2="true"][data-od-theme="light"] .dashboard-map.console-card {
    border-color: rgba(34, 146, 44, .3) !important;
    background:
      radial-gradient(circle at 16% 8%, rgba(17, 169, 111, .16), transparent 38%),
      linear-gradient(135deg, #fffffa 0%, #f4ffe9 56%, #e8f8db 100%) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .chart-viewport,
  [data-admin-v2="true"][data-od-theme="light"] .audience-map-canvas {
    border-color: rgba(34, 146, 44, .22) !important;
    background:
      radial-gradient(circle at 28% 34%, rgba(34, 146, 44, .15), transparent 24%),
      radial-gradient(circle at 64% 48%, rgba(8, 124, 104, .10), transparent 28%),
      linear-gradient(90deg, rgba(34, 146, 44, .075) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 146, 44, .075) 1px, transparent 1px),
      #eef8e4 !important;
    background-size: auto, auto, 48px 48px, 48px 48px, auto !important;
  }

  [data-admin-v2="true"] .smart-search:focus-within,
  [data-admin-v2="true"] .top-search-wrap:focus-within {
    position: relative;
    z-index: 260 !important;
    overflow: visible !important;
  }

  [data-admin-v2="true"] .smart-search-results,
  [data-admin-v2="true"] .v2SearchResults {
    z-index: 360 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .smart-search-results,
  [data-admin-v2="true"][data-od-theme="light"] .v2SearchResults,
  [data-admin-v2="true"][data-od-theme="light"] .coach-search-results {
    border-color: rgba(34, 146, 44, .28) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 16% 0%, rgba(17, 169, 111, .14), transparent 42%),
      linear-gradient(180deg, #fffffa, #f4ffe9) !important;
    box-shadow:
      0 26px 60px rgba(36, 68, 36, .2),
      inset 0 1px 0 rgba(255, 255, 255, .92) !important;
  }

  [data-admin-v2="true"] .v2-coach-analytics-studio {
    position: relative;
    overflow: hidden;
  }

  [data-admin-v2="true"] .v2-coach-analytics-studio::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(90deg, color-mix(in oklab, var(--console-line), transparent 92%) 1px, transparent 1px),
      linear-gradient(180deg, color-mix(in oklab, var(--console-line), transparent 94%) 1px, transparent 1px);
    background-size: 46px 46px;
    mask-image: linear-gradient(90deg, rgba(0,0,0,.5), transparent 72%);
    opacity: .46;
  }

  [data-admin-v2="true"] .v2-coach-analytics-filters {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(5, minmax(140px, 1fr)) auto;
    gap: 10px;
    align-items: end;
    margin: 18px 0;
  }

  [data-admin-v2="true"] .v2-coach-analytics-filters label,
  [data-admin-v2="true"] .v2-coach-report-dock label {
    display: grid;
    gap: 6px;
    color: var(--console-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table-wrap {
    position: relative;
    z-index: 1;
    overflow-x: auto;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 76%);
    border-radius: 18px;
    background: color-mix(in oklab, var(--console-ink), transparent 38%);
  }

  [data-admin-v2="true"] .v2-coach-analytics-table {
    width: 100%;
    min-width: 1280px;
    border-collapse: collapse;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table th,
  [data-admin-v2="true"] .v2-coach-analytics-table td {
    padding: 14px 16px;
    border-bottom: 1px solid color-mix(in oklab, var(--console-line), transparent 88%);
    vertical-align: middle;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table th {
    position: sticky;
    top: 0;
    z-index: 2;
    color: var(--console-muted);
    background: color-mix(in oklab, var(--console-ink), #000 8%);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 850;
    letter-spacing: .08em;
    text-align: left;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table td {
    color: var(--console-text);
  }

  [data-admin-v2="true"] .v2-coach-analytics-table tbody tr {
    transition:
      background-color .16s ease,
      box-shadow .16s ease;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table tbody tr:hover {
    background: color-mix(in oklab, var(--console-line), transparent 94%);
  }

  [data-admin-v2="true"] .v2-coach-analytics-table tr[data-selected="true"] {
    background:
      linear-gradient(90deg, color-mix(in oklab, var(--console-line), transparent 78%), transparent 42%),
      color-mix(in oklab, var(--console-panel-2), transparent 8%);
  }

  [data-admin-v2="true"] .v2-coach-analytics-table code {
    display: inline-block;
    max-width: 180px;
    overflow: hidden;
    color: var(--console-line);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table td[colspan] {
    padding: 28px;
    color: var(--console-muted);
    text-align: center;
  }

  [data-admin-v2="true"] .v2-coach-analytics-table td[colspan] strong,
  [data-admin-v2="true"] .v2-coach-analytics-table td[colspan] small {
    display: block;
  }

  [data-admin-v2="true"] .v2-funnel-badges,
  [data-admin-v2="true"] .v2-coach-row-actions,
  [data-admin-v2="true"] .v2-report-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  [data-admin-v2="true"] .v2-coach-row-actions {
    flex-wrap: nowrap;
  }

  [data-admin-v2="true"] .v2-coach-report-dock,
  [data-admin-v2="true"] .v2-report-preview {
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 80%);
    border-radius: 14px;
    background:
      radial-gradient(circle at 0 0, color-mix(in oklab, var(--console-line), transparent 88%), transparent 42%),
      color-mix(in oklab, var(--console-panel), transparent 4%);
  }

  [data-admin-v2="true"] .v2-coach-report-dock {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(280px, .42fr) minmax(0, 1fr);
    gap: 10px;
    margin-top: 4px;
    padding: 10px;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .section-head {
    display: grid;
    gap: 6px;
    align-content: start;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .section-head h3 {
    margin: 3px 0 0;
    font-size: 16px;
    line-height: 1.12;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .section-head p {
    display: -webkit-box;
    overflow: hidden;
    margin: 0;
    font-size: 11px;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .section-head label {
    max-width: 260px;
  }

  [data-admin-v2="true"] .v2-coach-report-dock select {
    min-height: 38px;
    border-radius: 12px;
    padding-block: 0;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .v2-report-actions {
    align-self: start;
    grid-column: 1;
  }

  [data-admin-v2="true"] .v2-coach-report-dock .v2-report-actions .btn {
    min-height: 32px;
    padding-inline: 9px;
    font-size: 11px;
  }

  [data-admin-v2="true"] .v2-report-preview {
    display: grid;
    grid-column: 2;
    grid-row: 1 / span 2;
    gap: 6px;
    min-width: 0;
    padding: 8px;
  }

  [data-admin-v2="true"] .v2-report-preview > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px;
    color: var(--console-muted);
    font-size: 12px;
    line-height: 1.25;
  }

  [data-admin-v2="true"] .v2-report-preview strong {
    color: var(--console-text);
  }

  [data-admin-v2="true"] .v2-report-preview pre {
    max-height: 104px;
    overflow: auto;
    margin: 0;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    border-radius: 12px;
    padding: 8px;
    color: var(--console-text);
    background: color-mix(in oklab, var(--console-ink), transparent 8%);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.34;
    white-space: pre-wrap;
  }

  [data-admin-v2="true"] .v2-coach-analytics-dialog-layer {
    position: fixed;
    inset: 0;
    z-index: 920;
    display: grid;
    place-items: center;
    padding: 20px;
  }

  [data-admin-v2="true"] .v2-coach-analytics-dialog-scrim {
    position: absolute;
    inset: 0;
    border: 0;
    background:
      radial-gradient(circle at 28% 12%, color-mix(in oklab, var(--console-line), transparent 78%), transparent 34%),
      rgba(0, 12, 7, .76);
    backdrop-filter: blur(14px);
  }

  [data-admin-v2="true"] .v2-coach-analytics-dialog {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 10px;
    width: min(1240px, 94vw);
    max-height: min(84vh, 860px);
    overflow: auto;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 68%);
    border-radius: 22px;
    padding: 14px;
    color: var(--console-text);
    background:
      radial-gradient(circle at 8% 0%, color-mix(in oklab, var(--console-line), transparent 78%), transparent 32%),
      radial-gradient(circle at 86% 12%, color-mix(in oklab, var(--console-cyan), transparent 88%), transparent 30%),
      linear-gradient(180deg, color-mix(in oklab, var(--console-panel), #07120b 8%), color-mix(in oklab, var(--console-ink), #000 8%));
    box-shadow:
      0 42px 120px rgba(0, 0, 0, .48),
      inset 0 1px 0 rgba(255, 255, 255, .06);
  }

  [data-admin-v2="true"] .v2-dedicated-header,
  [data-admin-v2="true"] .v2-dedicated-header-actions,
  [data-admin-v2="true"] .v2-dedicated-identity,
  [data-admin-v2="true"] .v2-dedicated-summary-strip,
  [data-admin-v2="true"] .v2-dedicated-tabs {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-header {
    justify-content: space-between;
    border-bottom: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    padding-bottom: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-identity .avatar {
    width: 50px;
    height: 50px;
    min-width: 50px;
  }

  [data-admin-v2="true"] .v2-dedicated-identity h2 {
    margin: 4px 0 2px;
    color: var(--console-text);
    font-size: clamp(21px, 2vw, 30px);
    line-height: 1.05;
  }

  [data-admin-v2="true"] .v2-dedicated-identity p {
    margin: 0;
    color: var(--console-muted);
  }

  [data-admin-v2="true"] .v2-dedicated-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  [data-admin-v2="true"] .v2-dedicated-header-actions .btn {
    min-height: 36px;
    padding-inline: 12px;
  }

  [data-admin-v2="true"] .v2-dedicated-summary-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-summary-strip span,
  [data-admin-v2="true"] .v2-dedicated-kpi-card,
  [data-admin-v2="true"] .v2-dedicated-chart-panel,
  [data-admin-v2="true"] .v2-dedicated-side-panel article,
  [data-admin-v2="true"] .v2-dedicated-meta-grid span {
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    border-radius: 14px;
    background:
      radial-gradient(circle at 0 0, color-mix(in oklab, var(--console-line), transparent 88%), transparent 42%),
      color-mix(in oklab, var(--console-panel), transparent 7%);
  }

  [data-admin-v2="true"] .v2-dedicated-summary-strip span,
  [data-admin-v2="true"] .v2-dedicated-meta-grid span {
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 9px 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-summary-strip small,
  [data-admin-v2="true"] .v2-dedicated-kpi-card small,
  [data-admin-v2="true"] .v2-dedicated-meta-grid small,
  [data-admin-v2="true"] .v2-dedicated-event-list small {
    color: var(--console-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-dedicated-summary-strip strong,
  [data-admin-v2="true"] .v2-dedicated-meta-grid strong {
    min-width: 0;
    overflow: hidden;
    color: var(--console-text);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-dedicated-tabs {
    flex-wrap: wrap;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    border-radius: 14px;
    padding: 4px;
    background: color-mix(in oklab, var(--console-ink), transparent 20%);
  }

  [data-admin-v2="true"] .v2-dedicated-tabs button {
    min-height: 34px;
    border: 0;
    border-radius: 10px;
    padding: 0 13px;
    color: var(--console-muted);
    background: transparent;
    font-weight: 850;
  }

  [data-admin-v2="true"] .v2-dedicated-tabs button.is-active {
    color: #07160c;
    background: linear-gradient(135deg, var(--console-line), var(--console-cyan));
    box-shadow: 0 12px 28px color-mix(in oklab, var(--console-line), transparent 72%);
  }

  [data-admin-v2="true"] .v2-dedicated-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, .32fr);
    gap: 10px;
    align-items: start;
  }

  [data-admin-v2="true"] .v2-dedicated-visual-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, .28fr);
    gap: 10px;
    align-items: stretch;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart {
    display: grid;
    gap: 8px;
    align-content: start;
    min-height: 100%;
    padding: 12px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    border-radius: 16px;
    background:
      radial-gradient(circle at 12% 0%, color-mix(in oklab, var(--console-line), transparent 88%), transparent 38%),
      color-mix(in oklab, var(--console-panel), transparent 6%);
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .console-chart-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    min-height: 0 !important;
    margin: 0;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .console-chart-head h3 {
    margin: 0;
    font-size: 18px;
    line-height: 1.12;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .console-chart-head p,
  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-summary {
    display: -webkit-box;
    overflow: hidden;
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.32;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-filter-group {
    flex-wrap: nowrap;
    gap: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-filter-group .console-pill {
    min-height: 28px;
    padding-inline: 9px;
    font-size: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-viewport {
    height: 158px !important;
    min-height: 0;
    margin-top: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .activity-chart-svg {
    height: 100% !important;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
    font-size: 11px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .console-chart-foot {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    margin-top: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-foot-item {
    min-height: 38px;
    padding: 6px 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-foot-item span {
    font-size: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-overview-chart .chart-foot-item strong {
    font-size: 14px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-stack {
    display: grid;
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card {
    gap: 6px;
    min-height: 0;
    padding: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .radial-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .radial-card-head small {
    font-size: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .radial-card-head h3 {
    font-size: 13px;
    line-height: 1.12;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .console-pill {
    max-width: 86px;
    min-height: 27px;
    padding-inline: 8px;
    font-size: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-card-body {
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-ring {
    width: 54px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-ring::after {
    inset: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-ring strong {
    font-size: 16px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-ring span {
    font-size: 9px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-copy {
    gap: 5px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-copy > strong {
    font-size: 13px;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-copy > span {
    display: -webkit-box;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.28;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }

  [data-admin-v2="true"] .v2-dedicated-gauge-card .score-progress {
    height: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-main-panel,
  [data-admin-v2="true"] .v2-dedicated-side-panel {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  [data-admin-v2="true"] .v2-dedicated-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-kpi-card {
    display: grid;
    gap: 6px;
    min-height: 92px;
    padding: 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-kpi-card strong {
    color: var(--console-text);
    font-size: clamp(20px, 1.65vw, 27px);
    line-height: 1;
  }

  [data-admin-v2="true"] .v2-dedicated-kpi-card span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--console-muted);
    font-size: 12px;
    line-height: 1.28;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  [data-admin-v2="true"] .v2-dedicated-sparkline {
    align-self: end;
    width: 100%;
    height: 22px;
  }

  [data-admin-v2="true"] .v2-dedicated-sparkline polyline {
    fill: none;
    stroke: var(--console-line);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4;
    filter: drop-shadow(0 0 10px color-mix(in oklab, var(--console-line), transparent 50%));
  }

  [data-admin-v2="true"] .v2-dedicated-panel-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr);
    gap: 8px;
    align-items: start;
  }

  [data-admin-v2="true"] .v2-dedicated-chart-panel,
  [data-admin-v2="true"] .v2-dedicated-side-panel article {
    display: grid;
    gap: 9px;
    padding: 10px;
    align-content: start;
  }

  [data-admin-v2="true"] .v2-dedicated-chart-panel .section-head {
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-chart-panel .section-head h3,
  [data-admin-v2="true"] .v2-dedicated-side-panel h3 {
    margin: 4px 0 0;
    font-size: 16px;
    line-height: 1.15;
  }

  [data-admin-v2="true"] .v2-dedicated-chart-panel .section-head p {
    display: -webkit-box;
    overflow: hidden;
    margin: 5px 0 0;
    font-size: 12px;
    line-height: 1.32;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  [data-admin-v2="true"] .v2-dedicated-bars {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 10px;
  }

  [data-admin-v2="true"] .v2-dedicated-bars div {
    display: grid;
    gap: 4px;
  }

  [data-admin-v2="true"] .v2-dedicated-bars span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--console-muted);
    font-size: 11px;
    line-height: 1.2;
  }

  [data-admin-v2="true"] .v2-dedicated-bars strong {
    color: var(--console-text);
    white-space: nowrap;
  }

  [data-admin-v2="true"] .v2-dedicated-bars i {
    display: block;
    height: 7px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--console-line), var(--console-cyan));
  }

  [data-admin-v2="true"] .v2-dedicated-insights {
    display: grid;
    gap: 7px;
  }

  [data-admin-v2="true"] .v2-dedicated-insights p,
  [data-admin-v2="true"] .v2-dedicated-side-panel p {
    margin: 0;
    color: var(--console-muted);
    font-size: 12px;
    line-height: 1.35;
  }

  [data-admin-v2="true"] .v2-dedicated-meta-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-dedicated-event-list {
    display: grid;
    gap: 6px;
  }

  [data-admin-v2="true"] .v2-dedicated-event-list span {
    display: grid;
    gap: 3px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 86%);
    border-radius: 12px;
    padding: 8px;
    background: color-mix(in oklab, var(--console-panel-2), transparent 8%);
  }

  [data-admin-v2="true"] .v2-dedicated-event-list strong,
  [data-admin-v2="true"] .v2-dedicated-side-panel h3 {
    color: var(--console-text);
  }

  [data-admin-v2="true"] .v2-command-system,
  [data-admin-v2="true"] .v2-ops-command-deck {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 14px;
  }

  [data-admin-v2="true"] .v2-command-flow-map {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  [data-admin-v2="true"] .v2-command-flow-nodes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  [data-admin-v2="true"] .v2-command-node {
    position: relative;
    display: grid;
    align-content: start;
    gap: 7px;
    min-height: 132px;
    padding: 13px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 80%);
    border-radius: 16px;
    background:
      radial-gradient(circle at 0 0, color-mix(in oklab, var(--console-line), transparent 86%), transparent 46%),
      color-mix(in oklab, var(--console-panel), transparent 8%);
  }

  [data-admin-v2="true"] .v2-command-node::after {
    content: attr(data-index);
    position: absolute;
    right: 12px;
    top: 10px;
    color: color-mix(in oklab, var(--console-line), transparent 48%);
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 900;
  }

  [data-admin-v2="true"] .v2-command-node small,
  [data-admin-v2="true"] .v2-ops-action-panel small,
  [data-admin-v2="true"] .v2-ops-queue-panel small {
    color: var(--console-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 850;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-command-node strong,
  [data-admin-v2="true"] .v2-ops-action-panel > strong,
  [data-admin-v2="true"] .v2-ops-queue-panel > strong {
    color: var(--console-text);
    font-size: 16px;
    line-height: 1.2;
  }

  [data-admin-v2="true"] .v2-command-node span:not(.console-action-glyph),
  [data-admin-v2="true"] .v2-ops-action-panel p {
    color: var(--console-muted);
    line-height: 1.35;
  }

  [data-admin-v2="true"] .v2-command-evidence {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-command-evidence span {
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 80%);
    border-radius: 999px;
    padding: 7px 10px;
    color: var(--console-text);
    background: color-mix(in oklab, var(--console-panel-2), transparent 12%);
    font-size: 12px;
  }

  [data-admin-v2="true"] .v2-ops-command-deck {
    margin-top: 14px;
    border-top: 1px solid color-mix(in oklab, var(--console-line), transparent 86%);
    padding-top: 14px;
  }

  [data-admin-v2="true"] .v2-ops-command-grid {
    display: grid;
    grid-template-columns: minmax(260px, .78fr) minmax(0, 1.22fr);
    gap: 12px;
  }

  [data-admin-v2="true"] .v2-ops-action-panel,
  [data-admin-v2="true"] .v2-ops-queue-panel {
    display: grid;
    gap: 10px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 82%);
    border-radius: 16px;
    padding: 14px;
    background: color-mix(in oklab, var(--console-panel), transparent 7%);
  }

  [data-admin-v2="true"] .v2-action-stack {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-ops-queue-list {
    display: grid;
    gap: 8px;
  }

  [data-admin-v2="true"] .v2-ops-queue-list button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 84%);
    border-radius: 14px;
    padding: 10px;
    color: var(--console-text);
    text-align: left;
    background: color-mix(in oklab, var(--console-panel-2), transparent 8%);
  }

  [data-admin-v2="true"] .v2-ops-queue-list button:hover,
  [data-admin-v2="true"] .v2-ops-queue-list button:focus-visible {
    border-color: color-mix(in oklab, var(--console-line), transparent 55%);
    outline: none;
    transform: translateY(-1px);
  }

  [data-admin-v2="true"] .v2-ops-queue-list strong,
  [data-admin-v2="true"] .v2-ops-queue-list small {
    display: block;
    min-width: 0;
  }

  [data-admin-v2="true"] .v2-ops-queue-list small {
    margin-top: 3px;
    color: var(--console-muted);
    line-height: 1.3;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-studio,
  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-table-wrap,
  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-report-dock,
  [data-admin-v2="true"][data-od-theme="light"] .v2-report-preview,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-node,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-action-panel,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-panel,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-list button {
    border-color: rgba(34, 146, 44, .24) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 14% 0%, rgba(17, 169, 111, .14), transparent 38%),
      linear-gradient(180deg, rgba(255, 255, 250, .97), rgba(244, 255, 233, .92)) !important;
    box-shadow:
      0 22px 56px rgba(52, 91, 45, .13),
      inset 0 1px 0 rgba(255, 255, 255, .9) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-studio::before {
    background:
      linear-gradient(90deg, rgba(34, 146, 44, .08) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 146, 44, .07) 1px, transparent 1px);
    opacity: .58;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-table th {
    color: #506555 !important;
    background: #f5ffe9 !important;
    box-shadow: 0 1px 0 rgba(34, 146, 44, .18);
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-table td,
  [data-admin-v2="true"][data-od-theme="light"] .v2-report-preview strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-report-preview pre,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-node strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-evidence span,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-action-panel > strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-panel > strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-list strong {
    color: #07160c !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-table code,
  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-filters label,
  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-report-dock label,
  [data-admin-v2="true"][data-od-theme="light"] .v2-report-preview > div,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-node small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-node span:not(.console-action-glyph),
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-action-panel small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-action-panel p,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-panel small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ops-queue-list small {
    color: #506555 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-table tr[data-selected="true"] {
    background:
      linear-gradient(90deg, rgba(169, 255, 48, .28), transparent 44%),
      rgba(240, 255, 221, .9) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-report-preview pre,
  [data-admin-v2="true"][data-od-theme="light"] .v2-command-evidence span {
    border-color: rgba(34, 146, 44, .18) !important;
    background: rgba(255, 255, 250, .82) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-dialog-scrim {
    background:
      radial-gradient(circle at 24% 8%, rgba(128, 255, 64, .28), transparent 36%),
      rgba(226, 239, 222, .78) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-coach-analytics-dialog {
    border-color: rgba(34, 146, 44, .3) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 8% 0%, rgba(17, 169, 111, .16), transparent 34%),
      radial-gradient(circle at 86% 12%, rgba(46, 196, 112, .12), transparent 30%),
      linear-gradient(180deg, #fffffa, #edf8e4) !important;
    box-shadow:
      0 36px 100px rgba(36, 68, 36, .24),
      inset 0 1px 0 rgba(255, 255, 255, .92) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-summary-strip span,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-kpi-card,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-chart-panel,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-overview-chart,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-side-panel article,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-meta-grid span,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-tabs,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-event-list span {
    border-color: rgba(34, 146, 44, .22) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 16% 0%, rgba(17, 169, 111, .13), transparent 38%),
      rgba(255, 255, 250, .86) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .9) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-identity h2,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-summary-strip strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-kpi-card strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-bars strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-meta-grid strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-event-list strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-side-panel h3 {
    color: #07160c !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-identity p,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-summary-strip small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-kpi-card small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-kpi-card span,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-bars span,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-insights p,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-side-panel p,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-meta-grid small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-dedicated-event-list small {
    color: #506555 !important;
  }

  [data-admin-v2="true"] .v2-ai-ops-bridge {
    display: grid;
    gap: 14px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 74%);
    border-radius: 22px;
    padding: 18px;
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--console-line), transparent 88%), transparent 44%),
      color-mix(in oklab, var(--console-panel), #000 18%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06);
  }

  [data-admin-v2="true"] .v2-ai-ops-primary small {
    display: block;
    color: var(--console-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
  }

  [data-admin-v2="true"] .v2-ai-ops-primary strong {
    display: block;
    margin-top: 6px;
    color: var(--console-text);
    font-size: clamp(18px, 2vw, 28px);
    line-height: 1.08;
  }

  [data-admin-v2="true"] .v2-ai-ops-primary p {
    margin: 10px 0 0;
    color: var(--console-muted);
  }

  [data-admin-v2="true"] .v2-ai-bot-pill {
    position: relative;
    isolation: isolate;
    width: 62px;
    height: 62px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 46%);
    border-radius: 22px;
    color: var(--console-ink);
    background:
      radial-gradient(circle at 50% 22%, color-mix(in oklab, var(--console-line), transparent 72%), transparent 52%),
      radial-gradient(circle at 72% 78%, color-mix(in oklab, var(--console-cyan), transparent 60%), transparent 38%),
      linear-gradient(145deg, color-mix(in oklab, var(--console-panel), #ffffff 4%), color-mix(in oklab, var(--console-panel), #000000 12%));
    box-shadow:
      0 0 0 7px color-mix(in oklab, var(--console-line), transparent 88%),
      0 0 34px color-mix(in oklab, var(--console-line), transparent 42%),
      0 18px 42px rgba(0, 0, 0, .3);
    transform-style: preserve-3d;
    animation: admin-v2-ai-bot-float 4.8s ease-in-out infinite;
  }

  [data-admin-v2="true"] .v2-ai-bot-pill-svg {
    width: 60px;
    height: 60px;
  }

  [data-admin-v2="true"] .v2-ai-bot-pill::before,
  [data-admin-v2="true"] .v2-ai-bot-pill::after {
    content: "";
    position: absolute;
    inset: -10px;
    z-index: -1;
    border-radius: 28px;
    background: radial-gradient(circle, color-mix(in oklab, var(--console-line), transparent 48%), transparent 68%);
    opacity: .72;
    animation: admin-v2-ai-bot-halo 2.8s ease-in-out infinite;
  }

  [data-admin-v2="true"] .v2-ai-bot-pill::after {
    inset: -18px;
    opacity: .34;
    animation-delay: .8s;
  }

  [data-admin-v2="true"] .v2-ai-bot-label {
    position: absolute;
    right: 8px;
    bottom: 7px;
    display: grid;
    place-items: center;
    width: 21px;
    height: 21px;
    border: 1px solid rgba(255, 255, 255, .56);
    border-radius: 999px;
    background: rgba(5, 29, 18, .52);
    color: #f7fff8;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0;
    box-shadow: 0 7px 16px rgba(0, 0, 0, .28);
  }

  @keyframes admin-v2-ai-bot-float {
    0%, 100% {
      transform: translate3d(0, 0, 0) rotate(-1deg);
    }
    50% {
      transform: translate3d(0, -5px, 0) rotate(2deg);
    }
  }

  @keyframes admin-v2-ai-bot-halo {
    0%, 100% {
      transform: scale(.84);
      opacity: .26;
    }
    50% {
      transform: scale(1.08);
      opacity: .58;
    }
  }

  [data-admin-v2="true"] .v2-ai-ops-queue {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  [data-admin-v2="true"] .v2-ai-ops-queue button {
    display: grid;
    gap: 6px;
    min-height: 96px;
    padding: 12px;
    border: 1px solid color-mix(in oklab, var(--console-line), transparent 80%);
    border-radius: 16px;
    color: var(--console-text);
    text-align: left;
    background: color-mix(in oklab, var(--console-panel-2), transparent 4%);
  }

  [data-admin-v2="true"] .v2-ai-ops-queue button:hover {
    border-color: color-mix(in oklab, var(--console-line), transparent 52%);
    transform: translateY(-1px);
  }

  [data-admin-v2="true"] .v2-ai-ops-queue small {
    color: var(--console-muted);
  }

  [data-admin-v2="true"] .v2-ai-ops-bridge {
    margin-top: 16px;
  }

  [data-admin-v2="true"] .v2-ai-ops-primary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-bridge,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-queue button {
    border-color: rgba(34, 146, 44, .25) !important;
    color: #07160c !important;
    background:
      radial-gradient(circle at 12% 0%, rgba(17, 169, 111, .16), transparent 40%),
      linear-gradient(180deg, rgba(255, 255, 250, .96), rgba(244, 255, 233, .92)) !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-primary strong,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-queue strong {
    color: #07160c !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-queue small,
  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-ops-primary p {
    color: #506555 !important;
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-bot-pill {
    border-color: rgba(34, 146, 44, .34);
    background:
      radial-gradient(circle at 50% 22%, rgba(139, 219, 70, .28), transparent 52%),
      radial-gradient(circle at 72% 78%, rgba(0, 174, 128, .2), transparent 38%),
      linear-gradient(145deg, rgba(236, 252, 221, .9), rgba(215, 241, 209, .94));
    box-shadow:
      0 0 0 7px rgba(128, 214, 54, .14),
      0 0 30px rgba(46, 196, 112, .3),
      0 18px 38px rgba(32, 111, 61, .22);
  }

  [data-admin-v2="true"][data-od-theme="light"] .v2-ai-bot-label {
    background: rgba(6, 54, 32, .68);
    color: #fafff3;
  }

  @media (max-width: 980px) {
    [data-admin-v2="true"] .v2-command-flow-nodes,
    [data-admin-v2="true"] .v2-ops-command-grid {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-action-stack {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-coach-analytics-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .v2-coach-analytics-filters .btn {
      min-height: 46px;
    }

    [data-admin-v2="true"] .v2-coach-row-actions {
      flex-wrap: wrap;
    }

    [data-admin-v2="true"] .v2-coach-analytics-dialog-layer {
      padding: 14px;
    }

    [data-admin-v2="true"] .v2-dedicated-header,
    [data-admin-v2="true"] .v2-dedicated-body,
    [data-admin-v2="true"] .v2-dedicated-visual-grid,
    [data-admin-v2="true"] .v2-dedicated-panel-grid {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-dedicated-header {
      display: grid;
      align-items: start;
    }

    [data-admin-v2="true"] .v2-dedicated-header-actions {
      justify-content: flex-start;
    }

    [data-admin-v2="true"] .v2-dedicated-summary-strip,
    [data-admin-v2="true"] .v2-dedicated-kpi-grid,
    [data-admin-v2="true"] .v2-dedicated-meta-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .v2-dedicated-gauge-stack {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .v2-coach-report-dock {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-coach-report-dock .section-head,
    [data-admin-v2="true"] .v2-coach-report-dock .v2-report-actions,
    [data-admin-v2="true"] .v2-report-preview {
      grid-column: auto;
      grid-row: auto;
    }

  }

  @media (max-width: 640px) {
    [data-admin-v2="true"] .v2-coach-analytics-filters {
      grid-template-columns: 1fr;
    }

    [data-admin-v2="true"] .v2-report-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    [data-admin-v2="true"] .v2-coach-analytics-dialog {
      width: 100%;
      max-height: 94vh;
      border-radius: 22px;
      padding: 14px;
    }

    [data-admin-v2="true"] .v2-dedicated-identity {
      align-items: flex-start;
    }

    [data-admin-v2="true"] .v2-dedicated-header-actions .btn {
      min-height: 42px;
    }

    [data-admin-v2="true"] .v2-dedicated-summary-strip,
    [data-admin-v2="true"] .v2-dedicated-kpi-grid,
    [data-admin-v2="true"] .v2-dedicated-meta-grid,
    [data-admin-v2="true"] .v2-dedicated-gauge-stack {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-admin-v2="true"] .v2-ai-bot-pill,
    [data-admin-v2="true"] .v2-ai-bot-pill::before,
    [data-admin-v2="true"] .v2-ai-bot-pill::after {
      animation: none !important;
    }
  }

  [data-admin-v2="true"][data-theme-sweep="active"]::after {
    content: none !important;
    display: none !important;
  }

  [data-admin-v2="true"][data-theme-sweep="active"][data-od-theme="light"]::after {
    content: none !important;
    display: none !important;
  }
`;

function AdminV2OdRuntimeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: ADMIN_V2_OD_RUNTIME_CSS }} />;
}

function AdminV2DashboardAddon({
  actions,
  analyticsRange,
  analyticsRangeMeta,
  analyticsSource,
  dataUpdatedAt,
  onAnalyticsRangeChange,
  onAIContextChange,
  onSelect,
  selectedView,
  snapshot,
  status,
  timeSeries
}: {
  actions: AdminV2ModuleAction[];
  analyticsRange: AnalyticsDateRangeId;
  analyticsRangeMeta: AnalyticsEventRange | null;
  analyticsSource: string;
  dataUpdatedAt: string;
  onAnalyticsRangeChange: (range: AnalyticsDateRangeId) => void;
  onAIContextChange: (context: AdminAITableContext) => void;
  onSelect: (viewId: AdminV2ViewId) => void;
  selectedView: AdminV2ViewId;
  snapshot: AdminV2DashboardData | null;
  status: AdminV2DataStatus | "loading";
  timeSeries: AnalyticsTimeSeriesPoint[];
}) {
  return (
    <AdminV2OdDashboard
      actions={actions}
      analyticsRange={analyticsRange}
      analyticsRangeMeta={analyticsRangeMeta}
      analyticsSource={analyticsSource}
      dataUpdatedAt={dataUpdatedAt}
      onAnalyticsRangeChange={onAnalyticsRangeChange}
      onAIContextChange={onAIContextChange}
      onSelect={onSelect}
      selectedView={selectedView}
      snapshot={snapshot}
      status={status}
      timeSeries={timeSeries}
    />
  );
}

function AdminV2OdDashboard({
  actions,
  analyticsRange,
  analyticsRangeMeta,
  analyticsSource,
  dataUpdatedAt,
  onAnalyticsRangeChange,
  onAIContextChange,
  onSelect,
  selectedView,
  snapshot,
  status,
  timeSeries
}: {
  actions: AdminV2ModuleAction[];
  analyticsRange: AnalyticsDateRangeId;
  analyticsRangeMeta: AnalyticsEventRange | null;
  analyticsSource: string;
  dataUpdatedAt: string;
  onAnalyticsRangeChange: (range: AnalyticsDateRangeId) => void;
  onAIContextChange: (context: AdminAITableContext) => void;
  onSelect: (viewId: AdminV2ViewId) => void;
  selectedView: AdminV2ViewId;
  snapshot: AdminV2DashboardData | null;
  status: AdminV2DataStatus | "loading";
  timeSeries: AnalyticsTimeSeriesPoint[];
}) {
  const metrics = useMemo(() => getAdminV2OdMetrics(snapshot), [snapshot]);
  const coachSites = useMemo(
    () => snapshot?.sources.coachSites.data || [],
    [snapshot?.sources.coachSites.data]
  );
  const errorReports = useMemo(
    () => snapshot?.sources.errorReports.data || [],
    [snapshot?.sources.errorReports.data]
  );
  const [coachTableQuery, setCoachTableQuery] = useState("");
  const [coachStatusFilter, setCoachStatusFilter] = useState<"all" | CoachSiteStatus>("all");
  const [coachSourceFilter, setCoachSourceFilter] = useState("all");
  const [coachPaymentFilter, setCoachPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [coachPage, setCoachPage] = useState(0);
  const audienceRegions = useMemo(
    () => snapshot?.sources.analyticsEvents.data?.audienceRegions || [],
    [snapshot?.sources.analyticsEvents.data?.audienceRegions]
  );
  const topCoach = coachSites[0];
  const unresolvedErrors = errorReports.filter(
    (report) => report.status !== "Fixed" && report.status !== "Ignored"
  ).length;
  const currentCoachSites = coachSites.filter(
    (site) => site.status !== "archived" && site.status !== "removed"
  );
  const paidCoachCount = currentCoachSites.filter((site) =>
    Boolean(site.existingPaidFunnelUrl)
  ).length;
  const freeCoachCount = currentCoachSites.filter((site) =>
    Boolean(site.publicUrl || site.slug)
  ).length;
  const publishedCoachCount = coachSites.filter((site) => site.status === "published").length;
  const activeCoachCount = currentCoachSites.filter(
    (site) =>
      site.status === "published" ||
      (site.analytics?.totalVisits || 0) > 0 ||
      (site.analytics?.totalRegisterClicks || 0) > 0
  ).length;
  const funnelReadyCoachCount = currentCoachSites.filter((site) =>
    Boolean(site.publicUrl || site.slug || site.existingPaidFunnelUrl)
  ).length;
  const coachActivityScore = getAdminV2RatioScore(activeCoachCount, currentCoachSites.length);
  const funnelCoverageScore = getAdminV2RatioScore(funnelReadyCoachCount, currentCoachSites.length);
  const supportHealthScore = clampAdminV2Score(100 - unresolvedErrors * 22);
  const coachSourceOptions = useMemo(
    () =>
      Array.from(
        new Set(
          coachSites
            .map((site) => site.analytics?.source?.trim())
            .filter((source): source is string => Boolean(source))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [coachSites]
  );
  const filteredCoachSites = useMemo(() => {
    const query = coachTableQuery.trim().toLowerCase();

    return coachSites.filter((site) => {
      if (
        query &&
        ![site.coachName, site.niche, site.slug, site.location, site.analytics?.source]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (coachStatusFilter !== "all" && site.status !== coachStatusFilter) return false;
      if (coachSourceFilter !== "all" && site.analytics?.source?.trim() !== coachSourceFilter) {
        return false;
      }
      if (coachPaymentFilter === "paid" && !site.existingPaidFunnelUrl) return false;
      if (coachPaymentFilter === "unpaid" && site.existingPaidFunnelUrl) return false;
      return true;
    });
  }, [coachPaymentFilter, coachSourceFilter, coachStatusFilter, coachTableQuery, coachSites]);
  const coachPageCount = Math.max(1, Math.ceil(filteredCoachSites.length / 4));
  const safeCoachPage = Math.min(coachPage, coachPageCount - 1);
  const dashboardCoachRows = useMemo(
    () => filteredCoachSites.slice(safeCoachPage * 4, safeCoachPage * 4 + 4),
    [filteredCoachSites, safeCoachPage]
  );
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: {
        analyticsRange,
        payment: coachPaymentFilter,
        query: coachTableQuery,
        source: coachSourceFilter,
        status: coachStatusFilter
      },
      rows: dashboardCoachRows.map((site) => ({
        duplicateKey: normalizeCoachSlug(site.slug || site.coachName),
        groupKey: site.location || "unassigned-region",
        id: site.id || site.slug,
        label: site.coachName || site.slug,
        requiredDataComplete: Boolean(site.coachName && site.slug),
        status: site.status,
        unresolvedErrors: errorReports.filter(
          (report) =>
            report.status !== "Fixed" &&
            report.status !== "Ignored" &&
            (report.coachSlug === site.slug || report.pagePath.includes(`/coach/${site.slug}`))
        ).length
      })),
      selectedIds: [],
      sort: { direction: "desc", field: "visits" },
      tableId: "overview-coach-performance"
    }),
    [
      analyticsRange,
      coachPaymentFilter,
      coachSourceFilter,
      coachStatusFilter,
      coachTableQuery,
      dashboardCoachRows,
      errorReports
    ]
  );

  useEffect(() => {
    onAIContextChange(tableAiContext);
  }, [onAIContextChange, tableAiContext]);
  const topRegion = audienceRegions[0]?.label || topCoach?.location || "No region data";
  const overviewGauges = [
    {
      actionIcon: "chart" as const,
      actionLabel: "Review",
      label: "Performance score",
      note: `${metrics.totalVisits.toLocaleString("en-IN")} visits / ${metrics.totalRegisterClicks.toLocaleString("en-IN")} CTA clicks in this range.`,
      onAction: () => onSelect("coach-analytics"),
      title: "Total Performance",
      tone: "accent" as const,
      value: metrics.performanceScore
    },
    {
      actionIcon: "payments" as const,
      actionLabel: "Tracked",
      label: "Success rate",
      note: getSnapshotMetric(snapshot, "payment-success")
        ? `${getSnapshotMetric(snapshot, "payment-success").toLocaleString("en-IN")} payment success events tracked.`
        : "No payment success event recorded yet.",
      onAction: () => onSelect("paid-masterclass-settings"),
      title: "Payment Health",
      tone: "success" as const,
      value: metrics.paymentHealth
    },
    {
      actionIcon: "users" as const,
      actionLabel: "Open Analytics",
      label: "Active coverage",
      note: currentCoachSites.length
        ? `${activeCoachCount.toLocaleString("en-IN")} / ${currentCoachSites.length.toLocaleString("en-IN")} current coaches are active, published, or receiving activity.`
        : "No current coach records are available yet.",
      onAction: () => onSelect("coach-analytics"),
      title: "Coach Activity",
      tone: "cyan" as const,
      value: coachActivityScore
    },
    {
      actionIcon: "site" as const,
      actionLabel: "Open Sites",
      label: "Referral / paid coverage",
      note: currentCoachSites.length
        ? `${funnelReadyCoachCount.toLocaleString("en-IN")} / ${currentCoachSites.length.toLocaleString("en-IN")} current coaches have a referral or paid funnel path.`
        : "No current coach records are available for funnel coverage.",
      onAction: () => onSelect("coach-sites"),
      title: "Funnel Coverage",
      tone: "accent" as const,
      value: funnelCoverageScore
    },
    {
      actionIcon: "reports" as const,
      actionLabel: "Open Reports",
      label: "Report control",
      note: unresolvedErrors
        ? `${unresolvedErrors.toLocaleString("en-IN")} unresolved report${unresolvedErrors === 1 ? "" : "s"} still need review.`
        : "No unresolved reports in the current list.",
      onAction: () => onSelect("error-reports"),
      title: "Support Health",
      tone: unresolvedErrors ? ("warning" as const) : ("success" as const),
      value: supportHealthScore
    }
  ];

  return (
    <div className="dashboard-console" aria-label="Overview analytics">
      <div className="console-chrome">
        <div className="console-tabs" aria-label="Date range">
          <span className="console-pill">Date range</span>
          {(
            [
              { id: "today", label: "Today" },
              { id: "7d", label: "7 days" },
              { id: "30d", label: "30 days" },
              { id: "90d", label: "90 days" }
            ] as Array<{ id: AnalyticsDateRangeId; label: string }>
          ).map((range) => (
            <button
              aria-pressed={analyticsRange === range.id}
              className={`console-pill${analyticsRange === range.id ? " is-active" : ""}`}
              key={range.id}
              onClick={() => onAnalyticsRangeChange(range.id)}
              type="button"
            >
              {range.label}
            </button>
          ))}
          <button
            aria-label="Open custom analytics range controls"
            aria-pressed={analyticsRange === "custom"}
            className={`console-pill${analyticsRange === "custom" ? " is-active" : ""}`}
            onClick={() => onSelect("coach-analytics")}
            type="button"
          >
            Custom
          </button>
        </div>
        <div className="console-actions">
          <span className="console-pill">
            <span className="console-dot" />
            {status === "loading" ? "Loading admin data" : "Live admin data"}
          </span>
          <button
            className="console-pill console-command-pill"
            onClick={() => onSelect("coach-analytics")}
            type="button"
          >
            <AdminV2ActionGlyph name="chart" />
            <span>Open Analytics</span>
          </button>
        </div>
      </div>

      <div className="dashboard-grid" aria-label="Overview grid">
        <section
          className="console-card console-hero dashboard-wallet"
          aria-label="Wallet and balance cards"
        >
          <div>
            <div className="console-eyebrow">
              <span className="console-dot" /> Business command center
            </div>
            <h2>Revenue readiness</h2>
            <p>
              Finance, site purchases, refunds, and unpaid payment risk stay visible as a contract
              until trusted revenue data exists.
            </p>
            <div className="balance">
              <strong>--</strong>
              <span>Revenue source missing</span>
            </div>
            <div className="finance-actions">
              <button
                className="console-btn is-primary"
                onClick={() => onSelect("shop")}
                type="button"
              >
                Review Shop Source
              </button>
              <button
                className="console-btn console-command-btn"
                onClick={() => onSelect("paid-masterclass-settings")}
                type="button"
              >
                <AdminV2ActionGlyph name="payments" />
                <span>Open Payments</span>
              </button>
            </div>
          </div>
          <div className="finance-ledger" aria-label="Finance wallet summaries">
            <div className="finance-card">
              <div>
                <small>Revenue source</small>
                <strong>Missing</strong>
              </div>
              <span>Wire trusted field</span>
            </div>
            <div className="finance-card">
              <div>
                <small>Pending payout</small>
                <strong>--</strong>
              </div>
              <span>Source missing</span>
            </div>
            <div className="finance-card">
              <div>
                <small>Refund exposure</small>
                <strong>--</strong>
              </div>
              <span>Source missing</span>
            </div>
          </div>
        </section>

        <main className="dashboard-primary" aria-label="KPI cards and main analytics chart">
          <div className="console-mini-grid kpi-row" aria-label="KPI cards row">
            <AdminV2OdKpiCard
              deltaLabel="Current"
              label="Active coaches"
              meta={`${publishedCoachCount.toLocaleString("en-IN")} current records live`}
              points="4,36 30,36 54,30 78,30 102,22 128,22 156,14"
              value={publishedCoachCount.toLocaleString("en-IN")}
            />
            <AdminV2OdKpiCard
              deltaLabel={metrics.visitDeltaLabel}
              deltaTone={metrics.visitDeltaTone}
              label="Live visits"
              meta={`${metrics.visitDeltaLabel} vs previous`}
              points="4,38 26,36 52,28 78,32 104,18 130,15 156,8"
              value={metrics.totalVisits.toLocaleString("en-IN")}
            />
            <AdminV2OdKpiCard
              deltaLabel={unresolvedErrors ? "Open" : "Clear"}
              deltaTone={unresolvedErrors ? "warning" : "positive"}
              label="Error reports"
              meta={unresolvedErrors ? "Open support prompts" : "No open reports"}
              points="4,38 28,38 48,20 68,34 90,16 116,16 154,10"
              value={unresolvedErrors.toLocaleString("en-IN")}
            />
            <AdminV2OdKpiCard
              deltaLabel="No pending"
              label="Shop orders"
              meta="No pending payments"
              points="6,36 154,36"
              value={getSnapshotMetric(snapshot, "payment-success").toLocaleString("en-IN")}
            />
          </div>

          <AdminV2ActivityChart
            dataFreshness={dataUpdatedAt ? formatSignalTime(dataUpdatedAt) : "Not loaded"}
            key={analyticsRange}
            loading={analyticsSource === "loading"}
            onRangeChange={onAnalyticsRangeChange}
            range={analyticsRange}
            rangeLabel={analyticsRangeMeta?.label || analyticsRange.toUpperCase()}
            source={analyticsSource}
            timeSeries={timeSeries}
          />
        </main>

        <aside
          className="risk-stack dashboard-right"
          aria-label="Right-side radial and progress panels"
          data-gauge-density="expanded"
        >
          {overviewGauges.map((gauge) => (
            <AdminV2OdRadialCard
              actionIcon={gauge.actionIcon}
              actionLabel={gauge.actionLabel}
              key={gauge.title}
              label={gauge.label}
              note={gauge.note}
              onAction={gauge.onAction}
              title={gauge.title}
              tone={gauge.tone}
              value={gauge.value}
            />
          ))}
        </aside>

        <section className="console-card dashboard-table" aria-label="Data table">
          <div className="console-chart-head">
            <div>
              <h3>Coach performance table</h3>
              <p>
                Search and filter the production coach preview, then open the full Sites workspace
                for record actions.
              </p>
            </div>
            <div className="row-actions">
              <AdminAIAskButton
                className="btn btn-sm"
                label="Analyze coach performance table"
                query="Summarize the visible coach performance table and identify records needing attention."
                scope="page"
              />
            </div>
          </div>
          <div className="admin-table-shell">
            <div className="table-toolbar" aria-label="Coach table controls">
              <div className="smart-search">
                <label htmlFor="coach-table-search">Search</label>
                <input
                  aria-label="Search coach performance table"
                  id="coach-table-search"
                  onChange={(event) => {
                    setCoachTableQuery(event.currentTarget.value);
                    setCoachPage(0);
                  }}
                  placeholder="Coach, niche, slug, source..."
                  type="search"
                  value={coachTableQuery}
                />
                <div className="smart-search-results" role="listbox" hidden />
              </div>
              <select
                aria-label="Coach status"
                onChange={(event) => {
                  setCoachStatusFilter(event.currentTarget.value as "all" | CoachSiteStatus);
                  setCoachPage(0);
                }}
                value={coachStatusFilter}
              >
                <option value="all">All statuses</option>
                {(["published", "draft", "paused", "archived", "removed"] as CoachSiteStatus[]).map(
                  (statusId) => (
                    <option key={statusId} value={statusId}>
                      {formatAdminV2Label(statusId)}
                    </option>
                  )
                )}
              </select>
              <select
                aria-label="Coach source"
                onChange={(event) => {
                  setCoachSourceFilter(event.currentTarget.value);
                  setCoachPage(0);
                }}
                value={coachSourceFilter}
              >
                <option value="all">All sources</option>
                {coachSourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {formatAdminV2Label(source)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Payment status"
                onChange={(event) => {
                  setCoachPaymentFilter(event.currentTarget.value as "all" | "paid" | "unpaid");
                  setCoachPage(0);
                }}
                value={coachPaymentFilter}
              >
                <option value="all">All payments</option>
                <option value="paid">Paid funnel connected</option>
                <option value="unpaid">No paid funnel</option>
              </select>
              <button
                className="console-btn is-primary"
                onClick={() => onSelect("coach-sites")}
                type="button"
              >
                Open Sites
              </button>
            </div>
            <div className="table-wrap admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Status</th>
                    <th>Region</th>
                    <th>Visits</th>
                    <th>CTA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardCoachRows.map((site) => (
                    <tr key={site.id || site.slug}>
                      <td data-label="Coach">
                        <div className="person">
                          <span className="avatar">{getInitials(site.coachName)}</span>
                          <div>
                            <strong>{site.coachName || site.slug}</strong>
                            <small>{site.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className="badge badge-accent">{formatSiteStatus(site.status)}</span>
                      </td>
                      <td data-label="Region">{site.location || "Not available"}</td>
                      <td data-label="Visits">
                        {site.analytics.totalVisits.toLocaleString("en-IN")}
                      </td>
                      <td data-label="CTA">
                        {site.analytics.totalRegisterClicks.toLocaleString("en-IN")}
                      </td>
                      <td data-label="Actions" className="row-actions">
                        <button
                          className="btn btn-sm"
                          onClick={() => onSelect("coach-sites")}
                          type="button"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!dashboardCoachRows.length ? (
                    <tr>
                      <td colSpan={6}>
                        {coachSites.length
                          ? "No coach-site records match the current filters."
                          : "No coach-site records are available yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <span>
                Showing {dashboardCoachRows.length.toLocaleString("en-IN")} of{" "}
                {filteredCoachSites.length.toLocaleString("en-IN")} matching coach records
              </span>
              <div className="row-actions">
                <button
                  className="console-pill"
                  disabled={safeCoachPage <= 0}
                  onClick={() => setCoachPage(Math.max(0, safeCoachPage - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="console-pill"
                  disabled={safeCoachPage >= coachPageCount - 1}
                  onClick={() => setCoachPage(Math.min(coachPageCount - 1, safeCoachPage + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="console-card dashboard-activity" aria-label="Activity insights">
          <div className="insight-card">
            <div className="insight-card-head">
              <div>
                <small>Recent Signals</small>
                <h3>Operational signal</h3>
              </div>
              <button
                aria-label="Open recent error reports"
                className="insight-icon"
                onClick={() => onSelect("error-reports")}
                title="Open recent error reports"
                type="button"
              >
                <AdminV2ActionGlyph name="reports" />
              </button>
            </div>
            <p>
              {topCoach
                ? `${topCoach.coachName} is the first visible coach-site signal in the current feed.`
                : "No coach-site signal available yet."}
            </p>
            <div className="signal-list">
              <div className="signal-row">
                <div>
                  <small>Action</small>
                  <strong>Open report</strong>
                </div>
                <button
                  className="console-btn"
                  onClick={() => onSelect("coach-analytics")}
                  type="button"
                >
                  View Report
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          className="console-card dashboard-map audience-panel"
          aria-label="Audience map by country and region"
        >
          <div className="audience-head">
            <div>
              <h3>Audience map</h3>
              <p>
                Lead geography by country, state, and district from current admin analytics, with
                clickable map drilldown and zoom controls.
              </p>
            </div>
            <div className="console-tabs" aria-label="Audience time range">
              {(
                [
                  { id: "today", label: "24H" },
                  { id: "7d", label: "7D" },
                  { id: "30d", label: "30D" },
                  { id: "90d", label: "90D" }
                ] as Array<{ id: AnalyticsDateRangeId; label: string }>
              ).map((range) => (
                <button
                  aria-pressed={analyticsRange === range.id}
                  className={`console-pill${analyticsRange === range.id ? " is-active" : ""}`}
                  key={range.id}
                  onClick={() => onAnalyticsRangeChange(range.id)}
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <AdminV2AudienceMapPanel
            onAIContextChange={onAIContextChange}
            snapshot={snapshot}
            status={status}
          />
        </section>

        <section className="console-card dashboard-admin-addon" aria-label="Admin module coverage">
          <div className="admin-addon-shell">
            <div className="addon-header">
              <div>
                <div className="console-eyebrow">
                  <span className="console-dot" />
                  Primary rail coverage
                </div>
                <h3>Open admin modules</h3>
              </div>
              <span className="console-pill">Live</span>
            </div>
            <div className="addon-module-grid" aria-label="Admin module summaries">
              {actions.map((action) => {
                const iconName = getAdminV2Icon(action.viewId);

                return (
                  <button
                    className="addon-panel addon-module-shortcut"
                    data-active={selectedView === action.viewId ? "true" : "false"}
                    key={action.id}
                    onClick={() => onSelect(action.viewId)}
                    type="button"
                  >
                    <span className="addon-shortcut-icon" data-icon={iconName} aria-hidden="true">
                      <AdminV2RailIcon name={iconName} />
                    </span>
                    <span className="addon-shortcut-copy">
                      <small>{action.label}</small>
                      <h4>{action.description}</h4>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="addon-module-grid" aria-label="Admin module totals">
              <section className="addon-panel">
                <div className="addon-panel-head">
                  <div>
                    <small>Coach sites</small>
                    <h4>Lifecycle health</h4>
                  </div>
                  <button
                    className="console-pill"
                    onClick={() => onSelect("coach-sites")}
                    type="button"
                  >
                    Live records
                  </button>
                </div>
                <div className="addon-mini-list">
                  <div className="addon-mini-row">
                    <span>Referral / paid</span>
                    <strong>
                      {freeCoachCount} / {paidCoachCount}
                    </strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Top region</span>
                    <strong>{topRegion}</strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Published</span>
                    <strong>{publishedCoachCount}</strong>
                  </div>
                </div>
              </section>
              <section className="addon-panel">
                <div className="addon-panel-head">
                  <div>
                    <small>Reports maintenance</small>
                    <h4>Backup and cleanup command center</h4>
                  </div>
                  <button
                    className="console-pill"
                    onClick={() => onSelect("error-reports")}
                    type="button"
                  >
                    Open Reports
                  </button>
                </div>
                <div className="addon-mini-list">
                  <div className="addon-mini-row">
                    <span>Active reports</span>
                    <strong>{unresolvedErrors}</strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Cleanup</span>
                    <strong>Owner confirmation</strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Audit trail</span>
                    <strong>Admin-only event log</strong>
                  </div>
                </div>
              </section>
              <section className="addon-panel">
                <div className="addon-panel-head">
                  <div>
                    <small>Settings workspace</small>
                    <h4>Admin users and support defaults</h4>
                  </div>
                  <button
                    className="console-pill"
                    onClick={() => onSelect("settings")}
                    type="button"
                  >
                    Open Settings
                  </button>
                </div>
                <div className="addon-mini-list">
                  <div className="addon-mini-row">
                    <span>Admin users</span>
                    <strong>Roles, invites, permissions</strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Support defaults</span>
                    <strong>Default contact fields</strong>
                  </div>
                  <div className="addon-mini-row">
                    <span>Security status</span>
                    <strong>Cookies, CSRF, RBAC</strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminV2OdKpiCard({
  deltaLabel,
  deltaTone = "positive",
  label,
  meta,
  points,
  value
}: {
  deltaLabel: string;
  deltaTone?: "negative" | "positive" | "warning";
  label: string;
  meta: string;
  points: string;
  value: string;
}) {
  return (
    <article className="console-mini">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span className={`kpi-meta is-${deltaTone === "negative" ? "negative" : "positive"}`}>
          {meta}
        </span>
      </div>
      <svg viewBox="0 0 160 46" aria-hidden="true">
        <polyline points={points} />
      </svg>
      <span
        className="console-pill kpi-delta"
        style={
          deltaTone === "negative"
            ? {
                background: "rgba(255, 90, 95, .12)",
                borderColor: "rgba(255, 90, 95, .35)",
                color: "var(--danger)"
              }
            : deltaTone === "warning"
              ? {
                  background: "rgba(247, 201, 72, .12)",
                  borderColor: "rgba(247, 201, 72, .35)",
                  color: "var(--warning)"
                }
              : undefined
        }
      >
        {deltaLabel}
      </span>
    </article>
  );
}

function AdminV2OdRadialCard({
  actionIcon,
  actionLabel,
  label,
  note,
  onAction,
  title,
  tone = "accent",
  value
}: {
  actionIcon: AdminV2IconName;
  actionLabel: string;
  label: string;
  note?: string;
  onAction: () => void;
  title: string;
  tone?: "accent" | "cyan" | "danger" | "success" | "warning";
  value: number;
}) {
  const safeValue = clampAdminV2Score(value);
  const scoreLabel = getAdminV2ScoreLabel(safeValue);
  const scoreTone = getAdminV2ScoreTone(tone);

  return (
    <section className="radial-card score-card" aria-label={title} data-score-tone={tone}>
      <div className="radial-card-head">
        <div>
          <small>{label}</small>
          <h3>{title}</h3>
        </div>
        <button
          aria-label={`${actionLabel} ${title}`}
          className="console-pill console-icon-action"
          onClick={onAction}
          title={actionLabel}
          type="button"
        >
          <AdminV2ActionGlyph name={actionIcon} />
          <span className="sr-only">{actionLabel}</span>
        </button>
      </div>
      <div className="score-card-body">
        <div
          aria-label={`${title} score ${safeValue} percent`}
          className="score-ring"
          role="img"
          style={{ "--score-tone": scoreTone, "--value": safeValue } as CSSProperties}
        >
          <strong>
            {safeValue}
            <span>%</span>
          </strong>
        </div>
        <div className="score-copy">
          <strong>{scoreLabel}</strong>
          <span>{note || `${label} is currently at ${safeValue}%.`}</span>
          <div className="score-progress" aria-hidden="true">
            <i style={{ width: `${safeValue}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function getAdminV2ScoreTone(tone: "accent" | "cyan" | "danger" | "success" | "warning") {
  if (tone === "cyan") return "var(--dash-accent-cyan)";
  if (tone === "danger") return "var(--dash-danger)";
  if (tone === "success") return "var(--dash-accent-soft)";
  if (tone === "warning") return "var(--dash-warning)";
  return "var(--dash-accent)";
}

function isAdminV2CopilotContextLoading(
  view: AdminV2ViewId,
  sources: {
    analyticsSource: string;
    coachSiteSource: string;
    errorReportSource: string;
    snapshotStatus: AdminV2DataStatus | "loading";
  }
) {
  if (view === "coach-sites" || view === "create-coach-site") {
    return sources.coachSiteSource === "loading";
  }
  if (view === "coach-analytics" || view === "top-coaches") {
    return sources.analyticsSource === "loading" || sources.coachSiteSource === "loading";
  }
  if (view === "error-reports" || view === "backup-cleanup") {
    return sources.errorReportSource === "loading" || sources.snapshotStatus === "loading";
  }
  return sources.snapshotStatus === "loading";
}

function getAdminV2ShopAiSnapshot(value: unknown): AdminAIShopSnapshot {
  const payload = isAdminV2UnknownRecord(value) ? value : {};
  const shop = isAdminV2UnknownRecord(payload.shop) ? payload.shop : payload;
  const reports = isAdminV2UnknownRecord(shop.reports) ? shop.reports : {};
  const sites = Array.isArray(shop.sites) ? shop.sites.filter(isAdminV2UnknownRecord) : [];
  const failures = Array.isArray(shop.failures) ? shop.failures.filter(isAdminV2UnknownRecord) : [];
  const paidCountFromRows = sites.filter((site) =>
    ["captured", "paid", "success", "succeeded"].includes(
      String(site.paymentStatus || "")
        .trim()
        .toLowerCase()
    )
  ).length;

  return {
    failedPublishCount: getAdminV2FiniteNumber(reports.failureCount, failures.length),
    paidCount: getAdminV2FiniteNumber(reports.paidCount, paidCountFromRows),
    purchaseCount: getAdminV2FiniteNumber(reports.purchaseCount, sites.length),
    records: sites.slice(0, 120).map((site, index) => ({
      id: String(site.orderId || site.slug || `shop-${index}`).slice(0, 120),
      label: String(site.coachName || site.slug || site.orderId || "Shop order").slice(0, 120),
      status:
        `${String(site.paymentStatus || "unknown")} / ${String(site.siteStatus || "unknown")}`.slice(
          0,
          160
        ),
      updatedAt: String(site.publishedAt || site.paymentDate || site.createdAt || ""),
      workflowStage: String(site.workflowStage || "unknown").slice(0, 120)
    })),
    siteCount: getAdminV2FiniteNumber(reports.siteCount, sites.length)
  };
}

function getAdminV2FiniteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function isAdminV2UnknownRecord(value: unknown): value is AdminV2UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAdminV2BuilderMissingFields(form: CoachSiteFormState) {
  const fields = [
    ["coach name", form.coachName],
    ["public slug", normalizeCoachSlug(form.slug || form.coachName)],
    ["coach bio", form.bio],
    ["niche", form.niche],
    ["vision or mission", form.vision],
    ["registration link", form.googleFormUrl || form.whatsappLink]
  ] as const;

  return fields.filter(([, value]) => !value.trim()).map(([label]) => label);
}

function clampAdminV2Score(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAdminV2RatioScore(value: number, total: number) {
  if (!total) return 0;
  return clampAdminV2Score((value / total) * 100);
}

function getAdminV2ScoreLabel(value: number) {
  if (value >= 85) return "Excellent";
  if (value >= 70) return "Healthy";
  if (value >= 50) return "Needs attention";
  return "Critical";
}

function AdminV2AiBotSvg({
  className = "",
  state
}: {
  className?: string;
  state: AdminV2AiAssistantState;
}) {
  const idSeed = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shellId = `admin-v2-bot-shell-${idSeed}`;
  const innerShellId = `admin-v2-bot-inner-${idSeed}`;
  const visorId = `admin-v2-bot-visor-${idSeed}`;
  const limeId = `admin-v2-bot-lime-${idSeed}`;
  const cyanId = `admin-v2-bot-cyan-${idSeed}`;
  const glowId = `admin-v2-bot-glow-${idSeed}`;
  const dropId = `admin-v2-bot-drop-${idSeed}`;
  const visorClipId = `admin-v2-bot-clip-${idSeed}`;

  return (
    <svg
      aria-hidden="true"
      className={`${styles.aiAssistantRobotSvg} ${className}`.trim()}
      data-ai-state={state}
      focusable="false"
      viewBox="0 0 300 300"
    >
      <defs>
        <radialGradient id={shellId} cx="34%" cy="18%" r="86%">
          <stop offset="0%" stopColor="#8c9489" />
          <stop offset="18%" stopColor="#586257" />
          <stop offset="45%" stopColor="#252d25" />
          <stop offset="72%" stopColor="#111811" />
          <stop offset="100%" stopColor="#050806" />
        </radialGradient>
        <radialGradient id={innerShellId} cx="38%" cy="22%" r="80%">
          <stop offset="0%" stopColor="#667063" />
          <stop offset="48%" stopColor="#202820" />
          <stop offset="100%" stopColor="#070b08" />
        </radialGradient>
        <linearGradient id={visorId} x1="52" y1="68" x2="230" y2="116">
          <stop offset="0%" stopColor="#030504" />
          <stop offset="42%" stopColor="#101813" />
          <stop offset="75%" stopColor="#060a07" />
          <stop offset="100%" stopColor="#010201" />
        </linearGradient>
        <linearGradient id={limeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#efff83" />
          <stop offset="45%" stopColor="#b7ff3c" />
          <stop offset="100%" stopColor="#54f88a" />
        </linearGradient>
        <linearGradient id={cyanId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a9fff6" />
          <stop offset="100%" stopColor="#25e0bf" />
        </linearGradient>
        <filter id={glowId} x="-48%" y="-48%" width="196%" height="196%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 .62 0 0 0 0 1 0 0 0 0 .24 0 0 0 .74 0"
            result="g"
          />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={dropId} x="-36%" y="-36%" width="172%" height="188%">
          <feDropShadow dx="0" dy="17" stdDeviation="16" floodColor="#000" floodOpacity="0.56" />
        </filter>
        <clipPath id={visorClipId}>
          <rect x="52" y="68" width="196" height="54" rx="27" />
        </clipPath>
      </defs>

      <g className="admin-v2-bot-halo" aria-hidden="true">
        <path
          d="M63 150a87 87 0 0 1 174 0"
          fill="none"
          stroke="#b7ff3c"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.16"
        />
        <path
          d="M86 85a88 88 0 0 1 126 0"
          fill="none"
          stroke="#42ffd3"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.52"
        />
        <path
          d="M86 215a88 88 0 0 0 126 0"
          fill="none"
          stroke="#b7ff3c"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.46"
        />
      </g>
      <g className="admin-v2-bot-halo admin-v2-bot-halo-fast" aria-hidden="true">
        <circle cx="221" cy="63" r="4.8" fill="#42ffd3" filter={`url(#${glowId})`} />
        <circle cx="75" cy="235" r="4.8" fill="#b7ff3c" filter={`url(#${glowId})`} />
        <circle cx="41" cy="107" r="3.6" fill="#b7ff3c" filter={`url(#${glowId})`} />
      </g>
      <ellipse
        className="admin-v2-bot-base"
        cx="150"
        cy="253"
        rx="76"
        ry="11"
        fill="none"
        stroke="#b7ff3c"
        strokeWidth="1.4"
        opacity="0.5"
      />
      <ellipse
        className="admin-v2-bot-base"
        cx="150"
        cy="253"
        rx="54"
        ry="8"
        fill="rgba(183,255,60,.08)"
        stroke="#b7ff3c"
        strokeWidth="2.2"
        opacity="0.78"
      />

      <g className="admin-v2-bot-shell" filter={`url(#${dropId})`}>
        <g className="admin-v2-bot-body">
          <ellipse cx="150" cy="181" rx="62" ry="68" fill={`url(#${shellId})`} />
          <path
            d="M102 141c14 17 40 23 75 19 14-2 27-5 38-12"
            fill="none"
            stroke="#6b7668"
            strokeWidth="2.4"
            opacity="0.48"
          />
          <path
            d="M96 178c22 18 44 25 83 22 12-1 23-4 32-10"
            fill="none"
            stroke="#3e4a40"
            strokeWidth="2.2"
            opacity="0.8"
          />
          <rect
            x="135"
            y="172"
            width="30"
            height="56"
            rx="15"
            fill="#060a07"
            stroke="#3e493f"
            strokeWidth="2.4"
          />
          <rect
            className="admin-v2-bot-core"
            x="144"
            y="185"
            width="12"
            height="31"
            rx="6"
            fill={`url(#${limeId})`}
          />
          <g className="admin-v2-bot-eq" filter={`url(#${glowId})`}>
            <rect x="108" y="165" width="5" height="18" rx="2.5" fill="#b7ff3c" />
            <rect x="119" y="156" width="5" height="27" rx="2.5" fill="#42ffd3" />
            <rect x="181" y="163" width="5" height="20" rx="2.5" fill="#42ffd3" />
            <rect x="192" y="154" width="5" height="29" rx="2.5" fill="#b7ff3c" />
            <rect x="150" y="145" width="5" height="16" rx="2.5" fill="#b7ff3c" opacity="0.75" />
          </g>
        </g>

        <g className="admin-v2-bot-left-pod">
          <ellipse
            cx="87"
            cy="179"
            rx="20"
            ry="40"
            fill={`url(#${innerShellId})`}
            stroke="#3c483d"
            strokeWidth="2.3"
          />
          <rect
            x="82"
            y="196"
            width="7"
            height="29"
            rx="3.5"
            fill={`url(#${limeId})`}
            filter={`url(#${glowId})`}
          />
          <circle cx="91" cy="151" r="3" fill="#42ffd3" opacity="0.75" filter={`url(#${glowId})`} />
        </g>
        <g className="admin-v2-bot-right-pod">
          <ellipse
            cx="213"
            cy="179"
            rx="20"
            ry="40"
            fill={`url(#${innerShellId})`}
            stroke="#3c483d"
            strokeWidth="2.3"
          />
          <rect
            x="211"
            y="196"
            width="7"
            height="29"
            rx="3.5"
            fill={`url(#${limeId})`}
            filter={`url(#${glowId})`}
          />
          <circle
            cx="209"
            cy="151"
            r="3"
            fill="#42ffd3"
            opacity="0.75"
            filter={`url(#${glowId})`}
          />
        </g>

        <g className="admin-v2-bot-head">
          <ellipse cx="150" cy="95" rx="82" ry="57" fill={`url(#${shellId})`} />
          <path
            d="M86 70c27-20 101-23 130 4"
            fill="none"
            stroke="#99a395"
            strokeWidth="2"
            opacity="0.17"
          />
          <rect
            x="52"
            y="68"
            width="196"
            height="54"
            rx="27"
            fill={`url(#${visorId})`}
            stroke="#3f4b41"
            strokeWidth="2.5"
          />
          <g clipPath={`url(#${visorClipId})`}>
            <line
              className="admin-v2-bot-scanline"
              x1="66"
              y1="95"
              x2="235"
              y2="95"
              stroke="#42ffd3"
              strokeWidth="2.2"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
          </g>

          <g
            className="admin-v2-bot-eye-state admin-v2-bot-eyes-idle admin-v2-bot-eye-glow"
            filter={`url(#${glowId})`}
          >
            <rect
              className="admin-v2-bot-blink"
              x="88"
              y="94"
              width="38"
              height="8"
              rx="4"
              fill={`url(#${limeId})`}
            />
            <rect
              className="admin-v2-bot-blink"
              x="174"
              y="94"
              width="38"
              height="8"
              rx="4"
              fill={`url(#${limeId})`}
            />
          </g>
          <g className="admin-v2-bot-eye-state admin-v2-bot-eyes-hover" filter={`url(#${glowId})`}>
            <circle cx="107" cy="96" r="8" fill={`url(#${limeId})`} />
            <circle cx="193" cy="96" r="8" fill={`url(#${limeId})`} />
            <circle cx="150" cy="83" r="3.5" fill={`url(#${cyanId})`} />
          </g>
          <g className="admin-v2-bot-eye-state admin-v2-bot-eyes-listen" filter={`url(#${glowId})`}>
            <circle
              className="admin-v2-bot-listen-ring"
              cx="108"
              cy="96"
              r="10"
              fill="none"
              stroke="#42ffd3"
              strokeWidth="2"
            />
            <circle
              className="admin-v2-bot-listen-ring"
              cx="192"
              cy="96"
              r="10"
              fill="none"
              stroke="#42ffd3"
              strokeWidth="2"
            />
            <circle cx="108" cy="96" r="7" fill={`url(#${limeId})`} />
            <circle cx="192" cy="96" r="7" fill={`url(#${limeId})`} />
          </g>
          <g
            className="admin-v2-bot-eye-state admin-v2-bot-eyes-thinking"
            filter={`url(#${glowId})`}
          >
            <circle
              className="admin-v2-bot-think-dot admin-v2-bot-d1"
              cx="121"
              cy="96"
              r="5.2"
              fill="#b7ff3c"
            />
            <circle
              className="admin-v2-bot-think-dot admin-v2-bot-d2"
              cx="140"
              cy="96"
              r="5.2"
              fill="#42ffd3"
            />
            <circle
              className="admin-v2-bot-think-dot admin-v2-bot-d3"
              cx="159"
              cy="96"
              r="5.2"
              fill="#b7ff3c"
            />
            <circle
              className="admin-v2-bot-think-dot admin-v2-bot-d4"
              cx="178"
              cy="96"
              r="5.2"
              fill="#42ffd3"
            />
          </g>
          <g className="admin-v2-bot-eye-state admin-v2-bot-eyes-focus" filter={`url(#${glowId})`}>
            <rect x="76" y="91" width="60" height="5" rx="2.5" fill="#42ffd3" />
            <rect x="164" y="91" width="60" height="5" rx="2.5" fill="#42ffd3" />
            <rect x="96" y="101" width="118" height="3" rx="1.5" fill="#b7ff3c" opacity="0.74" />
          </g>
          <g
            className="admin-v2-bot-eye-state admin-v2-bot-eyes-success"
            filter={`url(#${glowId})`}
          >
            <path
              className="admin-v2-bot-success-smile"
              d="M97 91c18 23 86 23 105 0"
              fill="none"
              stroke="#b7ff3c"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="m115 92 8 8 17-20"
              fill="none"
              stroke="#42ffd3"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <g className="admin-v2-bot-eye-state admin-v2-bot-eyes-warning">
            <path
              className="admin-v2-bot-warning-eye"
              d="M90 88l43 11"
              stroke="#ffd15a"
              strokeWidth="7"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
            <path
              className="admin-v2-bot-warning-eye"
              d="M210 88l-43 11"
              stroke="#ffd15a"
              strokeWidth="7"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
            <path d="M150 76l14 27h-28z" fill="#ffd15a" filter={`url(#${glowId})`} />
            <rect x="149" y="84" width="2.8" height="10" rx="1.4" fill="#07150c" />
            <circle cx="150" cy="98" r="1.8" fill="#07150c" />
          </g>
          <g
            className="admin-v2-bot-eye-state admin-v2-bot-eyes-confused"
            filter={`url(#${glowId})`}
          >
            <rect
              x="89"
              y="93"
              width="34"
              height="7"
              rx="3.5"
              fill="#b7ff3c"
              transform="rotate(11 106 96)"
            />
            <rect
              x="177"
              y="93"
              width="34"
              height="7"
              rx="3.5"
              fill="#b7ff3c"
              transform="rotate(-11 194 96)"
            />
            <text
              className="admin-v2-bot-confused-mark"
              x="143"
              y="91"
              fill="#42ffd3"
              fontSize="20"
              fontWeight="900"
            >
              ?
            </text>
          </g>
          <g className="admin-v2-bot-eye-state admin-v2-bot-eyes-sleep" filter={`url(#${glowId})`}>
            <path d="M90 94h38" stroke="#b7ff3c" strokeWidth="6" strokeLinecap="round" />
            <path d="M172 94h38" stroke="#b7ff3c" strokeWidth="6" strokeLinecap="round" />
            <text
              className="admin-v2-bot-sleep-z"
              x="136"
              y="88"
              fill="#42ffd3"
              fontSize="16"
              fontWeight="900"
            >
              z
            </text>
            <text
              className="admin-v2-bot-sleep-z admin-v2-bot-z2"
              x="153"
              y="78"
              fill="#42ffd3"
              fontSize="13"
              fontWeight="900"
            >
              z
            </text>
            <text
              className="admin-v2-bot-sleep-z admin-v2-bot-z3"
              x="168"
              y="68"
              fill="#42ffd3"
              fontSize="10"
              fontWeight="900"
            >
              z
            </text>
          </g>

          <circle cx="238" cy="96" r="18" fill="#121914" stroke="#48554a" strokeWidth="2.4" />
          <circle
            cx="238"
            cy="96"
            r="11"
            fill="none"
            stroke="#b7ff3c"
            strokeWidth="2.8"
            opacity="0.92"
            filter={`url(#${glowId})`}
          />
          <circle cx="231" cy="83" r="2.6" fill="#42ffd3" filter={`url(#${glowId})`} />
          <rect
            x="126"
            y="142"
            width="48"
            height="6"
            rx="3"
            fill={`url(#${limeId})`}
            opacity="0.88"
            filter={`url(#${glowId})`}
          />
        </g>
      </g>
    </svg>
  );
}

const ADMIN_V2_CREATOR_STEPS = [
  {
    label: "Basic details"
  },
  {
    label: "Hero media"
  },
  {
    label: "Program content"
  },
  {
    label: "Contact links"
  },
  {
    label: "Preview"
  },
  {
    label: "Publish"
  }
] as const;

type AdminV2CoachImageResult = {
  cutoutUrl?: string;
  fallbackMode?: "cutout" | "framed" | "original";
  objectKey?: string;
  originalObjectKey?: string;
  originalUrl?: string;
  processingProvider?: "already-transparent" | "local-browser" | "none" | "photoroom" | "removebg";
  processingStatus?: "cutout_ready" | "disabled" | "framed_fallback" | "not_configured";
  publicUrl?: string;
  qualityStatus?: "failed" | "needs_manual_review" | "passed" | "skipped";
  safeMessage?: string;
  sizeBytes?: number;
};

type AdminV2MediaPayload = {
  error?: string;
  media?: AdminV2CoachImageResult & { mediaType?: "image" | "video" };
  ok?: boolean;
};

type AdminV2CoachCopyScope =
  | "all"
  | "benefits"
  | "cta"
  | "faq"
  | "footer"
  | "hero"
  | "intro"
  | "journey"
  | "media"
  | "problem"
  | "vision";

type AdminV2BuilderCopyReview = {
  scope: AdminV2CoachCopyScope;
  suggestions: Array<AdminAIBuilderSuggestion<keyof CoachSiteFormState>>;
};

type AdminV2PaidFunnelAnalysis = {
  cleanText: string;
  coachName?: string;
  faqHints: string[];
  headings: string[];
  keyPoints: string[];
  missingFields: string[];
  niche?: string;
  sourceUrl: string;
  title?: string;
};

type AdminV2CreatorFieldDefinition = {
  field: keyof CoachSiteFormState;
  label: string;
  placeholder?: string;
  rows?: number;
  span?: boolean;
  type?: "email" | "tel" | "text" | "url";
};

const ADMIN_V2_HERO_COPY_FIELDS = [
  {
    field: "brandEyebrow",
    label: "Brand eyebrow",
    placeholder: "Education-first wellness pathway"
  },
  { field: "brandBadge", label: "Brand badge", placeholder: "Education-first wellness page" },
  { field: "heroHeadline", label: "Hero headline", rows: 3, span: true },
  { field: "subheadline", label: "Hero subheadline", rows: 3, span: true },
  {
    field: "heroTrustLine",
    label: "Hero trust line",
    placeholder: "Education-first wellness guidance"
  },
  {
    field: "heroMicroTrustText",
    label: "Hero micro-trust text",
    placeholder: "Nutrition, habits, lifestyle, education"
  },
  { field: "heroMediaLabel", label: "Hero media label", placeholder: "Coach" },
  { field: "logoUrl", label: "Logo URL", placeholder: "https://...", type: "url" }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_INTRO_VISION_FIELDS = [
  { field: "introSectionLabel", label: "Intro section label" },
  { field: "introHeading", label: "Intro heading", rows: 2, span: true },
  { field: "coachIntroLabel", label: "Coach intro label" },
  { field: "visionLabel", label: "Vision label" },
  { field: "coachIntro", label: "Coach introduction", rows: 4, span: true },
  { field: "visionText", label: "Vision copy", rows: 4, span: true },
  { field: "trustText", label: "Trust/disclaimer copy", rows: 3, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_PROBLEM_BENEFIT_FIELDS = [
  { field: "problemSectionLabel", label: "Problem section label" },
  { field: "benefitsSectionLabel", label: "Benefits section label" },
  { field: "problemHeading", label: "Problem heading", rows: 2, span: true },
  { field: "problemPointsText", label: "Problem points - one per line", rows: 5, span: true },
  { field: "benefitsHeading", label: "Benefits heading", rows: 2, span: true },
  { field: "benefitsText", label: "Primary benefits - one per line", rows: 5, span: true },
  {
    field: "benefitDescriptionsText",
    label: "Benefit descriptions - one per line",
    rows: 5,
    span: true
  }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_JOURNEY_MEDIA_FIELDS = [
  { field: "journeySectionLabel", label: "Journey section label" },
  { field: "journeyHeading", label: "Journey heading", rows: 2, span: true },
  {
    field: "journeyStepsText",
    label: "Journey steps - label, title, description blocks",
    rows: 8,
    span: true
  },
  { field: "mediaModuleLabel", label: "Media module label" },
  { field: "mediaHeading", label: "Media heading" },
  { field: "mediaSubheading", label: "Media subheading", rows: 2, span: true },
  { field: "mediaBody", label: "Media body", rows: 4, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_FAQ_FIELDS = [
  { field: "faqSectionLabel", label: "FAQ section label" },
  { field: "faqHeading", label: "FAQ heading", rows: 2, span: true },
  { field: "faqText", label: "FAQ - question and answer blocks", rows: 10, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_CTA_SUPPORT_FIELDS = [
  { field: "ctaSectionLabel", label: "CTA section label" },
  { field: "ctaText", label: "CTA button copy" },
  { field: "supportHeading", label: "Support heading" },
  { field: "supportText", label: "Support body", rows: 3, span: true },
  { field: "supportEmailLabel", label: "Support email label" },
  { field: "supportPhoneLabel", label: "Support phone label" },
  { field: "supportWhatsappLabel", label: "Support WhatsApp label" },
  { field: "supportPrimaryButton", label: "Primary support button" },
  { field: "supportWhatsappButton", label: "WhatsApp button copy" },
  { field: "supportPrivacyNote", label: "Support privacy note", rows: 3, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_STICKY_SOCIAL_FIELDS = [
  { field: "stickyCtaLabel", label: "Sticky CTA label" },
  { field: "stickyCtaContactButton", label: "Sticky CTA button" },
  { field: "stickyCtaHeading", label: "Sticky CTA heading", rows: 2, span: true },
  { field: "stickyCtaContext", label: "Sticky CTA context", rows: 2, span: true },
  { field: "socialCopy", label: "Social sharing copy", rows: 3, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_FOOTER_FIELDS = [
  { field: "footerBrandLine", label: "Footer brand line" },
  { field: "footerHeadline", label: "Footer headline", rows: 2, span: true },
  { field: "footerText", label: "Footer legal/disclaimer copy", rows: 5, span: true }
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_AI_COPY_FIELDS = [
  ...ADMIN_V2_HERO_COPY_FIELDS,
  ...ADMIN_V2_INTRO_VISION_FIELDS,
  ...ADMIN_V2_PROBLEM_BENEFIT_FIELDS,
  ...ADMIN_V2_JOURNEY_MEDIA_FIELDS,
  ...ADMIN_V2_FAQ_FIELDS,
  ...ADMIN_V2_CTA_SUPPORT_FIELDS,
  ...ADMIN_V2_STICKY_SOCIAL_FIELDS,
  ...ADMIN_V2_FOOTER_FIELDS
] satisfies readonly AdminV2CreatorFieldDefinition[];

const ADMIN_V2_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const ADMIN_V2_VIDEO_MAX_BYTES = 70 * 1024 * 1024;

function AdminV2CreatorFieldGrid({
  definitions,
  form,
  onChange
}: {
  definitions: readonly AdminV2CreatorFieldDefinition[];
  form: CoachSiteFormState;
  onChange: (field: keyof CoachSiteFormState, value: string) => void;
}) {
  return (
    <div className="grid grid-2 v2-creator-field-grid">
      {definitions.map((definition) => {
        const id = `v2-creator-${String(definition.field).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        const value = String(form[definition.field] || "");
        const className = `field-row${definition.span ? " span-2" : ""}`;

        return (
          <div className={className} key={definition.field}>
            <label htmlFor={id}>{definition.label}</label>
            {definition.rows ? (
              <textarea
                aria-label={definition.label}
                id={id}
                onChange={(event) => onChange(definition.field, event.currentTarget.value)}
                placeholder={definition.placeholder}
                rows={definition.rows}
                value={value}
              />
            ) : (
              <input
                aria-label={definition.label}
                id={id}
                onChange={(event) => onChange(definition.field, event.currentTarget.value)}
                placeholder={definition.placeholder}
                type={definition.type || "text"}
                value={value}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminV2BuilderSuggestionReview({
  onApply,
  onApplySuggestion,
  onReject,
  onRejectSuggestion,
  review
}: {
  onApply: () => void;
  onApplySuggestion: (field: keyof CoachSiteFormState) => void;
  onReject: () => void;
  onRejectSuggestion: (field: keyof CoachSiteFormState) => void;
  review: AdminV2BuilderCopyReview;
}) {
  return (
    <section
      aria-label="AI copy suggestion review"
      aria-live="polite"
      className="console-card v2-creator-ai-review"
    >
      <div className="section-head">
        <div>
          <span className="badge badge-accent">Review required</span>
          <h3>{review.suggestions.length} AI copy suggestions are staged</h3>
          <p>The form is unchanged until you explicitly apply these field values.</p>
        </div>
        <div className="row-actions">
          <button className="btn btn-sm" onClick={onReject} type="button">
            Reject all
          </button>
          <button className="btn btn-sm btn-primary" onClick={onApply} type="button">
            Apply {review.suggestions.length} suggestions
          </button>
        </div>
      </div>
      <div className="v2-creator-ai-review-list">
        {review.suggestions.map((suggestion) => (
          <details className="v2-creator-ai-review-item" key={suggestion.field}>
            <summary>{getAdminV2BuilderFieldLabel(suggestion.field)}</summary>
            <dl className="v2-creator-ai-review-values">
              <div>
                <dt>Original</dt>
                <dd>{suggestion.original || "Empty"}</dd>
              </div>
              <div>
                <dt>Proposed / suggested value</dt>
                <dd>{suggestion.proposed || "Empty"}</dd>
              </div>
              <div className="v2-creator-ai-review-reason">
                <dt>Reason</dt>
                <dd>{suggestion.reason}</dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{suggestion.risk}</dd>
              </div>
            </dl>
            <div className="row-actions">
              <button
                className="btn btn-sm"
                onClick={() => onRejectSuggestion(suggestion.field)}
                type="button"
              >
                Reject
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onApplySuggestion(suggestion.field)}
                type="button"
              >
                Apply
              </button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function getAdminV2BuilderFieldLabel(field: keyof CoachSiteFormState) {
  const registered = ADMIN_V2_AI_COPY_FIELDS.find((definition) => definition.field === field);
  if (registered) return registered.label;
  return String(field)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function AdminV2CreateSitePage({
  csrfToken,
  editingSite,
  initialSites,
  initialSource,
  onAIContextChange,
  onAdminActivity,
  onSelect,
  onSitesChange
}: {
  csrfToken: string;
  editingSite: CoachSiteRecord | null;
  initialSites: CoachSiteRecord[];
  initialSource: string;
  onAIContextChange: (context: AdminAIBuilderSnapshot) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onSelect: (viewId: string) => void;
  onSitesChange: (sites: CoachSiteRecord[]) => void;
}) {
  const [activeCreatorStep, setActiveCreatorStep] = useState(0);
  const [form, setForm] = useState<CoachSiteFormState>(() =>
    editingSite
      ? createFormFromCoachSite(editingSite)
      : {
          ...EMPTY_COACH_SITE_FORM,
          heroMediaType: "none",
          registerButtonText: "Register Now",
          ctaText: "Register Now"
        }
  );
  const formRef = useRef(form);
  const [message, setMessage] = useState("");
  const [aiBusyScope, setAiBusyScope] = useState<AdminV2CoachCopyScope | "">("");
  const [copyReview, setCopyReview] = useState<AdminV2BuilderCopyReview | null>(null);
  const [funnelAnalysisBusy, setFunnelAnalysisBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaResult, setMediaResult] = useState<AdminV2CoachImageResult | null>(null);
  const [previewSite, setPreviewSite] = useState<CoachSiteRecord | null>(null);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedInspectTarget, setSelectedInspectTarget] =
    useState<CoachTemplatePreviewInspectTarget | null>(null);
  const [savedSiteId, setSavedSiteId] = useState(editingSite?.id || "");
  const [savingIntent, setSavingIntent] = useState<"" | "publish" | "save">("");
  const isPreviewStep = activeCreatorStep === 4;
  const isPublishStep = activeCreatorStep === ADMIN_V2_CREATOR_STEPS.length - 1;
  const normalizedSlug = normalizeCoachSlug(form.slug || form.coachName);
  const generatedPreview = useMemo(() => {
    if (!form.coachName.trim() || !form.niche.trim() || !normalizedSlug) return null;
    return createAdminV2CoachSiteFromForm({
      form,
      id: savedSiteId || `coach-site-${normalizedSlug}`,
      status: "draft"
    });
  }, [form, normalizedSlug, savedSiteId]);
  const activePreview = previewSite || generatedPreview;
  const duplicateSite = initialSites.find(
    (site) =>
      site.status !== "removed" &&
      site.slug === normalizedSlug &&
      (!savedSiteId || site.id !== savedSiteId)
  );
  const builderCopilotContext = useMemo<AdminAIBuilderSnapshot>(() => {
    const navbarSections = getCanonicalCoachNavbarSections().map((section) => section.sectionId);
    const visibleSections = canonicalCoachSectionRegistry
      .filter((section) => section.enabled)
      .map((section) => section.sectionId);
    const mediaReady =
      form.heroMediaType === "none" ||
      (form.heroMediaType === "image" && Boolean((form.photoUrl || form.logoUrl).trim())) ||
      (form.heroMediaType === "video" && Boolean(form.videoUrl.trim()));
    return {
      coachName: form.coachName.trim().slice(0, 100),
      currentStep: ADMIN_V2_CREATOR_STEPS[activeCreatorStep]?.label || "Details",
      hasPreview: Boolean(activePreview),
      inspection: {
        bonusServiceTitles: universalCoachBonuses.map((bonus) => bonus.baseTitle),
        copyText: [
          form.heroHeadline,
          form.subheadline,
          form.heroTrustLine,
          form.bio,
          form.coachIntro,
          form.visionText,
          form.benefitsText,
          form.problemPointsText,
          form.socialCopy
        ]
          .join(" ")
          .trim(),
        ctaText: form.ctaText || form.registerButtonText,
        faq: activePreview?.content.faq || [],
        footer: {
          brandLine: form.footerBrandLine,
          privacyNote: form.supportPrivacyNote,
          text: form.footerText
        },
        media: { ready: mediaReady },
        missingFields: getAdminV2BuilderMissingFields(form),
        mobileContentLength: [
          form.heroHeadline,
          form.subheadline,
          form.bio,
          form.coachIntro,
          form.visionText,
          form.benefitsText,
          form.problemPointsText,
          form.faqText,
          form.footerText
        ].join(" ").length,
        navbarSections,
        niche: form.niche,
        previewDigest: activePreview ? getAdminV2CoachSitePublicFingerprint(activePreview) : "",
        productionValidationError: getAdminV2CoachSiteValidationError(form, "published"),
        publicDigest:
          editingSite?.status === "published"
            ? getAdminV2CoachSitePublicFingerprint(editingSite)
            : "",
        registrationUrl: form.googleFormUrl,
        visibleSections
      },
      mediaReady,
      missingFields: getAdminV2BuilderMissingFields(form),
      readinessChecks: [
        {
          detail: "CTA copy and registration destination must both be present.",
          id: "cta",
          ready: Boolean(
            form.ctaText.trim() && (form.googleFormUrl.trim() || form.whatsappLink.trim())
          )
        },
        {
          detail: "FAQ content is incomplete.",
          id: "faq",
          ready: Boolean(form.faqHeading.trim() && form.faqText.trim())
        },
        {
          detail: "Footer and privacy/support content need review.",
          id: "footer",
          ready: Boolean(
            form.footerHeadline.trim() && form.footerText.trim() && form.supportPrivacyNote.trim()
          )
        },
        {
          detail: "Hero copy should include a headline, subheadline, and trust line.",
          id: "hero-copy",
          ready: Boolean(
            form.heroHeadline.trim() && form.subheadline.trim() && form.heroTrustLine.trim()
          )
        },
        {
          detail: "Preview is not available for comparison with the current draft.",
          id: "preview",
          ready: Boolean(activePreview)
        },
        {
          detail: "Mobile copy length exceeds the compact review threshold.",
          id: "mobile-copy",
          ready:
            [form.bio, form.heroHeadline, form.subheadline, form.visionText].join(" ").length <=
            1400
        }
      ],
      saving: Boolean(savingIntent),
      slug: normalizedSlug
    };
  }, [activeCreatorStep, activePreview, editingSite, form, normalizedSlug, savingIntent]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    onAIContextChange(builderCopilotContext);
  }, [builderCopilotContext, onAIContextChange]);

  function goToCreatorStep(step: number) {
    setActiveCreatorStep(Math.max(0, Math.min(step, ADMIN_V2_CREATOR_STEPS.length - 1)));
  }

  function updateFormField<Key extends keyof CoachSiteFormState>(
    field: Key,
    value: CoachSiteFormState[Key]
  ) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "coachName" && !current.slug) {
        next.slug = normalizeCoachSlug(String(value));
      }
      return next;
    });
    setPreviewSite(null);
  }

  async function analyzeExistingPaidFunnel() {
    if (copyReview) {
      setMessage("Apply or reject the pending AI copy review before analyzing another funnel.");
      return;
    }
    const url = form.existingPaidFunnelUrl.trim();
    if (!isAdminV2SingleHttpsUrl(url)) {
      setMessage("Add one valid HTTPS paid funnel URL before analysis.");
      return;
    }

    setFunnelAnalysisBusy(true);
    setMessage("Analyzing visible paid-funnel content through the protected production API...");
    onAdminActivity({
      detail: `${form.coachName || "Coach"} paid-funnel analysis started.`,
      label: "Create Site",
      status: "working"
    });
    try {
      const response = await fetch("/api/admin/coach-sites/analyze-paid-funnel", {
        body: JSON.stringify({ url }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        analysis?: AdminV2PaidFunnelAnalysis;
        message?: string;
        ok?: boolean;
      };
      if (!response.ok || !payload.ok || !payload.analysis) {
        throw new Error(payload.message || "Could not analyze the existing paid funnel page.");
      }

      const analysis = payload.analysis;
      setForm((current) => ({
        ...current,
        coachName: current.coachName.trim() || analysis.coachName || "",
        niche: current.niche.trim() || analysis.niche || "",
        paidFunnelContext: buildAdminV2PaidFunnelContext(analysis)
      }));
      setPreviewSite(null);
      setMessage(
        `Paid funnel analyzed. ${analysis.headings.length} headings and ${analysis.keyPoints.length} key points are ready for AI copy generation.`
      );
      onAdminActivity({
        detail: `${form.coachName || analysis.coachName || "Coach"} paid-funnel analysis completed.`,
        label: "Create Site",
        status: "success"
      });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Could not analyze the paid funnel.";
      setMessage(`${error} Manual content entry remains available.`);
      onAdminActivity({ detail: error, label: "Create Site", status: "error" });
    } finally {
      setFunnelAnalysisBusy(false);
    }
  }

  async function generateCoachCopy(scope: AdminV2CoachCopyScope) {
    if (copyReview) {
      setMessage("Apply or reject the pending AI copy review before generating more suggestions.");
      return;
    }
    if (!form.coachName.trim() || !form.niche.trim()) {
      setMessage("Coach name and niche are required before AI copy generation.");
      return;
    }
    if (aiBusyScope) return;

    setAiBusyScope(scope);
    setMessage(
      scope === "all"
        ? "Generating complete coach-site copy through the protected AI endpoint..."
        : `Regenerating ${scope} copy through the protected AI endpoint...`
    );
    onAdminActivity({
      detail: `${scope} copy generation started for ${form.coachName}.`,
      label: "Create Site AI",
      status: "working"
    });
    try {
      const requestBody = {
        bio: form.bio,
        coachName: form.coachName,
        existingPaidFunnelUrl: form.existingPaidFunnelUrl,
        hasGoogleFormUrl: Boolean(form.googleFormUrl.trim()),
        hasSupportContact: Boolean(
          form.coachEmail.trim() || form.coachPhone.trim() || form.whatsappLink.trim()
        ),
        heroMediaType: form.heroMediaType,
        location: form.location,
        niche: form.niche,
        paidFunnelContext: form.paidFunnelContext,
        registerButtonText: form.registerButtonText,
        scope,
        supportText: form.supportText,
        vision: form.vision
      };
      const { cancelled, payload, response } = await requestAdminCoachCopyWithConfirmation<
        Partial<CoachSiteRecord["content"]>
      >({
        body: requestBody,
        confirmLargeRequest: (message) => window.confirm(message),
        csrfToken
      });
      if (cancelled) {
        const cancellationMessage = "AI copy generation cancelled. No form fields were changed.";
        setMessage(cancellationMessage);
        onAdminActivity({
          detail: cancellationMessage,
          label: "Create Site AI",
          status: "error"
        });
        return;
      }
      if (!response.ok || !payload.ok || !payload.content) {
        throw new Error(payload.message || "AI copy generation failed safely.");
      }

      const currentForm = formRef.current;
      const proposedForm = applyAdminV2GeneratedCoachCopy(currentForm, payload.content);
      const suggestions = buildAdminAIBuilderSuggestions(
        currentForm,
        proposedForm,
        currentForm.paidFunnelContext.trim()
          ? "Generated from the selected coach, niche, and analyzed paid-funnel source context."
          : "Generated from the selected coach, niche, and current permission-visible builder context."
      );
      if (!suggestions.length) {
        setMessage(
          "AI copy generation returned no field changes. The current form remains unchanged."
        );
        return;
      }
      setCopyReview({ scope, suggestions });
      setMessage(
        `${suggestions.length} ${scope === "all" ? "site-copy" : scope} suggestions generated. Review and apply or reject them; the form is unchanged.`
      );
      onAdminActivity({
        detail: `${suggestions.length} ${scope} copy suggestions staged for ${currentForm.coachName}.`,
        label: "Create Site AI",
        status: "success"
      });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "AI copy generation failed safely.";
      setMessage(`${error} Manual editing remains available.`);
      onAdminActivity({ detail: error, label: "Create Site AI", status: "error" });
    } finally {
      setAiBusyScope("");
    }
  }

  function applyGeneratedCoachCopySuggestions() {
    if (!copyReview) return;
    const suggestionCount = copyReview.suggestions.length;
    const appliedCount = copyReview.suggestions.filter(
      (suggestion) => formRef.current[suggestion.field] === suggestion.original
    ).length;
    const skippedCount = suggestionCount - appliedCount;
    setForm((current) => applyAdminAIBuilderSuggestions(current, copyReview.suggestions));
    setCopyReview(null);
    if (appliedCount) setPreviewSite(null);
    setMessage(
      `${appliedCount} approved AI copy suggestion${appliedCount === 1 ? "" : "s"} applied to the unsaved form.${
        skippedCount
          ? ` ${skippedCount} stale suggestion${skippedCount === 1 ? " was" : "s were"} skipped because the field changed after generation.`
          : ""
      }`
    );
    onAdminActivity({
      detail: `${appliedCount} AI copy suggestions applied after explicit review; ${skippedCount} stale suggestions skipped.`,
      label: "Create Site AI",
      status: "success"
    });
  }

  function applyGeneratedCoachCopySuggestion(field: keyof CoachSiteFormState) {
    const suggestion = copyReview?.suggestions.find((item) => item.field === field);
    if (!suggestion) return;
    const applied = formRef.current[field] === suggestion.original;
    setForm((current) => applyAdminAIBuilderSuggestions(current, [suggestion]));
    setCopyReview((current) => {
      if (!current) return null;
      const remaining = current.suggestions.filter((item) => item.field !== field);
      return remaining.length ? { ...current, suggestions: remaining } : null;
    });
    if (applied) setPreviewSite(null);
    setMessage(
      applied
        ? `${getAdminV2BuilderFieldLabel(field)} AI copy suggestion applied to the unsaved form.`
        : `${getAdminV2BuilderFieldLabel(field)} AI copy suggestion was stale and skipped because the field changed after generation.`
    );
    onAdminActivity({
      detail: `${getAdminV2BuilderFieldLabel(field)} AI copy suggestion ${applied ? "applied" : "skipped as stale"} after explicit review.`,
      label: "Create Site AI",
      status: "success"
    });
  }

  function rejectGeneratedCoachCopySuggestion(field: keyof CoachSiteFormState) {
    const suggestion = copyReview?.suggestions.find((item) => item.field === field);
    if (!suggestion) return;
    setCopyReview((current) => {
      if (!current) return null;
      const remaining = current.suggestions.filter((item) => item.field !== field);
      return remaining.length ? { ...current, suggestions: remaining } : null;
    });
    setMessage(
      `${getAdminV2BuilderFieldLabel(field)} AI copy suggestion rejected. The form value was preserved.`
    );
    onAdminActivity({
      detail: `${getAdminV2BuilderFieldLabel(field)} AI copy suggestion rejected without changing the form.`,
      label: "Create Site AI",
      status: "success"
    });
  }

  function rejectGeneratedCoachCopySuggestions() {
    if (!copyReview) return;
    const suggestionCount = copyReview.suggestions.length;
    setCopyReview(null);
    setMessage(
      `${suggestionCount} AI copy suggestions rejected. Original form values were preserved.`
    );
    onAdminActivity({
      detail: `${suggestionCount} AI copy suggestions rejected without changing the form.`,
      label: "Create Site AI",
      status: "success"
    });
  }

  function preparePreview() {
    const validationError = getAdminV2CoachSiteValidationError(form, "draft");
    if (validationError) {
      setMessage(validationError);
      return null;
    }
    if (duplicateSite) {
      setMessage(
        `${duplicateSite.coachName || "This coach"} already exists as ${duplicateSite.status}. Use Coach Sites to edit that production record.`
      );
      return null;
    }

    const site = createAdminV2CoachSiteFromForm({
      form,
      id: savedSiteId || `coach-site-${normalizedSlug}`,
      status: "draft"
    });
    setPreviewSite(site);
    setMessage("Preview ready. Review it before publishing.");
    onAdminActivity({
      detail: `${site.coachName} preview generated.`,
      label: "Create Site",
      status: "success"
    });
    return site;
  }

  async function uploadCreatorMedia(file: File | undefined, mediaType: "image" | "video") {
    if (!file || mediaBusy) return;
    const maxBytes = mediaType === "image" ? ADMIN_V2_IMAGE_MAX_BYTES : ADMIN_V2_VIDEO_MAX_BYTES;
    if (file.size <= 0 || file.size > maxBytes) {
      setMessage(
        mediaType === "image"
          ? "Upload a non-empty coach photo under 12 MB."
          : "Upload a non-empty coach video under 70 MB."
      );
      return;
    }

    setMediaBusy(true);
    setMessage(
      mediaType === "image" ? "Preparing your coach photo..." : "Uploading coach video..."
    );
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("mediaType", mediaType);
      data.append("slug", normalizedSlug || "draft-coach");
      const response = await fetch("/api/admin/coach-sites/media", {
        body: data,
        cache: "no-store",
        credentials: "include",
        headers: { [ADMIN_CSRF_HEADER_NAME]: csrfToken },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminV2MediaPayload;
      if (!response.ok || !payload.ok || !payload.media?.publicUrl) {
        setMessage(payload.error || "Coach media could not be saved safely.");
        return;
      }

      if (mediaType === "image") {
        setMediaResult(payload.media);
        updateFormField("heroMediaType", "image");
        updateFormField("photoUrl", payload.media.cutoutUrl || payload.media.publicUrl);
        setMessage(payload.media.safeMessage || "Coach photo is ready.");
      } else {
        updateFormField("heroMediaType", "video");
        updateFormField("videoUrl", payload.media.publicUrl);
        setMessage("Coach video uploaded and stored securely.");
      }
    } catch {
      setMessage("Coach media upload could not connect. No production record was changed.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function reprocessCreatorImage(provider: "auto" | "removebg") {
    if (!mediaResult?.originalObjectKey || !normalizedSlug || mediaBusy) {
      setMessage("Upload and store the original coach photo before reprocessing.");
      return;
    }

    setMediaBusy(true);
    setMessage(
      provider === "removebg"
        ? "Trying the fallback coach photo provider..."
        : "Reprocessing your coach photo securely..."
    );
    try {
      const response = await fetch("/api/admin/coach-sites/media-reprocess", {
        body: JSON.stringify({
          originalObjectKey: mediaResult.originalObjectKey,
          provider,
          slug: normalizedSlug
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminV2MediaPayload;
      if (!response.ok || !payload.ok || !payload.media?.publicUrl) {
        setMessage(payload.error || "Coach photo could not be reprocessed safely.");
        return;
      }

      setMediaResult(payload.media);
      updateFormField("photoUrl", payload.media.cutoutUrl || payload.media.publicUrl);
      setMessage(payload.media.safeMessage || "Coach photo reprocessing finished.");
    } catch {
      setMessage("Coach photo reprocessing could not connect. The stored original is unchanged.");
    } finally {
      setMediaBusy(false);
    }
  }

  async function persistCoachSite(
    status: Exclude<CoachSiteStatus, "archived" | "removed">,
    intent: "publish" | "save" = "save"
  ) {
    if (savingIntent) return;

    const validationError = getAdminV2CoachSiteValidationError(
      form,
      status === "published" ? "published" : "draft"
    );
    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (duplicateSite) {
      setMessage(
        `${duplicateSite.coachName || "This coach"} already exists as ${duplicateSite.status}. Use Coach Sites to edit that production record.`
      );
      return;
    }

    const site = createAdminV2CoachSiteFromForm({
      form,
      id: savedSiteId || `coach-site-${normalizedSlug}`,
      status
    });

    setSavingIntent(intent);
    setMessage(
      intent === "publish"
        ? "Publishing through production API..."
        : editingSite
          ? "Saving coach-site changes through production API..."
          : "Saving draft through production API..."
    );
    onAdminActivity({
      detail: `${site.coachName} ${
        intent === "publish" ? "publish" : editingSite ? "change save" : "draft save"
      } started.`,
      label: "Create Site",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ mode: savedSiteId ? "edit" : "create", site }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        coachSite?: CoachSiteRecord;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.coachSite) {
        setMessage(payload.error || "Coach site was not saved.");
        onAdminActivity({
          detail: payload.error || `${site.coachName} save failed through production API.`,
          label: "Create Site",
          status: "error"
        });
        return;
      }

      const savedSite = payload.coachSite;
      setSavedSiteId(savedSite.id);
      setPreviewSite(savedSite);
      onSitesChange(mergeAdminV2CoachSite(initialSites, savedSite));
      setMessage(
        intent === "publish"
          ? `Successfully published. Stable public link: ${savedSite.publicUrl}`
          : editingSite
            ? `${savedSite.coachName} changes saved with ${savedSite.status} status preserved.`
            : `${savedSite.coachName} draft saved.`
      );
      onAdminActivity({
        detail:
          intent === "publish"
            ? `${savedSite.coachName} published through production API.`
            : editingSite
              ? `${savedSite.coachName} changes saved through production API with ${savedSite.status} status preserved.`
              : `${savedSite.coachName} draft saved through production API.`,
        label: "Create Site",
        status: "success"
      });
      if (intent === "publish") goToCreatorStep(ADMIN_V2_CREATOR_STEPS.length - 1);
    } catch {
      setMessage("Could not reach the admin API. Nothing was saved locally as production truth.");
      onAdminActivity({
        detail: `${site.coachName} save failed because the production API was unreachable.`,
        label: "Create Site",
        status: "error"
      });
    } finally {
      setSavingIntent("");
    }
  }

  function renderCreatorStepFields() {
    if (activeCreatorStep === 1) {
      return (
        <div className="grid grid-2">
          <div className="field-row">
            <label htmlFor="v2-creator-theme">Production template skin</label>
            <select
              aria-label="Production template skin"
              id="v2-creator-theme"
              onChange={(event) =>
                updateFormField(
                  "selectedThemeId",
                  event.currentTarget.value as CoachSiteFormState["selectedThemeId"]
                )
              }
              value={form.selectedThemeId}
            >
              {productionReadyCoachTemplateThemes.map((themeOption) => (
                <option key={themeOption.id} value={themeOption.id}>
                  {themeOption.name}
                </option>
              ))}
            </select>
            <span className="helper">Only production-ready canonical skins are selectable.</span>
          </div>
          <div className="field-row">
            <label htmlFor="v2-creator-media">Hero media type</label>
            <select
              id="v2-creator-media"
              aria-label="Hero media type"
              onChange={(event) =>
                updateFormField(
                  "heroMediaType",
                  event.target.value as CoachSiteFormState["heroMediaType"]
                )
              }
              value={form.heroMediaType}
            >
              <option value="image">Photo/Image</option>
              <option value="video">Video Upload/Link</option>
              <option value="none">No media</option>
            </select>
            <span className="helper">Stored with the production coach-site record.</span>
          </div>
          <div className="field-row">
            <label htmlFor="v2-creator-photo">Photo/logo URL</label>
            <input
              aria-label="Photo/logo URL"
              id="v2-creator-photo"
              onChange={(event) => {
                setMediaResult(null);
                updateFormField("photoUrl", event.target.value);
              }}
              placeholder="https://..."
              value={form.photoUrl}
            />
          </div>
          {form.heroMediaType === "image" ? (
            <div className="field-row span-2">
              <label htmlFor="v2-creator-photo-upload">Upload coach photo</label>
              <input
                accept="image/avif,image/bmp,image/gif,image/heic,image/heif,image/jpeg,image/png,image/tiff,image/webp"
                aria-label="Upload coach photo"
                disabled={mediaBusy}
                id="v2-creator-photo-upload"
                onChange={(event) => void uploadCreatorMedia(event.target.files?.[0], "image")}
                type="file"
              />
              <span className="helper">
                Server providers create a cutout when configured; the original portrait frame
                remains a safe fallback.
              </span>
            </div>
          ) : null}
          <div className="field-row span-2">
            <label htmlFor="v2-creator-video">Video URL</label>
            <input
              aria-label="Video URL"
              id="v2-creator-video"
              onChange={(event) => updateFormField("videoUrl", event.target.value)}
              placeholder="YouTube embed or uploaded video URL"
              value={form.videoUrl}
            />
          </div>
          {form.heroMediaType === "video" ? (
            <div className="field-row span-2">
              <label htmlFor="v2-creator-video-upload">Upload coach video</label>
              <input
                accept="video/*"
                aria-label="Upload coach video"
                disabled={mediaBusy}
                id="v2-creator-video-upload"
                onChange={(event) => void uploadCreatorMedia(event.target.files?.[0], "video")}
                type="file"
              />
              <span className="helper">
                Supported production uploads are stored once and reused by preview and public
                rendering.
              </span>
            </div>
          ) : null}
          {mediaResult && form.heroMediaType === "image" ? (
            <div
              className="v2-media-result span-2"
              data-status={mediaResult.processingStatus || "unknown"}
            >
              <div>
                <strong>
                  {mediaResult.processingStatus === "cutout_ready"
                    ? "Cutout ready"
                    : "Original frame active"}
                </strong>
                <span>
                  {mediaResult.safeMessage || "The original coach photo is stored safely."}
                </span>
              </div>
              <div className="modal-actions">
                {mediaResult.cutoutUrl ? (
                  <button
                    className="btn btn-sm"
                    disabled={mediaBusy}
                    onClick={() => updateFormField("photoUrl", mediaResult.cutoutUrl || "")}
                    type="button"
                  >
                    Use cutout
                  </button>
                ) : null}
                {mediaResult.originalUrl ? (
                  <button
                    className="btn btn-sm"
                    disabled={mediaBusy}
                    onClick={() => updateFormField("photoUrl", mediaResult.originalUrl || "")}
                    type="button"
                  >
                    Use original frame
                  </button>
                ) : null}
                <button
                  className="btn btn-sm"
                  disabled={mediaBusy}
                  onClick={() => void reprocessCreatorImage("auto")}
                  type="button"
                >
                  Reprocess image
                </button>
                <button
                  className="btn btn-sm"
                  disabled={mediaBusy}
                  onClick={() => void reprocessCreatorImage("removebg")}
                  type="button"
                >
                  Try fallback provider
                </button>
                <button
                  className="btn btn-sm"
                  disabled={mediaBusy}
                  onClick={() => {
                    setMediaResult(null);
                    updateFormField("photoUrl", "");
                    setMessage("Coach photo cleared. Upload another image when ready.");
                  }}
                  type="button"
                >
                  Reset image
                </button>
              </div>
            </div>
          ) : null}
          <details className="v2-creator-details span-2" open>
            <summary>Hero copy and branding</summary>
            <AdminV2CreatorFieldGrid
              definitions={ADMIN_V2_HERO_COPY_FIELDS}
              form={form}
              onChange={(field, value) =>
                updateFormField(field, value as CoachSiteFormState[typeof field])
              }
            />
          </details>
        </div>
      );
    }

    if (activeCreatorStep === 2) {
      return (
        <div className="v2-creator-content-stack">
          <section className="console-card v2-creator-ai-strip">
            <div>
              <span className="badge badge-accent">Protected AI copy</span>
              <h3>Analyze, generate, then review every field</h3>
              <p>
                Existing funnel content stays server-fetched; generated copy never auto-publishes.
              </p>
            </div>
            <div className="row-actions">
              <button
                className="btn btn-sm"
                disabled={
                  funnelAnalysisBusy || Boolean(copyReview) || !form.existingPaidFunnelUrl.trim()
                }
                onClick={() => void analyzeExistingPaidFunnel()}
                type="button"
              >
                {funnelAnalysisBusy ? "Analyzing..." : "Analyze paid funnel"}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={Boolean(aiBusyScope) || Boolean(copyReview)}
                onClick={() => void generateCoachCopy("all")}
                type="button"
              >
                {aiBusyScope === "all" ? "Generating..." : "Generate complete copy"}
              </button>
            </div>
          </section>

          <div className="grid grid-2">
            <div className="field-row">
              <label htmlFor="v2-creator-niche">Coach niche</label>
              <input
                aria-label="Coach niche"
                id="v2-creator-niche"
                onChange={(event) => updateFormField("niche", event.target.value)}
                placeholder="PCOS, fitness, habit coaching..."
                value={form.niche}
              />
            </div>
            <div className="field-row">
              <label htmlFor="v2-creator-paid-url">Existing paid funnel URL</label>
              <input
                aria-label="Existing paid funnel URL"
                id="v2-creator-paid-url"
                onChange={(event) => updateFormField("existingPaidFunnelUrl", event.target.value)}
                placeholder="https://..."
                type="url"
                value={form.existingPaidFunnelUrl}
              />
            </div>
            <div className="field-row span-2">
              <label htmlFor="v2-creator-paid-context">Analyzed paid-funnel context</label>
              <textarea
                aria-label="Analyzed paid-funnel context"
                id="v2-creator-paid-context"
                onChange={(event) => updateFormField("paidFunnelContext", event.target.value)}
                placeholder="Analyze a page or add concise source context manually"
                rows={6}
                value={form.paidFunnelContext}
              />
            </div>
            <div className="field-row span-2">
              <label htmlFor="v2-creator-vision">Coach vision/mission source</label>
              <textarea
                aria-label="Coach vision/mission source"
                id="v2-creator-vision"
                onChange={(event) => updateFormField("vision", event.target.value)}
                placeholder="Coach story and transformation promise"
                rows={4}
                value={form.vision}
              />
            </div>
          </div>

          {[
            ["Introduction and vision", ADMIN_V2_INTRO_VISION_FIELDS, "intro"],
            ["Problem and benefits", ADMIN_V2_PROBLEM_BENEFIT_FIELDS, "benefits"],
            ["Journey and media", ADMIN_V2_JOURNEY_MEDIA_FIELDS, "journey"],
            ["FAQ", ADMIN_V2_FAQ_FIELDS, "faq"]
          ].map(([label, definitions, scope], index) => (
            <details className="v2-creator-details" key={String(label)} open={index <= 1}>
              <summary>
                <span>{String(label)}</span>
                <button
                  className="btn btn-sm"
                  disabled={Boolean(aiBusyScope) || Boolean(copyReview)}
                  onClick={(event) => {
                    event.preventDefault();
                    void generateCoachCopy(scope as AdminV2CoachCopyScope);
                  }}
                  type="button"
                >
                  {aiBusyScope === scope ? "Regenerating..." : "Regenerate section"}
                </button>
              </summary>
              <AdminV2CreatorFieldGrid
                definitions={definitions as readonly AdminV2CreatorFieldDefinition[]}
                form={form}
                onChange={(field, value) =>
                  updateFormField(field, value as CoachSiteFormState[typeof field])
                }
              />
            </details>
          ))}
        </div>
      );
    }

    if (activeCreatorStep === 3) {
      return (
        <div className="v2-creator-content-stack">
          <div className="grid grid-2">
            <div className="field-row">
              <label htmlFor="v2-creator-link">Registration/contact link</label>
              <input
                aria-label="Registration/contact link"
                id="v2-creator-link"
                onChange={(event) => updateFormField("googleFormUrl", event.target.value)}
                placeholder="https://..."
                type="url"
                value={form.googleFormUrl}
              />
            </div>
            <div className="field-row">
              <label htmlFor="v2-creator-support-whatsapp">Public WhatsApp link</label>
              <input
                aria-label="Public WhatsApp link"
                id="v2-creator-support-whatsapp"
                onChange={(event) => updateFormField("whatsappLink", event.target.value)}
                placeholder="https://wa.me/..."
                type="url"
                value={form.whatsappLink}
              />
            </div>
            <div className="field-row">
              <label htmlFor="v2-creator-support-email">Support email</label>
              <input
                aria-label="Support email"
                id="v2-creator-support-email"
                onChange={(event) => updateFormField("coachEmail", event.target.value)}
                placeholder="coach@example.com"
                type="email"
                value={form.coachEmail}
              />
            </div>
            <div className="field-row">
              <label htmlFor="v2-creator-support-phone">Support phone</label>
              <input
                aria-label="Support phone"
                id="v2-creator-support-phone"
                onChange={(event) => updateFormField("coachPhone", event.target.value)}
                placeholder="10-digit Indian support number"
                type="tel"
                value={form.coachPhone}
              />
            </div>
            <div className="field-row span-2">
              <label htmlFor="v2-creator-button-text">Register button text</label>
              <input
                aria-label="Register button text"
                id="v2-creator-button-text"
                onChange={(event) => {
                  updateFormField("registerButtonText", event.target.value);
                  updateFormField("ctaText", event.target.value);
                }}
                placeholder="Start your transformation"
                value={form.registerButtonText}
              />
            </div>
          </div>

          {[
            ["CTA and support copy", ADMIN_V2_CTA_SUPPORT_FIELDS, "cta"],
            ["Sticky CTA and social copy", ADMIN_V2_STICKY_SOCIAL_FIELDS, "cta"],
            ["Footer and legal copy", ADMIN_V2_FOOTER_FIELDS, "footer"]
          ].map(([label, definitions, scope], index) => (
            <details className="v2-creator-details" key={String(label)} open={index === 0}>
              <summary>
                <span>{String(label)}</span>
                <button
                  className="btn btn-sm"
                  disabled={Boolean(aiBusyScope) || Boolean(copyReview)}
                  onClick={(event) => {
                    event.preventDefault();
                    void generateCoachCopy(scope as AdminV2CoachCopyScope);
                  }}
                  type="button"
                >
                  {aiBusyScope === scope ? "Regenerating..." : "Regenerate section"}
                </button>
              </summary>
              <AdminV2CreatorFieldGrid
                definitions={definitions as readonly AdminV2CreatorFieldDefinition[]}
                form={form}
                onChange={(field, value) =>
                  updateFormField(field, value as CoachSiteFormState[typeof field])
                }
              />
            </details>
          ))}
        </div>
      );
    }

    if (isPreviewStep) {
      const inspectDefinitions = getAdminV2InspectFieldDefinitions(selectedInspectTarget);
      const inspectScope = getAdminV2CopyScopeForInspectTarget(selectedInspectTarget);
      return (
        <div className="card v2-creator-step-card">
          <span className="badge badge-accent">Preview</span>
          <h3>Check the coach page before publishing</h3>
          <p>
            Review the exact canonical public renderer. Inspect mode links visible sections back to
            editable production fields.
          </p>
          <div className="row-actions">
            <button
              aria-pressed={inspectMode}
              className="btn btn-sm"
              onClick={() => {
                setInspectMode((current) => !current);
                setSelectedInspectTarget(null);
              }}
              type="button"
            >
              {inspectMode ? "Turn inspect off" : "Inspect preview"}
            </button>
            {selectedInspectTarget ? (
              <button
                className="btn btn-sm"
                disabled={Boolean(aiBusyScope) || Boolean(copyReview)}
                onClick={() => void generateCoachCopy(inspectScope)}
                type="button"
              >
                {aiBusyScope === inspectScope ? "Regenerating..." : `Regenerate ${inspectScope}`}
              </button>
            ) : null}
          </div>
          {selectedInspectTarget ? (
            <section className="v2-preview-inspect-editor" aria-live="polite">
              <div>
                <span className="badge">Selected preview slot</span>
                <h3>{String(selectedInspectTarget)}</h3>
                <p>Edit the source fields below; the canonical preview refreshes immediately.</p>
              </div>
              <AdminV2CreatorFieldGrid
                definitions={inspectDefinitions}
                form={form}
                onChange={(field, value) =>
                  updateFormField(field, value as CoachSiteFormState[typeof field])
                }
              />
            </section>
          ) : inspectMode ? (
            <p className="helper">
              Select any highlighted preview section or text slot to edit it.
            </p>
          ) : null}
        </div>
      );
    }

    if (isPublishStep) {
      return (
        <div className="card v2-creator-step-card">
          <span className="badge badge-accent">Publish</span>
          <h3>Make the page live when everything looks right</h3>
          <p>
            Publish after the preview is approved. You can still return and update the page later.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-2">
        <div className="field-row">
          <label htmlFor="v2-creator-name">Coach name</label>
          <input
            aria-label="Coach name"
            id="v2-creator-name"
            onChange={(event) => updateFormField("coachName", event.target.value)}
            placeholder="Coach name"
            value={form.coachName}
          />
          <span className="helper">This name appears on the public coach page.</span>
        </div>
        <div className="field-row">
          <label htmlFor="v2-creator-location">Coach location</label>
          <input
            aria-label="Coach location"
            id="v2-creator-location"
            onChange={(event) => updateFormField("location", event.target.value)}
            placeholder="Coach location"
            value={form.location}
          />
        </div>
        <div className="field-row span-2">
          <label htmlFor="v2-creator-slug">Public slug</label>
          <input
            aria-label="Public slug"
            id="v2-creator-slug"
            onBlur={() => updateFormField("slug", normalizeCoachSlug(form.slug || form.coachName))}
            onChange={(event) => updateFormField("slug", event.target.value)}
            placeholder="coach-public-url"
            value={form.slug}
          />
          <span className="helper">Preview URL: /coach/{normalizedSlug || "coach-slug"}</span>
        </div>
        <div className="field-row span-2">
          <label htmlFor="v2-creator-bio">Coach short bio</label>
          <textarea
            aria-label="Coach short bio"
            id="v2-creator-bio"
            onChange={(event) => updateFormField("bio", event.target.value)}
            placeholder="Short coach profile summary"
            value={form.bio}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="v2-creator-page" id="page-creator" aria-label="Coach Website Creator">
      <div className="split">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>{editingSite ? `Edit ${editingSite.coachName}` : "Create Coach Website"}</h2>
              <p>
                {editingSite
                  ? `Editing the existing ${editingSite.status} production record. Save preserves its current visibility until Publish is chosen.`
                  : "Build, preview, save, and publish through the production coach-site API."}
              </p>
            </div>
            <div className="row-actions">
              <AdminAIAskButton
                className="btn btn-sm"
                label="Review Builder form with AI"
                query="Review the current Builder form for completeness, conflicting values, unsafe claims, URL format, and risky changes without editing it."
                scope="page"
              />
              <span className="console-pill">
                {initialSource === "loading" ? "Loading" : initialSource}
              </span>
            </div>
          </div>

          <div className="steps" aria-label="Coach Website Creator steps">
            {ADMIN_V2_CREATOR_STEPS.map((step, index) => (
              <button
                aria-pressed={activeCreatorStep === index}
                className={`step-chip${activeCreatorStep === index ? " is-active" : ""}`}
                key={step.label}
                onClick={() => goToCreatorStep(index)}
                type="button"
              >
                {index + 1} {step.label}
              </button>
            ))}
          </div>

          {renderCreatorStepFields()}

          {copyReview ? (
            <AdminV2BuilderSuggestionReview
              onApply={applyGeneratedCoachCopySuggestions}
              onApplySuggestion={applyGeneratedCoachCopySuggestion}
              onReject={rejectGeneratedCoachCopySuggestions}
              onRejectSuggestion={rejectGeneratedCoachCopySuggestion}
              review={copyReview}
            />
          ) : null}

          <div className="modal-actions">
            <button
              className="btn"
              disabled={activeCreatorStep === 0}
              onClick={() => goToCreatorStep(activeCreatorStep - 1)}
              type="button"
            >
              Back
            </button>
            <button
              className="btn"
              disabled={savingIntent !== ""}
              onClick={() =>
                void persistCoachSite(
                  editingSite?.status === "published" || editingSite?.status === "paused"
                    ? editingSite.status
                    : "draft"
                )
              }
              type="button"
            >
              {savingIntent === "save" ? "Saving..." : editingSite ? "Save Changes" : "Save Draft"}
            </button>
            {!isPreviewStep && !isPublishStep ? (
              <button
                className="btn btn-primary"
                onClick={() => goToCreatorStep(activeCreatorStep + 1)}
                type="button"
              >
                Next
              </button>
            ) : null}
            {isPreviewStep ? (
              <button className="btn btn-primary" onClick={preparePreview} type="button">
                Generate Preview
              </button>
            ) : null}
            {isPublishStep ? (
              <>
                <AdminAIAskButton
                  className="btn"
                  label="Pre-publish AI check"
                  query="Run the complete pre-publish Builder inspection."
                  scope="page"
                />
                <button
                  className="btn btn-primary"
                  disabled={savingIntent !== ""}
                  onClick={() => void persistCoachSite("published", "publish")}
                  type="button"
                >
                  {savingIntent === "publish" ? "Publishing..." : "Publish"}
                </button>
              </>
            ) : null}
          </div>
          <div className="modal-actions v2-creator-secondary-actions">
            {editingSite ? (
              <button
                className="btn btn-sm"
                onClick={() => onSelect("create-coach-site")}
                type="button"
              >
                Start a new site
              </button>
            ) : null}
            <button className="btn btn-sm" onClick={() => goToCreatorStep(0)} type="button">
              Edit all details
            </button>
            <button className="btn btn-sm" onClick={() => onSelect("coach-sites")} type="button">
              Back to Coach Sites
            </button>
            {activeCreatorStep < 4 ? (
              <button
                className="btn btn-sm"
                onClick={() => {
                  preparePreview();
                  goToCreatorStep(4);
                }}
                type="button"
              >
                Go to preview
              </button>
            ) : null}
            {isPreviewStep ? (
              <button className="btn btn-sm" onClick={() => goToCreatorStep(5)} type="button">
                Continue to publish
              </button>
            ) : null}
          </div>
          {message ? (
            <p className={styles.v2InlineStatus} role="status">
              {message}
            </p>
          ) : null}
        </section>

        <aside className="panel v2-canonical-preview-panel">
          <div className="section-head">
            <div>
              <span className="badge badge-accent">Canonical renderer</span>
              <h3>Exact public-page preview</h3>
              <p>
                The same public component and selected production skin render here with tracking
                disabled.
              </p>
            </div>
            <div className="row-actions">
              <button
                className="btn btn-sm"
                onClick={() => {
                  preparePreview();
                  goToCreatorStep(4);
                }}
                type="button"
              >
                Refresh preview
              </button>
              <button
                aria-pressed={inspectMode}
                className="btn btn-sm"
                disabled={!activePreview}
                onClick={() => {
                  setInspectMode((current) => !current);
                  setSelectedInspectTarget(null);
                }}
                type="button"
              >
                {inspectMode ? "Inspect on" : "Inspect"}
              </button>
            </div>
          </div>
          <dl className="v2-preview-list v2-canonical-preview-meta">
            <div>
              <dt>Public URL</dt>
              <dd>{activePreview?.publicUrl || `/coach/${normalizedSlug || "coach-slug"}`}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{activePreview?.status || "not generated"}</dd>
            </div>
            <div>
              <dt>Skin</dt>
              <dd>{form.selectedThemeId}</dd>
            </div>
          </dl>
          {activePreview ? (
            <div
              className={styles.v2CanonicalPreviewFrame}
              data-inspect-mode={inspectMode ? "true" : undefined}
            >
              <PublicCoachSitePage
                enableTracking={false}
                inspectMode={inspectMode}
                onSelectInspectScope={setSelectedInspectTarget}
                previewMode
                selectedInspectScope={selectedInspectTarget}
                site={toPublicCoachSiteRecord({ ...activePreview, status: "draft" })}
                stickyMode="contained"
              />
            </div>
          ) : (
            <div className="empty-state v2-preview-state" data-ready="false">
              <div>
                <h3>Preparing exact preview</h3>
                <p>Coach name and niche are required before the canonical renderer can open.</p>
                <div className="skeleton" aria-hidden="true">
                  <span className="skel-line" />
                  <span className="skel-line" />
                  <span className="skel-line" />
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="v2-creator-footer">
        <button className="btn btn-sm" onClick={() => onSelect("coach-sites")} type="button">
          Back to Coach Sites
        </button>
      </div>
    </section>
  );
}

function buildAdminV2PaidFunnelContext(analysis: AdminV2PaidFunnelAnalysis) {
  return [
    `Existing paid funnel page URL: ${analysis.sourceUrl}`,
    analysis.title ? `Page title: ${analysis.title}` : "",
    analysis.coachName ? `Coach name found: ${analysis.coachName}` : "",
    analysis.niche ? `Niche found: ${analysis.niche}` : "",
    analysis.headings.length ? `Visible headings: ${analysis.headings.join(" | ")}` : "",
    analysis.keyPoints.length ? `Key visible points: ${analysis.keyPoints.join(" | ")}` : "",
    analysis.faqHints.length ? `FAQ/context hints: ${analysis.faqHints.join(" | ")}` : "",
    `Clean visible page text: ${analysis.cleanText}`
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 7000);
}

function applyAdminV2GeneratedCoachCopy(
  current: CoachSiteFormState,
  generated: Partial<CoachSiteRecord["content"]>
): CoachSiteFormState {
  const text = (key: keyof CoachSiteRecord["content"], fallback: string) => {
    const value = generated[key];
    return typeof value === "string" ? value : fallback;
  };
  const ctaText = text("ctaText", current.ctaText);

  return {
    ...current,
    benefitDescriptionsText: Array.isArray(generated.benefitDescriptions)
      ? generated.benefitDescriptions.join("\n")
      : current.benefitDescriptionsText,
    benefitsHeading: text("benefitsHeading", current.benefitsHeading),
    benefitsSectionLabel: text("benefitsSectionLabel", current.benefitsSectionLabel),
    benefitsText: Array.isArray(generated.benefits)
      ? generated.benefits.join("\n")
      : current.benefitsText,
    brandBadge: text("brandBadge", current.brandBadge),
    brandEyebrow: text("brandEyebrow", current.brandEyebrow),
    coachIntro: text("coachIntro", current.coachIntro),
    coachIntroLabel: text("coachIntroLabel", current.coachIntroLabel),
    ctaSectionLabel: text("ctaSectionLabel", current.ctaSectionLabel),
    ctaText,
    faqHeading: text("faqHeading", current.faqHeading),
    faqSectionLabel: text("faqSectionLabel", current.faqSectionLabel),
    faqText: Array.isArray(generated.faq)
      ? generated.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n")
      : current.faqText,
    footerBrandLine: text("footerBrandLine", current.footerBrandLine),
    footerHeadline: text("footerHeadline", current.footerHeadline),
    footerText: text("footerText", current.footerText),
    heroHeadline: text("heroHeadline", current.heroHeadline),
    heroMediaLabel: text("heroMediaLabel", current.heroMediaLabel),
    heroMicroTrustText: text("heroMicroTrustText", current.heroMicroTrustText),
    heroTrustLine: text("heroTrustLine", current.heroTrustLine),
    introHeading: text("introHeading", current.introHeading),
    introSectionLabel: text("introSectionLabel", current.introSectionLabel),
    journeyHeading: text("journeyHeading", current.journeyHeading),
    journeySectionLabel: text("journeySectionLabel", current.journeySectionLabel),
    journeyStepsText: Array.isArray(generated.journeySteps)
      ? generated.journeySteps
          .map((step) => `${step.label}\n${step.title}\n${step.description}`)
          .join("\n\n")
      : current.journeyStepsText,
    mediaBody: text("mediaBody", current.mediaBody),
    mediaHeading: text("mediaHeading", current.mediaHeading),
    mediaModuleLabel: text("mediaModuleLabel", current.mediaModuleLabel),
    mediaSubheading: text("mediaSubheading", current.mediaSubheading),
    problemHeading: text("problemHeading", current.problemHeading),
    problemPointsText: Array.isArray(generated.problemPoints)
      ? generated.problemPoints.join("\n")
      : current.problemPointsText,
    problemSectionLabel: text("problemSectionLabel", current.problemSectionLabel),
    registerButtonText: ctaText || current.registerButtonText,
    socialCopy: text("socialCopy", current.socialCopy),
    stickyCtaContactButton: text("stickyCtaContactButton", current.stickyCtaContactButton),
    stickyCtaContext: text("stickyCtaContext", current.stickyCtaContext),
    stickyCtaHeading: text("stickyCtaHeading", current.stickyCtaHeading),
    stickyCtaLabel: text("stickyCtaLabel", current.stickyCtaLabel),
    subheadline: text("subheadline", current.subheadline),
    supportEmailLabel: text("supportEmailLabel", current.supportEmailLabel),
    supportHeading: text("supportHeading", current.supportHeading),
    supportPhoneLabel: text("supportPhoneLabel", current.supportPhoneLabel),
    supportPrimaryButton: text("supportPrimaryButton", current.supportPrimaryButton),
    supportPrivacyNote: text("supportPrivacyNote", current.supportPrivacyNote),
    supportWhatsappButton: text("supportWhatsappButton", current.supportWhatsappButton),
    supportWhatsappLabel: text("supportWhatsappLabel", current.supportWhatsappLabel),
    trustText: text("trustText", current.trustText),
    visionLabel: text("visionLabel", current.visionLabel),
    visionText: text("visionText", current.visionText)
  };
}

function getAdminV2InspectFieldDefinitions(
  target: CoachTemplatePreviewInspectTarget | null
): readonly AdminV2CreatorFieldDefinition[] {
  if (!target) return [];
  const section = String(target).split(".")[0];

  if (section === "coach") {
    return [
      { field: "coachName", label: "Coach name" },
      { field: "niche", label: "Coach niche" }
    ];
  }
  if (section === "hero") return ADMIN_V2_HERO_COPY_FIELDS;
  if (section === "intro" || section === "vision") return ADMIN_V2_INTRO_VISION_FIELDS;
  if (["benefits", "bonus", "fit", "results"].includes(section)) {
    return ADMIN_V2_PROBLEM_BENEFIT_FIELDS;
  }
  if (section === "problem") return ADMIN_V2_PROBLEM_BENEFIT_FIELDS;
  if (section === "journey") return ADMIN_V2_JOURNEY_MEDIA_FIELDS;
  if (section === "media") return ADMIN_V2_JOURNEY_MEDIA_FIELDS;
  if (section === "faq") return ADMIN_V2_FAQ_FIELDS;
  if (section === "cta") return [...ADMIN_V2_CTA_SUPPORT_FIELDS, ...ADMIN_V2_STICKY_SOCIAL_FIELDS];
  if (section === "footer") return ADMIN_V2_FOOTER_FIELDS;
  return ADMIN_V2_HERO_COPY_FIELDS;
}

function getAdminV2CopyScopeForInspectTarget(
  target: CoachTemplatePreviewInspectTarget | null
): AdminV2CoachCopyScope {
  const section = String(target || "all").split(".")[0];
  if (section === "hero") return "hero";
  if (section === "intro") return "intro";
  if (section === "vision") return "vision";
  if (section === "problem") return "problem";
  if (["benefits", "bonus", "fit", "results"].includes(section)) return "benefits";
  if (section === "journey") return "journey";
  if (section === "media") return "media";
  if (section === "faq") return "faq";
  if (section === "cta") return "cta";
  if (section === "footer") return "footer";
  return "all";
}

function createAdminV2CoachSiteFromForm(input: {
  form: CoachSiteFormState;
  id: string;
  status: CoachSiteStatus;
}) {
  return createCoachSiteFromForm({
    form: {
      ...input.form,
      ctaText: input.form.ctaText || input.form.registerButtonText,
      slug: normalizeCoachSlug(input.form.slug || input.form.coachName)
    },
    id: input.id,
    status: input.status
  });
}

function getAdminV2CoachSiteValidationError(
  form: CoachSiteFormState,
  status: "draft" | "published"
) {
  const slug = normalizeCoachSlug(form.slug || form.coachName);

  if (!form.coachName.trim() || !form.niche.trim() || !slug) {
    return "Coach name, niche, and public slug are required.";
  }

  if (form.googleFormUrl.trim() && !isAdminV2SingleHttpsUrl(form.googleFormUrl)) {
    return "Use one valid HTTPS registration/contact link.";
  }

  if (form.existingPaidFunnelUrl.trim() && !isAdminV2SingleHttpsUrl(form.existingPaidFunnelUrl)) {
    return "Use one valid HTTPS paid funnel URL.";
  }

  if (form.coachEmail.trim() && !isAdminV2SingleEmailAddress(form.coachEmail)) {
    return "Use one valid support email.";
  }

  if (form.coachPhone.trim() && !isAdminV2IndianPhoneNumber(form.coachPhone)) {
    return "Use one valid 10-digit Indian support phone number.";
  }

  if (status === "published") {
    if (!form.googleFormUrl.trim()) {
      return "Registration/contact link is required before publishing.";
    }

    if (form.heroMediaType === "image" && !form.photoUrl.trim() && !form.logoUrl.trim()) {
      return "Add a coach photo/logo or choose No media before publishing.";
    }

    if (form.heroMediaType === "video" && !form.videoUrl.trim()) {
      return "Add a video URL or choose No media before publishing.";
    }
  }

  return "";
}

function getAdminV2CoachSitePublicFingerprint(site: CoachSiteRecord) {
  const value = JSON.stringify(toPublicCoachSiteRecord(site));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function mergeAdminV2CoachSite(sites: CoachSiteRecord[], savedSite: CoachSiteRecord) {
  const replaced = sites.map((site) => (site.id === savedSite.id ? savedSite : site));
  return replaced.some((site) => site.id === savedSite.id) ? replaced : [savedSite, ...sites];
}

function isAdminV2SingleHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if ((trimmed.match(/https?:\/\//gi) || []).length !== 1) return false;

  try {
    const url = new URL(trimmed);
    return (
      url.protocol === "https:" && !url.hostname.includes("localhost") && url.pathname.length > 0
    );
  } catch {
    return false;
  }
}

function getAdminV2CoachSiteGenerationFailure(
  site: CoachSiteRecord,
  errorReports: AdminErrorReport[]
) {
  const report = errorReports.find((candidate) => {
    if (candidate.status === "Fixed" || candidate.status === "Ignored") return false;
    const related =
      candidate.coachSlug === site.slug || candidate.pagePath.includes(`/coach/${site.slug}`);
    if (!related) return false;
    return [candidate.errorCode, candidate.safeMessage, candidate.category].some((value) =>
      /(?:generat|publish[_ -]?fail|copy[_ -]?fail|ai[_ -]?fail)/i.test(value || "")
    );
  });
  if (!report) return undefined;
  return [report.errorCode, report.safeMessage, report.category]
    .filter((value): value is string => Boolean(value))
    .filter((value) => /(?:generat|publish[_ -]?fail|copy[_ -]?fail|ai[_ -]?fail)/i.test(value))
    .join(": ");
}

function getAdminV2CoachSitePermissionIssue(
  site: CoachSiteRecord,
  permissions: { canArchive: boolean; canEdit: boolean; canPublish: boolean }
) {
  if (site.status === "draft" && !permissions.canPublish) {
    return "Current role lacks website_creator.publish permission for this draft.";
  }
  if (site.status === "archived" && !permissions.canArchive) {
    return "Current role lacks coach_sites.archive permission to restore this record.";
  }
  if ((site.status === "published" || site.status === "paused") && !permissions.canEdit) {
    return "Current role lacks coach_sites.edit permission for this record.";
  }
  return undefined;
}

function isAdminV2SingleEmailAddress(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\s,;]/.test(trimmed)) return false;
  if ((trimmed.match(/@/g) || []).length !== 1) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isAdminV2IndianPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(normalized);
}

function AdminV2CoachSitesPage({
  analyticsSummaries,
  canArchive,
  canCreate,
  canDeleteDraft,
  canEdit,
  canPublish,
  canRemove,
  coachSites,
  csrfToken,
  errorReports,
  focusTarget,
  onAIContextChange,
  onAdminActivity,
  onEditSite,
  onSelect,
  onSitesChange,
  source,
  theme
}: {
  analyticsSummaries: AnalyticsMetricSummary[];
  canArchive: boolean;
  canCreate: boolean;
  canDeleteDraft: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canRemove: boolean;
  coachSites: CoachSiteRecord[];
  csrfToken: string;
  errorReports: AdminErrorReport[];
  focusTarget: AdminV2CoachSiteFocus | null;
  onAIContextChange: (context: AdminAITableContext) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onEditSite: (site: CoachSiteRecord) => void;
  onSelect: (viewId: AdminV2ViewId) => void;
  onSitesChange: (sites: CoachSiteRecord[]) => void;
  source: string;
  theme: "dark" | "light";
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | CoachSiteStatus>("all");
  const [siteTypeFilter, setSiteTypeFilter] = useState<"all" | "free" | "paid">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [busySiteId, setBusySiteId] = useState("");
  const [dangerBusy, setDangerBusy] = useState<"" | "send_otp" | "submit">("");
  const [dangerDialog, setDangerDialog] = useState<AdminV2CoachDangerDialogState>(null);
  const [dangerFeedback, setDangerFeedback] = useState("");
  const [dangerOtp, setDangerOtp] = useState("");
  const [dangerOtpSent, setDangerOtpSent] = useState(false);
  const [dangerReason, setDangerReason] = useState("");
  const [message, setMessage] = useState("");
  const [managedSiteId, setManagedSiteId] = useState("");
  const [selectedOpsRowKey, setSelectedOpsRowKey] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedTableSiteIdsState, setSelectedTableSiteIds] = useState<string[]>([]);
  const appliedFocusRef = useRef("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSites = useMemo(
    () => coachSites.filter((site) => site.status !== "removed"),
    [coachSites]
  );
  const explicitFocusActive = Boolean(
    focusTarget?.siteId || focusTarget?.coachId || focusTarget?.coachSlug
  );
  useEffect(() => {
    const focusKey = [
      focusTarget?.siteId || "",
      focusTarget?.coachId || "",
      focusTarget?.coachSlug || ""
    ].join("|");
    if (!focusKey.replace(/\|/g, "")) {
      appliedFocusRef.current = "";
      return;
    }
    if (source === "loading" || appliedFocusRef.current === focusKey) return;

    const site = resolveAdminV2CoachSiteFocus(visibleSites, focusTarget);
    const frame = window.requestAnimationFrame(() => {
      appliedFocusRef.current = focusKey;
      setQuery("");
      setSearchOpen(false);
      setStatusFilter("all");
      setSiteTypeFilter("all");

      if (!site) {
        const identity =
          focusTarget?.coachSlug ||
          focusTarget?.coachId ||
          focusTarget?.siteId ||
          "requested coach";
        setCurrentPage(1);
        setSelectedOpsRowKey(focusTarget?.coachSlug || focusTarget?.coachId || "");
        setSelectedSiteId("");
        setSelectedTableSiteIds([]);
        setMessage(
          `${identity} has no unique permission-visible coach-site match. No site action was selected.`
        );
        onAdminActivity({
          detail: `${identity} could not be resolved to one permission-visible coach-site record.`,
          label: "Coach Ops",
          status: "error"
        });
        return;
      }

      const siteIndex = visibleSites.findIndex((candidate) => candidate.id === site.id);
      setCurrentPage(siteIndex < 0 ? 1 : Math.floor(siteIndex / ADMIN_V2_COACH_SITE_PAGE_SIZE) + 1);
      setSelectedOpsRowKey(site.slug || site.id);
      setSelectedSiteId(site.id);
      setSelectedTableSiteIds([site.id]);
      setMessage(`${site.coachName} loaded from Analytics into the operations workbench.`);
      onAdminActivity({
        detail: `${site.coachName} identity carried from Analytics into Coach Sites.`,
        label: "Coach Ops",
        status: "success"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTarget, onAdminActivity, source, visibleSites]);
  const currentSites = useMemo(
    () => visibleSites.filter((site) => site.status !== "archived"),
    [visibleSites]
  );
  const filteredSites = useMemo(
    () =>
      visibleSites.filter((site) => {
        const statusHit = statusFilter === "all" || site.status === statusFilter;
        if (!statusHit) return false;
        const isPaid = Boolean(site.existingPaidFunnelUrl);
        if (siteTypeFilter === "free" && isPaid) return false;
        if (siteTypeFilter === "paid" && !isPaid) return false;
        if (!normalizedQuery) return true;
        return [
          site.coachName,
          site.niche,
          site.slug,
          site.publicUrl,
          site.location,
          site.analytics?.source,
          site.analytics?.region,
          site.status
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, siteTypeFilter, statusFilter, visibleSites]
  );
  const selectedSite =
    visibleSites.find((site) => site.id === selectedSiteId) ||
    (explicitFocusActive ? null : filteredSites[0] || visibleSites[0]);
  const managedSite = visibleSites.find((site) => site.id === managedSiteId) || null;
  const searchSuggestions = useMemo(
    () =>
      normalizedQuery
        ? visibleSites
            .filter((site) =>
              [site.coachName, site.niche, site.slug, site.location, site.status]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery)
            )
            .slice(0, 6)
        : visibleSites.slice(0, 6),
    [normalizedQuery, visibleSites]
  );
  const counts = useMemo(
    () => ({
      archived: visibleSites.filter((site) => site.status === "archived").length,
      draft: visibleSites.filter((site) => site.status === "draft").length,
      free: visibleSites.filter((site) => !site.existingPaidFunnelUrl).length,
      paused: visibleSites.filter((site) => site.status === "paused").length,
      paid: visibleSites.filter((site) => Boolean(site.existingPaidFunnelUrl)).length,
      published: visibleSites.filter((site) => site.status === "published").length,
      total: visibleSites.length
    }),
    [visibleSites]
  );
  const totalVisits = currentSites.reduce(
    (sum, site) => sum + (site.analytics?.totalVisits || 0),
    0
  );
  const totalClicks = currentSites.reduce(
    (sum, site) => sum + (site.analytics?.totalRegisterClicks || 0),
    0
  );
  const productionRows = useMemo(
    () =>
      buildCoachAnalyticsRows(visibleSites, analyticsSummaries, {
        preferEventSummaries: true
      }),
    [analyticsSummaries, visibleSites]
  );
  const rawIntelligenceRows = useMemo(
    () => getAdminV2CoachRows(visibleSites, analyticsSummaries),
    [analyticsSummaries, visibleSites]
  );
  const intelligenceRows = useMemo(
    () => buildAdminV2CoachIntelligenceRows(rawIntelligenceRows, productionRows),
    [productionRows, rawIntelligenceRows]
  );
  const selectedIntelligence =
    intelligenceRows.find(
      (row) => row.id === selectedOpsRowKey || row.slug === selectedOpsRowKey
    ) ||
    intelligenceRows.find(
      (row) => row.id === selectedSite?.id || row.slug === selectedSite?.slug
    ) ||
    (explicitFocusActive ? null : intelligenceRows[0]) ||
    null;
  const operationsQueue = intelligenceRows
    .filter((row) => row.risk.priority !== "good")
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 3);
  const pageCount = Math.max(1, Math.ceil(filteredSites.length / ADMIN_V2_COACH_SITE_PAGE_SIZE));
  const clampedCurrentPage = Math.min(currentPage, pageCount);
  const pageStartIndex = filteredSites.length
    ? (clampedCurrentPage - 1) * ADMIN_V2_COACH_SITE_PAGE_SIZE
    : 0;
  const tableSites = useMemo(
    () => filteredSites.slice(pageStartIndex, pageStartIndex + ADMIN_V2_COACH_SITE_PAGE_SIZE),
    [filteredSites, pageStartIndex]
  );
  const selectedTableSiteIds = useMemo(() => {
    const visibleIds = new Set(tableSites.map((site) => site.id));
    return selectedTableSiteIdsState.filter((id) => visibleIds.has(id));
  }, [selectedTableSiteIdsState, tableSites]);
  const pageEndIndex = filteredSites.length ? pageStartIndex + tableSites.length : 0;
  const activeFilterCount =
    (query.trim() ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (siteTypeFilter !== "all" ? 1 : 0);
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: {
        page: clampedCurrentPage,
        query: query.trim(),
        siteType: siteTypeFilter,
        status: statusFilter
      },
      rows: tableSites.map((site) => ({
        duplicateKey: normalizeCoachSlug(site.slug || site.coachName),
        generationFailure: getAdminV2CoachSiteGenerationFailure(site, errorReports),
        groupKey: site.niche,
        id: site.id,
        imageReady:
          site.heroMediaType === "none" ||
          (site.heroMediaType === "image" && Boolean((site.photoUrl || site.logoUrl).trim())) ||
          (site.heroMediaType === "video" && Boolean(site.videoUrl.trim())),
        label: site.coachName || site.slug,
        linkValid: isAdminV2SingleHttpsUrl(site.googleFormUrl),
        permissionIssue: getAdminV2CoachSitePermissionIssue(site, {
          canArchive,
          canEdit,
          canPublish
        }),
        requiredDataComplete: Boolean(
          site.coachName.trim() &&
          site.niche.trim() &&
          site.slug.trim() &&
          site.bio.trim() &&
          site.vision.trim()
        ),
        status: site.status,
        unresolvedErrors: errorReports.filter(
          (report) =>
            report.status !== "Fixed" &&
            report.status !== "Ignored" &&
            (report.coachSlug === site.slug || report.pagePath.includes(`/coach/${site.slug}`))
        ).length
      })),
      selectedIds: selectedTableSiteIds,
      sort: null,
      tableId: "coach-sites"
    }),
    [
      canArchive,
      canEdit,
      canPublish,
      clampedCurrentPage,
      errorReports,
      query,
      selectedTableSiteIds,
      siteTypeFilter,
      statusFilter,
      tableSites
    ]
  );

  useEffect(() => {
    onAIContextChange(tableAiContext);
  }, [onAIContextChange, tableAiContext]);

  function toggleCoachSiteSelection(id: string, selected: boolean) {
    setSelectedTableSiteIds((current) =>
      selected
        ? Array.from(new Set([...current, id]))
        : current.filter((selectedId) => selectedId !== id)
    );
  }

  function toggleVisibleCoachSiteSelection() {
    const visibleIds = tableSites.map((site) => site.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedTableSiteIds.includes(id));
    setSelectedTableSiteIds(allSelected ? [] : visibleIds);
  }

  function changeStatusFilter(status: "all" | CoachSiteStatus) {
    setStatusFilter(status);
    setCurrentPage(1);
  }

  function changeSiteTypeFilter(value: "all" | "free" | "paid") {
    setSiteTypeFilter(value);
    setCurrentPage(1);
  }

  function resetCoachSiteFilters() {
    setQuery("");
    setSearchOpen(false);
    setStatusFilter("all");
    setSiteTypeFilter("all");
    setCurrentPage(1);
    if (visibleSites[0]) {
      setSelectedSiteId(visibleSites[0].id);
    }
    setMessage("Coach-site filters reset. Showing all production records.");
    onAdminActivity({
      detail: "Coach Sites filters reset to all production records.",
      label: "Coach Sites",
      status: "success"
    });
  }

  function goToPreviousCoachSitesPage() {
    setCurrentPage(Math.max(1, clampedCurrentPage - 1));
  }

  function goToNextCoachSitesPage() {
    setCurrentPage(Math.min(pageCount, clampedCurrentPage + 1));
  }

  function selectOperationQueueRow(row: AdminV2CoachIntelligenceRow) {
    setSelectedOpsRowKey(row.slug || row.id);
    const site = visibleSites.find((item) => item.id === row.id || item.slug === row.slug);
    if (!site) {
      setSelectedSiteId("");
      setQuery("");
      setSearchOpen(false);
      setStatusFilter("all");
      setSiteTypeFilter("all");
      setCurrentPage(1);
      setMessage(
        `${row.coachName} loaded from production analytics. Site mutations require a coach-site record.`
      );
      onAdminActivity({
        detail: `${row.coachName} selected from production analytics without an editable site record.`,
        label: "Coach Ops",
        status: "success"
      });
      return;
    }

    setSelectedSiteId(site.id);
    setQuery("");
    setSearchOpen(false);
    setStatusFilter("all");
    setSiteTypeFilter("all");
    setCurrentPage(1);
    setMessage(`${site.coachName} loaded into the operations workbench.`);
    onAdminActivity({
      detail: `${site.coachName} selected from the operations queue.`,
      label: "Coach Ops",
      status: "success"
    });
  }

  async function copyPublicLink(site: CoachSiteRecord) {
    const link =
      typeof window === "undefined"
        ? site.publicUrl
        : new URL(site.publicUrl || `/coach/${site.slug}`, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(link);
      setMessage(`${site.coachName} public link copied.`);
      onAdminActivity({
        detail: `${site.coachName} public link copied.`,
        label: "Coach Sites",
        status: "success"
      });
    } catch {
      setMessage(`Copy was blocked. Link: ${link}`);
      onAdminActivity({
        detail: `${site.coachName} link copy was blocked by the browser.`,
        label: "Coach Sites",
        status: "error"
      });
    }
  }

  async function updateSiteStatus(site: CoachSiteRecord, status: CoachSiteStatus) {
    if (busySiteId) return;
    setBusySiteId(site.id);
    setMessage(`${getCoachV2StatusActionLabel(status)} ${site.coachName}...`);
    onAdminActivity({
      detail: `${site.coachName} status update started.`,
      label: "Coach Sites",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ siteId: site.id, status }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        coachSite?: CoachSiteRecord;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.coachSite) {
        setMessage(payload.error || "Coach-site status was not saved.");
        onAdminActivity({
          detail: payload.error || `${site.coachName} status update failed.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      onSitesChange(
        coachSites.map((item) => (item.id === payload.coachSite!.id ? payload.coachSite! : item))
      );
      setSelectedSiteId(payload.coachSite.id);
      setMessage(`${payload.coachSite.coachName} is now ${payload.coachSite.status}.`);
      onAdminActivity({
        detail: `${payload.coachSite.coachName} status changed to ${payload.coachSite.status}.`,
        label: "Coach Sites",
        status: "success"
      });
    } catch {
      setMessage("Could not reach the admin API for this coach-site action.");
      onAdminActivity({
        detail: `${site.coachName} status update failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      setBusySiteId("");
    }
  }

  async function reactivateArchivedSite(site: CoachSiteRecord) {
    if (busySiteId) return;
    setBusySiteId(site.id);
    setMessage(`Restoring ${site.coachName}...`);
    onAdminActivity({
      detail: `${site.coachName} restore started.`,
      label: "Coach Sites",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ action: "reactivate", siteId: site.id }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        coachSite?: CoachSiteRecord;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.coachSite) {
        setMessage(payload.error || "Archived coach site was not restored.");
        onAdminActivity({
          detail: payload.error || `${site.coachName} restore failed.`,
          label: "Coach Sites",
          status: "error"
        });
        return;
      }

      onSitesChange(
        coachSites.map((item) => (item.id === payload.coachSite!.id ? payload.coachSite! : item))
      );
      setStatusFilter(payload.coachSite.status);
      setSelectedSiteId(payload.coachSite.id);
      setMessage(`${payload.coachSite.coachName} restored as ${payload.coachSite.status}.`);
      onAdminActivity({
        detail: `${payload.coachSite.coachName} restored.`,
        label: "Coach Sites",
        status: "success"
      });
    } catch {
      setMessage("Could not reach the admin API to restore this coach site.");
      onAdminActivity({
        detail: `${site.coachName} restore failed safely.`,
        label: "Coach Sites",
        status: "error"
      });
    } finally {
      setBusySiteId("");
    }
  }

  function openDangerAction(site: CoachSiteRecord, action: AdminV2CoachDangerAction) {
    setSelectedSiteId(site.id);
    setSelectedOpsRowKey(site.slug || site.id);
    setDangerDialog({ action, site });
    setDangerBusy("");
    setDangerFeedback("");
    setDangerOtp("");
    setDangerOtpSent(false);
    setDangerReason("");
  }

  function closeDangerAction() {
    if (dangerBusy) return;
    setDangerDialog(null);
    setDangerFeedback("");
    setDangerOtp("");
    setDangerOtpSent(false);
    setDangerReason("");
  }

  async function refreshCoachSitesAfterDangerMutation(updatedSite: CoachSiteRecord) {
    const localSites =
      updatedSite.status === "removed"
        ? coachSites.filter((site) => site.id !== updatedSite.id)
        : coachSites.map((site) => (site.id === updatedSite.id ? updatedSite : site));

    try {
      const response = await fetch("/api/admin/coach-sites", {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as CoachSitesApiPayload;
      if (response.ok && payload.ok && Array.isArray(payload.coachSites)) {
        onSitesChange(payload.coachSites);
        return payload.coachSites;
      }
    } catch {
      // The mutation response is still authoritative; keep the local list coherent if refresh fails.
    }

    onSitesChange(localSites);
    return localSites;
  }

  async function sendDangerActionOtp() {
    if (!dangerDialog || dangerDialog.action === "delete_draft" || dangerBusy) return;
    const reason = dangerReason.trim();
    if (reason.length < 3) {
      setDangerFeedback("Enter a clear reason before requesting the verification code.");
      return;
    }

    const status: CoachSiteStatus = dangerDialog.action === "archive" ? "archived" : "removed";
    const resend = dangerOtpSent;
    setDangerBusy("send_otp");
    setDangerFeedback(
      resend ? "Requesting a new verification code..." : "Requesting verification code..."
    );
    onAdminActivity({
      detail: `${resend ? "OTP resend" : "OTP send"} started for ${dangerDialog.site.coachName}.`,
      label: "Coach Sites security",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify({ action: "send_otp", siteId: dangerDialog.site.id, status }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        localOtpMode?: boolean;
        message?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok) {
        const error = payload.error || "The verification code could not be sent.";
        setDangerFeedback(error);
        onAdminActivity({ detail: error, label: "Coach Sites security", status: "error" });
        return;
      }

      setDangerOtp("");
      setDangerOtpSent(true);
      setDangerFeedback(
        payload.localOtpMode
          ? "Local verification code is ready for this disposable environment."
          : resend
            ? "A new 6-digit code was sent to your admin email."
            : "A 6-digit code was sent to your admin email."
      );
      onAdminActivity({
        detail: `${resend ? "OTP resent" : "OTP sent"} for ${dangerDialog.site.coachName}.`,
        label: "Coach Sites security",
        status: "success"
      });
    } catch {
      setDangerFeedback("Could not reach the admin API to request a verification code.");
      onAdminActivity({
        detail: `${dangerDialog.site.coachName} OTP request failed safely.`,
        label: "Coach Sites security",
        status: "error"
      });
    } finally {
      setDangerBusy("");
    }
  }

  async function submitDangerAction() {
    if (!dangerDialog || dangerBusy) return;
    const { action, site } = dangerDialog;
    const requiresOtp = action !== "delete_draft";
    const reason = dangerReason.trim();
    if (requiresOtp && reason.length < 3) {
      setDangerFeedback("A reason of at least 3 characters is required.");
      return;
    }
    if (requiresOtp && (!dangerOtpSent || dangerOtp.length !== 6)) {
      setDangerFeedback("Send the code, then enter all 6 digits before continuing.");
      return;
    }

    const status: CoachSiteStatus = action === "archive" ? "archived" : "removed";
    const requestBody =
      action === "delete_draft"
        ? { action: "delete_draft", siteId: site.id, status }
        : { otp: dangerOtp, removalReason: reason, siteId: site.id, status };
    setDangerBusy("submit");
    setDangerFeedback(
      action === "archive"
        ? `Archiving ${site.coachName}...`
        : action === "remove"
          ? `Removing ${site.coachName}...`
          : `Deleting ${site.coachName} draft...`
    );
    onAdminActivity({
      detail: `${site.coachName} ${action.replace("_", " ")} started.`,
      label: "Coach Sites security",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/coach-sites", {
        body: JSON.stringify(requestBody),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-yw-admin-csrf": csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        coachSite?: CoachSiteRecord;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.coachSite) {
        const error = payload.error || "The destructive coach-site action was not completed.";
        setDangerFeedback(error);
        onAdminActivity({ detail: error, label: "Coach Sites security", status: "error" });
        return;
      }

      const nextSites = await refreshCoachSitesAfterDangerMutation(payload.coachSite);
      const successMessage =
        action === "archive"
          ? `${site.coachName} archived.`
          : action === "remove"
            ? `${site.coachName} removed.`
            : `${site.coachName} draft deleted.`;
      if (action === "archive") {
        setStatusFilter("archived");
        setSelectedSiteId(payload.coachSite.id);
      } else {
        const nextSite = nextSites.find((item) => item.status !== "removed");
        setStatusFilter("all");
        setSelectedSiteId(nextSite?.id || "");
        setSelectedOpsRowKey(nextSite?.slug || nextSite?.id || "");
      }
      setCurrentPage(1);
      setMessage(successMessage);
      setDangerDialog(null);
      setDangerFeedback("");
      setDangerOtp("");
      setDangerOtpSent(false);
      setDangerReason("");
      onAdminActivity({
        detail: `${successMessage} List persistence was refreshed from the coach-site API.`,
        label: "Coach Sites security",
        status: "success"
      });
    } catch {
      setDangerFeedback("Could not reach the admin API for this destructive action.");
      onAdminActivity({
        detail: `${site.coachName} ${action.replace("_", " ")} failed safely.`,
        label: "Coach Sites security",
        status: "error"
      });
    } finally {
      setDangerBusy("");
    }
  }

  const dangerActionLabel = dangerDialog
    ? dangerDialog.action === "archive"
      ? "Archive"
      : dangerDialog.action === "remove"
        ? "Remove"
        : "Delete draft"
    : "Confirm action";
  const dangerRequiresOtp = Boolean(dangerDialog && dangerDialog.action !== "delete_draft");
  const selectedPrimaryActionAllowed = selectedSite
    ? selectedSite.status === "archived"
      ? canArchive
      : selectedSite.status === "published" || selectedSite.status === "paused"
        ? canEdit
        : canPublish
    : true;

  return (
    <section className="dashboard-console v2-coach-sites-page" aria-label="Coach Sites">
      <div className="console-chrome">
        <div>
          <p className="console-kicker">Coach Sites</p>
          <h2>Referral website control</h2>
          <p>
            Search, filter, preview, copy, pause, resume, and monitor current production coach
            pages.
          </p>
        </div>
        <div className="console-actions">
          <span className="console-pill">{source === "loading" ? "Loading" : source}</span>
          {canCreate ? (
            <button
              className="btn btn-primary"
              onClick={() => onSelect("create-coach-site")}
              type="button"
            >
              Create Coach Site
            </button>
          ) : null}
        </div>
      </div>

      <div className="kpi-row v2-sites-kpis" aria-label="Coach site totals">
        <AdminV2SitesMiniMetric
          label="Free referral"
          value={counts.free}
          note={`${counts.published} published`}
        />
        <AdminV2SitesMiniMetric
          label="Paid funnels"
          value={counts.paid}
          note="Masterclass filter ready"
        />
        <AdminV2SitesMiniMetric
          label="Visits"
          value={totalVisits}
          note={`${totalClicks} CTA clicks`}
        />
        <AdminV2SitesMiniMetric
          label="Draft / archived"
          value={counts.draft + counts.archived}
          note="Builder saves and hidden records"
        />
      </div>

      <section className="console-card v2-sites-focus">
        <div className="section-head">
          <div>
            <h3>
              {selectedSite?.coachName || selectedIntelligence?.coachName || "No coach selected"}
            </h3>
            <p>
              {selectedSite
                ? `${selectedSite.niche || "Niche pending"} / ${selectedSite.location || "Region pending"}`
                : selectedIntelligence
                  ? `${selectedIntelligence.slug} / ${selectedIntelligence.region || "Region pending"}`
                  : "Select a coach row to inspect its status."}
            </p>
          </div>
          {selectedSite ? (
            <div className="row-actions">
              {selectedTableSiteIds.length ? (
                <AdminAIAskButton
                  className="btn btn-sm"
                  label="Analyze selected Coach Sites"
                  query="Why are these selected Coach Sites still in draft? Explain each selected row using only permission-visible evidence."
                  selectedEntityIds={selectedTableSiteIds}
                  scope="selection"
                />
              ) : null}
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setManagedSiteId(selectedSite.id)}
                type="button"
              >
                Manage
              </button>
              {canEdit && selectedSite.status !== "archived" ? (
                <button
                  className="btn btn-sm"
                  onClick={() => onEditSite(selectedSite)}
                  type="button"
                >
                  Edit
                </button>
              ) : null}
              <button
                className="btn btn-sm"
                onClick={() => openCoachPublicUrl(selectedSite)}
                type="button"
              >
                Open
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void copyPublicLink(selectedSite)}
                type="button"
              >
                Copy Link
              </button>
              <button
                className="btn btn-sm"
                onClick={() => onSelect("coach-analytics")}
                type="button"
              >
                Analytics
              </button>
            </div>
          ) : null}
        </div>
        <div className="grid grid-4 v2-sites-focus-grid">
          <AdminV2SitesFocusItem
            label="Status"
            value={selectedSite?.status || selectedIntelligence?.status || "--"}
          />
          <AdminV2SitesFocusItem
            label="Visits"
            value={(
              selectedSite?.analytics?.totalVisits ??
              selectedIntelligence?.visits ??
              0
            ).toLocaleString()}
          />
          <AdminV2SitesFocusItem
            label="CTA clicks"
            value={(
              selectedSite?.analytics?.totalRegisterClicks ??
              selectedIntelligence?.clicks ??
              0
            ).toLocaleString()}
          />
          <AdminV2SitesFocusItem
            label="Conversion"
            value={
              selectedSite?.analytics?.conversionRate ||
              formatAdminV2Percent(selectedIntelligence?.ctr || 0)
            }
          />
        </div>
        <AdminV2CoachOpsCommandDeck
          busySiteId={busySiteId}
          canRunPrimaryAction={selectedPrimaryActionAllowed}
          counts={counts}
          onCopyLink={(site) => void copyPublicLink(site)}
          onOpenAnalytics={() => onSelect("coach-analytics")}
          onOpenPublic={openCoachPublicUrl}
          onReactivate={(site) => void reactivateArchivedSite(site)}
          onSelectQueueRow={selectOperationQueueRow}
          onUpdateStatus={(site, status) => void updateSiteStatus(site, status)}
          queue={operationsQueue}
          selectedRow={selectedIntelligence}
          selectedSite={selectedSite || null}
        />
        <AdminV2CoachOpsAiBridge
          onOpenAnalytics={() => onSelect("coach-analytics")}
          onSelectQueueRow={selectOperationQueueRow}
          queue={operationsQueue}
          selectedRow={selectedIntelligence}
        />
      </section>

      <section className="console-card v2-sites-table-card">
        <div className="section-head">
          <div>
            <h3>Production coach records</h3>
            <p>
              Showing {tableSites.length} of {filteredSites.length} filtered records. Six records
              load per page from the live coach-site list.
            </p>
          </div>
          <div className="row-actions">
            <span className="console-pill">{selectedTableSiteIds.length} selected</span>
            <AdminAIAskButton
              className="btn btn-sm"
              label="Analyze visible table"
              query="Summarize the visible Coach Sites table using the current filters and explain the safest review-only next steps."
              scope="page"
            />
            <div className="tabs v2-sites-tabs">
              {(["all", "published", "paused", "draft", "archived"] as const).map((status) => (
                <button
                  className={`tab${statusFilter === status ? " is-active" : ""}`}
                  key={status}
                  onClick={() => changeStatusFilter(status)}
                  type="button"
                >
                  {getCoachV2StatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="filters v2-sites-filters">
          <div
            className="smart-search v2-sites-search"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setSearchOpen(false);
              }
            }}
          >
            <label htmlFor="v2-coach-sites-search">Find coach</label>
            <input
              aria-autocomplete="list"
              aria-controls="v2-coach-sites-suggestions"
              aria-expanded={searchOpen}
              aria-label="Find coach sites"
              id="v2-coach-sites-search"
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Name, niche, slug, source..."
              role="combobox"
              type="search"
              value={query}
            />
            {searchOpen ? (
              <div
                className={styles.v2SearchResults}
                id="v2-coach-sites-suggestions"
                role="listbox"
              >
                {searchSuggestions.length ? (
                  searchSuggestions.map((site) => (
                    <button
                      aria-selected={selectedSiteId === site.id}
                      key={site.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(site.coachName);
                        setSelectedSiteId(site.id);
                        changeStatusFilter("all");
                        changeSiteTypeFilter("all");
                        setSearchOpen(false);
                      }}
                      role="option"
                      type="button"
                    >
                      <strong>{site.coachName}</strong>
                      <span>
                        {site.slug} / {site.niche || "niche pending"} / {site.status}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.v2SearchEmpty}>No matching coach site found.</div>
                )}
              </div>
            ) : null}
          </div>
          <div className="tabs v2-sites-type-tabs" aria-label="Coach site type">
            {(
              [
                ["all", "All sites"],
                ["free", "Free referral"],
                ["paid", "Paid masterclass"]
              ] as const
            ).map(([value, label]) => (
              <button
                aria-pressed={siteTypeFilter === value}
                className={`tab${siteTypeFilter === value ? " is-active" : ""}`}
                key={value}
                onClick={() => changeSiteTypeFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter coach sites by status"
            onChange={(event) => changeStatusFilter(event.target.value as "all" | CoachSiteStatus)}
            value={statusFilter}
          >
            {(["all", "published", "paused", "draft", "archived"] as const).map((status) => (
              <option key={status} value={status}>
                {getCoachV2StatusLabel(status)}
              </option>
            ))}
          </select>
          <button className="btn" onClick={resetCoachSiteFilters} type="button">
            Reset filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        <div className="v2-sites-table-wrap">
          <table className="v2-sites-table">
            <thead>
              <tr>
                <th>
                  <input
                    aria-label="Select all visible coach sites"
                    checked={
                      tableSites.length > 0 &&
                      tableSites.every((site) => selectedTableSiteIds.includes(site.id))
                    }
                    onChange={toggleVisibleCoachSiteSelection}
                    type="checkbox"
                  />
                </th>
                <th>Coach</th>
                <th>Status</th>
                <th>Public Link</th>
                <th>Performance</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableSites.length ? (
                tableSites.map((site) => {
                  const nextStatus = site.status === "paused" ? "published" : "paused";
                  return (
                    <tr
                      aria-selected={selectedTableSiteIds.includes(site.id)}
                      data-selected={
                        selectedTableSiteIds.includes(site.id) || selectedSite?.id === site.id
                          ? "true"
                          : undefined
                      }
                      key={site.id}
                      onClick={() => {
                        setSelectedSiteId(site.id);
                        setSelectedOpsRowKey(site.slug || site.id);
                      }}
                    >
                      <td>
                        <input
                          aria-label={`Select ${site.coachName || site.slug}`}
                          checked={selectedTableSiteIds.includes(site.id)}
                          onChange={(event) =>
                            toggleCoachSiteSelection(site.id, event.currentTarget.checked)
                          }
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                      </td>
                      <td>
                        <div className="person">
                          <span className="avatar">{getCoachV2Initials(site.coachName)}</span>
                          <div>
                            <strong>{site.coachName || "Unnamed coach"}</strong>
                            <small>
                              {site.niche || "Niche pending"} / {site.location || "Region pending"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getCoachV2BadgeClass(site.status)}`}>
                          {getCoachV2StatusLabel(site.status)}
                        </span>
                      </td>
                      <td>
                        <code>{site.publicUrl || `/coach/${site.slug}`}</code>
                        <small>
                          {site.existingPaidFunnelUrl
                            ? "Paid masterclass funnel"
                            : "Free referral site"}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {(site.analytics?.totalVisits || 0).toLocaleString()} visits
                        </strong>
                        <small>
                          {(site.analytics?.totalRegisterClicks || 0).toLocaleString()} CTA /{" "}
                          {site.analytics?.conversionRate || "0.0%"}
                        </small>
                      </td>
                      <td>
                        {formatCoachV2Date(site.updatedAt || site.publishedAt || site.createdAt)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setManagedSiteId(site.id);
                            }}
                            type="button"
                          >
                            Manage
                          </button>
                          {canEdit && site.status !== "archived" ? (
                            <button
                              className="btn btn-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditSite(site);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            className="btn btn-sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCoachPublicUrl(site);
                            }}
                            type="button"
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyPublicLink(site);
                            }}
                            type="button"
                          >
                            Copy
                          </button>
                          {site.status === "archived" ? (
                            canArchive ? (
                              <button
                                className="btn btn-sm"
                                disabled={busySiteId === site.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void reactivateArchivedSite(site);
                                }}
                                type="button"
                              >
                                Restore
                              </button>
                            ) : null
                          ) : site.status === "published" || site.status === "paused" ? (
                            canEdit ? (
                              <button
                                className="btn btn-sm"
                                disabled={busySiteId === site.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void updateSiteStatus(site, nextStatus);
                                }}
                                type="button"
                              >
                                {site.status === "paused" ? "Resume" : "Pause"}
                              </button>
                            ) : null
                          ) : canPublish ? (
                            <button
                              className="btn btn-sm"
                              disabled={busySiteId === site.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void updateSiteStatus(site, "published");
                              }}
                              type="button"
                            >
                              Publish
                            </button>
                          ) : null}
                          {site.status !== "archived" && canArchive ? (
                            <button
                              className={`btn btn-sm ${styles.v2DangerRowButton}`}
                              disabled={busySiteId === site.id || dangerBusy !== ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                openDangerAction(site, "archive");
                              }}
                              type="button"
                            >
                              Archive
                            </button>
                          ) : null}
                          {site.status === "draft" && canDeleteDraft ? (
                            <button
                              className={`btn btn-sm ${styles.v2DangerRowButton}`}
                              disabled={busySiteId === site.id || dangerBusy !== ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                openDangerAction(site, "delete_draft");
                              }}
                              type="button"
                            >
                              Delete draft
                            </button>
                          ) : canRemove ? (
                            <button
                              className={`btn btn-sm ${styles.v2DangerRowButton}`}
                              disabled={busySiteId === site.id || dangerBusy !== ""}
                              onClick={(event) => {
                                event.stopPropagation();
                                openDangerAction(site, "remove");
                              }}
                              type="button"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <h3>No coach sites match this filter</h3>
                      <p>
                        Reset search or change the status filter to see live production records.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination v2-sites-pagination" aria-label="Coach sites pagination">
          <span>
            {filteredSites.length
              ? `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${filteredSites.length} records`
              : "Showing 0 of 0 records"}
          </span>
          <div className="row-actions v2-sites-page-actions">
            <button
              className="btn btn-sm"
              disabled={clampedCurrentPage <= 1}
              onClick={goToPreviousCoachSitesPage}
              type="button"
            >
              Back
            </button>
            <span className="console-pill" aria-live="polite">
              Page {clampedCurrentPage} / {pageCount}
            </span>
            <button
              className="btn btn-sm"
              disabled={!filteredSites.length || clampedCurrentPage >= pageCount}
              onClick={goToNextCoachSitesPage}
              type="button"
            >
              Next
            </button>
            <span className="console-pill">{counts.draft} drafts</span>
            <span className="console-pill">{counts.archived} archived</span>
          </div>
        </div>
      </section>

      <AdminV2ActionDialog
        onClose={() => setManagedSiteId("")}
        open={Boolean(managedSite)}
        theme={theme}
        title={managedSite ? `Manage ${managedSite.coachName}` : "Manage coach site"}
      >
        {managedSite ? (
          <div className={styles.v2ManageFlow}>
            <div className={styles.v2DangerSummary}>
              <span className={`badge ${getCoachV2BadgeClass(managedSite.status)}`}>
                {getCoachV2StatusLabel(managedSite.status)}
              </span>
              <div>
                <strong>{managedSite.coachName}</strong>
                <code>{managedSite.publicUrl || `/coach/${managedSite.slug}`}</code>
              </div>
            </div>
            <div className={styles.v2ManageGrid}>
              <AdminV2SitesFocusItem label="Niche" value={managedSite.niche || "Not set"} />
              <AdminV2SitesFocusItem label="Location" value={managedSite.location || "Not set"} />
              <AdminV2SitesFocusItem
                label="Visits"
                value={(managedSite.analytics?.totalVisits || 0).toLocaleString()}
              />
              <AdminV2SitesFocusItem
                label="Conversion"
                value={managedSite.analytics?.conversionRate || "0%"}
              />
            </div>
            <dl className={styles.v2ManageDefinitionGrid}>
              <div>
                <dt>Public slug</dt>
                <dd>{managedSite.slug}</dd>
              </div>
              <div>
                <dt>Template skin</dt>
                <dd>{managedSite.selectedThemeId}</dd>
              </div>
              <div>
                <dt>Funnel type</dt>
                <dd>{managedSite.existingPaidFunnelUrl ? "Paid masterclass" : "Free referral"}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>
                  {formatCoachV2Date(
                    managedSite.updatedAt || managedSite.publishedAt || managedSite.createdAt
                  )}
                </dd>
              </div>
            </dl>
            <div className="row-actions">
              {canEdit && managedSite.status !== "archived" ? (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setManagedSiteId("");
                    onEditSite(managedSite);
                  }}
                  type="button"
                >
                  Edit full site
                </button>
              ) : null}
              <button
                className="btn btn-sm"
                onClick={() => openCoachPublicUrl(managedSite)}
                type="button"
              >
                Open public preview
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void copyPublicLink(managedSite)}
                type="button"
              >
                Copy link
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setSelectedSiteId(managedSite.id);
                  setManagedSiteId("");
                  onSelect("coach-analytics");
                }}
                type="button"
              >
                Open analytics
              </button>
            </div>
            <div className={styles.v2ManageLifecycle}>
              <div>
                <strong>Lifecycle controls</strong>
                <p>
                  Status changes use the production API; archive/remove continue through protected
                  confirmation.
                </p>
              </div>
              <div className="row-actions">
                {managedSite.status === "archived" && canArchive ? (
                  <button
                    className="btn btn-sm"
                    disabled={busySiteId === managedSite.id}
                    onClick={() => void reactivateArchivedSite(managedSite)}
                    type="button"
                  >
                    Restore
                  </button>
                ) : null}
                {(managedSite.status === "published" || managedSite.status === "paused") &&
                canEdit ? (
                  <button
                    className="btn btn-sm"
                    disabled={busySiteId === managedSite.id}
                    onClick={() =>
                      void updateSiteStatus(
                        managedSite,
                        managedSite.status === "paused" ? "published" : "paused"
                      )
                    }
                    type="button"
                  >
                    {managedSite.status === "paused" ? "Resume" : "Pause"}
                  </button>
                ) : null}
                {managedSite.status === "draft" && canPublish ? (
                  <button
                    className="btn btn-sm"
                    disabled={busySiteId === managedSite.id}
                    onClick={() => void updateSiteStatus(managedSite, "published")}
                    type="button"
                  >
                    Publish
                  </button>
                ) : null}
                {managedSite.status !== "archived" && canArchive ? (
                  <button
                    className={`btn btn-sm ${styles.v2DangerRowButton}`}
                    onClick={() => {
                      setManagedSiteId("");
                      openDangerAction(managedSite, "archive");
                    }}
                    type="button"
                  >
                    Archive
                  </button>
                ) : null}
                {(managedSite.status === "draft" ? canDeleteDraft : canRemove) ? (
                  <button
                    className={`btn btn-sm ${styles.v2DangerRowButton}`}
                    onClick={() => {
                      setManagedSiteId("");
                      openDangerAction(
                        managedSite,
                        managedSite.status === "draft" ? "delete_draft" : "remove"
                      );
                    }}
                    type="button"
                  >
                    {managedSite.status === "draft" ? "Delete draft" : "Remove"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </AdminV2ActionDialog>

      <AdminV2ActionDialog
        onClose={closeDangerAction}
        open={Boolean(dangerDialog)}
        theme={theme}
        title={
          dangerDialog ? `${dangerActionLabel}: ${dangerDialog.site.coachName}` : "Confirm action"
        }
        tone="danger"
      >
        {dangerDialog ? (
          <div
            className={styles.v2DangerFlow}
            data-danger-action={dangerDialog.action}
            data-danger-step={dangerRequiresOtp && dangerOtpSent ? "verify" : "confirm"}
          >
            <div className={styles.v2DangerSummary}>
              <span className={`badge ${getCoachV2BadgeClass(dangerDialog.site.status)}`}>
                {getCoachV2StatusLabel(dangerDialog.site.status)}
              </span>
              <div>
                <strong>{dangerDialog.site.coachName}</strong>
                <code>{dangerDialog.site.publicUrl || `/coach/${dangerDialog.site.slug}`}</code>
              </div>
            </div>

            <p className={styles.v2DialogCopy}>
              {dangerDialog.action === "archive"
                ? "Archiving keeps this record recoverable, but its public page will show the temporary unavailable support state until restored."
                : dangerDialog.action === "remove"
                  ? "Removing hides this record from active Coach Sites and disconnects its public page. This action requires admin email verification."
                  : "Delete Draft permanently removes this unpublished draft from the active list. Published sites cannot use this action."}
            </p>

            {dangerRequiresOtp ? (
              <label className={styles.v2DangerField}>
                <span>
                  {dangerDialog.action === "archive"
                    ? "Reason for archiving"
                    : "Reason for removal"}
                </span>
                <textarea
                  autoFocus
                  disabled={dangerBusy === "submit"}
                  maxLength={240}
                  onChange={(event) => {
                    setDangerReason(event.target.value);
                    if (dangerFeedback) setDangerFeedback("");
                  }}
                  placeholder="Record the operational reason for this action"
                  rows={3}
                  value={dangerReason}
                />
                <small>{dangerReason.trim().length}/240 characters; minimum 3.</small>
              </label>
            ) : null}

            {dangerRequiresOtp && dangerOtpSent ? (
              <label className={styles.v2DangerField}>
                <span>6-digit verification code</span>
                <input
                  autoComplete="one-time-code"
                  disabled={dangerBusy === "submit"}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setDangerOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                    if (dangerFeedback) setDangerFeedback("");
                  }}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={dangerOtp}
                />
                <small>Use the latest code sent to the current admin email.</small>
              </label>
            ) : null}

            {dangerFeedback ? (
              <p
                className={styles.v2DangerFeedback}
                role={
                  /invalid|expired|required|could not|failed|enter|not completed/i.test(
                    dangerFeedback
                  )
                    ? "alert"
                    : "status"
                }
              >
                {dangerFeedback}
              </p>
            ) : null}

            <div className={styles.v2DangerActions}>
              <button
                className="btn"
                disabled={Boolean(dangerBusy)}
                onClick={closeDangerAction}
                type="button"
              >
                Cancel
              </button>
              {dangerRequiresOtp ? (
                <button
                  className="btn"
                  disabled={Boolean(dangerBusy) || dangerReason.trim().length < 3}
                  onClick={() => void sendDangerActionOtp()}
                  type="button"
                >
                  {dangerBusy === "send_otp"
                    ? dangerOtpSent
                      ? "Resending..."
                      : "Sending..."
                    : dangerOtpSent
                      ? "Resend OTP"
                      : "Send OTP"}
                </button>
              ) : null}
              <button
                className={styles.v2DangerConfirmButton}
                disabled={
                  Boolean(dangerBusy) ||
                  (dangerRequiresOtp &&
                    (!dangerOtpSent || dangerOtp.length !== 6 || dangerReason.trim().length < 3))
                }
                onClick={() => void submitDangerAction()}
                type="button"
              >
                {dangerBusy === "submit"
                  ? "Working..."
                  : dangerDialog.action === "archive"
                    ? "Archive site"
                    : dangerDialog.action === "remove"
                      ? "Remove site"
                      : "Delete draft"}
              </button>
            </div>
          </div>
        ) : null}
      </AdminV2ActionDialog>

      {message ? (
        <p className={styles.v2InlineStatus} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function AdminV2SitesMiniMetric({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: number;
}) {
  return (
    <article className="console-mini">
      <div>
        <small>{label}</small>
        <strong>{value.toLocaleString()}</strong>
        <span className="kpi-meta">{note}</span>
      </div>
      <svg className="mini-spark" aria-hidden="true" viewBox="0 0 100 40">
        <polyline points="4,32 22,30 39,25 58,27 76,18 96,14" />
      </svg>
    </article>
  );
}

function AdminV2SitesFocusItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="finance-card">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function AdminV2CoachCommandFlowMap({
  coachName,
  evidence,
  eyebrow,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  secondaryActionLabel,
  signalDetail,
  signalLabel,
  statusLabel,
  title
}: {
  coachName: string;
  evidence: string[];
  eyebrow: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  signalDetail: string;
  signalLabel: string;
  statusLabel: string;
  title: string;
}) {
  const nodes = [
    {
      detail: `${coachName} / ${statusLabel}`,
      icon: "chart" as const,
      label: "Signal",
      title: eyebrow
    },
    {
      detail: signalDetail,
      icon: "shield" as const,
      label: "Diagnosis",
      title: signalLabel
    },
    {
      detail: primaryActionLabel,
      icon: "users" as const,
      label: "Operation",
      title: "Coach workbench"
    },
    {
      detail: evidence[0] || "Awaiting live evidence",
      icon: "reports" as const,
      label: "Verification",
      title: "Evidence trail"
    }
  ];

  return (
    <div className="v2-command-flow-map" aria-label={title}>
      <div className="section-head">
        <div>
          <span className="badge">{eyebrow}</span>
          <h3>{title}</h3>
          <p>{signalDetail}</p>
        </div>
        <div className="row-actions">
          <button className="btn btn-sm" onClick={onPrimaryAction} type="button">
            <AdminV2ActionGlyph name="users" />
            <span>{primaryActionLabel}</span>
          </button>
          {onSecondaryAction && secondaryActionLabel ? (
            <button className="btn btn-sm" onClick={onSecondaryAction} type="button">
              <AdminV2ActionGlyph name="site" />
              <span>{secondaryActionLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
      <div className="v2-command-flow-nodes">
        {nodes.map((node, index) => (
          <article className="v2-command-node" data-index={index + 1} key={node.label}>
            <AdminV2ActionGlyph name={node.icon} />
            <small>{node.label}</small>
            <strong>{node.title}</strong>
            <span>{node.detail}</span>
          </article>
        ))}
      </div>
      <div className="v2-command-evidence">
        {evidence.slice(0, 4).map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function AdminV2CoachOpsCommandDeck({
  busySiteId,
  canRunPrimaryAction,
  counts,
  onCopyLink,
  onOpenAnalytics,
  onOpenPublic,
  onReactivate,
  onSelectQueueRow,
  onUpdateStatus,
  queue,
  selectedRow,
  selectedSite
}: {
  busySiteId: string;
  canRunPrimaryAction: boolean;
  counts: {
    archived: number;
    draft: number;
    free: number;
    paused: number;
    paid: number;
    published: number;
    total: number;
  };
  onCopyLink: (site: CoachSiteRecord) => void;
  onOpenAnalytics: () => void;
  onOpenPublic: (site: CoachSiteRecord) => void;
  onReactivate: (site: CoachSiteRecord) => void;
  onSelectQueueRow: (row: AdminV2CoachIntelligenceRow) => void;
  onUpdateStatus: (site: CoachSiteRecord, status: CoachSiteStatus) => void;
  queue: AdminV2CoachIntelligenceRow[];
  selectedRow: AdminV2CoachIntelligenceRow | null;
  selectedSite: CoachSiteRecord | null;
}) {
  const selectedCoachName = selectedSite?.coachName || selectedRow?.coachName || "Select a coach";
  const primaryStatus: CoachSiteStatus =
    selectedSite?.status === "paused"
      ? "published"
      : selectedSite?.status === "published"
        ? "paused"
        : "published";
  const primaryActionLabel = selectedSite
    ? selectedSite.status === "archived"
      ? "Restore"
      : selectedSite.status === "published"
        ? "Pause"
        : selectedSite.status === "paused"
          ? "Resume"
          : "Publish"
    : selectedRow
      ? "Open Analytics"
      : "Select coach";
  const isBusy = Boolean(selectedSite && busySiteId === selectedSite.id);
  const evidence = selectedSite
    ? [
        `${selectedSite.analytics?.totalVisits || 0} visits`,
        `${selectedSite.analytics?.totalRegisterClicks || 0} CTA clicks`,
        selectedSite.analytics?.conversionRate || "0.0% conversion",
        `Updated ${formatCoachV2Date(selectedSite.updatedAt || selectedSite.publishedAt || selectedSite.createdAt)}`
      ]
    : selectedRow
      ? [
          `${selectedRow.visits.toLocaleString("en-IN")} visits`,
          `${selectedRow.clicks.toLocaleString("en-IN")} CTA clicks`,
          `${formatAdminV2Percent(selectedRow.ctr)} conversion`,
          selectedRow.source
        ]
      : [
          `${counts.total} records`,
          `${counts.published} published`,
          `${counts.draft} drafts`,
          `${counts.archived} archived`
        ];

  function runPrimaryAction() {
    if (!selectedSite) {
      if (selectedRow) onOpenAnalytics();
      return;
    }
    if (isBusy) return;
    if (selectedSite.status === "archived") {
      onReactivate(selectedSite);
      return;
    }
    onUpdateStatus(selectedSite, primaryStatus);
  }

  return (
    <div className="v2-ops-command-deck" aria-label="Coach operations command deck">
      <AdminV2CoachCommandFlowMap
        coachName={selectedCoachName}
        evidence={evidence}
        eyebrow="Operate"
        onPrimaryAction={onOpenAnalytics}
        onSecondaryAction={selectedSite ? () => onOpenPublic(selectedSite) : undefined}
        primaryActionLabel="Open Analytics"
        secondaryActionLabel={selectedSite ? "Open public" : undefined}
        signalDetail={
          selectedRow?.risk.reason ||
          "Select a production coach record to connect analytics diagnosis to operations."
        }
        signalLabel={selectedRow?.risk.label || "Workbench ready"}
        statusLabel={selectedSite?.status || selectedRow?.status || "No record"}
        title="Signal to action flow"
      />
      <div className="v2-ops-command-grid">
        <article className="v2-ops-action-panel">
          <small>Selected coach action</small>
          <strong>{selectedCoachName}</strong>
          <p>
            {selectedRow?.risk.action || "Choose a row or queue item to load operational context."}
          </p>
          <div className="v2-action-stack">
            <button
              className="btn btn-sm btn-primary"
              disabled={(!selectedSite && !selectedRow) || isBusy || !canRunPrimaryAction}
              onClick={runPrimaryAction}
              title={
                !canRunPrimaryAction ? "Your admin role cannot run this status action." : undefined
              }
              type="button"
            >
              {isBusy ? "Working..." : canRunPrimaryAction ? primaryActionLabel : "Not permitted"}
            </button>
            <button
              className="btn btn-sm"
              disabled={!selectedSite}
              onClick={() => selectedSite && onCopyLink(selectedSite)}
              type="button"
            >
              Copy link
            </button>
            <button
              className="btn btn-sm"
              disabled={!selectedSite}
              onClick={() => selectedSite && onOpenPublic(selectedSite)}
              type="button"
            >
              Open public
            </button>
          </div>
        </article>
        <article className="v2-ops-queue-panel">
          <small>Operational queue</small>
          <strong>
            {queue.length
              ? `${queue.length} coach${queue.length === 1 ? "" : "es"} need action`
              : "Queue clear"}
          </strong>
          <div className="v2-ops-queue-list">
            {queue.length ? (
              queue.slice(0, 5).map((row) => (
                <button key={row.id} onClick={() => onSelectQueueRow(row)} type="button">
                  <span className={`badge ${getAdminV2RiskBadgeClass(row.risk.priority)}`}>
                    {row.risk.priority}
                  </span>
                  <span>
                    <strong>{row.coachName}</strong>
                    <small>{row.risk.action}</small>
                  </span>
                </button>
              ))
            ) : (
              <button onClick={onOpenAnalytics} type="button">
                <span className="badge badge-accent">clear</span>
                <span>
                  <strong>No urgent queue</strong>
                  <small>Open Analytics for full portfolio review.</small>
                </span>
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}

function AdminV2AiBotPill({ label = "AI" }: { label?: string }) {
  return (
    <span className="v2-ai-bot-pill" aria-hidden="true">
      <AdminV2AiBotSvg className="v2-ai-bot-pill-svg" state="focus" />
      <span className="v2-ai-bot-label">{label}</span>
    </span>
  );
}

function AdminV2CoachOpsAiBridge({
  onOpenAnalytics,
  onSelectQueueRow,
  queue,
  selectedRow
}: {
  onOpenAnalytics: () => void;
  onSelectQueueRow?: (row: AdminV2CoachIntelligenceRow) => void;
  queue: AdminV2CoachIntelligenceRow[];
  selectedRow: AdminV2CoachIntelligenceRow | null;
}) {
  const focusSignal = selectedRow?.risk;

  return (
    <div className="v2-ai-ops-bridge" aria-label="Coach operations intelligence bridge">
      <div className="v2-ai-ops-primary">
        <AdminV2AiBotPill />
        <div>
          <small>Operations brain</small>
          <strong>{focusSignal?.label || "Select a coach to compute action context"}</strong>
          <p>
            {focusSignal
              ? `${focusSignal.reason} Recommended action: ${focusSignal.action}.`
              : "The workbench uses live counters to prioritize and route coach actions."}
          </p>
        </div>
      </div>
      <div className="v2-ai-ops-queue">
        {queue.length ? (
          queue.map((row) => (
            <button
              key={row.id}
              onClick={() => {
                if (onSelectQueueRow) {
                  onSelectQueueRow(row);
                  return;
                }
                onOpenAnalytics();
              }}
              type="button"
            >
              <span className={`badge ${getAdminV2RiskBadgeClass(row.risk.priority)}`}>
                {row.risk.priority}
              </span>
              <strong>{row.coachName}</strong>
              <small>{row.risk.action}</small>
            </button>
          ))
        ) : (
          <button onClick={onOpenAnalytics} type="button">
            <span className="badge badge-accent">clear</span>
            <strong>No urgent queue</strong>
            <small>Open Analytics for deeper comparison.</small>
          </button>
        )}
      </div>
    </div>
  );
}

function AdminV2TopPerformersPage({
  analyticsSource,
  analyticsSummaries,
  coachSites,
  dataLoading,
  onAIContextChange
}: {
  analyticsSource: string;
  analyticsSummaries: AnalyticsMetricSummary[];
  coachSites: CoachSiteRecord[];
  dataLoading: boolean;
  onAIContextChange: (context: AdminAITableContext) => void;
}) {
  const rows = useMemo(
    () =>
      getAdminV2CoachRows(coachSites, analyticsSummaries)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8),
    [analyticsSummaries, coachSites]
  );
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: { ranking: "top-8" },
      rows: rows.map((row) => ({
        duplicateKey: normalizeCoachSlug(row.slug || row.coachName),
        groupKey: row.region,
        id: row.id || row.slug,
        label: row.coachName,
        requiredDataComplete: Boolean(row.coachName && row.slug),
        status: row.status
      })),
      selectedIds: [],
      sort: { direction: "desc", field: "visits" },
      tableId: "coach-leaderboard"
    }),
    [rows]
  );
  const topCoach = rows[0];
  const totalVisits = rows.reduce((total, row) => total + row.visits, 0);
  const totalClicks = rows.reduce((total, row) => total + row.clicks, 0);

  useEffect(() => {
    onAIContextChange(tableAiContext);
  }, [onAIContextChange, tableAiContext]);

  return (
    <AdminV2ModuleShell
      eyebrow="Coach performance"
      title="Top performers"
      description="Ranked coach-site performance from the same production analytics stream."
      aside={
        <span className={`badge ${dataLoading ? "badge-warning" : "badge-accent"}`}>
          {dataLoading ? "Syncing" : formatAdminV2SourceLabel(analyticsSource)}
        </span>
      }
    >
      <div className="kpi-row">
        <AdminV2MetricTile
          label="Visible coaches"
          value={rows.length.toLocaleString()}
          note="Ranked from current records"
        />
        <AdminV2MetricTile
          label="Total visits"
          value={totalVisits.toLocaleString()}
          note="Selected analytics range"
        />
        <AdminV2MetricTile
          label="CTA clicks"
          value={totalClicks.toLocaleString()}
          note="Register + intent clicks"
        />
        <AdminV2MetricTile
          label="Leader"
          value={topCoach?.coachName || "No data"}
          note={topCoach ? `${topCoach.visits.toLocaleString()} visits` : "Waiting for traffic"}
        />
      </div>
      <section className="console-card">
        <div className="section-head">
          <div>
            <span className="badge">Ranked list</span>
            <h3>Coach leaderboard</h3>
            <p>Compact, sortable-ready data shape for production coach ranking.</p>
          </div>
          <AdminAIAskButton
            className="btn btn-sm"
            label="Analyze coach leaderboard"
            query="Summarize the visible coach leaderboard, compare statuses, and identify records needing attention."
            scope="page"
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Region</th>
                <th>Status</th>
                <th>Visits</th>
                <th>CTA</th>
                <th>CTR</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Coach">
                    <div className="person">
                      <span className="avatar" aria-hidden="true">
                        {getCoachV2Initials(row.coachName)}
                      </span>
                      <div>
                        <strong>{row.coachName}</strong>
                        <small>{row.slug}</small>
                      </div>
                    </div>
                  </td>
                  <td data-label="Region">{row.region}</td>
                  <td data-label="Status">
                    <span className={`badge ${getCoachV2BadgeClass(row.status)}`}>
                      {formatSiteStatus(row.status)}
                    </span>
                  </td>
                  <td data-label="Visits">{row.visits.toLocaleString()}</td>
                  <td data-label="CTA">{row.clicks.toLocaleString()}</td>
                  <td data-label="CTR">{formatAdminV2Percent(row.ctr)}</td>
                  <td data-label="Source">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminV2ModuleShell>
  );
}

function AdminV2CoachAnalyticsPage({
  analyticsCustomEnd,
  analyticsCustomStart,
  analyticsRange,
  analyticsRangeMeta,
  analyticsSource,
  analyticsSummaries,
  coachSites,
  dataLoading,
  dataUpdatedAt,
  onAnalyticsCustomEndChange,
  onAnalyticsCustomStartChange,
  onAnalyticsRangeChange,
  onAIContextChange,
  onTableAIContextChange,
  onAdminActivity,
  onOpenCoachOps,
  recentEvents,
  snapshot,
  timeSeries
}: {
  analyticsCustomEnd: string;
  analyticsCustomStart: string;
  analyticsRange: AnalyticsDateRangeId;
  analyticsRangeMeta: AnalyticsEventRange | null;
  analyticsSource: string;
  analyticsSummaries: AnalyticsMetricSummary[];
  coachSites: CoachSiteRecord[];
  dataLoading: boolean;
  dataUpdatedAt: string;
  onAnalyticsCustomEndChange: (value: string) => void;
  onAnalyticsCustomStartChange: (value: string) => void;
  onAnalyticsRangeChange: (value: AnalyticsDateRangeId) => void;
  onAIContextChange: (context: AdminV2CoachAnalyticsAIContext) => void;
  onTableAIContextChange: (context: AdminAITableContext) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onOpenCoachOps: (row: CoachAnalyticsRow) => void;
  recentEvents: AnalyticsRecentEvent[];
  source: string;
  snapshot: AdminV2DashboardData | null;
  timeSeries: AnalyticsTimeSeriesPoint[];
}) {
  const rows = useMemo(
    () => getAdminV2CoachRows(coachSites, analyticsSummaries),
    [analyticsSummaries, coachSites]
  );
  const productionRows = useMemo(
    () =>
      buildCoachAnalyticsRows(coachSites, analyticsSummaries, {
        preferEventSummaries: true
      }),
    [analyticsSummaries, coachSites]
  );
  const intelligenceRows = useMemo(
    () => buildAdminV2CoachIntelligenceRows(rows, productionRows),
    [productionRows, rows]
  );
  const [query, setQuery] = useState("");
  const [selectedCoachKey, setSelectedCoachKey] = useState(
    intelligenceRows[0]?.slug || productionRows[0]?.coachSlug || ""
  );
  const [funnelFilter, setFunnelFilter] = useState<AdminV2CoachAnalyticsFunnelFilter>("all");
  const [performanceFilter, setPerformanceFilter] =
    useState<AdminV2CoachAnalyticsPerformanceFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [sortBy, setSortBy] = useState<AdminV2CoachAnalyticsSortBy>("visits");
  const [statusFilter, setStatusFilter] = useState<AdminV2CoachAnalyticsStatusFilter>("all");
  const [dedicatedCoachKey, setDedicatedCoachKey] = useState("");
  const analyticsRangeLabel = analyticsRangeMeta?.label || analyticsRange.toUpperCase();
  const filteredRows = intelligenceRows.filter((row) =>
    `${row.coachName} ${row.slug} ${row.region} ${row.source}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const productionFilteredRows = useMemo(
    () =>
      filterCoachAnalyticsRows({
        dateRange: analyticsRange,
        funnelFilter,
        performanceFilter,
        query,
        regionFilter,
        rows: productionRows,
        sortBy,
        statusFilter
      }),
    [
      analyticsRange,
      funnelFilter,
      performanceFilter,
      productionRows,
      query,
      regionFilter,
      sortBy,
      statusFilter
    ]
  );
  const productionSearchRows = getAdminV2CoachAnalyticsSearchSuggestions(productionRows, query);
  const productionRegions = Array.from(
    new Set(productionRows.map((row) => getAdminV2CoachAnalyticsRegionLabel(row)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const selectedCoach =
    intelligenceRows.find((row) => row.id === selectedCoachKey || row.slug === selectedCoachKey) ||
    intelligenceRows.find((row) => row.slug === productionFilteredRows[0]?.coachSlug) ||
    filteredRows[0] ||
    intelligenceRows[0] ||
    null;
  const selectedProductionCoach =
    productionRows.find(
      (row) =>
        row.coachSlug === selectedCoachKey ||
        row.coachId === selectedCoachKey ||
        row.coachSlug === selectedCoach?.slug ||
        row.freeGuestLinks.some(
          (site) => site.id === selectedCoachKey || site.slug === selectedCoach?.slug
        )
    ) ||
    productionFilteredRows[0] ||
    productionRows[0] ||
    null;
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: {
        dateRange: analyticsRangeLabel,
        funnel: funnelFilter,
        performance: performanceFilter,
        query,
        region: regionFilter,
        status: statusFilter
      },
      rows: productionFilteredRows.map((row) => ({
        duplicateKey: normalizeCoachSlug(row.coachSlug || row.coachName),
        groupKey: getAdminV2CoachAnalyticsRegionLabel(row),
        id: row.coachId || row.coachSlug,
        label: row.coachName,
        linkValid: getAdminV2CoachPublicHref(row)
          ? isAdminV2SingleHttpsUrl(getAdminV2CoachPublicHref(row))
          : false,
        requiredDataComplete: Boolean(row.coachName && (row.coachId || row.coachSlug)),
        status: row.status
      })),
      selectedIds: selectedProductionCoach
        ? [selectedProductionCoach.coachId || selectedProductionCoach.coachSlug]
        : [],
      sort: { direction: "desc", field: sortBy },
      tableId: "coach-analytics"
    }),
    [
      analyticsRangeLabel,
      funnelFilter,
      performanceFilter,
      productionFilteredRows,
      query,
      regionFilter,
      selectedProductionCoach,
      sortBy,
      statusFilter
    ]
  );
  const selectedAnalyticsEntityKey = Array.from(
    new Set(
      analyticsSummaries
        .filter(
          (summary) =>
            summary.coachId === selectedProductionCoach?.coachId ||
            summary.coachSlug === selectedProductionCoach?.coachSlug
        )
        .map(getAdminAIAnalyticsEntityId)
    )
  ).join("|");
  const dedicatedCoach =
    productionRows.find(
      (row) => row.coachSlug === dedicatedCoachKey || row.coachId === dedicatedCoachKey
    ) || null;
  const dedicatedCoachEntityIds = dedicatedCoach
    ? Array.from(
        new Set(
          analyticsSummaries
            .filter(
              (summary) =>
                summary.coachId === dedicatedCoach.coachId ||
                summary.coachSlug === dedicatedCoach.coachSlug
            )
            .map(getAdminAIAnalyticsEntityId)
        )
      )
    : [];
  const showSuggestions = query.trim().length > 0;
  const chartPoints = buildAdminV2OdChartPoints(timeSeries);
  useEffect(() => {
    if (!intelligenceRows.length && !productionRows.length) return;
    const selectionExists =
      intelligenceRows.some(
        (row) => row.id === selectedCoachKey || row.slug === selectedCoachKey
      ) ||
      productionRows.some(
        (row) => row.coachId === selectedCoachKey || row.coachSlug === selectedCoachKey
      );
    if (selectionExists) return;
    const nextKey =
      intelligenceRows[0]?.slug || productionRows[0]?.coachSlug || intelligenceRows[0]?.id || "";
    if (!nextKey) return;
    const frame = window.requestAnimationFrame(() => setSelectedCoachKey(nextKey));
    return () => window.cancelAnimationFrame(frame);
  }, [intelligenceRows, productionRows, selectedCoachKey]);

  useEffect(() => {
    onAIContextChange({
      filters: {
        dateRange: analyticsRangeLabel,
        funnel: funnelFilter,
        performance: performanceFilter,
        query,
        region: regionFilter,
        sort: sortBy,
        status: statusFilter
      },
      selectedIds: selectedAnalyticsEntityKey
        ? selectedAnalyticsEntityKey.split("|")
        : selectedCoachKey
          ? [selectedCoachKey]
          : []
    });
  }, [
    analyticsRangeLabel,
    funnelFilter,
    onAIContextChange,
    performanceFilter,
    query,
    regionFilter,
    selectedAnalyticsEntityKey,
    selectedCoachKey,
    sortBy,
    statusFilter
  ]);

  useEffect(() => {
    onTableAIContextChange(tableAiContext);
  }, [onTableAIContextChange, tableAiContext]);

  function selectCoachAnalyticsRow(row: CoachAnalyticsRow) {
    setSelectedCoachKey(row.coachSlug || row.coachId);
    setQuery("");
  }

  function openCoachDedicatedAnalytics(row: CoachAnalyticsRow) {
    selectCoachAnalyticsRow(row);
    setDedicatedCoachKey(row.coachSlug || row.coachId);
    onAdminActivity({
      detail: `${row.coachName} dedicated analytics opened from the production coach matrix.`,
      label: "Coach Analytics",
      status: "success"
    });
  }

  return (
    <AdminV2ModuleShell
      eyebrow="Analytics"
      title="Coach-specific analytics"
      description="One coach at a time, searchable at scale, with production traffic and intent signals."
      aside={
        <span className={`badge ${dataLoading ? "badge-warning" : "badge-accent"}`}>
          {dataLoading ? "Loading" : formatAdminV2SourceLabel(analyticsSource)}
        </span>
      }
    >
      <section className="console-card v2-search-panel">
        <div className="section-head">
          <div>
            <span className="badge">Find coach</span>
            <h3>Search coach analytics</h3>
            <p>Type a coach, slug, region, or source. Suggestions open while searching.</p>
          </div>
          <button
            className="btn btn-sm console-command-btn"
            disabled={!selectedProductionCoach}
            onClick={() => {
              if (selectedProductionCoach) onOpenCoachOps(selectedProductionCoach);
            }}
            type="button"
          >
            <AdminV2ActionGlyph name="site" />
            <span>Manage sites</span>
          </button>
        </div>
        <div className="smart-search" data-smart-search-wrap="">
          <label htmlFor="v2-coach-analytics-search">Search</label>
          <input
            aria-label="Search coach analytics"
            autoComplete="off"
            id="v2-coach-analytics-search"
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const row = productionSearchRows[0];
              if (!row) return;
              selectCoachAnalyticsRow(row);
            }}
            placeholder="Search coach, slug, region, source..."
            type="search"
            value={query}
          />
          {showSuggestions ? (
            <div className="smart-search-results" role="listbox">
              {productionSearchRows.slice(0, 8).map((row) => (
                <button
                  aria-selected={selectedProductionCoach?.coachId === row.coachId}
                  key={row.coachId}
                  onClick={() => selectCoachAnalyticsRow(row)}
                  role="option"
                  type="button"
                >
                  <strong>{row.coachName}</strong>
                  <span>
                    {getAdminV2CoachAnalyticsRegionLabel(row)} / {row.bestFunnel} /{" "}
                    {row.combined.visits.toLocaleString()} visits
                  </span>
                </button>
              ))}
              {!productionSearchRows.length ? <span>No matching coach</span> : null}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid grid-3">
        <section className="console-card">
          <div className="person">
            <span className="avatar" aria-hidden="true">
              {getCoachV2Initials(selectedCoach?.coachName || "YW")}
            </span>
            <div>
              <h3>{selectedCoach?.coachName || "No coach selected"}</h3>
              <p>{selectedCoach?.slug || "No analytics record yet"}</p>
            </div>
          </div>
          <div className="finance-ledger">
            <div className="finance-card">
              <small>Status</small>
              <strong>{selectedCoach ? formatSiteStatus(selectedCoach.status) : "--"}</strong>
            </div>
            <div className="finance-card">
              <small>Region</small>
              <strong>{selectedCoach?.region || "--"}</strong>
            </div>
          </div>
        </section>
        <AdminV2MetricTile
          label="Visits"
          value={(selectedCoach?.visits || 0).toLocaleString()}
          note="Current selected range"
        />
        <AdminV2MetricTile
          label="CTA clicks"
          value={(selectedCoach?.clicks || 0).toLocaleString()}
          note="Register/contact intent"
        />
      </div>

      <section
        className="console-card v2-command-system"
        aria-label="Analytics to operations command flow"
      >
        <AdminV2CoachCommandFlowMap
          coachName={
            selectedProductionCoach?.coachName || selectedCoach?.coachName || "No coach selected"
          }
          evidence={[
            `${(selectedProductionCoach?.combined.visits || selectedCoach?.visits || 0).toLocaleString("en-IN")} visits`,
            `${(selectedProductionCoach?.combined.clicks || selectedCoach?.clicks || 0).toLocaleString("en-IN")} CTA clicks`,
            selectedProductionCoach?.bestFunnel || "No funnel selected",
            selectedProductionCoach
              ? `Last activity ${formatAdminV2CoachActivity(selectedProductionCoach.combined.lastActivity)}`
              : "No activity selected"
          ]}
          eyebrow="Observe"
          onPrimaryAction={() => {
            if (selectedProductionCoach) onOpenCoachOps(selectedProductionCoach);
          }}
          onSecondaryAction={
            selectedProductionCoach && getAdminV2CoachPublicHref(selectedProductionCoach)
              ? () => {
                  if (typeof window === "undefined") return;
                  window.open(
                    getAdminV2CoachPublicHref(selectedProductionCoach),
                    "_blank",
                    "noopener,noreferrer"
                  );
                }
              : undefined
          }
          primaryActionLabel="Open Coaches"
          secondaryActionLabel={
            selectedProductionCoach && getAdminV2CoachPublicHref(selectedProductionCoach)
              ? "Open public"
              : undefined
          }
          signalDetail={
            selectedCoach?.risk.reason ||
            selectedProductionCoach?.lowActivityReasons[0] ||
            "Production counters are loaded and ready for coach-level operations."
          }
          signalLabel={
            selectedCoach?.risk.label ||
            (selectedProductionCoach
              ? formatAdminV2Label(selectedProductionCoach.performanceBand)
              : "Waiting")
          }
          statusLabel={selectedProductionCoach?.status || selectedCoach?.status || "No record"}
          title="Analytics to operations flow"
        />
      </section>

      <section
        className="console-card v2-coach-analytics-studio"
        aria-label="Coach-wise analytics command surface"
      >
        <div className="section-head">
          <div>
            <span className="badge">Coach-wise analytics</span>
            <h3>Production coach matrix</h3>
            <p>
              Same production counters as the existing coach analytics table, rebuilt as a V2
              command surface with funnel, risk, report, and operations context.
            </p>
          </div>
          <div
            className="row-actions"
            onFocusCapture={() => onTableAIContextChange(tableAiContext)}
            onPointerDownCapture={() => onTableAIContextChange(tableAiContext)}
          >
            <AdminAIAskButton
              className="btn btn-sm"
              label="Analyze coach analytics table"
              query="Summarize the visible coach analytics table, compare statuses, and identify records needing attention."
              scope="page"
            />
            <span className="console-pill">
              Showing {productionFilteredRows.length.toLocaleString("en-IN")} /{" "}
              {productionRows.length.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="v2-coach-analytics-filters" aria-label="Coach analytics filters">
          <label>
            Funnel type
            <select
              onChange={(event) =>
                setFunnelFilter(event.currentTarget.value as AdminV2CoachAnalyticsFunnelFilter)
              }
              value={funnelFilter}
            >
              <option value="all">All funnels</option>
              <option value="paid">Paid only</option>
              <option value="free">Free only</option>
              <option value="both">Both funnels</option>
              <option value="none">No funnel</option>
            </select>
          </label>
          <label>
            Status
            <select
              onChange={(event) =>
                setStatusFilter(event.currentTarget.value as AdminV2CoachAnalyticsStatusFilter)
              }
              value={statusFilter}
            >
              <option value="all">Current records</option>
              <option value="active">Active</option>
              <option value="published">Published</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Region
            <select
              onChange={(event) => setRegionFilter(event.currentTarget.value)}
              value={regionFilter}
            >
              <option value="all">All regions</option>
              {productionRegions.map((region) => (
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
                setPerformanceFilter(
                  event.currentTarget.value as AdminV2CoachAnalyticsPerformanceFilter
                )
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
              onChange={(event) =>
                setSortBy(event.currentTarget.value as AdminV2CoachAnalyticsSortBy)
              }
              value={sortBy}
            >
              <option value="visits">Visits</option>
              <option value="clicks">Clicks</option>
              <option value="conversion">CTR</option>
              <option value="recent">Recent activity</option>
              <option value="weekly">Weekly growth</option>
              <option value="monthly">Monthly performance</option>
            </select>
          </label>
          <button
            className="btn btn-sm"
            onClick={() => {
              setFunnelFilter("all");
              setPerformanceFilter("all");
              setRegionFilter("all");
              setSortBy("visits");
              setStatusFilter("all");
            }}
            type="button"
          >
            Reset filters
          </button>
        </div>

        <AdminV2CoachWiseAnalyticsMatrix
          onOpenCoachOps={onOpenCoachOps}
          onOpenCoachAnalytics={openCoachDedicatedAnalytics}
          rows={productionFilteredRows}
          selectedCoach={selectedProductionCoach}
        />
      </section>

      <div className="grid grid-2">
        <section className="console-card">
          <div className="section-head">
            <div>
              <span className="badge">Traffic curve</span>
              <h3>Visits and previous range</h3>
              <p>
                {analyticsRangeMeta?.label || analyticsRange.toUpperCase()} / updated{" "}
                {dataUpdatedAt ? formatSignalTime(dataUpdatedAt) : "recently"}.
              </p>
            </div>
            <div className="tabs" role="tablist" aria-label="Analytics range">
              {(
                [
                  { id: "today", label: "24H" },
                  { id: "7d", label: "7D" },
                  { id: "30d", label: "30D" },
                  { id: "90d", label: "90D" }
                ] as Array<{ id: AnalyticsDateRangeId; label: string }>
              ).map((range) => (
                <button
                  aria-selected={analyticsRange === range.id}
                  className={analyticsRange === range.id ? "is-active" : ""}
                  key={range.id}
                  onClick={() => onAnalyticsRangeChange(range.id)}
                  role="tab"
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <AdminV2MiniLineChart points={chartPoints} />
          <div className="filters">
            <label>
              Start
              <input
                aria-label="Analytics custom start date"
                onChange={(event) => onAnalyticsCustomStartChange(event.currentTarget.value)}
                type="date"
                value={analyticsCustomStart}
              />
            </label>
            <label>
              End
              <input
                aria-label="Analytics custom end date"
                onChange={(event) => onAnalyticsCustomEndChange(event.currentTarget.value)}
                type="date"
                value={analyticsCustomEnd}
              />
            </label>
          </div>
        </section>
        <section className="console-card">
          <div className="section-head">
            <div>
              <span className="badge">Recent signals</span>
              <h3>Live activity</h3>
              <p>Latest safe event stream without exposing private visitor data.</p>
            </div>
          </div>
          <div className="finance-ledger">
            {recentEvents.slice(0, 6).map((event) => (
              <div
                className="finance-card"
                key={`${event.createdAt}-${event.eventName}-${event.coachSlug}`}
              >
                <small>{formatAdminV2Label(event.eventName)}</small>
                <strong>{event.coachSlug || "YWcoach"}</strong>
                <span>
                  {formatSignalTime(event.createdAt)} / {event.source || "direct"}
                </span>
              </div>
            ))}
            {!recentEvents.length ? (
              <div className="finance-card">
                <small>Events</small>
                <strong>No recent activity</strong>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="console-card dashboard-map audience-panel">
        <div className="section-head">
          <div>
            <span className="badge">Audience geography</span>
            <h3>Region map</h3>
            <p>Country, state, district, and city drilldown from the analytics source.</p>
          </div>
        </div>
        <AdminV2AudienceMapPanel
          onAIContextChange={onTableAIContextChange}
          snapshot={snapshot}
          status={snapshot?.sources.analyticsEvents.status || "loading"}
        />
      </section>

      {dedicatedCoach ? (
        <AdminV2CoachDedicatedAnalyticsDialog
          analyticsRangeLabel={analyticsRangeLabel}
          coach={dedicatedCoach}
          intelligence={selectedCoach}
          onAdminActivity={onAdminActivity}
          onClose={() => setDedicatedCoachKey("")}
          onOpenCoachOps={() => {
            setDedicatedCoachKey("");
            onOpenCoachOps(dedicatedCoach);
          }}
          recentEvents={recentEvents}
          selectedEntityIds={dedicatedCoachEntityIds}
        />
      ) : null}
    </AdminV2ModuleShell>
  );
}

function AdminV2CoachWiseAnalyticsMatrix({
  onOpenCoachOps,
  onOpenCoachAnalytics,
  rows,
  selectedCoach
}: {
  onOpenCoachOps: (row: CoachAnalyticsRow) => void;
  onOpenCoachAnalytics: (row: CoachAnalyticsRow) => void;
  rows: CoachAnalyticsRow[];
  selectedCoach: CoachAnalyticsRow | null;
}) {
  return (
    <div className="v2-coach-analytics-table-wrap">
      <table className="v2-coach-analytics-table">
        <thead>
          <tr>
            <th>Coach</th>
            <th>Region</th>
            <th>Funnels</th>
            <th>Status</th>
            <th>Visits</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>Best funnel</th>
            <th>Last activity</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => {
              const publicHref = getAdminV2CoachPublicHref(row);
              const selected = selectedCoach?.coachId === row.coachId;

              return (
                <tr data-selected={selected ? "true" : "false"} key={row.coachId}>
                  <td data-label="Coach">
                    <div className="person">
                      <span className="avatar" aria-hidden="true">
                        {getCoachV2Initials(row.coachName)}
                      </span>
                      <div>
                        <strong>{row.coachName}</strong>
                        <small>{row.niche}</small>
                        <code>{row.coachSlug}</code>
                      </div>
                    </div>
                  </td>
                  <td data-label="Region">{getAdminV2CoachAnalyticsRegionLabel(row)}</td>
                  <td data-label="Funnels">
                    <AdminV2CoachFunnelBadges row={row} />
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${getAdminV2CoachAnalyticsStatusClass(row.status)}`}>
                      {formatAdminV2Label(row.status)}
                    </span>
                  </td>
                  <td data-label="Visits">{row.combined.visits.toLocaleString("en-IN")}</td>
                  <td data-label="Clicks">{row.combined.clicks.toLocaleString("en-IN")}</td>
                  <td data-label="CTR">{row.combined.conversionRate}</td>
                  <td data-label="Best funnel">{row.bestFunnel}</td>
                  <td data-label="Last activity">
                    {formatAdminV2CoachActivity(row.combined.lastActivity)}
                  </td>
                  <td data-label="Source">{row.source}</td>
                  <td data-label="Actions">
                    <div className="v2-coach-row-actions">
                      <button
                        aria-label={`Open dedicated analytics for ${row.coachName}`}
                        className="btn btn-sm"
                        onClick={() => onOpenCoachAnalytics(row)}
                        type="button"
                      >
                        <AdminV2ActionGlyph name="chart" />
                        <span>Analytics</span>
                      </button>
                      <button
                        aria-label={`Open coach operations for ${row.coachName}`}
                        className="btn btn-sm"
                        onClick={() => onOpenCoachOps(row)}
                        type="button"
                      >
                        <AdminV2ActionGlyph name="users" />
                        <span>Ops</span>
                      </button>
                      {publicHref ? (
                        <a
                          aria-label={`Open public funnel for ${row.coachName}`}
                          className="btn btn-sm"
                          href={publicHref}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <AdminV2ActionGlyph name="site" />
                          <span>Open</span>
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={11}>
                <strong>No coach analytics records match the current filters.</strong>
                <small>Reset filters or wait for live production records to load.</small>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdminV2CoachDedicatedAnalyticsDialog({
  analyticsRangeLabel,
  coach,
  intelligence,
  onAdminActivity,
  onClose,
  onOpenCoachOps,
  recentEvents,
  selectedEntityIds
}: {
  analyticsRangeLabel: string;
  coach: CoachAnalyticsRow;
  intelligence: AdminV2CoachIntelligenceRow | null;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onClose: () => void;
  onOpenCoachOps: () => void;
  recentEvents: AnalyticsRecentEvent[];
  selectedEntityIds: string[];
}) {
  const availableTabs = useMemo(() => getAdminV2CoachDedicatedTabs(coach), [coach]);
  const [activeTab, setActiveTab] = useState<CoachAnalyticsFunnelType>("combined");
  const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || "combined";
  const tabMetrics = getAdminV2CoachDedicatedMetrics(coach, currentTab, intelligence);
  const coachEvents = getAdminV2CoachRecentEvents(coach, recentEvents);
  const publicHref = getAdminV2CoachPublicHref(coach);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="v2-coach-analytics-dialog-layer" role="presentation">
      <button
        aria-label="Close dedicated coach analytics"
        className="v2-coach-analytics-dialog-scrim"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="v2-dedicated-coach-analytics-title"
        aria-modal="true"
        className="v2-coach-analytics-dialog"
        role="dialog"
      >
        <header className="v2-dedicated-header">
          <div className="v2-dedicated-identity">
            <span className="avatar" aria-hidden="true">
              {getCoachV2Initials(coach.coachName)}
            </span>
            <div>
              <span className="badge">Dedicated coach analytics</span>
              <h2 id="v2-dedicated-coach-analytics-title">{coach.coachName} Analytics</h2>
              <p>
                {coach.niche} / {coach.coachSlug}
              </p>
            </div>
          </div>
          <div className="v2-dedicated-header-actions">
            <AdminV2CoachFunnelBadges row={coach} />
            <span className={`badge ${getAdminV2CoachAnalyticsStatusClass(coach.status)}`}>
              {formatAdminV2Label(coach.status)}
            </span>
            <AdminAIAskButton
              className="btn btn-sm"
              label="Generate AI Insights"
              query={`Investigate ${coach.coachName} for ${analyticsRangeLabel}. Use only current production counters, identify funnel risks, and recommend the safest next action.`}
              selectedEntityIds={selectedEntityIds}
              scope="selection"
            />
            <button className="btn btn-sm" onClick={onOpenCoachOps} type="button">
              <AdminV2ActionGlyph name="users" />
              <span>Open Coaches</span>
            </button>
            {publicHref ? (
              <a className="btn btn-sm" href={publicHref} rel="noopener noreferrer" target="_blank">
                <AdminV2ActionGlyph name="site" />
                <span>Open public</span>
              </a>
            ) : null}
            <button
              aria-label="Close coach analytics"
              className="btn btn-sm"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>

        <div className="v2-dedicated-summary-strip">
          <AdminV2CoachDedicatedSummaryItem label="Range" value={analyticsRangeLabel} />
          <AdminV2CoachDedicatedSummaryItem label="Best funnel" value={coach.bestFunnel} />
          <AdminV2CoachDedicatedSummaryItem
            label="Last activity"
            value={formatAdminV2CoachActivity(coach.combined.lastActivity)}
          />
          <AdminV2CoachDedicatedSummaryItem
            label="Device"
            value={formatAdminV2DeviceBreakdown(coach.deviceBreakdown)}
          />
        </div>

        <div className="v2-dedicated-tabs" role="tablist" aria-label="Coach analytics funnel views">
          {availableTabs.map((tab) => (
            <button
              aria-selected={currentTab === tab}
              className={currentTab === tab ? "is-active" : ""}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {getAdminV2CoachDedicatedTabLabel(tab)}
            </button>
          ))}
        </div>

        <AdminV2CoachDedicatedVisualGrid
          activeTab={currentTab}
          coach={coach}
          intelligence={intelligence}
        />

        <div className="v2-dedicated-body">
          <section
            className="v2-dedicated-main-panel"
            aria-label={`${getAdminV2CoachDedicatedTabLabel(currentTab)} analytics`}
          >
            <div className="v2-dedicated-kpi-grid">
              {tabMetrics.kpis.map((item) => (
                <article className="v2-dedicated-kpi-card" key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                  <span>{item.note}</span>
                  <AdminV2CoachDedicatedSparkline values={item.sparkValues} />
                </article>
              ))}
            </div>

            <div className="v2-dedicated-panel-grid">
              <article className="v2-dedicated-chart-panel">
                <div className="section-head">
                  <div>
                    <span className="badge">{tabMetrics.chartBadge}</span>
                    <h3>{tabMetrics.chartTitle}</h3>
                    <p>{tabMetrics.chartDescription}</p>
                  </div>
                </div>
                <AdminV2CoachDedicatedBars items={tabMetrics.steps} />
              </article>

              <article className="v2-dedicated-chart-panel">
                <div className="section-head">
                  <div>
                    <span className="badge">Diagnosis</span>
                    <h3>Coach-level action list</h3>
                    <p>Production counters translated into exact next checks.</p>
                  </div>
                </div>
                <div className="v2-dedicated-insights">
                  {tabMetrics.insights.map((insight) => (
                    <p key={insight}>{insight}</p>
                  ))}
                </div>
              </article>
            </div>

            <div className="v2-dedicated-meta-grid">
              {tabMetrics.meta.map((item) => (
                <span key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </span>
              ))}
            </div>
          </section>

          <aside className="v2-dedicated-side-panel" aria-label="Coach analytics context">
            <article>
              <span className="badge">Live-safe events</span>
              <h3>Recent activity</h3>
              <div className="v2-dedicated-event-list">
                {coachEvents.length ? (
                  coachEvents.map((event) => (
                    <span key={`${event.createdAt}-${event.eventName}-${event.source}`}>
                      <strong>{formatAdminV2Label(event.eventName)}</strong>
                      <small>
                        {formatSignalTime(event.createdAt)} / {event.source || "direct"}
                      </small>
                    </span>
                  ))
                ) : (
                  <span>
                    <strong>No recent safe events</strong>
                    <small>Current production counters still render above.</small>
                  </span>
                )}
              </div>
            </article>

            <article>
              <span className="badge">AI handoff</span>
              <h3>{intelligence?.risk.label || "Local diagnosis"}</h3>
              <p>
                {intelligence?.risk.reason ||
                  coach.lowActivityReasons[0] ||
                  "No urgent issue detected from current counters."}
              </p>
              <p>
                {intelligence?.risk.action ||
                  "Review funnel routing, CTA placement, and the latest public link before operations changes."}
              </p>
            </article>
          </aside>
        </div>

        <AdminV2CoachReportDock
          analyticsRangeLabel={analyticsRangeLabel}
          coach={coach}
          intelligence={intelligence}
          onAdminActivity={onAdminActivity}
        />
      </section>
    </div>
  );
}

function AdminV2CoachDedicatedSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function AdminV2CoachDedicatedVisualGrid({
  activeTab,
  coach,
  intelligence
}: {
  activeTab: CoachAnalyticsFunnelType;
  coach: CoachAnalyticsRow;
  intelligence: AdminV2CoachIntelligenceRow | null;
}) {
  const chartPoints = buildAdminV2CoachDedicatedChartPoints(coach, activeTab);
  const chartPath = buildAdminV2OdLinePath(chartPoints, "value");
  const secondaryPath = buildAdminV2OdLinePath(chartPoints, "previous");
  const areaPath = `${chartPath} L 730 270 L 42 270 Z`;
  const gauges = getAdminV2CoachDedicatedGauges(coach, activeTab, intelligence);
  const chartCopy = getAdminV2CoachDedicatedChartCopy(coach, activeTab);

  return (
    <div className="v2-dedicated-visual-grid">
      <section className="console-chart main-activity-chart v2-dedicated-overview-chart">
        <div className="console-chart-head">
          <div>
            <h3>{chartCopy.title}</h3>
            <p>{chartCopy.description}</p>
          </div>
          <div className="console-tabs chart-filter-group" aria-label="Dedicated coach graph mode">
            <span className="console-pill is-active">
              {getAdminV2CoachDedicatedTabLabel(activeTab)}
            </span>
            <span className="console-pill">Production counters</span>
          </div>
        </div>
        <div className="chart-viewport">
          <svg
            aria-label={`${coach.coachName} ${getAdminV2CoachDedicatedTabLabel(activeTab)} analytics graph`}
            className="activity-chart-svg"
            role="img"
            viewBox="0 0 760 320"
          >
            <defs>
              <linearGradient id={`coach-dedicated-fill-${activeTab}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--console-line)" stopOpacity=".46" />
                <stop offset="58%" stopColor="var(--console-line)" stopOpacity=".12" />
                <stop offset="100%" stopColor="var(--console-line)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[60, 112, 164, 216, 268].map((y) => (
              <line className="chart-grid-line" key={y} x1="42" x2="730" y1={y} y2={y} />
            ))}
            <path className="area" d={areaPath} fill={`url(#coach-dedicated-fill-${activeTab})`} />
            <path className="line-prev" d={secondaryPath} />
            <path className="line-main" d={chartPath} />
            {chartPoints.map((point) => (
              <circle
                cx={point.x}
                cy={point.y}
                fill="var(--console-bg)"
                key={`${point.label}-${point.x}`}
                r="5"
                stroke="var(--console-line)"
                strokeWidth="4"
              />
            ))}
          </svg>
        </div>
        <div className="chart-legend" aria-label="Dedicated coach graph legend">
          <span>
            <i className="chart-key" aria-hidden="true" />
            {chartCopy.primaryLegend}
          </span>
          <span>
            <i className="chart-key is-prev" aria-hidden="true" />
            {chartCopy.secondaryLegend}
          </span>
        </div>
        <p className="chart-summary">{chartCopy.summary}</p>
        <div className="console-chart-foot" aria-label="Dedicated coach graph footer">
          {chartCopy.footer.map((item) => (
            <div className="chart-foot-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <aside className="v2-dedicated-gauge-stack" aria-label="Coach analytics gauges">
        {gauges.map((gauge) => (
          <AdminV2CoachDedicatedGaugeCard key={gauge.title} {...gauge} />
        ))}
      </aside>
    </div>
  );
}

function AdminV2CoachDedicatedGaugeCard({
  label,
  note,
  title,
  value
}: {
  label: string;
  note: string;
  title: string;
  value: number;
}) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const scoreLabel = getAdminV2ScoreLabel(safeValue);

  return (
    <section className="radial-card score-card v2-dedicated-gauge-card" aria-label={title}>
      <div className="radial-card-head">
        <div>
          <small>{label}</small>
          <h3>{title}</h3>
        </div>
        <span className="console-pill">{scoreLabel}</span>
      </div>
      <div className="score-card-body">
        <div
          aria-label={`${title} score ${safeValue} percent`}
          className="score-ring"
          role="img"
          style={{ "--value": safeValue } as CSSProperties}
        >
          <strong>
            {safeValue}
            <span>%</span>
          </strong>
        </div>
        <div className="score-copy">
          <strong>{scoreLabel}</strong>
          <span>{note}</span>
          <div className="score-progress" aria-hidden="true">
            <i style={{ width: `${safeValue}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminV2CoachFunnelBadges({ row }: { row: CoachAnalyticsRow }) {
  const labels = getAdminV2CoachFunnelLabels(row);

  return (
    <div className="v2-funnel-badges">
      {labels.map((label) => (
        <span
          className={`badge ${label === "No funnel" ? "badge-warning" : "badge-accent"}`}
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function AdminV2CoachReportDock({
  analyticsRangeLabel,
  coach,
  intelligence,
  onAdminActivity
}: {
  analyticsRangeLabel: string;
  coach: CoachAnalyticsRow;
  intelligence: AdminV2CoachIntelligenceRow | null;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
}) {
  const [format, setFormat] = useState<AdminV2CoachReportFormat>("whatsapp");
  const [message, setMessage] = useState("");
  const [workingAction, setWorkingAction] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const reportText = buildAdminV2CoachReport(coach, format, analyticsRangeLabel, intelligence);

  async function runReportAction({
    action,
    label,
    run,
    success
  }: {
    action: string;
    label: string;
    run: () => Promise<void> | void;
    success: string;
  }) {
    if (workingAction) return;
    setWorkingAction(action);
    setMessage(`${label} in progress...`);
    onAdminActivity({
      detail: `${label} started for ${coach.coachName}.`,
      label,
      status: "working"
    });

    try {
      await run();
      setMessage(success);
      onAdminActivity({
        detail: success,
        label,
        status: "success"
      });
    } catch {
      const failure = `${label} failed safely; report remains visible.`;
      setMessage(failure);
      onAdminActivity({
        detail: failure,
        label,
        status: "error"
      });
    } finally {
      setWorkingAction("");
    }
  }

  return (
    <section className="v2-coach-report-dock" aria-label="Coach report dock">
      <div className="section-head">
        <div>
          <span className="badge">Report format</span>
          <h3>Coach report generator</h3>
          <p>
            Safe coach report output. Private links, OTPs, secrets, and raw visitor data stay
            excluded.
          </p>
        </div>
        <label>
          Format
          <select
            onChange={(event) => setFormat(event.currentTarget.value as AdminV2CoachReportFormat)}
            value={format}
          >
            <option value="whatsapp">Short WhatsApp summary</option>
            <option value="detailed">Detailed coach report</option>
            <option value="admin">Admin internal report</option>
          </select>
        </label>
      </div>

      <div className="v2-report-actions">
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "generate",
              label: "Generate Coach Report",
              run: () => setGeneratedAt(new Date().toLocaleString("en-IN")),
              success: "Coach report generated from current production counters."
            })
          }
          type="button"
        >
          Generate report
        </button>
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "copy",
              label: "Copy Coach Report",
              run: () => navigator.clipboard.writeText(reportText),
              success: "Coach report copied."
            })
          }
          type="button"
        >
          Copy
        </button>
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "download",
              label: "Download Coach Report",
              run: () =>
                downloadAdminV2File(
                  `${coach.coachSlug || "coach"}-analytics-report.txt`,
                  reportText,
                  "text/plain;charset=utf-8"
                ),
              success: "Text report downloaded."
            })
          }
          type="button"
        >
          Download
        </button>
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "csv",
              label: "Download Coach CSV",
              run: () =>
                downloadAdminV2File(
                  `${coach.coachSlug || "coach"}-analytics-report.csv`,
                  buildAdminV2CoachCsvReport(coach, analyticsRangeLabel, intelligence),
                  "text/csv;charset=utf-8"
                ),
              success: "CSV report downloaded."
            })
          }
          type="button"
        >
          CSV
        </button>
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "xls",
              label: "Download Coach XLS",
              run: () =>
                downloadAdminV2File(
                  `${coach.coachSlug || "coach"}-analytics-report.xls`,
                  buildAdminV2CoachExcelReport(coach, analyticsRangeLabel, intelligence),
                  "application/vnd.ms-excel;charset=utf-8"
                ),
              success: "XLS report downloaded."
            })
          }
          type="button"
        >
          XLS
        </button>
        <button
          className="btn btn-sm"
          disabled={Boolean(workingAction)}
          onClick={() =>
            void runReportAction({
              action: "share",
              label: "Share Coach Summary",
              run: async () => {
                const shareText = buildAdminV2CoachReport(
                  coach,
                  "whatsapp",
                  analyticsRangeLabel,
                  intelligence
                );
                if (typeof navigator.share === "function") {
                  try {
                    await navigator.share({
                      text: shareText,
                      title: `${coach.coachName} coach report`
                    });
                    return;
                  } catch {
                    // Use the safe clipboard fallback when native sharing is cancelled or unavailable.
                  }
                }
                await navigator.clipboard.writeText(shareText);
              },
              success: "Coach summary shared or copied for review."
            })
          }
          type="button"
        >
          Share
        </button>
      </div>

      <article className="v2-report-preview" data-generated={generatedAt ? "true" : "false"}>
        <div>
          <strong>{generatedAt ? `Ready ${generatedAt}` : "Safe to copy after review"}</strong>
          {message ? <span role="status">{message}</span> : null}
        </div>
        <pre>{reportText}</pre>
      </article>
    </section>
  );
}

function AdminV2PaidMasterclassPage({
  csrfToken,
  links,
  onAIContextChange,
  onAdminActivity,
  source,
  theme
}: {
  csrfToken: string;
  links: AdminPaidMasterclassLink[];
  onAIContextChange: (context: AdminAITableContext) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  source: string;
  theme: "dark" | "light";
}) {
  return (
    <AdminV2ModuleShell
      eyebrow="Payments"
      title="Link Settings"
      description="Server-managed paid entry, success, and private WhatsApp destinations."
      aside={<span className="badge badge-accent">{formatAdminV2SourceLabel(source)}</span>}
    >
      <AdminV2PaidMasterclassPanel
        csrfToken={csrfToken}
        links={links}
        onAIContextChange={onAIContextChange}
        onAdminActivity={onAdminActivity}
        source={source}
        theme={theme}
      />
    </AdminV2ModuleShell>
  );
}

function AdminV2ShopPage({
  csrfToken,
  onAIContextChange,
  onAdminActivity,
  snapshot
}: {
  csrfToken: string;
  onAIContextChange: (context: AdminAITableContext) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  snapshot: AdminV2DashboardData | null;
}) {
  const initialShop = getAdminV2ShopSnapshot(snapshot?.sources.shop.data);
  const [shop, setShop] = useState<AdminV2ShopSnapshot | null>(initialShop);
  const [loading, setLoading] = useState(!initialShop);
  const [saving, setSaving] = useState(false);
  const [recoveringOrderId, setRecoveringOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [paymentPageUrl, setPaymentPageUrl] = useState(
    initialShop?.paymentSettings.paymentPageUrl || ""
  );
  const [providerLabel, setProviderLabel] = useState(
    initialShop?.paymentSettings.providerLabel || "Razorpay"
  );
  const [packageLabel, setPackageLabel] = useState(
    initialShop?.paymentSettings.packageLabel || "Coach Website Builder"
  );
  const [paymentActive, setPaymentActive] = useState(initialShop?.paymentSettings.active ?? true);
  const [shopFormAIEnabled, setShopFormAIEnabled] = useState(false);
  const status = snapshot?.sources.shop.status || "loading";
  const paymentSettings = shop?.paymentSettings;
  const reportLinks = [
    ["Purchases", "purchases"],
    ["Published sites", "published"],
    ["Failures", "failures"],
    ["Input audit", "input-audit"],
    ["Duplicate drafts", "duplicate-drafts"],
    ["Payment settings audit", "settings"],
    ["Analytics summary", "analytics"]
  ] as const;
  const shopFormAIReview = useMemo(
    () =>
      reviewAdminAIForm({
        assistanceEnabled: shopFormAIEnabled,
        fields: [
          {
            currentConfiguration: paymentSettings?.paymentPageUrl,
            explanation: "HTTPS checkout destination opened by the public Shop payment action.",
            id: "paymentPageUrl",
            label: "Payment page URL",
            required: true,
            riskyChange: Boolean(
              paymentSettings && paymentSettings.paymentPageUrl !== paymentPageUrl
            ),
            type: "url",
            value: paymentPageUrl
          },
          {
            currentConfiguration: paymentSettings?.providerLabel,
            explanation: "Provider name shown to administrators reviewing the payment handoff.",
            id: "providerLabel",
            label: "Provider label",
            required: true,
            type: "text",
            value: providerLabel
          },
          {
            currentConfiguration: paymentSettings?.packageLabel,
            explanation: "Package name associated with the protected Shop checkout.",
            id: "packageLabel",
            label: "Package label",
            required: true,
            type: "copy",
            value: packageLabel
          },
          {
            currentConfiguration: paymentSettings
              ? paymentSettings.active
                ? "active"
                : "paused"
              : undefined,
            explanation: "Controls whether the Shop payment handoff is active or paused.",
            id: "paymentActive",
            label: "Payment active",
            required: true,
            riskyChange: Boolean(paymentSettings && paymentSettings.active !== paymentActive),
            type: "setting",
            value: paymentActive ? "active" : "paused"
          }
        ],
        formId: "shop-payment-settings"
      }),
    [packageLabel, paymentActive, paymentPageUrl, paymentSettings, providerLabel, shopFormAIEnabled]
  );
  const tableAiContext = useMemo<AdminAITableContext>(() => {
    const sites = shop?.sites || [];
    const failures = shop?.failures || [];
    return {
      filters: { source: status },
      rows: sites.map((site) => {
        const relatedFailures = failures.filter((failure) => failure.orderId === site.orderId);
        const recordedFailure = relatedFailures[0];
        return {
          duplicateKey: normalizeCoachSlug(site.slug || site.coachName),
          generationFailure:
            site.siteStatus === "publish_failed" || site.workflowStage.includes("publish_failed")
              ? recordedFailure?.message || site.workflowStage || site.siteStatus
              : undefined,
          groupKey: site.niche || site.source,
          id: site.orderId,
          label: site.coachName || site.orderId,
          linkValid: site.publicUrl ? isAdminV2SingleHttpsUrl(site.publicUrl) : undefined,
          requiredDataComplete: Boolean(site.orderId && site.coachName && site.paymentStatus),
          status: site.siteStatus || site.paymentStatus,
          unresolvedErrors: relatedFailures.filter(
            (failure) => !/^(?:fixed|resolved|recovered)$/i.test(failure.recoveryStatus)
          ).length
        };
      }),
      selectedIds: [],
      sort: { direction: "desc", field: "createdAt" },
      tableId: "shop-orders"
    };
  }, [shop, status]);

  useEffect(() => {
    onAIContextChange(tableAiContext);
  }, [onAIContextChange, tableAiContext]);

  useEffect(() => {
    let active = true;

    async function loadShop() {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/shop", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as AdminV2ShopApiPayload;
        if (!active) return;

        if (!response.ok || !payload.shop) {
          setMessage(payload.error || "Shop data could not be loaded.");
          return;
        }

        setAdminV2ShopState(payload.shop);
        setMessage("");
      } catch {
        if (active) setMessage("Shop data could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadShop();

    return () => {
      active = false;
    };
  }, []);

  function setAdminV2ShopState(nextShop: AdminV2ShopSnapshot) {
    setShop(nextShop);
    setPaymentPageUrl(nextShop.paymentSettings.paymentPageUrl);
    setProviderLabel(nextShop.paymentSettings.providerLabel);
    setPackageLabel(nextShop.paymentSettings.packageLabel);
    setPaymentActive(nextShop.paymentSettings.active);
  }

  async function savePaymentSettings() {
    if (!csrfToken) {
      setMessage("Admin verification token missing. Refresh the admin panel and try again.");
      return;
    }

    setSaving(true);
    setMessage("Saving Shop payment settings...");
    onAdminActivity({
      detail: "Shop payment settings update started.",
      label: "Shop",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/shop", {
        body: JSON.stringify({
          action: "update_payment_settings",
          active: paymentActive,
          packageLabel,
          paymentPageUrl,
          providerLabel
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminV2ShopApiPayload;

      if (!response.ok || !payload.ok || !payload.shop) {
        setMessage(payload.error || "Shop payment settings could not be saved.");
        onAdminActivity({
          detail: payload.error || "Shop payment settings update failed.",
          label: "Shop",
          status: "error"
        });
        return;
      }

      setAdminV2ShopState(payload.shop);
      setMessage("Shop payment settings saved.");
      onAdminActivity({
        detail: "Shop payment settings saved.",
        label: "Shop",
        status: "success"
      });
    } catch {
      setMessage("Shop payment settings could not be saved.");
      onAdminActivity({
        detail: "Shop payment settings update failed safely.",
        label: "Shop",
        status: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  async function retryPublish(orderId: string) {
    if (!csrfToken || recoveringOrderId) return;

    setRecoveringOrderId(orderId);
    setMessage(`Retrying publish for ${orderId}...`);
    onAdminActivity({
      detail: `${orderId} publish retry started.`,
      label: "Shop",
      status: "working"
    });

    try {
      const response = await fetch("/api/admin/shop", {
        body: JSON.stringify({
          action: "retry_publish",
          orderId
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminV2ShopApiPayload;

      if (!response.ok || !payload.ok || !payload.shop) {
        setMessage(payload.error || "Shop publish retry could not complete.");
        onAdminActivity({
          detail: payload.error || `${orderId} publish retry failed.`,
          label: "Shop",
          status: "error"
        });
        return;
      }

      setAdminV2ShopState(payload.shop);
      setMessage(`${orderId} publish retry completed.`);
      onAdminActivity({
        detail: `${orderId} publish retry completed.`,
        label: "Shop",
        status: "success"
      });
    } catch {
      setMessage("Shop publish retry failed safely.");
      onAdminActivity({
        detail: `${orderId} publish retry failed safely.`,
        label: "Shop",
        status: "error"
      });
    } finally {
      setRecoveringOrderId("");
    }
  }

  return (
    <AdminV2ModuleShell
      eyebrow="Shop"
      title="Shop Website Builder"
      description="Production shop purchases, payment settings, publish recovery, and exports."
      aside={
        <span className={`badge ${status === "ready" ? "badge-accent" : "badge-warning"}`}>
          {formatAdminV2SourceLabel(status)}
        </span>
      }
    >
      <div className="kpi-row">
        <AdminV2MetricTile
          label="Purchases"
          value={(shop?.reports.purchaseCount || 0).toLocaleString("en-IN")}
          note={loading ? "Loading orders" : "All Shop Website Builder orders"}
        />
        <AdminV2MetricTile
          label="Published sites"
          value={(shop?.reports.siteCount || 0).toLocaleString("en-IN")}
          note="Published from paid Shop orders"
        />
        <AdminV2MetricTile
          label="Failures"
          value={(shop?.reports.failureCount || 0).toLocaleString("en-IN")}
          note={shop?.reports.failureCount ? "Needs recovery review" : "No open failures"}
        />
        <AdminV2MetricTile
          label="Payment source"
          value={paymentSettings?.active ? "Active" : "Paused"}
          note={paymentSettings?.storageSource || "Loading payment settings"}
        />
      </div>

      {message ? (
        <p className={styles.v2InlineStatus} role="status">
          {message}
        </p>
      ) : null}

      <section className="console-card">
        <div className="section-head">
          <div>
            <span className="badge">Payment settings</span>
            <h3>Shop payment page</h3>
            <p>Updates are saved through the protected production Shop admin API.</p>
          </div>
          <div className="row-actions">
            <AdminAIAskButton
              className="btn btn-sm"
              label="Review Shop settings with AI"
              query="Review the current Shop settings for completeness, URL format, conflicting values, and risky changes without editing them."
              scope="page"
            />
            <a className="btn btn-sm" href={PUBLIC_SHOP_SITE_PATH} rel="noreferrer" target="_blank">
              Open Shop
            </a>
          </div>
        </div>
        <div className="filters">
          <label>
            Payment page URL
            <input
              aria-label="Payment page URL"
              onChange={(event) => setPaymentPageUrl(event.currentTarget.value)}
              placeholder="https://rzp.io/rzp/..."
              type="url"
              value={paymentPageUrl}
            />
          </label>
          <label>
            Provider label
            <input
              aria-label="Provider label"
              onChange={(event) => setProviderLabel(event.currentTarget.value)}
              placeholder="Razorpay"
              value={providerLabel}
            />
          </label>
          <label>
            Package label
            <input
              aria-label="Package label"
              onChange={(event) => setPackageLabel(event.currentTarget.value)}
              placeholder="Coach Website Builder"
              value={packageLabel}
            />
          </label>
          <label>
            Payment active
            <select
              aria-label="Payment active"
              onChange={(event) => setPaymentActive(event.currentTarget.value === "active")}
              value={paymentActive ? "active" : "paused"}
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <button
            className="btn btn-primary"
            data-loading={saving ? "true" : undefined}
            disabled={saving}
            onClick={() => void savePaymentSettings()}
            type="button"
          >
            {saving ? "Saving..." : "Save Shop Settings"}
          </button>
        </div>
        <AdminV2FormAIReview
          enabled={shopFormAIEnabled}
          onEnabledChange={setShopFormAIEnabled}
          review={shopFormAIReview}
          title="Shop payment settings"
        />
        <div className="grid grid-4">
          {[
            ["Current URL", paymentSettings?.paymentPageUrl || "Not configured"],
            ["Last updated", formatAdminV2ShopDate(paymentSettings?.lastUpdatedAt || null)],
            ["Updated by", paymentSettings?.lastUpdatedBy || "System"],
            ["Storage", paymentSettings?.storageSource || "loading"]
          ].map(([label, value]) => (
            <article className="finance-card" key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="console-card">
        <div className="section-head">
          <div>
            <span className="badge">Reports</span>
            <h3>Shop backups and exports</h3>
            <p>Report downloads stay behind the same authenticated Shop API.</p>
          </div>
        </div>
        <div className="row-actions">
          {reportLinks.map(([label, report]) => (
            <a className="btn btn-sm" href={`/api/admin/shop?report=${report}`} key={report}>
              Download {label}
            </a>
          ))}
        </div>
      </section>

      <section className="console-card">
        <div className="section-head">
          <div>
            <span className="badge">Purchases</span>
            <h3>Shop Website Builder orders</h3>
            <p>Published-site status and publish recovery use live Shop records.</p>
          </div>
          <AdminAIAskButton
            className="btn btn-sm"
            label="Analyze Shop orders"
            query="Summarize the visible Shop orders, identify publish failures, and explain records needing attention."
            scope="page"
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Coach</th>
                <th>Status</th>
                <th>Public site</th>
                <th>Created</th>
                <th>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {shop?.sites.length ? (
                shop.sites.map((site) => (
                  <tr key={site.orderId}>
                    <td data-label="Order">
                      <code>{site.orderId}</code>
                    </td>
                    <td data-label="Coach">
                      <strong>{site.coachName || "Unnamed coach"}</strong>
                      <small>{site.coachEmail || site.niche || "No email"}</small>
                    </td>
                    <td data-label="Status">
                      <span
                        className={`badge ${site.siteStatus === "published" ? "badge-accent" : "badge-warning"}`}
                      >
                        {formatAdminV2Label(site.paymentStatus)}
                      </span>
                      <small>{formatAdminV2Label(site.siteStatus)}</small>
                    </td>
                    <td data-label="Public site">
                      {site.siteStatus === "published" && site.publicUrl ? (
                        <a href={site.publicUrl} rel="noreferrer" target="_blank">
                          Open site
                        </a>
                      ) : (
                        "Not published"
                      )}
                    </td>
                    <td data-label="Created">{formatAdminV2ShopDate(site.createdAt)}</td>
                    <td data-label="Recovery">
                      {site.siteStatus === "publish_failed" ||
                      site.workflowStage === "publish_failed" ? (
                        <button
                          className="btn btn-sm"
                          data-loading={recoveringOrderId === site.orderId ? "true" : undefined}
                          disabled={Boolean(recoveringOrderId)}
                          onClick={() => void retryPublish(site.orderId)}
                          type="button"
                        >
                          {recoveringOrderId === site.orderId ? "Retrying..." : "Retry Publish"}
                        </button>
                      ) : (
                        "No action"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    {loading ? "Loading Shop orders..." : "No Shop orders recorded yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-2" aria-label="Shop recovery and audit status">
        <article className="console-card">
          <div className="section-head">
            <div>
              <span className={`badge ${shop?.failures.length ? "badge-warning" : "badge-accent"}`}>
                Recovery
              </span>
              <h3>{shop?.failures.length ? "Failures need review" : "No open failures"}</h3>
              <p>
                {shop?.failures[0]?.message ||
                  "Shop creation, payment handoff, and publish snapshots are ready."}
              </p>
            </div>
          </div>
        </article>
        <article className="console-card">
          <div className="section-head">
            <div>
              <span className="badge">Audit</span>
              <h3>{(shop?.audits.length || 0).toLocaleString("en-IN")} payment setting changes</h3>
              <p>
                {shop?.audits[0]
                  ? `${shop.audits[0].adminEmail} updated settings ${formatAdminV2ShopDate(shop.audits[0].createdAt)}.`
                  : "No payment setting changes recorded yet."}
              </p>
            </div>
          </div>
        </article>
      </section>
    </AdminV2ModuleShell>
  );
}

function getAdminV2ShopSnapshot(value: unknown): AdminV2ShopSnapshot | null {
  const payload = toAdminV2Record(value);
  const shop = payload.shop;
  if (!shop || typeof shop !== "object") return null;

  return shop as AdminV2ShopSnapshot;
}

function formatAdminV2ShopDate(value: string | null) {
  if (!value) return "Not available";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  return new Date(timestamp).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getAdminV2ErrorReportGenerationFailure(report: AdminErrorReport) {
  return [report.errorCode, report.safeMessage, report.category]
    .filter((value): value is string => Boolean(value))
    .filter((value) => /(?:generat|publish[_ -]?fail|copy[_ -]?fail|ai[_ -]?fail)/i.test(value))
    .join(": ");
}

function AdminV2ReportsPage({
  canClear,
  canMark,
  canViewTechnical,
  csrfToken,
  errorReports,
  focusMaintenance = false,
  maintenanceStatus,
  onAIContextChange,
  onTableAIContextChange,
  onAdminActivity,
  onReportsChange,
  onSelect,
  source,
  theme
}: {
  canClear: boolean;
  canMark: boolean;
  canViewTechnical: boolean;
  csrfToken: string;
  errorReports: AdminErrorReport[];
  focusMaintenance?: boolean;
  maintenanceStatus: string;
  onAIContextChange: (context: {
    filter: AdminV2ErrorReportFilter;
    selectedReferenceId: string;
  }) => void;
  onTableAIContextChange?: (context: AdminAITableContext) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onReportsChange: (reports: AdminErrorReport[]) => void;
  onSelect: (view: AdminV2ViewId) => void;
  source: string;
  theme: "dark" | "light";
}) {
  const [cleanupFilter, setCleanupFilter] = useState<ErrorReportCleanupFilter>("fixed_ignored");
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [reportFilter, setReportFilter] = useState<AdminV2ErrorReportFilter>("active");
  const [selectedReport, setSelectedReport] = useState<AdminErrorReport | null>(null);
  const openReports = errorReports.filter(
    (report) => report.status !== "Fixed" && report.status !== "Ignored"
  );
  const reportCounts: Record<AdminV2ErrorReportFilter, number> = {
    active: openReports.length,
    all: errorReports.length,
    fixed: errorReports.filter((report) => report.status === "Fixed").length,
    ignored: errorReports.filter((report) => report.status === "Ignored").length,
    new: errorReports.filter((report) => report.status === "New").length,
    reviewing: errorReports.filter((report) => report.status === "Reviewing").length
  };
  const visibleReports = useMemo(
    () =>
      errorReports.filter((report) => {
        if (reportFilter === "all") return true;
        if (reportFilter === "active") {
          return report.status === "New" || report.status === "Reviewing";
        }
        return report.status.toLowerCase() === reportFilter;
      }),
    [errorReports, reportFilter]
  );
  const reportAiContext = useMemo(
    () => ({
      filter: reportFilter,
      selectedReferenceId: selectedReport?.referenceId || ""
    }),
    [reportFilter, selectedReport?.referenceId]
  );
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: { reportFilter },
      rows: visibleReports.slice(0, 40).map((report) => ({
        duplicateKey: report.errorCode || report.safeMessage,
        generationFailure: getAdminV2ErrorReportGenerationFailure(report),
        groupKey: report.category,
        id: report.referenceId,
        label: report.errorCode || report.referenceId,
        permissionIssue: canViewTechnical
          ? undefined
          : "Current role cannot access technical error details.",
        requiredDataComplete: Boolean(
          report.referenceId && report.category && report.status && report.safeMessage
        ),
        status: report.status,
        unresolvedErrors: report.status === "Fixed" || report.status === "Ignored" ? 0 : 1
      })),
      selectedIds:
        selectedReport && visibleReports.some((report) => report === selectedReport)
          ? [selectedReport.referenceId]
          : [],
      sort: { direction: "desc", field: "createdAt" },
      tableId: "error-reports"
    }),
    [canViewTechnical, reportFilter, selectedReport, visibleReports]
  );

  useEffect(() => {
    onAIContextChange(reportAiContext);
  }, [onAIContextChange, reportAiContext]);

  useEffect(() => {
    onTableAIContextChange?.(tableAiContext);
  }, [onTableAIContextChange, tableAiContext]);

  async function copyReportValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
      onAdminActivity({
        detail: `${label} copied from protected Error Reports.`,
        label: "Error Reports",
        status: "success"
      });
    } catch {
      setCopyMessage(`${label} copy was blocked by the browser.`);
      onAdminActivity({
        detail: `${label} copy was blocked by the browser.`,
        label: "Error Reports",
        status: "error"
      });
    }
  }

  async function updateReportStatus(report: AdminErrorReport, status: AdminErrorReport["status"]) {
    if (!canMark) return;
    setBusyId(report.referenceId);
    try {
      const response = await fetch("/api/admin/error-reports", {
        body: JSON.stringify({
          adminNotes: `Marked ${status} from Error Reports.`,
          referenceId: report.referenceId,
          status
        }),
        headers: {
          "Content-Type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "PATCH"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        errorReport?: AdminErrorReport;
        errorReports?: AdminErrorReport[];
      };

      if (!response.ok) throw new Error("Report update failed");
      if (payload.errorReports) onReportsChange(payload.errorReports);
      else if (payload.errorReport) {
        onReportsChange(
          errorReports.map((current) =>
            current.referenceId === payload.errorReport?.referenceId ? payload.errorReport : current
          )
        );
      } else {
        onReportsChange(
          errorReports.map((current) =>
            current.referenceId === report.referenceId
              ? { ...current, status, updatedAt: new Date().toISOString() }
              : current
          )
        );
      }
      setSelectedReport((current) =>
        current?.referenceId === report.referenceId ? { ...current, status } : current
      );
      onAdminActivity({
        detail: `${report.referenceId} moved to ${status}.`,
        label: "Report updated",
        status: "success"
      });
    } catch {
      onAdminActivity({
        detail: `${report.referenceId} could not be updated.`,
        label: "Report update failed",
        status: "error"
      });
    } finally {
      setBusyId("");
    }
  }

  async function clearOldReports() {
    if (!canClear) return;
    setCleanupConfirmOpen(false);
    setBusyId("cleanup");
    try {
      const response = await fetch("/api/admin/error-reports", {
        body: JSON.stringify({
          action: "clear_old",
          cleanupFilter
        }),
        headers: {
          "Content-Type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        errorReports?: AdminErrorReport[];
      };
      if (!response.ok) throw new Error("Cleanup failed");
      if (payload.errorReports) onReportsChange(payload.errorReports);
      onAdminActivity({
        detail: `Cleanup requested for ${cleanupFilter.replace(/_/g, " ")} reports.`,
        label: "Reports cleanup",
        status: "success"
      });
    } catch {
      onAdminActivity({
        detail: "Reports cleanup did not complete.",
        label: "Cleanup failed",
        status: "error"
      });
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminV2ModuleShell
      eyebrow={focusMaintenance ? "Maintenance" : "Reports"}
      title={focusMaintenance ? "Backup & Cleanup" : "Error Reports"}
      description="Production reports, maintenance status, and cleanup actions in one controlled surface."
      aside={<span className="badge badge-accent">{formatAdminV2SourceLabel(source)}</span>}
    >
      {focusMaintenance ? (
        <AdminV2MaintenancePanel
          csrfToken={csrfToken}
          onAdminActivity={onAdminActivity}
          onOpenReports={() => onSelect("error-reports")}
          theme={theme}
        />
      ) : (
        <>
          <div className="kpi-row">
            <AdminV2MetricTile
              label="Open reports"
              value={openReports.length.toLocaleString()}
              note="Needs review or action"
            />
            <AdminV2MetricTile
              label="Total reports"
              value={errorReports.length.toLocaleString()}
              note="Current safe report list"
            />
            <AdminV2MetricTile
              label="Maintenance"
              value={formatAdminV2SourceLabel(maintenanceStatus)}
              note="Backup cleanup source"
            />
          </div>
          <section className="console-card">
            <div className="section-head">
              <div>
                <span className="badge">Maintenance</span>
                <h3>Report cleanup</h3>
                <p>
                  Cleanup stays in Reports so the risky action is not duplicated across modules.
                </p>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => onSelect(focusMaintenance ? "error-reports" : "backup-cleanup")}
                type="button"
              >
                {focusMaintenance ? "Open reports" : "Open maintenance"}
              </button>
            </div>
            <div className="filters">
              <label>
                Cleanup target
                <select
                  aria-label="Cleanup target"
                  disabled={!canClear}
                  value={cleanupFilter}
                  onChange={(event) =>
                    setCleanupFilter(event.currentTarget.value as ErrorReportCleanupFilter)
                  }
                >
                  {ERROR_REPORT_CLEANUP_FILTERS.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-primary"
                disabled={!canClear || busyId === "cleanup"}
                onClick={() => setCleanupConfirmOpen(true)}
                type="button"
              >
                {!canClear
                  ? "Cleanup permission required"
                  : busyId === "cleanup"
                    ? "Cleaning..."
                    : "Review cleanup"}
              </button>
            </div>
          </section>
          <AdminV2ActionDialog
            onClose={() => setCleanupConfirmOpen(false)}
            open={cleanupConfirmOpen}
            theme={theme}
            title="Confirm report cleanup"
            tone="danger"
          >
            <p className={styles.v2DialogCopy}>
              This will request cleanup for {cleanupFilter.replace(/_/g, " ")} reports through the
              protected production reports API. Review the selected target before continuing.
            </p>
            <div className="row-actions">
              <button
                className="btn btn-sm"
                onClick={() => setCleanupConfirmOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={styles.v2PrimaryAction}
                disabled={!canClear || busyId === "cleanup"}
                onClick={() => {
                  void clearOldReports();
                }}
                type="button"
              >
                Confirm cleanup
              </button>
            </div>
          </AdminV2ActionDialog>
          <section className="console-card">
            <div className="section-head">
              <div>
                <span className="badge">Safe reports</span>
                <h3>User-facing report list</h3>
                <p>Reference IDs and safe messages only; private technical details remain gated.</p>
              </div>
              <AdminAIAskButton
                className="btn btn-sm"
                label="AI Error Review"
                query={`Summarize the ${reportFilter} error reports, group repeated safe error codes, and recommend the next permission-safe action.`}
                scope="page"
              />
            </div>
            <div className={styles.v2ReportFilterBar}>
              <div aria-label="Error report filters" className="tabs" role="tablist">
                {ADMIN_V2_ERROR_REPORT_FILTERS.map((filter) => (
                  <button
                    aria-selected={reportFilter === filter.id}
                    className={reportFilter === filter.id ? "is-active" : ""}
                    key={filter.id}
                    onClick={() => setReportFilter(filter.id)}
                    role="tab"
                    type="button"
                  >
                    {filter.label} <strong>{reportCounts[filter.id]}</strong>
                  </button>
                ))}
              </div>
              <span>
                {visibleReports.length.toLocaleString("en-IN")} shown /{" "}
                {errorReports.length.toLocaleString("en-IN")} total
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Page</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReports.slice(0, 40).map((report) => (
                    <tr key={report.referenceId}>
                      <td data-label="Reference">
                        <code>{report.referenceId}</code>
                      </td>
                      <td data-label="Category">{report.category}</td>
                      <td data-label="Status">
                        <span className={`badge ${getAdminV2ReportStatusClass(report.status)}`}>
                          {report.status}
                        </span>
                      </td>
                      <td data-label="Severity">{report.severity}</td>
                      <td data-label="Page">{report.pagePath}</td>
                      <td data-label="Created">{formatSignalTime(report.createdAt)}</td>
                      <td data-label="Action">
                        <div className="row-actions">
                          <button
                            aria-label={`Copy ${report.errorCode || report.referenceId}`}
                            className="btn btn-sm"
                            onClick={() =>
                              void copyReportValue(
                                "Error code",
                                report.errorCode || report.referenceId
                              )
                            }
                            type="button"
                          >
                            Copy
                          </button>
                          <button
                            aria-label={`View details for ${report.errorCode || report.referenceId}`}
                            className="btn btn-sm"
                            onClick={() => {
                              setCopyMessage("");
                              setSelectedReport(report);
                            }}
                            type="button"
                          >
                            Details
                          </button>
                          {canMark ? (
                            <button
                              aria-label={`Mark ${report.errorCode || report.referenceId} ${
                                report.status === "Fixed" ? "reviewing" : "fixed"
                              }`}
                              className="btn btn-sm"
                              disabled={busyId === report.referenceId}
                              onClick={() =>
                                updateReportStatus(
                                  report,
                                  report.status === "Fixed" ? "Reviewing" : "Fixed"
                                )
                              }
                              type="button"
                            >
                              {report.status === "Fixed" ? "Reopen" : "Fix"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visibleReports.length ? (
                    <tr>
                      <td colSpan={7}>
                        <strong>No {reportFilter} error reports.</strong>
                        <small>
                          Choose another filter or wait for a safe report to be recorded.
                        </small>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {copyMessage ? (
              <p className={styles.v2ReportStatus} role="status">
                {copyMessage}
              </p>
            ) : null}
          </section>
          <AdminV2ActionDialog
            onClose={() => setSelectedReport(null)}
            open={Boolean(selectedReport)}
            size="wide"
            theme={theme}
            title="Error Details"
          >
            {selectedReport ? (
              <div className={styles.v2ReportDetail}>
                <div className={styles.v2ReportDetailGrid}>
                  <AdminV2ReportDetailItem
                    action={
                      selectedReport.errorCode
                        ? {
                            label: "Copy",
                            onClick: () =>
                              void copyReportValue("Error code", selectedReport.errorCode || "")
                          }
                        : undefined
                    }
                    label="Error code"
                    value={selectedReport.errorCode || "Not recorded"}
                  />
                  <AdminV2ReportDetailItem
                    action={{
                      label: "Copy",
                      onClick: () => void copyReportValue("Reference", selectedReport.referenceId)
                    }}
                    label="Reference"
                    value={selectedReport.referenceId}
                  />
                  <AdminV2ReportDetailItem label="Status" value={selectedReport.status} />
                  <AdminV2ReportDetailItem label="Created" value={selectedReport.createdAt} />
                  <AdminV2ReportDetailItem label="Page" value={selectedReport.pagePath} />
                  <AdminV2ReportDetailItem label="User action" value={selectedReport.userAction} />
                  <AdminV2ReportDetailItem
                    label="Device"
                    value={
                      canViewTechnical
                        ? `${selectedReport.deviceType}, ${selectedReport.screenSize}`
                        : `${selectedReport.deviceType} / technical context restricted`
                    }
                  />
                  <AdminV2ReportDetailItem
                    label="Browser"
                    value={canViewTechnical ? selectedReport.browser : "Restricted by permission"}
                  />
                  <AdminV2ReportDetailItem
                    label="Coach slug"
                    value={selectedReport.coachSlug || "Not coach-specific"}
                  />
                  <AdminV2ReportDetailItem
                    label="Support shown"
                    value={selectedReport.supportSource || "default"}
                  />
                  <AdminV2ReportDetailItem
                    label="Missing support fields"
                    value={selectedReport.missingSupportFields || "None recorded"}
                  />
                  <AdminV2ReportDetailItem
                    label="Safe message"
                    value={selectedReport.safeMessage}
                  />
                  <AdminV2ReportDetailItem
                    label="Admin-only masked details"
                    value={
                      canViewTechnical
                        ? selectedReport.technicalDetails || "No technical detail recorded."
                        : "Restricted: error_reports.technical_details permission is required."
                    }
                    wide
                  />
                  <AdminV2ReportDetailItem
                    action={{
                      label: "Copy prompt",
                      onClick: () =>
                        void copyReportValue(
                          "Codex fix prompt",
                          createErrorReportBugPrompt(selectedReport)
                        )
                    }}
                    label="Codex Fix Prompt"
                    value={createErrorReportBugPrompt(selectedReport)}
                    wide
                  />
                </div>
                <div className="row-actions">
                  <AdminAIAskButton
                    className="btn btn-sm"
                    label="Investigate with AI"
                    query="Investigate the selected error report and prepare an exact developer-ready bug summary."
                    selectedEntityIds={[selectedReport.referenceId]}
                    scope="selection"
                  />
                </div>
                {copyMessage ? (
                  <p className={styles.v2ReportStatus} role="status">
                    {copyMessage}
                  </p>
                ) : null}
                {canMark ? (
                  <div className="row-actions">
                    <button
                      className="btn btn-sm"
                      disabled={busyId === selectedReport.referenceId}
                      onClick={() => void updateReportStatus(selectedReport, "Reviewing")}
                      type="button"
                    >
                      Mark Reviewing
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={busyId === selectedReport.referenceId}
                      onClick={() => void updateReportStatus(selectedReport, "Fixed")}
                      type="button"
                    >
                      Mark Fixed
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={busyId === selectedReport.referenceId}
                      onClick={() => void updateReportStatus(selectedReport, "Ignored")}
                      type="button"
                    >
                      Ignore
                    </button>
                  </div>
                ) : (
                  <p className={styles.v2ReportStatus}>
                    Status controls require error_reports.mark_status.
                  </p>
                )}
              </div>
            ) : null}
          </AdminV2ActionDialog>
        </>
      )}
    </AdminV2ModuleShell>
  );
}

function AdminV2ReportDetailItem({
  action,
  label,
  value,
  wide = false
}: {
  action?: { label: string; onClick: () => void };
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <section className={styles.v2ReportDetailItem} data-wide={wide ? "true" : "false"}>
      <small>{label}</small>
      <div>
        <span>{value}</span>
        {action ? (
          <button className="btn btn-sm" onClick={action.onClick} type="button">
            {action.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AdminV2SettingsPage({
  adminAccess,
  csrfToken,
  focusAdminUsers = false,
  onAction,
  onAIContextChange,
  onAdminActivity,
  onOpenAdminUsers,
  onTableAIContextChange,
  snapshot,
  theme
}: {
  adminAccess: AdminV2ShellProps["adminAccess"];
  csrfToken: string;
  focusAdminUsers?: boolean;
  onAction: (title: string, body: string, tone?: "danger" | "standard") => void;
  onAIContextChange: (context: AdminAISettingsSnapshot) => void;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onOpenAdminUsers: () => void;
  onTableAIContextChange?: (context: AdminAITableContext) => void;
  snapshot: AdminV2DashboardData | null;
  theme: "dark" | "light";
}) {
  const [supportDefaults, setSupportDefaults] = useState<AdminSupportDefaultsForm>({
    supportEmail: "",
    supportMessage: "",
    supportName: "",
    supportPhone: "",
    supportWhatsapp: ""
  });
  const [supportStatus, setSupportStatus] = useState<"idle" | "loading" | "saving">("loading");
  const [savedSupportDefaults, setSavedSupportDefaults] = useState<AdminSupportDefaultsForm | null>(
    null
  );
  const [supportFormAIEnabled, setSupportFormAIEnabled] = useState(false);
  const securityItems = ADMIN_V2_SECURITY_STATUS_ITEMS;
  const userSource = snapshot?.sources.users.status || "loading";
  const supportFormAIReview = useMemo(
    () =>
      reviewAdminAIForm({
        assistanceEnabled: supportFormAIEnabled,
        fields: [
          {
            currentConfiguration: savedSupportDefaults?.supportName,
            explanation:
              "Default support identity shown when a coach-specific name is unavailable.",
            id: "supportName",
            label: "Support name",
            required: true,
            type: "text",
            value: supportDefaults.supportName
          },
          {
            currentConfiguration: savedSupportDefaults?.supportEmail,
            explanation: "Default support inbox used for coach and customer assistance.",
            id: "supportEmail",
            label: "Support email",
            required: true,
            riskyChange: Boolean(
              savedSupportDefaults &&
              savedSupportDefaults.supportEmail !== supportDefaults.supportEmail
            ),
            type: "email",
            value: supportDefaults.supportEmail
          },
          {
            currentConfiguration: savedSupportDefaults?.supportPhone,
            explanation: "Optional support telephone number presented as a fallback contact.",
            id: "supportPhone",
            label: "Support phone",
            type: "tel",
            value: supportDefaults.supportPhone
          },
          {
            currentConfiguration: savedSupportDefaults?.supportWhatsapp,
            explanation: "Optional HTTPS WhatsApp destination for default support.",
            id: "supportWhatsapp",
            label: "Support WhatsApp",
            riskyChange: Boolean(
              savedSupportDefaults &&
              savedSupportDefaults.supportWhatsapp !== supportDefaults.supportWhatsapp
            ),
            type: "url",
            value: supportDefaults.supportWhatsapp
          },
          {
            currentConfiguration: savedSupportDefaults?.supportMessage,
            explanation:
              "Default public support message used when a specific message is unavailable.",
            id: "supportMessage",
            label: "Support message",
            required: true,
            riskyChange: Boolean(
              savedSupportDefaults &&
              savedSupportDefaults.supportMessage !== supportDefaults.supportMessage
            ),
            type: "copy",
            value: supportDefaults.supportMessage
          }
        ],
        formId: "support-defaults"
      }),
    [savedSupportDefaults, supportDefaults, supportFormAIEnabled]
  );

  useEffect(() => {
    let active = true;

    async function loadSupportDefaults() {
      try {
        const response = await fetch("/api/admin/support-defaults", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          defaults?: Partial<AdminSupportDefaultsForm>;
        };
        if (!active) return;
        const defaults = payload.defaults;
        const nextDefaults: AdminSupportDefaultsForm = {
          supportEmail: typeof defaults?.supportEmail === "string" ? defaults.supportEmail : "",
          supportMessage:
            typeof defaults?.supportMessage === "string" ? defaults.supportMessage : "",
          supportName: typeof defaults?.supportName === "string" ? defaults.supportName : "",
          supportPhone: typeof defaults?.supportPhone === "string" ? defaults.supportPhone : "",
          supportWhatsapp:
            typeof defaults?.supportWhatsapp === "string" ? defaults.supportWhatsapp : ""
        };
        setSupportDefaults(nextDefaults);
        setSavedSupportDefaults(nextDefaults);
      } finally {
        if (active) setSupportStatus("idle");
      }
    }

    void loadSupportDefaults();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const fieldPresence = {
      supportEmail: supportDefaults.supportEmail.trim().length > 0,
      supportMessage: supportDefaults.supportMessage.trim().length > 0,
      supportName: supportDefaults.supportName.trim().length > 0,
      supportPhone: supportDefaults.supportPhone.trim().length > 0,
      supportWhatsapp: supportDefaults.supportWhatsapp.trim().length > 0
    };
    onAIContextChange({
      configuredFieldCount: Object.values(fieldPresence).filter(Boolean).length,
      fieldCount: Object.keys(fieldPresence).length,
      fieldPresence,
      status: supportStatus
    });
  }, [onAIContextChange, supportDefaults, supportStatus]);

  async function saveSupportDefaults() {
    setSupportStatus("saving");
    try {
      const response = await fetch("/api/admin/support-defaults", {
        body: JSON.stringify(supportDefaults),
        headers: {
          "Content-Type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "PATCH"
      });
      if (!response.ok) throw new Error("Support save failed");
      setSavedSupportDefaults(supportDefaults);
      onAdminActivity({
        detail: "Default support fields saved.",
        label: "Support defaults",
        status: "success"
      });
    } catch {
      onAdminActivity({
        detail: "Default support fields could not be saved.",
        label: "Support save failed",
        status: "error"
      });
    } finally {
      setSupportStatus("idle");
    }
  }

  return (
    <AdminV2ModuleShell
      eyebrow={focusAdminUsers ? "Admin users" : "Settings"}
      title={focusAdminUsers ? "Admin User Management" : "Settings"}
      description="Admin access, role status, support defaults, and protected settings in one clean module."
      aside={
        <span className={`badge ${adminAccess?.isOwner ? "badge-accent" : "badge-warning"}`}>
          {adminAccess?.isOwner ? "Root owner" : "Limited admin"}
        </span>
      }
    >
      {focusAdminUsers ? (
        <AdminV2AdminUsersPanel
          csrfToken={csrfToken}
          onAIContextChange={onTableAIContextChange!}
          onAdminActivity={onAdminActivity}
          theme={theme}
        />
      ) : (
        <>
          <div className="grid grid-3 v2-settings-security-grid">
            {securityItems.slice(0, 6).map((item) => (
              <article className="finance-card" key={item.label}>
                <small>{item.label}</small>
                <strong>{item.status}</strong>
              </article>
            ))}
          </div>
          <div className="grid grid-2">
            <section className="console-card">
              <div className="section-head">
                <div>
                  <span className="badge">Editable defaults</span>
                  <h3>Default support details</h3>
                  <p>Used when a coach does not provide a specific support destination.</p>
                </div>
                <div className="row-actions">
                  <AdminAIAskButton
                    className="btn btn-sm"
                    label="Review support defaults with AI"
                    query="Review the current support defaults for completeness, conflicting values, unsafe claims, URL or contact formatting, and risky changes without editing them."
                    scope="page"
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={supportStatus !== "idle"}
                    onClick={saveSupportDefaults}
                    type="button"
                  >
                    {supportStatus === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
              <div className="filters">
                {(
                  [
                    ["supportName", "Support name"],
                    ["supportEmail", "Support email"],
                    ["supportPhone", "Support phone"],
                    ["supportWhatsapp", "Support WhatsApp"]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      aria-label={label}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setSupportDefaults((current) => ({ ...current, [key]: value }));
                      }}
                      value={supportDefaults[key]}
                    />
                  </label>
                ))}
                <label>
                  Support message
                  <textarea
                    aria-label="Support message"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setSupportDefaults((current) => ({ ...current, supportMessage: value }));
                    }}
                    rows={4}
                    value={supportDefaults.supportMessage}
                  />
                </label>
              </div>
              <AdminV2FormAIReview
                enabled={supportFormAIEnabled}
                onEnabledChange={setSupportFormAIEnabled}
                review={supportFormAIReview}
                title="Support defaults"
              />
            </section>
            <section className="console-card">
              <div className="section-head">
                <div>
                  <span className="badge">Admin users</span>
                  <h3>Roles and access</h3>
                  <p>Admin users are managed in Settings with the same role-gated controls.</p>
                </div>
                <button className="btn btn-sm" onClick={onOpenAdminUsers} type="button">
                  Open users
                </button>
              </div>
              <div className="finance-ledger">
                <div className="finance-card">
                  <small>Current role</small>
                  <strong>
                    {adminAccess?.isOwner
                      ? "Owner"
                      : adminAccess?.role || adminAccess?.roleKey || "Admin"}
                  </strong>
                </div>
                <div className="finance-card">
                  <small>User source</small>
                  <strong>{formatAdminV2SourceLabel(userSource)}</strong>
                </div>
                <div className="finance-card">
                  <small>Permissions</small>
                  <strong>{(adminAccess?.permissions || []).length.toLocaleString()}</strong>
                </div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() =>
                  onAction(
                    "Admin users",
                    "Admin users are managed in Settings. Role checks and owner-only routes remain enforced."
                  )
                }
                type="button"
              >
                Review access model
              </button>
            </section>
          </div>
        </>
      )}
    </AdminV2ModuleShell>
  );
}

function AdminV2FormAIReview({
  enabled,
  onEnabledChange,
  review,
  title
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  review: AdminV2FormAIReviewResult;
  title: string;
}) {
  const findings = enabled
    ? [
        ...review.diagnostics,
        ...review.warnings,
        ...review.comparisons.map(
          (comparison) =>
            `${formatAdminV2Label(comparison.fieldId)} differs from the saved configuration.`
        ),
        ...review.suggestions.map(
          (suggestion) => `${formatAdminV2Label(suggestion.fieldId)}: ${suggestion.reason}`
        )
      ].slice(0, 8)
    : [];

  return (
    <aside className="finance-card" aria-label={`${title} structured AI review`}>
      <div className="section-head">
        <div>
          <span className={`badge ${enabled ? "badge-accent" : ""}`}>
            {enabled && review.advisoryOnly ? "Advisory only" : "AI assistance off"}
          </span>
          <strong>{title} review</strong>
          <p>
            {enabled
              ? "Reviews current in-browser fields only. Production validation still controls saving."
              : "Off by default. Enable it to review the current form without editing or saving values."}
          </p>
        </div>
        <button
          aria-pressed={enabled}
          className="btn btn-sm"
          onClick={() => onEnabledChange(!enabled)}
          type="button"
        >
          {enabled ? "Disable AI review" : "Enable AI review"}
        </button>
      </div>
      {enabled ? (
        <div aria-live="polite">
          {findings.length ? (
            <ul>
              {findings.map((finding, index) => (
                <li key={`${index}-${finding}`}>{finding}</li>
              ))}
            </ul>
          ) : (
            <p>No advisory issues found in the current fields.</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}

function AdminV2ModuleShell({
  aside,
  children,
  description,
  eyebrow,
  title
}: {
  aside?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="dashboard-console" aria-label={title}>
      <div className="console-chrome">
        <div className="section-head">
          <div>
            <span className="badge">{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {aside}
        </div>
      </div>
      <div className="dashboard-grid">{children}</div>
    </section>
  );
}

function AdminV2MetricTile({ label, note, value }: { label: string; note: string; value: string }) {
  return (
    <article className="console-mini">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span className="kpi-meta">{note}</span>
      </div>
      <svg className="mini-spark" aria-hidden="true" viewBox="0 0 100 40">
        <polyline points="4,32 22,28 39,29 58,21 76,18 96,12" />
      </svg>
    </article>
  );
}

function AdminV2MiniLineChart({ points }: { points: AdminV2OdChartPoint[] }) {
  const current = buildAdminV2OdLinePath(points, "value");
  const previous = buildAdminV2OdLinePath(points, "previous");

  return (
    <div className="chart-viewport">
      <svg
        className="activity-chart-svg"
        aria-hidden="true"
        viewBox="0 0 780 320"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="admin-v2-module-line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b7ff3c" stopOpacity=".34" />
            <stop offset="100%" stopColor="#b7ff3c" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path d={`${current} L730 286 L42 286 Z`} fill="url(#admin-v2-module-line-fill)" />
        <path d={previous} className="chart-line previous" />
        <path d={current} className="chart-line current" />
        {points.map((point) => (
          <circle
            className="chart-dot"
            cx={point.x}
            cy={point.y}
            key={`${point.label}-${point.x}`}
            r="4"
          />
        ))}
      </svg>
    </div>
  );
}

function getAdminV2CoachAnalyticsSearchSuggestions(rows: CoachAnalyticsRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const sourceRows = normalizedQuery
    ? rows.filter((row) =>
        [
          row.coachName,
          row.coachSlug,
          row.niche,
          row.location,
          row.region,
          row.bestFunnel,
          row.source,
          ...getAdminV2CoachFunnelLabels(row)
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery))
      )
    : rows;

  return sourceRows.slice(0, 8);
}

function getAdminV2CoachFunnelLabels(row: CoachAnalyticsRow) {
  if (row.combinedAvailable) return ["Paid", "Free", "Both"];
  if (row.hasPaidMasterclass) return ["Paid"];
  if (row.hasFreeGuestLink) return ["Free"];
  return ["No funnel"];
}

function getAdminV2CoachPublicHref(row: CoachAnalyticsRow) {
  return (
    row.publicLink || row.paidFunnels.find((funnel) => funnel.canonicalPath)?.canonicalPath || ""
  );
}

function getAdminV2CoachAnalyticsRegionLabel(row: CoachAnalyticsRow) {
  return row.region !== "Not available" ? row.region : row.location || "Not available";
}

function getAdminV2CoachAnalyticsStatusClass(status: CoachAnalyticsRow["status"]) {
  if (status === "published" || status === "active") return "badge-accent";
  if (status === "draft" || status === "paused") return "badge-warning";
  if (status === "archived" || status === "inactive" || status === "removed") return "badge-danger";
  return "";
}

function formatAdminV2CoachActivity(value: string) {
  if (!value || value === "No activity yet" || value === "Not connected") return "No activity yet";
  if (value === "Paid funnel configured") return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatAdminV2DeviceBreakdown(breakdown: CoachAnalyticsRow["deviceBreakdown"]) {
  const entries = [
    ["Mobile", breakdown.mobile],
    ["Desktop", breakdown.desktop],
    ["Tablet", breakdown.tablet]
  ] as const;
  const top = entries.slice().sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] === 0) return "No device split yet";
  return `${top[0]} ${top[1].toLocaleString("en-IN")}`;
}

function buildAdminV2CoachDedicatedChartPoints(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType
): AdminV2OdChartPoint[] {
  const sourcePoints = getAdminV2CoachDedicatedChartRows(coach, tab);
  const maxValue = Math.max(1, ...sourcePoints.flatMap((point) => [point.value, point.previous]));
  const xStep = sourcePoints.length > 1 ? 688 / (sourcePoints.length - 1) : 688;

  return sourcePoints.map((point, index) => {
    const x = 42 + index * xStep;
    const y = 270 - (point.value / maxValue) * 210;
    const previousY = 270 - (point.previous / maxValue) * 210;

    return {
      ...point,
      x,
      y,
      previousY
    };
  });
}

function getAdminV2CoachDedicatedChartRows(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType
) {
  if (tab === "paid") {
    const metrics = coach.paidMetrics;
    return [
      { label: "Landing", previous: metrics.registerClicks, value: metrics.visits },
      { label: "Register", previous: metrics.paymentButtonClicks, value: metrics.registerClicks },
      {
        label: "Pay click",
        previous: metrics.paymentInitiated,
        value: metrics.paymentButtonClicks
      },
      { label: "Initiated", previous: metrics.paymentSuccess, value: metrics.paymentInitiated },
      { label: "Success", previous: metrics.whatsappClicks, value: metrics.paymentSuccess },
      { label: "WhatsApp", previous: metrics.whatsappClicks, value: metrics.successPageViews }
    ];
  }

  if (tab === "free") {
    const metrics = coach.freeMetrics;
    return [
      { label: "Visits", previous: metrics.registerClicks, value: metrics.visits },
      { label: "Register", previous: metrics.googleFormClicks, value: metrics.registerClicks },
      { label: "Form", previous: metrics.whatsappClicks, value: metrics.googleFormClicks },
      { label: "WhatsApp", previous: metrics.whatsappClicks, value: metrics.whatsappClicks },
      { label: "Video", previous: metrics.videoPlays, value: metrics.videoPlays }
    ];
  }

  return [
    { label: "Free", previous: coach.freeMetrics.clicks, value: coach.freeMetrics.visits },
    { label: "Paid", previous: coach.paidMetrics.clicks, value: coach.paidMetrics.visits },
    { label: "Combined", previous: coach.combined.clicks, value: coach.combined.visits },
    {
      label: "Payment",
      previous: coach.paidMetrics.paymentSuccess,
      value: coach.paidMetrics.paymentInitiated
    },
    {
      label: "Contact",
      previous: coach.paidMetrics.whatsappClicks + coach.freeMetrics.whatsappClicks,
      value: coach.paidMetrics.successPageViews + coach.freeMetrics.googleFormClicks
    }
  ];
}

function getAdminV2CoachDedicatedChartCopy(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType
) {
  if (tab === "paid") {
    const metrics = coach.paidMetrics;
    return {
      description: "Same Overview graph grammar, scoped to this coach's paid funnel stages.",
      footer: [
        { label: "Landing", value: metrics.visits.toLocaleString("en-IN") },
        { label: "Payment success", value: metrics.paymentSuccess.toLocaleString("en-IN") },
        { label: "Drop-off", value: metrics.paymentToSuccessDropOff },
        { label: "WhatsApp", value: metrics.whatsappClicks.toLocaleString("en-IN") }
      ],
      primaryLegend: "Stage volume",
      secondaryLegend: "Next-stage completion",
      summary: `Paid funnel: ${metrics.visits.toLocaleString("en-IN")} visits, ${metrics.paymentButtonClicks.toLocaleString("en-IN")} payment clicks, ${metrics.paymentSuccess.toLocaleString("en-IN")} successes.`,
      title: "Paid funnel graph"
    };
  }

  if (tab === "free") {
    const metrics = coach.freeMetrics;
    return {
      description: "Same Overview graph grammar, scoped to this coach's free guest-link funnel.",
      footer: [
        { label: "Visits", value: metrics.visits.toLocaleString("en-IN") },
        { label: "Register clicks", value: metrics.registerClicks.toLocaleString("en-IN") },
        { label: "Form opens", value: metrics.googleFormClicks.toLocaleString("en-IN") },
        { label: "Support", value: metrics.supportStatus }
      ],
      primaryLegend: "Stage volume",
      secondaryLegend: "Next-stage completion",
      summary: `Free funnel: ${metrics.visits.toLocaleString("en-IN")} visits, ${metrics.registerClicks.toLocaleString("en-IN")} register clicks, ${metrics.googleFormClicks.toLocaleString("en-IN")} form opens.`,
      title: "Free funnel graph"
    };
  }

  return {
    description: "Same Overview graph grammar, scoped to this coach's combined paid/free counters.",
    footer: [
      { label: "Visits", value: coach.combined.visits.toLocaleString("en-IN") },
      { label: "CTA clicks", value: coach.combined.clicks.toLocaleString("en-IN") },
      { label: "Best funnel", value: coach.bestFunnel },
      { label: "Source", value: coach.source }
    ],
    primaryLegend: "Traffic / stage volume",
    secondaryLegend: "Intent / completion",
    summary: `Combined: ${coach.combined.visits.toLocaleString("en-IN")} visits, ${coach.combined.clicks.toLocaleString("en-IN")} CTA clicks, ${coach.combined.conversionRate} click-through.`,
    title: "Coach performance graph"
  };
}

function getAdminV2CoachDedicatedGauges(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  const activeMetrics =
    tab === "paid" ? coach.paidMetrics : tab === "free" ? coach.freeMetrics : coach.combined;
  const activeClicks =
    tab === "paid"
      ? coach.paidMetrics.registerClicks + coach.paidMetrics.paymentButtonClicks
      : tab === "free"
        ? coach.freeMetrics.registerClicks + coach.freeMetrics.googleFormClicks
        : coach.combined.clicks;
  const conversion = parseAdminV2PercentValue(activeMetrics.conversionRate);
  const performanceScore = Math.max(
    1,
    Math.min(99, Math.round(activeMetrics.visits ? 55 + Math.min(35, activeClicks * 2) : 54))
  );
  const conversionScore = Math.max(
    1,
    Math.min(99, Math.round(activeMetrics.visits ? 45 + Math.min(45, conversion * 2.2) : 42))
  );
  const funnelReadiness = getAdminV2CoachFunnelReadinessScore(coach, tab);

  return [
    {
      label: "Performance score",
      note: `${activeMetrics.visits.toLocaleString("en-IN")} visits and ${activeClicks.toLocaleString("en-IN")} intent signals.`,
      title: "Coach Performance",
      value: performanceScore
    },
    {
      label: "Conversion health",
      note: `${activeMetrics.conversionRate} click-through from the selected funnel view.`,
      title: "Conversion Health",
      value: conversionScore
    },
    {
      label: tab === "paid" ? "Payment readiness" : "Funnel readiness",
      note:
        intelligence?.risk.reason ||
        coach.lowActivityReasons[0] ||
        "Funnel structure and routing are usable from current records.",
      title: tab === "paid" ? "Payment Health" : "Funnel Health",
      value: funnelReadiness
    }
  ];
}

function getAdminV2CoachFunnelReadinessScore(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType
) {
  if (tab === "paid") {
    if (!coach.hasPaidMasterclass) return 32;
    return coach.paidMetrics.paymentSuccess > 0
      ? 84
      : coach.paidMetrics.paymentButtonClicks > 0
        ? 72
        : 64;
  }

  if (tab === "free") {
    if (!coach.hasFreeGuestLink) return 32;
    let score = 72;
    if (coach.freeMetrics.googleFormStatus === "configured") score += 10;
    if (coach.freeMetrics.supportStatus === "coach-specific contact available") score += 8;
    if (coach.freeMetrics.registerClicks > 0) score += 7;
    return Math.min(96, score);
  }

  if (coach.combinedAvailable) return 86;
  if (coach.hasPaidMasterclass || coach.hasFreeGuestLink) return 72;
  return 38;
}

function AdminV2CoachDedicatedSparkline({ values }: { values: number[] }) {
  const safeValues = values.length ? values : [0, 0, 0];
  const maxValue = Math.max(1, ...safeValues);
  const points = safeValues
    .map((value, index) => {
      const x = safeValues.length === 1 ? 50 : 6 + (index / (safeValues.length - 1)) * 88;
      const y = 34 - (value / maxValue) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="v2-dedicated-sparkline"
      aria-hidden="true"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <polyline points={points} />
    </svg>
  );
}

function AdminV2CoachDedicatedBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="v2-dedicated-bars">
      {items.map((item) => (
        <div key={item.label}>
          <span>
            {item.label}
            <strong>{item.value.toLocaleString("en-IN")}</strong>
          </span>
          <i style={{ width: `${Math.max(5, (item.value / maxValue) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function getAdminV2CoachDedicatedTabs(coach: CoachAnalyticsRow): CoachAnalyticsFunnelType[] {
  if (coach.availableTabs.length) return coach.availableTabs;
  if (coach.hasPaidMasterclass && coach.hasFreeGuestLink) return ["combined", "paid", "free"];
  if (coach.hasPaidMasterclass) return ["paid"];
  if (coach.hasFreeGuestLink) return ["free"];
  return ["combined"];
}

function getAdminV2CoachDedicatedTabLabel(tab: CoachAnalyticsFunnelType) {
  if (tab === "paid") return "Paid";
  if (tab === "free") return "Free";
  return "Combined";
}

function getAdminV2CoachDedicatedMetrics(
  coach: CoachAnalyticsRow,
  tab: CoachAnalyticsFunnelType,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  if (tab === "paid") {
    const metrics = coach.paidMetrics;
    return {
      chartBadge: "Paid funnel",
      chartDescription:
        "Paid masterclass path from landing traffic to payment and WhatsApp intent.",
      chartTitle: "Paid conversion movement",
      insights: [
        metrics.visits > 0
          ? `Paid landing has ${metrics.visits.toLocaleString("en-IN")} visits in this range.`
          : "Paid landing has no recorded visits in this range.",
        metrics.paymentButtonClicks > metrics.paymentSuccess
          ? "Payment click to success drop-off needs review."
          : "No paid payment drop-off is visible from current counters.",
        metrics.successPageViews > metrics.whatsappClicks
          ? "Success page to WhatsApp handoff may need stronger CTA placement."
          : "Success to WhatsApp handoff has no visible pressure yet.",
        intelligence?.risk.action ||
          coach.lowActivityReasons[0] ||
          "Keep paid funnel tracking under review."
      ],
      kpis: [
        {
          label: "Landing visits",
          note: "Paid page traffic",
          sparkValues: [metrics.visits, metrics.registerClicks, metrics.paymentButtonClicks],
          value: metrics.visits.toLocaleString("en-IN")
        },
        {
          label: "Register clicks",
          note: "Paid registration CTA",
          sparkValues: [metrics.visits, metrics.registerClicks],
          value: metrics.registerClicks.toLocaleString("en-IN")
        },
        {
          label: "Payment success",
          note: "Completed paid intent",
          sparkValues: [metrics.paymentInitiated, metrics.paymentSuccess],
          value: metrics.paymentSuccess.toLocaleString("en-IN")
        },
        {
          label: "WhatsApp clicks",
          note: "Post-payment contact",
          sparkValues: [metrics.successPageViews, metrics.whatsappClicks],
          value: metrics.whatsappClicks.toLocaleString("en-IN")
        }
      ],
      meta: [
        { label: "Drop-off", value: metrics.paymentToSuccessDropOff },
        { label: "Success handoff", value: metrics.successToWhatsappDropOff },
        { label: "Last activity", value: formatAdminV2CoachActivity(metrics.lastActivity) },
        { label: "Source", value: coach.source }
      ],
      steps: [
        { label: "Landing page visit", value: metrics.visits },
        { label: "Register CTA click", value: metrics.registerClicks },
        { label: "Payment click", value: metrics.paymentButtonClicks },
        { label: "Payment initiated", value: metrics.paymentInitiated },
        { label: "Payment success", value: metrics.paymentSuccess },
        { label: "Success page viewed", value: metrics.successPageViews },
        { label: "WhatsApp clicked", value: metrics.whatsappClicks }
      ]
    };
  }

  if (tab === "free") {
    const metrics = coach.freeMetrics;
    return {
      chartBadge: "Free funnel",
      chartDescription:
        "Free Guest Link path from public visit to registration and support contact.",
      chartTitle: "Free guest-link movement",
      insights: [
        metrics.visits > 0
          ? `Free funnel has ${metrics.visits.toLocaleString("en-IN")} visits in this range.`
          : "Free funnel has no recorded visits in this range.",
        metrics.googleFormStatus === "missing"
          ? "Google Form destination is missing and should be fixed before sharing."
          : "Google Form destination is configured.",
        metrics.supportStatus === "fallback support used"
          ? "Fallback support is being used; check coach-specific contact destination."
          : "Coach-specific support destination is available.",
        intelligence?.risk.action ||
          coach.lowActivityReasons[0] ||
          "Keep free CTA tracking under review."
      ],
      kpis: [
        {
          label: "Page visits",
          note: "Coach public traffic",
          sparkValues: [metrics.visits, metrics.registerClicks, metrics.googleFormClicks],
          value: metrics.visits.toLocaleString("en-IN")
        },
        {
          label: "Register clicks",
          note: "Primary CTA intent",
          sparkValues: [metrics.visits, metrics.registerClicks],
          value: metrics.registerClicks.toLocaleString("en-IN")
        },
        {
          label: "Google Form opens",
          note: "Form handoff",
          sparkValues: [metrics.registerClicks, metrics.googleFormClicks],
          value: metrics.googleFormClicks.toLocaleString("en-IN")
        },
        {
          label: "Video plays",
          note: "Content engagement",
          sparkValues: [metrics.visits, metrics.videoPlays],
          value: metrics.videoPlays.toLocaleString("en-IN")
        }
      ],
      meta: [
        { label: "Google Form", value: metrics.googleFormStatus },
        { label: "Support", value: metrics.supportStatus },
        { label: "Last activity", value: formatAdminV2CoachActivity(metrics.lastActivity) },
        { label: "Device", value: formatAdminV2DeviceBreakdown(coach.deviceBreakdown) }
      ],
      steps: [
        { label: "Coach public page visit", value: metrics.visits },
        { label: "Register CTA click", value: metrics.registerClicks },
        { label: "Google Form opened", value: metrics.googleFormClicks },
        { label: "WhatsApp/contact click", value: metrics.whatsappClicks },
        { label: "Video play", value: metrics.videoPlays }
      ]
    };
  }

  return {
    chartBadge: "Combined funnel",
    chartDescription:
      "Paid and free counters shown together for a coach-wise production diagnosis.",
    chartTitle: "Combined performance movement",
    insights: [
      coach.combined.visits > 0
        ? `${coach.bestFunnel} is the strongest recorded funnel in this range.`
        : "No recorded visits yet for this selected range.",
      coach.freeMetrics.visits > coach.paidMetrics.visits
        ? "Free Guest Link is currently attracting more traffic than paid."
        : coach.paidMetrics.visits > coach.freeMetrics.visits
          ? "Paid funnel is currently attracting more traffic than free."
          : "Paid/free traffic split is even or not yet available.",
      coach.deviceBreakdown.mobile > coach.deviceBreakdown.desktop
        ? "Mobile appears to be the strongest recorded device signal."
        : "No dominant mobile signal is visible yet.",
      intelligence?.risk.action || coach.lowActivityReasons[0] || "No immediate action detected."
    ],
    kpis: [
      {
        label: "Total visits",
        note: "Paid + free",
        sparkValues: [coach.freeMetrics.visits, coach.paidMetrics.visits, coach.combined.visits],
        value: coach.combined.visits.toLocaleString("en-IN")
      },
      {
        label: "Total clicks",
        note: "Register/contact intent",
        sparkValues: [coach.freeMetrics.clicks, coach.paidMetrics.clicks, coach.combined.clicks],
        value: coach.combined.clicks.toLocaleString("en-IN")
      },
      {
        label: "Click-through",
        note: "Combined conversion",
        sparkValues: [coach.combined.visits, coach.combined.clicks],
        value: coach.combined.conversionRate
      },
      {
        label: "Best funnel",
        note: "Current leader",
        sparkValues: [coach.freeMetrics.visits, coach.paidMetrics.visits],
        value: coach.bestFunnel
      }
    ],
    meta: [
      { label: "Region", value: getAdminV2CoachAnalyticsRegionLabel(coach) },
      { label: "Device", value: formatAdminV2DeviceBreakdown(coach.deviceBreakdown) },
      { label: "Traffic source", value: coach.source },
      { label: "Trend", value: coach.trend }
    ],
    steps: [
      { label: "Paid visits", value: coach.paidMetrics.visits },
      { label: "Free visits", value: coach.freeMetrics.visits },
      { label: "Paid clicks", value: coach.paidMetrics.clicks },
      { label: "Free clicks", value: coach.freeMetrics.clicks },
      { label: "Payment success", value: coach.paidMetrics.paymentSuccess },
      { label: "Google Form opens", value: coach.freeMetrics.googleFormClicks }
    ]
  };
}

function getAdminV2CoachRecentEvents(
  coach: CoachAnalyticsRow,
  recentEvents: AnalyticsRecentEvent[]
) {
  const slugs = new Set(
    [coach.coachSlug, ...coach.freeGuestLinks.map((site) => site.slug)].filter(Boolean)
  );

  return recentEvents.filter((event) => event.coachSlug && slugs.has(event.coachSlug)).slice(0, 6);
}

function buildAdminV2CoachReport(
  coach: CoachAnalyticsRow,
  format: AdminV2CoachReportFormat,
  dateRangeLabel: string,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  const activeFunnels = getAdminV2CoachFunnelLabels(coach).join(", ");
  const nextAction =
    intelligence?.risk.action ||
    coach.lowActivityReasons[0] ||
    "Keep sharing the coach link and compare click-through weekly.";

  if (format === "whatsapp") {
    return [
      `${coach.coachName} performance summary`,
      `Date range: ${dateRangeLabel}`,
      `Visits: ${coach.combined.visits.toLocaleString("en-IN")}`,
      `Register/CTA clicks: ${coach.combined.clicks.toLocaleString("en-IN")}`,
      `Click-through: ${coach.combined.conversionRate}`,
      `Active funnel: ${activeFunnels}`,
      `Top region/device: ${getAdminV2CoachAnalyticsRegionLabel(coach)} / ${formatAdminV2DeviceBreakdown(coach.deviceBreakdown)}`,
      `Suggested next step: ${nextAction}`
    ].join("\n");
  }

  const report = [
    `Coach: ${coach.coachName}`,
    `Niche: ${coach.niche}`,
    `Slug: ${coach.coachSlug}`,
    `Date range: ${dateRangeLabel}`,
    `Active funnel types: ${activeFunnels}`,
    `Best funnel: ${coach.bestFunnel}`,
    `Total visits: ${coach.combined.visits.toLocaleString("en-IN")}`,
    `Register/CTA clicks: ${coach.combined.clicks.toLocaleString("en-IN")}`,
    `Conversion rate: ${coach.combined.conversionRate}`,
    `Free visits/clicks: ${coach.freeMetrics.visits.toLocaleString("en-IN")} / ${coach.freeMetrics.registerClicks.toLocaleString("en-IN")}`,
    `Paid visits/clicks: ${coach.paidMetrics.visits.toLocaleString("en-IN")} / ${coach.paidMetrics.registerClicks.toLocaleString("en-IN")}`,
    `Payment success events: ${coach.paidMetrics.paymentSuccess.toLocaleString("en-IN")}`,
    `Top traffic source: ${coach.source}`,
    `Top region/device: ${getAdminV2CoachAnalyticsRegionLabel(coach)} / ${formatAdminV2DeviceBreakdown(coach.deviceBreakdown)}`,
    `Trend summary: ${coach.trend}`,
    `Risk diagnosis: ${intelligence?.risk.reason || coach.lowActivityReasons.join("; ") || "No urgent issue detected."}`,
    `Recommended next action: ${nextAction}`
  ];

  if (format === "admin") {
    report.push(
      `Admin-only queue: ${coach.lowActivityReasons.join("; ") || "No admin warning in the selected range."}`,
      "Safety note: private links, payment identifiers, OTPs, secrets, raw user data, cookies, and internal tokens are excluded."
    );
  }

  return report.join("\n");
}

function buildAdminV2CoachCsvReport(
  coach: CoachAnalyticsRow,
  dateRangeLabel: string,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  const rows = buildAdminV2CoachReportRows(coach, dateRangeLabel, intelligence);

  return rows.map((row) => row.map(escapeAdminV2CsvCell).join(",")).join("\n");
}

function buildAdminV2CoachExcelReport(
  coach: CoachAnalyticsRow,
  dateRangeLabel: string,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  const rows = buildAdminV2CoachReportRows(coach, dateRangeLabel, intelligence);

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Worksheet ss:Name="Coach Analytics">',
    "<Table>",
    ...rows.map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeAdminV2XmlCell(cell)}</Data></Cell>`).join("")}</Row>`
    ),
    "</Table>",
    "</Worksheet>",
    "</Workbook>"
  ].join("");
}

function buildAdminV2CoachReportRows(
  coach: CoachAnalyticsRow,
  dateRangeLabel: string,
  intelligence: AdminV2CoachIntelligenceRow | null
) {
  return [
    ["Field", "Value"],
    ["Coach name", coach.coachName],
    ["Niche", coach.niche],
    ["Slug", coach.coachSlug],
    ["Date range", dateRangeLabel],
    ["Active funnels", getAdminV2CoachFunnelLabels(coach).join(", ")],
    ["Best funnel", coach.bestFunnel],
    ["Total visits", String(coach.combined.visits)],
    ["Register/CTA clicks", String(coach.combined.clicks)],
    ["Free visits", String(coach.freeMetrics.visits)],
    ["Free register clicks", String(coach.freeMetrics.registerClicks)],
    ["Paid visits", String(coach.paidMetrics.visits)],
    ["Paid register clicks", String(coach.paidMetrics.registerClicks)],
    ["Payment success events", String(coach.paidMetrics.paymentSuccess)],
    ["Conversion rate", coach.combined.conversionRate],
    ["Top traffic source", coach.source],
    ["Top region", getAdminV2CoachAnalyticsRegionLabel(coach)],
    ["Device signal", formatAdminV2DeviceBreakdown(coach.deviceBreakdown)],
    ["Trend summary", coach.trend],
    [
      "Risk diagnosis",
      intelligence?.risk.reason ||
        coach.lowActivityReasons.join("; ") ||
        "No urgent issue detected."
    ],
    [
      "Recommended next action",
      intelligence?.risk.action ||
        coach.lowActivityReasons[0] ||
        "Keep sharing the coach link and compare click-through weekly."
    ]
  ];
}

function escapeAdminV2CsvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeAdminV2XmlCell(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadAdminV2File(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildAdminV2CoachIntelligenceRows(
  rows: AdminV2CoachIntelligenceRow[],
  productionRows: CoachAnalyticsRow[]
) {
  const seen = new Set<string>();
  const mergedRows = rows.map((row) => {
    seen.add(row.id);
    seen.add(row.slug);
    return row;
  });

  productionRows.forEach((row) => {
    if (seen.has(row.coachId) || seen.has(row.coachSlug)) return;
    const status = normalizeAdminV2CoachAnalyticsStatus(row.status);
    const rowWithoutRisk = {
      clicks: row.combined.clicks,
      coachName: row.coachName,
      ctr: parseAdminV2PercentValue(row.combined.conversionRate),
      hasPaidFunnel: row.hasPaidMasterclass,
      id: row.coachId || row.coachSlug,
      lastActivity: row.combined.lastActivity,
      publicUrl: getAdminV2CoachPublicHref(row) || `/coach/${row.coachSlug}`,
      region: getAdminV2CoachAnalyticsRegionLabel(row),
      slug: row.coachSlug,
      source: row.source,
      status,
      visits: row.combined.visits
    };

    mergedRows.push({
      ...rowWithoutRisk,
      risk: getAdminV2CoachRiskSignal(rowWithoutRisk)
    });
    seen.add(row.coachId);
    seen.add(row.coachSlug);
  });

  return mergedRows.sort((a, b) => {
    if (b.visits !== a.visits) return b.visits - a.visits;
    return a.coachName.localeCompare(b.coachName);
  });
}

function normalizeAdminV2CoachAnalyticsStatus(
  status: CoachAnalyticsRow["status"]
): CoachSiteStatus {
  if (
    status === "archived" ||
    status === "draft" ||
    status === "paused" ||
    status === "published" ||
    status === "removed"
  ) {
    return status;
  }
  if (status === "active") return "published";
  return "paused";
}

function parseAdminV2PercentValue(value: string) {
  const parsed = parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAdminV2CoachRows(
  coachSites: CoachSiteRecord[],
  analyticsSummaries: AnalyticsMetricSummary[]
): AdminV2CoachIntelligenceRow[] {
  return coachSites.map((site) => {
    const analytics =
      analyticsSummaries.find(
        (summary) =>
          summary.coachSlug === site.slug ||
          summary.coachId === site.id ||
          summary.funnelId === site.id
      ) || null;
    const visits = analytics?.totalVisits ?? site.analytics?.totalVisits ?? 0;
    const clicks =
      analytics?.registerClicks ??
      site.analytics?.totalRegisterClicks ??
      site.analytics?.totalWhatsappClicks ??
      0;
    const ctr = visits
      ? (clicks / visits) * 100
      : parseFloat(site.analytics?.conversionRate || "0");
    const lastActivity =
      analytics?.lastActivity ||
      site.analytics?.lastUpdated ||
      site.updatedAt ||
      site.publishedAt ||
      site.createdAt ||
      "";
    const hasPaidFunnel = Boolean(site.existingPaidFunnelUrl);
    const rowWithoutRisk = {
      clicks,
      coachName: site.coachName,
      ctr,
      hasPaidFunnel,
      id: site.id || site.slug,
      lastActivity,
      publicUrl: site.publicUrl || `/coach/${site.slug}`,
      region: analytics?.region || site.analytics?.region || site.location || "Unknown",
      slug: site.slug,
      source: analytics?.source || site.analytics?.source || "YWcoach",
      status: site.status,
      visits
    };

    return {
      ...rowWithoutRisk,
      risk: getAdminV2CoachRiskSignal(rowWithoutRisk)
    };
  });
}

function getAdminV2CoachRiskSignal(
  row: Omit<AdminV2CoachIntelligenceRow, "risk">
): AdminV2CoachRiskSignal {
  const lastActivityAge = getAdminV2DaysSince(row.lastActivity);

  if (row.status === "published" && row.visits > 0 && row.clicks === 0) {
    return {
      action: "Review CTA placement and funnel destination",
      label: "Traffic without intent",
      priority: "critical",
      reason: `${row.visits.toLocaleString("en-IN")} visits but zero CTA clicks in the selected signal set.`,
      score: 96
    };
  }

  if (row.status === "published" && row.visits === 0) {
    return {
      action: "Check public link, source routing, and first traffic source",
      label: "Published but silent",
      priority: "high",
      reason: "The site is published but has no recorded visits in the current analytics range.",
      score: 88
    };
  }

  if (row.status === "published" && !row.hasPaidFunnel) {
    return {
      action: "Attach paid funnel or mark as free-only intentionally",
      label: "Paid funnel missing",
      priority: "medium",
      reason: "Published free site has no paid masterclass destination attached.",
      score: 72
    };
  }

  if (row.status === "draft") {
    return {
      action: "Review draft completeness and publish when ready",
      label: "Draft waiting",
      priority: "medium",
      reason: "Draft exists in production records and can be promoted from Coaches.",
      score: 64
    };
  }

  if (lastActivityAge !== null && lastActivityAge >= 14 && row.status !== "archived") {
    return {
      action: "Refresh coach content or verify tracking",
      label: "Stale activity",
      priority: "medium",
      reason: `Last activity is ${lastActivityAge} days old.`,
      score: 58
    };
  }

  if (row.ctr >= 8 && row.visits >= 10) {
    return {
      action: "Study this coach as a conversion reference",
      label: "High performer",
      priority: "good",
      reason: `${formatAdminV2Percent(row.ctr)} CTA rate with meaningful traffic.`,
      score: 18
    };
  }

  return {
    action: "Monitor in the next analytics window",
    label: "Stable",
    priority: "good",
    reason: "No urgent risk detected from the current production counters.",
    score: 24
  };
}

function buildAdminV2LocalAiInsight({
  metrics,
  recentEvents,
  rows,
  scope,
  selectedCoach
}: {
  metrics: ReturnType<typeof getAdminV2OdMetrics>;
  recentEvents: AnalyticsRecentEvent[];
  rows: AdminV2CoachIntelligenceRow[];
  scope: "coach" | "overview";
  selectedCoach: AdminV2CoachIntelligenceRow | null;
}): AdminV2AiInsight {
  const highRiskRows = rows
    .filter((row) => row.risk.priority !== "good")
    .sort((a, b) => b.risk.score - a.risk.score);
  const topCoach = rows.slice().sort((a, b) => b.visits - a.visits)[0] || null;
  const trafficWithoutIntent = rows.filter((row) => row.visits > 0 && row.clicks === 0).length;
  const publishedSilent = rows.filter(
    (row) => row.status === "published" && row.visits === 0
  ).length;
  const missingPaidFunnels = rows.filter(
    (row) => row.status === "published" && !row.hasPaidFunnel
  ).length;
  const focus = selectedCoach || topCoach;
  const focusName = focus?.coachName || "the coach portfolio";

  return {
    dataHash: "local-live-rules",
    generatedAt: new Date().toISOString(),
    keyTrends: [
      `${rows.length.toLocaleString("en-IN")} coach records are included in the current intelligence pass.`,
      `${metrics.totalVisits.toLocaleString("en-IN")} visits and ${metrics.totalRegisterClicks.toLocaleString("en-IN")} CTA clicks are visible in the selected range.`,
      topCoach
        ? `${topCoach.coachName} is the strongest traffic signal with ${topCoach.visits.toLocaleString("en-IN")} visits.`
        : "No coach has enough recorded traffic to form a leader signal yet.",
      recentEvents.length
        ? `${recentEvents.length} recent events are available for operational context.`
        : "No recent event stream is available right now."
    ],
    model: "local-smart-rules",
    predictions: [
      trafficWithoutIntent
        ? `${trafficWithoutIntent} coach${trafficWithoutIntent === 1 ? "" : "es"} may lose conversion until CTA/funnel routing is checked.`
        : "CTA risk should stay low if current tracking remains stable.",
      publishedSilent
        ? `${publishedSilent} published coach${publishedSilent === 1 ? "" : "es"} need first-traffic verification.`
        : "Published records are not showing a silent-site cluster in this pass.",
      missingPaidFunnels
        ? `${missingPaidFunnels} published free site${missingPaidFunnels === 1 ? "" : "s"} can become paid-funnel opportunities.`
        : "Paid-funnel coverage does not show an obvious missing-funnel cluster."
    ],
    recommendations: [
      focus
        ? `Open ${focusName} in Coaches and execute: ${focus.risk.action}.`
        : "Start with Coaches Workbench after live records load.",
      highRiskRows[0]
        ? `Prioritize ${highRiskRows[0].coachName}: ${highRiskRows[0].risk.reason}`
        : "Keep monitoring; no critical coach queue is visible.",
      "Use Analytics for diagnosis, then switch to Coaches for edits, publish, pause, archive, or preview.",
      scope === "coach"
        ? "Regenerate server AI after changing filters or selecting another coach."
        : "Generate portfolio AI only after the selected range is correct."
    ],
    summary: focus
      ? `${focusName} is classified as ${focus.risk.label}. ${focus.risk.reason}`
      : "Smart rules are waiting for live coach and analytics records.",
    warnings: [
      !rows.length ? "Coach records are not loaded yet." : "",
      !metrics.totalVisits
        ? "Traffic volume is currently low, so predictions should be treated cautiously."
        : "",
      "Local rules do not spend AI tokens and are not a replacement for server AI generation."
    ].filter(Boolean)
  };
}

function buildAdminV2AiAnalyticsPayload({
  highRiskRows,
  metrics,
  recentEvents,
  rows,
  selectedCoach,
  snapshot
}: {
  highRiskRows: AdminV2CoachIntelligenceRow[];
  metrics: ReturnType<typeof getAdminV2OdMetrics>;
  recentEvents: AnalyticsRecentEvent[];
  rows: AdminV2CoachIntelligenceRow[];
  selectedCoach: AdminV2CoachIntelligenceRow | null;
  snapshot: AdminV2DashboardData | null;
}) {
  return {
    coach: selectedCoach
      ? {
          clicks: selectedCoach.clicks,
          coachName: selectedCoach.coachName,
          ctr: selectedCoach.ctr,
          hasPaidFunnel: selectedCoach.hasPaidFunnel,
          lastActivity: selectedCoach.lastActivity,
          region: selectedCoach.region,
          risk: selectedCoach.risk,
          slug: selectedCoach.slug,
          source: selectedCoach.source,
          status: selectedCoach.status,
          visits: selectedCoach.visits
        }
      : null,
    portfolio: {
      coachCount: rows.length,
      highRiskCount: highRiskRows.length,
      paymentHealth: metrics.paymentHealth,
      performanceScore: metrics.performanceScore,
      totalRegisterClicks: metrics.totalRegisterClicks,
      totalVisits: metrics.totalVisits,
      visitDeltaLabel: metrics.visitDeltaLabel
    },
    recentEvents: recentEvents.slice(0, 8).map((event) => ({
      coachSlug: event.coachSlug,
      createdAt: event.createdAt,
      deviceType: event.deviceType,
      eventName: event.eventName,
      funnelType: event.funnelType,
      region: event.region,
      source: event.source
    })),
    riskQueue: highRiskRows.slice(0, 8).map((row) => ({
      action: row.risk.action,
      coachName: row.coachName,
      priority: row.risk.priority,
      reason: row.risk.reason,
      slug: row.slug,
      status: row.status
    })),
    sourceStatus: {
      analyticsEvents: snapshot?.sources.analyticsEvents.status,
      coachSites: snapshot?.sources.coachSites.status
    }
  };
}

function getAdminV2RiskBadgeClass(priority: AdminV2CoachRiskSignal["priority"]) {
  if (priority === "critical") return "badge-danger";
  if (priority === "high" || priority === "medium") return "badge-warning";
  return "badge-accent";
}

function getAdminV2DaysSince(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}

function formatAdminV2Percent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function formatAdminV2SourceLabel(value?: string) {
  if (!value) return "Unknown";
  return formatAdminV2Label(value);
}

function formatAdminV2Label(value: unknown) {
  const label = String(value ?? "").trim();
  if (!label) return "Unknown";

  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toAdminV2Record(value: unknown): AdminV2UnknownRecord {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as AdminV2UnknownRecord;
}

function getAdminV2ReportStatusClass(status: AdminErrorReport["status"]) {
  if (status === "Fixed") return "badge-accent";
  if (status === "Ignored") return "";
  if (status === "Reviewing") return "badge-warning";
  return "badge-danger";
}

function getCoachV2Initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "YW";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

function getCoachV2StatusLabel(status: "all" | CoachSiteStatus) {
  if (status === "all") return "All statuses";
  if (status === "published") return "Published";
  if (status === "paused") return "Paused";
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  if (status === "removed") return "Removed";
  return status;
}

function getCoachV2BadgeClass(status: CoachSiteStatus) {
  if (status === "published") return "badge-accent";
  if (status === "paused") return "badge-warning";
  if (status === "archived" || status === "removed") return "badge-danger";
  return "";
}

function getCoachV2StatusActionLabel(status: CoachSiteStatus) {
  if (status === "published") return "Publishing";
  if (status === "paused") return "Pausing";
  if (status === "archived") return "Archiving";
  if (status === "removed") return "Removing";
  return "Updating";
}

function formatCoachV2Date(value?: string) {
  if (!value) return "Not saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function openCoachPublicUrl(site: CoachSiteRecord) {
  if (typeof window === "undefined") return;
  const href = new URL(site.publicUrl || `/coach/${site.slug}`, window.location.origin).toString();
  window.open(href, "_blank", "noopener,noreferrer");
}

function getAdminV2OdMetrics(snapshot: AdminV2DashboardData | null) {
  const analyticsData = snapshot?.sources.analyticsEvents.data;
  const totalVisits = sumMetricSummaries(
    analyticsData?.analyticsSummaries,
    (summary) => summary.totalVisits
  );
  const previousVisits = sumMetricSummaries(
    analyticsData?.previousAnalyticsSummaries,
    (summary) => summary.totalVisits
  );
  const totalRegisterClicks = sumMetricSummaries(
    analyticsData?.analyticsSummaries,
    (summary) => summary.registerClicks
  );
  const paymentSuccess = sumMetricSummaries(
    analyticsData?.analyticsSummaries,
    (summary) => summary.paymentSuccess
  );
  const visitDelta = totalVisits - previousVisits;
  const visitDeltaPercent = previousVisits
    ? (visitDelta / previousVisits) * 100
    : totalVisits
      ? 100
      : 0;
  const bestSource =
    analyticsData?.analyticsSummaries
      ?.map((summary) => summary.source || "YWcoach")
      .filter(Boolean)[0] || "YWcoach";

  return {
    bestSource,
    paymentHealth: paymentSuccess > 0 ? 82 : 70,
    peakWindow: getPeakWindow(analyticsData?.timeSeries),
    performanceScore: Math.max(
      1,
      Math.min(99, Math.round(totalVisits ? 55 + Math.min(35, totalRegisterClicks * 2) : 54))
    ),
    totalRegisterClicks,
    totalVisits,
    visitDeltaLabel: `${visitDelta >= 0 ? "+" : ""}${visitDeltaPercent.toFixed(1)}%`,
    visitDeltaTone: visitDelta < 0 ? ("negative" as const) : ("positive" as const)
  };
}

function getSnapshotMetric(snapshot: AdminV2DashboardData | null, id: string) {
  return snapshot?.metrics.find((metric) => metric.id === id)?.value || 0;
}

function sumMetricSummaries(
  summaries: AnalyticsMetricSummary[] | undefined,
  selectValue: (summary: AnalyticsMetricSummary) => number
) {
  return (summaries || []).reduce((total, summary) => total + selectValue(summary), 0);
}

function getPeakWindow(timeSeries: AnalyticsTimeSeriesPoint[] | undefined) {
  const peak = (timeSeries || []).reduce<AnalyticsTimeSeriesPoint | null>((currentPeak, point) => {
    if (!currentPeak || point.currentVisits > currentPeak.currentVisits) return point;
    return currentPeak;
  }, null);

  if (!peak?.bucketStart || peak.currentVisits <= 0) return "No activity";

  const date = new Date(peak.bucketStart);
  if (Number.isNaN(date.getTime())) return "No activity";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short"
  });
}

type AdminV2OdChartPoint = {
  label: string;
  previous: number;
  value: number;
  x: number;
  y: number;
  previousY: number;
};

function buildAdminV2OdChartPoints(
  timeSeries: AnalyticsTimeSeriesPoint[] | undefined
): AdminV2OdChartPoint[] {
  const sourcePoints = (timeSeries || [])
    .filter(
      (point) =>
        point.bucketStart &&
        Number.isFinite(point.currentVisits) &&
        Number.isFinite(point.previousRangeVisits)
    )
    .map((point) => ({
      label: point.bucketStart,
      previous: Math.max(0, point.previousRangeVisits),
      value: Math.max(0, point.currentVisits)
    }));
  if (!sourcePoints.length) return [];
  const maxValue = Math.max(1, ...sourcePoints.flatMap((point) => [point.value, point.previous]));
  const xStep = sourcePoints.length > 1 ? 688 / (sourcePoints.length - 1) : 688;

  return sourcePoints.map((point, index) => {
    const x = 42 + index * xStep;
    const y = 270 - (point.value / maxValue) * 210;
    const previousY = 270 - (point.previous / maxValue) * 210;

    return {
      ...point,
      x,
      y,
      previousY
    };
  });
}

function buildAdminV2OdLinePath(points: AdminV2OdChartPoint[], key: "previous" | "value") {
  if (!points.length) return "M42 270 L730 270";

  return points
    .map((point, index) => {
      const y = key === "value" ? point.y : point.previousY;
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.map((part) => part[0]).join("") || "YW").slice(0, 2).toUpperCase();
}

function formatSiteStatus(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AdminV2AudienceMapPanel({
  onAIContextChange,
  snapshot,
  status
}: {
  onAIContextChange: (context: AdminAITableContext) => void;
  snapshot: AdminV2DashboardData | null;
  status: AdminV2DataStatus | "loading";
}) {
  const audienceRegions = snapshot?.sources.analyticsEvents.data?.audienceRegions;
  const regions = useMemo(() => normalizeAudienceRegionsForMap(audienceRegions), [audienceRegions]);
  const flatRegions = useMemo(() => flattenAudienceRegions(regions), [regions]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [drilldownRegionId, setDrilldownRegionId] = useState("");
  const drilldownRegion = flatRegions.find((region) => region.id === drilldownRegionId) || null;
  const visibleRegions = drilldownRegion?.children.length ? drilldownRegion.children : regions;
  const selectedRegion =
    flatRegions.find((region) => region.id === selectedRegionId) ||
    drilldownRegion ||
    visibleRegions[0] ||
    null;
  const totalVisits = regions.reduce((total, region) => total + region.visits, 0);
  const sourceRows = selectedRegion?.sourceBreakdown?.length
    ? selectedRegion.sourceBreakdown
    : selectedRegion
      ? [
          {
            label: selectedRegion.countryLabel || selectedRegion.label,
            share: 100,
            visits: selectedRegion.visits
          }
        ]
      : [];
  const tableAiContext = useMemo<AdminAITableContext>(
    () => ({
      filters: { drilldown: drilldownRegion?.label || "World" },
      rows: visibleRegions.slice(0, 8).map((region) => ({
        duplicateKey: region.label,
        groupKey: region.countryLabel || region.level,
        id: region.id,
        label: region.label,
        requiredDataComplete: Boolean(region.id && region.label),
        status: region.visits > 0 ? "traffic-recorded" : "no-traffic"
      })),
      selectedIds:
        selectedRegion && visibleRegions.some((region) => region.id === selectedRegion.id)
          ? [selectedRegion.id]
          : [],
      sort: { direction: "desc", field: "visits" },
      tableId: "analytics-audience-regions"
    }),
    [drilldownRegion?.label, selectedRegion, visibleRegions]
  );

  if (status === "loading") {
    return (
      <div className="audience-map-layout" aria-label="Audience map loading">
        <div className="audience-map-canvas" />
        <aside className="audience-detail">
          <div className="audience-detail-top">
            <div>
              <small>Audience map</small>
              <h4>Loading region data</h4>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <div
        className="audience-map-layout"
        data-state={regions.length ? "ready" : snapshot?.sources.analyticsEvents.status || status}
      >
        <div>
          <AdminV2LeafletAudienceMap
            locations={visibleRegions}
            onDrilldown={setDrilldownRegionId}
            onSelectRegion={setSelectedRegionId}
            selectedRegion={selectedRegion}
          />
          <div className="audience-table-card">
            <div className="audience-table-head">
              <div>
                <strong>Top traffic countries / regions</strong>
                <span>
                  {regions.length
                    ? `${totalVisits.toLocaleString("en-IN")} visits across ${regions.length} recorded countr${regions.length === 1 ? "y" : "ies"}`
                    : getAudienceMapEmptyMessage(
                        snapshot?.sources.analyticsEvents.status || status
                      )}
                </span>
              </div>
              <div
                className="row-actions"
                onFocusCapture={() => onAIContextChange(tableAiContext)}
                onPointerDownCapture={() => onAIContextChange(tableAiContext)}
              >
                <AdminAIAskButton
                  className="btn btn-sm"
                  label="Analyze audience table"
                  query="Summarize the visible audience regions and identify traffic records needing attention."
                  scope="page"
                />
                <span className="console-pill">{drilldownRegion?.label || "World"}</span>
              </div>
            </div>
            <div className="audience-table-wrap">
              <table className="audience-table">
                <thead>
                  <tr>
                    <th>Country / Region</th>
                    <th>Traffic</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegions.slice(0, 8).map((region) => (
                    <tr
                      className={
                        selectedRegion?.id === region.id
                          ? "audience-country-row is-active"
                          : "audience-country-row"
                      }
                      key={region.id}
                    >
                      <td>
                        <button
                          className="audience-country-button"
                          onClick={() => {
                            setSelectedRegionId(region.id);
                            if (region.children.length) setDrilldownRegionId(region.id);
                          }}
                          type="button"
                        >
                          {region.label}
                        </button>
                      </td>
                      <td>{region.visits.toLocaleString("en-IN")}</td>
                      <td>{region.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="audience-detail">
          {selectedRegion ? (
            <>
              <div className="audience-detail-top">
                <div>
                  <small>{getAudienceRegionLevelLabel(selectedRegion)}</small>
                  <h4>{selectedRegion.label}</h4>
                </div>
                <div className="audience-total">
                  {selectedRegion.visits.toLocaleString("en-IN")}
                  <span>Total traffic</span>
                </div>
              </div>
              <div className="audience-drilldown">
                <span>{selectedRegion.share.toFixed(1)}% share</span>
                {selectedRegion.children.length ? (
                  <>
                    <i>/</i>
                    <strong>
                      {selectedRegion.children.length} child location
                      {selectedRegion.children.length === 1 ? "" : "s"}
                    </strong>
                  </>
                ) : null}
              </div>
              <div className="audience-stat-grid">
                <div className="audience-stat">
                  <span>Register clicks</span>
                  <strong>{selectedRegion.registerClicks.toLocaleString("en-IN")}</strong>
                </div>
                <div className="audience-stat">
                  <span>Payment success</span>
                  <strong>{selectedRegion.paymentSuccess.toLocaleString("en-IN")}</strong>
                </div>
                <div className="audience-stat">
                  <span>Last activity</span>
                  <strong>{formatAudienceActivity(selectedRegion.lastActivity)}</strong>
                </div>
              </div>
              <div className="audience-breakdown">
                <strong>Top sources</strong>
                {sourceRows.map((source) => (
                  <div className="audience-region-row" key={source.label}>
                    <span>{source.label}</span>
                    <small>
                      {source.visits.toLocaleString("en-IN")} / {source.share.toFixed(1)}%
                    </small>
                    <div className="audience-meter">
                      <span style={{ width: `${Math.max(3, Math.min(100, source.share))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="audience-breakdown">
                <strong>Device mix</strong>
                {(["mobile", "desktop", "tablet", "unknown"] as const).map((device) => (
                  <div className="audience-region-row" key={device}>
                    <span>{formatDeviceLabel(device)}</span>
                    <small>{selectedRegion.deviceBreakdown[device].toLocaleString("en-IN")}</small>
                    <div className="audience-meter">
                      <span
                        style={{
                          width: `${getAudienceDeviceShare(selectedRegion, device).toFixed(1)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="audience-breakdown">
                <strong>Map precision</strong>
                <div className="audience-region-row">
                  <span>
                    {selectedRegion.coordinates.scope === "known"
                      ? "Known map coordinate"
                      : "Estimated map coordinate"}
                  </span>
                  <small>{selectedRegion.countryLabel}</small>
                </div>
              </div>
            </>
          ) : (
            <div
              className="empty-state"
              data-status={snapshot?.sources.analyticsEvents.status || status}
            >
              <span>Audience map</span>
              <strong>
                {getAudienceMapEmptyMessage(snapshot?.sources.analyticsEvents.status || status)}
              </strong>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function AdminV2LeafletAudienceMap({
  locations,
  onDrilldown,
  onSelectRegion,
  selectedRegion
}: {
  locations: AnalyticsAudienceRegion[];
  onDrilldown: (regionId: string) => void;
  onSelectRegion: (regionId: string) => void;
  selectedRegion: AnalyticsAudienceRegion | null;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let canceled = false;

    import("leaflet")
      .then((leaflet) => {
        if (canceled || !mapElementRef.current || mapRef.current) return;

        leafletRef.current = leaflet;
        const map = leaflet.map(mapElementRef.current, {
          attributionControl: false,
          fadeAnimation: false,
          maxZoom: 13,
          markerZoomAnimation: false,
          minZoom: 1,
          preferCanvas: true,
          scrollWheelZoom: true,
          worldCopyJump: true,
          zoomAnimation: false,
          zoomControl: false,
          zoomSnap: 0.5
        });
        mapRef.current = map;
        const attributionControl = leaflet.control
          .attribution({ position: "bottomright", prefix: false })
          .addTo(map);
        attributionControl.addAttribution(
          '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> / <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
        );
        leaflet
          .tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: "OpenStreetMap contributors / CARTO",
            detectRetina: false,
            errorTileUrl:
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='%23eef7e8'/%3E%3Cpath d='M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256' stroke='%23167a3b' stroke-width='1' opacity='.28'/%3E%3C/svg%3E",
            keepBuffer: 1,
            maxNativeZoom: 18,
            updateWhenIdle: true,
            updateWhenZooming: false,
            subdomains: "abcd"
          })
          .addTo(map);
        leaflet.control.zoom({ position: "topright" }).addTo(map);
        markersRef.current = leaflet.layerGroup().addTo(map);
        map.setView([20, 20], 2);
        window.requestAnimationFrame(() => map.invalidateSize());
        setMapReady(true);
      })
      .catch(() => setMapReady(false));

    return () => {
      canceled = true;
      markersRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!mapReady || !leaflet || !map || !markers) return;

    map.invalidateSize();
    markers.clearLayers();

    if (!locations.length) {
      map.setView([20, 20], 2);
      return;
    }

    const bounds: Array<[number, number]> = [];

    for (const location of locations) {
      const latLng: [number, number] = [location.coordinates.lat, location.coordinates.lng];
      const selected = selectedRegion?.id === location.id;
      const marker = leaflet.circleMarker(latLng, {
        color: "#06110b",
        fillColor: selected ? "#d6ff32" : "#b7ff3c",
        fillOpacity: selected ? 1 : 0.92,
        opacity: 1,
        radius: getAudiencePointSize(location.share, location.level, selected),
        weight: selected ? 4 : 2.4
      });

      marker.bindTooltip(
        `${location.label}: ${location.visits.toLocaleString("en-IN")} visit${location.visits === 1 ? "" : "s"}`,
        {
          direction: "top",
          opacity: 0.96
        }
      );
      marker.on("click", () => {
        onSelectRegion(location.id);
        if (location.children.length) onDrilldown(location.id);
      });
      marker.addTo(markers);

      if (selected) {
        leaflet
          .circle(latLng, {
            color: "#b7ff3c",
            fillColor: "#b7ff3c",
            fillOpacity: 0.07,
            opacity: 0.42,
            radius: getAudienceHighlightRadius(location.level)
          })
          .addTo(markers);
      }

      bounds.push(latLng);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], getAudienceZoomLevel(locations[0].level));
    } else {
      const hasCity = locations.some((location) => location.level === "city");
      const hasDistrict = locations.some((location) => location.level === "district");
      const hasRegion = locations.some((location) => location.level === "region");
      map.fitBounds(bounds, {
        maxZoom: hasCity ? 10 : hasDistrict ? 9 : hasRegion ? 7 : 4,
        padding: [44, 44]
      });
    }
  }, [locations, mapReady, onDrilldown, onSelectRegion, selectedRegion?.id]);

  return (
    <div className={mapReady ? "audience-map-canvas is-leaflet-ready" : "audience-map-canvas"}>
      <div ref={mapElementRef} className="audience-leaflet-map" />
      <div className="audience-scale" aria-hidden="true">
        <strong>Traffic density</strong>
        <div className="audience-scale-bar" />
        <span>Low to high requests</span>
      </div>
    </div>
  );
}

function getAudienceMapEmptyMessage(status: AdminV2DataStatus | "loading") {
  if (status === "loading") return "Loading real analytics region data.";
  if (status === "not-authorized") return "Analytics permission is not assigned to this admin.";
  if (status === "empty") return "No region data recorded from analytics events yet.";
  return "Audience region data is unavailable right now.";
}

function flattenAudienceRegions(regions: AnalyticsAudienceRegion[]): AnalyticsAudienceRegion[] {
  return regions.flatMap((region) => [region, ...flattenAudienceRegions(region.children)]);
}

function normalizeAudienceRegionsForMap(
  regions: AnalyticsAudienceRegion[] | undefined
): AnalyticsAudienceRegion[] {
  return (regions || []).filter(Boolean).map((region) => {
    const unsafeRegion = region as AnalyticsAudienceRegion & {
      children?: AnalyticsAudienceRegion[];
      coordinates?: Partial<AnalyticsAudienceRegion["coordinates"]>;
      deviceBreakdown?: Partial<AnalyticsAudienceRegion["deviceBreakdown"]>;
      sourceBreakdown?: AnalyticsAudienceRegion["sourceBreakdown"];
    };
    const label = unsafeRegion.label || unsafeRegion.countryLabel || "Unknown region";
    const level = unsafeRegion.level || "country";
    const coordinates = unsafeRegion.coordinates || {};

    return {
      ...unsafeRegion,
      children: normalizeAudienceRegionsForMap(unsafeRegion.children),
      coordinates: {
        lat: toSafeAudienceNumber(coordinates.lat, 20),
        lng: toSafeAudienceNumber(coordinates.lng, 20),
        scope: coordinates.scope === "known" ? "known" : "estimated"
      },
      countryLabel: unsafeRegion.countryLabel || label,
      deviceBreakdown: {
        desktop: toSafeAudienceNumber(unsafeRegion.deviceBreakdown?.desktop, 0),
        mobile: toSafeAudienceNumber(unsafeRegion.deviceBreakdown?.mobile, 0),
        tablet: toSafeAudienceNumber(unsafeRegion.deviceBreakdown?.tablet, 0),
        unknown: toSafeAudienceNumber(unsafeRegion.deviceBreakdown?.unknown, 0)
      },
      id: unsafeRegion.id || `${level}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
      lastActivity: unsafeRegion.lastActivity || "",
      level,
      parentId: unsafeRegion.parentId || null,
      paymentSuccess: toSafeAudienceNumber(unsafeRegion.paymentSuccess, 0),
      registerClicks: toSafeAudienceNumber(unsafeRegion.registerClicks, 0),
      share: toSafeAudienceNumber(unsafeRegion.share, 0),
      sourceBreakdown: Array.isArray(unsafeRegion.sourceBreakdown)
        ? unsafeRegion.sourceBreakdown
        : [],
      visits: toSafeAudienceNumber(unsafeRegion.visits, 0)
    };
  });
}

function toSafeAudienceNumber(value: number | undefined, defaultValue: number) {
  return Number.isFinite(value) ? Number(value) : defaultValue;
}

function getAudiencePointSize(
  share: number,
  level: AnalyticsAudienceRegion["level"],
  selected: boolean
) {
  const baseSize = level === "country" ? 6 : level === "region" ? 6.5 : 6;
  return Math.max(baseSize, Math.min(selected ? 12 : 9, baseSize + share * 0.035));
}

function getAudienceHighlightRadius(level: AnalyticsAudienceRegion["level"]) {
  if (level === "city") return 6000;
  if (level === "district") return 18000;
  if (level === "region") return 45000;
  return 160000;
}

function getAudienceZoomLevel(level: AnalyticsAudienceRegion["level"]) {
  if (level === "city") return 11;
  if (level === "district") return 9;
  if (level === "region") return 7;
  return 4;
}

function getAudienceRegionLevelLabel(region: AnalyticsAudienceRegion) {
  if (region.level === "city") return "City signal";
  if (region.level === "district") return "District signal";
  if (region.level === "region") return "Region signal";
  return "Country signal";
}

function formatAudienceActivity(timestamp: string) {
  if (!timestamp) return "No activity";
  return formatSignalTime(timestamp);
}

function formatDeviceLabel(device: "desktop" | "mobile" | "tablet" | "unknown") {
  return device === "unknown" ? "Unknown" : device.charAt(0).toUpperCase() + device.slice(1);
}

function getAudienceDeviceShare(
  region: AnalyticsAudienceRegion,
  device: "desktop" | "mobile" | "tablet" | "unknown"
) {
  const total = Object.values(region.deviceBreakdown).reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  return (region.deviceBreakdown[device] / total) * 100;
}

function formatSignalTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}
