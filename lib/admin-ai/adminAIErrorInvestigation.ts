export type AdminAIErrorReportFact = {
  affectedEntity?: string;
  changeSummary?: string;
  createdAt: string;
  deployId?: string;
  errorCode: string;
  module: string;
  referenceId: string;
  route: string;
  safeMessage: string;
  severity: "high" | "low" | "medium";
  resolutionEvidence?: {
    resolvedAt: string;
    summary: string;
    trusted: boolean;
  };
  sourceFiles: string[];
  sourceFilesTrusted: boolean;
  status?: "Fixed" | "Ignored" | "New" | "Reviewing";
  statusTrusted?: boolean;
  updatedAt?: string;
};

export const ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS = 30;

const ADMIN_AI_STALE_ERROR_THRESHOLD_MS = ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
const ACTIVE_ERROR_STATUSES = new Set(["New", "Reviewing"]);
const TERMINAL_ERROR_STATUSES = new Set(["Fixed", "Ignored"]);

const ADMIN_VIEW_MODULES = new Set([
  "admin-users",
  "backup-cleanup",
  "coach-analytics",
  "coach-sites",
  "create-coach-site",
  "error-reports",
  "overview",
  "paid-masterclass-settings",
  "settings",
  "shop",
  "top-coaches"
]);

const TRUSTED_ROUTE_MODULES = [
  ["/api/admin/analytics", "coach-analytics"],
  ["/api/admin/coach-sites", "coach-sites"],
  ["/api/admin/error-reports", "error-reports"],
  ["/api/admin/backup", "backup-cleanup"],
  ["/api/admin/users", "admin-users"],
  ["/api/admin/masterclass", "paid-masterclass-settings"],
  ["/api/admin/settings", "settings"],
  ["/api/admin/shop", "shop"]
] as const;

export function resolveTrustedAdminAIErrorModule(value: unknown): string | null {
  const route = cleanRoute(value);
  if (!route) return null;
  const parsed = new URL(route, "https://admin.invalid");
  if (parsed.pathname === "/admin/dashboard") {
    const view = parsed.searchParams.get("view") || "overview";
    return ADMIN_VIEW_MODULES.has(view) ? view : null;
  }
  return (
    TRUSTED_ROUTE_MODULES.find(
      ([prefix]) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    )?.[1] || null
  );
}

export function detectStaleAdminAIError({
  evaluatedAt,
  report
}: {
  evaluatedAt: string;
  report: AdminAIErrorReportFact;
}) {
  const evaluatedTimestamp = validTimestamp(evaluatedAt);
  const updatedAt = validTimestamp(report.updatedAt);
  const reportStatus =
    report.statusTrusted === true &&
    (ACTIVE_ERROR_STATUSES.has(report.status || "") ||
      TERMINAL_ERROR_STATUSES.has(report.status || ""))
      ? report.status || null
      : null;
  const base = {
    evaluatedAt: evaluatedTimestamp,
    evidence: [] as string[],
    referenceId: cleanIdentifier(report.referenceId, 80),
    reportStatus,
    thresholdDays: ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS,
    updatedAt
  };

  if (
    !evaluatedTimestamp ||
    !updatedAt ||
    !reportStatus ||
    Date.parse(updatedAt) > Date.parse(evaluatedTimestamp)
  ) {
    return {
      ...base,
      classification: "insufficient-evidence" as const,
      reason:
        "Trusted status, a valid last-updated timestamp, and a valid evaluation timestamp are required."
    };
  }

  if (TERMINAL_ERROR_STATUSES.has(reportStatus)) {
    const resolvedAt = validTimestamp(report.resolutionEvidence?.resolvedAt);
    const summary = cleanText(report.resolutionEvidence?.summary, 500);
    if (
      report.resolutionEvidence?.trusted !== true ||
      !resolvedAt ||
      !summary ||
      Date.parse(resolvedAt) < Date.parse(updatedAt) ||
      Date.parse(resolvedAt) > Date.parse(evaluatedTimestamp)
    ) {
      return {
        ...base,
        classification: "insufficient-evidence" as const,
        reason: "A terminal status requires explicit trusted resolution evidence with a valid date."
      };
    }

    return {
      ...base,
      classification: "resolved-excluded" as const,
      evidence: [
        `Trusted status: ${reportStatus}`,
        `Resolution recorded: ${resolvedAt}`,
        `Resolution evidence: ${summary}`
      ],
      reason: "The trusted terminal status is supported by explicit resolution evidence.",
      resolutionEvidence: { resolvedAt, summary }
    };
  }

  const stale =
    Date.parse(evaluatedTimestamp) - Date.parse(updatedAt) >= ADMIN_AI_STALE_ERROR_THRESHOLD_MS;
  return {
    ...base,
    classification: stale ? ("stale" as const) : ("current" as const),
    evidence: [
      `Trusted status: ${reportStatus}`,
      `Last updated: ${updatedAt}`,
      `Stale threshold: ${ADMIN_AI_STALE_ERROR_THRESHOLD_DAYS} days`
    ],
    reason: stale
      ? "The trusted unresolved report has reached the stale threshold."
      : "The trusted unresolved report has not reached the stale threshold."
  };
}

export function investigateAdminAIError({
  reports,
  selectedReferenceId
}: {
  reports: AdminAIErrorReportFact[];
  selectedReferenceId: string;
}) {
  const boundedReports = reports
    .slice(0, 200)
    .map(normalizeReport)
    .filter((report) => report.referenceId);
  const selectedId = cleanIdentifier(selectedReferenceId, 80);
  const selected = boundedReports.find((report) => report.referenceId === selectedId);
  if (!selected) return missingSelectedError();

  const related = boundedReports
    .filter(
      (report) =>
        report.referenceId !== selected.referenceId &&
        report.module === selected.module &&
        (report.errorCode === selected.errorCode || report.route === selected.route)
    )
    .slice(0, 20);
  const affectedUsersOrEntities = Array.from(
    new Set([selected, ...related].map((report) => report.affectedEntity).filter(Boolean))
  );
  const impactSummary = `${capitalize(selected.severity)}-severity error in ${
    selected.module || "an unavailable module"
  } on ${selected.route || "an unavailable route"}. The selected and related permission-visible reports represent ${
    affectedUsersOrEntities.length
  } affected ${affectedUsersOrEntities.length === 1 ? "entity" : "entities"} and ${related.length} related ${
    related.length === 1 ? "error" : "errors"
  }.`;
  const evidence = [
    `Reference: ${selected.referenceId}`,
    `Error code: ${selected.errorCode || "Unavailable"}`,
    `Route: ${selected.route || "Unavailable"}`,
    `Module: ${selected.module || "Unavailable"}`,
    `Observed: ${selected.createdAt || "Unavailable"}`,
    selected.deployId
      ? `Deploy: ${selected.deployId}`
      : "Recent deploy/change metadata: Unavailable",
    selected.changeSummary
      ? `Recent trusted change summary: ${selected.changeSummary}`
      : "Recent change summary: Unavailable",
    ...(selected.sourceFilesTrusted && selected.sourceFiles.length
      ? selected.sourceFiles.map((file) => `Trusted likely source file: ${file}`)
      : ["Likely source files: Unavailable"])
  ];

  return {
    affectedUsersOrEntities,
    evidence,
    impactSummary,
    likelyCause: selected.changeSummary
      ? `Likely association: the selected error followed the recorded change "${selected.changeSummary}". Verify the data flow before treating this as causal.`
      : `Likely failure area: ${selected.module || "the affected module"} on ${selected.route || "the recorded route"}. Available evidence is insufficient for a causal claim.`,
    recommendedFix:
      "Inspect the protected handler and client call for the selected route, reproduce the safe failure, add a regression test, then verify the real fix before changing this status.",
    relatedErrors: related.map((report) => report.referenceId),
    reproduction: [
      `Open ${selected.route || "the recorded route"} with an authorized test admin.`,
      `Repeat the operation associated with ${selected.errorCode || selected.referenceId}.`,
      `Verify the safe response, network status, and server logs against reference ${selected.referenceId}.`
    ],
    resolutionStatus: "Investigated, not fixed" as const,
    safeTemporaryAction:
      "Keep the affected operation in manual review, preserve the evidence, and use an existing safe fallback that does not mutate unrelated records.",
    severity: selected.severity,
    status: "ready" as const,
    summary: `${selected.referenceId}: ${selected.safeMessage || "Selected error requires investigation."}`
  };
}

function missingSelectedError() {
  return {
    affectedUsersOrEntities: [] as string[],
    evidence: [] as string[],
    impactSummary: "Impact unavailable because the selected error is not permission-visible.",
    likelyCause: "Unavailable because the selected error is not in the permission-visible context.",
    recommendedFix: "Select one visible error report and retry the investigation.",
    relatedErrors: [] as string[],
    reproduction: [] as string[],
    resolutionStatus: "Investigated, not fixed" as const,
    safeTemporaryAction: "No action proposed.",
    severity: "low" as const,
    status: "missing-selected-error" as const,
    summary: "Selected error is unavailable."
  };
}

function normalizeReport(report: AdminAIErrorReportFact) {
  const route = cleanRoute(report.route);
  return {
    affectedEntity: cleanText(report.affectedEntity, 160),
    changeSummary: cleanText(report.changeSummary, 300),
    createdAt: cleanText(report.createdAt, 80),
    deployId: cleanIdentifier(report.deployId, 120),
    errorCode: cleanIdentifier(report.errorCode, 80),
    module: resolveTrustedAdminAIErrorModule(route) || cleanIdentifier(report.module, 80),
    referenceId: cleanIdentifier(report.referenceId, 80),
    route,
    safeMessage: cleanText(report.safeMessage, 500),
    severity:
      report.severity === "high" || report.severity === "medium"
        ? report.severity
        : ("low" as const),
    sourceFiles: report.sourceFiles.slice(0, 12).map(cleanSourceFile).filter(Boolean),
    sourceFilesTrusted: report.sourceFilesTrusted === true
  };
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "Unknown";
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(
          /\b(?:token|secret|otp|password|authorization|cookie)\s*[:=]\s*\S+/gi,
          "[redacted]"
        )
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function cleanIdentifier(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, maxLength)
    : "";
}

function cleanRoute(value: unknown) {
  const route = cleanText(value, 240);
  return route.startsWith("/") && !route.startsWith("//") ? route : "";
}

function cleanSourceFile(value: unknown) {
  const file = cleanText(value, 240).replace(/\\/g, "/");
  return /^(?:app|components|functions|lib|tests)\/[a-zA-Z0-9_./\[\]-]+$/.test(file) ? file : "";
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}
