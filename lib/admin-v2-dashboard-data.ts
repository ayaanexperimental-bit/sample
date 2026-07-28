import type {
  AnalyticsAudienceRegion,
  AnalyticsDateRangeId,
  AnalyticsEventRange,
  AnalyticsMetricSummary,
  AnalyticsRecentEvent,
  AnalyticsTimeSeriesPoint
} from "./analytics-events";
import type { CoachSiteRecord } from "./admin-coach-sites";
import {
  adminControlCenterData,
  type AdminErrorReport,
  type AdminPaidMasterclassLink
} from "./admin-control-center";

export type AdminV2DataStatus = "empty" | "not-authorized" | "ready" | "unavailable";

export type AdminV2SourceResult<TData> = {
  configured?: boolean;
  data: TData | null;
  error?: string;
  httpStatus?: number;
  source?: string;
  status: AdminV2DataStatus;
};

export type AdminV2MetricCardData = {
  id: string;
  label: string;
  source: "analytics" | "coach-sites" | "error-reports";
  status: AdminV2DataStatus;
  tone: "danger" | "neutral" | "success" | "warning";
  value: number;
};

export type AdminV2SourceSummary = {
  detail: string;
  id: keyof AdminV2DashboardData["sources"];
  label: string;
  status: AdminV2DataStatus;
  tone: "danger" | "neutral" | "success" | "warning";
};

export type AdminV2RecentSignal = {
  detail: string;
  id: string;
  label: string;
  timestamp: string;
};

export type AdminV2DashboardData = {
  generatedAt: string;
  metrics: AdminV2MetricCardData[];
  recentSignals: AdminV2RecentSignal[];
  sourceSummaries: AdminV2SourceSummary[];
  sources: {
    analyticsEvents: AdminV2SourceResult<AdminV2AnalyticsEventsData>;
    authSession: AdminV2SourceResult<AdminV2AccessProfile>;
    backupCleanup: AdminV2SourceResult<unknown>;
    coachSites: AdminV2SourceResult<CoachSiteRecord[]>;
    errorReports: AdminV2SourceResult<AdminErrorReport[]>;
    masterclassPrivateLinks: AdminV2SourceResult<AdminPaidMasterclassLink[]>;
    masterclassSettings: AdminV2SourceResult<unknown>;
    shop: AdminV2SourceResult<unknown>;
    users: AdminV2SourceResult<unknown>;
  };
  status: AdminV2DataStatus;
};

export type AdminV2AnalyticsEventsData = {
  analyticsSummaries: AnalyticsMetricSummary[];
  audienceRegions: AnalyticsAudienceRegion[];
  previousAnalyticsSummaries: AnalyticsMetricSummary[];
  range: AnalyticsEventRange | null;
  recentEvents: AnalyticsRecentEvent[];
  timeSeries: AnalyticsTimeSeriesPoint[];
};

type AdminV2DashboardDataOptions = {
  adminAccess?: AdminV2AccessProfile | null;
  analyticsRange?: AnalyticsDateRangeId;
  fetcher?: typeof fetch;
};

type AdminV2AccessProfile = {
  isOwner?: boolean;
  permissions?: string[];
};

type CoachSitesPayload = {
  coachSites?: CoachSiteRecord[];
  configured?: boolean;
  ok?: boolean;
};

type AnalyticsEventsPayload = {
  analyticsSummaries?: AnalyticsMetricSummary[];
  audienceRegions?: AnalyticsAudienceRegion[];
  configured?: boolean;
  ok?: boolean;
  previousAnalyticsSummaries?: AnalyticsMetricSummary[];
  range?: AnalyticsEventRange;
  recentEvents?: AnalyticsRecentEvent[];
  source?: string;
  timeSeries?: AnalyticsTimeSeriesPoint[];
};

type ErrorReportsPayload = {
  errorReports?: AdminErrorReport[];
  persistence?: string;
};

type MasterclassPrivateLinkPayload = {
  links?: MasterclassPrivateLinkMetadata[];
  ok?: boolean;
};

type MasterclassPrivateLinkMetadata = {
  configured?: boolean;
  entryCode?: string;
  funnelId: string;
  paymentPageConfigured?: boolean;
  paymentPageStorageSource?: "d1_table" | "none";
  paymentPageUpdatedAt?: string | null;
  paymentPageUpdatedBy?: string;
  storageSource?: "d1_table" | "none";
  updatedAt?: string | null;
  updatedBy?: string;
};

export async function getAdminV2DashboardData({
  adminAccess,
  analyticsRange = "7d",
  fetcher = fetch
}: AdminV2DashboardDataOptions = {}): Promise<AdminV2DashboardData> {
  const analyticsPath = `/api/admin/analytics-events?${new URLSearchParams({
    range: analyticsRange
  }).toString()}`;

  const [
    coachSites,
    analyticsEvents,
    errorReports,
    shop,
    backupCleanup,
    users,
    masterclassPrivateLinks,
    masterclassSettings
  ] = await Promise.all([
    canAccessAdminV2Source(adminAccess, "coach_sites.view")
      ? fetchAdminV2Json<CoachSitesPayload>(fetcher, "/api/admin/coach-sites").then((result) =>
          mapSourceArray(result, (payload) => payload.coachSites || [], {
            configured: (payload) => payload.configured,
            source: (payload) => (payload.configured ? "live-database" : "not-configured")
          })
        )
      : Promise.resolve(createNotAuthorizedSource<CoachSiteRecord[]>()),
    canAccessAdminV2Source(adminAccess, "coach_analytics.view")
      ? fetchAdminV2Json<AnalyticsEventsPayload>(fetcher, analyticsPath).then((result) =>
          mapSourceObject(
            result,
            (payload) => ({
              analyticsSummaries: payload.analyticsSummaries || [],
              audienceRegions: payload.audienceRegions || [],
              previousAnalyticsSummaries: payload.previousAnalyticsSummaries || [],
              range: payload.range || null,
              recentEvents: payload.recentEvents || [],
              timeSeries: payload.timeSeries || []
            }),
            {
              configured: (payload) => payload.configured,
              isEmpty: (data) =>
                data.analyticsSummaries.length === 0 &&
                data.audienceRegions.length === 0 &&
                data.recentEvents.length === 0 &&
                data.timeSeries.length === 0,
              source: (payload) =>
                payload.source || (payload.configured ? "d1_analytics_events" : "not-configured")
            }
          )
        )
      : Promise.resolve(createNotAuthorizedSource<AdminV2AnalyticsEventsData>()),
    canAccessAdminV2Source(adminAccess, "error_reports.view")
      ? fetchAdminV2Json<ErrorReportsPayload>(fetcher, "/api/admin/error-reports").then((result) =>
          mapSourceArray(result, (payload) => payload.errorReports || [], {
            source: (payload) => payload.persistence || "unknown"
          })
        )
      : Promise.resolve(createNotAuthorizedSource<AdminErrorReport[]>()),
    canAccessAnyAdminV2Source(adminAccess, [
      "shop.view",
      "shop.payment_settings.view",
      "shop.reports"
    ])
      ? fetchAdminV2Json<unknown>(fetcher, "/api/admin/shop").then(mapUnknownSource)
      : Promise.resolve(createNotAuthorizedSource<unknown>()),
    canAccessAdminV2Source(adminAccess, "backup_cleanup.view")
      ? fetchAdminV2Json<unknown>(fetcher, "/api/admin/backup-cleanup").then(mapUnknownSource)
      : Promise.resolve(createNotAuthorizedSource<unknown>()),
    adminAccess?.isOwner
      ? fetchAdminV2Json<unknown>(fetcher, "/api/admin/users").then(mapUnknownSource)
      : Promise.resolve(createNotAuthorizedSource<unknown>()),
    canAccessAdminV2Source(adminAccess, "paid_masterclass.view_settings")
      ? fetchAdminV2Json<MasterclassPrivateLinkPayload>(
          fetcher,
          "/api/admin/masterclass-private-link"
        ).then((result) =>
          mapSourceArray(result, (payload) =>
            hydratePaidMasterclassLinks(payload.links || [])
          )
        )
      : Promise.resolve(createNotAuthorizedSource<AdminPaidMasterclassLink[]>()),
    canAccessAdminV2Source(adminAccess, "paid_masterclass.view_settings")
      ? fetchAdminV2Json<unknown>(fetcher, "/api/admin/masterclass-settings").then(mapUnknownSource)
      : Promise.resolve(createNotAuthorizedSource<unknown>())
  ]);

  const metrics = buildAdminV2MetricCards({
    analyticsEvents,
    coachSites,
    errorReports
  });
  const authSession = mapAdminAccessSource(adminAccess);
  const sources = {
    analyticsEvents,
    authSession,
    backupCleanup,
    coachSites,
    errorReports,
    masterclassPrivateLinks,
    masterclassSettings,
    shop,
    users
  };

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    recentSignals: buildAdminV2RecentSignals(analyticsEvents),
    sourceSummaries: buildAdminV2SourceSummaries(sources),
    sources,
    status: combineSourceStatus([
      authSession,
      analyticsEvents,
      backupCleanup,
      coachSites,
      errorReports,
      masterclassPrivateLinks,
      masterclassSettings,
      shop,
      users
    ])
  };
}

function hydratePaidMasterclassLinks(
  metadata: MasterclassPrivateLinkMetadata[]
): AdminPaidMasterclassLink[] {
  const metadataByFunnelId = new Map(metadata.map((item) => [item.funnelId, item]));

  return adminControlCenterData.paidMasterclassLinks.map((link) => ({
    ...link,
    ...metadataByFunnelId.get(link.funnelId)
  }));
}

async function fetchAdminV2Json<TPayload>(
  fetcher: typeof fetch,
  path: string
): Promise<AdminV2SourceResult<TPayload>> {
  try {
    const response = await fetcher(path, {
      cache: "no-store",
      credentials: "include"
    });
    const payload = (await response.json().catch(() => null)) as TPayload | null;

    if (response.status === 401 || response.status === 403) {
      return {
        data: null,
        httpStatus: response.status,
        status: "not-authorized"
      };
    }

    if (!response.ok || payload === null) {
      return {
        data: null,
        httpStatus: response.status,
        status: "unavailable"
      };
    }

    return {
      data: payload,
      httpStatus: response.status,
      status: "ready"
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Request failed.",
      status: "unavailable"
    };
  }
}

function mapSourceArray<TPayload, TItem>(
  result: AdminV2SourceResult<TPayload>,
  selectItems: (payload: TPayload) => TItem[],
  metadata: {
    configured?: (payload: TPayload) => boolean | undefined;
    source?: (payload: TPayload) => string | undefined;
  } = {}
): AdminV2SourceResult<TItem[]> {
  if (!result.data || result.status !== "ready") {
    return {
      ...result,
      data: null
    };
  }

  const items = selectItems(result.data);

  return {
    configured: metadata.configured?.(result.data),
    data: items,
    httpStatus: result.httpStatus,
    source: metadata.source?.(result.data),
    status: items.length > 0 ? "ready" : "empty"
  };
}

function mapSourceObject<TPayload, TData>(
  result: AdminV2SourceResult<TPayload>,
  selectData: (payload: TPayload) => TData,
  metadata: {
    configured?: (payload: TPayload) => boolean | undefined;
    isEmpty?: (data: TData) => boolean;
    source?: (payload: TPayload) => string | undefined;
  } = {}
): AdminV2SourceResult<TData> {
  if (!result.data || result.status !== "ready") {
    return {
      ...result,
      data: null
    };
  }

  const data = selectData(result.data);

  return {
    configured: metadata.configured?.(result.data),
    data,
    httpStatus: result.httpStatus,
    source: metadata.source?.(result.data),
    status: metadata.isEmpty?.(data) ? "empty" : "ready"
  };
}

function mapUnknownSource<TPayload>(result: AdminV2SourceResult<TPayload>) {
  if (!result.data || result.status !== "ready") return result;

  return {
    ...result,
    status: "ready" as const
  };
}

function mapAdminAccessSource(
  adminAccess: AdminV2AccessProfile | null | undefined
): AdminV2SourceResult<AdminV2AccessProfile> {
  if (!adminAccess) {
    return {
      data: null,
      status: "not-authorized"
    };
  }

  return {
    data: adminAccess,
    source: adminAccess.isOwner ? "owner-session" : "admin-session",
    status: "ready"
  };
}

function createNotAuthorizedSource<TData>(): AdminV2SourceResult<TData> {
  return {
    data: null,
    status: "not-authorized"
  };
}

function canAccessAdminV2Source(
  profile: AdminV2AccessProfile | null | undefined,
  permission: string
) {
  return Boolean(profile?.isOwner || profile?.permissions?.includes(permission));
}

function canAccessAnyAdminV2Source(
  profile: AdminV2AccessProfile | null | undefined,
  permissions: string[]
) {
  return Boolean(
    profile?.isOwner || permissions.some((permission) => profile?.permissions?.includes(permission))
  );
}

function buildAdminV2MetricCards({
  analyticsEvents,
  coachSites,
  errorReports
}: {
  analyticsEvents: AdminV2SourceResult<AdminV2AnalyticsEventsData>;
  coachSites: AdminV2SourceResult<CoachSiteRecord[]>;
  errorReports: AdminV2SourceResult<AdminErrorReport[]>;
}): AdminV2MetricCardData[] {
  const metrics: AdminV2MetricCardData[] = [];

  if (analyticsEvents.data) {
    const summaries = analyticsEvents.data.analyticsSummaries;
    metrics.push(
      {
        id: "total-visits",
        label: "Total visits",
        source: "analytics",
        status: analyticsEvents.status,
        tone: "neutral",
        value: sum(summaries, (summary) => summary.totalVisits)
      },
      {
        id: "register-clicks",
        label: "Register clicks",
        source: "analytics",
        status: analyticsEvents.status,
        tone: "success",
        value: sum(summaries, (summary) => summary.registerClicks)
      },
      {
        id: "payment-success",
        label: "Payment success",
        source: "analytics",
        status: analyticsEvents.status,
        tone: "success",
        value: sum(summaries, (summary) => summary.paymentSuccess)
      }
    );
  }

  if (coachSites.data) {
    metrics.push(
      {
        id: "coach-sites-total",
        label: "Coach sites",
        source: "coach-sites",
        status: coachSites.status,
        tone: "neutral",
        value: coachSites.data.length
      },
      {
        id: "coach-sites-published",
        label: "Published sites",
        source: "coach-sites",
        status: coachSites.status,
        tone: "success",
        value: coachSites.data.filter((site) => site.status === "published").length
      }
    );
  }

  if (errorReports.data) {
    metrics.push({
      id: "open-error-reports",
      label: "Open reports",
      source: "error-reports",
      status: errorReports.status,
      tone: errorReports.data.length > 0 ? "warning" : "success",
      value: errorReports.data.filter(
        (report) => report.status !== "Fixed" && report.status !== "Ignored"
      ).length
    });
  }

  return metrics;
}

function buildAdminV2SourceSummaries(
  sources: AdminV2DashboardData["sources"]
): AdminV2SourceSummary[] {
  return [
    ["authSession", "Admin session"],
    ["analyticsEvents", "Analytics events"],
    ["coachSites", "Coach sites"],
    ["errorReports", "Error reports"],
    ["shop", "Shop"],
    ["backupCleanup", "Backup and cleanup"],
    ["masterclassPrivateLinks", "Paid private links"],
    ["masterclassSettings", "Paid settings"],
    ["users", "Admin users"]
  ].map(([id, label]) => {
    const result = sources[id as keyof AdminV2DashboardData["sources"]];
    return {
      detail: getSourceSummaryDetail(result),
      id: id as keyof AdminV2DashboardData["sources"],
      label,
      status: result.status,
      tone: getSourceSummaryTone(result.status)
    };
  });
}

function buildAdminV2RecentSignals(
  analyticsEvents: AdminV2SourceResult<AdminV2AnalyticsEventsData>
): AdminV2RecentSignal[] {
  return (analyticsEvents.data?.recentEvents || []).slice(0, 5).map((event, index) => ({
    detail: [
      event.coachSlug || "site-wide",
      event.funnelType.replace(/_/g, " "),
      event.deviceType,
      event.region
    ]
      .filter(Boolean)
      .join(" / "),
    id: `${event.createdAt}-${event.eventName}-${index}`,
    label: formatEventName(event.eventName),
    timestamp: event.createdAt
  }));
}

function getSourceSummaryDetail(result: AdminV2SourceResult<unknown>) {
  if (result.status === "not-authorized") return "Permission not assigned for this admin.";
  if (result.status === "empty") return "Connected, but no production records yet.";
  if (result.status === "unavailable")
    return result.error || "Source unavailable or not configured.";
  return result.source ? `Connected: ${result.source}` : "Connected to production endpoint.";
}

function getSourceSummaryTone(status: AdminV2DataStatus): AdminV2SourceSummary["tone"] {
  if (status === "ready") return "success";
  if (status === "empty") return "neutral";
  if (status === "not-authorized") return "warning";
  return "danger";
}

function formatEventName(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function combineSourceStatus(sources: Array<AdminV2SourceResult<unknown>>): AdminV2DataStatus {
  if (sources.some((source) => source.status === "ready")) return "ready";
  if (sources.some((source) => source.status === "empty")) return "empty";
  if (sources.every((source) => source.status === "not-authorized")) return "not-authorized";
  return "unavailable";
}

function sum<TItem>(items: TItem[], selectValue: (item: TItem) => number) {
  return items.reduce((total, item) => total + selectValue(item), 0);
}
