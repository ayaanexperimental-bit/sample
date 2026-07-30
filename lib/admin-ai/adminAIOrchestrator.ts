import type { AdminAIRegisteredActionView, AdminAISectionContext } from "./adminAIContext";
import { analyzeSelectedSitePerformance, explainAdminAIAnalytics } from "./adminAIAnalytics";
import { inspectAdminAIBuilder } from "./adminAIBuilderInspection";
import { detectStaleAdminAIError, investigateAdminAIError } from "./adminAIErrorInvestigation";
import type { AdminAIFeatureFlags } from "./adminAIFeatureFlags";
import {
  buildAdminAIHealthAlerts as buildEvidenceBackedHealthAlerts,
  buildAdminAIHealthScore as buildTransparentHealthScore
} from "./adminAIHealth";
import {
  buildAdminAIIncident,
  buildAdminAIIncidentProvenance,
  formatAdminAIIncidentReport,
  hasEligibleAdminAIIncidentEvidence,
  isAdminAIIncidentRequest
} from "./adminAIIncident";
import { retrieveAdminAIKnowledge } from "./adminAIKnowledge";
import { buildAdminAIMemoryGuidance, type AdminAIPreferences } from "./adminAIMemory";
import {
  inspectSelectedCoachSiteSetup,
  rankWorstPerformingCoachSites
} from "./adminAIContinuousWorkflow";
import { getAdminAICommand, type AdminAICommand } from "./adminAIRegistry";
import {
  classifyAdminAITask,
  dispatchAdminAIModel,
  selectAdminAIModelRoute,
  type AdminAIModelRoutingOptions,
  type AdminAIProviderAdapter
} from "./adminAIModelRouting";
import {
  ADMIN_AI_PROMPT_INJECTION_PATTERNS,
  extractAdminAIRequirementFacts,
  isAdminAIProviderNarrativeGrounded
} from "./adminAIProviderGrounding";
import {
  ADMIN_AI_EXECUTIVE_REPORT_TYPES,
  evaluateAdminAIReportPreflight,
  formatAdminAIReportText as formatStructuredReport,
  generateAdminAIDailyBriefing,
  generateAdminAIExecutiveReport,
  type AdminAIDailyBriefingBlockId,
  type AdminAIExecutiveReportType,
  type AdminAIReportPreflightDecision,
  type AdminAIReportEntryInput,
  type GenerateAdminAIDailyBriefingInput
} from "./adminAIReports";
import {
  buildAdminAIEvidenceForSource,
  ensureAdminAIConclusions,
  normalizeAdminAIResponseCopy,
  type AdminAIResponse
} from "./adminAIService";
import { runAdminAITableCopilot, type AdminAITableCapability } from "./adminAITableCopilot";
import type {
  AdminAIApprovalLevel,
  AdminAIArtifact,
  AdminAIConfidenceLevel,
  AdminAIDryRun,
  AdminAIDryRunPreview,
  AdminAIEntity,
  AdminAIEvidence,
  AdminAIHealthScore,
  AdminAIHealthSignal,
  AdminAIModelRoute,
  AdminAIPlan,
  AdminAIScope,
  AdminAISearchResult
} from "./adminAITypes";

const MUTATION_WORDS =
  /\b(apply|archive|change|cleanup|delete|edit|fix|mark|publish|regenerate|remove|resend|revoke|save|set|suspend|unpublish|update)\b/i;
const LEVEL_TWO_ACTION_WORDS = /\b(apply|change|edit|fix|mark|regenerate|save|set|update)\b/i;
const LEVEL_THREE_ACTION_WORDS =
  /\b(archive|cleanup|delete|publish|remove|revoke|suspend|unpublish)\b/i;
const ACTION_MATCH_STOP_WORDS = new Set([
  "action",
  "after",
  "before",
  "change",
  "existing",
  "open",
  "prepare",
  "prepared",
  "review",
  "this",
  "update",
  "workflow"
]);
type RunAdminAIQueryInput = {
  context: AdminAISectionContext;
  featureFlags: AdminAIFeatureFlags;
  preferences: AdminAIPreferences;
  query: string;
  reportDecision?: AdminAIReportPreflightDecision;
  requestedMaxOutputTokens?: number;
  scope: AdminAIScope;
};

type RunAdminAIModelQueryInput = RunAdminAIQueryInput & {
  modelOptions?: AdminAIModelRoutingOptions;
  providers: Readonly<Record<string, AdminAIProviderAdapter | undefined>>;
  signal?: AbortSignal;
};

type AdminAISearchPredicate =
  | "edited-not-republished"
  | "failed-backup"
  | "missing-registration"
  | "payment-permission"
  | "payment-publish-failure"
  | "public-route-error";

export type ParsedAdminAISearchQuery = {
  dateRange: { end: string; start: string } | null;
  entityTerms: string[];
  module: AdminAISectionContext["sectionId"] | null;
  predicates: AdminAISearchPredicate[];
  semanticTerms: string[];
  statuses: string[];
};

type AdminAISearchOptions = {
  now?: Date;
};

const SEMANTIC_SEARCH_MATCH_THRESHOLD = 1;
const SEMANTIC_SEARCH_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:did not|didn t|never) (?:complete|finish)\b/g, "failed"],
  [/\bcheckout (?:completed|complete|succeeded)\b/g, "payment succeeded"],
  [/\brollout (?:broke|failed)\b/g, "publish failed"],
  [/\b(?:not released|not live|unreleased)\b/g, "unpublished"],
  [/\b(?:team members?|staff members?|staff)\b/g, "admins"],
  [/\b(?:recovery snapshots?|snapshots?)\b/g, "backups"],
  [/\b(?:web ?pages?|profile pages?)\b/g, "sites"],
  [/\b(?:sign-up|signup)\b/g, "registration"],
  [/\bbilling\b/g, "payment"],
  [/\b(?:authorized|allowed)\b/g, "permission"],
  [/\btelemetry\b/g, "analytics"],
  [/\bfaults?\b/g, "errors"],
  [/\babsent\b/g, "missing"],
  [/\bbroken\b/g, "error"]
];

export function runAdminAINaturalLanguageQuery(input: RunAdminAIQueryInput): AdminAIResponse {
  return ensureAdminAIConclusions(
    normalizeAdminAIResponseCopy(
      applyAdminAIMemoryGuidance(
        runAdminAINaturalLanguageQueryInternal(input),
        input.query,
        input.preferences
      )
    )
  );
}

function runAdminAINaturalLanguageQueryInternal({
  context,
  featureFlags,
  preferences,
  query,
  reportDecision,
  requestedMaxOutputTokens,
  scope
}: RunAdminAIQueryInput): AdminAIResponse {
  const safeQuery = sanitizeQuery(query);
  const modelRoute = selectAdminAIModelRoute(safeQuery);
  if (!safeQuery) {
    return baseResponse(
      "Enter an admin request",
      "Ask about loaded data, health, reports, or a safe plan.",
      "missing-data",
      modelRoute
    );
  }

  if (isPromptInjectionAttempt(safeQuery)) {
    return {
      ...baseResponse(
        "Request blocked by Copilot safety",
        "The request attempts to override permissions, security, registered-action, or grounding rules. No data was exposed and no action ran.",
        "insufficient-permission",
        modelRoute
      ),
      confidence: confidence("high", "Matched a deterministic safety rule."),
      evidence: [evidence(context, "Admin Copilot safety policy", 1)],
      items: [
        "Permissions remain enforced outside the model.",
        "Only registered actions can be prepared or executed."
      ]
    };
  }

  if (scope === "global" && !featureFlags.globalMode) {
    return baseResponse(
      "Global mode is disabled",
      "Use This Page or Current Module, or ask an owner to enable the global feature flag.",
      "insufficient-permission",
      modelRoute
    );
  }

  if (scope === "selection" && !context.selectedRows.length) {
    return baseResponse(
      "No records selected",
      "Select one or more visible records before using Selected Records scope.",
      "missing-data",
      modelRoute
    );
  }

  const lower = safeQuery.toLowerCase();
  const actionIntent =
    MUTATION_WORDS.test(safeQuery) ||
    /\b(plan|resolve|rollback|dry run|simulate)\b/i.test(safeQuery);
  const reportIntent = actionIntent ? null : getAdminAIReportIntent(lower);
  if (reportIntent) {
    const preflight = buildReportPreflightResponse(
      context,
      preferences,
      requestedMaxOutputTokens,
      reportDecision,
      modelRoute
    );
    if (preflight) return preflight;
    return reportIntent === "briefing"
      ? buildDailyBriefingResponse(context, modelRoute)
      : buildExecutiveReportResponse(context, preferences, safeQuery, scope, modelRoute);
  }

  if (isWorstPerformingSitesQuery(lower)) {
    return buildWorstPerformingSitesResponse(context, modelRoute);
  }

  if (isSelectedSiteSetupQuery(lower, scope)) {
    return buildSelectedSiteSetupResponse(context, modelRoute);
  }

  if (isSelectedSitePerformanceQuery(lower, scope)) {
    return buildSelectedSitePerformanceResponse(context, modelRoute);
  }

  if (isVisibleShopTestDataQuery(lower)) {
    return buildVisibleShopTestDataResponse(context, modelRoute);
  }

  if (isHighTrafficLowRegistrationQuery(lower)) {
    return buildHighTrafficLowRegistrationResponse(context, modelRoute);
  }

  if (isUnresolvedHighSeverityShopErrorQuery(lower)) {
    return buildUnresolvedHighSeverityShopErrorResponse(context, modelRoute);
  }

  if (isCoachSiteHealthExceptionQuery(lower)) {
    return buildCoachSiteHealthExceptionResponse(context, modelRoute);
  }

  if (isChecklistQuery(lower)) {
    return buildChecklistResponse(context, scope, modelRoute);
  }

  if (
    context.sectionId === "create-coach-site" &&
    /\b(pre[- ]?publish|publish readiness|builder (?:audit|inspection|review)|inspect(?:ion)?|readiness check)\b/i.test(
      lower
    )
  ) {
    return buildBuilderInspectionResponse(context, modelRoute);
  }

  if (isAdminAIIncidentRequest(safeQuery)) {
    if (!featureFlags.incidentMode) {
      return baseResponse(
        "Incident Mode is disabled",
        "The incident feature flag is off. Core admin modules remain available.",
        "insufficient-permission",
        modelRoute
      );
    }
    return buildIncidentResponse(context, safeQuery, modelRoute);
  }

  if (
    scope === "global" &&
    featureFlags.incidentMode &&
    hasEligibleAdminAIIncidentEvidence(context.intelligence?.healthEvidence || [])
  ) {
    return buildIncidentResponse(context, safeQuery, modelRoute);
  }

  if (isPublishFailureSettingsQuery(lower)) {
    return buildPublishFailureSettingsResponse(context, modelRoute);
  }

  if (isPaidOrderRecoveryQuery(lower)) {
    return buildPaidOrderRecoveryResponse(context, safeQuery, featureFlags, modelRoute);
  }

  if (actionIntent) {
    const plan = buildAdminAIPlan(safeQuery, scope, context, featureFlags);
    const artifact = planArtifact(plan, context);
    return {
      ...baseResponse(
        plan.executable ? "Review action plan" : "Review non-executable plan",
        plan.executable
          ? "Copilot prepared a registered, permission-aware plan. Nothing changes until the required approval and existing security flow complete."
          : "Copilot prepared findings and safe next steps, but no registered executable action matches this request.",
        plan.confirmationRequired ? "confirmation-required" : "action-prepared",
        modelRoute
      ),
      artifact,
      confidence: confidence(
        plan.executable ? "high" : "medium",
        plan.executable
          ? "Mapped to a registered action."
          : "No registered mutation handler matched."
      ),
      evidence: collectEvidence(context, plan.affectedRecords.length),
      items: plan.risks,
      plan
    };
  }

  if (
    context.sectionId === "error-reports" &&
    /\b(investigate|bug summary|root cause|troubleshoot|diagnose)\b/i.test(lower)
  ) {
    return buildSelectedErrorResponse(context, modelRoute);
  }

  if (
    context.intelligence?.table &&
    /\b(table|selected rows?|duplicates?|group related|status differences?|bulk action)\b/i.test(
      lower
    )
  ) {
    return buildTableResponse(context, safeQuery, modelRoute);
  }

  if (isRegistrationWorkflowQuery(lower)) {
    return buildRegistrationWorkflowResponse(context, safeQuery, scope, modelRoute);
  }

  if (/\b(investigate|check why|root cause|troubleshoot|diagnose)\b/i.test(lower)) {
    return buildInvestigationResponse(context, safeQuery, scope, modelRoute);
  }

  if (/\b(health|attention|briefing|incident|reliability|today)\b/i.test(lower)) {
    return buildHealthResponse(context, preferences, modelRoute);
  }

  if (
    /\b(anomaly|anomalies|anomalous|trend|chart|drop|spike|compare|peak|conversion)\b/i.test(lower)
  ) {
    return buildAnalyticsResponse(context, modelRoute);
  }

  if (
    /\b(find|search|show|which|where|records?|sites?|orders?|errors?|admins?|backups?)\b/i.test(
      lower
    )
  ) {
    return buildSearchResponse(context, safeQuery, scope, modelRoute);
  }

  if (/\b(explain|how|rule|documentation|why|setting|permission|otp|publish)\b/i.test(lower)) {
    return buildKnowledgeResponse(context, safeQuery, modelRoute);
  }

  const summaryMetrics = context.visibleDataSummary.slice(
    0,
    preferences.responseLength === "detailed" ? 8 : 4
  );
  const summaryItems = summaryMetrics.map(
    (item) => `${item.label}: ${String(item.value)} (${item.source})`
  );

  return {
    ...baseResponse(
      `${context.sectionName} grounded summary`,
      `Using ${context.visibleDataSummary.length} compact signals in ${formatScope(scope)} scope. ${context.dataFreshness}.`,
      context.emptyState ? "missing-data" : "ready",
      modelRoute
    ),
    confidence: confidence(
      context.emptyState ? "insufficient-data" : "high",
      context.emptyState
        ? "No loaded records are available."
        : "Built from deterministic section context."
    ),
    conclusions:
      !context.emptyState && summaryMetrics.length > 1
        ? summaryMetrics.map((item, index) => ({
            confidence: confidence(
              "high",
              `This claim is directly derived from the cited permission-filtered ${item.source} summary.`
            ),
            evidenceSources: [item.source],
            id: `summary-claim-${index + 1}`,
            text: summaryItems[index]
          }))
        : undefined,
    evidence: collectEvidence(context, context.visibleDataSummary.length),
    items: summaryItems
  };
}

function applyAdminAIMemoryGuidance(
  response: AdminAIResponse,
  query: string,
  preferences: AdminAIPreferences
): AdminAIResponse {
  if (!preferences.memoryEnabled) return response;
  const guidance = buildAdminAIMemoryGuidance(preferences);
  const repeated = guidance.repeatedErrorTriage[0];
  if (!repeated || !/\b(?:duplicate|error|issue|recommend|triage|next action)\b/i.test(query)) {
    return response;
  }

  const priority = guidance.recommendationPriorities[0] || "safety";
  const duplicate = guidance.duplicateIssueCategories.includes(repeated.category);
  const occurrenceCopy = `${repeated.occurrences} approved occurrence${repeated.occurrences === 1 ? "" : "s"}`;
  const memoryItem =
    guidance.copyStyle === "direct"
      ? `Triage ${repeated.category} first (${occurrenceCopy}; ${priority} priority).`
      : guidance.copyStyle === "professional"
        ? `Approved safe memory recommends prioritizing ${repeated.category} (${occurrenceCopy}; ${priority} priority).`
        : `${repeated.category}: ${occurrenceCopy}; prioritize ${priority}.`;
  return {
    ...response,
    items: Array.from(
      new Set([
        memoryItem,
        ...(duplicate ? [`Repeated ${repeated.category} pattern detected from safe memory.`] : []),
        ...response.items
      ])
    ).slice(0, 12)
  };
}

export async function runAdminAINaturalLanguageQueryWithModel({
  context,
  featureFlags,
  modelOptions,
  preferences,
  providers,
  query,
  reportDecision,
  requestedMaxOutputTokens,
  signal,
  scope
}: RunAdminAIModelQueryInput): Promise<AdminAIResponse> {
  const deterministic = runAdminAINaturalLanguageQuery({
    context,
    featureFlags,
    preferences,
    query,
    reportDecision,
    requestedMaxOutputTokens,
    scope
  });
  if (
    deterministic.state === "cancelled" ||
    (deterministic.state === "confirmation-required" &&
      deterministic.title === "Large report confirmation")
  ) {
    return deterministic;
  }
  const safeQuery = sanitizeQuery(query);
  const protectedInput = buildProtectedProviderInput(context, scope, safeQuery);
  const dispatch = await dispatchAdminAIModel({
    deterministicFallback: () => deterministic.body,
    input: JSON.stringify(protectedInput),
    options: modelOptions,
    providers,
    query: safeQuery,
    requestedMaxOutputTokens,
    signal,
    validateProviderOutput: (value) => isAdminAIProviderNarrativeGrounded(value, protectedInput)
  });
  const fallbackReason = dispatch.fallbackReason
    ? ` Deterministic fallback: ${dispatch.fallbackReason}.`
    : "";
  const modelRoute = {
    ...dispatch.route,
    reason: `${dispatch.route.reason}${fallbackReason}`
  };

  if (dispatch.source !== "provider") {
    return {
      ...deterministic,
      modelRoute,
      providerFallbackReason:
        dispatch.fallbackReason && dispatch.fallbackReason !== "deterministic-task"
          ? dispatch.fallbackReason
          : undefined
    };
  }

  const providerNarrative = sanitizeProviderNarrative(dispatch.output);
  const evidenceSources = Array.from(
    new Set((deterministic.evidence || []).map(({ source }) => source).filter(Boolean))
  );
  const evidenceLabel = evidenceSources.join(", ") || "the protected context";
  const providerConclusions = splitProviderNarrativeClaims(providerNarrative).map(
    (claim, index) => ({
      confidence: {
        level: "medium" as const,
        reason: `This model-generated claim passed bounded safety and numeric-grounding checks against ${evidenceLabel}, but should still be verified.`
      },
      evidenceSources,
      id: `model-assisted-claim-${index + 1}`,
      text: claim
    })
  );
  return ensureAdminAIConclusions(
    normalizeAdminAIResponseCopy({
      ...deterministic,
      body: `${deterministic.body}\n\nModel-assisted summary: ${providerNarrative}`,
      conclusions: [
        ...(deterministic.conclusions || []).map((conclusion) => ({
          ...conclusion,
          evidenceSources: conclusion.evidenceSources || evidenceSources
        })),
        ...providerConclusions
      ],
      confidence: {
        level: "medium",
        reason:
          "The response combines a deterministic result with a validated but model-generated narrative."
      },
      modelRoute
    })
  );
}

export function getAdminAIReportIntent(value: string): "briefing" | "report" | null {
  if (/\bbriefing\b/i.test(value)) return "briefing";
  return /\b(report|weekly|monthly|executive|download|copyable)\b/i.test(value) ? "report" : null;
}

export function getAdminAIReportSizeInput(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  requestedMaxOutputTokens?: number
) {
  const intelligence = context.intelligence;
  const defaultOutputTokens = preferences.responseLength === "detailed" ? 2_400 : 1_200;
  const effectiveOutputTokens =
    typeof requestedMaxOutputTokens === "number" &&
    Number.isFinite(requestedMaxOutputTokens) &&
    requestedMaxOutputTokens >= 0
      ? Math.trunc(requestedMaxOutputTokens)
      : defaultOutputTokens;
  return {
    contextCharacters: JSON.stringify(context).length,
    recordCount:
      context.analyticsSeries.length +
      context.entities.length +
      (intelligence?.analyticsPoints.length || 0) +
      (intelligence?.errorReports.length || 0) +
      (intelligence?.healthEvidence.length || 0) +
      (intelligence?.table?.rows.length || 0),
    requestedOutputTokens: effectiveOutputTokens
  };
}

function buildReportPreflightResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  requestedMaxOutputTokens: number | undefined,
  decision: AdminAIReportPreflightDecision | undefined,
  modelRoute: AdminAIModelRoute
): AdminAIResponse | null {
  const preflight = evaluateAdminAIReportPreflight(
    getAdminAIReportSizeInput(context, preferences, requestedMaxOutputTokens),
    decision
  );
  if (preflight.status === "ready") return null;
  if (preflight.status === "cancelled") {
    return baseResponse(
      "Report cancelled",
      "Large report generation was cancelled. No report or artifact was created.",
      "cancelled",
      modelRoute
    );
  }
  return {
    ...baseResponse(
      "Large report confirmation",
      preflight.warning,
      "confirmation-required",
      modelRoute
    ),
    items: ["No report or artifact was created. Choose Continue or Cancel."]
  };
}

function buildProtectedProviderInput(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  query: string
) {
  const scopedEntityCount = getEntitiesForScope(context, scope).length;
  const task = classifyAdminAITask(query);
  return {
    dateRange: normalizeProviderDateRange(context.dateRange),
    freshness: classifyProviderFreshness(context.dataFreshness),
    metrics: {
      permissionVisibleEntityCount: scopedEntityCount,
      sourceErrorCount: context.errors.length,
      visibleMetricCount:
        scope === "selection" ? 0 : getVisibleMetricsForScope(context, scope).length,
      warningCount: context.warnings.length
    },
    requirementFacts: extractAdminAIRequirementFacts(query, task),
    scope,
    section: context.sectionId,
    task,
    version: 2 as const
  };
}

function normalizeProviderDateRange(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const isoRange =
    /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+Z-]+)?(?:\s+(?:to|through)\s+\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+Z-]+)?)?$/i;
  const namedRange =
    /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:\s*(?:-|to|through)\s*\d{1,2})?,?\s+\d{4}$/i;
  return isoRange.test(normalized) || namedRange.test(normalized)
    ? normalized.slice(0, 100)
    : "unavailable";
}

function classifyProviderFreshness(value: string) {
  if (/less than|minute|just now|current/i.test(value)) return "recent";
  if (/hour/i.test(value)) return "within-hours";
  if (/day|today|yesterday/i.test(value)) return "within-days";
  if (/stale|week|month/i.test(value)) return "stale";
  return "unknown";
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
    return [
      {
        unit: /[$€£₹]/.test(prefix || "")
          ? ("currency" as const)
          : raw.endsWith("%")
            ? ("percent" as const)
            : ("number" as const),
        value: numericValue
      }
    ];
  });
}

function sanitizeProviderNarrative(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/```[\s\S]*?```/g, "[omitted code block]")
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(/^(?:(?:certainly|sure|of course|happy to help)[!,\.\s:-]+)+/i, "")
    .replace(/^as an ai(?: assistant| copilot)?[,\.\s:-]+/i, "")
    .trim()
    .slice(0, 2_000);
}

function splitProviderNarrativeClaims(value: string) {
  const sentences = value.match(/[^.!?]+(?:[.!?]+|$)/g) || [value];
  return sentences.flatMap((sentence) => {
    const text = sentence.trim().replace(/[.!?]+$/, "");
    const clauses =
      extractNumericClaims(text).length > 1 ? text.split(/\s*(?:,\s*)?\b(?:and|so)\b\s*/i) : [text];
    return clauses.flatMap((clause) => {
      const trimmed = clause.trim().replace(/^[,;:\s]+|[,;:\s]+$/g, "");
      if (!trimmed) return [];
      const capitalized = /^[a-z]/.test(trimmed)
        ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`
        : trimmed;
      return [`${capitalized}.`];
    });
  });
}

export function searchAdminAIEntities(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope,
  options: AdminAISearchOptions = {}
): AdminAISearchResult[] {
  const parsed = parseAdminAISearchQuery(query, options.now);
  const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  return context.entities
    .filter(
      (entity) => scope === "global" || scope === "selection" || entity.module === context.sectionId
    )
    .filter(
      (entity) =>
        scope !== "selection" ||
        selected.has(entity.id.toLowerCase()) ||
        selected.has(entity.label.toLowerCase())
    )
    .filter((entity) => !parsed.module || entity.module === parsed.module)
    .filter((entity) => matchesSearchDate(entity.updatedAt, parsed.dateRange))
    .filter((entity) => matchesSearchStatuses(entity, parsed.statuses))
    .filter((entity) =>
      parsed.predicates.every((predicate) => matchesSearchPredicate(entity, predicate))
    )
    .map((entity) => ({
      entity,
      score: scoreSearchEntity(entity, parsed)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.entity.updatedAt.localeCompare(a.entity.updatedAt))
    .slice(0, 20)
    .map(({ entity }) => ({
      id: entity.id,
      label: entity.label,
      matchReason: entity.matchReason,
      module: entity.module,
      route: entity.route,
      status: entity.status,
      updatedAt: entity.updatedAt
    }));
}

export function parseAdminAISearchQuery(
  query: string,
  now: Date = new Date()
): ParsedAdminAISearchQuery {
  const lexical = sanitizeQuery(query).toLowerCase().replace(/[’']/g, " ");
  const normalized = normalizeSemanticSearchText(lexical);
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date();
  const predicates: AdminAISearchPredicate[] = [];
  const statuses: string[] = [];
  let dateRange: ParsedAdminAISearchQuery["dateRange"] = null;

  if (/\bthis month\b/.test(normalized)) {
    // Search timestamps are stored as UTC ISO strings, so relative bounds are UTC too.
    dateRange = {
      end: safeNow.toISOString(),
      start: new Date(Date.UTC(safeNow.getUTCFullYear(), safeNow.getUTCMonth(), 1)).toISOString()
    };
  } else if (/\blast (?:seven|7) days\b/.test(normalized)) {
    dateRange = {
      end: safeNow.toISOString(),
      start: new Date(safeNow.getTime() - 7 * 24 * 60 * 60 * 1_000).toISOString()
    };
  }

  if (/\bunpublished\b|\bnot (?:yet )?published\b/.test(normalized)) {
    statuses.push("unpublished");
  } else if (/\bdrafts?\b/.test(normalized)) {
    statuses.push("draft");
  }
  if (/\bfailed\b/.test(normalized) && !statuses.includes("unpublished")) {
    statuses.push("failed");
  }
  if (/\bactive\b/.test(normalized)) statuses.push("active");

  let parsedModule: ParsedAdminAISearchQuery["module"] = null;
  if (/\badmins?\b|\badmin users?\b/.test(normalized)) {
    parsedModule = "admin-users";
  } else if (/\bbackups?\b|\brecovery snapshots?\b/.test(normalized)) {
    parsedModule = "backup-cleanup";
  } else if (
    /\bpublic (?:site|route)\b.{0,35}\b(?:error|failed|unavailable|404)\b/.test(normalized)
  ) {
    parsedModule = "coach-sites";
  } else if (/\berrors?\b|\berror reports?\b/.test(normalized)) {
    parsedModule = "error-reports";
  } else if (/\bshop\b|\borders?\b/.test(normalized)) {
    parsedModule = "shop";
  } else if (/\btop coaches?\b/.test(normalized)) {
    parsedModule = "top-coaches";
  } else if (/\banalytics\b/.test(normalized)) {
    parsedModule = "coach-analytics";
  } else if (/\bsites?\b|\bwebsites?\b|\bcoach(?:es)?\b/.test(normalized)) {
    parsedModule = "coach-sites";
  }

  if (
    /\badmins?\b/.test(normalized) &&
    /\bpayments?\b/.test(normalized) &&
    /\bpermissions?\b/.test(normalized)
  ) {
    predicates.push("payment-permission");
  }
  if (/\bbackups?\b.{0,30}\bfailed\b|\bfailed backups?\b/.test(normalized)) {
    predicates.push("failed-backup");
  }
  if (
    /\b(?:without|missing|invalid)\b.{0,30}\bregistration (?:link|destination)\b/.test(
      normalized
    ) ||
    /\bnot receiving registrations?\b/.test(normalized)
  ) {
    predicates.push("missing-registration");
  }
  if (
    /\bpayments? succeeded\b.{0,50}\b(?:publish failed|not published)\b/.test(normalized) ||
    /\bpaid\b.{0,50}\b(?:publish failed|not published)\b/.test(normalized)
  ) {
    predicates.push("payment-publish-failure");
  }
  if (/\bedited\b.{0,30}\bnot republished\b/.test(normalized)) {
    predicates.push("edited-not-republished");
  }
  if (/\bpublic (?:site|route)\b.{0,35}\b(?:error|failed|unavailable|404)\b/.test(normalized)) {
    predicates.push("public-route-error");
  }

  const rawTerms = tokenizeQuery(lexical).map(normalizeSearchTerm);
  const semanticRawTerms = tokenizeQuery(normalized).map(normalizeSearchTerm);
  const ignored = new Set([
    "created",
    "current",
    "an",
    "but",
    "check",
    "day",
    "days",
    "during",
    "edited",
    "failed",
    "find",
    "handle",
    "last",
    "link",
    "manage",
    "month",
    "not",
    "payment",
    "permission",
    "public",
    "publish",
    "published",
    "receiving",
    "registration",
    "related",
    "republished",
    "return",
    "returns",
    "route",
    "seven",
    "succeeded",
    "unpublished",
    "valid",
    "were",
    "where",
    "which",
    "why",
    "website",
    "whose",
    "without",
    "that"
  ]);
  const buildEntityTerms = (terms: string[]) => {
    const hasSiteTerm = terms.includes("site");
    return Array.from(
      new Set(
        terms.filter(
          (term) =>
            !ignored.has(term) &&
            term !== "selected" &&
            term !== "record" &&
            !(term === "coach" && hasSiteTerm) &&
            !(term === "shop" && terms.includes("order"))
        )
      )
    ).slice(0, 12);
  };
  const entityTerms = buildEntityTerms(rawTerms);
  const semanticTerms = buildEntityTerms(semanticRawTerms);

  return { dateRange, entityTerms, module: parsedModule, predicates, semanticTerms, statuses };
}

function normalizeSearchTerm(term: string) {
  if (/^sites?$|^websites?$/.test(term)) return "site";
  if (/^admins?$/.test(term)) return "admin";
  if (/^backups?$/.test(term)) return "backup";
  if (/^errors?$/.test(term)) return "error";
  if (/^orders?$/.test(term)) return "order";
  if (/^permissions?$/.test(term)) return "permission";
  if (/^registrations?$/.test(term)) return "registration";
  if (/^coaches$/.test(term)) return "coach";
  if (/^records?$/.test(term)) return "record";
  if (/^days$/.test(term)) return "day";
  if (/^returns$/.test(term)) return "return";
  return term;
}

function normalizeSemanticSearchText(value: string) {
  return SEMANTIC_SEARCH_PHRASES.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value
  );
}

function matchesSearchDate(updatedAt: string, dateRange: ParsedAdminAISearchQuery["dateRange"]) {
  if (!dateRange) return true;
  const timestamp = Date.parse(updatedAt);
  return (
    Number.isFinite(timestamp) &&
    timestamp >= Date.parse(dateRange.start) &&
    timestamp <= Date.parse(dateRange.end)
  );
}

function matchesSearchStatuses(entity: AdminAIEntity, statuses: string[]) {
  const status = entity.status.toLowerCase().replace(/[_-]+/g, " ");
  if (!statuses.length) return true;
  return statuses.some((requested) => {
    if (requested === "unpublished") {
      return /\b(?:draft|unpublished|publish pending|not published)\b/.test(status);
    }
    if (requested === "failed") return /\b(?:failed|failure)\b/.test(status);
    return status.split(/[^a-z0-9]+/).includes(requested);
  });
}

function matchesSearchPredicate(entity: AdminAIEntity, predicate: AdminAISearchPredicate) {
  const text = `${entity.status} ${entity.label} ${entity.matchReason} ${entity.searchableText}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (predicate === "payment-permission") {
    return (
      entity.module === "admin-users" &&
      /\bpayments?\b.{0,30}\bpermissions?\b|\bpermissions?\b.{0,30}\bpayments?\b/.test(text)
    );
  }
  if (predicate === "failed-backup") {
    return entity.module === "backup-cleanup" && /\b(?:failed|failure)\b/.test(text);
  }
  if (predicate === "missing-registration") {
    return (
      entity.module === "coach-sites" &&
      /\bmissing registration\b|\bwithout (?:a )?valid registration\b|\bregistration (?:link|destination) (?:is )?(?:invalid|missing)\b/.test(
        text
      )
    );
  }
  if (predicate === "payment-publish-failure") {
    return (
      entity.module === "shop" &&
      /\b(?:payment succeeded|paid)\b.{0,60}\b(?:publish failed|not published|publish pending)\b/.test(
        text
      )
    );
  }
  if (predicate === "edited-not-republished") {
    return (
      entity.module === "coach-sites" &&
      /\bedited\b.{0,40}\b(?:not republished|republish pending)\b/.test(text)
    );
  }
  return (
    entity.module === "coach-sites" &&
    /\bpublic (?:site|route)\b/.test(text) &&
    /\b(?:error|failed|unavailable|broken|404)\b/.test(text)
  );
}

function scoreSearchEntity(entity: AdminAIEntity, parsed: ParsedAdminAISearchQuery) {
  const haystack =
    `${entity.id} ${entity.label} ${entity.matchReason} ${entity.searchableText} ${entity.status}`.toLowerCase();
  const semanticHaystack = normalizeSemanticSearchText(haystack);
  const semanticMatches = parsed.semanticTerms.filter((term) => semanticHaystack.includes(term));
  const semanticMatchRatio = parsed.semanticTerms.length
    ? semanticMatches.length / parsed.semanticTerms.length
    : 0;
  const semanticMatch = semanticMatchRatio >= SEMANTIC_SEARCH_MATCH_THRESHOLD;
  const lexicalMatch =
    parsed.entityTerms.length > 0 && parsed.entityTerms.every((term) => haystack.includes(term));
  const hasSearchTerms = parsed.semanticTerms.length > 0 || parsed.entityTerms.length > 0;
  if (hasSearchTerms && !semanticMatch && !lexicalMatch) return 0;

  const matchedTerms = semanticMatch ? parsed.semanticTerms : parsed.entityTerms;
  const typedFilterScore =
    parsed.predicates.length * 2 +
    parsed.statuses.length +
    (parsed.module === entity.module ? 1 : 0) +
    (parsed.dateRange ? 1 : 0);
  if (!matchedTerms.length && typedFilterScore === 0) return 0;

  return (
    matchedTerms.reduce((total, term) => total + (entity.id.toLowerCase() === term ? 4 : 1), 0) +
    typedFilterScore
  );
}

export function buildAdminAIHealthSignals(context: AdminAISectionContext): AdminAIHealthSignal[] {
  const now = context.lastUpdated || new Date().toISOString();
  const signals: AdminAIHealthSignal[] = [];
  context.errors.forEach((item, index) =>
    signals.push(
      signal(
        `source-${index}`,
        "high",
        "Source unavailable",
        item,
        context.sectionName,
        context.currentRoute,
        now
      )
    )
  );
  context.warnings.forEach((item, index) =>
    signals.push(
      signal(
        `warning-${index}`,
        /payment|publish|high-severity/i.test(item) ? "high" : "medium",
        "Operational attention",
        item,
        context.sectionName,
        context.currentRoute,
        now
      )
    )
  );

  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleEntities = context.entities.filter((entity) => {
    const time = Date.parse(entity.updatedAt);
    return (
      Number.isFinite(time) &&
      time < staleCutoff &&
      /draft|review|open|pending/i.test(entity.status)
    );
  });
  if (staleEntities.length) {
    signals.push({
      affectedEntity: `${staleEntities.length} records`,
      confidence: "high",
      directRoute: staleEntities[0].route,
      evidence: `${staleEntities.length} permission-visible records are older than 30 days and remain draft, open, review, or pending.`,
      firstDetected: staleEntities[staleEntities.length - 1].updatedAt,
      id: "stale-records",
      impact: "Old unresolved records can hide operational work.",
      lastDetected: now,
      module: context.sectionName,
      recurrenceCount: staleEntities.length,
      severity: "medium",
      suggestedNextStep: "Open the matching records and review oldest first.",
      title: "Stale records need review"
    });
  }
  return signals.slice(0, 20);
}

export function buildAdminAIHealthScore(context: AdminAISectionContext): AdminAIHealthScore {
  const signals = buildAdminAIHealthSignals(context);
  const sourceScore = clamp(100 - context.errors.length * 25);
  const issueScore = clamp(
    100 -
      signals.filter((item) => item.severity === "high" || item.severity === "critical").length *
        20 -
      signals.filter((item) => item.severity === "medium").length * 8
  );
  const dataScore = context.visibleDataSummary.length ? 100 : 35;
  const freshnessScore = /minute|less than/i.test(context.dataFreshness)
    ? 100
    : /hour/i.test(context.dataFreshness)
      ? 75
      : 45;
  const components = [
    component(
      "sources",
      "Source availability",
      sourceScore,
      [`${context.errors.length} unavailable source signals`],
      []
    ),
    component(
      "operations",
      "Operational backlog",
      issueScore,
      [`${signals.length} evidence-backed health signals`],
      []
    ),
    component(
      "data",
      "Data completeness",
      dataScore,
      [`${context.visibleDataSummary.length} compact metrics`],
      context.visibleDataSummary.length ? [] : ["Loaded metrics"]
    ),
    component(
      "freshness",
      "Data freshness",
      freshnessScore,
      [context.dataFreshness],
      context.lastUpdated ? [] : ["Freshness timestamp"]
    )
  ];
  return {
    calculatedAt: context.lastUpdated || new Date().toISOString(),
    components,
    missingInputs: components.flatMap((item) => item.missingInputs),
    score: Math.round(components.reduce((total, item) => total + item.score, 0) / components.length)
  };
}

export function simulateAdminAIPlan(plan: AdminAIPlan): AdminAIPlan {
  const preview = plan.dryRunPreview;
  const dryRun: AdminAIDryRun = {
    before:
      preview?.before ||
      (plan.affectedRecords.length
        ? plan.affectedRecords.map((record) => `${record} (unknown): current value unavailable`)
        : ["Current value (unknown): not present in permission-filtered context"]),
    dependencies: preview?.dependencies || plan.steps.map((step) => step.api || step.label),
    errors:
      preview?.errors ||
      (plan.executable ? [] : ["No registered executable handler matches this request."]),
    generatedAt: new Date().toISOString(),
    proposedAfter: preview?.proposedAfter || [
      "Proposed value (unknown): requires an explicit registered action input"
    ],
    publicOutputChanges: preview?.publicOutputChanges ?? /publish|public url/i.test(plan.request),
    recordsSkipped: preview?.recordsSkipped || (plan.executable ? [] : plan.affectedRecords),
    validation: preview?.validation || (plan.executable ? "requires-review" : "blocked")
  };
  return { ...plan, dryRun };
}

function isRegistrationWorkflowQuery(query: string) {
  return (
    /\bregistrations?\b/i.test(query) &&
    /\b(check why|diagnose|investigate|missing|not receiving|not getting|zero)\b/i.test(query)
  );
}

function buildRegistrationWorkflowResponse(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const eligibleSites = getEntitiesForScope(context, scope).filter(
    (entity) => entity.module === "coach-sites"
  );
  const queryLower = query.toLowerCase();
  const searchedSite = searchAdminAIEntities(context, query, "global").find(
    (result) => result.module === "coach-sites"
  );
  const site =
    eligibleSites.find(
      (entity) =>
        queryLower.includes(entity.id.toLowerCase()) ||
        queryLower.includes(entity.label.toLowerCase())
    ) ||
    eligibleSites.find((entity) => entity.id === searchedSite?.id) ||
    (eligibleSites.length === 1 ? eligibleSites[0] : undefined);

  if (!site) {
    return {
      ...baseResponse(
        "Registration workflow investigation",
        "No single permission-visible coach site could be resolved in the effective scope. No cross-record inference was made.",
        "missing-data",
        modelRoute
      ),
      confidence: confidence(
        "insufficient-data",
        "A unique coach-site anchor is required before joining registration evidence."
      ),
      evidence: collectScopedEvidence(context, scope, []),
      items: ["Select one coach site or include its visible name in the request."]
    };
  }

  const identityTerms = entityIdentityTerms(site);
  const analytics = context.entities.filter(
    (entity) => entity.module === "coach-analytics" && entityContainsAnyTerm(entity, identityTerms)
  );
  const errors = context.entities.filter(
    (entity) => entity.module === "error-reports" && entityContainsAnyTerm(entity, identityTerms)
  );
  const payments = context.entities.filter(
    (entity) =>
      entity.module === "shop" &&
      (entityContainsAnyTerm(entity, identityTerms) ||
        entityText(site).includes(entity.id.toLowerCase()))
  );
  const joined = uniqueEntities([site, ...analytics, ...errors, ...payments]);
  const siteText = entityText(site);
  const publicRoute =
    /\bpublic (?:site|route)\b.{0,45}\b(?:error|failed|unavailable|broken|404)\b/.test(siteText)
      ? "error"
      : /\bpublic (?:site|route)\b.{0,35}\b(?:available|ready|healthy|published)\b/.test(siteText)
        ? "available"
        : "unverified";
  const registrationDestination =
    /\bmissing registration\b|\bwithout (?:a )?valid registration\b|\bregistration form (?:missing|invalid)\b/.test(
      siteText
    )
      ? "missing"
      : /\bregistration (?:ready|link valid|destination valid|form ready)\b/.test(siteText)
        ? "ready"
        : "unverified";
  const registrationClicks = extractRegistrationClicks(analytics);
  const mobileState = /\bmobile (?:unchecked|not checked|unverified)\b/.test(siteText)
    ? "unchecked"
    : /\bmobile (?:ready|verified|healthy)\b/.test(siteText)
      ? "verified"
      : "unverified";
  const paymentState = payments.length
    ? payments.map((entity) => `${entity.label} / ${entity.status}`).join(", ")
    : "none linked in permission-visible data";
  const workflowModules = new Set(joined.map(({ module }) => module));
  const workflowCommands = context.registeredActions
    .map((action) => getAdminAICommand(action.id))
    .filter((command): command is AdminAICommand =>
      Boolean(command && workflowModules.has(command.sectionId))
    );
  const safeActions = workflowCommands
    .filter((command) => command.approvalLevel < 2 && command.type !== "dangerous")
    .map(({ label }) => label);
  const confirmationActions = workflowCommands
    .filter((command) => command.confirmationRequired || command.approvalLevel >= 2)
    .map(({ label }) => label);
  const items = [
    `Site publish status: ${site.status}`,
    `Public route availability: ${publicRoute}`,
    `Registration destination: ${registrationDestination}`,
    `Registration analytics: ${registrationClicks === null ? "unavailable" : `${registrationClicks} registration clicks`}`,
    `Recent errors: ${errors.length} related error${errors.length === 1 ? "" : "s"}`,
    `Mobile rendering: ${mobileState}`,
    `Last site update: ${site.updatedAt}`,
    `Related payment state: ${paymentState}`,
    `Safe actions available: ${safeActions.length ? safeActions.join(", ") : "none registered for this workflow"}.`,
    `Actions requiring confirmation: ${confirmationActions.length ? confirmationActions.join(", ") : "none registered for this workflow"}.`
  ];
  const probableCauses = [
    registrationDestination === "missing"
      ? "The visible registration destination is missing."
      : null,
    publicRoute === "error" ? "The public route is returning an error." : null,
    registrationClicks === 0 ? "No registration click was recorded in the loaded range." : null
  ].filter((item): item is string => Boolean(item));
  const content = [
    "Registration workflow investigation",
    ...items.map((item) => `- ${item}`),
    "Probable causes:",
    ...(probableCauses.length
      ? probableCauses.map((item) => `- ${item}`)
      : ["- No cause is proven by the currently loaded evidence."]),
    "Recommended order of action:",
    "1. Verify the public route without changing data.",
    "2. Validate the registration destination and production form configuration.",
    "3. Re-test the registration CTA and confirm analytics ingestion.",
    "4. Use only an existing registered action if a change is later approved."
  ].join("\n");

  return {
    ...baseResponse(
      "Registration workflow investigation",
      `Joined ${joined.length} permission-visible records around ${site.label}; no mutation ran.`,
      probableCauses.length ? "partial-success" : "ready",
      modelRoute
    ),
    artifact: artifact(
      "error-investigation",
      "Registration Workflow Investigation",
      content,
      context
    ),
    confidence: confidence(
      analytics.length || errors.length || payments.length ? "high" : "medium",
      "The join is bounded to the selected or named coach site and explicit visible identity links."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope,
      workflow: "registration"
    }),
    items
  };
}

function isPaidOrderRecoveryQuery(query: string) {
  return (
    /\b(?:shop|orders?)\b/i.test(query) &&
    /\b(?:paid|payment succeeded)\b/i.test(query) &&
    /\b(?:not published|publish failed|publish failure)\b/i.test(query)
  );
}

function isWorstPerformingSitesQuery(query: string) {
  return (
    /\b(?:three|3)\b/i.test(query) &&
    /\bworst[- ]performing\b/i.test(query) &&
    /\bsites?\b/i.test(query) &&
    /\b(?:analytics|conversion|performance)\b/i.test(query)
  );
}

function buildWorstPerformingSitesResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const sites = rankWorstPerformingCoachSites(context.entities, 3);
  const complete = sites.length === 3;
  const entityIds = new Set(
    sites.flatMap(({ analyticsEntityIds, siteId }) => [siteId, ...analyticsEntityIds])
  );
  const joined = context.entities.filter(({ id }) => entityIds.has(id));
  const items = sites.map(
    ({ label, score }) => `${label}: ${Number(score.toFixed(2))}% conversion`
  );

  return {
    ...baseResponse(
      complete ? "Three worst-performing sites" : "Worst-performing sites unavailable",
      complete
        ? "Ranked exactly three permission-visible sites from linked Analytics conversion metrics."
        : `Only ${sites.length} metric-backed permission-visible sites are available; no missing site was fabricated.`,
      complete ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      complete ? "high" : "insufficient-data",
      complete
        ? "Each ranked site has an explicitly linked permission-visible Analytics metric."
        : "Fewer than three permission-visible sites have a linked conversion metric."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "global",
      workflow: "worst-performing-sites"
    }),
    items,
    searchResults: sites.map(({ label, score, siteId, siteRoute }) => ({
      id: siteId,
      label,
      matchReason: `Metric-backed conversion score: ${Number(score.toFixed(2))}%.`,
      module: "coach-sites",
      route: siteRoute,
      status: "performance review",
      updatedAt: context.lastUpdated
    }))
  };
}

function isSelectedSiteSetupQuery(query: string, scope: AdminAIScope) {
  return (
    scope === "selection" &&
    /\b(?:check|inspect|review)\b/i.test(query) &&
    /\bselected\b/i.test(query) &&
    /\bsites?\b/i.test(query) &&
    /\bsetup\b/i.test(query)
  );
}

function buildSelectedSiteSetupResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const inspections = inspectSelectedCoachSiteSetup(context.entities, context.selectedRows);
  const sites = new Set(inspections.map(({ siteId }) => siteId));
  const joined = context.entities.filter(({ id }) => sites.has(id));
  const hasUnverified = inspections.some(
    ({ form, images }) => form === "unverified" || images === "unverified"
  );

  return {
    ...baseResponse(
      "Selected-site setup inspection",
      inspections.length
        ? "Reported form and image readiness only from the selected permission-visible site records; unavailable facts remain unverified."
        : "No selected permission-visible coach-site record is available for setup inspection.",
      inspections.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      inspections.length ? (hasUnverified ? "medium" : "high") : "insufficient-data",
      inspections.length
        ? "Readiness classifications come from explicit selected-site text; absent facts are labelled unverified."
        : "The selected identifiers do not resolve to permission-visible coach sites."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "selection",
      workflow: "site-setup-inspection"
    }),
    items: inspections.map(({ form, images, label }) => `${label}: form ${form}; images ${images}`),
    searchResults: inspections.map(({ label, siteId, siteRoute }) => ({
      id: siteId,
      label,
      matchReason: "Selected permission-visible site setup inspection.",
      module: "coach-sites",
      route: siteRoute,
      status: "setup review",
      updatedAt: context.lastUpdated
    }))
  };
}

function isSelectedSitePerformanceQuery(query: string, scope: AdminAIScope) {
  return (
    scope === "selection" &&
    /\b(?:why|explain|review|analy[sz]e)\b/i.test(query) &&
    /\bselected\b/i.test(query) &&
    /\bsites?\b/i.test(query) &&
    /\b(?:perform|performing|performance)\b/i.test(query)
  );
}

function buildSelectedSitePerformanceResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const selectedIds = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  const site = context.entities.find(
    (entity) =>
      entity.module === "coach-sites" &&
      (selectedIds.has(entity.id.toLowerCase()) || selectedIds.has(entity.label.toLowerCase()))
  );
  const identityTerms = site ? entityIdentityTerms(site) : [];
  const analytics = context.entities.filter(
    (entity) => entity.module === "coach-analytics" && entityContainsAnyTerm(entity, identityTerms)
  );
  const payments = context.entities.filter(
    (entity) => entity.module === "shop" && entityContainsAnyTerm(entity, identityTerms)
  );
  const currentVisits = context.analyticsSeries.reduce((total, point) => total + point.current, 0);
  const previousVisits = context.analyticsSeries.reduce(
    (total, point) => total + point.previous,
    0
  );
  const analysis = analyzeSelectedSitePerformance({
    filters: context.filters,
    now: context.lastUpdated,
    payment: payments[0]
      ? {
          source: payments[0].source,
          status: payments[0].status,
          updatedAt: payments[0].updatedAt
        }
      : undefined,
    permissionVisible: Boolean(site),
    publishState: site
      ? { source: site.source, status: site.status, updatedAt: site.updatedAt }
      : undefined,
    refreshedAt: context.lastUpdated,
    selectedCoach: site ? { id: analytics[0]?.id || site.id, name: site.label } : undefined,
    selectedSite: site ? { id: site.id, name: site.label } : undefined,
    traffic:
      context.analyticsSeries.length > 0
        ? {
            currentVisits,
            dateRange: context.dateRange,
            previousVisits,
            source: analytics[0]?.source || "analytics-events"
          }
        : undefined
  });
  const joined = site ? uniqueEntities([site, ...analytics, ...payments]) : [];
  const hasFactors = analysis.factors.length > 0;
  return {
    ...baseResponse(
      hasFactors ? "Selected-site performance explanation" : "Selected-site evidence unavailable",
      hasFactors
        ? `Analyzed ${analysis.factors.length} trusted evidence categories for ${analysis.selectedSite?.name}. Missing categories remain explicit.`
        : "Select one permission-visible coach site with trusted performance evidence before requesting an explanation.",
      hasFactors ? (analysis.missingEvidence.length ? "partial-success" : "ready") : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      analysis.missingEvidence.length ? "insufficient-data" : "high",
      analysis.missingEvidence.length
        ? `Missing evidence: ${analysis.missingEvidence.join(", ")}.`
        : "All five performance categories were derived from trusted selected-site evidence."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "selection",
      workflow: "site-performance"
    }),
    items: analysis.factors.map(({ summary }) => summary)
  };
}

function isVisibleShopTestDataQuery(query: string) {
  return (
    /\b(?:flag|find|identify|review|show)\b/i.test(query) &&
    /\b(?:mock|test|sandbox|demo|fixture)\b/i.test(query) &&
    /\b(?:data|orders?|records?)\b/i.test(query)
  );
}

function buildVisibleShopTestDataResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const candidates = context.entities.filter(
    (entity) =>
      entity.module === "shop" && /\b(?:mock|test|sandbox|demo|fixture)\b/i.test(entityText(entity))
  );
  return {
    ...baseResponse(
      candidates.length ? "Visible Shop test-data review" : "No visible Shop test data",
      candidates.length
        ? `Flagged ${candidates.length} permission-visible Shop record${candidates.length === 1 ? "" : "s"} from explicit record labels or statuses only.`
        : "No permission-visible Shop record identifies itself as mock, test, sandbox, demo, or fixture data.",
      candidates.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      candidates.length ? "high" : "insufficient-data",
      candidates.length
        ? "Every flag is derived from an explicit visible Shop record label or status."
        : "No explicit visible test-data marker was found."
    ),
    evidence: buildEvidenceForJoinedEntities(context, candidates, {
      scope: "page",
      workflow: "shop-test-data"
    }),
    items: candidates.map((entity) => `${entity.label} (${entity.id}): ${entity.status}`)
  };
}

function isHighTrafficLowRegistrationQuery(query: string) {
  return (
    /\bhigh traffic\b/i.test(query) &&
    /\blow (?:registration|registrations|registration clicks?)\b/i.test(query) &&
    /\bsites?\b/i.test(query)
  );
}

function buildHighTrafficLowRegistrationResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const analyticsEntities = context.entities.filter(
    (entity) => entity.module === "coach-analytics"
  );
  const rows = context.entities
    .filter((entity) => entity.module === "coach-sites")
    .map((site) => {
      const analytics = analyticsEntities.filter((entity) =>
        entityContainsAnyTerm(entity, entityIdentityTerms(site))
      );
      const metrics = analytics.map(readTrafficMetrics).filter(isTrafficMetrics);
      if (!metrics.length) return null;
      const visits = metrics.reduce((total, metric) => total + metric.visits, 0);
      const registrations = metrics.reduce((total, metric) => total + metric.registrations, 0);
      return {
        analytics,
        conversion: visits > 0 ? (registrations / visits) * 100 : 0,
        registrations,
        site,
        visits
      };
    })
    .filter(
      (
        row
      ): row is {
        analytics: AdminAIEntity[];
        conversion: number;
        registrations: number;
        site: AdminAIEntity;
        visits: number;
      } => Boolean(row && row.visits > 0)
    );
  const averageVisits = rows.length
    ? rows.reduce((total, row) => total + row.visits, 0) / rows.length
    : 0;
  const totalVisits = rows.reduce((total, row) => total + row.visits, 0);
  const baselineConversion = totalVisits
    ? (rows.reduce((total, row) => total + row.registrations, 0) / totalVisits) * 100
    : 0;
  const matches = rows.filter(
    (row) => row.visits >= averageVisits && row.conversion < baselineConversion
  );
  const joined = uniqueEntities(matches.flatMap((row) => [row.site, ...row.analytics]));

  return {
    ...baseResponse(
      "High-traffic low-registration sites",
      matches.length
        ? `Compared ${rows.length} metric-backed permission-visible sites against the visible average traffic and aggregate registration conversion baselines.`
        : "No metric-backed permission-visible site is both at or above visible average traffic and below aggregate registration conversion.",
      matches.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      matches.length ? "high" : "insufficient-data",
      "Traffic and registration classifications use only explicit visible visit and registration-click counts."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "global",
      workflow: "high-traffic-low-registration"
    }),
    items: matches.map(
      ({ conversion, registrations, site, visits }) =>
        `${site.label}: ${visits} visits; ${registrations} registration clicks; ${Number(conversion.toFixed(2))}% conversion`
    ),
    searchResults: matches.map(({ conversion, registrations, site, visits }) => ({
      id: site.id,
      label: site.label,
      matchReason: `${visits} visits are at or above the visible average; ${registrations} registration clicks produce ${Number(conversion.toFixed(2))}% conversion, below the visible baseline.`,
      module: site.module,
      route: site.route,
      status: "high traffic / low registration",
      updatedAt: site.updatedAt
    }))
  };
}

function isUnresolvedHighSeverityShopErrorQuery(query: string) {
  return (
    /\bunresolved\b/i.test(query) &&
    /\b(?:high|critical)(?:[- ]severity)?\b/i.test(query) &&
    /\berrors?\b/i.test(query) &&
    /\bshop\b/i.test(query)
  );
}

function buildUnresolvedHighSeverityShopErrorResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const shop = context.entities.filter((entity) => entity.module === "shop");
  const errors = context.entities.filter((entity) => {
    if (entity.module !== "error-reports") return false;
    const text = entityText(entity);
    const unresolved = !/\b(?:fixed|ignored|resolved|closed)\b/.test(entity.status.toLowerCase());
    const highSeverity = /\b(?:high|critical)(?: severity)?\b/.test(text);
    const shopLinked =
      /\bshop\b/.test(text) || shop.some((order) => text.includes(order.id.toLowerCase()));
    return unresolved && highSeverity && shopLinked;
  });
  const referencedOrders = shop.filter((order) =>
    errors.some((error) => entityText(error).includes(order.id.toLowerCase()))
  );
  const joined = uniqueEntities([...errors, ...referencedOrders]);

  return {
    ...baseResponse(
      "Unresolved high-severity Shop errors",
      errors.length
        ? `Found ${errors.length} permission-visible unresolved high-severity error${errors.length === 1 ? "" : "s"} with explicit Shop evidence.`
        : "No permission-visible unresolved high-severity error has explicit Shop evidence.",
      errors.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      errors.length ? "high" : "insufficient-data",
      "Each result is open, explicitly high or critical severity, and explicitly connected to Shop."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "global",
      workflow: "shop-high-severity-errors"
    }),
    items: errors.map((error) => `${error.label} (${error.id}): ${error.status}`),
    searchResults: errors.map((error) => ({
      id: error.id,
      label: error.label,
      matchReason: error.matchReason,
      module: error.module,
      route: error.route,
      status: error.status,
      updatedAt: error.updatedAt
    }))
  };
}

function isCoachSiteHealthExceptionQuery(query: string) {
  return (
    /\bsites?\b/i.test(query) &&
    /\bmissing forms?\b/i.test(query) &&
    /\bbroken public (?:links?|routes?|sites?)\b/i.test(query) &&
    /\bno analytics\b/i.test(query)
  );
}

function buildCoachSiteHealthExceptionResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const analytics = context.entities.filter((entity) => entity.module === "coach-analytics");
  const matches = context.entities
    .filter((entity) => entity.module === "coach-sites")
    .map((site) => {
      const text = entityText(site);
      const reasons = [
        /\b(?:registration )?form (?:is )?missing\b|\bmissing (?:registration )?form\b/.test(text)
          ? "missing form"
          : null,
        /\bpublic (?:link|route|site)\b.{0,45}\b(?:broken|error|failed|unavailable|404)\b/.test(
          text
        )
          ? "broken public route"
          : null,
        /\bno analytics\b/.test(text) ||
        !analytics.some((entity) => entityContainsAnyTerm(entity, entityIdentityTerms(site)))
          ? "no linked analytics"
          : null
      ].filter((reason): reason is string => Boolean(reason));
      return reasons.length ? { reasons, site } : null;
    })
    .filter((match): match is { reasons: string[]; site: AdminAIEntity } => Boolean(match));
  const sites = matches.map(({ site }) => site);

  return {
    ...baseResponse(
      "Coach-site health exceptions",
      matches.length
        ? `Found ${matches.length} permission-visible coach site${matches.length === 1 ? "" : "s"} with at least one requested evidence-backed exception.`
        : "No permission-visible coach site has a missing form, broken public route, or absent linked analytics record.",
      matches.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      matches.length ? "high" : "insufficient-data",
      "Each exception is derived from explicit site facts or the absence of a linked permission-visible Analytics record."
    ),
    evidence: buildEvidenceForJoinedEntities(context, sites, {
      scope: "global",
      workflow: "coach-site-health-exceptions"
    }),
    items: matches.map(({ reasons, site }) => `${site.label}: ${reasons.join(", ")}`),
    searchResults: matches.map(({ reasons, site }) => ({
      id: site.id,
      label: site.label,
      matchReason: reasons.join(", "),
      module: site.module,
      route: site.route,
      status: "health exception",
      updatedAt: site.updatedAt
    }))
  };
}

function isChecklistQuery(query: string) {
  return /\b(?:create|generate|make|prepare)\b.{0,30}\bchecklist\b/i.test(query);
}

function buildChecklistResponse(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const selected = getEntitiesForScope(context, scope).map(
    (entity) => `Review ${entity.label}: ${entity.status}`
  );
  const items = Array.from(new Set([...context.warnings, ...context.errors, ...selected])).slice(
    0,
    12
  );
  const checklist = items.length
    ? items
    : ["Review the current permission-visible section data and confirm every missing source."];
  const title = `${context.sectionName} verification checklist`;
  return {
    ...baseResponse(
      title,
      "Created a review-only checklist from the current permission-filtered context. No action was prepared or executed.",
      "ready",
      modelRoute
    ),
    artifact: artifact(
      "checklist",
      title,
      [title, ...checklist.map((item) => `- [ ] ${item}`)].join("\n"),
      context
    ),
    confidence: confidence("high", "Every checklist item comes from visible context."),
    evidence: collectScopedEvidence(context, scope, getEntitiesForScope(context, scope)),
    items: checklist
  };
}

function readTrafficMetrics(entity: AdminAIEntity) {
  const text = entityText(entity);
  const visits = text.match(/\b(\d+(?:\.\d+)?)\s+(?:visits?|visitors?|sessions?)\b/)?.[1];
  const registrations =
    text.match(/\b(\d+(?:\.\d+)?)\s+registration clicks?\b/)?.[1] ||
    text.match(/\bregistrations?\s*(?::|is|=)?\s*(\d+(?:\.\d+)?)\b/)?.[1];
  return visits !== undefined && registrations !== undefined
    ? { registrations: Number(registrations), visits: Number(visits) }
    : null;
}

function isTrafficMetrics(
  value: ReturnType<typeof readTrafficMetrics>
): value is { registrations: number; visits: number } {
  return Boolean(value && Number.isFinite(value.visits) && Number.isFinite(value.registrations));
}

function isPublishFailureSettingsQuery(query: string) {
  return (
    /\b(?:find|identify|investigate|show|what|which)\b/i.test(query) &&
    /\b(?:settings?|configuration|fields?)\b/i.test(query) &&
    /\b(?:publish failures?|publish errors?|failed publish(?:es)?)\b/i.test(query) &&
    /\b(?:cause|causing|contribut|correlat|related|may|might|could)\w*\b/i.test(query)
  );
}

function buildPublishFailureSettingsResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const failedPublishes = context.entities.filter(
    (entity) =>
      entity.module === "shop" &&
      /\b(?:publish failed|publish failure|not published|publish pending)\b/.test(
        entityText(entity)
      )
  );
  const linkedErrors = context.entities.filter(
    (entity) =>
      entity.module === "error-reports" &&
      failedPublishes.some((publish) => entityText(entity).includes(publish.id.toLowerCase()))
  );
  const linkedPublishes = failedPublishes.filter((publish) =>
    linkedErrors.some((error) => entityText(error).includes(publish.id.toLowerCase()))
  );
  const joined = uniqueEntities([...linkedPublishes, ...linkedErrors]);

  if (!linkedErrors.length) {
    return {
      ...baseResponse(
        "Publish-failure settings investigation",
        "No linked permission-visible error evidence connects a failed Shop publish to a configuration field, so no cause was inferred.",
        "missing-data",
        modelRoute
      ),
      evidence: buildEvidenceForJoinedEntities(context, failedPublishes, {
        scope: "global",
        workflow: "publish-failure-settings"
      }),
      items: ["No configuration candidate is reported without linked error evidence."]
    };
  }

  const fields: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    {
      label: "Registration URL",
      pattern: /\bregistration (?:url|link)\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i
    },
    { label: "Coach name", pattern: /\bcoach name\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i },
    { label: "Niche", pattern: /\bniche\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i },
    { label: "Slug", pattern: /\bslug\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i },
    {
      label: "Support email",
      pattern: /\bsupport email\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i
    },
    {
      label: "Support phone/WhatsApp",
      pattern: /\bsupport (?:phone|whats ?app)\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i
    },
    { label: "Hero media", pattern: /\bhero media\s*(?:[:=]|\bis\b)\s*([^;\n|]+)/i }
  ];
  const candidates = Array.from(
    new Set(
      linkedErrors.flatMap((error) => {
        const safeErrorText = `${error.matchReason} ${error.searchableText}`;
        return fields.flatMap(({ label, pattern }) => {
          const value = safeErrorText
            .match(pattern)?.[1]
            ?.replace(/\s+/g, " ")
            .trim()
            .replace(/[.,]+$/, "")
            .slice(0, 160);
          return value ? [`${label}: ${value}`] : [];
        });
      })
    )
  );

  return {
    ...baseResponse(
      "Publish-failure settings investigation",
      "The listed setting candidates are evidence-backed correlations from linked Shop and error-report records, not proven causation. No mutation ran.",
      "ready",
      modelRoute
    ),
    confidence: confidence(
      "medium",
      "Candidates are restricted to allowlisted fields present in explicitly linked permission-visible error evidence."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "global",
      workflow: "publish-failure-settings"
    }),
    items: candidates.length
      ? candidates
      : ["Linked errors contain no allowlisted configuration-field candidate."]
  };
}

function buildPaidOrderRecoveryResponse(
  context: AdminAISectionContext,
  query: string,
  featureFlags: AdminAIFeatureFlags,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const queryLower = query.toLowerCase();
  const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  const candidates = context.entities.filter(
    (entity) =>
      entity.module === "shop" && matchesSearchPredicate(entity, "payment-publish-failure")
  );
  const order =
    candidates.find(
      (entity) => selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase())
    ) ||
    candidates.find(
      (entity) =>
        queryLower.includes(entity.id.toLowerCase()) ||
        queryLower.includes(entity.label.toLowerCase())
    ) ||
    (candidates.length === 1 ? candidates[0] : undefined);
  const draft = order
    ? context.entities.find(
        (entity) =>
          entity.module === "coach-sites" && entityText(order).includes(entity.id.toLowerCase())
      ) ||
      context.entities.find(
        (entity) =>
          entity.module === "coach-sites" && entityText(entity).includes(order.id.toLowerCase())
      )
    : undefined;
  const errors = order
    ? context.entities.filter(
        (entity) =>
          entity.module === "error-reports" &&
          (entityText(entity).includes(order.id.toLowerCase()) ||
            Boolean(draft && entityText(entity).includes(draft.id.toLowerCase())))
      )
    : [];
  const registeredAction = context.registeredActions.find(
    (action) => action.id === "shop.retry-publish"
  );
  const hasPermissions = Boolean(
    registeredAction &&
    registeredAction.requiredPermissions.every((permission) =>
      context.permissions.includes(permission)
    )
  );
  const executable = Boolean(
    order &&
    draft &&
    registeredAction &&
    hasPermissions &&
    featureFlags.actions &&
    featureFlags.sensitiveActions
  );
  const affectedRecords = uniqueEntities(
    [order, draft, ...errors].filter((entity): entity is AdminAIEntity => Boolean(entity))
  ).map((entity) => entity.label);
  const plan: AdminAIPlan = {
    affectedRecords,
    approvalLevel: 3,
    confirmationRequired: true,
    executable,
    expectedOutcome:
      "Re-run the existing registered paid-order publish recovery only after explicit confirmation.",
    id: `plan-${stableHash(`shop-paid-order:${order?.id || "unresolved"}`)}`,
    otpRequired: false,
    permissions: registeredAction?.requiredPermissions || ["shop.recovery"],
    request: query,
    reversible: false,
    risks: [
      "Payment truth remains server-side and is not inferred by a model.",
      "This response prepares the existing recovery workflow; it does not execute or claim success.",
      ...(registeredAction
        ? []
        : ["The exact shop.retry-publish action is not registered in this context."]),
      ...(hasPermissions ? [] : ["The required shop recovery permission is unavailable."])
    ],
    rollback:
      "No rollback is claimed by the preparatory plan; the existing production recovery workflow remains authoritative.",
    sectionId: "shop",
    steps: [
      {
        actionId: null,
        api: null,
        id: "read-order",
        label: "Read the permission-visible order status",
        mutation: false,
        status: order ? "ready" : "blocked"
      },
      {
        actionId: null,
        api: null,
        id: "verify-payment",
        label: "Verify the server-side payment-success state",
        mutation: false,
        status: order ? "ready" : "blocked"
      },
      {
        actionId: null,
        api: null,
        id: "verify-draft",
        label: "Verify the associated draft and publish readiness",
        mutation: false,
        status: draft ? "ready" : "blocked"
      },
      {
        actionId: null,
        api: null,
        id: "check-errors",
        label: "Review recent related publish errors",
        mutation: false,
        status: order ? "ready" : "blocked"
      },
      {
        actionId: registeredAction?.id || null,
        api: registeredAction?.relatedAPI || null,
        id: "prepare-retry",
        label: registeredAction
          ? `Prepare ${registeredAction.label}`
          : "Registered retry action unavailable",
        mutation: true,
        status: executable ? "ready" : "blocked"
      },
      {
        actionId: null,
        api: "/api/admin/ai-actions",
        id: "audit-after-execution",
        label: "Record the verified outcome only after the production action returns",
        mutation: false,
        status: executable ? "pending" : "blocked"
      }
    ],
    title: "Paid-order recovery plan"
  };
  const orderStatus = order?.status.toLowerCase().replace(/[_-]+/g, " ") || "unavailable";
  const paymentState = /\bpayment succeeded\b|\bpaid\b/.test(orderStatus)
    ? "succeeded"
    : "unverified";
  const draftReadiness = draft
    ? /\bpublish readiness (?:is )?ready\b|\bready\b/.test(entityText(draft))
      ? "ready"
      : "unverified"
    : "missing";
  const items = [
    `Order status: ${order?.status || "unavailable"}`,
    `Server-side payment state: ${paymentState}`,
    `Associated draft: ${draft?.label || "missing"}`,
    `Publish readiness: ${draftReadiness}`,
    `Recent errors: ${errors.length} related error${errors.length === 1 ? "" : "s"}`,
    `Registered recovery action: ${registeredAction?.id || "unavailable"}`
  ];
  const joined = [order, draft, ...errors].filter((entity): entity is AdminAIEntity =>
    Boolean(entity)
  );

  return {
    ...baseResponse(
      "Review paid-order recovery plan",
      executable
        ? "The exact registered recovery action is ready for explicit confirmation. Nothing has executed."
        : "The recovery evidence is reviewable, but execution remains blocked by missing data, registration, permission, or feature flags.",
      executable ? "confirmation-required" : order ? "action-prepared" : "missing-data",
      modelRoute
    ),
    artifact: planArtifact(plan, context),
    confidence: confidence(
      order && draft ? "high" : "insufficient-data",
      order && draft
        ? "Payment, draft, error, permission, and action-registration checks are deterministic."
        : "The order or associated draft is unavailable."
    ),
    evidence: buildEvidenceForJoinedEntities(context, joined, {
      scope: "global",
      workflow: "paid-order-recovery"
    }),
    items,
    plan
  };
}

function entityIdentityTerms(entity: AdminAIEntity) {
  const generic = new Set([
    "admin",
    "coach",
    "draft",
    "error",
    "order",
    "published",
    "registration",
    "site"
  ]);
  return Array.from(
    new Set(
      tokenizeQuery(entity.label)
        .map(normalizeSearchTerm)
        .filter((term) => term.length >= 3 && !generic.has(term))
    )
  );
}

function entityText(entity: AdminAIEntity) {
  const raw =
    `${entity.id} ${entity.label} ${entity.status} ${entity.matchReason} ${entity.searchableText}`.toLowerCase();
  return `${raw} ${raw.replace(/[_-]+/g, " ")}`;
}

function entityContainsAnyTerm(entity: AdminAIEntity, terms: string[]) {
  const text = entityText(entity);
  return terms.length > 0 && terms.some((term) => text.includes(term));
}

function extractRegistrationClicks(entities: AdminAIEntity[]) {
  for (const entity of entities) {
    const text = entityText(entity);
    const count =
      text.match(/\b(\d+)\s+registration clicks?\b/)?.[1] ||
      text.match(/\bregistrations?\s+(\d+)\b/)?.[1];
    if (count !== undefined) return Number(count);
  }
  return null;
}

function uniqueEntities(entities: AdminAIEntity[]) {
  return Array.from(new Map(entities.map((entity) => [entity.id, entity])).values());
}

function buildEvidenceForJoinedEntities(
  context: AdminAISectionContext,
  entities: AdminAIEntity[],
  filters: Record<string, string>
): AdminAIEvidence[] {
  const groups = new Map<string, AdminAIEntity[]>();
  entities.forEach((entity) => {
    const group = groups.get(entity.source) || [];
    group.push(entity);
    groups.set(entity.source, group);
  });
  return Array.from(groups.entries()).map(([source, sourceEntities]) => ({
    dateRange: context.dateRange,
    entityReferences: sourceEntities.map((entity) => entity.id),
    filters: { ...context.filters, ...filters },
    freshness: context.dataFreshness,
    label: sourceEntities.map((entity) => entity.label).join(", "),
    module: sourceEntities[0]?.module || context.sectionId,
    observedAt: context.lastUpdated,
    recordCount: sourceEntities.length,
    source,
    sourceRoute: sourceEntities[0]?.route || context.currentRoute
  }));
}

function findRegisteredAdminAIAction(request: string, actions: AdminAIRegisteredActionView[]) {
  const requestTokens = getActionMatchTokens(request);
  const ranked = actions
    .map((action, index) => {
      const actionTokens = new Set(
        getActionMatchTokens(`${action.id} ${action.label} ${action.searchText}`)
      );
      const overlap = requestTokens.filter((token) => actionTokens.has(token));
      return { action, index, score: overlap.length };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  if (ranked[0]) return ranked[0].action;

  if (actions.length === 1 && MUTATION_WORDS.test(request)) {
    const command = getAdminAICommand(actions[0].id);
    if (command && command.executionContract.availability !== "executable") return actions[0];
  }

  return undefined;
}

function getActionMatchTokens(value: string) {
  return Array.from(
    new Set(
      sanitizeQuery(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => {
          if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
          if (token.endsWith("s") && token.length > 4 && !token.endsWith("ss"))
            return token.slice(0, -1);
          return token;
        })
        .filter(
          (token) =>
            token.length > 2 &&
            !ACTION_MATCH_STOP_WORDS.has(token) &&
            !["and", "for", "from", "into", "the", "then", "with"].includes(token)
        )
    )
  );
}

function buildAdminAIDryRunPreview(input: {
  affectedRecords: string[];
  command: AdminAICommand | undefined;
  context: AdminAISectionContext;
  executable: boolean;
  request: string;
  results: AdminAISearchResult[];
}): AdminAIDryRunPreview {
  const { affectedRecords, command, context, executable, request, results } = input;
  const selectedEntity = context.selectedRows
    .map((id) => context.entities.find((entity) => entity.id === id))
    .find((entity): entity is AdminAIEntity => Boolean(entity));
  const selectedStatus = selectedEntity?.status || results[0]?.status;
  const validation: AdminAIDryRunPreview["validation"] =
    command?.executionContract.availability === "executable" || command?.type === "suggest"
      ? "requires-review"
      : "blocked";
  const preview = resolveTypedAdminAIDryRunValues({
    command,
    context,
    request,
    selectedStatus: context.selectedRows.length ? selectedStatus : undefined
  });

  return {
    before: preview?.before || [
      "Current value (unknown): not present in permission-filtered context"
    ],
    dependencies: command?.executionContract.dependencies || [
      "Permission-filtered current context",
      "Explicit registered action mapping"
    ],
    errors:
      validation === "blocked"
        ? [
            command
              ? "The matched command is review-only; no mutation can run from Copilot."
              : "No registered executable handler matches this request."
          ]
        : [],
    proposedAfter: preview?.proposedAfter || ["Recommendation only; no proposed mutation."],
    publicOutputChanges: /\b(?:publish|public url|registration url|visibility)\b/i.test(request),
    recordsSkipped: executable ? [] : affectedRecords,
    validation
  };
}

function resolveTypedAdminAIDryRunValues(input: {
  command: AdminAICommand | undefined;
  context: AdminAISectionContext;
  request: string;
  selectedStatus: string | undefined;
}): Pick<AdminAIDryRunPreview, "before" | "proposedAfter"> | undefined {
  const { command, context, request, selectedStatus } = input;
  const filters = context.filters;
  if (command?.id === "settings.update-proactive-suggestions") {
    const current = parseBoolean(filters.proactiveSuggestionsEnabled);
    if (current !== null)
      return typedDryRun("proactiveSuggestionsEnabled", "boolean", current, !current);
  }

  const url = request.match(/https?:\/\/[^\s]+/i)?.[0];
  if (/\bregistration (?:link|url)\b/i.test(request) && filters.registrationUrl && url) {
    return typedDryRun("registrationUrl", "string", filters.registrationUrl, url);
  }

  const visibility = request.match(/\bvisibility\s+(?:to\s+)?(public|private|unlisted)\b/i)?.[1];
  if (filters.visibility && visibility) {
    return typedDryRun("visibility", "string", filters.visibility, visibility.toLowerCase());
  }

  if (command?.id === "create-coach-site.prepare-publish" && selectedStatus) {
    return typedDryRun("status", "string", selectedStatus, "published");
  }

  if (command?.id === "backup-cleanup.prepare-cleanup" && selectedStatus) {
    return typedDryRun("status", "string", selectedStatus, "protected-review-only", "cleanupMode");
  }

  if (command?.id === "coach-sites.prepare-archive" && selectedStatus) {
    return typedDryRun("status", "string", selectedStatus, "archived");
  }

  const supportDefault = request.match(
    /\bsupport default\s+(?:to|as)\s+([a-z][a-z0-9_-]*)\b/i
  )?.[1];
  if (filters.supportDefault && supportDefault) {
    return typedDryRun("supportDefault", "string", filters.supportDefault, supportDefault);
  }

  const retentionDays = request.match(/\bretention(?:\s+days?)?\s+(?:to\s+)?(\d+)\b/i)?.[1];
  const currentRetentionDays = parseNumber(filters.analyticsRetentionDays);
  if (retentionDays && currentRetentionDays !== null) {
    return typedDryRun(
      "analyticsRetentionDays",
      "number",
      currentRetentionDays,
      Number(retentionDays)
    );
  }

  const role = request.match(/\brole\s+(?:to|as)\s+([a-z][a-z0-9_-]*)\b/i)?.[1];
  if (filters.role && role) return typedDryRun("role", "string", filters.role, role);

  return undefined;
}

function typedDryRun(
  currentKey: string,
  type: "boolean" | "number" | "string",
  currentValue: boolean | number | string,
  proposedValue: boolean | number | string,
  proposedKey = currentKey
) {
  return {
    before: [`${currentKey} (${type}): ${String(currentValue)}`],
    proposedAfter: [`${proposedKey} (${type}): ${String(proposedValue)}`]
  };
}

function parseBoolean(value: string | undefined) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAdminAIPlan(
  request: string,
  scope: AdminAIScope,
  context: AdminAISectionContext,
  featureFlags: AdminAIFeatureFlags
): AdminAIPlan {
  const results = searchAdminAIEntities(context, request, scope);
  const approvalLevel = getApprovalLevel(request);
  const registeredAction = findRegisteredAdminAIAction(request, context.registeredActions);
  const registeredCommand = registeredAction ? getAdminAICommand(registeredAction.id) : undefined;
  const sensitiveAllowed = approvalLevel < 3 || featureFlags.sensitiveActions;
  const executable = Boolean(
    featureFlags.actions &&
    sensitiveAllowed &&
    registeredCommand?.executionContract.availability === "executable"
  );
  const affectedRecords = (
    results.length
      ? results.map((item) => item.label)
      : context.selectedRows.map(
          (id) => context.entities.find((entity) => entity.id === id)?.label || id
        )
  ).slice(0, 12);
  const confirmationRequired = approvalLevel >= 1;
  const otpRequired =
    approvalLevel === 3 &&
    Boolean(
      registeredCommand?.otpRequired ||
      /archive|cleanup|delete|remove|resend.{0,20}otp|revoke|role|suspend/i.test(request)
    );
  const risks = [
    approvalLevel === 3
      ? "Sensitive action: existing production security remains authoritative."
      : "Review generated values before approval.",
    results.length > 12
      ? `${results.length - 12} additional matched records are excluded from this bounded plan.`
      : "Result set is bounded to permission-visible records."
  ];
  if (!featureFlags.actions) risks.push("Admin AI action preparation is disabled by feature flag.");
  if (approvalLevel === 3 && !featureFlags.sensitiveActions)
    risks.push("Sensitive Admin AI actions are disabled by feature flag.");
  const backupRecommended =
    approvalLevel === 3 && /\b(?:cleanup|delete|purge|remove|truncate)\b/i.test(request);
  if (backupRecommended) risks.push("Verify a current backup before approval.");
  if (context.sectionId === "admin-users" && affectedRecords.length) {
    const target = affectedRecords.join(", ");
    if (/\bsuspend\b/i.test(request)) {
      risks.push(
        `Suspension impact for ${target}: Admin access is disabled and active sessions must be revoked after protected confirmation.`
      );
    } else if (/\b(?:delete|remove)\b/i.test(request)) {
      risks.push(
        `Removal impact for ${target}: Admin access is removed; root-owner and last-owner protections remain authoritative.`
      );
    }
  }
  if (!registeredAction)
    risks.push("No registered action matches this language; arbitrary execution is prohibited.");
  else if (registeredCommand?.executionContract.availability !== "executable")
    risks.push("The matched command is review-only; direct Copilot mutation remains disabled.");

  return {
    affectedRecords,
    approvalLevel,
    confirmationRequired,
    dryRunPreview: buildAdminAIDryRunPreview({
      affectedRecords,
      command: registeredCommand,
      context,
      executable,
      request,
      results
    }),
    executable,
    expectedOutcome: executable
      ? `Open the registered ${registeredAction?.label || "protected"} workflow for explicit review.`
      : "Produce a reviewable checklist without changing data.",
    id: `plan-${stableHash(`${context.sectionId}:${request}`)}`,
    otpRequired,
    permissions: registeredAction?.requiredPermissions || [],
    request,
    reversible: registeredCommand?.rollback === "available-after-persist",
    risks,
    rollback:
      registeredCommand?.rollback === "available-after-persist"
        ? "Capture the previous value and expose undo only after a real persisted change."
        : `No rollback is claimed for sensitive or irreversible operations.${backupRecommended ? " Verify a current backup before approval." : ""}`,
    sectionId: context.sectionId,
    steps: [
      {
        actionId: null,
        api: null,
        id: "identify",
        label: "Identify permission-visible affected records",
        mutation: false,
        status: "ready"
      },
      {
        actionId: null,
        api: null,
        id: "validate",
        label: "Validate dependencies, current state, and risks",
        mutation: false,
        status: "ready"
      },
      {
        actionId: registeredAction?.id || null,
        api: registeredAction?.relatedAPI || null,
        id: "prepare",
        label: registeredAction
          ? `Prepare ${registeredAction.label}`
          : "Prepare recommendations only",
        mutation: approvalLevel >= 2,
        status: executable ? "ready" : "blocked"
      },
      {
        actionId: null,
        api: "/api/admin/ai-actions",
        id: "audit",
        label: "Record approval outcome without secrets or OTPs",
        mutation: false,
        status: executable ? "ready" : "pending"
      }
    ],
    title: `${context.sectionName} action plan`
  };
}

function buildSearchResponse(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const results = searchAdminAIEntities(context, query, scope);
  return {
    ...baseResponse(
      results.length
        ? `${results.length} matching record${results.length === 1 ? "" : "s"}`
        : "No matching records",
      results.length
        ? "Results come from a bounded, allowlisted, permission-filtered in-memory index. No arbitrary SQL or raw database query ran."
        : "No permission-visible loaded record matched the current terms and scope.",
      results.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      results.length ? "high" : "insufficient-data",
      results.length
        ? "Deterministic concept or lexical match after typed scope filters."
        : "No matching loaded record."
    ),
    evidence: collectEvidence(context, results.length),
    items: results.map((item) => `${item.label} / ${item.status} / ${item.matchReason}`),
    searchResults: results
  };
}

function buildBuilderInspectionResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const snapshot = context.intelligence?.builderInspection;
  if (!snapshot) {
    return {
      ...baseResponse(
        "Builder inspection unavailable",
        "The current unsaved Builder snapshot is not available. No publish-readiness result was inferred.",
        "missing-data",
        modelRoute
      ),
      confidence: confidence("insufficient-data", "No Builder inspection snapshot was supplied."),
      evidence: collectEvidence(context, 0),
      items: ["Open the Builder and load the current form before running the inspection."]
    };
  }

  const inspection = inspectAdminAIBuilder(snapshot);
  const content = [
    `Builder readiness: ${inspection.outcome}`,
    `Score: ${inspection.score}/100`,
    inspection.authoritativeValidation,
    ...inspection.checks.map((check) => `- ${check.id} [${check.status}]: ${check.detail}`)
  ].join("\n");
  return {
    ...baseResponse(
      `Builder inspection: ${inspection.outcome}`,
      `Completed all ${inspection.checks.length} advisory checks. Existing production validation remains authoritative.`,
      inspection.outcome === "ready"
        ? "ready"
        : inspection.outcome === "not-ready"
          ? "blocked-missing-data"
          : "partial-success",
      modelRoute
    ),
    artifact: artifact("publish-readiness", "Builder Publish Readiness", content, context),
    builderInspection: inspection,
    confidence: confidence(
      inspection.missingInputs.length ? "insufficient-data" : "high",
      inspection.missingInputs.length
        ? `Missing inspection inputs: ${inspection.missingInputs.join(", ")}.`
        : "All results come from the supplied Builder snapshot and the production-validator outcome."
    ),
    evidence: collectEvidence(context, inspection.checks.length),
    items: inspection.risks.length ? inspection.risks : ["No publish risk was detected."]
  };
}

function buildSelectedErrorResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const selectedReferenceId = context.selectedRows[0] || "";
  const selectedReport = (context.intelligence?.errorReports || []).find(
    ({ referenceId }) => referenceId === selectedReferenceId
  );
  const investigation = investigateAdminAIError({
    reports: context.intelligence?.errorReports || [],
    selectedReferenceId
  });
  const staleError = selectedReport
    ? detectStaleAdminAIError({ evaluatedAt: context.lastUpdated, report: selectedReport })
    : null;
  const ready = investigation.status === "ready";
  const content = [
    `Summary: ${investigation.summary}`,
    `Status: ${investigation.status}`,
    `Severity: ${investigation.severity}`,
    `Impact: ${investigation.impactSummary}`,
    "Affected users or entities:",
    ...(investigation.affectedUsersOrEntities.length
      ? investigation.affectedUsersOrEntities.map((item) => `- ${item}`)
      : ["- None"]),
    "Evidence:",
    ...(investigation.evidence.length
      ? investigation.evidence.map((item) => `- ${item}`)
      : ["- None"]),
    `Likely cause: ${investigation.likelyCause}`,
    "Reproduction:",
    ...(investigation.reproduction.length
      ? investigation.reproduction.map((item, index) => `${index + 1}. ${item}`)
      : ["1. Unavailable"]),
    `Recommended fix: ${investigation.recommendedFix}`,
    `Safe temporary action: ${investigation.safeTemporaryAction}`,
    "Related errors:",
    ...(investigation.relatedErrors.length
      ? investigation.relatedErrors.map((item) => `- ${item}`)
      : ["- None"]),
    `Staleness: ${staleError?.classification || "unavailable"}`,
    ...(staleError?.evidence || []).map((item) => `- ${item}`),
    `Resolution status: ${investigation.resolutionStatus}`
  ].join("\n");
  return {
    ...baseResponse(
      ready ? "Selected error investigation" : "Selected error unavailable",
      ready
        ? `Prepared a bounded, developer-ready investigation for the selected permission-visible error only; staleness is ${staleError?.classification || "unavailable"}.`
        : investigation.summary,
      ready ? "ready" : "missing-data",
      modelRoute
    ),
    artifact: artifact("error-investigation", "Selected Error Investigation", content, context),
    confidence: confidence(
      ready ? "medium" : "insufficient-data",
      ready
        ? "The evidence is grounded, but the likely cause remains a hypothesis until reproduced."
        : "The selected reference is absent from the supplied permission-visible reports."
    ),
    errorInvestigation: investigation,
    evidence: collectEvidence(context, ready ? 1 + investigation.relatedErrors.length : 0),
    items: [
      ...investigation.evidence,
      ...(staleError?.evidence || []),
      `Recommended fix: ${investigation.recommendedFix}`
    ].slice(0, 12)
  };
}

function buildTableResponse(
  context: AdminAISectionContext,
  query: string,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const table = context.intelligence?.table;
  if (!table) {
    return baseResponse(
      "Table context unavailable",
      "No permission-visible table snapshot is loaded for this request.",
      "missing-data",
      modelRoute
    );
  }

  const capability = getTableCapability(query);
  const analysis = runAdminAITableCopilot(table, capability);
  const resultCount = analysis.rowResults.length || analysis.groups.length;
  const selectedCapability = [
    "analyze-selected",
    "generate-selected-report",
    "propose-bulk-action"
  ].includes(capability);
  const missingSelection = selectedCapability && analysis.selectedCount === 0;
  return {
    ...baseResponse(
      missingSelection ? "No visible selected rows" : "Table analysis complete",
      analysis.summary,
      missingSelection ? "missing-data" : "ready",
      modelRoute
    ),
    confidence: confidence(
      missingSelection ? "insufficient-data" : "high",
      missingSelection
        ? "No selected identifier matched a permission-visible row."
        : "Deterministic analysis used only the bounded, allowlisted table snapshot."
    ),
    evidence: collectEvidence(context, resultCount),
    items: [
      ...analysis.rowResults.map((row) => `${row.label} (${row.status}): ${row.reasons.join(" ")}`),
      ...analysis.groups.map((group) => `${group.key}: ${group.recordIds.join(", ")}`)
    ].slice(0, 20),
    tableAnalysis: analysis
  };
}

function getTableCapability(query: string): AdminAITableCapability {
  if (/\bduplicates?\b/i.test(query)) return "identify-duplicates";
  if (/\bgroup related\b/i.test(query)) return "group-related";
  if (/\bstatus differences?\b/i.test(query)) return "explain-status-differences";
  if (/\bbulk action\b/i.test(query)) return "propose-bulk-action";
  if (/\bselected\b/i.test(query) && /\breport\b/i.test(query)) {
    return "generate-selected-report";
  }
  if (/\bselected\b/i.test(query)) return "analyze-selected";
  if (/\banomal(?:y|ies|ous)\b/i.test(query)) return "find-anomalies";
  if (/\battention\b/i.test(query)) return "identify-attention";
  return "summarize-visible";
}

function buildDailyBriefingResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const blocks: GenerateAdminAIDailyBriefingInput["blocks"] = {};
  const addBlock = (id: AdminAIDailyBriefingBlockId, entries: AdminAIReportEntryInput[]) => {
    if (entries.length) blocks[id] = entries;
  };
  const metric = (pattern: RegExp) =>
    context.visibleDataSummary.find((item) => pattern.test(item.label));
  const observedMetric = (item: (typeof context.visibleDataSummary)[number]) => ({
    classification: "observed" as const,
    label: item.label,
    source: item.source,
    value: item.value
  });
  const intelligence = context.intelligence;
  const alerts = intelligence ? buildEvidenceBackedHealthAlerts(intelligence.healthEvidence) : [];
  const healthScore = intelligence ? buildTransparentHealthScore(intelligence.healthScore) : null;
  const published = metric(/\bpublished\b/i);
  const purchases = metric(/\b(?:shop )?purchases?\b/i);

  if (healthScore?.score !== null && healthScore?.score !== undefined) {
    addBlock("platform-health", [
      {
        classification: "computed",
        label: "Admin health score",
        source: "platform-health",
        value: healthScore.score
      }
    ]);
  }
  if (published) addBlock("sites-published", [observedMetric(published)]);
  if (purchases) addBlock("shop-purchases", [observedMetric(purchases)]);

  const exceptions = context.warnings.filter((item) => /payment|publish/i.test(item));
  if (exceptions.length) {
    addBlock("payment-publish-exceptions", [
      {
        classification: "observed",
        label: "Payment/publish exceptions",
        source: "admin-context-warnings",
        value: exceptions.join(" | ")
      }
    ]);
  }

  const highErrors = intelligence?.errorReports.filter((item) => item.severity === "high") || [];
  if (highErrors.length) {
    addBlock("new-high-priority-errors", [
      {
        classification: "observed",
        label: "High-priority permission-visible errors",
        source: "error-reports",
        value: highErrors.length
      }
    ]);
  }
  if (alerts.length) {
    addBlock(
      "recommended-focus",
      alerts.slice(0, 5).map((alert) => ({
        classification: "recommendation",
        label: alert.whatHappened,
        source: alert.module,
        value: alert.suggestedNextStep
      }))
    );
  }

  const report = generateAdminAIDailyBriefing({
    blocks,
    dateRange: context.dateRange,
    filters: context.filters,
    freshness: context.dataFreshness,
    generatedAt: context.lastUpdated || new Date().toISOString()
  });
  const realEntries = report.sections
    .flatMap((section) => section.entries)
    .filter((entry) => entry.classification !== "missing");
  return {
    ...baseResponse(
      report.title,
      `Generated all ${report.sections.length} ordered briefing blocks; unavailable sources are labelled missing.`,
      realEntries.length ? "ready" : "missing-data",
      modelRoute
    ),
    artifact: artifact("report", report.title, formatStructuredReport(report), context),
    confidence: confidence(
      realEntries.length ? "high" : "insufficient-data",
      realEntries.length
        ? "Every populated block is source-labelled; absent blocks remain explicitly missing."
        : "No source-backed briefing facts are loaded."
    ),
    evidence: collectEvidence(context, realEntries.length),
    items: alerts.slice(0, 5).map((alert) => alert.suggestedNextStep),
    structuredReport: report
  };
}

function buildHealthResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const intelligence = context.intelligence;
  const alerts = intelligence ? buildEvidenceBackedHealthAlerts(intelligence.healthEvidence) : [];
  const signals = intelligence
    ? alerts.map((alert) => ({
        affectedEntity: alert.affectedEntity,
        confidence: "high" as const,
        directRoute: alert.directRoute,
        evidence: alert.evidence.map((item) => item.summary).join(" / "),
        firstDetected: alert.firstDetected,
        id: alert.id,
        impact: alert.impact,
        lastDetected: alert.lastDetected,
        module: alert.module,
        recurrenceCount: alert.recurrenceCount,
        severity: alert.severity,
        suggestedNextStep: alert.suggestedNextStep,
        title: alert.whatHappened
      }))
    : buildAdminAIHealthSignals(context);
  const transparentScore = intelligence
    ? buildTransparentHealthScore(intelligence.healthScore)
    : null;
  const score = transparentScore
    ? {
        calculatedAt: transparentScore.calculatedAt,
        calculation: transparentScore.calculation,
        components: transparentScore.components.map((component) => ({
          calculation: component.calculation,
          howToImprove: [...component.howToImprove],
          id: component.id,
          inputs: component.exactInputs.map(
            (item) => `${item.label}: ${String(item.value)} (${item.source})`
          ),
          label: component.label,
          missingInputs: [...component.missingInputs],
          score: component.score,
          weight: component.weight
        })),
        missingInputs: [...transparentScore.missingInputs],
        score: transparentScore.score
      }
    : buildAdminAIHealthScore(context);
  const limit = preferences.responseLength === "detailed" ? 12 : 5;
  const scoreLabel = score.score === null ? "Unavailable" : `${score.score}/100`;
  const content = [
    `Admin health score: ${scoreLabel}`,
    ...score.components.map(
      (item) => `${item.label}: ${item.score === null ? "Unavailable" : `${item.score}/100`}`
    ),
    ...signals
      .slice(0, limit)
      .map((item) => `${item.severity.toUpperCase()}: ${item.title} - ${item.evidence}`)
  ].join("\n");
  return {
    ...baseResponse(
      signals.length
        ? `${signals.length} evidence-backed attention signal${signals.length === 1 ? "" : "s"}`
        : "No current health alert",
      `Transparent score: ${scoreLabel}. Missing dimensions remain unavailable instead of being estimated.`,
      signals.length ? "ready" : context.emptyState ? "missing-data" : "ready",
      modelRoute
    ),
    artifact: artifact("health-report", "Admin Platform Health Briefing", content, context),
    confidence: confidence(
      context.emptyState ? "insufficient-data" : "high",
      "Deterministic rules over loaded source status and records."
    ),
    evidence: collectEvidence(context, signals.length),
    anomalyAnalysis: intelligence?.anomalyAnalysis,
    healthScore: score,
    healthSignals: signals,
    items: signals.slice(0, limit).map((item) => `${item.severity}: ${item.title}`)
  };
}

function buildAnalyticsResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  if (context.intelligence) {
    const explanation = explainAdminAIAnalytics({
      points: context.intelligence.analyticsPoints,
      refreshedAt: context.lastUpdated
    });
    const missing = explanation.status === "insufficient-baseline";
    return {
      ...baseResponse(
        missing ? "Insufficient baseline" : "Deterministic chart explanation",
        explanation.evidence.dataRange
          ? `Current visits ${explanation.trend.currentVisits.toLocaleString()} across ${explanation.evidence.dataRange}.`
          : "No real analytics buckets are available.",
        explanation.evidence.dataRange ? (missing ? "partial-success" : "ready") : "missing-data",
        modelRoute
      ),
      analyticsExplanation: explanation,
      confidence: confidence(
        missing ? "insufficient-data" : "high",
        missing
          ? "One or more previous-period analytics buckets are unavailable."
          : "Computed from complete current and previous source buckets."
      ),
      evidence: collectEvidence(context, context.intelligence.analyticsPoints.length),
      items: [...explanation.missingDataWarnings, ...explanation.investigationSteps].slice(0, 12)
    };
  }
  const points = context.analyticsSeries;
  if (points.length < 2) {
    return {
      ...baseResponse(
        "Insufficient baseline",
        "At least two real chart buckets are required for trend or anomaly analysis.",
        "missing-data",
        modelRoute
      ),
      confidence: confidence("insufficient-data", "The loaded historical series is too short."),
      evidence: collectEvidence(context, points.length),
      items: []
    };
  }
  const current = points.reduce((total, point) => total + point.current, 0);
  const previous = points.reduce((total, point) => total + point.previous, 0);
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const peak = points.reduce(
    (best, point) => (point.current > best.current ? point : best),
    points[0]
  );
  const anomaly =
    delta === null
      ? "Insufficient previous-period baseline"
      : Math.abs(delta) >= 30
        ? `Large ${delta > 0 ? "increase" : "drop"} of ${Math.abs(delta)}% needs verification.`
        : `Change of ${delta}% is within the simple 30% alert threshold.`;
  return {
    ...baseResponse(
      "Deterministic chart explanation",
      `Current total ${current.toLocaleString()} versus ${previous.toLocaleString()} in the previous period.`,
      "ready",
      modelRoute
    ),
    confidence: confidence(
      previous > 0 ? "high" : "insufficient-data",
      previous > 0 ? "Computed from real current and previous buckets." : "No previous baseline."
    ),
    evidence: collectEvidence(context, points.length),
    items: [
      delta === null ? "Previous-period change: unavailable" : `Period change: ${delta}%`,
      `Peak bucket: ${peak.label} with ${peak.current.toLocaleString()}`,
      anomaly,
      "Correlation only: this analysis does not claim causation."
    ]
  };
}

function buildExecutiveReportResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  query: string,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const scopedEntities = getEntitiesForScope(context, scope);
  const scopedMetrics = getVisibleMetricsForScope(context, scope);
  const scopeFilters = buildEffectiveScopeFilters(context, scope);
  const scopedContext: AdminAISectionContext = {
    ...context,
    entities: scopedEntities,
    errors: scope === "selection" ? [] : context.errors,
    visibleDataSummary: scopedMetrics,
    warnings: scope === "selection" ? [] : context.warnings
  };
  if (context.intelligence) {
    const reportType = getExecutiveReportType(query, context.sectionId);
    const entries = buildStructuredReportEntries(
      scopedContext,
      scope,
      scopedEntities,
      scopedMetrics
    );
    const report = generateAdminAIExecutiveReport({
      dateRange: context.dateRange,
      entries,
      filters: scopeFilters,
      freshness: context.dataFreshness,
      generatedAt: context.lastUpdated || new Date().toISOString(),
      reportType
    });
    const realEntries = report.sections
      .flatMap((section) => section.entries)
      .filter((entry) => entry.classification !== "missing");
    return {
      ...baseResponse(
        report.title,
        `Generated ${realEntries.length} source-labelled report entr${realEntries.length === 1 ? "y" : "ies"}.`,
        realEntries.length ? "ready" : "missing-data",
        modelRoute
      ),
      artifact: artifact("report", report.title, formatStructuredReport(report), context),
      confidence: confidence(
        realEntries.length ? "high" : "insufficient-data",
        realEntries.length
          ? "Every non-missing entry includes provenance metadata."
          : "No report facts are loaded."
      ),
      evidence: collectScopedEvidence(context, scope, scopedEntities),
      items: preferences.includeActionItems
        ? report.sections
            .find((section) => section.classification === "recommendation")
            ?.entries.map((entry) => `${entry.label}: ${String(entry.value)}`)
            .slice(0, 5) || []
        : [],
      structuredReport: report
    };
  }
  const signals = buildAdminAIHealthSignals(scopedContext);
  const title = /monthly/i.test(query)
    ? "Monthly Growth and Operations Report"
    : /weekly/i.test(query)
      ? "Weekly Admin Operations Report"
      : `${context.sectionName} Operations Report`;
  const facts =
    scope === "selection"
      ? scopedEntities.map(
          (entity) =>
            `${entity.label}: ${entity.status}; updated ${entity.updatedAt} (${entity.source})`
        )
      : scopedMetrics.map((item) => `${item.label}: ${String(item.value)} (${item.source})`);
  const missing = scopedContext.errors.length
    ? scopedContext.errors
    : ["No missing source reported in the effective scope."];
  const content = [
    title,
    `Date range: ${context.dateRange}`,
    `Filters: ${Object.entries(scopeFilters)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`,
    `Freshness: ${context.dataFreshness}`,
    "Observed facts:",
    ...facts.map((item) => `- ${item}`),
    "Computed metrics:",
    `- Evidence-backed attention signals: ${signals.length}`,
    `- Permission-visible indexed records: ${scopedEntities.length}`,
    "AI interpretation (deterministic):",
    ...(signals.length
      ? signals.map((item) => `- ${item.title}: ${item.evidence}`)
      : ["- No evidence-backed warning signal."]),
    "Missing data:",
    ...missing.map((item) => `- ${item}`),
    "Recommendations:",
    ...(signals.length
      ? signals.map((item) => `- ${item.suggestedNextStep}`)
      : ["- Continue normal review; no warning supports a stronger action."])
  ].join("\n");
  return {
    ...baseResponse(
      title,
      `Generated from ${facts.length} facts and ${signals.length} health signals.`,
      facts.length ? "ready" : "missing-data",
      modelRoute
    ),
    artifact: artifact("report", title, content, context),
    confidence: confidence(
      facts.length ? "high" : "insufficient-data",
      facts.length ? "Observed facts are source-labelled." : "No metrics loaded."
    ),
    evidence: collectScopedEvidence(context, scope, scopedEntities),
    items: preferences.includeActionItems
      ? signals.slice(0, 5).map((item) => item.suggestedNextStep)
      : []
  };
}

function getExecutiveReportType(
  query: string,
  sectionId: AdminAISectionContext["sectionId"]
): AdminAIExecutiveReportType {
  const lower = query.toLowerCase();
  const exact = ADMIN_AI_EXECUTIVE_REPORT_TYPES.find((type) => lower.includes(type.toLowerCase()));
  if (exact) return exact;
  if (/\bmonthly\b/.test(lower)) return "Monthly Growth Report";
  if (/\bweekly\b/.test(lower)) return "Weekly Admin Operations Report";
  if (/\bshop\b/.test(lower)) return "Shop Performance Report";
  if (/\b(?:error|reliability)\b/.test(lower)) return "Error and Reliability Report";
  if (/\b(?:security|permissions?)\b/.test(lower)) {
    return "Admin Security and Permissions Review";
  }
  if (/\b(?:backup|recovery)\b/.test(lower)) return "Backup and Recovery Report";
  if (/\b(?:coach|site performance)\b/.test(lower)) return "Coach Site Performance Report";

  if (sectionId === "shop") return "Shop Performance Report";
  if (sectionId === "error-reports") return "Error and Reliability Report";
  if (sectionId === "admin-users" || sectionId === "settings") {
    return "Admin Security and Permissions Review";
  }
  if (sectionId === "backup-cleanup") return "Backup and Recovery Report";
  if (sectionId === "coach-analytics" || sectionId === "coach-sites") {
    return "Coach Site Performance Report";
  }
  return "Weekly Admin Operations Report";
}

function getEntitiesForScope(context: AdminAISectionContext, scope: AdminAIScope): AdminAIEntity[] {
  if (scope === "global") return context.entities;
  if (scope === "selection") {
    const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
    return context.entities.filter(
      (entity) => selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase())
    );
  }
  return context.entities.filter((entity) => entity.module === context.sectionId);
}

function getVisibleMetricsForScope(
  context: AdminAISectionContext,
  scope: AdminAIScope
): AdminAISectionContext["visibleDataSummary"] {
  if (scope === "selection") return [];
  if (scope === "global" && context.globalContext.visibleDataSummary.length) {
    return context.globalContext.visibleDataSummary;
  }
  return context.visibleDataSummary;
}

function buildEffectiveScopeFilters(
  context: AdminAISectionContext,
  scope: AdminAIScope
): Record<string, string> {
  return {
    ...context.filters,
    scope,
    ...(scope === "selection" ? { selectedRecords: context.selectedRows.join(",") || "none" } : {})
  };
}

function collectScopedEvidence(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  entities: AdminAIEntity[]
): AdminAIEvidence[] {
  const filters = buildEffectiveScopeFilters(context, scope);
  if (scope === "selection") {
    return [
      {
        dateRange: context.dateRange,
        entityReferences: entities.length
          ? entities.map((entity) => entity.id)
          : [...context.selectedRows],
        filters,
        freshness: context.dataFreshness,
        label: "Selected records",
        module: context.sectionId,
        observedAt: context.lastUpdated,
        recordCount: entities.length,
        source: "selected-records",
        sourceRoute: context.currentRoute
      }
    ];
  }
  if (entities.length) {
    return buildEvidenceForJoinedEntities(context, entities, filters);
  }
  return [
    {
      ...evidence(context, "Effective scope", 0),
      entityReferences: [],
      filters
    }
  ];
}

function buildStructuredReportEntries(
  context: AdminAISectionContext,
  scope: AdminAIScope,
  scopedEntities: AdminAIEntity[],
  scopedMetrics: AdminAISectionContext["visibleDataSummary"]
): AdminAIReportEntryInput[] {
  const entries: AdminAIReportEntryInput[] = scopedMetrics.map((item) => ({
    classification: "observed",
    label: item.label,
    source: item.source,
    value: item.value
  }));
  if (scope === "selection") {
    scopedEntities.forEach((entity) => {
      entries.push({
        classification: "observed",
        label: entity.label,
        source: entity.source,
        value: `${entity.status}; updated ${entity.updatedAt}`
      });
    });
  }
  const intelligence = context.intelligence;
  const alerts =
    intelligence && scope !== "selection"
      ? buildEvidenceBackedHealthAlerts(intelligence.healthEvidence)
      : [];
  const healthScore =
    intelligence && scope !== "selection"
      ? buildTransparentHealthScore(intelligence.healthScore)
      : null;

  if (scope !== "selection") {
    entries.push({
      classification: "computed",
      label: "Evidence-backed health alerts",
      source: "platform-health",
      value: alerts.length
    });
    if (healthScore?.score === null || healthScore?.score === undefined) {
      entries.push({
        classification: "missing",
        label: "Admin health score",
        missingReason:
          healthScore?.missingInputs.join("; ") || "Health score inputs are unavailable.",
        source: "platform-health",
        value: null
      });
    } else {
      entries.push({
        classification: "computed",
        label: "Admin health score",
        source: "platform-health",
        value: healthScore.score
      });
    }
  }

  alerts.slice(0, 10).forEach((alert) => {
    entries.push(
      {
        classification: "interpretation",
        label: alert.whatHappened,
        source: alert.module,
        value: alert.impact
      },
      {
        classification: "recommendation",
        label: `Recommended response: ${alert.whatHappened}`,
        source: alert.module,
        value: alert.suggestedNextStep
      }
    );
  });
  context.errors.slice(0, 10).forEach((error, index) => {
    entries.push({
      classification: "missing",
      label: `Unavailable source ${index + 1}`,
      missingReason: error,
      source: "admin-context",
      value: null
    });
  });
  return entries;
}

function buildInvestigationResponse(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const matches = searchAdminAIEntities(context, query, scope);
  const fallback = matches.length
    ? matches
    : searchAdminAIEntities(context, "", scope).slice(0, 12);
  const modules = Array.from(new Set(fallback.map((item) => item.module)));
  const findings = [
    ...context.errors.map((item) => `Source failure: ${item}`),
    ...context.warnings.map((item) => `Operational warning: ${item}`),
    ...fallback.slice(0, 10).map((item) => `${item.label}: ${item.matchReason}`)
  ];
  const content = [
    `${context.sectionName} investigation`,
    `Request: ${query}`,
    `Modules inspected: ${modules.join(", ") || context.sectionName}`,
    "Findings:",
    ...(findings.length
      ? findings.map((item) => `- ${item}`)
      : ["- No evidence-backed finding in loaded data."]),
    "Recommended order:",
    "1. Verify source availability and freshness.",
    "2. Open supporting records and reproduce the visible state.",
    "3. Prepare a registered action only after the cause is confirmed.",
    "4. Preserve existing validation, RBAC, confirmation, and OTP."
  ].join("\n");
  return {
    ...baseResponse(
      `${context.sectionName} investigation`,
      fallback.length
        ? `Inspected ${fallback.length} bounded records across ${modules.length || 1} permission-visible module${modules.length === 1 ? "" : "s"}.`
        : "No permission-visible records are loaded for this investigation.",
      fallback.length ? "ready" : "missing-data",
      modelRoute
    ),
    artifact: artifact(
      "error-investigation",
      `${context.sectionName} Investigation`,
      content,
      context
    ),
    confidence: confidence(
      fallback.length ? "medium" : "insufficient-data",
      fallback.length
        ? "Findings are grounded, but probable causes still require verification."
        : "No supporting records."
    ),
    evidence: collectEvidence(context, fallback.length),
    items: findings.slice(0, 12),
    progress: [
      { id: "records", label: "Read permission-visible records", status: "complete" },
      { id: "sources", label: "Checked source status and freshness", status: "complete" },
      { id: "evidence", label: "Prepared evidence and verification order", status: "complete" }
    ],
    searchResults: fallback
  };
}

function buildIncidentResponse(
  context: AdminAISectionContext,
  query: string,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const incident = buildAdminAIIncident({
    evidence: context.intelligence?.healthEvidence || [],
    query,
    requestedAt: context.lastUpdated
  });
  const signals: AdminAIHealthSignal[] = incident.alerts.map((alert) => ({
    affectedEntity: alert.affectedEntity,
    confidence: "high",
    directRoute: alert.directRoute,
    evidence: alert.evidence.map(({ summary }) => summary).join(" / "),
    firstDetected: alert.firstDetected,
    id: alert.id,
    impact: alert.impact,
    lastDetected: alert.lastDetected,
    module: alert.module,
    recurrenceCount: alert.recurrenceCount,
    severity: alert.severity,
    suggestedNextStep: alert.suggestedNextStep,
    title: alert.whatHappened
  }));
  return {
    ...baseResponse(
      incident.criticalBanner.title,
      incident.status === "active"
        ? `${incident.impactSummary} Optional dangerous Admin AI actions require a freeze; no destructive infrastructure change ran.`
        : incident.impactSummary,
      incident.status === "active" ? "partial-success" : "missing-data",
      modelRoute
    ),
    artifact: artifact(
      "incident-summary",
      incident.report.title,
      formatAdminAIIncidentReport(incident),
      context
    ),
    confidence: confidence(incident.confidence, incident.confidenceReason),
    evidence: buildAdminAIIncidentProvenance(incident, context).slice(0, 8),
    healthSignals: signals,
    incident,
    items: [
      ...incident.evidence.map((item) => `${item.source}: ${item.summary}`),
      ...incident.recoverySteps.map(({ label }) => label)
    ].slice(0, 12),
    progress: incident.checklist.map(({ id, label, status }) => ({ id, label, status }))
  };
}

function buildKnowledgeResponse(
  context: AdminAISectionContext,
  query: string,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  if (context.knowledgeIndex) {
    const result = retrieveAdminAIKnowledge(context.knowledgeIndex, {
      includeStale: true,
      isOwner: context.isOwner === true || context.userRole === "owner",
      permissions: context.permissions,
      query
    });
    const staleOnly = !result.matches.length && result.staleMatches.length > 0;
    return {
      ...baseResponse(
        result.matches.length
          ? "Permission-aware operational guidance"
          : staleOnly
            ? "Only stale guidance matched"
            : "No current guidance match",
        result.matches.length
          ? "Retrieved only approved, versioned knowledge chunks available to this role."
          : staleOnly
            ? "Historical guidance was found but was not used as current truth. Verify a current approved source."
            : "No fresh approved knowledge chunk matched the request.",
        result.matches.length ? "ready" : "missing-data",
        modelRoute
      ),
      confidence: confidence(
        result.matches.length ? "high" : "insufficient-data",
        result.matches.length
          ? "Matched an approved current knowledge chunk after RBAC filtering."
          : staleOnly
            ? "Only stale versioned guidance matched."
            : "No current knowledge match."
      ),
      evidence: result.matches.map((match) => ({
        dateRange: `Effective ${match.citation.effectiveAt}`,
        entityReferences: [match.citation.documentId],
        filters: context.filters,
        freshness: `Current approved version ${match.citation.version}`,
        label: match.title,
        module: context.sectionName,
        observedAt: context.lastUpdated,
        recordCount: 1,
        source: `${match.citation.source} · ${match.citation.section}`,
        sourceRoute: context.currentRoute
      })),
      items: result.matches.map(
        (match) =>
          `${match.title}: ${match.content} (${match.citation.source}, ${match.citation.section}, v${match.citation.version})`
      )
    };
  }

  const matches = context.knowledge
    .map((entry) => ({
      entry,
      score: tokenizeQuery(query).filter((term) => entry.searchableText.includes(term)).length
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.entry);
  return {
    ...baseResponse(
      matches.length ? "Permission-aware operational guidance" : "No current guidance match",
      matches.length
        ? "Retrieved only versioned, allowlisted knowledge entries available to this role."
        : "No fresh allowlisted knowledge entry matched the request.",
      matches.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(
      matches.length ? "high" : "insufficient-data",
      matches.length ? "Matched allowlisted knowledge terms." : "No knowledge match."
    ),
    evidence: matches.map((entry) => ({
      dateRange: "Current version",
      entityReferences: [entry.id],
      entityRoutes: context.currentRoute.startsWith("/admin/")
        ? { [entry.id]: context.currentRoute }
        : {},
      filters: context.filters,
      freshness: entry.freshness,
      label: entry.title,
      module: context.sectionId,
      observedAt: context.lastUpdated,
      recordCount: 1,
      source: entry.source,
      ...(context.currentRoute.startsWith("/admin/") ? { sourceRoute: context.currentRoute } : {})
    })),
    items: matches.map((entry) => `${entry.title}: ${entry.summary}`)
  };
}

function baseResponse(
  title: string,
  body: string,
  state: AdminAIResponse["state"],
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const unavailable = state === "missing-data" || state === "blocked-missing-data";
  const failed = state === "offline-error" || state === "action-failed";
  return {
    body,
    confidence: confidence(
      unavailable ? "insufficient-data" : failed ? "low" : "medium",
      unavailable
        ? "Required permission-visible source data is unavailable."
        : failed
          ? "The requested operation did not return a usable verified result."
          : "The response is pending stronger evidence-specific calibration."
    ),
    items: [],
    modelRoute,
    state,
    title
  };
}

function collectEvidence(
  context: AdminAISectionContext,
  legacySharedRecordCount: number
): AdminAIEvidence[] {
  void legacySharedRecordCount;
  const sources = context.relatedAPIs.length ? context.relatedAPIs : ["Current section context"];
  const allowContextFallback = sources.length === 1;
  return sources.map((source) =>
    buildAdminAIEvidenceForSource(context, source, { allowContextFallback })
  );
}

function evidence(
  context: AdminAISectionContext,
  source: string,
  recordCount: number
): AdminAIEvidence {
  return {
    dateRange: context.dateRange,
    entityReferences: (context.selectedRows.length
      ? context.selectedRows
      : context.entities.map((entity) => entity.id)
    ).slice(0, 12),
    filters: context.filters,
    freshness: context.dataFreshness,
    label: context.sectionName,
    module: context.sectionId,
    observedAt: context.lastUpdated,
    recordCount,
    source,
    sourceRoute: context.currentRoute
  };
}

function confidence(level: AdminAIConfidenceLevel, reason: string) {
  return { level, reason };
}

function getApprovalLevel(query: string): AdminAIApprovalLevel {
  const chainedAction = query.match(/\b(?:and(?:\s+then)?|then|after that)\b([\s\S]+)$/i)?.[1];
  const chainedLevel = chainedAction ? getMutationApprovalLevel(chainedAction) : null;
  if (chainedLevel !== null) return chainedLevel;

  const artifactOnly =
    /\b(?:create|draft|generate|prepare|propose|suggest)\b[\s\S]{0,48}\b(?:copy|content|draft|plan|report|suggestion|text)\b/i.test(
      query
    );
  if (artifactOnly) return 1;

  return getMutationApprovalLevel(query) ?? 0;
}

function getMutationApprovalLevel(query: string): 2 | 3 | null {
  if (LEVEL_THREE_ACTION_WORDS.test(query)) return 3;
  if (
    /\b(?:change|edit|set|update)\b[\s\S]{0,32}\b(?:admin )?role\b/i.test(query) ||
    /\b(?:admin )?role\b[\s\S]{0,32}\b(?:change|edit|set|update|to)\b/i.test(query) ||
    /\b(?:resend|send again)\b[\s\S]{0,24}\bcritical otp\b/i.test(query) ||
    /\bcritical otp\b[\s\S]{0,24}\b(?:resend|send again)\b/i.test(query) ||
    /\b(?:change|edit|set|update)\b[\s\S]{0,32}\bpayment settings?\b/i.test(query) ||
    /\b(?:change|edit|set|update)\b[\s\S]{0,32}\bpublic url\b/i.test(query)
  )
    return 3;
  if (LEVEL_TWO_ACTION_WORDS.test(query)) return 2;
  return null;
}

function isPromptInjectionAttempt(query: string) {
  return ADMIN_AI_PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(query));
}

function sanitizeQuery(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function tokenizeQuery(value: string) {
  const stop = new Set([
    "a",
    "all",
    "and",
    "are",
    "for",
    "from",
    "in",
    "is",
    "me",
    "of",
    "on",
    "show",
    "the",
    "this",
    "to",
    "with"
  ]);
  return Array.from(
    new Set(
      sanitizeQuery(value)
        .toLowerCase()
        .split(/[^a-z0-9_-]+/)
        .filter((term) => term.length > 1 && !stop.has(term))
    )
  ).slice(0, 20);
}

function formatScope(scope: AdminAIScope) {
  if (scope === "global") return "Entire Admin Panel";
  if (scope === "module") return "Current Module";
  if (scope === "selection") return "Selected Records";
  return "This Page";
}

function signal(
  id: string,
  severity: AdminAIHealthSignal["severity"],
  title: string,
  evidenceText: string,
  module: string,
  route: string,
  timestamp: string
): AdminAIHealthSignal {
  return {
    affectedEntity: module,
    confidence: "high",
    directRoute: route,
    evidence: evidenceText,
    firstDetected: timestamp,
    id,
    impact:
      severity === "high" || severity === "critical"
        ? "May block or degrade an admin workflow."
        : "Requires operational review.",
    lastDetected: timestamp,
    module,
    recurrenceCount: 1,
    severity,
    suggestedNextStep: "Open the source module and verify the supporting records.",
    title
  };
}

function component(
  id: string,
  label: string,
  score: number,
  inputs: string[],
  missingInputs: string[]
) {
  return {
    howToImprove: [
      score >= 100
        ? `Maintain verified ${label.toLowerCase()} inputs.`
        : `Review ${label.toLowerCase()} inputs and resolve the listed gaps.`
    ],
    id,
    inputs,
    label,
    missingInputs,
    score
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function artifact(
  type: AdminAIArtifact["type"],
  title: string,
  content: string,
  context: AdminAISectionContext
): AdminAIArtifact {
  const createdAt = new Date().toISOString();
  return {
    content,
    createdAt,
    id: `artifact-${stableHash(`${title}:${createdAt}`)}`,
    sourceContext: `${context.sectionName} / ${context.dateRange} / ${context.dataFreshness}`,
    title,
    type
  };
}

function planArtifact(plan: AdminAIPlan, context: AdminAISectionContext) {
  return artifact(
    "action-plan",
    plan.title,
    [
      plan.title,
      `Request: ${plan.request}`,
      `Approval level: ${plan.approvalLevel}`,
      `Records: ${plan.affectedRecords.join(", ") || "None selected"}`,
      ...plan.steps.map((step, index) => `${index + 1}. ${step.label} [${step.status}]`),
      `Expected outcome: ${plan.expectedOutcome}`,
      `Rollback: ${plan.rollback}`
    ].join("\n"),
    context
  );
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
