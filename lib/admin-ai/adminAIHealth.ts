/**
 * Pure Admin AI health intelligence primitives.
 *
 * The caller owns data collection and detection policies. This module only
 * validates real evidence, exposes the authoritative taxonomies, and produces
 * deterministic alerts, anomaly explanations, and transparent score output.
 */

export const ADMIN_AI_HEALTH_CATEGORIES = [
  { id: "failed-publishes", label: "Failed publishes" },
  { id: "repeated-api-failures", label: "Repeated API failures" },
  {
    id: "payment-success-publish-pending-mismatches",
    label: "Payment-success/publish-pending mismatches"
  },
  { id: "broken-public-routes", label: "Broken public routes" },
  { id: "invalid-cta-links", label: "Invalid CTA links" },
  { id: "missing-registration-links", label: "Missing registration links" },
  { id: "unusually-high-error-count", label: "Unusually high error count" },
  { id: "backup-failures", label: "Backup failures" },
  { id: "missing-backup-destination", label: "Missing backup destination" },
  { id: "backup-delay", label: "Backup delay" },
  { id: "analytics-ingestion-failures", label: "Analytics ingestion failures" },
  { id: "stale-drafts", label: "Stale drafts" },
  { id: "sites-without-recent-analytics", label: "Sites without recent analytics" },
  { id: "unusual-permission-changes", label: "Unusual permission changes" },
  { id: "repeated-failed-otp-attempts", label: "Repeated failed OTP attempts" },
  { id: "admin-action-failure-spikes", label: "Admin action failure spikes" }
] as const;

export const ADMIN_AI_HEALTH_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "informational"
] as const;

export const ADMIN_AI_ANOMALY_CATEGORIES = [
  { id: "unexpected-traffic-drop", label: "Unexpected traffic drop" },
  { id: "click-spike", label: "Click spike" },
  { id: "conversion-collapse", label: "Conversion collapse" },
  { id: "repeated-publish-failure", label: "Repeated publish failure" },
  { id: "payment-mismatch", label: "Payment mismatch" },
  { id: "unusually-frequent-admin-edits", label: "Unusually frequent admin edits" },
  { id: "sudden-rise-in-404-errors", label: "Sudden rise in 404 errors" },
  { id: "repeated-otp-failure", label: "Repeated OTP failure" },
  { id: "unusual-role-change", label: "Unusual role change" },
  { id: "backup-delay", label: "Backup delay" },
  { id: "analytics-event-interruption", label: "Analytics event interruption" }
] as const;

export const ADMIN_AI_HEALTH_SCORE_DIMENSIONS = [
  { id: "site-health", label: "Site health" },
  { id: "publish-health", label: "Publish health" },
  { id: "payment-reconciliation", label: "Payment reconciliation" },
  { id: "analytics-reliability", label: "Analytics reliability" },
  { id: "error-backlog", label: "Error backlog" },
  { id: "backup-freshness", label: "Backup freshness" },
  { id: "security-configuration", label: "Security configuration" },
  { id: "data-completeness", label: "Data completeness" }
] as const;

export const ADMIN_AI_HEALTH_SAFE_ACTION_IDS = [
  "admin-users.find-problems",
  "backup-cleanup.find-problems",
  "coach-analytics.find-problems",
  "coach-sites.check-links",
  "coach-sites.find-problems",
  "create-coach-site.find-problems",
  "error-reports.triage",
  "global.investigate",
  "shop.recovery-review"
] as const;

export type AdminAIHealthCategory = (typeof ADMIN_AI_HEALTH_CATEGORIES)[number]["id"];
export type AdminAIHealthSeverity = (typeof ADMIN_AI_HEALTH_SEVERITIES)[number];
export type AdminAIAnomalyCategory = (typeof ADMIN_AI_ANOMALY_CATEGORIES)[number]["id"];
export type AdminAIHealthScoreDimension = (typeof ADMIN_AI_HEALTH_SCORE_DIMENSIONS)[number]["id"];
export type AdminAIHealthSafeActionId = (typeof ADMIN_AI_HEALTH_SAFE_ACTION_IDS)[number];
export type AdminAIEvidenceValue = boolean | number | string;

export type AdminAIHealthEvidenceFact = Readonly<{
  observedAt: string;
  source: string;
  summary: string;
  value?: AdminAIEvidenceValue;
}>;

export type AdminAIHealthEvidenceInput = Readonly<{
  affectedEntity: string;
  category: AdminAIHealthCategory;
  directRoute: string;
  evidence: readonly AdminAIHealthEvidenceFact[];
  firstDetected: string;
  id: string;
  lastDetected: string;
  impact: string;
  module: string;
  recurrenceCount: number;
  safeActionId?: AdminAIHealthSafeActionId | null;
  severity: AdminAIHealthSeverity;
  suggestedNextStep: string;
  whatHappened: string;
}>;

export type AdminAIHealthAlert = Readonly<{
  affectedEntity: string;
  category: AdminAIHealthCategory;
  directRoute: string;
  evidence: readonly AdminAIHealthEvidenceFact[];
  firstDetected: string;
  id: string;
  lastDetected: string;
  impact: string;
  module: string;
  recurrenceCount: number;
  safeActionId: AdminAIHealthSafeActionId | null;
  severity: AdminAIHealthSeverity;
  suggestedNextStep: string;
  whatHappened: string;
}>;

export type AdminAIAnomalyHistoryInput = Readonly<{
  affectedEntity: string;
  baselineDescription: string;
  baselineObservations: readonly AdminAIHealthEvidenceFact[];
  category: AdminAIAnomalyCategory;
  direction: "decrease" | "increase";
  id: string;
  minimumBaselineSize: number;
  module: string;
  observed: AdminAIHealthEvidenceFact;
  recommendedVerification: string;
  thresholdPercent: number;
}>;

export type AdminAIAnomaly = Readonly<{
  affectedEntity: string;
  baseline: Readonly<{
    description: string;
    minimumSampleSize: number;
    sampleSize: number;
  }>;
  category: AdminAIAnomalyCategory;
  confidence: "high" | "low" | "medium";
  dataRange: Readonly<{
    from: string;
    to: string;
  }>;
  detectionMethod: string;
  deviation: string;
  evidence: readonly AdminAIHealthEvidenceFact[];
  id: string;
  module: string;
  observedValue: number | string;
  recommendedVerification: string;
}>;

export type AdminAIAnomalyAnalysis = Readonly<{
  anomalies: readonly AdminAIAnomaly[];
  insufficientBaselineCategories: readonly AdminAIAnomalyCategory[];
  message: "Insufficient baseline" | null;
  status: "insufficient-baseline" | "partial" | "ready";
}>;

export type AdminAIHealthScoreExactInput = Readonly<{
  label: string;
  observedAt: string;
  source: string;
  value: AdminAIEvidenceValue;
}>;

export type AdminAIHealthScoreDimensionInput = Readonly<{
  calculation: string;
  dimension: AdminAIHealthScoreDimension;
  exactInputs: readonly AdminAIHealthScoreExactInput[];
  howToImprove: readonly string[];
  missingInputs: readonly string[];
  score: number | null;
  weight: number;
}>;

export type AdminAIHealthScoreComponent = Readonly<{
  calculation: string | null;
  exactInputs: readonly AdminAIHealthScoreExactInput[];
  howToImprove: readonly string[];
  id: AdminAIHealthScoreDimension;
  label: string;
  missingInputs: readonly string[];
  score: number | null;
  weight: number | null;
}>;

export type AdminAIHealthScore = Readonly<{
  calculatedAt: string;
  calculation: string | null;
  components: readonly AdminAIHealthScoreComponent[];
  missingInputs: readonly string[];
  score: number | null;
}>;

export type AdminAIHealthScoreInput = Readonly<{
  calculatedAt: string;
  dimensions: readonly AdminAIHealthScoreDimensionInput[];
}>;

const HEALTH_CATEGORY_IDS = new Set<string>(ADMIN_AI_HEALTH_CATEGORIES.map(({ id }) => id));
const ANOMALY_CATEGORY_IDS = new Set<string>(ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }) => id));
const HEALTH_SEVERITY_IDS = new Set<string>(ADMIN_AI_HEALTH_SEVERITIES);
const SAFE_ACTION_IDS = new Set<string>(ADMIN_AI_HEALTH_SAFE_ACTION_IDS);
const GLOBAL_SAFE_ACTION_ID: AdminAIHealthSafeActionId = "global.investigate";

const HEALTH_ACTION_ALLOWLIST: Readonly<
  Record<AdminAIHealthCategory, readonly AdminAIHealthSafeActionId[]>
> = {
  "admin-action-failure-spikes": ["error-reports.triage", GLOBAL_SAFE_ACTION_ID],
  "analytics-ingestion-failures": ["coach-analytics.find-problems", GLOBAL_SAFE_ACTION_ID],
  "backup-delay": ["backup-cleanup.find-problems", GLOBAL_SAFE_ACTION_ID],
  "backup-failures": ["backup-cleanup.find-problems", GLOBAL_SAFE_ACTION_ID],
  "broken-public-routes": ["coach-sites.find-problems", GLOBAL_SAFE_ACTION_ID],
  "failed-publishes": [
    "create-coach-site.find-problems",
    "shop.recovery-review",
    GLOBAL_SAFE_ACTION_ID
  ],
  "invalid-cta-links": ["coach-sites.check-links", GLOBAL_SAFE_ACTION_ID],
  "missing-backup-destination": ["backup-cleanup.find-problems", GLOBAL_SAFE_ACTION_ID],
  "missing-registration-links": ["coach-sites.check-links", GLOBAL_SAFE_ACTION_ID],
  "payment-success-publish-pending-mismatches": ["shop.recovery-review", GLOBAL_SAFE_ACTION_ID],
  "repeated-api-failures": ["error-reports.triage", GLOBAL_SAFE_ACTION_ID],
  "repeated-failed-otp-attempts": ["admin-users.find-problems", GLOBAL_SAFE_ACTION_ID],
  "sites-without-recent-analytics": ["coach-analytics.find-problems", GLOBAL_SAFE_ACTION_ID],
  "stale-drafts": ["coach-sites.find-problems", GLOBAL_SAFE_ACTION_ID],
  "unusual-permission-changes": ["admin-users.find-problems", GLOBAL_SAFE_ACTION_ID],
  "unusually-high-error-count": ["error-reports.triage", GLOBAL_SAFE_ACTION_ID]
};

const SEVERITY_ORDER = new Map<AdminAIHealthSeverity, number>(
  ADMIN_AI_HEALTH_SEVERITIES.map((severity, index) => [severity, index])
);
const HEALTH_CATEGORY_ORDER = new Map<AdminAIHealthCategory, number>(
  ADMIN_AI_HEALTH_CATEGORIES.map(({ id }, index) => [id, index])
);
const ANOMALY_CATEGORY_ORDER = new Map<AdminAIAnomalyCategory, number>(
  ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }, index) => [id, index])
);

export function buildAdminAIHealthAlerts(
  inputs: readonly AdminAIHealthEvidenceInput[]
): AdminAIHealthAlert[] {
  return inputs
    .map(normalizeHealthAlert)
    .filter((alert): alert is AdminAIHealthAlert => alert !== null)
    .sort(
      (left, right) =>
        (SEVERITY_ORDER.get(left.severity) ?? Number.MAX_SAFE_INTEGER) -
          (SEVERITY_ORDER.get(right.severity) ?? Number.MAX_SAFE_INTEGER) ||
        (HEALTH_CATEGORY_ORDER.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
          (HEALTH_CATEGORY_ORDER.get(right.category) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id)
    );
}

export function analyzeAdminAIAnomalies(
  input: Readonly<{ histories: readonly AdminAIAnomalyHistoryInput[] }>
): AdminAIAnomalyAnalysis {
  const histories = Array.isArray(input?.histories) ? input.histories : [];
  const normalized = histories.map(normalizeAnomalyHistory);
  const sufficientCategories = new Set(
    normalized
      .filter((history): history is NormalizedAnomalyHistory => history !== null)
      .map(({ category }) => category)
  );
  const insufficientBaselineCategories = ADMIN_AI_ANOMALY_CATEGORIES.map(({ id }) => id).filter(
    (category) => !sufficientCategories.has(category)
  );
  const anomalies = normalized
    .map((history) => (history ? detectAnomaly(history) : null))
    .filter((anomaly): anomaly is AdminAIAnomaly => anomaly !== null)
    .sort(
      (left, right) =>
        (ANOMALY_CATEGORY_ORDER.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
          (ANOMALY_CATEGORY_ORDER.get(right.category) ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id)
    );
  const message = insufficientBaselineCategories.length ? ("Insufficient baseline" as const) : null;
  const status = insufficientBaselineCategories.length
    ? anomalies.length
      ? ("partial" as const)
      : ("insufficient-baseline" as const)
    : ("ready" as const);

  return { anomalies, insufficientBaselineCategories, message, status };
}

export function buildAdminAIHealthScore(input: AdminAIHealthScoreInput): AdminAIHealthScore {
  const calculatedAt = cleanText(input.calculatedAt, 80);
  if (!isTimestamp(calculatedAt)) {
    throw new TypeError("calculatedAt must be a valid timestamp supplied by the caller");
  }

  const components = ADMIN_AI_HEALTH_SCORE_DIMENSIONS.map(({ id, label }) => {
    const matches = input.dimensions.filter(({ dimension }) => dimension === id);
    if (matches.length !== 1) {
      const missing =
        matches.length === 0
          ? `${label} score and exact inputs`
          : `One unambiguous ${label} component`;
      return missingScoreComponent(id, label, missing);
    }
    return normalizeScoreComponent(matches[0], label);
  });
  const missingInputs = unique(
    components.flatMap(({ missingInputs: componentMissing }) => componentMissing)
  );
  const componentScores = components.map(({ score }) => score);
  const componentWeights = components.map(({ weight }) => weight);
  const canCalculateTotal =
    componentScores.every((value): value is number => value !== null) &&
    componentWeights.every((value): value is number => value !== null);
  const totalWeight = canCalculateTotal
    ? componentWeights.reduce((total, weight) => total + weight, 0)
    : 0;
  const score = canCalculateTotal
    ? roundToTwo(
        components.reduce((total, component) => total + component.score! * component.weight!, 0) /
          totalWeight
      )
    : null;
  const calculation = canCalculateTotal
    ? `Weighted average of ${components.length} component scores using caller-supplied weights (total weight: ${roundToTwo(totalWeight)}).`
    : null;

  return { calculatedAt, calculation, components, missingInputs, score };
}

function normalizeHealthAlert(input: AdminAIHealthEvidenceInput): AdminAIHealthAlert | null {
  if (!HEALTH_CATEGORY_IDS.has(input.category) || !HEALTH_SEVERITY_IDS.has(input.severity)) {
    return null;
  }

  const evidence = normalizeEvidence(input.evidence);
  const id = cleanText(input.id, 120);
  const affectedEntity = cleanText(input.affectedEntity, 180);
  const moduleName = cleanText(input.module, 120);
  const whatHappened = cleanText(input.whatHappened, 500);
  const impact = cleanText(input.impact, 500);
  const suggestedNextStep = cleanText(input.suggestedNextStep, 500);
  const directRoute = cleanText(input.directRoute, 300);
  const firstDetected = cleanText(input.firstDetected, 80);
  const lastDetected = cleanText(input.lastDetected, 80);
  const firstTime = Date.parse(firstDetected);
  const lastTime = Date.parse(lastDetected);

  if (
    evidence.length === 0 ||
    !id ||
    !affectedEntity ||
    !moduleName ||
    !whatHappened ||
    !impact ||
    !suggestedNextStep ||
    !isSafeAdminRoute(directRoute) ||
    !Number.isFinite(firstTime) ||
    !Number.isFinite(lastTime) ||
    firstTime > lastTime ||
    !Number.isInteger(input.recurrenceCount) ||
    input.recurrenceCount < 1
  ) {
    return null;
  }

  return {
    affectedEntity,
    category: input.category,
    directRoute,
    evidence,
    firstDetected,
    id,
    lastDetected,
    impact,
    module: moduleName,
    recurrenceCount: input.recurrenceCount,
    safeActionId: normalizeSafeAction(input.category, input.safeActionId),
    severity: input.severity,
    suggestedNextStep,
    whatHappened
  };
}

type NumericAnomalyObservation = AdminAIHealthEvidenceFact & { value: number };

type NormalizedAnomalyHistory = Readonly<{
  affectedEntity: string;
  baselineDescription: string;
  baselineObservations: readonly NumericAnomalyObservation[];
  category: AdminAIAnomalyCategory;
  direction: "decrease" | "increase";
  id: string;
  minimumBaselineSize: number;
  module: string;
  observed: NumericAnomalyObservation;
  recommendedVerification: string;
  thresholdPercent: number;
}>;

function normalizeAnomalyHistory(
  input: AdminAIAnomalyHistoryInput
): NormalizedAnomalyHistory | null {
  if (!input || !ANOMALY_CATEGORY_IDS.has(input.category)) return null;

  const affectedEntity = cleanText(input.affectedEntity, 180);
  const baselineDescription = cleanText(input.baselineDescription, 300);
  const baselineObservations = (
    Array.isArray(input.baselineObservations) ? input.baselineObservations : []
  )
    .map(normalizeNumericAnomalyObservation)
    .filter((observation): observation is NumericAnomalyObservation => observation !== null)
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
  const id = cleanText(input.id, 120);
  const moduleName = cleanText(input.module, 120);
  const observed = normalizeNumericAnomalyObservation(input.observed);
  const recommendedVerification = cleanText(input.recommendedVerification, 500);
  const hasMinimumBaseline =
    Number.isInteger(input.minimumBaselineSize) &&
    input.minimumBaselineSize >= 1 &&
    baselineObservations.length >= input.minimumBaselineSize;
  const hasThreshold = Number.isFinite(input.thresholdPercent) && input.thresholdPercent > 0;

  if (
    !affectedEntity ||
    !baselineDescription ||
    !hasMinimumBaseline ||
    !id ||
    !moduleName ||
    !observed ||
    !recommendedVerification ||
    !hasThreshold ||
    !["decrease", "increase"].includes(input.direction)
  ) {
    return null;
  }

  return {
    affectedEntity,
    baselineDescription,
    baselineObservations,
    category: input.category,
    direction: input.direction,
    id,
    minimumBaselineSize: input.minimumBaselineSize,
    module: moduleName,
    observed,
    recommendedVerification,
    thresholdPercent: input.thresholdPercent
  };
}

function detectAnomaly(input: NormalizedAnomalyHistory): AdminAIAnomaly | null {
  const baselineAverage =
    input.baselineObservations.reduce((total, observation) => total + observation.value, 0) /
    input.baselineObservations.length;
  if (!Number.isFinite(baselineAverage) || baselineAverage === 0) return null;

  const signedDeviationPercent =
    ((input.observed.value - baselineAverage) / Math.abs(baselineAverage)) * 100;
  const directionalDeviation =
    input.direction === "increase" ? signedDeviationPercent : -signedDeviationPercent;
  if (!Number.isFinite(directionalDeviation) || directionalDeviation < input.thresholdPercent) {
    return null;
  }

  const evidence = [...input.baselineObservations, input.observed];
  const timestamps = evidence.map(({ observedAt }) => observedAt).sort();
  const absoluteDeviation = roundToTwo(Math.abs(signedDeviationPercent));
  const directionLabel = signedDeviationPercent >= 0 ? "above" : "below";

  return {
    affectedEntity: input.affectedEntity,
    baseline: {
      description: input.baselineDescription,
      minimumSampleSize: input.minimumBaselineSize,
      sampleSize: input.baselineObservations.length
    },
    category: input.category,
    confidence: anomalyConfidence(input, absoluteDeviation),
    dataRange: {
      from: timestamps[0],
      to: timestamps[timestamps.length - 1]
    },
    detectionMethod: `Compared the observed value with the average of ${input.baselineObservations.length} historical observations and applied a ${roundToTwo(input.thresholdPercent)}% ${input.direction} threshold.`,
    deviation: `${absoluteDeviation}% ${directionLabel} baseline`,
    evidence,
    id: input.id,
    module: input.module,
    observedValue: input.observed.value,
    recommendedVerification: input.recommendedVerification
  };
}

function anomalyConfidence(
  input: NormalizedAnomalyHistory,
  absoluteDeviation: number
): "high" | "low" | "medium" {
  const sampleRatio = input.baselineObservations.length / input.minimumBaselineSize;
  if (input.baselineObservations.length >= 20 && sampleRatio >= 2) return "high";
  if (sampleRatio >= 1.5 || absoluteDeviation >= input.thresholdPercent * 2) return "medium";
  return "low";
}

function normalizeNumericAnomalyObservation(
  input: AdminAIHealthEvidenceFact
): NumericAnomalyObservation | null {
  const [observation] = normalizeEvidence(input ? [input] : []);
  if (!observation || typeof observation.value !== "number") return null;
  return observation as NumericAnomalyObservation;
}

function normalizeScoreComponent(
  input: AdminAIHealthScoreDimensionInput,
  label: string
): AdminAIHealthScoreComponent {
  const exactInputs = input.exactInputs
    .map(normalizeScoreInput)
    .filter((exactInput): exactInput is AdminAIHealthScoreExactInput => exactInput !== null);
  const calculation = cleanText(input.calculation, 500);
  const missingInputs = unique(
    input.missingInputs.map((missing) => cleanText(missing, 240)).filter(Boolean)
  );
  if (exactInputs.length === 0) missingInputs.push(`${label} exact inputs`);
  if (!calculation) missingInputs.push(`${label} calculation`);
  if (
    input.score === null ||
    !Number.isFinite(input.score) ||
    input.score < 0 ||
    input.score > 100
  ) {
    missingInputs.push(`${label} score between 0 and 100`);
  }
  const hasValidWeight = Number.isFinite(input.weight) && input.weight > 0;
  if (!hasValidWeight) missingInputs.push(`${label} weight greater than 0`);
  const normalizedMissingInputs = unique(missingInputs);
  const canScore = normalizedMissingInputs.length === 0;
  const howToImprove = unique(
    input.howToImprove.map((step) => cleanText(step, 500)).filter(Boolean)
  );

  return {
    calculation: calculation || null,
    exactInputs,
    howToImprove: howToImprove.length
      ? howToImprove
      : [`Provide verified ${label.toLowerCase()} inputs and an explicit calculation.`],
    id: input.dimension,
    label,
    missingInputs: normalizedMissingInputs,
    score: canScore && input.score !== null ? roundToTwo(input.score) : null,
    weight: canScore && hasValidWeight ? roundToTwo(input.weight) : null
  };
}

function missingScoreComponent(
  id: AdminAIHealthScoreDimension,
  label: string,
  missing: string
): AdminAIHealthScoreComponent {
  return {
    calculation: null,
    exactInputs: [],
    howToImprove: [`Provide verified ${label.toLowerCase()} inputs and an explicit calculation.`],
    id,
    label,
    missingInputs: [missing],
    score: null,
    weight: null
  };
}

function normalizeEvidence(
  evidence: readonly AdminAIHealthEvidenceFact[]
): AdminAIHealthEvidenceFact[] {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map((fact) => {
      const source = cleanText(fact?.source, 180);
      const summary = cleanText(fact?.summary, 500);
      const observedAt = cleanText(fact?.observedAt, 80);
      const value = normalizeEvidenceValue(fact?.value);
      if (!source || !summary || !isTimestamp(observedAt) || value === null) return null;
      return value === undefined
        ? { observedAt, source, summary }
        : { observedAt, source, summary, value };
    })
    .filter((fact): fact is AdminAIHealthEvidenceFact => fact !== null);
}

function normalizeScoreInput(
  input: AdminAIHealthScoreExactInput
): AdminAIHealthScoreExactInput | null {
  const label = cleanText(input?.label, 180);
  const observedAt = cleanText(input?.observedAt, 80);
  const source = cleanText(input?.source, 180);
  const value = normalizeEvidenceValue(input?.value);
  if (!label || !source || !isTimestamp(observedAt) || value === null || value === undefined) {
    return null;
  }
  return { label, observedAt, source, value };
}

function normalizeSafeAction(
  category: AdminAIHealthCategory,
  actionId: AdminAIHealthSafeActionId | null | undefined
): AdminAIHealthSafeActionId | null {
  if (
    typeof actionId !== "string" ||
    !SAFE_ACTION_IDS.has(actionId) ||
    !HEALTH_ACTION_ALLOWLIST[category].includes(actionId as AdminAIHealthSafeActionId)
  ) {
    return null;
  }
  return actionId as AdminAIHealthSafeActionId;
}

function isSafeAdminRoute(route: string): boolean {
  return /^\/admin(?:\/|\?|#|$)/.test(route) && !route.startsWith("//") && !route.includes("\\");
}

function isTimestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function normalizeEvidenceValue(value: unknown): AdminAIEvidenceValue | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return cleanText(value, 500) || null;
  return null;
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
