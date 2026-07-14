import type { AdminAISectionContext } from "./adminAIContext";
import type { AdminAIPreferences } from "./adminAIMemory";
import type { AdminAICommand } from "./adminAIRegistry";
import type {
  AdminAIApprovalReceipt,
  AdminAIArtifact,
  AdminAIEvidence,
  AdminAIHealthScore,
  AdminAIHealthSignal,
  AdminAIModelRoute,
  AdminAIPlan,
  AdminAIProgressStep,
  AdminAIRollbackAction,
  AdminAISearchResult,
} from "./adminAITypes";

export type AdminAIReport = {
  actionItems: string[];
  dateRange: string;
  keyMetrics: string[];
  observations: string[];
  recommendations: string[];
  sourceNote: string;
  title: string;
};

export type AdminAIResponseState =
  | "analyzing"
  | "action-complete"
  | "action-failed"
  | "action-prepared"
  | "blocked-missing-data"
  | "cancelled"
  | "confirmation-required"
  | "executing"
  | "insufficient-permission"
  | "loading"
  | "missing-data"
  | "offline-error"
  | "partial-success"
  | "preparing-plan"
  | "ready"
  | "retrieving-data"
  | "streaming-response"
  | "verifying-result"
  | "waiting-approval";

export type AdminAIResponse = {
  approvalReceipt?: AdminAIApprovalReceipt;
  artifact?: AdminAIArtifact;
  body: string;
  confidence?: {
    level: "high" | "insufficient-data" | "low" | "medium";
    reason: string;
  };
  evidence?: AdminAIEvidence[];
  healthScore?: AdminAIHealthScore;
  healthSignals?: AdminAIHealthSignal[];
  items: string[];
  modelRoute?: AdminAIModelRoute;
  plan?: AdminAIPlan;
  progress?: AdminAIProgressStep[];
  report?: AdminAIReport;
  rollbackAction?: AdminAIRollbackAction;
  searchResults?: AdminAISearchResult[];
  state: AdminAIResponseState;
  title: string;
};

export function runAdminAICommand(
  command: AdminAICommand,
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse {
  if (context.loadingState) {
    return response("Data is still loading", "Wait for the current section sources to finish loading.", [], "loading");
  }

  if (command.kind === "report") return buildReportResponse(command, context, preferences);
  if (command.kind === "find-problems") return buildProblemResponse(context);
  if (command.kind === "next-action") return buildNextActionResponse(context);
  if (command.kind === "navigate") {
    return response(
      "Protected workflow prepared",
      command.description,
      command.otpRequired ? ["The existing OTP step remains required."] : [],
      "action-prepared"
    );
  }

  return buildSummaryResponse(context, preferences);
}

export function formatAdminAIReport(report: AdminAIReport) {
  const section = (title: string, values: string[]) =>
    values.length ? `${title}\n${values.map((value) => `- ${value}`).join("\n")}` : "";

  return [
    report.title,
    `Date range: ${report.dateRange}`,
    section("Key metrics", report.keyMetrics),
    section("Observations", report.observations),
    section("Recommendations", report.recommendations),
    section("Action items", report.actionItems),
    `Sources: ${report.sourceNote}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildSummaryResponse(context: AdminAISectionContext, preferences: AdminAIPreferences) {
  if (!context.visibleDataSummary.length || context.emptyState) {
    return response(
      `${context.sectionName} has no loaded records`,
      "No production records are available for a useful summary.",
      context.errors,
      "missing-data"
    );
  }

  const limit = preferences.reportStyle === "detailed" ? 8 : 4;
  const items = context.visibleDataSummary
    .slice(0, limit)
    .map((item) => `${item.label}: ${formatValue(item.value)} (${item.source})`);

  return response(
    `${context.sectionName} summary`,
    `Using ${items.length} compact, permission-filtered signals. ${context.dataFreshness}.`,
    items,
    "ready"
  );
}

function buildProblemResponse(context: AdminAISectionContext) {
  const items = [...context.errors, ...context.warnings];
  if (!items.length) {
    return response(
      "No current issue signal",
      "No warning or unavailable-source condition is present in the loaded section context.",
      [],
      context.emptyState ? "missing-data" : "ready"
    );
  }

  return response(
    `${items.length} item${items.length === 1 ? "" : "s"} need attention`,
    "These findings come only from loaded source status and aggregate records.",
    items,
    "ready"
  );
}

function buildNextActionResponse(context: AdminAISectionContext) {
  const firstIssue = context.errors[0] || context.warnings[0];
  if (!firstIssue) {
    return response(
      "Continue normal review",
      "No current warning supports a stronger recommendation.",
      context.availableActions.slice(0, 3),
      context.emptyState ? "missing-data" : "ready"
    );
  }

  return response(
    "Recommended next check",
    firstIssue,
    context.availableActions.slice(0, 3),
    "ready"
  );
}

function buildReportResponse(
  command: AdminAICommand,
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse {
  const observations = [...context.errors, ...context.warnings];
  const keyMetrics = context.visibleDataSummary.map(
    (item) => `${item.label}: ${formatValue(item.value)} (${item.source})`
  );
  const recommendations = observations.length
    ? observations.map((item) => `Review: ${item}`)
    : ["No warning-based corrective action is supported by the current data."];
  const actionItems = preferences.includeActionItems
    ? context.availableActions.slice(0, preferences.reportStyle === "detailed" ? 5 : 3)
    : [];
  const report: AdminAIReport = {
    actionItems,
    dateRange: context.dateRange,
    keyMetrics,
    observations: observations.length ? observations : ["No current warning signal."],
    recommendations,
    sourceNote: context.relatedAPIs.join(", ") || "Current section sources",
    title: command.reportTitle || `${context.sectionName} Report`,
  };

  return {
    body: `Report generated from ${keyMetrics.length} compact metric${keyMetrics.length === 1 ? "" : "s"}.`,
    items: observations,
    report,
    state: keyMetrics.length ? "ready" : "missing-data",
    title: report.title,
  };
}

function response(
  title: string,
  body: string,
  items: string[],
  state: AdminAIResponseState
): AdminAIResponse {
  return { body, items, state, title };
}

function formatValue(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value;
}
