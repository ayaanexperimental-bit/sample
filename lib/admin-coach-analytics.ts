import type {
  CoachSiteAnalyticsSummary,
  CoachSiteRecord,
  CoachSiteStatus
} from "./admin-coach-sites";
import type { AnalyticsMetricSummary } from "./analytics-events";
import { coaches, funnels, type Funnel } from "./coach-platform";

export type CoachAnalyticsFunnelType = "combined" | "free" | "paid";
export type CoachAnalyticsPerformanceBand = "high" | "low" | "medium" | "none";

export type CoachAvailableFunnels = {
  availableTabs: CoachAnalyticsFunnelType[];
  coachId: string;
  coachSlug: string;
  combinedAvailable: boolean;
  freeGuestLinks: CoachSiteRecord[];
  hasFreeGuestLink: boolean;
  hasPaidMasterclass: boolean;
  paidFunnels: Funnel[];
  primaryFunnelType: "free_guest_link" | "no_funnel" | "paid_masterclass";
};

export type CoachAnalyticsMetricSet = {
  conversionRate: string;
  clicks: number;
  lastActivity: string;
  visits: number;
};

export type PaidMasterclassMetrics = CoachAnalyticsMetricSet & {
  paymentButtonClicks: number;
  paymentInitiated: number;
  paymentSuccess: number;
  paymentToSuccessDropOff: string;
  registerClicks: number;
  successPageViews: number;
  successToWhatsappDropOff: string;
  whatsappClicks: number;
};

export type FreeGuestLinkMetrics = CoachAnalyticsMetricSet & {
  googleFormClicks: number;
  googleFormStatus: "configured" | "missing";
  registerClicks: number;
  supportStatus: "coach-specific contact available" | "fallback support used";
  videoPlays: number;
  whatsappClicks: number;
};

export type CoachAnalyticsRow = CoachAvailableFunnels & {
  bestFunnel: "Free Guest Link" | "No funnel yet" | "Paid Masterclass";
  coachName: string;
  combined: CoachAnalyticsMetricSet;
  deviceBreakdown: CoachSiteAnalyticsSummary["deviceBreakdown"];
  freeMetrics: FreeGuestLinkMetrics;
  location: string;
  lowActivityReasons: string[];
  niche: string;
  paidMetrics: PaidMasterclassMetrics;
  performanceBand: CoachAnalyticsPerformanceBand;
  photoUrl: string;
  publicLink: string;
  region: string;
  source: string;
  status: CoachSiteStatus | "active" | "inactive";
  trend: string;
};

export type CoachAnalyticsBuildOptions = {
  preferEventSummaries?: boolean;
};

const EMPTY_DEVICE_BREAKDOWN = {
  desktop: 0,
  mobile: 0,
  tablet: 0
};

export function buildCoachAnalyticsRows(
  coachSites: CoachSiteRecord[],
  analyticsSummaries: AnalyticsMetricSummary[] = [],
  options: CoachAnalyticsBuildOptions = {}
): CoachAnalyticsRow[] {
  const currentCoachSites = coachSites.filter(isCurrentCoachSite);
  const coachIds = new Set<string>();
  coaches.forEach((coach) => coachIds.add(coach.id));
  currentCoachSites.forEach((site) => coachIds.add(site.coachId));
  analyticsSummaries.forEach((summary) => {
    if (summary.coachId) coachIds.add(summary.coachId);
  });
  funnels.forEach((funnel) => coachIds.add(funnel.coachId));

  return Array.from(coachIds)
    .map((coachId) =>
      buildCoachAnalyticsRow(coachId, currentCoachSites, analyticsSummaries, options)
    )
    .sort((a, b) => {
      if (b.combined.visits !== a.combined.visits) return b.combined.visits - a.combined.visits;
      return a.coachName.localeCompare(b.coachName);
    });
}

export function getCoachAvailableFunnels(
  coachId: string,
  coachSites: CoachSiteRecord[]
): CoachAvailableFunnels {
  const freeGuestLinks = coachSites.filter(
    (site) => site.coachId === coachId && isCurrentCoachSite(site)
  );
  const paidFunnels = funnels.filter(
    (funnel) =>
      funnel.coachId === coachId && funnel.type === "paidProgram" && funnel.status === "active"
  );
  const platformCoach = coaches.find((coach) => coach.id === coachId);
  const primarySite = freeGuestLinks[0] || coachSites.find((site) => site.coachId === coachId);
  const hasPaidMasterclass = paidFunnels.length > 0;
  const hasFreeGuestLink = freeGuestLinks.length > 0;
  const combinedAvailable = hasPaidMasterclass && hasFreeGuestLink;
  const availableTabs: CoachAnalyticsFunnelType[] = combinedAvailable
    ? ["combined", "paid", "free"]
    : hasPaidMasterclass
      ? ["paid"]
      : hasFreeGuestLink
        ? ["free"]
        : [];

  return {
    availableTabs,
    coachId,
    coachSlug: primarySite?.slug || platformCoach?.slug || coachId.replace(/^coach-/, ""),
    combinedAvailable,
    freeGuestLinks,
    hasFreeGuestLink,
    hasPaidMasterclass,
    paidFunnels,
    primaryFunnelType: hasPaidMasterclass
      ? "paid_masterclass"
      : hasFreeGuestLink
        ? "free_guest_link"
        : "no_funnel"
  };
}

export function filterCoachAnalyticsRows({
  dateRange,
  funnelFilter,
  performanceFilter,
  query,
  regionFilter,
  rows,
  sortBy,
  statusFilter
}: {
  dateRange: string;
  funnelFilter: "all" | "both" | "free" | "none" | "paid";
  performanceFilter: "all" | CoachAnalyticsPerformanceBand;
  query: string;
  regionFilter: string;
  rows: CoachAnalyticsRow[];
  sortBy: "clicks" | "conversion" | "monthly" | "recent" | "visits" | "weekly";
  statusFilter: "active" | "all" | CoachSiteStatus;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedRegion = regionFilter.trim().toLowerCase();

  return rows
    .filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.coachName.toLowerCase().includes(normalizedQuery) ||
        row.niche.toLowerCase().includes(normalizedQuery) ||
        row.coachSlug.toLowerCase().includes(normalizedQuery);
      const matchesFunnel =
        funnelFilter === "all" ||
        (funnelFilter === "both" && row.combinedAvailable) ||
        (funnelFilter === "paid" && row.hasPaidMasterclass && !row.hasFreeGuestLink) ||
        (funnelFilter === "free" && row.hasFreeGuestLink && !row.hasPaidMasterclass) ||
        (funnelFilter === "none" && !row.hasFreeGuestLink && !row.hasPaidMasterclass);
      const matchesStatus =
        statusFilter === "all"
          ? row.status !== "archived" && row.status !== "removed"
          : row.status === statusFilter;
      const matchesRegion =
        !normalizedRegion ||
        normalizedRegion === "all" ||
        row.region.toLowerCase() === normalizedRegion;
      const matchesPerformance =
        performanceFilter === "all" || row.performanceBand === performanceFilter;

      return matchesQuery && matchesFunnel && matchesStatus && matchesRegion && matchesPerformance;
    })
    .sort((a, b) => compareCoachAnalyticsRows(a, b, sortBy, dateRange));
}

export function getTopCoachAnalyticsRows(rows: CoachAnalyticsRow[]) {
  return rows
    .filter((row) => row.combined.visits > 0 || row.combined.clicks > 0)
    .sort((a, b) => {
      if (b.combined.visits !== a.combined.visits) return b.combined.visits - a.combined.visits;
      return b.combined.clicks - a.combined.clicks;
    })
    .slice(0, 5);
}

export function getNeedsAttentionRows(rows: CoachAnalyticsRow[]) {
  return rows.filter((row) => row.lowActivityReasons.length > 0).slice(0, 8);
}

function buildCoachAnalyticsRow(
  coachId: string,
  coachSites: CoachSiteRecord[],
  analyticsSummaries: AnalyticsMetricSummary[],
  options: CoachAnalyticsBuildOptions
): CoachAnalyticsRow {
  const funnelInfo = getCoachAvailableFunnels(coachId, coachSites);
  const platformCoach = coaches.find((coach) => coach.id === coachId);
  const allSites = coachSites.filter((site) => site.coachId === coachId && isCurrentCoachSite(site));
  const primarySite = funnelInfo.freeGuestLinks[0] || allSites[0];
  const coachSummaries = getCoachSummaries(analyticsSummaries, coachId, allSites);
  const freeMetrics = buildFreeMetrics(
    funnelInfo.freeGuestLinks,
    coachSummaries,
    options.preferEventSummaries
  );
  const paidMetrics = buildPaidMetrics(funnelInfo.paidFunnels, analyticsSummaries, coachId);
  const combinedVisits = freeMetrics.visits + paidMetrics.visits;
  const combinedClicks = freeMetrics.clicks + paidMetrics.clicks;
  const combined = {
    clicks: combinedClicks,
    conversionRate: getConversionRate(combinedClicks, combinedVisits),
    lastActivity: getLatestActivity([
      freeMetrics.lastActivity,
      paidMetrics.lastActivity,
      primarySite?.updatedAt
    ]),
    visits: combinedVisits
  };
  const status = getPrimaryStatus(primarySite, platformCoach?.status);
  const lowActivityReasons = getLowActivityReasons({
    combined,
    freeMetrics,
    hasFreeGuestLink: funnelInfo.hasFreeGuestLink,
    hasPaidMasterclass: funnelInfo.hasPaidMasterclass,
    paidMetrics,
    primarySite,
    status
  });

  return {
    ...funnelInfo,
    bestFunnel: getBestFunnel(freeMetrics, paidMetrics),
    coachName: primarySite?.coachName || platformCoach?.displayName || coachId,
    combined,
    deviceBreakdown: sumDeviceBreakdown(
      funnelInfo.freeGuestLinks,
      analyticsSummaries,
      coachId,
      options.preferEventSummaries
    ),
    freeMetrics,
    location: primarySite?.location || "",
    lowActivityReasons,
    niche: primarySite?.niche || platformCoach?.guestProfile.niche || "Not configured",
    paidMetrics,
    performanceBand: getPerformanceBand(combined.visits, combined.conversionRate),
    photoUrl: resolveCoachPhotoUrl(primarySite, platformCoach?.guestProfile.imageSrc),
    publicLink: primarySite?.publicUrl || "",
    region: getFirstAvailableValue(
      options.preferEventSummaries
        ? [
            ...coachSummaries.map((summary) => summary.region),
            ...funnelInfo.freeGuestLinks.map((site) => site.analytics.region)
          ]
        : [
            ...funnelInfo.freeGuestLinks.map((site) => site.analytics.region),
            ...coachSummaries.map((summary) => summary.region)
          ],
      "Not available"
    ),
    source: getFirstAvailableValue(
      options.preferEventSummaries
        ? [
            ...coachSummaries.map((summary) => summary.source),
            ...funnelInfo.freeGuestLinks.map((site) => site.analytics.source)
          ]
        : [
            ...funnelInfo.freeGuestLinks.map((site) => site.analytics.source),
            ...coachSummaries.map((summary) => summary.source)
          ],
      "Not available"
    ),
    status,
    trend: combined.visits > 0 ? "Tracking" : "No activity yet"
  };
}

function isCurrentCoachSite(site: CoachSiteRecord) {
  return site.status !== "archived" && site.status !== "removed";
}

function resolveCoachPhotoUrl(site?: CoachSiteRecord, platformImageSrc = "") {
  const mediaSite = site as
    | (CoachSiteRecord & {
        heroImageUrl?: string;
        media?: {
          imageUrl?: string;
        };
        profilePhotoUrl?: string;
      })
    | undefined;

  return getFirstAvailableValue(
    [
      mediaSite?.heroImageUrl,
      site?.photoUrl,
      mediaSite?.profilePhotoUrl,
      site?.logoUrl,
      mediaSite?.media?.imageUrl,
      platformImageSrc
    ],
    ""
  );
}

function buildFreeMetrics(
  sites: CoachSiteRecord[],
  coachSummaries: AnalyticsMetricSummary[],
  preferEventSummaries?: boolean
): FreeGuestLinkMetrics {
  const freeSummaries = coachSummaries.filter((summary) => summary.funnelType === "free_guest_link");
  const visits = preferEventSummaries
    ? sum(freeSummaries.map((summary) => summary.totalVisits))
    : sum(sites.map((site) => site.analytics.totalVisits));
  const registerClicks = preferEventSummaries
    ? sum(freeSummaries.map((summary) => summary.registerClicks))
    : sum(sites.map((site) => site.analytics.totalRegisterClicks));
  const whatsappClicks = preferEventSummaries
    ? sum(freeSummaries.map((summary) => summary.whatsappClicks))
    : sum(sites.map((site) => site.analytics.totalWhatsappClicks));
  const videoPlays = preferEventSummaries
    ? sum(freeSummaries.map((summary) => summary.videoPlays))
    : sum(sites.map((site) => site.analytics.videoPlays));
  const googleFormConfigured = sites.some((site) => Boolean(site.googleFormUrl.trim()));
  const supportConfigured = sites.some((site) =>
    Boolean(site.coachEmail.trim() || site.coachPhone.trim() || site.whatsappLink.trim())
  );

  return {
    clicks: registerClicks + whatsappClicks,
    conversionRate: getConversionRate(registerClicks, visits),
    googleFormClicks: registerClicks,
    googleFormStatus: googleFormConfigured ? "configured" : "missing",
    lastActivity: getLatestActivity(
      sites.map((site) => site.analytics.lastUpdated || site.updatedAt)
    ),
    registerClicks,
    supportStatus: supportConfigured ? "coach-specific contact available" : "fallback support used",
    videoPlays,
    visits,
    whatsappClicks
  };
}

function buildPaidMetrics(
  paidFunnels: Funnel[],
  analyticsSummaries: AnalyticsMetricSummary[],
  coachId: string
): PaidMasterclassMetrics {
  const hasPaidFunnel = paidFunnels.length > 0;
  const paidFunnelIds = new Set(paidFunnels.map((funnel) => funnel.id));
  const paidSummaries = analyticsSummaries.filter(
    (summary) =>
      summary.funnelType === "paid_masterclass" &&
      (paidFunnelIds.has(summary.funnelId) || summary.coachId === coachId)
  );
  const visits = sum(paidSummaries.map((summary) => summary.totalVisits));
  const registerClicks = sum(paidSummaries.map((summary) => summary.registerClicks));
  const paymentButtonClicks = sum(paidSummaries.map((summary) => summary.paymentButtonClicks));
  const paymentInitiated = sum(paidSummaries.map((summary) => summary.paymentInitiated));
  const paymentSuccess = sum(paidSummaries.map((summary) => summary.paymentSuccess));
  const successPageViews = sum(paidSummaries.map((summary) => summary.successPageViews));
  const whatsappClicks = sum(paidSummaries.map((summary) => summary.whatsappClicks));
  const paidLastActivity = getLatestActivity(paidSummaries.map((summary) => summary.lastActivity));

  return {
    clicks: registerClicks + paymentButtonClicks + whatsappClicks,
    conversionRate: getConversionRate(paymentSuccess || registerClicks, visits),
    lastActivity:
      paidLastActivity !== "No activity yet"
        ? paidLastActivity
        : hasPaidFunnel
          ? "Paid funnel configured"
          : "Not connected",
    paymentButtonClicks,
    paymentInitiated,
    paymentSuccess,
    paymentToSuccessDropOff: getDropOffLabel(paymentInitiated, paymentSuccess),
    registerClicks,
    successPageViews,
    successToWhatsappDropOff: getDropOffLabel(successPageViews, whatsappClicks),
    visits,
    whatsappClicks
  };
}

function getPrimaryStatus(site?: CoachSiteRecord, platformStatus?: "active" | "inactive") {
  if (site?.status) return site.status;
  return platformStatus || "inactive";
}

function getLowActivityReasons({
  combined,
  freeMetrics,
  hasFreeGuestLink,
  hasPaidMasterclass,
  primarySite,
  status
}: {
  combined: CoachAnalyticsMetricSet;
  freeMetrics: FreeGuestLinkMetrics;
  hasFreeGuestLink: boolean;
  hasPaidMasterclass: boolean;
  paidMetrics: PaidMasterclassMetrics;
  primarySite?: CoachSiteRecord;
  status: CoachAnalyticsRow["status"];
}) {
  const reasons: string[] = [];

  if (!hasFreeGuestLink && !hasPaidMasterclass) reasons.push("No funnel connected yet");
  if (hasFreeGuestLink && freeMetrics.googleFormStatus === "missing") {
    reasons.push("Google Form link is missing");
  }
  if (hasFreeGuestLink && freeMetrics.supportStatus === "fallback support used") {
    reasons.push("Coach-specific fallback support is missing");
  }
  if (combined.visits === 0 && (hasFreeGuestLink || hasPaidMasterclass)) {
    reasons.push("No activity recorded yet");
  }
  if (combined.visits >= 25 && combined.clicks === 0) {
    reasons.push("High visits but no clicks recorded");
  }
  if (status === "paused" || status === "archived" || status === "removed") {
    reasons.push(`Coach site status is ${status}`);
  }
  if (primarySite?.status === "draft") reasons.push("Draft is not public yet");

  return reasons;
}

function compareCoachAnalyticsRows(
  a: CoachAnalyticsRow,
  b: CoachAnalyticsRow,
  sortBy: "clicks" | "conversion" | "monthly" | "recent" | "visits" | "weekly",
  dateRange: string
) {
  if (sortBy === "clicks") return b.combined.clicks - a.combined.clicks;
  if (sortBy === "conversion")
    return percentToNumber(b.combined.conversionRate) - percentToNumber(a.combined.conversionRate);
  if (sortBy === "weekly" || sortBy === "monthly") return b.combined.visits - a.combined.visits;
  if (sortBy === "recent")
    return getDateValue(b.combined.lastActivity) - getDateValue(a.combined.lastActivity);
  if (dateRange === "30d" || dateRange === "90d" || dateRange === "7d" || dateRange === "today")
    return b.combined.visits - a.combined.visits;
  return b.combined.visits - a.combined.visits;
}

function getBestFunnel(freeMetrics: FreeGuestLinkMetrics, paidMetrics: PaidMasterclassMetrics) {
  if (freeMetrics.visits === 0 && paidMetrics.visits === 0) return "No funnel yet";
  return paidMetrics.visits > freeMetrics.visits ? "Paid Masterclass" : "Free Guest Link";
}

function getPerformanceBand(visits: number, conversionRate: string): CoachAnalyticsPerformanceBand {
  const conversion = percentToNumber(conversionRate);
  if (visits === 0) return "none";
  if (conversion >= 15 || visits >= 1000) return "high";
  if (conversion >= 5 || visits >= 100) return "medium";
  return "low";
}

function sumDeviceBreakdown(
  sites: CoachSiteRecord[],
  analyticsSummaries: AnalyticsMetricSummary[],
  coachId: string,
  preferEventSummaries?: boolean
) {
  if (preferEventSummaries) {
    return analyticsSummaries
      .filter((summary) => summary.coachId === coachId)
      .reduce(
        (acc, summary) => ({
          desktop: acc.desktop + summary.deviceBreakdown.desktop,
          mobile: acc.mobile + summary.deviceBreakdown.mobile,
          tablet: acc.tablet + summary.deviceBreakdown.tablet
        }),
        { ...EMPTY_DEVICE_BREAKDOWN }
      );
  }

  const freeDevices = sites.reduce(
    (acc, site) => ({
      desktop: acc.desktop + site.analytics.deviceBreakdown.desktop,
      mobile: acc.mobile + site.analytics.deviceBreakdown.mobile,
      tablet: acc.tablet + site.analytics.deviceBreakdown.tablet
    }),
    { ...EMPTY_DEVICE_BREAKDOWN }
  );

  return analyticsSummaries
    .filter((summary) => summary.coachId === coachId && summary.funnelType === "paid_masterclass")
    .reduce(
      (acc, summary) => ({
        desktop: acc.desktop + summary.deviceBreakdown.desktop,
        mobile: acc.mobile + summary.deviceBreakdown.mobile,
        tablet: acc.tablet + summary.deviceBreakdown.tablet
      }),
      freeDevices
    );
}

function getCoachSummaries(
  analyticsSummaries: AnalyticsMetricSummary[],
  coachId: string,
  sites: CoachSiteRecord[]
) {
  const slugs = new Set(sites.map((site) => site.slug).filter(Boolean));

  return analyticsSummaries.filter(
    (summary) =>
      summary.coachId === coachId || Boolean(summary.coachSlug && slugs.has(summary.coachSlug))
  );
}

function getFirstAvailableValue(values: Array<string | undefined>, fallback: string) {
  return values.find((value) => value && value !== "Not available") || fallback;
}

function getLatestActivity(values: Array<string | undefined>) {
  const validDates = values
    .filter((value): value is string => Boolean(value && value !== "Not connected"))
    .sort((a, b) => getDateValue(b) - getDateValue(a));

  return validDates[0] || "No activity yet";
}

function getDateValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getConversionRate(clicks: number, visits: number) {
  if (!visits) return "0%";
  return `${((clicks / visits) * 100).toFixed(1)}%`;
}

function getDropOffLabel(start: number, complete: number) {
  if (!start) return "Not enough data yet";
  const dropOff = Math.max(0, start - complete);

  return `${dropOff.toLocaleString()} drop-off / ${getConversionRate(complete, start)} completed`;
}

function percentToNumber(value: string) {
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
