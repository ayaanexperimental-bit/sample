import type { AdminAISectionContext } from "./adminAIContext";
import type { AdminAIFeatureFlags } from "./adminAIFeatureFlags";
import type { AdminAIPreferences } from "./adminAIMemory";
import type { AdminAIResponse } from "./adminAIService";
import type {
  AdminAIApprovalLevel,
  AdminAIArtifact,
  AdminAIConfidenceLevel,
  AdminAIDryRun,
  AdminAIEvidence,
  AdminAIHealthScore,
  AdminAIHealthSignal,
  AdminAIModelRoute,
  AdminAIPlan,
  AdminAIScope,
  AdminAISearchResult,
} from "./adminAITypes";

const MUTATION_WORDS = /\b(apply|archive|change|cleanup|delete|edit|fix|mark|publish|remove|revoke|save|suspend|unpublish|update)\b/i;
const SENSITIVE_WORDS = /\b(archive|cleanup|delete|owner|payment|publish|remove|revoke|role|suspend|unpublish)\b/i;
const PROMPT_INJECTION_PATTERNS = [
  /ignore (all |any |the )?(admin|previous|security|system) (instructions|permissions|rules)/i,
  /bypass (confirmation|otp|permission|rbac|security|validation)/i,
  /\b(give|reveal|show).{0,24}\b(otp|session cookie|secret|token)\b/i,
  /reveal (api|payment|private|session).{0,20}(key|secret|token|cookie)/i,
  /show (all )?(otp|session cookie|secret|token)/i,
  /call (an )?(arbitrary|unknown|unregistered) (api|tool)/i,
  /pretend (the )?action (worked|succeeded)/i,
  /fabricate (analytics|data|metric|result)/i,
];

type RunAdminAIQueryInput = {
  context: AdminAISectionContext;
  featureFlags: AdminAIFeatureFlags;
  preferences: AdminAIPreferences;
  query: string;
  scope: AdminAIScope;
};

export function runAdminAINaturalLanguageQuery({
  context,
  featureFlags,
  preferences,
  query,
  scope,
}: RunAdminAIQueryInput): AdminAIResponse {
  const safeQuery = sanitizeQuery(query);
  const modelRoute = routeAdminAIModel(safeQuery);
  if (!safeQuery) {
    return baseResponse("Enter an admin request", "Ask about loaded data, health, reports, or a safe plan.", "missing-data", modelRoute);
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
      items: ["Permissions remain enforced outside the model.", "Only registered actions can be prepared or executed."],
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
  if (MUTATION_WORDS.test(safeQuery) || /\b(plan|prepare|resolve|rollback|dry run|simulate)\b/i.test(safeQuery)) {
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
      confidence: confidence(plan.executable ? "high" : "medium", plan.executable ? "Mapped to a registered action." : "No registered mutation handler matched."),
      evidence: collectEvidence(context, plan.affectedRecords.length),
      items: plan.risks,
      plan,
    };
  }

  if (/\b(incident|outage|mass failure|security anomaly)\b/i.test(lower)) {
    if (!featureFlags.incidentMode) {
      return baseResponse("Incident Mode is disabled", "The incident feature flag is off. Core admin modules remain available.", "insufficient-permission", modelRoute);
    }
    return buildIncidentResponse(context, modelRoute);
  }

  if (/\b(investigate|check why|root cause|troubleshoot|diagnose)\b/i.test(lower)) {
    return buildInvestigationResponse(context, safeQuery, scope, modelRoute);
  }

  if (/\b(health|attention|briefing|incident|reliability|today)\b/i.test(lower)) {
    return buildHealthResponse(context, preferences, modelRoute);
  }

  if (/\b(anomaly|anomalies|anomalous|trend|chart|drop|spike|compare|peak|conversion)\b/i.test(lower)) {
    return buildAnalyticsResponse(context, modelRoute);
  }

  if (/\b(report|weekly|monthly|executive|download|copyable)\b/i.test(lower)) {
    return buildExecutiveReportResponse(context, preferences, safeQuery, modelRoute);
  }

  if (/\b(find|search|show|which|where|records?|sites?|orders?|errors?|admins?|backups?)\b/i.test(lower)) {
    return buildSearchResponse(context, safeQuery, scope, modelRoute);
  }

  if (/\b(explain|how|rule|documentation|why|setting|permission|otp|publish)\b/i.test(lower)) {
    return buildKnowledgeResponse(context, safeQuery, modelRoute);
  }

  return {
    ...baseResponse(
      `${context.sectionName} grounded summary`,
      `Using ${context.visibleDataSummary.length} compact signals in ${formatScope(scope)} scope. ${context.dataFreshness}.`,
      context.emptyState ? "missing-data" : "ready",
      modelRoute
    ),
    confidence: confidence(context.emptyState ? "insufficient-data" : "high", context.emptyState ? "No loaded records are available." : "Built from deterministic section context."),
    evidence: collectEvidence(context, context.visibleDataSummary.length),
    items: context.visibleDataSummary.slice(0, preferences.responseLength === "detailed" ? 8 : 4).map(
      (item) => `${item.label}: ${String(item.value)} (${item.source})`
    ),
  };
}

export function searchAdminAIEntities(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope
): AdminAISearchResult[] {
  const terms = tokenizeQuery(query);
  const selected = new Set(context.selectedRows.map((value) => value.toLowerCase()));
  return context.entities
    .filter((entity) => scope === "global" || scope === "selection" || entity.module === context.sectionId)
    .filter((entity) => scope !== "selection" || selected.has(entity.id.toLowerCase()) || selected.has(entity.label.toLowerCase()))
    .map((entity) => ({
      entity,
      score: terms.reduce((total, term) => total + (entity.searchableText.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter(({ score }) => score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score || b.entity.updatedAt.localeCompare(a.entity.updatedAt))
    .slice(0, 20)
    .map(({ entity }) => ({
      id: entity.id,
      label: entity.label,
      matchReason: entity.matchReason,
      module: entity.module,
      route: entity.route,
      status: entity.status,
      updatedAt: entity.updatedAt,
    }));
}

export function buildAdminAIHealthSignals(context: AdminAISectionContext): AdminAIHealthSignal[] {
  const now = context.lastUpdated || new Date().toISOString();
  const signals: AdminAIHealthSignal[] = [];
  context.errors.forEach((item, index) =>
    signals.push(signal(`source-${index}`, "high", "Source unavailable", item, context.sectionName, context.currentRoute, now))
  );
  context.warnings.forEach((item, index) =>
    signals.push(signal(`warning-${index}`, /payment|publish|high-severity/i.test(item) ? "high" : "medium", "Operational attention", item, context.sectionName, context.currentRoute, now))
  );

  const staleCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleEntities = context.entities.filter((entity) => {
    const time = Date.parse(entity.updatedAt);
    return Number.isFinite(time) && time < staleCutoff && /draft|review|open|pending/i.test(entity.status);
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
      title: "Stale records need review",
    });
  }
  return signals.slice(0, 20);
}

export function buildAdminAIHealthScore(context: AdminAISectionContext): AdminAIHealthScore {
  const signals = buildAdminAIHealthSignals(context);
  const sourceScore = clamp(100 - context.errors.length * 25);
  const issueScore = clamp(100 - signals.filter((item) => item.severity === "high" || item.severity === "critical").length * 20 - signals.filter((item) => item.severity === "medium").length * 8);
  const dataScore = context.visibleDataSummary.length ? 100 : 35;
  const freshnessScore = /minute|less than/i.test(context.dataFreshness) ? 100 : /hour/i.test(context.dataFreshness) ? 75 : 45;
  const components = [
    component("sources", "Source availability", sourceScore, [`${context.errors.length} unavailable source signals`], []),
    component("operations", "Operational backlog", issueScore, [`${signals.length} evidence-backed health signals`], []),
    component("data", "Data completeness", dataScore, [`${context.visibleDataSummary.length} compact metrics`], context.visibleDataSummary.length ? [] : ["Loaded metrics"]),
    component("freshness", "Data freshness", freshnessScore, [context.dataFreshness], context.lastUpdated ? [] : ["Freshness timestamp"]),
  ];
  return {
    calculatedAt: context.lastUpdated || new Date().toISOString(),
    components,
    missingInputs: components.flatMap((item) => item.missingInputs),
    score: Math.round(components.reduce((total, item) => total + item.score, 0) / components.length),
  };
}

export function simulateAdminAIPlan(plan: AdminAIPlan): AdminAIPlan {
  const dryRun: AdminAIDryRun = {
    before: plan.affectedRecords.length ? plan.affectedRecords.map((record) => `${record}: unchanged`) : ["No concrete record selected"],
    dependencies: plan.steps.map((step) => step.api || step.label),
    errors: plan.executable ? [] : ["No registered executable handler matches this request."],
    generatedAt: new Date().toISOString(),
    proposedAfter: plan.executable ? ["Protected workflow prepared; no mutation executed in dry run."] : ["Recommendation only; no proposed mutation."],
    publicOutputChanges: /publish|public url/i.test(plan.request),
    recordsSkipped: plan.executable ? [] : plan.affectedRecords,
    validation: plan.executable ? "requires-review" : "blocked",
  };
  return { ...plan, dryRun };
}

function buildAdminAIPlan(
  request: string,
  scope: AdminAIScope,
  context: AdminAISectionContext,
  featureFlags: AdminAIFeatureFlags
): AdminAIPlan {
  const results = searchAdminAIEntities(context, request, scope);
  const approvalLevel = getApprovalLevel(request);
  const registeredAction = context.registeredActions.find((action) =>
    request.toLowerCase().split(/\s+/).some((word) => action.searchText.includes(word))
  );
  const sensitiveAllowed = approvalLevel < 3 || featureFlags.sensitiveActions;
  const executable = Boolean(featureFlags.actions && sensitiveAllowed && registeredAction);
  const affectedRecords = results.slice(0, 12).map((item) => item.label);
  const confirmationRequired = approvalLevel >= 2;
  const otpRequired = approvalLevel === 3 && /archive|cleanup|delete|remove|revoke|role|suspend/i.test(request);
  const risks = [
    approvalLevel === 3 ? "Sensitive action: existing production security remains authoritative." : "Review generated values before approval.",
    results.length > 12 ? `${results.length - 12} additional matched records are excluded from this bounded plan.` : "Result set is bounded to permission-visible records.",
  ];
  if (!featureFlags.actions) risks.push("Admin AI action preparation is disabled by feature flag.");
  if (approvalLevel === 3 && !featureFlags.sensitiveActions) risks.push("Sensitive Admin AI actions are disabled by feature flag.");
  if (!registeredAction) risks.push("No registered action matches this language; arbitrary execution is prohibited.");

  return {
    affectedRecords,
    approvalLevel,
    confirmationRequired,
    executable,
    expectedOutcome: executable ? `Open the registered ${registeredAction?.label || "protected"} workflow for explicit review.` : "Produce a reviewable checklist without changing data.",
    id: `plan-${stableHash(`${context.sectionId}:${request}`)}`,
    otpRequired,
    permissions: registeredAction?.requiredPermissions || [],
    request,
    reversible: approvalLevel < 3,
    risks,
    rollback: approvalLevel < 3 ? "Capture the previous value and expose undo only after a real persisted change." : "No rollback is claimed for sensitive or irreversible operations.",
    sectionId: context.sectionId,
    steps: [
      { actionId: null, api: null, id: "identify", label: "Identify permission-visible affected records", mutation: false, status: "ready" },
      { actionId: null, api: null, id: "validate", label: "Validate dependencies, current state, and risks", mutation: false, status: "ready" },
      {
        actionId: registeredAction?.id || null,
        api: registeredAction?.relatedAPI || null,
        id: "prepare",
        label: registeredAction ? `Prepare ${registeredAction.label}` : "Prepare recommendations only",
        mutation: approvalLevel >= 2,
        status: executable ? "ready" : "blocked",
      },
      { actionId: null, api: "/api/admin/ai-actions", id: "audit", label: "Record approval outcome without secrets or OTPs", mutation: false, status: executable ? "ready" : "pending" },
    ],
    title: `${context.sectionName} action plan`,
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
      results.length ? `${results.length} matching record${results.length === 1 ? "" : "s"}` : "No matching records",
      results.length
        ? "Results come from a bounded, allowlisted, permission-filtered in-memory index. No arbitrary SQL or raw database query ran."
        : "No permission-visible loaded record matched the current terms and scope.",
      results.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(results.length ? "high" : "insufficient-data", results.length ? "Deterministic literal token matches." : "No matching loaded record."),
    evidence: collectEvidence(context, results.length),
    items: results.map((item) => `${item.label} / ${item.status} / ${item.matchReason}`),
    searchResults: results,
  };
}

function buildHealthResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const signals = buildAdminAIHealthSignals(context);
  const score = buildAdminAIHealthScore(context);
  const limit = preferences.responseLength === "detailed" ? 12 : 5;
  const content = [
    `Admin health score: ${score.score}/100`,
    ...score.components.map((item) => `${item.label}: ${item.score}/100`),
    ...signals.slice(0, limit).map((item) => `${item.severity.toUpperCase()}: ${item.title} - ${item.evidence}`),
  ].join("\n");
  return {
    ...baseResponse(
      signals.length ? `${signals.length} evidence-backed attention signal${signals.length === 1 ? "" : "s"}` : "No current health alert",
      `Transparent score ${score.score}/100 from source availability, operational backlog, data completeness, and freshness.`,
      signals.length ? "ready" : context.emptyState ? "missing-data" : "ready",
      modelRoute
    ),
    artifact: artifact("health-report", "Admin Platform Health Briefing", content, context),
    confidence: confidence(context.emptyState ? "insufficient-data" : "high", "Deterministic rules over loaded source status and records."),
    evidence: collectEvidence(context, signals.length),
    healthScore: score,
    healthSignals: signals,
    items: signals.slice(0, limit).map((item) => `${item.severity}: ${item.title}`),
  };
}

function buildAnalyticsResponse(context: AdminAISectionContext, modelRoute: AdminAIModelRoute): AdminAIResponse {
  const points = context.analyticsSeries;
  if (points.length < 2) {
    return {
      ...baseResponse("Insufficient baseline", "At least two real chart buckets are required for trend or anomaly analysis.", "missing-data", modelRoute),
      confidence: confidence("insufficient-data", "The loaded historical series is too short."),
      evidence: collectEvidence(context, points.length),
      items: [],
    };
  }
  const current = points.reduce((total, point) => total + point.current, 0);
  const previous = points.reduce((total, point) => total + point.previous, 0);
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const peak = points.reduce((best, point) => (point.current > best.current ? point : best), points[0]);
  const anomaly = delta === null ? "Insufficient previous-period baseline" : Math.abs(delta) >= 30 ? `Large ${delta > 0 ? "increase" : "drop"} of ${Math.abs(delta)}% needs verification.` : `Change of ${delta}% is within the simple 30% alert threshold.`;
  return {
    ...baseResponse("Deterministic chart explanation", `Current total ${current.toLocaleString()} versus ${previous.toLocaleString()} in the previous period.`, "ready", modelRoute),
    confidence: confidence(previous > 0 ? "high" : "insufficient-data", previous > 0 ? "Computed from real current and previous buckets." : "No previous baseline."),
    evidence: collectEvidence(context, points.length),
    items: [
      delta === null ? "Previous-period change: unavailable" : `Period change: ${delta}%`,
      `Peak bucket: ${peak.label} with ${peak.current.toLocaleString()}`,
      anomaly,
      "Correlation only: this analysis does not claim causation.",
    ],
  };
}

function buildExecutiveReportResponse(
  context: AdminAISectionContext,
  preferences: AdminAIPreferences,
  query: string,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const signals = buildAdminAIHealthSignals(context);
  const title = /monthly/i.test(query) ? "Monthly Growth and Operations Report" : /weekly/i.test(query) ? "Weekly Admin Operations Report" : `${context.sectionName} Operations Report`;
  const facts = context.visibleDataSummary.map((item) => `${item.label}: ${String(item.value)} (${item.source})`);
  const missing = context.errors.length ? context.errors : ["No missing source reported in the loaded context."];
  const content = [
    title,
    `Date range: ${context.dateRange}`,
    `Freshness: ${context.dataFreshness}`,
    "Observed facts:",
    ...facts.map((item) => `- ${item}`),
    "Computed metrics:",
    `- Evidence-backed attention signals: ${signals.length}`,
    `- Permission-visible indexed records: ${context.entities.length}`,
    "AI interpretation (deterministic):",
    ...(signals.length ? signals.map((item) => `- ${item.title}: ${item.evidence}`) : ["- No evidence-backed warning signal."]),
    "Missing data:",
    ...missing.map((item) => `- ${item}`),
    "Recommendations:",
    ...(signals.length ? signals.map((item) => `- ${item.suggestedNextStep}`) : ["- Continue normal review; no warning supports a stronger action."]),
  ].join("\n");
  return {
    ...baseResponse(title, `Generated from ${facts.length} facts and ${signals.length} health signals.`, facts.length ? "ready" : "missing-data", modelRoute),
    artifact: artifact("report", title, content, context),
    confidence: confidence(facts.length ? "high" : "insufficient-data", facts.length ? "Observed facts are source-labelled." : "No metrics loaded."),
    evidence: collectEvidence(context, facts.length),
    items: preferences.includeActionItems ? signals.slice(0, 5).map((item) => item.suggestedNextStep) : [],
  };
}

function buildInvestigationResponse(
  context: AdminAISectionContext,
  query: string,
  scope: AdminAIScope,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const matches = searchAdminAIEntities(context, query, scope);
  const fallback = matches.length ? matches : context.entities
    .filter((entity) => scope === "global" || entity.module === context.sectionId)
    .slice(0, 12)
    .map((entity) => ({
      id: entity.id,
      label: entity.label,
      matchReason: entity.matchReason,
      module: entity.module,
      route: entity.route,
      status: entity.status,
      updatedAt: entity.updatedAt,
    }));
  const modules = Array.from(new Set(fallback.map((item) => item.module)));
  const findings = [
    ...context.errors.map((item) => `Source failure: ${item}`),
    ...context.warnings.map((item) => `Operational warning: ${item}`),
    ...fallback.slice(0, 10).map((item) => `${item.label}: ${item.matchReason}`),
  ];
  const content = [
    `${context.sectionName} investigation`,
    `Request: ${query}`,
    `Modules inspected: ${modules.join(", ") || context.sectionName}`,
    "Findings:",
    ...(findings.length ? findings.map((item) => `- ${item}`) : ["- No evidence-backed finding in loaded data."]),
    "Recommended order:",
    "1. Verify source availability and freshness.",
    "2. Open supporting records and reproduce the visible state.",
    "3. Prepare a registered action only after the cause is confirmed.",
    "4. Preserve existing validation, RBAC, confirmation, and OTP.",
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
    artifact: artifact("error-investigation", `${context.sectionName} Investigation`, content, context),
    confidence: confidence(fallback.length ? "medium" : "insufficient-data", fallback.length ? "Findings are grounded, but probable causes still require verification." : "No supporting records."),
    evidence: collectEvidence(context, fallback.length),
    items: findings.slice(0, 12),
    progress: [
      { id: "records", label: "Read permission-visible records", status: "complete" },
      { id: "sources", label: "Checked source status and freshness", status: "complete" },
      { id: "evidence", label: "Prepared evidence and verification order", status: "complete" },
    ],
    searchResults: fallback,
  };
}

function buildIncidentResponse(
  context: AdminAISectionContext,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const signals = buildAdminAIHealthSignals(context);
  const critical = signals.filter((item) => item.severity === "critical" || item.severity === "high");
  const title = critical.length ? "Incident Mode: active evidence requires review" : "Incident Mode: no critical evidence";
  const content = [
    title,
    `Detected: ${new Date().toISOString()}`,
    `Affected modules: ${Array.from(new Set(signals.map((item) => item.module))).join(", ") || "None"}`,
    "Timeline:",
    ...signals.map((item) => `- ${item.firstDetected}: ${item.title} (${item.severity})`),
    "Investigation checklist:",
    "- Confirm source availability and impact.",
    "- Freeze optional dangerous actions manually if evidence warrants it.",
    "- Follow the existing rollback or recovery runbook.",
    "- Record verified outcomes in the audit trail.",
  ].join("\n");
  return {
    ...baseResponse(
      title,
      critical.length
        ? `${critical.length} high-priority signal${critical.length === 1 ? "" : "s"} found. Copilot will not make destructive infrastructure changes.`
        : "No loaded evidence supports declaring a critical incident. Continue monitoring real sources.",
      critical.length ? "partial-success" : context.emptyState ? "missing-data" : "ready",
      modelRoute
    ),
    artifact: artifact("incident-summary", "Admin Incident Summary", content, context),
    confidence: confidence(context.emptyState ? "insufficient-data" : "high", "Incident state is derived only from evidence-backed health signals."),
    evidence: collectEvidence(context, signals.length),
    healthSignals: signals,
    items: critical.map((item) => `${item.title}: ${item.evidence}`),
    progress: [
      { id: "impact", label: "Summarize current impact", status: "complete" },
      { id: "modules", label: "Identify affected modules", status: "complete" },
      { id: "timeline", label: "Build evidence timeline", status: "complete" },
      { id: "recovery", label: "Prepare non-destructive recovery checklist", status: "complete" },
    ],
  };
}

function buildKnowledgeResponse(
  context: AdminAISectionContext,
  query: string,
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  const matches = context.knowledge
    .map((entry) => ({ entry, score: tokenizeQuery(query).filter((term) => entry.searchableText.includes(term)).length }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.entry);
  return {
    ...baseResponse(
      matches.length ? "Permission-aware operational guidance" : "No current guidance match",
      matches.length ? "Retrieved only versioned, allowlisted knowledge entries available to this role." : "No fresh allowlisted knowledge entry matched the request.",
      matches.length ? "ready" : "missing-data",
      modelRoute
    ),
    confidence: confidence(matches.length ? "high" : "insufficient-data", matches.length ? "Matched allowlisted knowledge terms." : "No knowledge match."),
    evidence: matches.map((entry) => ({
      dateRange: "Current version",
      freshness: entry.freshness,
      label: entry.title,
      module: context.sectionName,
      recordCount: 1,
      source: entry.source,
    })),
    items: matches.map((entry) => `${entry.title}: ${entry.summary}`),
  };
}

function baseResponse(
  title: string,
  body: string,
  state: AdminAIResponse["state"],
  modelRoute: AdminAIModelRoute
): AdminAIResponse {
  return { body, items: [], modelRoute, state, title };
}

function collectEvidence(context: AdminAISectionContext, recordCount: number): AdminAIEvidence[] {
  const sources = context.relatedAPIs.length ? context.relatedAPIs : ["Current section context"];
  return sources.slice(0, 8).map((source) => evidence(context, source, recordCount));
}

function evidence(context: AdminAISectionContext, source: string, recordCount: number): AdminAIEvidence {
  return {
    dateRange: context.dateRange,
    freshness: context.dataFreshness,
    label: context.sectionName,
    module: context.sectionId,
    recordCount,
    source,
  };
}

function confidence(level: AdminAIConfidenceLevel, reason: string) {
  return { level, reason };
}

function routeAdminAIModel(query: string): AdminAIModelRoute {
  const complex = /\b(anomal|cross-module|executive|incident|investigate|monthly|plan|security|weekly)\b/i.test(query);
  const deterministic = /\b(delete|otp|permission|payment|publish|role|search|show|which)\b/i.test(query);
  if (deterministic) return { estimatedTokenBudget: 0, mode: "deterministic", reason: "Permissions, search, security, and calculations stay in deterministic code." };
  if (complex) return { estimatedTokenBudget: 2400, mode: "reasoning", reason: "Complex investigation would use the configured reasoning provider; deterministic fallback remains active." };
  return { estimatedTokenBudget: 700, mode: "fast", reason: "A compact explanation or report can use the fast provider when configured." };
}

function getApprovalLevel(query: string): AdminAIApprovalLevel {
  if (SENSITIVE_WORDS.test(query)) return 3;
  if (/\b(apply|change|edit|fix|mark|save|update)\b/i.test(query)) return 2;
  if (/\b(draft|plan|prepare|propose|report)\b/i.test(query)) return 1;
  return 0;
}

function isPromptInjectionAttempt(query: string) {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(query));
}

function sanitizeQuery(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

function tokenizeQuery(value: string) {
  const stop = new Set(["a", "all", "and", "are", "for", "from", "in", "is", "me", "of", "on", "show", "the", "this", "to", "with"]);
  return Array.from(new Set(sanitizeQuery(value).toLowerCase().split(/[^a-z0-9_-]+/).filter((term) => term.length > 1 && !stop.has(term)))).slice(0, 20);
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
    impact: severity === "high" || severity === "critical" ? "May block or degrade an admin workflow." : "Requires operational review.",
    lastDetected: timestamp,
    module,
    recurrenceCount: 1,
    severity,
    suggestedNextStep: "Open the source module and verify the supporting records.",
    title,
  };
}

function component(
  id: string,
  label: string,
  score: number,
  inputs: string[],
  missingInputs: string[]
) {
  return { id, inputs, label, missingInputs, score };
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
    type,
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
      `Rollback: ${plan.rollback}`,
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
