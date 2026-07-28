export const ADMIN_AI_REPORT_CLASSIFICATIONS = [
  "observed",
  "computed",
  "interpretation",
  "recommendation",
  "missing"
] as const;

export type AdminAIReportClassification = (typeof ADMIN_AI_REPORT_CLASSIFICATIONS)[number];

export const ADMIN_AI_EXECUTIVE_REPORT_TYPES = [
  "Weekly Admin Operations Report",
  "Monthly Growth Report",
  "Coach Site Performance Report",
  "Shop Performance Report",
  "Error and Reliability Report",
  "Admin Security and Permissions Review",
  "Backup and Recovery Report"
] as const;

export type AdminAIExecutiveReportType = (typeof ADMIN_AI_EXECUTIVE_REPORT_TYPES)[number];

export const DAILY_ADMIN_BRIEFING_BLOCKS = [
  { id: "platform-health", source: "platform-health", title: "Platform health" },
  { id: "new-coach-sites", source: "coach-sites", title: "New coach sites" },
  { id: "sites-published", source: "coach-sites", title: "Sites published" },
  { id: "shop-purchases", source: "shop-orders", title: "Shop purchases" },
  {
    id: "payment-publish-exceptions",
    source: "shop-orders",
    title: "Payment/publish exceptions"
  },
  {
    id: "top-performing-sites",
    source: "analytics-events",
    title: "Top-performing sites"
  },
  {
    id: "low-performing-sites",
    source: "analytics-events",
    title: "Low-performing sites"
  },
  {
    id: "new-high-priority-errors",
    source: "error-reports",
    title: "New high-priority errors"
  },
  {
    id: "pending-admin-actions",
    source: "admin-actions",
    title: "Pending admin actions"
  },
  { id: "backup-status", source: "backup-recovery", title: "Backup status" },
  {
    id: "recommended-focus",
    source: "admin-ai-report-engine",
    title: "Recommended focus for today"
  }
] as const;

export type AdminAIDailyBriefingBlockId = (typeof DAILY_ADMIN_BRIEFING_BLOCKS)[number]["id"];

export type AdminAIReportFilterValue = boolean | number | string | null;
export type AdminAIReportFilters = Readonly<Record<string, AdminAIReportFilterValue>>;
export type AdminAIReportValue = boolean | number | string | null;

export type AdminAIReportEntryInput = {
  classification: AdminAIReportClassification;
  dateRange?: string;
  filters?: AdminAIReportFilters;
  freshness?: string;
  label: string;
  missingReason?: string;
  source: string;
  value: AdminAIReportValue;
};

export type AdminAIReportEntry = {
  classification: AdminAIReportClassification;
  dateRange: string;
  filters: Record<string, AdminAIReportFilterValue>;
  freshness: string;
  label: string;
  missingReason: string | null;
  source: string;
  value: AdminAIReportValue;
};

type AdminAIReportContextInput = {
  dateRange: string;
  filters: AdminAIReportFilters;
  freshness: string;
  generatedAt: string;
};

type AdminAIReportContext = {
  dateRange: string;
  filters: Record<string, AdminAIReportFilterValue>;
  freshness: string;
  generatedAt: string;
};

export type GenerateAdminAIDailyBriefingInput = AdminAIReportContextInput & {
  blocks?: Partial<Record<AdminAIDailyBriefingBlockId, readonly AdminAIReportEntryInput[]>>;
};

export type GenerateAdminAIExecutiveReportInput = AdminAIReportContextInput & {
  entries: readonly AdminAIReportEntryInput[];
  reportType: AdminAIExecutiveReportType;
};

export type GenerateAdminAISelectedCoachReportInput = AdminAIReportContextInput & {
  entries: readonly AdminAIReportEntryInput[];
  selectedCoach: { id: string; name: string };
  selectedSite: { id: string; name: string };
};

export type AdminAIDailyBriefingSection = {
  entries: AdminAIReportEntry[];
  id: AdminAIDailyBriefingBlockId;
  title: string;
};

export type AdminAIExecutiveReportSection = {
  classification: AdminAIReportClassification;
  entries: AdminAIReportEntry[];
  id: AdminAIReportClassification;
  title: string;
};

type AdminAIReportBase = AdminAIReportContext & {
  title: string;
};

export type AdminAIDailyBriefing = AdminAIReportBase & {
  kind: "daily-briefing";
  sections: AdminAIDailyBriefingSection[];
};

export type AdminAIExecutiveReport = AdminAIReportBase & {
  kind: "executive";
  reportType: AdminAIExecutiveReportType;
  sections: AdminAIExecutiveReportSection[];
};

export type AdminAISelectedCoachReport = AdminAIReportBase & {
  kind: "selected-coach-report";
  reportType: "Coach Site Performance Report" | "Website Readiness Report";
  sections: AdminAIExecutiveReportSection[];
  selectedCoach: { id: string; name: string };
  selectedSite: { id: string; name: string };
};

export type AdminAIReport =
  | AdminAIDailyBriefing
  | AdminAIExecutiveReport
  | AdminAISelectedCoachReport;

export const ADMIN_AI_VERY_LARGE_REPORT_RECORD_THRESHOLD = 500;
export const ADMIN_AI_VERY_LARGE_REPORT_TOKEN_THRESHOLD = 8_000;
const APPROXIMATE_CHARACTERS_PER_TOKEN = 4;
const APPROXIMATE_TOKENS_PER_REPORT_RECORD = 24;
const DEFAULT_REPORT_OUTPUT_TOKEN_ESTIMATE = 700;

export type AdminAIReportSizeInput = {
  contextCharacters?: number;
  recordCount: number;
  requestedOutputTokens?: number;
};

export type AdminAIReportSizeEstimate = {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  recordCount: number;
  veryLarge: boolean;
};

export type AdminAIReportPreflightDecision = "cancel" | "continue";

export type AdminAIReportPreflightResult =
  | {
      estimate: AdminAIReportSizeEstimate;
      status: "cancelled" | "confirmation-required";
      warning: string;
    }
  | {
      estimate: AdminAIReportSizeEstimate;
      status: "ready";
      warning: null;
    };

export type AdminAIReportGenerationResult<T> =
  | {
      estimate: AdminAIReportSizeEstimate;
      status: "cancelled" | "confirmation-required";
      warning: string;
    }
  | {
      estimate: AdminAIReportSizeEstimate;
      report: T;
      status: "generated";
      warning: null;
    };

export type RunAdminAIReportGenerationWithPreflightInput<T> = {
  decision?: AdminAIReportPreflightDecision;
  generate: () => Promise<T> | T;
  size: AdminAIReportSizeInput;
};

const EXECUTIVE_SECTION_TITLES: Record<AdminAIReportClassification, string> = {
  computed: "Computed metrics",
  interpretation: "AI interpretations",
  missing: "Missing data",
  observed: "Observed facts",
  recommendation: "Recommendations"
};

export function estimateAdminAIReportSize(
  input: AdminAIReportSizeInput
): AdminAIReportSizeEstimate {
  const recordCount = nonNegativeInteger(input.recordCount);
  const contextCharacters = nonNegativeInteger(input.contextCharacters ?? 0);
  const estimatedOutputTokens = nonNegativeInteger(
    input.requestedOutputTokens ?? DEFAULT_REPORT_OUTPUT_TOKEN_ESTIMATE
  );
  const estimatedInputTokens =
    Math.ceil(contextCharacters / APPROXIMATE_CHARACTERS_PER_TOKEN) +
    recordCount * APPROXIMATE_TOKENS_PER_REPORT_RECORD;
  const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;
  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens,
    recordCount,
    veryLarge:
      recordCount >= ADMIN_AI_VERY_LARGE_REPORT_RECORD_THRESHOLD ||
      estimatedTotalTokens >= ADMIN_AI_VERY_LARGE_REPORT_TOKEN_THRESHOLD
  };
}

export function evaluateAdminAIReportPreflight(
  size: AdminAIReportSizeInput,
  decision?: AdminAIReportPreflightDecision
): AdminAIReportPreflightResult {
  const estimate = estimateAdminAIReportSize(size);
  const warning = buildAdminAIReportSizeWarning(estimate);

  if (decision === "cancel") {
    return { estimate, status: "cancelled", warning };
  }
  if (estimate.veryLarge && decision !== "continue") {
    return { estimate, status: "confirmation-required", warning };
  }
  return { estimate, status: "ready", warning: null };
}

export async function runAdminAIReportGenerationWithPreflight<T>({
  decision,
  generate,
  size
}: RunAdminAIReportGenerationWithPreflightInput<T>): Promise<AdminAIReportGenerationResult<T>> {
  const preflight = evaluateAdminAIReportPreflight(size, decision);
  if (preflight.status !== "ready") return preflight;

  return {
    estimate: preflight.estimate,
    report: await generate(),
    status: "generated",
    warning: null
  };
}

function buildAdminAIReportSizeWarning(estimate: AdminAIReportSizeEstimate) {
  return `This very large report is estimated to analyze ${estimate.recordCount.toLocaleString("en-US")} records and use about ${estimate.estimatedTotalTokens.toLocaleString("en-US")} tokens. Continue or cancel before generation.`;
}

export function generateAdminAIDailyBriefing(
  input: GenerateAdminAIDailyBriefingInput
): AdminAIDailyBriefing {
  const context = normalizeContext(input);
  const sections = DAILY_ADMIN_BRIEFING_BLOCKS.map((block) => {
    const suppliedEntries = input.blocks?.[block.id] || [];
    const entries = suppliedEntries.length
      ? suppliedEntries.map((entry) => normalizeEntry(entry, context))
      : [
          normalizeEntry(
            {
              classification: "missing",
              label: block.title,
              missingReason: `No real platform data was supplied for ${block.title}.`,
              source: block.source,
              value: null
            },
            context
          )
        ];

    return { entries, id: block.id, title: block.title };
  });

  return {
    ...context,
    kind: "daily-briefing",
    sections,
    title: "Daily Briefing"
  };
}

export function generateAdminAIExecutiveReport(
  input: GenerateAdminAIExecutiveReportInput
): AdminAIExecutiveReport {
  if (!isExecutiveReportType(input.reportType)) {
    throw new Error(`Unsupported executive report type: ${String(input.reportType)}`);
  }

  const context = normalizeContext(input);
  const entries = input.entries.length
    ? input.entries.map((entry) => normalizeEntry(entry, context))
    : [
        normalizeEntry(
          {
            classification: "missing",
            label: "Report data",
            missingReason: `No real platform data was supplied for ${input.reportType}.`,
            source: "unavailable",
            value: null
          },
          context
        )
      ];
  const sections = ADMIN_AI_REPORT_CLASSIFICATIONS.map((classification) => ({
    classification,
    entries: entries.filter((entry) => entry.classification === classification),
    id: classification,
    title: EXECUTIVE_SECTION_TITLES[classification]
  }));

  return {
    ...context,
    kind: "executive",
    reportType: input.reportType,
    sections,
    title: input.reportType
  };
}

export function generateAdminAIWebsiteReadinessReport(
  input: GenerateAdminAISelectedCoachReportInput
) {
  return generateAdminAISelectedCoachReport(input, "Website Readiness Report");
}

export function generateAdminAICoachSitePerformanceReport(
  input: GenerateAdminAISelectedCoachReportInput
) {
  return generateAdminAISelectedCoachReport(input, "Coach Site Performance Report");
}

function generateAdminAISelectedCoachReport(
  input: GenerateAdminAISelectedCoachReportInput,
  reportType: AdminAISelectedCoachReport["reportType"]
): AdminAISelectedCoachReport {
  const selectedCoach = normalizeSelectedIdentity(input.selectedCoach);
  const selectedSite = normalizeSelectedIdentity(input.selectedSite);
  if (!selectedCoach || !selectedSite) {
    throw new Error("Selected coach and site identity are required for this report.");
  }

  const selectionFilters = {
    ...input.filters,
    selectedCoachId: selectedCoach.id,
    selectedSiteId: selectedSite.id
  };
  const context = normalizeContext({ ...input, filters: selectionFilters });
  const entries = input.entries.length
    ? input.entries.map((entry) =>
        normalizeEntry(
          {
            ...entry,
            filters: {
              ...context.filters,
              ...entry.filters,
              selectedCoachId: selectedCoach.id,
              selectedSiteId: selectedSite.id
            }
          },
          context
        )
      )
    : [
        normalizeEntry(
          {
            classification: "missing",
            label: "Report data",
            missingReason: `No real platform data was supplied for ${reportType}.`,
            source: "unavailable",
            value: null
          },
          context
        )
      ];

  return {
    ...context,
    kind: "selected-coach-report",
    reportType,
    sections: ADMIN_AI_REPORT_CLASSIFICATIONS.map((classification) => ({
      classification,
      entries: entries.filter((entry) => entry.classification === classification),
      id: classification,
      title: EXECUTIVE_SECTION_TITLES[classification]
    })),
    selectedCoach,
    selectedSite,
    title: reportType
  };
}

export function formatAdminAIReportText(report: AdminAIReport) {
  const lines = [
    report.title,
    `Generated at: ${report.generatedAt}`,
    `Date range: ${report.dateRange}`,
    `Filters: ${formatFilters(report.filters)}`,
    `Freshness: ${report.freshness}`
  ];

  if (report.kind === "selected-coach-report") {
    lines.splice(
      1,
      0,
      `Selected coach: ${report.selectedCoach.name} (${report.selectedCoach.id})`,
      `Selected site: ${report.selectedSite.name} (${report.selectedSite.id})`
    );
  }

  report.sections.forEach((section, index) => {
    lines.push(
      "",
      report.kind === "daily-briefing" ? `${index + 1}. ${section.title}` : section.title
    );
    section.entries.forEach((entry) => {
      lines.push(
        `- [${entry.classification}] ${entry.label}: ${formatValue(entry.value)}`,
        `  Source: ${entry.source}`,
        `  Date range: ${entry.dateRange}`,
        `  Filters: ${formatFilters(entry.filters)}`,
        `  Freshness: ${entry.freshness}`
      );
      if (entry.missingReason) lines.push(`  Missing: ${entry.missingReason}`);
    });
  });

  return lines.join("\n");
}

export function formatAdminAIReportJson(report: AdminAIReport) {
  return JSON.stringify(report, null, 2);
}

function normalizeContext(input: AdminAIReportContextInput): AdminAIReportContext {
  return {
    dateRange: availableText(input.dateRange),
    filters: normalizeFilters(input.filters),
    freshness: availableText(input.freshness),
    generatedAt: availableText(input.generatedAt)
  };
}

function normalizeSelectedIdentity(value: { id: string; name: string }) {
  const id = cleanText(value?.id);
  const name = cleanText(value?.name);
  return id && name ? { id, name } : null;
}

function normalizeEntry(
  input: AdminAIReportEntryInput,
  context: AdminAIReportContext
): AdminAIReportEntry {
  const label = cleanText(input.label) || "Unlabelled report entry";
  const source = availableText(input.source);
  const dateRange =
    input.dateRange === undefined ? context.dateRange : availableText(input.dateRange);
  const freshness =
    input.freshness === undefined ? context.freshness : availableText(input.freshness);
  const filters =
    input.filters === undefined ? { ...context.filters } : normalizeFilters(input.filters);

  if (input.classification === "missing") {
    return {
      classification: "missing",
      dateRange,
      filters,
      freshness,
      label,
      missingReason: cleanText(input.missingReason) || `No data was supplied for ${label}.`,
      source,
      value: null
    };
  }

  if (isMissingValue(input.value)) {
    return {
      classification: "missing",
      dateRange,
      filters,
      freshness,
      label,
      missingReason: cleanText(input.missingReason) || `No value was supplied for ${label}.`,
      source,
      value: null
    };
  }

  const missingProvenance = [
    source === "unavailable" ? "source" : null,
    dateRange === "unavailable" ? "date range" : null,
    freshness === "unavailable" ? "freshness" : null
  ].filter((item): item is string => item !== null);

  if (missingProvenance.length) {
    return {
      classification: "missing",
      dateRange,
      filters,
      freshness,
      label,
      missingReason: `Required provenance is unavailable: ${joinList(missingProvenance)}.`,
      source,
      value: null
    };
  }

  return {
    classification: input.classification,
    dateRange,
    filters,
    freshness,
    label,
    missingReason: null,
    source,
    value: normalizeValue(input.value)
  };
}

function isExecutiveReportType(value: string): value is AdminAIExecutiveReportType {
  return (ADMIN_AI_EXECUTIVE_REPORT_TYPES as readonly string[]).includes(value);
}

function isMissingValue(value: AdminAIReportValue) {
  return (
    value === null ||
    (typeof value === "string" && cleanText(value) === "") ||
    (typeof value === "number" && !Number.isFinite(value))
  );
}

function normalizeValue(value: AdminAIReportValue): AdminAIReportValue {
  return typeof value === "string" ? cleanText(value) : value;
}

function normalizeFilters(filters: AdminAIReportFilters | undefined) {
  const normalized: Record<string, AdminAIReportFilterValue> = {};
  Object.entries(filters || {})
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .forEach(([key, value]) => {
      normalized[key] = value;
    });
  return normalized;
}

function cleanText(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function availableText(value: string | undefined) {
  return cleanText(value) || "unavailable";
}

function formatFilters(filters: AdminAIReportFilters) {
  const entries = Object.entries(filters);
  return entries.length
    ? entries.map(([key, value]) => `${key}=${String(value)}`).join(", ")
    : "none";
}

function formatValue(value: AdminAIReportValue) {
  return value === null ? "unavailable" : String(value);
}

function joinList(items: string[]) {
  if (items.length < 2) return items[0] || "required metadata";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${items.at(-1)}`;
}

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
