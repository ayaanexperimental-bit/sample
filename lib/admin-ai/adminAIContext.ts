import type { AdminV2AccessProfileClient, AdminV2ViewId } from "../admin-v2-access";
import type { AdminErrorReport } from "../admin-control-center";
import type { CoachSiteRecord } from "../admin-coach-sites";
import type { AdminV2DataStatus, AdminV2MetricCardData } from "../admin-v2-dashboard-data";
import type { AnalyticsMetricSummary, AnalyticsTimeSeriesPoint } from "../analytics-events";
import { getAdminAISection, type AdminAICommand } from "./adminAIRegistry";
import type { AdminAIEntity, AdminAIScope } from "./adminAITypes";

export type AdminAIVisibleMetric = {
  label: string;
  source: string;
  value: number | string;
};

export type AdminAIBuilderSnapshot = {
  coachName: string;
  currentStep: string;
  hasPreview: boolean;
  mediaReady: boolean;
  missingFields: string[];
  readinessChecks?: Array<{
    detail: string;
    id: string;
    ready: boolean;
  }>;
  saving: boolean;
  slug: string;
};

export type AdminAIShopSnapshot = {
  failedPublishCount: number;
  paidCount: number;
  purchaseCount: number;
  records?: Array<{
    id: string;
    label: string;
    status: string;
    updatedAt: string;
    workflowStage: string;
  }>;
  siteCount: number;
};

export type AdminAIKnowledgeEntry = {
  freshness: string;
  id: string;
  searchableText: string;
  source: string;
  summary: string;
  title: string;
};

export type AdminAIRegisteredActionView = {
  id: string;
  label: string;
  relatedAPI: string | null;
  requiredPermissions: string[];
  searchText: string;
  type: AdminAICommand["type"];
};

export type AdminAIGlobalContext = {
  emptyState: boolean;
  errors: string[];
  relatedAPIs: string[];
  registeredActions: AdminAIRegisteredActionView[];
  visibleDataSummary: AdminAIVisibleMetric[];
  warnings: string[];
};

export type AdminAISectionContext = {
  analyticsSeries: Array<{
    current: number;
    label: string;
    previous: number;
    registerClicks: number;
  }>;
  availableActions: string[];
  currentRoute: string;
  dataFreshness: string;
  dateRange: string;
  emptyState: boolean;
  entities: AdminAIEntity[];
  errors: string[];
  filters: Record<string, string>;
  globalContext: AdminAIGlobalContext;
  lastUpdated: string;
  loadingState: boolean;
  knowledge: AdminAIKnowledgeEntry[];
  permissions: string[];
  relatedAPIs: string[];
  registeredActions: AdminAIRegisteredActionView[];
  sectionId: AdminV2ViewId;
  sectionName: string;
  selectedRows: string[];
  userRole: string;
  visibleDataSummary: AdminAIVisibleMetric[];
  warnings: string[];
};

export type BuildAdminAIContextInput = {
  activeView: AdminV2ViewId;
  analytics: AnalyticsMetricSummary[];
  availableActions?: string[];
  builder?: AdminAIBuilderSnapshot | null;
  coachSites: CoachSiteRecord[];
  currentRoute: string;
  dateRange: string;
  errorReports: AdminErrorReport[];
  filters?: Record<string, string>;
  globalRegisteredCommands?: AdminAICommand[];
  highRiskCount: number;
  lastUpdated: string;
  loading: boolean;
  metrics: AdminV2MetricCardData[];
  profile?: AdminV2AccessProfileClient | null;
  relatedAPIs: string[];
  registeredCommands?: AdminAICommand[];
  sectionName: string;
  selectedRows?: string[];
  shop?: AdminAIShopSnapshot | null;
  sourceStatuses: Record<string, AdminV2DataStatus | "loading" | string>;
  timeSeries: AnalyticsTimeSeriesPoint[];
};

const MAX_CONTEXT_ITEMS = 12;

export function buildAdminAISectionContext(input: BuildAdminAIContextInput): AdminAISectionContext {
  const visibleDataSummary = buildVisibleSummary(input);
  const warnings = buildWarnings(input);
  const errors = buildErrors(input);

  return {
    analyticsSeries: input.timeSeries.slice(0, 240).map((point) => ({
      current: finite(point.currentVisits),
      label: cleanText(point.bucketStart, 64),
      previous: finite(point.previousRangeVisits),
      registerClicks: finite(point.registerClicks),
    })),
    availableActions: cleanList(input.availableActions || [], MAX_CONTEXT_ITEMS),
    currentRoute: cleanText(input.currentRoute, 160),
    dataFreshness: describeFreshness(input.lastUpdated),
    dateRange: cleanText(input.dateRange, 80) || "Current view",
    emptyState: !input.loading && visibleDataSummary.every((item) => numericValue(item.value) === 0),
    entities: buildEntityIndex(input),
    errors,
    filters: cleanRecord(input.filters || {}),
    globalContext: buildGlobalContext(input),
    lastUpdated: cleanText(input.lastUpdated, 64),
    loadingState: input.loading,
    knowledge: buildKnowledge(input),
    permissions: cleanList(input.profile?.permissions || [], 80),
    relatedAPIs: cleanList(input.relatedAPIs, MAX_CONTEXT_ITEMS),
    registeredActions: buildRegisteredActionViews(input.registeredCommands || []),
    sectionId: input.activeView,
    sectionName: cleanText(input.sectionName, 80),
    selectedRows: cleanList(input.selectedRows || [], 8),
    userRole: cleanText(
      input.profile?.isOwner ? "owner" : input.profile?.role || input.profile?.roleKey || "admin",
      48
    ),
    visibleDataSummary,
    warnings,
  };
}

export function scopeAdminAIContext(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  selectedRows: string[] = []
): AdminAISectionContext {
  const scoped = scope === "global"
    ? { ...context, ...context.globalContext, sectionName: "Global Admin" }
    : context;

  return {
    ...scoped,
    selectedRows: Array.from(new Set([...context.selectedRows, ...selectedRows])).slice(0, 40),
  };
}

function buildGlobalContext(input: BuildAdminAIContextInput): AdminAIGlobalContext {
  const commands = input.globalRegisteredCommands || input.registeredCommands || [];
  const visibleDataSummary = buildGlobalVisibleSummary(input);
  const relatedAPIs = Array.from(
    new Set(commands.flatMap((command) => getAdminAISection(command.sectionId).relatedAPIs))
  );

  return {
    emptyState:
      visibleDataSummary.length === 0 ||
      visibleDataSummary.every((item) => numericValue(item.value) === 0),
    errors: buildGlobalErrors(input),
    relatedAPIs: cleanList(relatedAPIs, 40),
    registeredActions: buildRegisteredActionViews(commands),
    visibleDataSummary,
    warnings: buildGlobalWarnings(input),
  };
}

function buildRegisteredActionViews(commands: AdminAICommand[]): AdminAIRegisteredActionView[] {
  return commands.slice(0, 80).map((command) => ({
    id: command.id,
    label: cleanText(command.label, 80),
    relatedAPI: getAdminAISection(command.sectionId).relatedAPIs[0] || null,
    requiredPermissions: cleanList(command.requiredPermissions || [], 20),
    searchText: cleanText(`${command.id} ${command.label} ${command.description}`.toLowerCase(), 320),
    type: command.type,
  }));
}

function buildEntityIndex(input: BuildAdminAIContextInput): AdminAIEntity[] {
  const entities: AdminAIEntity[] = [];
  const owner = Boolean(input.profile?.isOwner);
  const permissions = new Set(input.profile?.permissions || []);
  const can = (permission: string) => owner || permissions.has(permission);

  if (can("coach_sites.view")) {
    input.coachSites.slice(0, 160).forEach((site) => {
      const missingLink = !site.googleFormUrl.trim() && !site.whatsappLink.trim();
      entities.push({
        id: cleanText(site.id || site.slug, 120),
        label: cleanText(site.coachName || site.slug, 120),
        matchReason: missingLink ? "Coach site is missing a registration destination." : `Coach site status is ${site.status}.`,
        module: "coach-sites",
        route: `/admin/dashboard?view=coach-sites&coach=${encodeURIComponent(site.slug)}`,
        searchableText: cleanText(
          [site.coachName, site.slug, site.niche, site.location, site.status, missingLink ? "missing registration link" : "registration ready"].join(" ").toLowerCase(),
          500
        ),
        source: "coach-sites",
        status: site.status,
        updatedAt: safeTimestamp(site.updatedAt || site.publishedAt || site.createdAt),
      });
    });
  }

  if (can("coach_analytics.view") || can("coach_analytics.top_performers")) {
    input.analytics.slice(0, 200).forEach((row) => {
      entities.push({
        id: cleanText(`analytics:${row.coachSlug}:${row.funnelId}`, 120),
        label: cleanText(row.coachSlug || row.coachId || "Coach analytics", 120),
        matchReason: `${row.totalVisits} visits and ${row.registerClicks} registration clicks in the loaded range.`,
        module: "coach-analytics",
        route: `/admin/dashboard?view=coach-analytics&coach=${encodeURIComponent(row.coachSlug)}`,
        searchableText: cleanText(
          `${row.coachSlug} ${row.region} ${row.funnelType} visits ${row.totalVisits} registrations ${row.registerClicks} payment ${row.paymentSuccess}`.toLowerCase(),
          500
        ),
        source: row.source || "analytics-events",
        status: row.totalVisits > 0 ? "active" : "no analytics",
        updatedAt: safeTimestamp(row.lastActivity),
      });
    });
  }

  if (can("error_reports.view")) {
    input.errorReports.slice(0, 160).forEach((report) => {
      entities.push({
        id: cleanText(report.referenceId, 120),
        label: cleanText(`${report.category} / ${report.referenceId}`, 140),
        matchReason: cleanText(report.safeMessage || `${report.severity} ${report.category}`, 180),
        module: "error-reports",
        route: `/admin/dashboard?view=error-reports&report=${encodeURIComponent(report.referenceId)}`,
        searchableText: cleanText(
          [
            report.referenceId,
            report.category,
            report.safeMessage,
            report.pagePath,
            report.coachSlug || "",
            report.severity,
            report.status,
            report.errorCode || "",
          ].join(" ").toLowerCase(),
          500
        ),
        source: "error-reports",
        status: `${report.severity} / ${report.status}`,
        updatedAt: safeTimestamp(report.updatedAt || report.createdAt),
      });
    });
  }

  if (can("shop.view") || can("shop.recovery") || can("shop.reports")) {
    (input.shop?.records || []).slice(0, 120).forEach((record) => {
      entities.push({
        id: cleanText(record.id, 120),
        label: cleanText(record.label, 120),
        matchReason: cleanText(`Shop workflow stage ${record.workflowStage}; status ${record.status}.`, 180),
        module: "shop",
        route: `/admin/dashboard?view=shop&order=${encodeURIComponent(record.id)}`,
        searchableText: cleanText(`${record.label} ${record.id} ${record.status} ${record.workflowStage}`.toLowerCase(), 500),
        source: "shop",
        status: record.status,
        updatedAt: safeTimestamp(record.updatedAt),
      });
    });
  }

  return entities.slice(0, 500);
}

function buildKnowledge(input: BuildAdminAIContextInput): AdminAIKnowledgeEntry[] {
  const owner = Boolean(input.profile?.isOwner);
  const permissions = new Set(input.profile?.permissions || []);
  const entries: Array<AdminAIKnowledgeEntry & { permission?: string; ownerOnly?: boolean }> = [
    knowledge("copilot-safety", "Admin Copilot safety boundary", "Only registered actions are available. RBAC, validation, confirmation, and OTP execute outside the model and cannot be bypassed.", "Admin Copilot specification sections 7-9, 18-19, 44, 52-53"),
    knowledge("publish-rules", "Website publish rules", "Existing required-field validation, preview checks, and protected publish logic remain authoritative. Copilot can inspect and prepare but cannot bypass them.", "Website Creator production rules", "website_creator.create"),
    knowledge("otp-rules", "OTP and destructive-action rules", "Archive, delete, role, cleanup, and other protected workflows retain their existing confirmation and OTP requirements.", "Admin security and OTP runbook"),
    knowledge("payment-rules", "Payment and publish reconciliation", "Server-side payment status is authoritative. Copilot never reads payment secrets and can only prepare registered recovery workflows.", "Shop payment/publish rules", "shop.view"),
    knowledge("backup-rules", "Backup and cleanup safety", "Cleanup should follow a verified backup. Irreversible cleanup must be explicit and must not claim rollback support.", "Backup and cleanup runbook", "backup_cleanup.view"),
    knowledge("role-rules", "Least-privilege admin roles", "Restricted admins see only allowed modules and actions. Owner protection remains authoritative and a co-owner cannot remove the root owner.", "Admin RBAC policy", "admin_users.manage", true),
  ];
  return entries
    .filter((entry) => (!entry.ownerOnly || owner) && (!entry.permission || owner || permissions.has(entry.permission)))
    .map((entry) => ({
      freshness: entry.freshness,
      id: entry.id,
      searchableText: entry.searchableText,
      source: entry.source,
      summary: entry.summary,
      title: entry.title,
    }));
}

function knowledge(
  id: string,
  title: string,
  summary: string,
  source: string,
  permission?: string,
  ownerOnly = false
) {
  return {
    freshness: "Versioned with current Admin V2 implementation",
    id,
    ownerOnly,
    permission,
    searchableText: `${title} ${summary}`.toLowerCase(),
    source,
    summary,
    title,
  };
}

function buildVisibleSummary(input: BuildAdminAIContextInput): AdminAIVisibleMetric[] {
  const published = input.coachSites.filter((site) => site.status === "published").length;
  const drafts = input.coachSites.filter((site) => site.status === "draft").length;
  const archived = input.coachSites.filter((site) => site.status === "archived").length;
  const missingLinks = input.coachSites.filter(
    (site) => site.status !== "removed" && !site.googleFormUrl.trim() && !site.whatsappLink.trim()
  ).length;
  const totalVisits = sum(input.analytics, (row) => row.totalVisits);
  const registerClicks = sum(input.analytics, (row) => row.registerClicks);
  const paymentSuccess = sum(input.analytics, (row) => row.paymentSuccess);
  const openReports = input.errorReports.filter(
    (report) => report.status !== "Fixed" && report.status !== "Ignored"
  ).length;
  const highReports = input.errorReports.filter(
    (report) => report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
  ).length;

  switch (input.activeView) {
    case "coach-sites":
      return compactMetrics([
        metric("Coach sites", input.coachSites.length, "coach-sites"),
        metric("Published", published, "coach-sites"),
        metric("Draft", drafts, "coach-sites"),
        metric("Archived", archived, "coach-sites"),
        metric("Missing registration links", missingLinks, "coach-sites"),
      ]);
    case "create-coach-site":
      return compactMetrics([
        metric("Current step", input.builder?.currentStep || "Not started", "website-creator"),
        metric("Missing required fields", input.builder?.missingFields.length || 0, "website-creator"),
        metric("Preview ready", input.builder?.hasPreview ? "Yes" : "No", "website-creator"),
        metric("Media ready", input.builder?.mediaReady ? "Yes" : "No", "website-creator"),
        metric(
          "Readiness checks passed",
          input.builder?.readinessChecks?.filter((item) => item.ready).length || 0,
          "website-creator"
        ),
        metric(
          "Readiness warnings",
          input.builder?.readinessChecks?.filter((item) => !item.ready).length || 0,
          "website-creator"
        ),
        metric("Existing coach sites", input.coachSites.length, "coach-sites"),
      ]);
    case "coach-analytics":
      return compactMetrics([
        metric("Coach rows", input.analytics.length, "analytics"),
        metric("Real chart points", input.timeSeries.length, "analytics"),
        metric("Visits", totalVisits, "analytics"),
        metric("Register clicks", registerClicks, "analytics"),
        metric("Payment success", paymentSuccess, "analytics"),
        metric("Attention signals", input.highRiskCount, "analytics"),
      ]);
    case "top-coaches":
      return compactMetrics([
        metric("Coach rows", input.analytics.length, "analytics"),
        metric("Published sites", published, "coach-sites"),
        metric("Visits", totalVisits, "analytics"),
        metric("Attention signals", input.highRiskCount, "analytics"),
      ]);
    case "shop":
      return compactMetrics([
        metric("Purchases", input.shop?.purchaseCount || 0, "shop"),
        metric("Paid orders", input.shop?.paidCount || 0, "shop"),
        metric("Published sites", input.shop?.siteCount || 0, "shop"),
        metric("Publish or payment failures", input.shop?.failedPublishCount || 0, "shop"),
      ]);
    case "error-reports":
    case "backup-cleanup":
      return compactMetrics([
        metric("Open reports", openReports, "error-reports"),
        metric("High severity open", highReports, "error-reports"),
        metric("All loaded reports", input.errorReports.length, "error-reports"),
        metric("Backup source", input.sourceStatuses.backupCleanup || "unavailable", "backup-cleanup"),
      ]);
    case "paid-masterclass-settings":
      return compactMetrics([
        metric(
          "Payment settings source",
          input.sourceStatuses.masterclassSettings || "unavailable",
          "payments"
        ),
        metric(
          "Private links source",
          input.sourceStatuses.masterclassPrivateLinks || "unavailable",
          "payments"
        ),
      ]);
    case "settings":
    case "admin-users":
      return compactMetrics([
        metric("Assigned permissions", input.profile?.permissions?.length || 0, "admin-session"),
        metric("Admin role", input.profile?.isOwner ? "Owner" : input.profile?.role || "Admin", "admin-session"),
        metric("Settings source", input.sourceStatuses.authSession || "unavailable", "admin-session"),
        metric("Admin users source", input.sourceStatuses.users || "unavailable", "admin-users"),
      ]);
    default:
      return compactMetrics(
        input.metrics.map((item) => metric(item.label, item.value, item.source)).slice(0, MAX_CONTEXT_ITEMS)
      );
  }
}

function buildGlobalVisibleSummary(input: BuildAdminAIContextInput): AdminAIVisibleMetric[] {
  const metrics: AdminAIVisibleMetric[] = [];

  if (canAccess(input, "coach_sites.view")) {
    metrics.push(
      metric("Coach sites", input.coachSites.length, "coach-sites"),
      metric("Published coach sites", input.coachSites.filter((site) => site.status === "published").length, "coach-sites"),
      metric("Draft coach sites", input.coachSites.filter((site) => site.status === "draft").length, "coach-sites"),
      metric(
        "Sites missing registration links",
        input.coachSites.filter(
          (site) => site.status !== "removed" && !site.googleFormUrl.trim() && !site.whatsappLink.trim()
        ).length,
        "coach-sites"
      )
    );
  }
  if (canAccess(input, "coach_analytics.view", "coach_analytics.top_performers")) {
    metrics.push(
      metric("Coach analytics rows", input.analytics.length, "analytics"),
      metric("Visits", sum(input.analytics, (row) => row.totalVisits), "analytics"),
      metric("Registration clicks", sum(input.analytics, (row) => row.registerClicks), "analytics")
    );
  }
  if (canAccess(input, "shop.view", "shop.recovery", "shop.reports")) {
    metrics.push(
      metric("Shop purchases", input.shop?.purchaseCount || 0, "shop"),
      metric("Shop publish or payment failures", input.shop?.failedPublishCount || 0, "shop")
    );
  }
  if (canAccess(input, "error_reports.view")) {
    metrics.push(
      metric(
        "Open error reports",
        input.errorReports.filter((report) => report.status !== "Fixed" && report.status !== "Ignored").length,
        "error-reports"
      ),
      metric(
        "High-severity open reports",
        input.errorReports.filter(
          (report) => report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
        ).length,
        "error-reports"
      )
    );
  }

  return compactMetrics(metrics);
}

function buildGlobalWarnings(input: BuildAdminAIContextInput) {
  const warnings: string[] = [];

  if (canAccess(input, "coach_sites.view")) {
    const drafts = input.coachSites.filter((site) => site.status === "draft").length;
    const missingLinks = input.coachSites.filter(
      (site) => site.status !== "removed" && !site.googleFormUrl.trim() && !site.whatsappLink.trim()
    ).length;
    if (drafts > 0) warnings.push(`${drafts} coach site${drafts === 1 ? " is" : "s are"} still in draft.`);
    if (missingLinks > 0) {
      warnings.push(`${missingLinks} active coach site${missingLinks === 1 ? " has" : "s have"} no registration link.`);
    }
  }
  if (canAccess(input, "coach_analytics.view", "coach_analytics.top_performers") && input.highRiskCount > 0) {
    warnings.push(`${input.highRiskCount} real coach performance signal${input.highRiskCount === 1 ? " needs" : "s need"} review.`);
  }
  if (canAccess(input, "error_reports.view")) {
    const highReports = input.errorReports.filter(
      (report) => report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
    ).length;
    if (highReports > 0) {
      warnings.push(`${highReports} high-severity open report${highReports === 1 ? " needs" : "s need"} triage.`);
    }
  }
  if (canAccess(input, "shop.view", "shop.recovery", "shop.reports") && (input.shop?.failedPublishCount || 0) > 0) {
    warnings.push(`${input.shop?.failedPublishCount} Shop payment or publish issue${input.shop?.failedPublishCount === 1 ? " needs" : "s need"} recovery review.`);
  }

  return cleanList(warnings, MAX_CONTEXT_ITEMS);
}

function buildGlobalErrors(input: BuildAdminAIContextInput) {
  const sources: Array<{ id: string; permissions: string[] }> = [
    { id: "authSession", permissions: [] },
    { id: "coachSites", permissions: ["coach_sites.view"] },
    { id: "analyticsEvents", permissions: ["coach_analytics.view", "coach_analytics.top_performers"] },
    { id: "errorReports", permissions: ["error_reports.view"] },
    { id: "shop", permissions: ["shop.view", "shop.recovery", "shop.reports"] },
    { id: "backupCleanup", permissions: ["backup_cleanup.view"] },
    { id: "masterclassPrivateLinks", permissions: ["paid_masterclass.view_settings"] },
    { id: "masterclassSettings", permissions: ["paid_masterclass.view_settings"] },
    { id: "users", permissions: ["admin_users.manage"] },
  ];

  return cleanList(
    sources.flatMap((source) => {
      if (source.permissions.length && !canAccess(input, ...source.permissions)) return [];
      return input.sourceStatuses[source.id] === "unavailable"
        ? [`${formatSource(source.id)} data is unavailable.`]
        : [];
    }),
    MAX_CONTEXT_ITEMS
  );
}

function canAccess(input: BuildAdminAIContextInput, ...permissions: string[]) {
  if (input.profile?.isOwner) return true;
  const assigned = new Set(input.profile?.permissions || []);
  return permissions.some((permission) => assigned.has(permission));
}

function buildWarnings(input: BuildAdminAIContextInput) {
  const warnings: string[] = [];
  const drafts = input.coachSites.filter((site) => site.status === "draft").length;
  const missingLinks = input.coachSites.filter(
    (site) => site.status !== "removed" && !site.googleFormUrl.trim() && !site.whatsappLink.trim()
  ).length;
  const highReports = input.errorReports.filter(
    (report) => report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
  ).length;

  if ((input.activeView === "coach-sites" || input.activeView === "overview") && drafts > 0) {
    warnings.push(`${drafts} coach site${drafts === 1 ? " is" : "s are"} still in draft.`);
  }
  if ((input.activeView === "coach-sites" || input.activeView === "overview") && missingLinks > 0) {
    warnings.push(`${missingLinks} active coach site${missingLinks === 1 ? " has" : "s have"} no registration link.`);
  }
  if (["coach-analytics", "top-coaches", "overview"].includes(input.activeView) && input.highRiskCount > 0) {
    warnings.push(`${input.highRiskCount} real coach performance signal${input.highRiskCount === 1 ? " needs" : "s need"} review.`);
  }
  if (["error-reports", "backup-cleanup", "overview"].includes(input.activeView) && highReports > 0) {
    warnings.push(`${highReports} high-severity open report${highReports === 1 ? " needs" : "s need"} triage.`);
  }
  if (input.activeView === "create-coach-site" && input.builder?.missingFields.length) {
    warnings.push(`Publish readiness is missing: ${input.builder.missingFields.join(", ")}.`);
  }
  if (input.activeView === "create-coach-site") {
    input.builder?.readinessChecks
      ?.filter((item) => !item.ready)
      .slice(0, 6)
      .forEach((item) => warnings.push(item.detail));
  }
  if (input.activeView === "shop" && (input.shop?.failedPublishCount || 0) > 0) {
    warnings.push(`${input.shop?.failedPublishCount} Shop payment or publish issue${input.shop?.failedPublishCount === 1 ? " needs" : "s need"} recovery review.`);
  }

  return cleanList(warnings, MAX_CONTEXT_ITEMS);
}

function buildErrors(input: BuildAdminAIContextInput) {
  const relevantSources = getRelevantSources(input.activeView);

  return cleanList(
    relevantSources.flatMap((source) => {
      const status = input.sourceStatuses[source];
      return status === "unavailable" ? [`${formatSource(source)} data is unavailable.`] : [];
    }),
    MAX_CONTEXT_ITEMS
  );
}

function getRelevantSources(view: AdminV2ViewId) {
  if (view === "coach-sites" || view === "create-coach-site") return ["coachSites"];
  if (view === "coach-analytics" || view === "top-coaches") return ["analyticsEvents", "coachSites"];
  if (view === "shop") return ["shop"];
  if (view === "error-reports") return ["errorReports"];
  if (view === "backup-cleanup") return ["backupCleanup", "errorReports"];
  if (view === "paid-masterclass-settings") return ["masterclassPrivateLinks", "masterclassSettings"];
  if (view === "admin-users") return ["users"];
  return ["authSession"];
}

function metric(label: string, value: number | string, source: string): AdminAIVisibleMetric {
  return { label, source, value };
}

function compactMetrics(items: AdminAIVisibleMetric[]) {
  return items.slice(0, MAX_CONTEXT_ITEMS).map((item) => ({
    label: cleanText(item.label, 80),
    source: cleanText(item.source, 64),
    value: typeof item.value === "number" ? item.value : cleanText(item.value, 120),
  }));
}

function cleanRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_CONTEXT_ITEMS)
      .map(([key, item]) => [cleanText(key, 48), cleanText(item, 100)])
  );
}

function cleanList(values: string[], limit: number) {
  return values.map((value) => cleanText(value, 180)).filter(Boolean).slice(0, limit);
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function numericValue(value: number | string) {
  return typeof value === "number" ? value : Number.NaN;
}

function describeFreshness(value: string) {
  if (!value) return "Not loaded";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Timestamp unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated less than a minute ago";
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function formatSource(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

function sum<TItem>(items: TItem[], select: (item: TItem) => number) {
  return items.reduce((total, item) => total + select(item), 0);
}

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function safeTimestamp(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Timestamp unavailable";
  return new Date(value).toISOString();
}
