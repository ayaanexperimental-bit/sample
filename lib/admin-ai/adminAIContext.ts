import type { AdminV2AccessProfileClient, AdminV2ViewId } from "../admin-v2-access";
import type { AdminErrorReport } from "../admin-control-center";
import type { CoachSiteRecord } from "../admin-coach-sites";
import type { AdminV2DataStatus, AdminV2MetricCardData } from "../admin-v2-dashboard-data";
import type { AnalyticsMetricSummary, AnalyticsTimeSeriesPoint } from "../analytics-events";
import type { AdminAIAnalyticsPoint } from "./adminAIAnalytics";
import type { AdminAIBuilderInspectionInput } from "./adminAIBuilderInspection";
import type { AdminAIErrorReportFact } from "./adminAIErrorInvestigation";
import {
  ADMIN_AI_HEALTH_SCORE_DIMENSIONS,
  analyzeAdminAIAnomalies,
  type AdminAIAnomalyAnalysis,
  type AdminAIAnomalyHistoryInput,
  type AdminAIHealthEvidenceInput,
  type AdminAIHealthScoreDimensionInput,
  type AdminAIHealthScoreInput
} from "./adminAIHealth";
import type { AdminAIOperationalContext } from "./adminAIOperationalContext";
import {
  indexAdminAIKnowledge,
  type AdminAIKnowledgeDocument,
  type AdminAIKnowledgeIndex
} from "./adminAIKnowledge";
import { getAdminAISection, type AdminAICommand } from "./adminAIRegistry";
import type { AdminAITableContext } from "./adminAITableCopilot";
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
  inspection?: AdminAIBuilderInspectionInput;
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

export type AdminAIIntelligenceContext = {
  analyticsPoints: AdminAIAnalyticsPoint[];
  anomalyAnalysis?: AdminAIAnomalyAnalysis;
  builderInspection: AdminAIBuilderInspectionInput | null;
  errorReports: AdminAIErrorReportFact[];
  healthEvidence: AdminAIHealthEvidenceInput[];
  healthScore: AdminAIHealthScoreInput;
  table: AdminAITableContext | null;
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
  intelligence?: AdminAIIntelligenceContext;
  isOwner?: boolean;
  lastUpdated: string;
  loadingState: boolean;
  knowledge: AdminAIKnowledgeEntry[];
  knowledgeIndex?: AdminAIKnowledgeIndex;
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
  intelligence?: AdminAIIntelligenceContext;
  lastUpdated: string;
  loading: boolean;
  metrics: AdminV2MetricCardData[];
  operational?: AdminAIOperationalContext;
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

export function getAdminAIAnalyticsEntityId(
  summary: Pick<AnalyticsMetricSummary, "coachSlug" | "funnelId">
) {
  return cleanText(`analytics:${summary.coachSlug}:${summary.funnelId}`, 120);
}

export function buildAdminAISectionContext(input: BuildAdminAIContextInput): AdminAISectionContext {
  const visibleDataSummary = buildVisibleSummary(input);
  const warnings = buildWarnings(input);
  const errors = buildErrors(input);
  const knowledgeDocuments = buildKnowledgeDocuments(input);
  const isOwner = Boolean(input.profile?.isOwner);
  const permissions = new Set(input.profile?.permissions || []);
  const canViewAnalytics = canViewAdminAIIntelligenceSource(
    "analytics-events",
    isOwner,
    permissions
  );

  return {
    analyticsSeries: canViewAnalytics
      ? input.timeSeries.slice(0, 240).map((point) => ({
          current: finite(point.currentVisits),
          label: cleanText(point.bucketStart, 64),
          previous: finite(point.previousRangeVisits),
          registerClicks: finite(point.registerClicks)
        }))
      : [],
    availableActions: cleanList(input.availableActions || [], MAX_CONTEXT_ITEMS),
    currentRoute: cleanText(input.currentRoute, 160),
    dataFreshness: describeFreshness(input.lastUpdated),
    dateRange: cleanText(input.dateRange, 80) || "Current view",
    emptyState:
      !input.loading && visibleDataSummary.every((item) => numericValue(item.value) === 0),
    entities: buildEntityIndex(input),
    errors,
    filters: cleanRecord(input.filters || {}),
    globalContext: buildGlobalContext(input),
    intelligence: filterAdminAIIntelligenceContext(input.intelligence, isOwner, permissions),
    isOwner,
    lastUpdated: cleanText(input.lastUpdated, 64),
    loadingState: input.loading,
    knowledge: buildKnowledge(knowledgeDocuments),
    knowledgeIndex: indexAdminAIKnowledge(knowledgeDocuments, { now: input.lastUpdated }),
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
    warnings
  };
}

export function buildAdminAIIntelligenceContext(input: {
  analyticsStatus: string;
  builderInspection?: AdminAIBuilderInspectionInput | null;
  calculatedAt: string;
  coachSites: CoachSiteRecord[];
  errorReportStatus: string;
  errorReports: AdminErrorReport[];
  operational?: AdminAIOperationalContext;
  shop?: AdminAIShopSnapshot | null;
  table?: AdminAITableContext | null;
  timeSeries: AnalyticsTimeSeriesPoint[];
}): AdminAIIntelligenceContext & { anomalyAnalysis: AdminAIAnomalyAnalysis } {
  const calculatedAt = validIsoTimestamp(input.calculatedAt) || new Date().toISOString();
  const errorReports = input.errorReports.slice(0, 200).map((report) => ({
    affectedEntity: cleanText(report.coachSlug || report.pagePath || "Admin operation", 160),
    createdAt: validIsoTimestamp(report.createdAt) || calculatedAt,
    errorCode: cleanText(report.errorCode || report.category.replace(/\s+/g, "_"), 80),
    module: "error-reports",
    referenceId: cleanText(report.referenceId, 80),
    route: safeRoute(report.pagePath),
    safeMessage: cleanText(report.safeMessage, 500),
    severity: report.severity,
    status: report.status,
    statusTrusted: true,
    sourceFiles: [],
    sourceFilesTrusted: false,
    updatedAt: validIsoTimestamp(report.updatedAt || report.createdAt) || calculatedAt
  }));
  const analyticsPoints = input.timeSeries.slice(0, 240).map((point) => ({
    bucketEnd: point.bucketEnd,
    bucketStart: point.bucketStart,
    currentRegistrationClicks: finite(point.registerClicks),
    currentVisits: finite(point.currentVisits),
    previousRegistrationClicks: finite(point.previousRangeRegisterClicks),
    previousVisits: finite(point.previousRangeVisits),
    source: cleanText(point.source || input.analyticsStatus, 120),
    sourceAttributed: false
  }));
  const healthEvidence = buildAdminAIHealthEvidence({
    analyticsStatus: input.analyticsStatus,
    calculatedAt,
    coachSites: input.coachSites,
    errorReports: input.errorReports,
    operational: input.operational,
    shop: input.shop
  });

  return {
    analyticsPoints,
    anomalyAnalysis: analyzeAdminAIAnomalies({
      histories: buildAdminAIAnomalyHistories({
        healthEvidence,
        operational: input.operational,
        timeSeries: input.timeSeries
      })
    }),
    builderInspection: input.builderInspection || null,
    errorReports,
    healthEvidence,
    healthScore: buildAdminAIHealthScoreInput({
      analyticsStatus: input.analyticsStatus,
      calculatedAt,
      coachSites: input.coachSites,
      errorReportStatus: input.errorReportStatus,
      errorReports: input.errorReports,
      operational: input.operational,
      shop: input.shop
    }),
    table: input.table || null
  };
}

function buildAdminAIAnomalyHistories(input: {
  healthEvidence: readonly AdminAIHealthEvidenceInput[];
  operational?: AdminAIOperationalContext;
  timeSeries: readonly AnalyticsTimeSeriesPoint[];
}): AdminAIAnomalyHistoryInput[] {
  return [
    ...buildAnalyticsAnomalyHistories(input.timeSeries),
    ...buildHealthAnomalyHistories(input.healthEvidence),
    ...buildAdminEditAnomalyHistory(input.operational)
  ];
}

function buildAnalyticsAnomalyHistories(
  timeSeries: readonly AnalyticsTimeSeriesPoint[]
): AdminAIAnomalyHistoryInput[] {
  const definitions = [
    {
      affectedEntity: "Analytics traffic",
      category: "unexpected-traffic-drop",
      direction: "decrease",
      metric: (point: AnalyticsTimeSeriesPoint) => ({
        current: finite(point.currentVisits),
        label: "visits",
        previous: finite(point.previousRangeVisits)
      })
    },
    {
      affectedEntity: "Registration clicks",
      category: "click-spike",
      direction: "increase",
      metric: (point: AnalyticsTimeSeriesPoint) => ({
        current: finite(point.registerClicks),
        label: "registration clicks",
        previous: finite(point.previousRangeRegisterClicks)
      })
    },
    {
      affectedEntity: "Registration conversion",
      category: "conversion-collapse",
      direction: "decrease",
      metric: (point: AnalyticsTimeSeriesPoint) => ({
        current:
          point.currentVisits > 0
            ? Math.round((point.registerClicks / point.currentVisits) * 10_000) / 100
            : 0,
        label: "registration conversion percent",
        previous:
          point.previousRangeVisits > 0
            ? Math.round((point.previousRangeRegisterClicks / point.previousRangeVisits) * 10_000) /
              100
            : 0
      })
    }
  ] as const;

  return definitions.flatMap((definition) => {
    const candidates = timeSeries
      .map((point) => {
        const metric = definition.metric(point);
        const bucketStart = validIsoTimestamp(point.bucketStart);
        const bucketEnd = validIsoTimestamp(point.bucketEnd);
        if (!bucketStart || !bucketEnd || metric.previous <= 0 || metric.current < 0) return null;
        const signedDeviation = ((metric.current - metric.previous) / metric.previous) * 100;
        return {
          bucketEnd,
          bucketStart,
          directionalDeviation:
            definition.direction === "increase" ? signedDeviation : -signedDeviation,
          metric,
          source: cleanText(point.source || "analytics-events", 120)
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort(
        (left, right) =>
          right.directionalDeviation - left.directionalDeviation ||
          left.bucketStart.localeCompare(right.bucketStart)
      );
    const candidate = candidates[0];
    if (!candidate) return [];

    return [
      {
        affectedEntity: definition.affectedEntity,
        baselineDescription: "Matching previous analytics range",
        baselineObservations: [
          {
            observedAt: candidate.bucketStart,
            source: candidate.source,
            summary: `Previous-range ${candidate.metric.label}: ${candidate.metric.previous}.`,
            value: candidate.metric.previous
          }
        ],
        category: definition.category,
        direction: definition.direction,
        id: `${definition.category}-${stableContextHash(candidate.bucketStart)}`,
        minimumBaselineSize: 1,
        module: "coach-analytics",
        observed: {
          observedAt: candidate.bucketEnd,
          source: candidate.source,
          summary: `Current-range ${candidate.metric.label}: ${candidate.metric.current}.`,
          value: candidate.metric.current
        },
        recommendedVerification:
          "Compare the protected raw analytics events with the current and previous aggregates.",
        thresholdPercent: 30
      }
    ];
  });
}

function buildHealthAnomalyHistories(
  healthEvidence: readonly AdminAIHealthEvidenceInput[]
): AdminAIAnomalyHistoryInput[] {
  const definitions = [
    ["failed-publishes", "repeated-publish-failure"],
    ["payment-success-publish-pending-mismatches", "payment-mismatch"],
    ["broken-public-routes", "sudden-rise-in-404-errors"],
    ["repeated-failed-otp-attempts", "repeated-otp-failure"],
    ["unusual-permission-changes", "unusual-role-change"],
    ["backup-failures", "backup-delay"],
    ["analytics-ingestion-failures", "analytics-event-interruption"]
  ] as const;

  return definitions.flatMap(([healthCategory, anomalyCategory]) => {
    const matching = healthEvidence.filter(({ category }) => category === healthCategory);
    const observations = matching
      .flatMap(({ evidence }) => evidence)
      .filter(
        (fact): fact is typeof fact & { value: number } =>
          typeof fact.value === "number" &&
          Number.isFinite(fact.value) &&
          Boolean(validIsoTimestamp(fact.observedAt))
      )
      .map((fact) => ({ ...fact, observedAt: validIsoTimestamp(fact.observedAt) }))
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    if (observations.length < 2) return [];

    const observed = observations[observations.length - 1];
    const baselineObservations = observations.slice(0, -1);
    const latestEvidence = matching[matching.length - 1];
    return [
      {
        affectedEntity: latestEvidence?.affectedEntity || healthCategory,
        baselineDescription: `Earlier numeric ${healthCategory.replace(/-/g, " ")} observations`,
        baselineObservations,
        category: anomalyCategory,
        direction: "increase",
        id: `${anomalyCategory}-${stableContextHash(observed.observedAt)}`,
        minimumBaselineSize: 3,
        module: latestEvidence?.module || "overview",
        observed,
        recommendedVerification:
          "Verify the permission-visible source records and compare the latest count with earlier observations.",
        thresholdPercent: 50
      }
    ];
  });
}

function buildAdminEditAnomalyHistory(
  operational?: AdminAIOperationalContext
): AdminAIAnomalyHistoryInput[] {
  const dailyCounts = new Map<string, { count: number; observedAt: string }>();
  (operational?.entities || [])
    .filter(
      (entity) =>
        entity.source === "admin-action-activity" && /activity$/i.test(entity.label.trim())
    )
    .forEach((entity) => {
      const observedAt = validIsoTimestamp(entity.updatedAt);
      if (!observedAt) return;
      const day = observedAt.slice(0, 10);
      const current = dailyCounts.get(day);
      dailyCounts.set(day, {
        count: (current?.count || 0) + 1,
        observedAt: !current || observedAt > current.observedAt ? observedAt : current.observedAt
      });
    });
  const observations = [...dailyCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, { count, observedAt }]) => ({
      observedAt,
      source: "admin-action-activity",
      summary: `${count} permission-visible Admin edits were recorded on ${day}.`,
      value: count
    }));
  if (observations.length < 2) return [];

  const observed = observations[observations.length - 1];
  return [
    {
      affectedEntity: "Permission-visible Admin edit activity",
      baselineDescription: "Earlier daily Admin edit counts",
      baselineObservations: observations.slice(0, -1),
      category: "unusually-frequent-admin-edits",
      direction: "increase",
      id: `unusually-frequent-admin-edits-${stableContextHash(observed.observedAt)}`,
      minimumBaselineSize: 2,
      module: "overview",
      observed,
      recommendedVerification:
        "Review the permission-visible Admin activity records before treating the increase as suspicious.",
      thresholdPercent: 100
    }
  ];
}

function buildAdminAIHealthEvidence(input: {
  analyticsStatus: string;
  calculatedAt: string;
  coachSites: CoachSiteRecord[];
  errorReports: AdminErrorReport[];
  operational?: AdminAIOperationalContext;
  shop?: AdminAIShopSnapshot | null;
}): AdminAIHealthEvidenceInput[] {
  const alerts: AdminAIHealthEvidenceInput[] = [];
  const activeSites = input.coachSites.filter(
    (site) => !["archived", "removed"].includes(site.status)
  );
  const openReports = input.errorReports.filter(
    (report) => report.status !== "Fixed" && report.status !== "Ignored"
  );
  const repeated = new Map<string, AdminErrorReport[]>();
  openReports.forEach((report) => {
    if (!/api|database|network|server/i.test(`${report.category} ${report.errorCode || ""}`))
      return;
    const key = `${report.errorCode || report.category}:${report.pagePath}`;
    repeated.set(key, [...(repeated.get(key) || []), report]);
  });
  repeated.forEach((reports, key) => {
    if (reports.length < 2) return;
    const timestamps = reports
      .map((report) => validIsoTimestamp(report.createdAt))
      .filter((value): value is string => Boolean(value))
      .sort();
    alerts.push({
      affectedEntity: reports[0].pagePath || key,
      category: "repeated-api-failures",
      directRoute: `/admin/dashboard?view=error-reports&report=${encodeURIComponent(reports[0].referenceId)}`,
      evidence: reports.slice(0, 8).map((report) => ({
        observedAt: validIsoTimestamp(report.createdAt) || input.calculatedAt,
        source: "error-reports",
        summary: `${report.referenceId}: ${cleanText(report.safeMessage, 240)}`,
        value: report.errorCode || report.category
      })),
      firstDetected: timestamps[0] || input.calculatedAt,
      id: `repeated-api-${stableContextHash(key)}`,
      impact: "The affected Admin or public operation may be unreliable.",
      lastDetected: timestamps.at(-1) || input.calculatedAt,
      module: "error-reports",
      recurrenceCount: reports.length,
      safeActionId: "error-reports.triage",
      severity: reports.some((report) => report.severity === "high") ? "high" : "medium",
      suggestedNextStep: "Open the grouped safe reports and reproduce the affected route.",
      whatHappened: "Repeated protected API failures"
    });
  });

  activeSites.forEach((site) => {
    const route = `/admin/dashboard?view=coach-sites&site=${encodeURIComponent(site.id)}`;
    if (!site.googleFormUrl.trim()) {
      alerts.push(
        healthAlert({
          affectedEntity: site.coachName || site.slug,
          calculatedAt: input.calculatedAt,
          category: "missing-registration-links",
          id: `missing-registration-${site.id}`,
          impact: "Visitors cannot reach the required registration destination.",
          route,
          severity: site.status === "published" ? "high" : "medium",
          source: "coach-sites",
          summary: `${site.status} site ${site.slug} has no registration URL.`,
          value: site.status,
          whatHappened: "Registration link is missing"
        })
      );
    } else if (!isSafeHttpsUrl(site.googleFormUrl)) {
      alerts.push(
        healthAlert({
          affectedEntity: site.coachName || site.slug,
          calculatedAt: input.calculatedAt,
          category: "invalid-cta-links",
          id: `invalid-cta-${site.id}`,
          impact: "The registration CTA may fail or route visitors unsafely.",
          route,
          severity: "high",
          source: "coach-sites",
          summary: `${site.status} site ${site.slug} has a non-HTTPS or invalid registration URL.`,
          value: site.status,
          whatHappened: "Registration CTA link is invalid"
        })
      );
    }

    const updatedAt = validIsoTimestamp(site.updatedAt || site.createdAt);
    if (
      site.status === "draft" &&
      updatedAt &&
      Date.parse(input.calculatedAt) - Date.parse(updatedAt) >= 30 * 24 * 60 * 60 * 1000
    ) {
      alerts.push(
        healthAlert({
          affectedEntity: site.coachName || site.slug,
          calculatedAt: input.calculatedAt,
          category: "stale-drafts",
          firstDetected: updatedAt,
          id: `stale-draft-${site.id}`,
          impact: "Old unfinished records can hide abandoned or blocked launch work.",
          route,
          severity: "low",
          source: "coach-sites",
          summary: `Draft ${site.slug} has not been updated since ${updatedAt}.`,
          value: updatedAt,
          whatHappened: "Coach-site draft is stale"
        })
      );
    }

    const analyticsAt = validIsoTimestamp(site.analytics?.lastUpdated);
    if (
      site.status === "published" &&
      (!analyticsAt ||
        Date.parse(input.calculatedAt) - Date.parse(analyticsAt) >= 30 * 24 * 60 * 60 * 1000)
    ) {
      alerts.push(
        healthAlert({
          affectedEntity: site.coachName || site.slug,
          calculatedAt: input.calculatedAt,
          category: "sites-without-recent-analytics",
          firstDetected: analyticsAt || input.calculatedAt,
          id: `analytics-stale-${site.id}`,
          impact: "Performance conclusions for this published site may be incomplete.",
          route,
          severity: "medium",
          source: "coach-sites",
          summary: analyticsAt
            ? `Published site ${site.slug} has no analytics refresh since ${analyticsAt}.`
            : `Published site ${site.slug} has no analytics refresh timestamp.`,
          value: analyticsAt || "missing",
          whatHappened: "Published site lacks recent analytics"
        })
      );
    }
  });

  if (/unavailable|error|failed/i.test(input.analyticsStatus)) {
    alerts.push(
      healthAlert({
        affectedEntity: "analytics-events",
        calculatedAt: input.calculatedAt,
        category: "analytics-ingestion-failures",
        id: "analytics-source-unavailable",
        impact: "Current analytics and trend explanations may be unavailable.",
        route: "/admin/dashboard?view=coach-analytics",
        severity: "high",
        source: "analytics-events",
        summary: `Analytics source status is ${cleanText(input.analyticsStatus, 80)}.`,
        value: input.analyticsStatus,
        whatHappened: "Analytics source is unavailable"
      })
    );
  }

  input.shop?.records?.forEach((record) => {
    const state = `${record.status} ${record.workflowStage}`;
    const observedAt = validIsoTimestamp(record.updatedAt) || input.calculatedAt;
    if (/publish/i.test(state) && /fail|error/i.test(state)) {
      alerts.push(
        healthAlert({
          affectedEntity: record.label || record.id,
          calculatedAt: input.calculatedAt,
          category: "failed-publishes",
          firstDetected: observedAt,
          id: `failed-publish-${record.id}`,
          impact: "A paid or requested site may not be publicly available.",
          route: "/admin/dashboard?view=shop",
          severity: "high",
          source: "shop",
          summary: `${record.label} is ${record.status} at ${record.workflowStage}.`,
          value: record.workflowStage,
          whatHappened: "Shop publish workflow failed"
        })
      );
    } else if (
      /paid|success/i.test(record.status) &&
      /publish.*pending|pending.*publish/i.test(state)
    ) {
      alerts.push(
        healthAlert({
          affectedEntity: record.label || record.id,
          calculatedAt: input.calculatedAt,
          category: "payment-success-publish-pending-mismatches",
          firstDetected: observedAt,
          id: `payment-publish-${record.id}`,
          impact: "Payment succeeded while the purchased site is still pending publication.",
          route: "/admin/dashboard?view=shop",
          severity: "critical",
          source: "shop",
          summary: `${record.label} is ${record.status} at ${record.workflowStage}.`,
          value: record.workflowStage,
          whatHappened: "Payment succeeded but publishing remains pending"
        })
      );
    }
  });

  return [...alerts, ...(input.operational?.healthEvidence || [])].slice(0, 100);
}

function buildAdminAIHealthScoreInput(input: {
  analyticsStatus: string;
  calculatedAt: string;
  coachSites: CoachSiteRecord[];
  errorReportStatus: string;
  errorReports: AdminErrorReport[];
  operational?: AdminAIOperationalContext;
  shop?: AdminAIShopSnapshot | null;
}): AdminAIHealthScoreInput {
  const dimensions: AdminAIHealthScoreDimensionInput[] = [];
  const activeSites = input.coachSites.filter(
    (site) => !["archived", "removed"].includes(site.status)
  );
  if (activeSites.length) {
    const completeSites = activeSites.filter(
      (site) =>
        site.coachName.trim() &&
        site.niche.trim() &&
        site.slug.trim() &&
        site.bio.trim() &&
        site.vision.trim() &&
        isSafeHttpsUrl(site.googleFormUrl)
    ).length;
    const score = Math.round((completeSites / activeSites.length) * 10000) / 100;
    dimensions.push(
      scoreDimension(
        "data-completeness",
        score,
        `Complete active coach sites (${completeSites}) divided by active coach sites (${activeSites.length}), multiplied by 100.`,
        input.calculatedAt,
        "coach-sites",
        [
          ["Complete active coach sites", completeSites],
          ["Active coach sites", activeSites.length]
        ],
        ["Complete required coach, niche, slug, bio, vision, and HTTPS registration fields."]
      )
    );

    const healthySites = activeSites.filter(
      (site) =>
        isSafeHttpsUrl(site.googleFormUrl) &&
        (site.heroMediaType === "none" ||
          (site.heroMediaType === "image" && Boolean((site.photoUrl || site.logoUrl).trim())) ||
          (site.heroMediaType === "video" && Boolean(site.videoUrl.trim())))
    ).length;
    dimensions.push(
      scoreDimension(
        "site-health",
        Math.round((healthySites / activeSites.length) * 10000) / 100,
        `Sites with a valid HTTPS registration link and ready selected media (${healthySites}) divided by active sites (${activeSites.length}), multiplied by 100.`,
        input.calculatedAt,
        "coach-sites",
        [
          ["Healthy active sites", healthySites],
          ["Active coach sites", activeSites.length]
        ],
        ["Fix invalid registration links and missing selected media."]
      )
    );
  }

  if (input.shop && (input.shop.siteCount > 0 || input.shop.failedPublishCount > 0)) {
    const denominator = Math.max(1, input.shop.siteCount + input.shop.failedPublishCount);
    dimensions.push(
      scoreDimension(
        "publish-health",
        Math.max(
          0,
          Math.round(((denominator - input.shop.failedPublishCount) / denominator) * 10000) / 100
        ),
        `Shop site count plus failed publishes forms the observed publish total; failures reduce that ratio.`,
        input.calculatedAt,
        "shop",
        [
          ["Shop sites", input.shop.siteCount],
          ["Failed publishes", input.shop.failedPublishCount]
        ],
        ["Review failed Shop publish records and verify the public result."]
      )
    );
  }
  if (input.shop && (input.shop.paidCount > 0 || input.shop.failedPublishCount > 0)) {
    const denominator = Math.max(1, input.shop.paidCount);
    dimensions.push(
      scoreDimension(
        "payment-reconciliation",
        Math.max(
          0,
          Math.round(((denominator - input.shop.failedPublishCount) / denominator) * 10000) / 100
        ),
        `Paid records without a reported publish failure divided by paid records, multiplied by 100.`,
        input.calculatedAt,
        "shop",
        [
          ["Paid records", input.shop.paidCount],
          ["Payment/publish failures", input.shop.failedPublishCount]
        ],
        ["Resolve payment-success and publish-pending mismatches."]
      )
    );
  }

  if (!/loading|not-configured/i.test(input.analyticsStatus)) {
    const failed = /unavailable|error|failed/i.test(input.analyticsStatus);
    dimensions.push(
      scoreDimension(
        "analytics-reliability",
        failed ? 0 : 100,
        "The current protected analytics source read is scored as 100 when available and 0 when it explicitly failed.",
        input.calculatedAt,
        "analytics-events",
        [["Analytics source status", input.analyticsStatus]],
        ["Restore the protected analytics source and verify a current event read."]
      )
    );
  }

  if (!/loading|not-configured/i.test(input.errorReportStatus)) {
    const open = input.errorReports.filter(
      (report) => report.status !== "Fixed" && report.status !== "Ignored"
    ).length;
    const denominator = Math.max(1, input.errorReports.length);
    dimensions.push(
      scoreDimension(
        "error-backlog",
        Math.max(0, Math.round(((denominator - open) / denominator) * 10000) / 100),
        "Resolved or ignored reports divided by all current permission-visible reports, multiplied by 100.",
        input.calculatedAt,
        "error-reports",
        [
          ["Open reports", open],
          ["All reports", input.errorReports.length]
        ],
        ["Triage open reports and verify fixes before marking them resolved."]
      )
    );
  }

  dimensions.push(...(input.operational?.scoreDimensions || []));
  const supplied = new Map(dimensions.map((dimension) => [dimension.dimension, dimension]));
  return {
    calculatedAt: input.calculatedAt,
    dimensions: ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(
      ({ id, label }) =>
        supplied.get(id) ||
        missingScoreDimension(id, `${label} source data is unavailable in the current context.`)
    )
  };
}

function scoreDimension(
  dimension: AdminAIHealthScoreDimensionInput["dimension"],
  score: number,
  calculation: string,
  observedAt: string,
  source: string,
  values: Array<[string, number | string]>,
  howToImprove: string[]
): AdminAIHealthScoreDimensionInput {
  return {
    calculation,
    dimension,
    exactInputs: values.map(([label, value]) => ({ label, observedAt, source, value })),
    howToImprove,
    missingInputs: [],
    score,
    weight: 1
  };
}

function missingScoreDimension(
  dimension: AdminAIHealthScoreDimensionInput["dimension"],
  missingInput: string
): AdminAIHealthScoreDimensionInput {
  return {
    calculation: "",
    dimension,
    exactInputs: [],
    howToImprove: [`Provide verified ${dimension.replace(/-/g, " ")} source data.`],
    missingInputs: [missingInput],
    score: null,
    weight: 1
  };
}

function healthAlert(input: {
  affectedEntity: string;
  calculatedAt: string;
  category: AdminAIHealthEvidenceInput["category"];
  firstDetected?: string;
  id: string;
  impact: string;
  route: string;
  severity: AdminAIHealthEvidenceInput["severity"];
  source: string;
  summary: string;
  value: boolean | number | string;
  whatHappened: string;
}): AdminAIHealthEvidenceInput {
  return {
    affectedEntity: input.affectedEntity,
    category: input.category,
    directRoute: input.route,
    evidence: [
      {
        observedAt: input.calculatedAt,
        source: input.source,
        summary: input.summary,
        value: input.value
      }
    ],
    firstDetected: input.firstDetected || input.calculatedAt,
    id: input.id,
    impact: input.impact,
    lastDetected: input.calculatedAt,
    module: input.source,
    recurrenceCount: 1,
    safeActionId:
      input.source === "coach-sites"
        ? "coach-sites.find-problems"
        : input.source === "shop"
          ? "shop.recovery-review"
          : input.source === "analytics-events"
            ? "coach-analytics.find-problems"
            : null,
    severity: input.severity,
    suggestedNextStep:
      input.source === "shop"
        ? "Open Shop recovery review and verify payment and publish state."
        : input.source === "analytics-events"
          ? "Open Coach Analytics and verify the current protected source."
          : "Open the affected coach site and verify the allowlisted facts.",
    whatHappened: input.whatHappened
  };
}

function validIsoTimestamp(value: string | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(value).toISOString();
}

function safeRoute(value: string) {
  const route = cleanText(value || "", 240);
  return route.startsWith("/") && !route.startsWith("//") ? route : "";
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function stableContextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function scopeAdminAIContext(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  selectedRows: string[] = []
): AdminAISectionContext {
  const isOwner =
    context.isOwner === true ||
    (context.isOwner === undefined && context.userRole.trim().toLowerCase() === "owner");
  const permissions = new Set(context.permissions);
  const scoped =
    scope === "global"
      ? { ...context, ...context.globalContext, sectionName: "Global Admin" }
      : context;
  const requestedSelection = Array.from(
    new Set(
      cleanList(
        scope === "global"
          ? []
          : scope === "selection" && selectedRows.length
            ? selectedRows
            : context.selectedRows,
        40
      )
    )
  );
  const requestedIds = new Set(requestedSelection.map((value) => value.toLowerCase()));
  const sectionEntities = context.entities.filter((entity) =>
    isAdminAIEntityRelevantToSection(entity, context.sectionId)
  );
  const entities =
    scope === "global"
      ? context.entities
      : scope === "selection"
        ? context.entities.filter(
            (entity) =>
              requestedIds.has(entity.id.toLowerCase()) ||
              requestedIds.has(entity.label.toLowerCase())
          )
        : sectionEntities;
  const entityIds = new Set(entities.map(({ id }) => id.toLowerCase()));
  const entityLabels = new Set(entities.map(({ label }) => label.toLowerCase()));
  const boundedSelection = requestedSelection.filter(
    (value) => entityIds.has(value.toLowerCase()) || entityLabels.has(value.toLowerCase())
  );
  const permissionFilteredIntelligence = filterAdminAIIntelligenceContext(
    scoped.intelligence,
    isOwner,
    permissions
  );
  const selectedFromCurrentSection =
    entities.length > 0 &&
    entities.every((entity) => isAdminAIEntityRelevantToSection(entity, context.sectionId));
  const errors =
    scope === "global"
      ? scoped.errors
      : scope === "selection"
        ? filterAdminAIContextErrors([...context.errors, ...context.globalContext.errors], entities)
        : filterAdminAIContextErrors(context.errors, entities, [context.sectionId]);

  return {
    ...scoped,
    analyticsSeries:
      scope !== "selection" &&
      (scope === "global" ||
        context.sectionId === "overview" ||
        context.sectionId === "coach-analytics" ||
        context.sectionId === "top-coaches") &&
      canViewAdminAIIntelligenceSource("analytics-events", isOwner, permissions)
        ? scoped.analyticsSeries
        : [],
    emptyState: scope === "selection" ? entities.length === 0 : scoped.emptyState,
    entities,
    errors,
    filters:
      scope === "global" || (scope === "selection" && !selectedFromCurrentSection)
        ? {}
        : context.filters,
    intelligence: scopeAdminAIIntelligence(
      permissionFilteredIntelligence,
      scope,
      context.sectionId,
      entities
    ),
    selectedRows: scope === "global" ? [] : boundedSelection,
    visibleDataSummary:
      scope === "selection"
        ? entities.slice(0, MAX_CONTEXT_ITEMS).map(({ label, source, status }) => ({
            label,
            source,
            value: status
          }))
        : scoped.visibleDataSummary,
    warnings: scope === "selection" ? [] : scoped.warnings
  };
}

function isAdminAIEntityRelevantToSection(entity: AdminAIEntity, sectionId: AdminV2ViewId) {
  if (sectionId === "overview") return entity.module === "overview";
  return isAdminAIModuleRelevantToSection(entity.module, sectionId);
}

function isAdminAIModuleRelevantToSection(module: string, sectionId: AdminV2ViewId) {
  const key = normalizeAdminAIContextKey(module);
  const sectionKey = normalizeAdminAIContextKey(sectionId);
  if (key === sectionKey || sectionId === "overview") return true;
  if (sectionId === "coach-analytics" || sectionId === "top-coaches") {
    return key.includes("analytics") || key === "top coaches";
  }
  if (sectionId === "create-coach-site") {
    return key.includes("coach site") || key.includes("builder") || key.includes("website");
  }
  if (sectionId === "coach-sites") return key.includes("coach site");
  if (sectionId === "error-reports") return key.includes("error report");
  if (sectionId === "backup-cleanup") return key.includes("backup") || key.includes("cleanup");
  if (sectionId === "paid-masterclass-settings") {
    return key.includes("masterclass") || key.includes("payment");
  }
  if (sectionId === "admin-users") return key.includes("admin user") || key === "users";
  if (sectionId === "settings") return key.includes("setting") || key.includes("security");
  return sectionId === "shop" && key.includes("shop");
}

function filterAdminAIContextErrors(
  errors: readonly string[],
  entities: readonly AdminAIEntity[],
  fallbackModules: readonly AdminV2ViewId[] = []
) {
  const keys = new Set(
    [
      ...fallbackModules,
      ...entities.flatMap(({ id, label, module, source }) => [id, label, module, source])
    ]
      .map(normalizeAdminAIContextKey)
      .filter((value) => value.length > 2)
  );
  return cleanList(
    Array.from(new Set(errors)).filter((error) => {
      const normalized = normalizeAdminAIContextKey(error);
      return Array.from(keys).some((key) => normalized.includes(key));
    }),
    MAX_CONTEXT_ITEMS
  );
}

function normalizeAdminAIContextKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isAdminAIContextFactRelatedToEntities(
  values: readonly string[],
  entities: readonly AdminAIEntity[]
) {
  const entityKeys = entities
    .flatMap(({ id, label }) => [id, label])
    .map(normalizeAdminAIContextKey)
    .filter((value) => value.length > 2);
  const factKeys = values.map(normalizeAdminAIContextKey).filter((value) => value.length > 2);
  return entityKeys.some((entityKey) =>
    factKeys.some((factKey) => factKey.includes(entityKey) || entityKey.includes(factKey))
  );
}

function scopeAdminAIIntelligence(
  intelligence: AdminAIIntelligenceContext | undefined,
  scope: AdminAIScope,
  sectionId: AdminV2ViewId,
  entities: readonly AdminAIEntity[]
): AdminAIIntelligenceContext | undefined {
  if (!intelligence || scope === "global") return intelligence;

  const selectedIds = new Set(entities.map(({ id }) => id.toLowerCase()));
  const errorReports =
    scope === "selection"
      ? intelligence.errorReports.filter(({ referenceId }) =>
          selectedIds.has(referenceId.toLowerCase())
        )
      : sectionId === "error-reports"
        ? intelligence.errorReports
        : [];
  const healthEvidence = intelligence.healthEvidence.filter((item) =>
    scope === "selection"
      ? isAdminAIContextFactRelatedToEntities(
          [item.id, item.affectedEntity, item.directRoute],
          entities
        )
      : isAdminAIModuleRelevantToSection(item.module, sectionId)
  );
  const healthScore = {
    ...intelligence.healthScore,
    dimensions: intelligence.healthScore.dimensions.filter((dimension) =>
      scope === "selection"
        ? isAdminAIContextFactRelatedToEntities(
            dimension.exactInputs.map(({ label }) => label),
            entities
          )
        : dimension.exactInputs.some(({ source }) =>
            isAdminAIModuleRelevantToSection(source, sectionId)
          )
    )
  };
  const anomalyAnalysis = intelligence.anomalyAnalysis
    ? {
        ...intelligence.anomalyAnalysis,
        anomalies:
          scope === "selection"
            ? []
            : intelligence.anomalyAnalysis.anomalies.filter(({ module }) =>
                isAdminAIModuleRelevantToSection(module, sectionId)
              )
      }
    : undefined;

  return {
    ...intelligence,
    analyticsPoints:
      scope !== "selection" &&
      (sectionId === "overview" || sectionId === "coach-analytics" || sectionId === "top-coaches")
        ? intelligence.analyticsPoints
        : [],
    anomalyAnalysis,
    builderInspection: sectionId === "create-coach-site" ? intelligence.builderInspection : null,
    errorReports,
    healthEvidence,
    healthScore,
    table:
      scope === "selection"
        ? intelligence.table
          ? {
              ...intelligence.table,
              rows: intelligence.table.rows.filter(({ id }) => selectedIds.has(id.toLowerCase())),
              selectedIds: intelligence.table.selectedIds.filter((id) =>
                selectedIds.has(id.toLowerCase())
              )
            }
          : null
        : intelligence.table &&
            (intelligence.table.tableId === sectionId ||
              (sectionId === "top-coaches" && intelligence.table.tableId === "coach-analytics"))
          ? intelligence.table
          : null
  };
}

function filterAdminAIIntelligenceContext(
  intelligence: AdminAIIntelligenceContext | undefined,
  isOwner: boolean,
  permissions: ReadonlySet<string>
): AdminAIIntelligenceContext | undefined {
  if (!intelligence || isOwner) return intelligence;

  const canView = (source: string) => canViewAdminAIIntelligenceSource(source, false, permissions);
  const analyticsPoints = canView("analytics-events") ? intelligence.analyticsPoints : [];
  const builderInspection = canView("create-coach-site") ? intelligence.builderInspection : null;
  const errorReports = canView("error-reports") ? intelligence.errorReports : [];
  const healthEvidence = intelligence.healthEvidence.filter(({ module }) => canView(module));
  const healthScore = {
    ...intelligence.healthScore,
    dimensions: intelligence.healthScore.dimensions.map((dimension) => {
      const allowed =
        dimension.exactInputs.length === 0 ||
        dimension.exactInputs.every(({ source }) => canView(source));
      return allowed
        ? dimension
        : {
            ...dimension,
            calculation: "",
            exactInputs: [],
            howToImprove: [],
            missingInputs: ["Source data is not available in this permission scope."],
            score: null
          };
    })
  };
  const anomalyAnalysis = intelligence.anomalyAnalysis
    ? {
        ...intelligence.anomalyAnalysis,
        anomalies: intelligence.anomalyAnalysis.anomalies.filter(({ module }) => canView(module))
      }
    : undefined;
  const table =
    intelligence.table && canView(intelligence.table.tableId) ? intelligence.table : null;
  const filtered: AdminAIIntelligenceContext = {
    analyticsPoints,
    anomalyAnalysis,
    builderInspection,
    errorReports,
    healthEvidence,
    healthScore,
    table
  };
  const hasPermissionVisibleData =
    analyticsPoints.length > 0 ||
    Boolean(builderInspection) ||
    errorReports.length > 0 ||
    healthEvidence.length > 0 ||
    healthScore.dimensions.some(
      ({ exactInputs, score }) => exactInputs.length > 0 || score !== null
    ) ||
    Boolean(table) ||
    Boolean(anomalyAnalysis?.anomalies.length);

  return hasPermissionVisibleData ? filtered : undefined;
}

function canViewAdminAIIntelligenceSource(
  source: string,
  isOwner: boolean,
  permissions: ReadonlySet<string>
) {
  if (isOwner) return true;
  const key = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const can = (...required: string[]) => required.some((permission) => permissions.has(permission));

  if (key.includes("admin-user") || key.includes("permission") || key.includes("otp")) {
    return false;
  }
  if (key.includes("analytics") || key === "top-coaches") {
    return can("coach_analytics.view", "coach_analytics.top_performers");
  }
  if (key.includes("error-report")) return can("error_reports.view");
  if (key.includes("backup") || key.includes("cleanup")) return can("backup_cleanup.view");
  if (key.includes("shop")) return can("shop.view", "shop.recovery", "shop.reports");
  if (key.includes("payment") || key.includes("masterclass")) {
    return can("paid_masterclass.view_settings");
  }
  if (key.includes("create-coach-site") || key.includes("builder") || key.includes("website")) {
    return can("website_creator.create");
  }
  if (key.includes("coach-site")) return can("coach_sites.view");
  if (key.includes("setting") || key.includes("security-configuration")) {
    return can("settings.view");
  }
  if (key.includes("overview") || key.includes("admin-action-activity")) {
    return can("overview.view");
  }
  return false;
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
    warnings: buildGlobalWarnings(input)
  };
}

function buildRegisteredActionViews(commands: AdminAICommand[]): AdminAIRegisteredActionView[] {
  return commands.slice(0, 80).map((command) => ({
    id: command.id,
    label: cleanText(command.label, 80),
    relatedAPI: getAdminAISection(command.sectionId).relatedAPIs[0] || null,
    requiredPermissions: cleanList(command.requiredPermissions || [], 20),
    searchText: cleanText(
      `${command.id} ${command.label} ${command.description}`.toLowerCase(),
      320
    ),
    type: command.type
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
      const formReadiness = !site.googleFormUrl.trim()
        ? "missing"
        : isSafeHttpsUrl(site.googleFormUrl)
          ? "ready"
          : "invalid";
      const imageReadiness = `${site.photoUrl || ""}${site.logoUrl || ""}`.trim()
        ? "ready"
        : site.heroMediaType === "image"
          ? "missing"
          : "unverified";
      entities.push({
        id: cleanText(site.id || site.slug, 120),
        label: cleanText(site.coachName || site.slug, 120),
        matchReason: missingLink
          ? "Coach site is missing a registration destination."
          : `Coach site status is ${site.status}.`,
        module: "coach-sites",
        route: `/admin/dashboard?view=coach-sites&coach=${encodeURIComponent(site.slug)}`,
        searchableText: cleanText(
          [
            site.coachName,
            site.slug,
            site.niche,
            site.location,
            site.status,
            missingLink ? "missing registration link" : "registration ready",
            `registration form ${formReadiness}`,
            `images ${imageReadiness}`
          ]
            .join(" ")
            .toLowerCase(),
          500
        ),
        source: "coach-sites",
        status: site.status,
        updatedAt: safeTimestamp(site.updatedAt || site.publishedAt || site.createdAt)
      });
    });
  }

  if (can("coach_analytics.view") || can("coach_analytics.top_performers")) {
    input.analytics.slice(0, 200).forEach((row) => {
      entities.push({
        id: getAdminAIAnalyticsEntityId(row),
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
        updatedAt: safeTimestamp(row.lastActivity)
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
            report.errorCode || ""
          ]
            .join(" ")
            .toLowerCase(),
          500
        ),
        source: "error-reports",
        status: `${report.severity} / ${report.status}`,
        updatedAt: safeTimestamp(report.updatedAt || report.createdAt)
      });
    });
  }

  if (can("shop.view") || can("shop.recovery") || can("shop.reports")) {
    (input.shop?.records || []).slice(0, 120).forEach((record) => {
      entities.push({
        id: cleanText(record.id, 120),
        label: cleanText(record.label, 120),
        matchReason: cleanText(
          `Shop workflow stage ${record.workflowStage}; status ${record.status}.`,
          180
        ),
        module: "shop",
        route: `/admin/dashboard?view=shop&order=${encodeURIComponent(record.id)}`,
        searchableText: cleanText(
          `${record.label} ${record.id} ${record.status} ${record.workflowStage}`.toLowerCase(),
          500
        ),
        source: "shop",
        status: record.status,
        updatedAt: safeTimestamp(record.updatedAt)
      });
    });
  }

  (input.operational?.entities || []).forEach((entity) => {
    if (!canViewOperationalEntity(entity.module, owner, can)) return;
    entities.push(entity);
  });

  return entities.slice(0, 500);
}

function canViewOperationalEntity(
  module: AdminV2ViewId,
  owner: boolean,
  can: (permission: string) => boolean
) {
  if (module === "admin-users") return owner;
  if (module === "backup-cleanup") return can("backup_cleanup.view");
  if (module === "coach-analytics" || module === "top-coaches")
    return can("coach_analytics.view") || can("coach_analytics.top_performers");
  if (module === "coach-sites") return can("coach_sites.view");
  if (module === "create-coach-site") return can("website_creator.create");
  if (module === "error-reports") return can("error_reports.view");
  if (module === "paid-masterclass-settings") return can("paid_masterclass.view_settings");
  if (module === "settings") return can("settings.view");
  if (module === "shop") return can("shop.view") || can("shop.recovery") || can("shop.reports");
  return can("overview.view");
}

function buildKnowledgeDocuments(input: BuildAdminAIContextInput): AdminAIKnowledgeDocument[] {
  const owner = Boolean(input.profile?.isOwner);
  const permissions = new Set(input.profile?.permissions || []);
  return [
    knowledgeDocument(
      "copilot-safety",
      "admin-documentation",
      "Admin Copilot safety boundary",
      "Only registered actions are available. RBAC, validation, confirmation, OTP, and mutation execution stay outside the model.",
      "Admin Copilot specification",
      "Sections 7-9, 18-19, 44 and 52-53"
    ),
    knowledgeDocument(
      "platform-rules",
      "platform-rules",
      "Admin platform operating rules",
      "Loaded production records and protected server workflows are authoritative. Missing data must stay missing instead of being invented.",
      "Admin V2 production rules",
      "Grounding and production boundaries"
    ),
    knowledgeDocument(
      "publish-rules",
      "website-builder-rules",
      "Website publish rules",
      "Existing required-field validation, preview checks, and protected publish logic remain authoritative. Copilot may inspect and prepare but cannot bypass them.",
      "Website Creator production rules",
      "Publish validation",
      ["website_creator.create"]
    ),
    knowledgeDocument(
      "payment-rules",
      "payment-publish-rules",
      "Payment and publish reconciliation",
      "Server-side payment status is authoritative. Copilot never reads payment credentials and can only prepare registered recovery workflows.",
      "Shop payment and publish rules",
      "Reconciliation",
      ["shop.view"]
    ),
    knowledgeDocument(
      "bonus-service-rules",
      "bonus-service-rules",
      "Bonus service rules",
      "Builder bonus services must use the canonical allowed titles and production validation; Copilot suggestions cannot introduce unsupported bonus services.",
      "Canonical coach template content slots",
      "Bonus services",
      ["website_creator.create"]
    ),
    knowledgeDocument(
      "faq-rules",
      "faq-rules",
      "Website FAQ rules",
      "Published Builder content must contain the production-required complete FAQ set. Copilot can identify missing entries but cannot bypass validation.",
      "Website Creator production rules",
      "FAQ validation",
      ["website_creator.create"]
    ),
    knowledgeDocument(
      "otp-rules",
      "otp-destructive-action-rules",
      "OTP and destructive-action rules",
      "Archive, delete, role, cleanup, and other protected workflows retain their existing confirmation and OTP requirements.",
      "Admin security and OTP runbook",
      "Protected actions"
    ),
    knowledgeDocument(
      "settings-rules",
      "settings-descriptions",
      "Admin settings descriptions",
      "Settings guidance may explain loaded configuration and prepare a review, but risky changes remain registered actions with explicit confirmation.",
      "Admin settings module",
      "Configuration safety",
      ["settings.view"]
    ),
    knowledgeDocument(
      "error-resolution-rules",
      "known-error-resolutions",
      "Known error resolution rules",
      "Error investigation stays scoped to the selected permission-visible report, cites available evidence, and never claims a fix without an applied and tested change.",
      "Error Reports operating rules",
      "Investigation",
      ["error_reports.view"]
    ),
    knowledgeDocument(
      "backup-rules",
      "operational-runbooks",
      "Backup and cleanup safety",
      "Cleanup should follow a verified backup. Irreversible cleanup must be explicit and must not claim rollback support.",
      "Backup and cleanup runbook",
      "Cleanup safety",
      ["backup_cleanup.view"]
    ),
    knowledgeDocument(
      "approved-report-rules",
      "prior-approved-reports",
      "Approved report reuse rules",
      "Prior reports are historical evidence only until their source range, filters, version, and freshness are revalidated against current data.",
      "Admin report provenance rules",
      "Historical report use",
      ["overview.view"]
    ),
    knowledgeDocument(
      "product-documentation",
      "product-documentation",
      "YWcoach product documentation boundary",
      "Current module behavior, permission checks, production validation, and live source status outrank stale product guidance.",
      "YWcoach product documentation",
      "Source priority"
    ),
    knowledgeDocument(
      "role-rules",
      "platform-rules",
      "Least-privilege admin roles",
      "Restricted admins see only allowed modules and actions. Owner protection remains authoritative and a co-owner cannot remove the root owner.",
      "Admin RBAC policy",
      "Owner protection",
      ["admin_users.manage"],
      true
    )
  ].filter(
    (document) =>
      (!document.ownerOnly || owner) &&
      (owner ||
        (document.requiredPermissions || []).every((permission) => permissions.has(permission)))
  );
}

function buildKnowledge(documents: AdminAIKnowledgeDocument[]): AdminAIKnowledgeEntry[] {
  return documents.map((document) => ({
    freshness: `Version ${document.version}; effective ${document.effectiveAt}`,
    id: document.id,
    searchableText:
      `${document.category} ${document.title} ${document.section} ${document.content}`.toLowerCase(),
    source: `${document.source} · ${document.section}`,
    summary: document.content,
    title: document.title
  }));
}

function knowledgeDocument(
  id: string,
  category: AdminAIKnowledgeDocument["category"],
  title: string,
  content: string,
  source: string,
  section: string,
  requiredPermissions: string[] = [],
  ownerOnly = false
): AdminAIKnowledgeDocument {
  return {
    approved: true,
    category,
    content,
    effectiveAt: "2026-07-20T00:00:00.000Z",
    id,
    ownerOnly,
    requiredPermissions,
    section,
    source,
    title,
    version: "1.0.0"
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
    (report) =>
      report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
  ).length;

  switch (input.activeView) {
    case "coach-sites":
      return compactMetrics([
        metric("Coach sites", input.coachSites.length, "coach-sites"),
        metric("Published", published, "coach-sites"),
        metric("Draft", drafts, "coach-sites"),
        metric("Archived", archived, "coach-sites"),
        metric("Missing registration links", missingLinks, "coach-sites")
      ]);
    case "create-coach-site":
      return compactMetrics([
        metric("Current step", input.builder?.currentStep || "Not started", "website-creator"),
        metric(
          "Missing required fields",
          input.builder?.missingFields.length || 0,
          "website-creator"
        ),
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
        metric("Existing coach sites", input.coachSites.length, "coach-sites")
      ]);
    case "coach-analytics":
      return compactMetrics([
        metric("Coach rows", input.analytics.length, "analytics"),
        metric("Real chart points", input.timeSeries.length, "analytics"),
        metric("Visits", totalVisits, "analytics"),
        metric("Register clicks", registerClicks, "analytics"),
        metric("Payment success", paymentSuccess, "analytics"),
        metric("Attention signals", input.highRiskCount, "analytics")
      ]);
    case "top-coaches":
      return compactMetrics([
        metric("Coach rows", input.analytics.length, "analytics"),
        metric("Published sites", published, "coach-sites"),
        metric("Visits", totalVisits, "analytics"),
        metric("Attention signals", input.highRiskCount, "analytics")
      ]);
    case "shop":
      return compactMetrics([
        metric("Purchases", input.shop?.purchaseCount || 0, "shop"),
        metric("Paid orders", input.shop?.paidCount || 0, "shop"),
        metric("Published sites", input.shop?.siteCount || 0, "shop"),
        metric("Publish or payment failures", input.shop?.failedPublishCount || 0, "shop")
      ]);
    case "error-reports":
    case "backup-cleanup":
      return compactMetrics([
        metric("Open reports", openReports, "error-reports"),
        metric("High severity open", highReports, "error-reports"),
        metric("All loaded reports", input.errorReports.length, "error-reports"),
        metric(
          "Backup source",
          input.sourceStatuses.backupCleanup || "unavailable",
          "backup-cleanup"
        )
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
        )
      ]);
    case "settings":
    case "admin-users":
      return compactMetrics([
        metric("Assigned permissions", input.profile?.permissions?.length || 0, "admin-session"),
        metric(
          "Admin role",
          input.profile?.isOwner ? "Owner" : input.profile?.role || "Admin",
          "admin-session"
        ),
        metric(
          "Settings source",
          input.sourceStatuses.authSession || "unavailable",
          "admin-session"
        ),
        metric("Admin users source", input.sourceStatuses.users || "unavailable", "admin-users")
      ]);
    default:
      return compactMetrics(
        input.metrics
          .map((item) => metric(item.label, item.value, item.source))
          .slice(0, MAX_CONTEXT_ITEMS)
      );
  }
}

function buildGlobalVisibleSummary(input: BuildAdminAIContextInput): AdminAIVisibleMetric[] {
  const metrics: AdminAIVisibleMetric[] = [];

  if (canAccess(input, "coach_sites.view")) {
    metrics.push(
      metric("Coach sites", input.coachSites.length, "coach-sites"),
      metric(
        "Published coach sites",
        input.coachSites.filter((site) => site.status === "published").length,
        "coach-sites"
      ),
      metric(
        "Draft coach sites",
        input.coachSites.filter((site) => site.status === "draft").length,
        "coach-sites"
      ),
      metric(
        "Sites missing registration links",
        input.coachSites.filter(
          (site) =>
            site.status !== "removed" && !site.googleFormUrl.trim() && !site.whatsappLink.trim()
        ).length,
        "coach-sites"
      )
    );
  }
  if (canAccess(input, "coach_analytics.view", "coach_analytics.top_performers")) {
    metrics.push(
      metric("Coach analytics rows", input.analytics.length, "analytics"),
      metric(
        "Visits",
        sum(input.analytics, (row) => row.totalVisits),
        "analytics"
      ),
      metric(
        "Registration clicks",
        sum(input.analytics, (row) => row.registerClicks),
        "analytics"
      )
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
        input.errorReports.filter(
          (report) => report.status !== "Fixed" && report.status !== "Ignored"
        ).length,
        "error-reports"
      ),
      metric(
        "High-severity open reports",
        input.errorReports.filter(
          (report) =>
            report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
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
    if (drafts > 0)
      warnings.push(`${drafts} coach site${drafts === 1 ? " is" : "s are"} still in draft.`);
    if (missingLinks > 0) {
      warnings.push(
        `${missingLinks} active coach site${missingLinks === 1 ? " has" : "s have"} no registration link.`
      );
    }
  }
  if (
    canAccess(input, "coach_analytics.view", "coach_analytics.top_performers") &&
    input.highRiskCount > 0
  ) {
    warnings.push(
      `${input.highRiskCount} real coach performance signal${input.highRiskCount === 1 ? " needs" : "s need"} review.`
    );
  }
  if (canAccess(input, "error_reports.view")) {
    const highReports = input.errorReports.filter(
      (report) =>
        report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
    ).length;
    if (highReports > 0) {
      warnings.push(
        `${highReports} high-severity open report${highReports === 1 ? " needs" : "s need"} triage.`
      );
    }
  }
  if (
    canAccess(input, "shop.view", "shop.recovery", "shop.reports") &&
    (input.shop?.failedPublishCount || 0) > 0
  ) {
    warnings.push(
      `${input.shop?.failedPublishCount} Shop payment or publish issue${input.shop?.failedPublishCount === 1 ? " needs" : "s need"} recovery review.`
    );
  }

  return cleanList(warnings, MAX_CONTEXT_ITEMS);
}

function buildGlobalErrors(input: BuildAdminAIContextInput) {
  const sources: Array<{ id: string; permissions: string[] }> = [
    { id: "authSession", permissions: [] },
    { id: "coachSites", permissions: ["coach_sites.view"] },
    {
      id: "analyticsEvents",
      permissions: ["coach_analytics.view", "coach_analytics.top_performers"]
    },
    { id: "errorReports", permissions: ["error_reports.view"] },
    { id: "shop", permissions: ["shop.view", "shop.recovery", "shop.reports"] },
    { id: "backupCleanup", permissions: ["backup_cleanup.view"] },
    { id: "masterclassPrivateLinks", permissions: ["paid_masterclass.view_settings"] },
    { id: "masterclassSettings", permissions: ["paid_masterclass.view_settings"] },
    { id: "users", permissions: ["admin_users.manage"] }
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
    (report) =>
      report.severity === "high" && report.status !== "Fixed" && report.status !== "Ignored"
  ).length;

  if ((input.activeView === "coach-sites" || input.activeView === "overview") && drafts > 0) {
    warnings.push(`${drafts} coach site${drafts === 1 ? " is" : "s are"} still in draft.`);
  }
  if ((input.activeView === "coach-sites" || input.activeView === "overview") && missingLinks > 0) {
    warnings.push(
      `${missingLinks} active coach site${missingLinks === 1 ? " has" : "s have"} no registration link.`
    );
  }
  if (
    ["coach-analytics", "top-coaches", "overview"].includes(input.activeView) &&
    input.highRiskCount > 0
  ) {
    warnings.push(
      `${input.highRiskCount} real coach performance signal${input.highRiskCount === 1 ? " needs" : "s need"} review.`
    );
  }
  if (
    ["error-reports", "backup-cleanup", "overview"].includes(input.activeView) &&
    highReports > 0
  ) {
    warnings.push(
      `${highReports} high-severity open report${highReports === 1 ? " needs" : "s need"} triage.`
    );
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
    warnings.push(
      `${input.shop?.failedPublishCount} Shop payment or publish issue${input.shop?.failedPublishCount === 1 ? " needs" : "s need"} recovery review.`
    );
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
  if (view === "coach-analytics" || view === "top-coaches")
    return ["analyticsEvents", "coachSites"];
  if (view === "shop") return ["shop"];
  if (view === "error-reports") return ["errorReports"];
  if (view === "backup-cleanup") return ["backupCleanup", "errorReports"];
  if (view === "paid-masterclass-settings")
    return ["masterclassPrivateLinks", "masterclassSettings"];
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
    value: typeof item.value === "number" ? item.value : cleanText(item.value, 120)
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
  return values
    .map((value) => cleanText(value, 180))
    .filter(Boolean)
    .slice(0, limit);
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
