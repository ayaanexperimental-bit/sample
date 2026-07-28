export type AdminAIAnalyticsPoint = {
  bucketEnd: string;
  bucketStart: string;
  currentRegistrationClicks: number;
  currentVisits: number;
  previousRegistrationClicks: number | null;
  previousVisits: number | null;
  source: string;
  sourceAttributed?: boolean;
};

export type AdminAIAnalyticsAnomaly = {
  baseline: number;
  confidence: "high" | "low" | "medium";
  dataRange: string;
  detectionMethod: string;
  deviationPercent: number;
  observedValue: number;
  recommendedVerification: string;
  type: "click-spike" | "conversion-collapse" | "traffic-drop";
};

type AnalyticsInput = {
  now?: string;
  points: AdminAIAnalyticsPoint[];
  refreshedAt?: string;
};

type AdminAISelectedEntity = { id: string; name: string };
type AdminAISitePerformanceCategory =
  | "freshness"
  | "payment"
  | "publish-state"
  | "registration-conversion"
  | "traffic";
type AdminAISitePerformanceMissingEvidence =
  | AdminAISitePerformanceCategory
  | "permission"
  | "selected-coach"
  | "selected-site";

export type AdminAISelectedSitePerformanceInput = {
  filters: Readonly<Record<string, boolean | number | string | null>>;
  now?: string;
  payment?: { source: string; status: string; updatedAt: string };
  permissionVisible: boolean;
  publishState?: { source: string; status: string; updatedAt: string };
  refreshedAt?: string;
  registrationConversion?: {
    currentRegistrations: number;
    currentVisits: number;
    dateRange: string;
    previousRegistrations: number;
    previousVisits: number;
    source: string;
  };
  selectedCoach?: AdminAISelectedEntity;
  selectedSite?: AdminAISelectedEntity;
  traffic?: {
    currentVisits: number;
    dateRange: string;
    previousVisits: number;
    source: string;
  };
};

export type AdminAISitePerformanceFactor = {
  category: AdminAISitePerformanceCategory;
  classification: "cause" | "not-indicated";
  summary: string;
};

export function explainAdminAIAnalytics(input: AnalyticsInput) {
  const points = input.points
    .filter(isUsablePoint)
    .slice(0, 500)
    .sort((left, right) => left.bucketStart.localeCompare(right.bucketStart));

  if (!points.length) return emptyExplanation();

  const previousAvailable = points.filter(
    (point) => point.previousVisits !== null && point.previousRegistrationClicks !== null
  );
  const currentVisits = sum(points.map((point) => point.currentVisits));
  const currentRegistrationClicks = sum(points.map((point) => point.currentRegistrationClicks));
  const previousVisits = previousAvailable.length
    ? sum(previousAvailable.map((point) => point.previousVisits || 0))
    : null;
  const previousRegistrationClicks = previousAvailable.length
    ? sum(previousAvailable.map((point) => point.previousRegistrationClicks || 0))
    : null;
  const missingDataWarnings: string[] = [];
  const missingPrevious = points.length - previousAvailable.length;
  if (missingPrevious) {
    missingDataWarnings.push(
      `Previous-period visits and registration clicks are unavailable for ${missingPrevious} of ${points.length} buckets.`
    );
  }
  if (points.some((point) => !point.source.trim())) {
    missingDataWarnings.push("Traffic source is unavailable for one or more buckets.");
  }
  if (previousVisits === 0 || previousRegistrationClicks === 0) {
    missingDataWarnings.push(
      "A zero previous-period baseline prevents a reliable percentage comparison."
    );
  }

  const anomalies = detectAnalyticsAnomalies(points);
  const importantWindows = findImportantWindows(points);
  const attributedPoints = points.filter(
    (point) => point.sourceAttributed === true && Boolean(point.source.trim())
  );
  const sourceAttributionAvailable = attributedPoints.length === points.length;
  const sourcePerformance = sourceAttributionAvailable
    ? buildSourcePerformance(attributedPoints)
    : [];
  const sourceComparison = buildSourceComparison(
    points,
    sourcePerformance,
    sourceAttributionAvailable
  );
  const correlation = buildCorrelation(points);
  const dataRange = `${points[0].bucketStart} to ${points[points.length - 1].bucketEnd}`;

  return {
    anomalies,
    correlation,
    evidence: {
      dataRange,
      freshness: formatFreshness(input.refreshedAt, input.now),
      sources: Array.from(new Set(points.map((point) => point.source.trim()).filter(Boolean)))
    },
    importantWindows,
    investigationSteps: buildInvestigationSteps(anomalies, sourcePerformance),
    missingDataWarnings,
    sourceComparison,
    sourcePerformance,
    status:
      points.length >= 2 && previousAvailable.length === points.length
        ? ("ready" as const)
        : ("insufficient-baseline" as const),
    trend: {
      currentRegistrationClicks,
      currentVisits,
      previousRegistrationClicks,
      previousVisits,
      registrationClicksChangePercent: percentChange(
        currentRegistrationClicks,
        previousRegistrationClicks
      ),
      visitsChangePercent: percentChange(currentVisits, previousVisits)
    }
  };
}

export function analyzeSelectedSitePerformance(input: AdminAISelectedSitePerformanceInput) {
  const selectedCoach = normalizeSelectedEntity(input.selectedCoach);
  const selectedSite = normalizeSelectedEntity(input.selectedSite);
  const provenance = {
    filters: Object.fromEntries(
      Object.entries(input.filters || {}).sort(([left], [right]) => left.localeCompare(right))
    ),
    permissionVisible: input.permissionVisible
  };

  if (!input.permissionVisible) {
    return insufficientSitePerformanceResult(null, null, provenance, ["permission"]);
  }

  const missingSelection: AdminAISitePerformanceMissingEvidence[] = [
    ...(selectedCoach ? [] : (["selected-coach"] as const)),
    ...(selectedSite ? [] : (["selected-site"] as const))
  ];
  if (missingSelection.length) {
    return insufficientSitePerformanceResult(
      selectedCoach,
      selectedSite,
      provenance,
      missingSelection
    );
  }

  const factors: AdminAISitePerformanceFactor[] = [];
  const missingEvidence: AdminAISitePerformanceMissingEvidence[] = [];
  const traffic = input.traffic;
  if (
    traffic &&
    hasText(traffic.source) &&
    hasText(traffic.dateRange) &&
    isNonNegative(traffic.currentVisits) &&
    isNonNegative(traffic.previousVisits)
  ) {
    const change = percentChange(traffic.currentVisits, traffic.previousVisits);
    factors.push({
      category: "traffic",
      classification: change !== null && change <= -20 ? "cause" : "not-indicated",
      summary:
        change === null
          ? "Traffic has no non-zero comparison baseline."
          : `Visits changed ${change}% versus the supplied comparison period (${traffic.source}; ${traffic.dateRange}).`
    });
  } else {
    missingEvidence.push("traffic");
  }

  const conversion = input.registrationConversion;
  if (
    conversion &&
    hasText(conversion.source) &&
    hasText(conversion.dateRange) &&
    [
      conversion.currentRegistrations,
      conversion.currentVisits,
      conversion.previousRegistrations,
      conversion.previousVisits
    ].every(isNonNegative) &&
    conversion.currentVisits > 0 &&
    conversion.previousVisits > 0
  ) {
    const currentRate = safeRate(conversion.currentRegistrations, conversion.currentVisits);
    const previousRate = safeRate(conversion.previousRegistrations, conversion.previousVisits);
    const change = percentChange(currentRate, previousRate);
    factors.push({
      category: "registration-conversion",
      classification: change !== null && change <= -20 ? "cause" : "not-indicated",
      summary: `Registration conversion changed ${change === null ? "without a non-zero baseline" : `${change}%`} (${conversion.source}; ${conversion.dateRange}).`
    });
  } else {
    missingEvidence.push("registration-conversion");
  }

  const payment = input.payment;
  if (payment && hasText(payment.source) && isValidTimestamp(payment.updatedAt)) {
    const status = payment.status.trim().toLowerCase();
    factors.push({
      category: "payment",
      classification: status === "paid" || status === "not-required" ? "not-indicated" : "cause",
      summary: `Trusted payment status is ${status || "unavailable"} (${payment.source}; ${payment.updatedAt}).`
    });
  } else {
    missingEvidence.push("payment");
  }

  const publishState = input.publishState;
  if (publishState && hasText(publishState.source) && isValidTimestamp(publishState.updatedAt)) {
    const status = publishState.status.trim().toLowerCase();
    factors.push({
      category: "publish-state",
      classification: status === "published" ? "not-indicated" : "cause",
      summary: `Trusted publish state is ${status || "unavailable"} (${publishState.source}; ${publishState.updatedAt}).`
    });
  } else {
    missingEvidence.push("publish-state");
  }

  const refreshedAt = input.refreshedAt ? Date.parse(input.refreshedAt) : Number.NaN;
  const now = input.now ? Date.parse(input.now) : Date.now();
  if (Number.isFinite(refreshedAt) && Number.isFinite(now) && refreshedAt <= now) {
    const ageHours = round((now - refreshedAt) / 3_600_000);
    factors.push({
      category: "freshness",
      classification: ageHours > 24 ? "cause" : "not-indicated",
      summary: `Evidence was refreshed ${ageHours} hour${ageHours === 1 ? "" : "s"} ago (24-hour threshold).`
    });
  } else {
    missingEvidence.push("freshness");
  }

  return {
    caveat:
      "This deterministic evidence check does not infer deployment or code facts and does not establish causation.",
    factors,
    missingEvidence,
    provenance,
    selectedCoach,
    selectedSite,
    status: missingEvidence.length ? ("insufficient-evidence" as const) : ("ready" as const)
  };
}

function insufficientSitePerformanceResult(
  selectedCoach: AdminAISelectedEntity | null,
  selectedSite: AdminAISelectedEntity | null,
  provenance: {
    filters: Record<string, boolean | number | string | null>;
    permissionVisible: boolean;
  },
  missingEvidence: AdminAISitePerformanceMissingEvidence[]
) {
  return {
    caveat:
      "This deterministic evidence check does not infer deployment or code facts and does not establish causation.",
    factors: [] as AdminAISitePerformanceFactor[],
    missingEvidence,
    provenance,
    selectedCoach,
    selectedSite,
    status: "insufficient-evidence" as const
  };
}

function normalizeSelectedEntity(value: AdminAISelectedEntity | undefined) {
  const id = value?.id.trim();
  const name = value?.name.trim();
  return id && name ? { id, name } : null;
}

function hasText(value: string) {
  return Boolean(value.trim());
}

function isValidTimestamp(value: string) {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function detectAnalyticsAnomalies(points: AdminAIAnalyticsPoint[]) {
  return points.flatMap<AdminAIAnalyticsAnomaly>((point) => {
    if (point.previousVisits === null || point.previousRegistrationClicks === null) return [];
    const range = `${point.bucketStart} to ${point.bucketEnd}`;
    const confidence =
      point.previousVisits >= 100 ? "high" : point.previousVisits >= 20 ? "medium" : "low";
    const anomalies: AdminAIAnalyticsAnomaly[] = [];
    const visitDeviation = percentChange(point.currentVisits, point.previousVisits);
    const clickDeviation = percentChange(
      point.currentRegistrationClicks,
      point.previousRegistrationClicks
    );

    if (visitDeviation !== null && visitDeviation <= -40) {
      anomalies.push({
        baseline: point.previousVisits,
        confidence,
        dataRange: range,
        detectionMethod: "Current bucket versus the matching previous-period bucket",
        deviationPercent: visitDeviation,
        observedValue: point.currentVisits,
        recommendedVerification:
          "Verify route availability, tracking delivery, and source filters for this window.",
        type: "traffic-drop"
      });
    }
    if (clickDeviation !== null && clickDeviation >= 50) {
      anomalies.push({
        baseline: point.previousRegistrationClicks,
        confidence,
        dataRange: range,
        detectionMethod: "Current bucket versus the matching previous-period bucket",
        deviationPercent: clickDeviation,
        observedValue: point.currentRegistrationClicks,
        recommendedVerification:
          "Verify CTA event deduplication and the traffic source for this window.",
        type: "click-spike"
      });
    }

    const currentConversion = safeRate(point.currentRegistrationClicks, point.currentVisits);
    const previousConversion = safeRate(point.previousRegistrationClicks, point.previousVisits);
    const conversionDeviation = percentChange(currentConversion, previousConversion);
    if (conversionDeviation !== null && conversionDeviation <= -30) {
      anomalies.push({
        baseline: point.previousRegistrationClicks,
        confidence,
        dataRange: range,
        detectionMethod: "Current bucket versus the matching previous-period bucket",
        deviationPercent: conversionDeviation,
        observedValue: point.currentRegistrationClicks,
        recommendedVerification:
          "Check CTA visibility, destination validity, and registration-event delivery for this window.",
        type: "conversion-collapse"
      });
    }
    return anomalies;
  });
}

function findImportantWindows(points: AdminAIAnalyticsPoint[]) {
  const changes = points.slice(1).map((point, index) => ({
    bucketEnd: point.bucketEnd,
    bucketStart: point.bucketStart,
    change: point.currentVisits - points[index].currentVisits,
    currentVisits: point.currentVisits,
    previousBucketVisits: points[index].currentVisits
  }));
  const peak = changes.reduce<(typeof changes)[number] | null>(
    (best, item) => (!best || item.change > best.change ? item : best),
    null
  );
  const drop = changes.reduce<(typeof changes)[number] | null>(
    (best, item) => (!best || item.change < best.change ? item : best),
    null
  );

  return [
    ...(peak && peak.change > 0
      ? [{ ...peak, kind: "peak" as const, metric: "visits" as const }]
      : []),
    ...(drop && drop.change < 0
      ? [{ ...drop, kind: "drop" as const, metric: "visits" as const }]
      : [])
  ];
}

function buildSourcePerformance(points: AdminAIAnalyticsPoint[]) {
  const totals = new Map<string, { registrationClicks: number; visits: number }>();
  for (const point of points) {
    const source = point.source.trim();
    if (!source) continue;
    const current = totals.get(source) || { registrationClicks: 0, visits: 0 };
    current.registrationClicks += point.currentRegistrationClicks;
    current.visits += point.currentVisits;
    totals.set(source, current);
  }

  return Array.from(totals, ([source, totalsForSource]) => ({
    conversionPercent: round(safeRate(totalsForSource.registrationClicks, totalsForSource.visits)),
    registrationClicks: totalsForSource.registrationClicks,
    source,
    visits: totalsForSource.visits
  })).sort(
    (left, right) =>
      right.conversionPercent - left.conversionPercent || left.source.localeCompare(right.source)
  );
}

function buildSourceComparison(
  points: AdminAIAnalyticsPoint[],
  sourcePerformance: ReturnType<typeof buildSourcePerformance>,
  sourceAttributionAvailable: boolean
) {
  const overallConversionPercent = round(
    safeRate(
      sum(points.map((point) => point.currentRegistrationClicks)),
      sum(points.map((point) => point.currentVisits))
    )
  );

  if (!sourceAttributionAvailable || !sourcePerformance.length) {
    return unavailableSourceComparison(overallConversionPercent);
  }

  const highestTrafficSource = sourcePerformance.reduce((highest, source) => {
    if (source.visits !== highest.visits) {
      return source.visits > highest.visits ? source : highest;
    }
    return source.source.localeCompare(highest.source) < 0 ? source : highest;
  });
  const differenceFromOverallPercent = normalizeNegativeZero(
    round(highestTrafficSource.conversionPercent - overallConversionPercent)
  );
  const comparisonMessage =
    differenceFromOverallPercent === 0
      ? "at the site average"
      : `${Math.abs(differenceFromOverallPercent)} percentage points ${
          differenceFromOverallPercent > 0 ? "above" : "below"
        } the site average`;

  return {
    differenceFromOverallPercent,
    highestTrafficSource: highestTrafficSource.source,
    highestTrafficSourceConversionPercent: highestTrafficSource.conversionPercent,
    highestTrafficSourceVisits: highestTrafficSource.visits,
    message: `${highestTrafficSource.source} supplied the most attributed traffic and converted ${comparisonMessage}.`,
    overallConversionPercent,
    status: "available" as const
  };
}

function unavailableSourceComparison(overallConversionPercent: number) {
  return {
    differenceFromOverallPercent: null,
    highestTrafficSource: null,
    highestTrafficSourceConversionPercent: null,
    highestTrafficSourceVisits: null,
    message:
      "Traffic-source attribution is unavailable for one or more buckets, so no source-versus-site conversion comparison was inferred.",
    overallConversionPercent,
    status: "unavailable" as const
  };
}

function normalizeNegativeZero(value: number) {
  return Object.is(value, -0) ? 0 : value;
}

function buildCorrelation(points: AdminAIAnalyticsPoint[]) {
  if (points.length < 3) return null;
  const coefficient = pearson(
    points.map((point) => point.currentVisits),
    points.map((point) => point.currentRegistrationClicks)
  );
  if (coefficient === null) return null;
  const magnitude = Math.abs(coefficient);
  return {
    caveat: "This is correlation in the available buckets and does not establish causation.",
    coefficient: round(coefficient),
    direction: coefficient < 0 ? ("negative" as const) : ("positive" as const),
    strength:
      magnitude >= 0.7
        ? ("strong" as const)
        : magnitude >= 0.4
          ? ("moderate" as const)
          : ("weak" as const)
  };
}

function buildInvestigationSteps(
  anomalies: AdminAIAnalyticsAnomaly[],
  sourcePerformance: Array<{ conversionPercent: number; source: string }>
) {
  const steps = [
    "Verify that the selected date range, filters, and comparison period match the chart."
  ];
  if (anomalies.length) {
    steps.push("Open the exact anomaly windows and verify route, CTA, and analytics-event health.");
  }
  if (sourcePerformance.length > 1) {
    steps.push(
      "Compare high-traffic sources with their conversion rate before changing copy or spend."
    );
  }
  return steps;
}

function emptyExplanation() {
  return {
    anomalies: [] as AdminAIAnalyticsAnomaly[],
    correlation: null,
    evidence: { dataRange: "Unavailable", freshness: "Unavailable", sources: [] as string[] },
    importantWindows: [],
    investigationSteps: ["Confirm analytics ingestion and retry after real buckets are available."],
    missingDataWarnings: ["No analytics buckets are available for this chart."],
    sourceComparison: unavailableSourceComparison(0),
    sourcePerformance: [],
    status: "insufficient-baseline" as const,
    trend: {
      currentRegistrationClicks: 0,
      currentVisits: 0,
      previousRegistrationClicks: null,
      previousVisits: null,
      registrationClicksChangePercent: null,
      visitsChangePercent: null
    }
  };
}

function isUsablePoint(point: AdminAIAnalyticsPoint) {
  return Boolean(
    point.bucketStart &&
    point.bucketEnd &&
    isNonNegative(point.currentVisits) &&
    isNonNegative(point.currentRegistrationClicks) &&
    (point.previousVisits === null || isNonNegative(point.previousVisits)) &&
    (point.previousRegistrationClicks === null || isNonNegative(point.previousRegistrationClicks))
  );
}

function isNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function percentChange(current: number, previous: number | null) {
  return previous === null || previous === 0
    ? null
    : round(((current - previous) / previous) * 100);
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function pearson(left: number[], right: number[]) {
  const leftMean = sum(left) / left.length;
  const rightMean = sum(right) / right.length;
  let numerator = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftSquared += leftDelta ** 2;
    rightSquared += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftSquared * rightSquared);
  return denominator ? numerator / denominator : null;
}

function formatFreshness(refreshedAt?: string, nowValue?: string) {
  if (!refreshedAt) return "Refresh time unavailable";
  const refreshed = Date.parse(refreshedAt);
  const now = nowValue ? Date.parse(nowValue) : Date.now();
  if (!Number.isFinite(refreshed) || !Number.isFinite(now) || refreshed > now) {
    return "Refresh time unavailable";
  }
  const minutes = Math.floor((now - refreshed) / 60_000);
  return `Refreshed ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}
