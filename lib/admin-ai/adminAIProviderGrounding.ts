import type { AdminAIProviderResponse, AdminAITaskType } from "./adminAIModelRouting";

export type AdminAIRequirementFact = {
  id: string;
  unit: "day" | "hour" | "minute" | "month" | "percent" | "week" | "year";
  value: number;
};

export type AdminAIProtectedProviderInput = {
  dateRange: string;
  freshness: string;
  metrics: {
    permissionVisibleEntityCount: number;
    sourceErrorCount: number;
    visibleMetricCount: number;
    warningCount: number;
  };
  requirementFacts: AdminAIRequirementFact[];
  scope: string;
  section: string;
  task: AdminAITaskType;
  version: 2;
};

const REQUIREMENT_CUE =
  /\b(?:requirement|specification|policy|retention|sla|limit|ceiling|budget|threshold)s?\b/i;
const REQUIREMENT_FACT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(?:-\s*)?(days?|hours?|minutes?|weeks?|months?|years?|percent|%)\b/gi;
const REQUIREMENT_UNITS: Record<string, AdminAIRequirementFact["unit"]> = {
  "%": "percent",
  day: "day",
  days: "day",
  hour: "hour",
  hours: "hour",
  minute: "minute",
  minutes: "minute",
  month: "month",
  months: "month",
  percent: "percent",
  week: "week",
  weeks: "week",
  year: "year",
  years: "year"
};

export const ADMIN_AI_PROMPT_INJECTION_PATTERNS = [
  /ignore (all |any |the )?(admin|previous|security|system) (instructions|permissions|rules)/i,
  /ignore (all |any |the )?permissions/i,
  /bypass .{0,24}\b(confirmation|otp|permission|rbac|security|validation)/i,
  /\b(give|reveal|show).{0,24}\b(otp|session cookie|secret|token)\b/i,
  /reveal (api|payment|private|session).{0,20}(key|secret|token|cookie)/i,
  /show (all )?(otp|session cookie|secret|token)/i,
  /call (an )?(arbitrary|unknown|unregistered) (api|tool)/i,
  /pretend (the )?action (worked|succeeded)/i,
  /fabricate (analytics|data|metric|result)/i
] as const;

export function extractAdminAIRequirementFacts(
  query: string,
  task: AdminAITaskType
): AdminAIRequirementFact[] {
  if (task !== "requirement-conflict-analysis") return [];

  const facts: AdminAIRequirementFact[] = [];
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 4_000);
  for (const match of normalized.matchAll(REQUIREMENT_FACT_PATTERN)) {
    if (facts.length >= 8) break;
    const matchIndex = match.index || 0;
    const nearby = normalized.slice(
      Math.max(0, matchIndex - 80),
      matchIndex + match[0].length + 80
    );
    if (!REQUIREMENT_CUE.test(nearby)) continue;

    const value = Number(match[1]);
    const unit = REQUIREMENT_UNITS[match[2].toLowerCase()];
    if (!unit || !Number.isFinite(value) || value <= 0 || value > 1_000_000) continue;
    facts.push({
      id: `requirement-${String.fromCharCode(97 + facts.length)}`,
      unit,
      value
    });
  }
  return facts;
}

export function parseAdminAIProtectedProviderInput(
  value: string
): AdminAIProtectedProviderInput | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.metrics)) return null;
    const metrics = {
      permissionVisibleEntityCount: finiteCount(parsed.metrics.permissionVisibleEntityCount),
      sourceErrorCount: finiteCount(parsed.metrics.sourceErrorCount),
      visibleMetricCount: finiteCount(parsed.metrics.visibleMetricCount),
      warningCount: finiteCount(parsed.metrics.warningCount)
    };
    if (Object.values(metrics).some((metric) => metric === null)) return null;
    if (!Array.isArray(parsed.requirementFacts) || parsed.requirementFacts.length > 8) return null;
    const requirementFacts = parsed.requirementFacts.map(normalizeRequirementFact);
    if (requirementFacts.some((fact) => !fact)) return null;
    if (
      typeof parsed.dateRange !== "string" ||
      typeof parsed.freshness !== "string" ||
      typeof parsed.scope !== "string" ||
      typeof parsed.section !== "string" ||
      typeof parsed.task !== "string"
    ) {
      return null;
    }

    return {
      dateRange: parsed.dateRange.slice(0, 100),
      freshness: parsed.freshness.slice(0, 40),
      metrics: metrics as AdminAIProtectedProviderInput["metrics"],
      requirementFacts: requirementFacts as AdminAIRequirementFact[],
      scope: parsed.scope.slice(0, 40),
      section: parsed.section.slice(0, 100),
      task: parsed.task as AdminAITaskType,
      version: 2
    };
  } catch {
    return null;
  }
}

export function isAdminAIProviderNarrativeGrounded(
  value: string,
  protectedInput: Pick<AdminAIProtectedProviderInput, "metrics" | "requirementFacts">
) {
  return (
    isSafeProviderNarrative(value) && isProviderNarrativeNumericallyGrounded(value, protectedInput)
  );
}

export function buildAdminAIRejectedProviderResponse(
  value: AdminAIProviderResponse
): Exclude<AdminAIProviderResponse, string> {
  if (typeof value === "string") return { output: "" };
  return {
    model: value.model,
    modelVersion: value.modelVersion,
    output: "",
    provider: value.provider,
    usage: value.usage
  };
}

function normalizeRequirementFact(value: unknown): AdminAIRequirementFact | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const unit = typeof value.unit === "string" ? REQUIREMENT_UNITS[value.unit] : undefined;
  const numericValue = typeof value.value === "number" ? value.value : Number.NaN;
  if (
    !/^requirement-[a-h]$/.test(id) ||
    !unit ||
    !Number.isFinite(numericValue) ||
    numericValue <= 0 ||
    numericValue > 1_000_000
  ) {
    return null;
  }
  return { id, unit, value: numericValue };
}

function isSafeProviderNarrative(value: string) {
  if (!value.trim() || value.length > 4_000) return false;
  if (
    [
      ...ADMIN_AI_PROMPT_INJECTION_PATTERNS,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      /(?:\+\d[\d\s().-]{7,}\d|\(\d{2,4}\)\s*\d[\d\s.-]{5,}\d|\b\d{10,15}\b)/,
      /\b(?:api[-_ ]?key|access[-_ ]?token|client[-_ ]?secret|password|otp|private[-_ ]?key)\s*[:=]\s*\S+/i,
      /\b(?:sk|pk|rk)[-_](?:live|test)[-_][A-Za-z0-9_-]{6,}\b/i,
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/
    ].some((pattern) => pattern.test(value))
  ) {
    return false;
  }
  return true;
}

function isProviderNarrativeNumericallyGrounded(
  value: string,
  protectedInput: Pick<AdminAIProtectedProviderInput, "metrics" | "requirementFacts">
) {
  const claims = extractNumericClaims(value);
  if (!claims.length) return true;

  const metricValues = Object.values(protectedInput.metrics).filter(Number.isFinite);
  const requirementValues = protectedInput.requirementFacts.map(
    ({ value: requirementValue }) => requirementValue
  );
  const evidenceValues = [...metricValues, ...requirementValues];
  const supportedNumbers = new Set(evidenceValues);
  const supportedPercentages = new Set(
    protectedInput.requirementFacts
      .filter(({ unit }) => unit === "percent")
      .map(({ value: requirementValue }) => requirementValue)
  );

  for (const left of metricValues) {
    for (const right of metricValues) {
      if (right !== 0) {
        addRoundedValues(supportedNumbers, left / right);
        addRoundedValues(supportedPercentages, (left / right) * 100);
      }
    }
  }

  return claims.every((claim) => {
    if (claim.unit === "currency") return false;
    if (claim.unit !== "number" && claim.unit !== "percent") {
      return protectedInput.requirementFacts.some(
        (fact) => fact.unit === claim.unit && numbersMatch(fact.value, claim.value)
      );
    }
    const supported = claim.unit === "percent" ? supportedPercentages : supportedNumbers;
    return Array.from(supported).some((supportedValue) =>
      numbersMatch(supportedValue, claim.value)
    );
  });
}

function extractNumericClaims(value: string) {
  const normalized = value.replace(/(\d)-(?=\d)/g, "$1 ");
  return Array.from(
    normalized.matchAll(/[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[+-]?\d+)?%?/gi)
  ).flatMap((match) => {
    const raw = match[0];
    const numericValue = Number(raw.replace(/[,%]/g, ""));
    if (!Number.isFinite(numericValue)) return [];
    const prefix = normalized[(match.index || 0) - 1];
    const suffix = normalized
      .slice((match.index || 0) + raw.length)
      .match(/^\s*(?:-\s*)?(days?|hours?|minutes?|weeks?|months?|years?|percent)\b/i);
    const requirementUnit = suffix ? REQUIREMENT_UNITS[suffix[1].toLowerCase()] : undefined;
    return [
      {
        unit: /[$€£₹]/.test(prefix || "")
          ? ("currency" as const)
          : raw.endsWith("%")
            ? ("percent" as const)
            : requirementUnit || ("number" as const),
        value: numericValue
      }
    ];
  });
}

function addRoundedValues(target: Set<number>, value: number) {
  for (let precision = 0; precision <= 2; precision += 1) {
    target.add(Number(value.toFixed(precision)));
  }
}

function numbersMatch(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(1e-9, Math.abs(left) * 1e-9);
}

function finiteCount(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000
    ? Number(value)
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
