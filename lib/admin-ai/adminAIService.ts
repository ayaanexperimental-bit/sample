import type { AdminAISectionContext } from "./adminAIContext";
import type { explainAdminAIAnalytics } from "./adminAIAnalytics";
import type { inspectAdminAIBuilder } from "./adminAIBuilderInspection";
import type { investigateAdminAIError } from "./adminAIErrorInvestigation";
import type { AdminAIAnomalyAnalysis } from "./adminAIHealth";
import type { AdminAIIncident } from "./adminAIIncident";
import type { AdminAIPreferences } from "./adminAIMemory";
import { selectAdminAIModelRoute, type AdminAIModelFallbackReason } from "./adminAIModelRouting";
import { ADMIN_AI_SETTINGS_FIELD_DEFINITIONS } from "./adminAIOperationalContext";
import { getAdminAISection, type AdminAICommand } from "./adminAIRegistry";
import type { AdminAIReport as AdminAIStructuredReport } from "./adminAIReports";
import type { runAdminAITableCopilot } from "./adminAITableCopilot";
import type {
  AdminAIApprovalReceipt,
  AdminAIArtifact,
  AdminAIConfidenceLevel,
  AdminAIEvidence,
  AdminAIHealthScore,
  AdminAIHealthSignal,
  AdminAIModelRoute,
  AdminAIPlan,
  AdminAIProgressStep,
  AdminAIRollbackAction,
  AdminAISearchResult
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

export type AdminAIConfidence = {
  level: AdminAIConfidenceLevel;
  reason: string;
};

export type AdminAIConclusion = {
  confidence: AdminAIConfidence;
  evidenceSources?: string[];
  id: string;
  text: string;
};

export type AdminAIResponse = {
  analyticsExplanation?: ReturnType<typeof explainAdminAIAnalytics>;
  approvalReceipt?: AdminAIApprovalReceipt;
  artifact?: AdminAIArtifact;
  body: string;
  builderInspection?: ReturnType<typeof inspectAdminAIBuilder>;
  conclusions?: AdminAIConclusion[];
  confidence?: AdminAIConfidence;
  evidence?: AdminAIEvidence[];
  errorInvestigation?: ReturnType<typeof investigateAdminAIError>;
  healthScore?: AdminAIHealthScore;
  healthSignals?: AdminAIHealthSignal[];
  incident?: AdminAIIncident;
  anomalyAnalysis?: AdminAIAnomalyAnalysis;
  items: string[];
  modelRoute?: AdminAIModelRoute;
  plan?: AdminAIPlan;
  progress?: AdminAIProgressStep[];
  providerFallbackReason?: Exclude<AdminAIModelFallbackReason, "deterministic-task">;
  report?: AdminAIReport;
  rollbackAction?: AdminAIRollbackAction;
  searchResults?: AdminAISearchResult[];
  state: AdminAIResponseState;
  structuredReport?: AdminAIStructuredReport;
  tableAnalysis?: ReturnType<typeof runAdminAITableCopilot>;
  title: string;
};

export function runAdminAICommand(
  command: AdminAICommand,
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse {
  if (context.loadingState) {
    return groundAdminAIResponse(
      response(
        "Data is still loading",
        "Wait for the current section sources to finish loading.",
        [],
        "loading"
      ),
      context
    );
  }

  const unavailableSourceResponse = buildUnavailableSourceResponse(context);
  if (unavailableSourceResponse) {
    return groundAdminAIResponse(unavailableSourceResponse, context);
  }

  if (command.id === "create-coach-site.preview-draft-text") {
    return groundAdminAIResponse(buildBuilderDraftTextPreview(context), context);
  }

  const focusedResponse = buildFocusedAdminAICommandResponse(command, context, preferences);
  if (focusedResponse) return groundAdminAIResponse(focusedResponse, context);

  if (command.responseHandlerId === "report")
    return groundAdminAIResponse(buildReportResponse(command, context, preferences), context);
  if (command.responseHandlerId === "find-problems")
    return groundAdminAIResponse(buildProblemResponse(context), context);
  if (command.responseHandlerId === "next-action")
    return groundAdminAIResponse(buildNextActionResponse(command, context), context);
  if (command.responseHandlerId === "navigate") {
    return groundAdminAIResponse(
      response(
        "Protected workflow prepared",
        command.description,
        command.otpRequired ? ["The existing OTP step remains required."] : [],
        "action-prepared"
      ),
      context
    );
  }

  return groundAdminAIResponse(buildSummaryResponse(context, preferences), context);
}

function buildUnavailableSourceResponse(context: AdminAISectionContext): AdminAIResponse | null {
  const outageErrors = context.errors.filter((error) =>
    /\b(?:unavailable|offline|failed|failure|timeout|timed out)\b/i.test(error)
  );
  if (!outageErrors.length || hasUsableAdminAIData(context)) return null;

  return {
    body: "The required Admin source or API is unavailable, so Copilot cannot produce a reliable result. Retry after the source recovers, or use the core Admin controls for a manual check.",
    confidence: {
      level: "insufficient-data",
      reason: "An explicit permission-visible Admin source outage left no usable records."
    },
    items: outageErrors,
    state: "offline-error",
    title: `${context.sectionName} source unavailable`
  };
}

function hasUsableAdminAIData(context: AdminAISectionContext) {
  if (!context.emptyState && context.visibleDataSummary.length > 0) return true;
  if (context.entities.length > 0 || context.analyticsSeries.length > 0) return true;

  const intelligence = context.intelligence;
  return Boolean(
    intelligence &&
    (intelligence.analyticsPoints.length > 0 ||
      intelligence.errorReports.length > 0 ||
      intelligence.healthEvidence.length > 0 ||
      Boolean(intelligence.builderInspection) ||
      Boolean(intelligence.table?.rows.length) ||
      Boolean(intelligence.anomalyAnalysis?.anomalies.length) ||
      intelligence.healthScore.dimensions.some(
        ({ exactInputs, score }) => exactInputs.length > 0 || score !== null
      ))
  );
}

export function groundAdminAIResponse(
  response: AdminAIResponse,
  context: AdminAISectionContext
): AdminAIResponse {
  const sources = context.relatedAPIs.length ? context.relatedAPIs : ["Current section context"];
  const allowContextFallback = sources.length === 1;
  const evidence = response.evidence?.length
    ? response.evidence.map((item) => {
        const derived = buildAdminAIEvidenceForSource(context, item.source, {
          allowContextFallback
        });
        return {
          ...derived,
          ...item,
          entityReferences: item.entityReferences ?? derived.entityReferences,
          entityRoutes: item.entityRoutes ?? derived.entityRoutes,
          filters: item.filters ?? derived.filters,
          observedAt: item.observedAt ?? derived.observedAt,
          sourceRoute: item.sourceRoute ?? derived.sourceRoute
        };
      })
    : sources.map((source) =>
        buildAdminAIEvidenceForSource(context, source, { allowContextFallback })
      );

  return ensureAdminAIConclusions({
    ...normalizeAdminAIResponseCopy(response),
    confidence: response.confidence ?? defaultConfidence(response.state),
    evidence,
    modelRoute: response.modelRoute ?? selectAdminAIModelRoute("Validate registered admin command")
  });
}

export function normalizeAdminAIResponseCopy(response: AdminAIResponse): AdminAIResponse {
  const items = Array.from(
    new Set(response.items.map((item) => normalizeAdminAICopy(item, 500, "")).filter(Boolean))
  ).slice(0, 50);
  return {
    ...response,
    body: normalizeAdminAICopy(
      response.body,
      1_200,
      "No permission-visible result is available for this request."
    ),
    items,
    title: normalizeAdminAICopy(response.title, 140, "Admin Copilot response")
  };
}

export function ensureAdminAIConclusions(response: AdminAIResponse): AdminAIResponse {
  const usableEvidence = (response.evidence || []).filter(isUsableAdminAIEvidence);
  const hasInternalEvidence = usableEvidence.length > 0;
  const initialConfidence = calibrateAdminAIConfidence(
    response.confidence ?? defaultConfidence(response.state),
    hasInternalEvidence
  );
  const explicitConclusions = response.conclusions?.length ? response.conclusions : null;
  const hasExplicitConclusions = explicitConclusions !== null;
  const conclusions = explicitConclusions ?? [
    {
      confidence: initialConfidence,
      id: "primary-conclusion",
      text: response.body
    }
  ];
  const calibratedConclusions = conclusions.map((conclusion) =>
    calibrateAdminAIConclusion(conclusion, usableEvidence, hasExplicitConclusions)
  );
  return {
    ...response,
    confidence: calibrateAdminAIResponseConfidence(
      initialConfidence,
      calibratedConclusions,
      hasExplicitConclusions
    ),
    conclusions: calibratedConclusions
  };
}

function calibrateAdminAIResponseConfidence(
  confidence: AdminAIConfidence,
  conclusions: AdminAIConclusion[],
  hasExplicitConclusions: boolean
): AdminAIConfidence {
  if (!hasExplicitConclusions || conclusions.length === 0) return confidence;
  const unsupported = conclusions.filter(
    (conclusion) => conclusion.confidence.level === "insufficient-data"
  ).length;
  if (unsupported === conclusions.length) {
    return {
      level: "insufficient-data",
      reason: "Every material conclusion lacks matching internal evidence."
    };
  }
  if (unsupported > 0 && confidence.level === "high") {
    return {
      level: "medium",
      reason:
        "The response contains both supported and unsupported material conclusions; review claim-level confidence."
    };
  }
  return confidence;
}

function calibrateAdminAIConclusion(
  conclusion: AdminAIConclusion,
  evidence: AdminAIEvidence[],
  requireClaimEvidence: boolean
): AdminAIConclusion {
  if (conclusion.evidenceSources === undefined) {
    if (requireClaimEvidence && evidence.length > 0) {
      return {
        ...conclusion,
        confidence: {
          level: "insufficient-data",
          reason:
            "Insufficient data: no cited internal evidence source was supplied for this conclusion."
        }
      };
    }
    return {
      ...conclusion,
      confidence: calibrateAdminAIConfidence(conclusion.confidence, evidence.length > 0)
    };
  }

  const evidenceSources = Array.from(
    new Set(conclusion.evidenceSources.map((source) => source.trim()).filter(Boolean))
  );
  const unsupportedSources = evidenceSources.filter(
    (source) =>
      !evidence.some((item) => evidenceMatchesConclusionSource(item, source, conclusion.text))
  );
  if (evidenceSources.length > 0 && unsupportedSources.length === 0) {
    return {
      ...conclusion,
      confidence: calibrateAdminAIConfidence(conclusion.confidence, true),
      evidenceSources
    };
  }

  return {
    ...conclusion,
    confidence: {
      level: "insufficient-data",
      reason: evidenceSources.length
        ? `Insufficient data: no cited internal evidence matches ${unsupportedSources
            .map((source) => normalizeAdminAICopy(source, 120, "unknown source"))
            .join(", ")} for this conclusion.`
        : "Insufficient data: no cited internal evidence source was supplied for this conclusion."
    },
    evidenceSources
  };
}

function isUsableAdminAIEvidence(evidence: AdminAIEvidence) {
  return (
    Number.isInteger(evidence.recordCount) &&
    evidence.recordCount >= 0 &&
    [evidence.source, evidence.module, evidence.dateRange, evidence.freshness].every(
      (value) => Boolean(value.trim()) && !/^(?:none|unknown|unavailable)$/i.test(value.trim())
    )
  );
}

function evidenceMatchesConclusionSource(
  evidence: AdminAIEvidence,
  source: string,
  conclusionText: string
) {
  if (evidence.recordCount === 0 && !isZeroResultConclusion(conclusionText)) return false;
  const evidenceKey = canonicalEvidenceKey(evidence.source);
  const sourceKey = canonicalEvidenceKey(source);
  return Boolean(evidenceKey && sourceKey && evidenceKey === sourceKey);
}

function canonicalEvidenceKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "");
  const adminAPI = normalized.match(/^(?:https?:\/\/[^/]+)?\/api\/admin\/(.+)$/);
  return normalizeEvidenceKey(adminAPI?.[1] || normalized);
}

function isZeroResultConclusion(value: string) {
  return /(?:\b(?:empty|missing|no|none|without|zero)\b|(?:^|\D)0(?:\D|$))/i.test(value);
}

function calibrateAdminAIConfidence(
  confidence: AdminAIConfidence,
  hasInternalEvidence: boolean
): AdminAIConfidence {
  if (!confidence.reason.trim()) {
    return {
      level: "insufficient-data",
      reason: "No confidence rationale was supplied for this conclusion."
    };
  }
  return confidence.level === "high" && !hasInternalEvidence
    ? { level: "medium", reason: "High confidence requires a cited internal evidence reference." }
    : { ...confidence, reason: confidence.reason.trim() };
}

export function buildAdminAIEvidenceForSource(
  context: AdminAISectionContext,
  source: string,
  { allowContextFallback = false }: { allowContextFallback?: boolean } = {}
): AdminAIEvidence {
  const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  const eligibleEntities = selected.size
    ? context.entities.filter(
        (entity) =>
          selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase())
      )
    : context.entities;
  const matchingEntities = eligibleEntities.filter((entity) =>
    evidenceSourceMatchesEntity(source, entity.source, entity.module)
  );
  const usedContextFallback = matchingEntities.length === 0 && allowContextFallback;
  const analyzedEntities = usedContextFallback ? eligibleEntities : matchingEntities;
  const modules = Array.from(new Set(analyzedEntities.map((entity) => entity.module)));
  const evidenceModule = usedContextFallback
    ? context.sectionId
    : modules.length === 1
      ? modules[0]
      : inferEvidenceModule(source, context.sectionId);

  return {
    dateRange: context.dateRange,
    entityReferences: analyzedEntities.map((entity) => entity.id),
    entityRoutes: Object.fromEntries(
      analyzedEntities
        .filter((entity) => entity.route.startsWith("/admin/"))
        .map((entity) => [entity.id, entity.route])
    ),
    filters: context.filters,
    freshness: context.dataFreshness,
    label:
      usedContextFallback || evidenceModule === context.sectionId
        ? context.sectionName
        : formatEvidenceModule(evidenceModule),
    module: evidenceModule,
    observedAt: context.lastUpdated,
    recordCount: analyzedEntities.length,
    source,
    sourceRoute:
      usedContextFallback && context.currentRoute.startsWith("/admin/")
        ? context.currentRoute
        : `/admin/dashboard?view=${encodeURIComponent(evidenceModule)}`
  };
}

function evidenceSourceMatchesEntity(source: string, entitySource: string, module: string) {
  const sourceKey = normalizeEvidenceKey(source);
  const entitySourceKey = normalizeEvidenceKey(entitySource);
  const moduleKey = normalizeEvidenceKey(module);
  if (
    [entitySourceKey, moduleKey].some(
      (key) => key && (sourceKey === key || sourceKey.includes(key))
    )
  ) {
    return true;
  }
  return (
    sourceKey.includes("analytics") &&
    (entitySourceKey.includes("analytics") || moduleKey.includes("analytics"))
  );
}

function inferEvidenceModule(source: string, fallback: AdminAISectionContext["sectionId"]) {
  const sourceKey = normalizeEvidenceKey(source);
  const knownModules = [
    "coach-sites",
    "coach-analytics",
    "error-reports",
    "shop",
    "backup-cleanup",
    "paid-masterclass-settings",
    "settings",
    "admin-users"
  ] as const;
  return (
    knownModules.find((module) => sourceKey.includes(normalizeEvidenceKey(module))) ?? fallback
  );
}

function normalizeEvidenceKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatEvidenceModule(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function buildFocusedAdminAICommandResponse(
  command: AdminAICommand,
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse | null {
  if (command.id === "coach-analytics.copyable-coach-report") {
    return buildReportResponse(command, context, preferences);
  }
  if (command.id === "coach-analytics.review-selected-coach") {
    const selected = selectedAdminAIEntities(context);
    if (selected.length !== 1) {
      return response(
        "Selected coach unavailable",
        "Select exactly one permission-visible coach analytics record before requesting a review.",
        [],
        "missing-data"
      );
    }
    const coach = selected[0];
    return response(
      "Selected coach review",
      "Reviewed only the selected permission-visible coach analytics record.",
      [`${coach.label}: ${coach.status}. ${sentence(coach.matchReason)}`],
      "ready"
    );
  }
  if (command.id === "admin-users.check-permission-risk") {
    const risks = (context.intelligence?.healthEvidence || []).filter(
      ({ category, module }) =>
        module === "admin-users" && category === "unusual-permission-changes"
    );
    const items = risks.flatMap(({ evidence, impact, whatHappened }) => {
      const facts = evidence.map(({ summary }) => summary).filter(Boolean);
      return facts.length ? facts : [`${whatHappened}: ${impact}`];
    });
    return response(
      items.length ? "Admin permission risk review" : "No permission risk evidence",
      items.length
        ? "Reported only owner-visible, allowlisted role labels and permission-risk evidence."
        : "No owner-visible risky-role evidence is present in the current context.",
      items,
      items.length ? "ready" : "missing-data"
    );
  }
  if (command.id === "admin-users.explain-suspend-remove") {
    const selected = selectedAdminAIEntities(context);
    if (selected.length !== 1) {
      return response(
        "Admin target unavailable",
        "Select exactly one permission-visible admin before reviewing suspension or removal impact.",
        [],
        "missing-data"
      );
    }
    const admin = selected[0];
    return response(
      "Admin access impact review",
      "Explained impact only; no account, role, or session was changed.",
      [
        `Target: ${admin.label} (${admin.status}).`,
        "Suspension impact: disables Admin access and revokes active Admin sessions after protected confirmation.",
        "Removal impact: removes Admin access; root-owner protection and last-owner safeguards remain authoritative.",
        "Existing owner-only confirmation, OTP, and audit requirements remain mandatory."
      ],
      "ready"
    );
  }
  if (command.id.endsWith(".explain-data")) {
    const selected = selectedAdminAIEntities(context);
    const items = selected.length
      ? selected.map(
          (entity) => `${entity.label}: ${entity.status}. ${sentence(entity.matchReason)}`
        )
      : context.visibleDataSummary.map(
          (item) => `${item.label}: ${formatValue(item.value)} (${item.source})`
        );
    return response(
      `${context.sectionName} data explained`,
      "Explained only the current permission-visible data and its source; scope was not widened.",
      items,
      items.length ? "ready" : "missing-data"
    );
  }
  if (command.id === "settings.explain-setting") {
    return buildSettingsExplanation(context);
  }
  if (command.id === "settings.analyze-risk" || command.id === "settings.prepare-change") {
    return buildSettingsRiskReview(context);
  }
  if (
    command.id === "settings.validate-configuration" ||
    command.id === "settings.safe-validation"
  ) {
    return buildSettingsValidation(context);
  }
  if (command.id === "settings.find-required-configuration") {
    const missing = missingRequiredSettings(context);
    return response(
      missing.length ? "Required configuration is missing" : "Required configuration is present",
      "Checked allowlisted required-setting presence only; private values were not read.",
      missing.map(({ label }) => label),
      "ready"
    );
  }
  return null;
}

function buildSettingsExplanation(context: AdminAISectionContext): AdminAIResponse {
  const items = ADMIN_AI_SETTINGS_FIELD_DEFINITIONS.flatMap((definition) => {
    const entity = context.entities.find(({ id }) => id === `settings:${definition.key}`);
    return entity
      ? [
          `${definition.label}: ${entity.status.replace(/-/g, " ")}. ${definition.effect} Risk: ${definition.risk}`
        ]
      : [];
  });
  return response(
    "Settings explained",
    "Explained allowlisted setting purpose, presence, effect, and risk without reading private values.",
    items,
    items.length ? "ready" : "missing-data"
  );
}

function buildSettingsRiskReview(context: AdminAISectionContext): AdminAIResponse {
  const items = ADMIN_AI_SETTINGS_FIELD_DEFINITIONS.flatMap((definition) => {
    const entity = context.entities.find(({ id }) => id === `settings:${definition.key}`);
    if (!entity) return [];
    if (entity.status === "missing-required") {
      return definition.key === "supportMessage"
        ? [
            "Support message is missing; public error states may lack the approved fallback help copy."
          ]
        : [`${definition.label} is missing; ${definition.risk}`];
    }
    return [`${definition.label}: ${definition.risk}`];
  });
  return response(
    "Settings risk review",
    "Reviewed presence-only configuration risk and public impact; no value was changed.",
    items,
    items.length ? "ready" : "missing-data"
  );
}

function buildSettingsValidation(context: AdminAISectionContext): AdminAIResponse {
  const missing = missingRequiredSettings(context);
  return response(
    missing.length ? "Settings validation found issues" : "Settings validation passed",
    "Validated allowlisted presence-only setting requirements without saving or exposing values.",
    missing.map(({ label }) => `Missing required setting: ${label}.`),
    "ready"
  );
}

function missingRequiredSettings(context: AdminAISectionContext) {
  return ADMIN_AI_SETTINGS_FIELD_DEFINITIONS.filter((definition) => {
    const entity = context.entities.find(({ id }) => id === `settings:${definition.key}`);
    return definition.required && entity?.status === "missing-required";
  });
}

function selectedAdminAIEntities(context: AdminAISectionContext) {
  const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  return context.entities.filter(
    (entity) => selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase())
  );
}

function sentence(value: string) {
  return `${value.trim().replace(/[.]+$/, "")}.`;
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
    `Sources: ${report.sourceNote}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildSummaryResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse {
  if (!context.visibleDataSummary.length || context.emptyState) {
    return response(
      `${context.sectionName} has no loaded records`,
      "No production records are available for a useful summary.",
      context.errors,
      "missing-data"
    );
  }

  const limit = preferences.reportStyle === "detailed" ? 8 : 4;
  const summaryItems = context.visibleDataSummary.slice(0, limit);
  const items = summaryItems.map(
    (item) => `${item.label}: ${formatValue(item.value)} (${item.source})`
  );

  return {
    body: `Using ${items.length} compact, permission-filtered signals. ${context.dataFreshness}.`,
    conclusions: summaryItems.map((item, index) => {
      const sourceLabel = normalizeAdminAICopy(item.source, 120, "internal source");
      return {
        confidence: {
          level: "high",
          reason: `This claim is directly derived from the cited permission-filtered ${sourceLabel} summary.`
        },
        evidenceSources: [item.source],
        id: `summary-claim-${index + 1}`,
        text: items[index]
      };
    }),
    items,
    state: "ready" as const,
    title: `${context.sectionName} summary`
  };
}

function buildBuilderDraftTextPreview(context: AdminAISectionContext): AdminAIResponse {
  const copyText = context.intelligence?.builderInspection?.copyText.trim() || "";
  if (!copyText) {
    return response(
      "Draft text unavailable",
      "No permission-filtered unsaved Builder draft text is available to preview.",
      [],
      "missing-data"
    );
  }

  return response(
    "Draft text preview",
    "This is the current unsaved Builder text. No suggestion, apply, artifact, plan, or mutation was created.",
    [copyText],
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

function buildNextActionResponse(command: AdminAICommand, context: AdminAISectionContext) {
  const firstIssue = context.errors[0] || context.warnings[0];
  const actions = prioritizeAdminAINextActions(command, context, firstIssue);
  const scopeNote = context.selectedRows.length
    ? ` Scoped to ${context.selectedRows.length} selected record${context.selectedRows.length === 1 ? "" : "s"}.`
    : Object.keys(context.filters).length
      ? " Scoped to the current applied filters."
      : "";
  if (!firstIssue) {
    return response(
      "Continue normal review",
      `No current warning supports a stronger recommendation.${scopeNote}`,
      actions,
      context.emptyState ? "missing-data" : "ready"
    );
  }

  return response("Recommended next check", `${firstIssue}${scopeNote}`, actions, "ready");
}

function prioritizeAdminAINextActions(
  command: AdminAICommand,
  context: AdminAISectionContext,
  firstIssue: string | undefined
) {
  const intentTokens = new Set(
    tokenizeAdminAIIntent(
      [
        command.label,
        command.description,
        firstIssue || "",
        ...context.selectedRows,
        ...Object.entries(context.filters).flatMap(([key, value]) => [key, value])
      ].join(" ")
    )
  );
  return context.availableActions
    .map((action, index) => {
      const actionTokens = tokenizeAdminAIIntent(action);
      const overlap = actionTokens.filter((token) => intentTokens.has(token)).length;
      const selectedBoost =
        context.selectedRows.length && /selected|record|coach|site/i.test(action) ? 2 : 0;
      return { action, index, score: overlap + selectedBoost };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .map(({ action }) => action);
}

function buildReportResponse(
  command: AdminAICommand,
  context: AdminAISectionContext,
  preferences: AdminAIPreferences
): AdminAIResponse {
  const supportedFormats = getAdminAISection(context.sectionId).reportFormats;
  const reportFormat = supportedFormats.includes(preferences.reportFormat)
    ? preferences.reportFormat
    : "operations";
  const summaryOnly = reportFormat === "summary";
  const selectedKeys = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  const selectedEntities = selectedKeys.size
    ? context.entities.filter(
        (entity) =>
          selectedKeys.has(entity.id.toLowerCase()) || selectedKeys.has(entity.label.toLowerCase())
      )
    : [];
  const observations = selectedEntities.length
    ? Array.from(
        new Set([
          ...selectedEntities.map((entity) => entity.matchReason),
          ...context.errors,
          ...context.warnings
        ])
      )
    : [...context.errors, ...context.warnings];
  const keyMetrics = selectedEntities.length
    ? selectedEntities.map(
        (entity) => `${entity.label}: ${entity.status || "status unavailable"} (${entity.source})`
      )
    : context.visibleDataSummary.map(
        (item) => `${item.label}: ${formatValue(item.value)} (${item.source})`
      );
  const recommendations = summaryOnly
    ? []
    : observations.length
      ? observations.map((item) => `Review: ${item}`)
      : ["No warning-based corrective action is supported by the current data."];
  const actionItems =
    !summaryOnly && preferences.includeActionItems
      ? context.availableActions.slice(0, preferences.reportStyle === "detailed" ? 5 : 3)
      : [];
  const report: AdminAIReport = {
    actionItems,
    dateRange: context.dateRange,
    keyMetrics,
    observations: observations.length ? observations : ["No current warning signal."],
    recommendations,
    sourceNote:
      (selectedEntities.length
        ? Array.from(new Set(selectedEntities.map((entity) => entity.source))).join(", ")
        : context.relatedAPIs.join(", ")) || "Current section sources",
    title: command.reportTitle || `${context.sectionName} Report`
  };

  return {
    body: `Report generated from ${keyMetrics.length} compact metric${keyMetrics.length === 1 ? "" : "s"}.`,
    items: observations,
    report,
    state: keyMetrics.length ? "ready" : "missing-data",
    title: report.title
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

function defaultConfidence(
  state: AdminAIResponseState
): NonNullable<AdminAIResponse["confidence"]> {
  if (state === "offline-error" || state === "action-failed") {
    return {
      level: "low",
      reason: "The requested AI service did not return a usable result."
    };
  }
  if (state === "missing-data" || state === "blocked-missing-data") {
    return {
      level: "insufficient-data",
      reason: "Required permission-visible source data is unavailable."
    };
  }
  if (
    state === "ready" ||
    state === "action-complete" ||
    state === "action-prepared" ||
    state === "confirmation-required" ||
    state === "insufficient-permission"
  ) {
    return {
      level: "high",
      reason:
        state === "insufficient-permission"
          ? "A deterministic permission or feature boundary blocked the request."
          : "Built from deterministic permission-filtered context and registered behavior."
    };
  }
  return {
    level: "medium",
    reason: "The operation has not reached a fully verified terminal state."
  };
}

function formatValue(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value;
}

function normalizeAdminAICopy(value: string, maxLength: number, fallback: string) {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:certainly|sure|of course|happy to help)[!,.\s:-]+)+/i, "")
    .replace(/^as an ai(?: assistant| copilot)?[,.\s:-]+/i, "")
    .trim();
  return (normalized || fallback).slice(0, maxLength);
}

function tokenizeAdminAIIntent(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3)
    )
  );
}
