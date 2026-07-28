import {
  buildAdminAIHealthAlerts,
  type AdminAIEvidenceValue,
  type AdminAIHealthAlert,
  type AdminAIHealthEvidenceInput
} from "./adminAIHealth";
import type { AdminAIEvidence, AdminAIEntity } from "./adminAITypes";

export type AdminAIIncidentKind =
  | "admin-login-outage"
  | "analytics-ingestion-outage"
  | "backup-failure"
  | "mass-publish-failures"
  | "payment-callback-failures"
  | "public-coach-routes-unavailable"
  | "security-rbac-anomaly";

export type AdminAIIncident = Readonly<{
  actionFreeze: Readonly<{
    active: boolean;
    automaticExecutionAllowed: false;
    blockedActionKinds: readonly ["dangerous", "destructive", "optional-mutation"];
    enforcement: "not-required" | "required";
    reason: string;
    scope: "admin-ai-optional-dangerous-actions";
  }>;
  affectedModules: readonly string[];
  alerts: readonly AdminAIHealthAlert[];
  auditTrail: readonly AdminAIIncidentAuditEntry[];
  checklist: readonly AdminAIIncidentChecklistItem[];
  classification: AdminAIIncidentKind | null;
  confidence: "high" | "insufficient-data";
  confidenceReason: string;
  criticalBanner: Readonly<{
    severity: "critical" | "high" | null;
    title: string;
    visible: boolean;
  }>;
  evidence: readonly AdminAIIncidentEvidence[];
  execution: Readonly<{
    automaticDestructiveChangesAllowed: false;
    destructiveChangesExecuted: false;
    infrastructureChangesExecuted: false;
    mode: "advisory-only";
    mutationsExecuted: 0;
  }>;
  impactSummary: string;
  incidentId: string;
  recoverySteps: readonly AdminAIIncidentRecoveryStep[];
  report: AdminAIIncidentReport;
  requestedAt: string;
  requestedKind: AdminAIIncidentKind | null;
  status: "active" | "monitoring";
  timeline: readonly AdminAIIncidentTimelineEntry[];
}>;

export type AdminAIIncidentAuditEntry = Readonly<{
  detail: string;
  event: "dangerous-action-freeze-required" | "incident-classified" | "incident-not-declared";
  evidenceIds: readonly string[];
  id: string;
  mutation: false;
  occurredAt: string;
}>;

export type AdminAIIncidentChecklistItem = Readonly<{
  id:
    | "confirm-impact"
    | "follow-recovery-runbook"
    | "freeze-dangerous-actions"
    | "record-outcome"
    | "review-evidence";
  label: string;
  status: "complete" | "pending";
}>;

export type AdminAIIncidentEvidence = Readonly<{
  alertId: string;
  dateRange: string;
  entityReference: string;
  entityRoute?: string;
  filters: Readonly<Record<string, string>>;
  freshness: string;
  module: string;
  observedAt: string;
  recordCount: number;
  source: string;
  sourceRoute: string;
  summary: string;
  value?: AdminAIEvidenceValue;
}>;

export type AdminAIIncidentRecoveryStep = Readonly<{
  id: string;
  label: string;
  mutation: false;
  status: "pending";
}>;

export type AdminAIIncidentReport = Readonly<{
  generatedAt: string;
  incidentId: string;
  kind: "incident-report";
  sections: readonly AdminAIIncidentReportSection[];
  status: AdminAIIncident["status"];
  title: string;
}>;

export type AdminAIIncidentReportSection = Readonly<{
  id: "affected-modules" | "audit-trail" | "evidence" | "impact" | "recovery" | "timeline";
  items: readonly string[];
  title: string;
}>;

export type AdminAIIncidentTimelineEntry = Readonly<{
  alertId: string;
  id: string;
  module: string;
  observedAt: string;
  source: string;
  summary: string;
}>;

type BuildAdminAIIncidentInput = Readonly<{
  evidence: readonly AdminAIHealthEvidenceInput[];
  query: string;
  requestedAt: string;
}>;

type BuildAdminAIIncidentProvenanceContext = Readonly<{
  dataFreshness: string;
  dateRange: string;
  entities: readonly Pick<AdminAIEntity, "id" | "module" | "route">[];
  filters: Readonly<Record<string, string>>;
}>;

type IncidentRule = Readonly<{
  kind: AdminAIIncidentKind;
  queryPattern: RegExp;
  title: string;
}>;

const INCIDENT_RULES: readonly IncidentRule[] = [
  {
    kind: "admin-login-outage",
    queryPattern:
      /\b(?:admin\s+)?(?:login|authentication|auth).{0,30}\b(?:outage|unavailable|failing|failures?)\b/i,
    title: "Admin login outage"
  },
  {
    kind: "mass-publish-failures",
    queryPattern: /\b(?:mass|multiple|repeated)\s+publish(?:ing)?\s+failures?\b/i,
    title: "Mass publish failures"
  },
  {
    kind: "payment-callback-failures",
    queryPattern: /\bpayment\s+(?:callbacks?|webhooks?).{0,20}\b(?:failing|failures?|outage)\b/i,
    title: "Payment callback failures"
  },
  {
    kind: "public-coach-routes-unavailable",
    queryPattern: /\bpublic\s+coach\s+routes?.{0,20}\b(?:unavailable|outage|failing)\b/i,
    title: "Public coach routes unavailable"
  },
  {
    kind: "backup-failure",
    queryPattern: /\bbackup(?:s)?\s+(?:failure|failed|outage|unavailable)\b/i,
    title: "Backup failure"
  },
  {
    kind: "analytics-ingestion-outage",
    queryPattern:
      /\banalytics\s+(?:event\s+)?ingestion.{0,20}\b(?:outage|unavailable|failing|failure)\b/i,
    title: "Analytics ingestion outage"
  },
  {
    kind: "security-rbac-anomaly",
    queryPattern:
      /\b(?:security|rbac|permission|role).{0,20}\b(?:anomaly|incident|unusual|suspicious)\b/i,
    title: "Security/RBAC anomaly"
  }
] as const;

const HIGH_PRIORITY_SEVERITIES = new Set(["critical", "high"]);

export function isAdminAIIncidentRequest(query: string) {
  return (
    /\bincident(?:\s+mode)?\b/i.test(query) ||
    /\b(?:outage|mass\s+failure|security\s+anomaly)\b/i.test(query) ||
    getRequestedIncidentKind(query) !== null
  );
}

export function hasEligibleAdminAIIncidentEvidence(
  evidence: readonly AdminAIHealthEvidenceInput[]
) {
  return classifyEligibleAlerts(buildAdminAIHealthAlerts(evidence)).length > 0;
}

export function hydrateAdminAIIncidentEvidence(
  incident: Pick<AdminAIIncident, "alerts" | "classification" | "requestedKind">,
  evidence: readonly AdminAIIncidentEvidence[]
): AdminAIIncidentEvidence[] {
  return evidence.map((item) => {
    const alert = incident.alerts.find(({ id }) => id === item.alertId);
    const alertId = cleanProvenanceText(item.alertId, 160) || alert?.id || "incident-evidence";
    const entityReference =
      cleanProvenanceText(item.entityReference, 160) ||
      cleanProvenanceText(alert?.affectedEntity, 160) ||
      `incident:${alertId}`;
    const sourceRoute =
      safeInternalAdminRoute(item.sourceRoute) || safeInternalAdminRoute(alert?.directRoute) || "";
    const storedEntityRoute = safeInternalAdminRoute(item.entityRoute);
    const entityRoute =
      storedEntityRoute && routeTargetsEntity(storedEntityRoute, entityReference)
        ? storedEntityRoute
        : sourceRoute && routeTargetsEntity(sourceRoute, entityReference)
          ? sourceRoute
          : undefined;
    const observedAt =
      normalizeTimestamp(item.observedAt) ||
      normalizeTimestamp(alert?.lastDetected) ||
      normalizeTimestamp(alert?.firstDetected) ||
      "Timestamp unavailable";
    const fallbackFilters = {
      alertId,
      incidentKind: incident.classification || incident.requestedKind || "unclassified",
      minimumSeverity: "high"
    };

    return {
      alertId,
      dateRange:
        cleanProvenanceText(item.dateRange, 320) || deriveIncidentDateRange(alert, observedAt),
      entityReference,
      ...(entityRoute ? { entityRoute } : {}),
      filters: normalizeProvenanceFilters(item.filters, fallbackFilters),
      freshness:
        cleanProvenanceText(item.freshness, 320) || deriveIncidentFreshness(alert, observedAt),
      module:
        cleanProvenanceText(item.module, 160) ||
        cleanProvenanceText(alert?.module, 160) ||
        "incident",
      observedAt,
      recordCount: normalizeRecordCount(item.recordCount),
      source:
        cleanProvenanceText(item.source, 160) ||
        cleanProvenanceText(alert?.evidence[0]?.source, 160) ||
        "incident snapshot",
      sourceRoute,
      summary:
        cleanProvenanceText(item.summary, 500) ||
        cleanProvenanceText(alert?.whatHappened, 500) ||
        "Incident evidence",
      ...(item.value === undefined ? {} : { value: item.value })
    };
  });
}

export function buildAdminAIIncidentProvenance(
  incident: AdminAIIncident,
  _context: BuildAdminAIIncidentProvenanceContext
): AdminAIEvidence[] {
  void _context;
  return hydrateAdminAIIncidentEvidence(incident, incident.evidence).map((item) => {
    return {
      dateRange: item.dateRange,
      entityReferences: [item.entityReference],
      entityRoutes: item.entityRoute ? { [item.entityReference]: item.entityRoute } : {},
      filters: item.filters,
      freshness: item.freshness,
      label: item.summary,
      module: item.module,
      observedAt: item.observedAt,
      recordCount: item.recordCount,
      source: item.source,
      ...(item.sourceRoute ? { sourceRoute: item.sourceRoute } : {})
    };
  });
}

export function buildAdminAIIncident({
  evidence: rawEvidence,
  query,
  requestedAt: rawRequestedAt
}: BuildAdminAIIncidentInput): AdminAIIncident {
  const requestedKind = getRequestedIncidentKind(query);
  const validatedAlerts = buildAdminAIHealthAlerts(rawEvidence);
  const classified = classifyEligibleAlerts(validatedAlerts);
  const selectedKind = requestedKind || classified[0]?.kind || null;
  const alerts = selectedKind
    ? classified.filter(({ kind }) => kind === selectedKind).map(({ alert }) => alert)
    : [];
  const active = alerts.length > 0;
  const classification = active ? selectedKind : null;
  const requestedAt = resolveTimestamp(rawRequestedAt, validatedAlerts);
  const incidentId = `incident-${stableHash(
    `${classification || requestedKind || "unclassified"}:${requestedAt}:${alerts
      .map(({ id }) => id)
      .join(":")}`
  )}`;
  const evidence = buildIncidentEvidence(alerts, classification);
  const timeline = buildTimeline(evidence);
  const affectedModules = unique(alerts.map(({ module }) => module));
  const impactSummary = active
    ? unique(alerts.map(({ impact }) => impact)).join(" ")
    : "No validated critical or high-priority evidence matches the requested incident.";
  const actionFreeze = {
    active,
    automaticExecutionAllowed: false,
    blockedActionKinds: ["dangerous", "destructive", "optional-mutation"],
    enforcement: active ? "required" : "not-required",
    reason: active
      ? "A validated high-priority incident requires investigation before optional dangerous Admin AI actions."
      : "No validated high-priority incident currently requires an action freeze.",
    scope: "admin-ai-optional-dangerous-actions"
  } as const;
  const recoverySteps = buildRecoverySteps(alerts);
  const checklist = buildChecklist(active);
  const auditTrail = buildAuditTrail({
    active,
    alertIds: alerts.map(({ id }) => id),
    incidentId,
    requestedAt
  });
  const status = active ? "active" : "monitoring";
  const title = active
    ? `Incident Mode: ${getRule(classification!)?.title || "validated incident"}`
    : "Incident Mode: no verified critical incident";
  const report = buildReport({
    affectedModules,
    auditTrail,
    evidence,
    generatedAt: requestedAt,
    impactSummary,
    incidentId,
    recoverySteps,
    status,
    timeline,
    title
  });

  return {
    actionFreeze,
    affectedModules,
    alerts,
    auditTrail,
    checklist,
    classification,
    confidence: active ? "high" : "insufficient-data",
    confidenceReason: active
      ? `Matched ${alerts.length} validated critical or high-priority alert${alerts.length === 1 ? "" : "s"} with real evidence.`
      : "Request language alone cannot declare an incident; matching validated critical or high-priority evidence is required.",
    criticalBanner: {
      severity: active
        ? alerts.some(({ severity }) => severity === "critical")
          ? "critical"
          : "high"
        : null,
      title,
      visible: active
    },
    evidence,
    execution: {
      automaticDestructiveChangesAllowed: false,
      destructiveChangesExecuted: false,
      infrastructureChangesExecuted: false,
      mode: "advisory-only",
      mutationsExecuted: 0
    },
    impactSummary,
    incidentId,
    recoverySteps,
    report,
    requestedAt,
    requestedKind,
    status,
    timeline
  };
}

export function formatAdminAIIncidentReport(incident: AdminAIIncident) {
  return [
    incident.report.title,
    `Incident ID: ${incident.incidentId}`,
    `Generated at: ${incident.report.generatedAt}`,
    `Status: ${incident.status}`,
    `Classification: ${incident.classification || "Not declared"}`,
    `Confidence: ${incident.confidence} - ${incident.confidenceReason}`,
    `Critical banner visible: ${incident.criticalBanner.visible ? "Yes" : "No"}`,
    `Impact: ${incident.impactSummary}`,
    `Affected modules: ${incident.affectedModules.join(", ") || "None"}`,
    "Evidence:",
    ...(incident.evidence.length
      ? incident.evidence.map(
          (item) =>
            `- ${item.observedAt} | ${item.source} | module=${item.module} | entity=${item.entityReference} | filters=${Object.entries(
              item.filters
            )
              .map(([key, value]) => `${key}=${value}`)
              .join(", ")} | ${item.summary}`
        )
      : ["- No validated incident evidence."]),
    "Action freeze:",
    `- Active: ${incident.actionFreeze.active ? "Yes" : "No"}`,
    `- Scope: ${incident.actionFreeze.scope}`,
    `- Automatic destructive execution allowed: ${incident.actionFreeze.automaticExecutionAllowed ? "Yes" : "No"}`,
    `- Reason: ${incident.actionFreeze.reason}`,
    "Recovery steps:",
    ...incident.recoverySteps.map((step) => `- [${step.status}] ${step.label}`),
    "Investigation checklist:",
    ...incident.checklist.map((item) => `- [${item.status}] ${item.label}`),
    "Timeline:",
    ...(incident.timeline.length
      ? incident.timeline.map((item) => `- ${item.observedAt} | ${item.module} | ${item.summary}`)
      : ["- No validated incident events."]),
    "Audit trail:",
    ...incident.auditTrail.map(
      (entry) => `- ${entry.occurredAt} | ${entry.event} | mutation=${entry.mutation}`
    ),
    "Execution:",
    `- Mode: ${incident.execution.mode}`,
    `- Mutations executed: ${incident.execution.mutationsExecuted}`,
    `- Destructive changes executed: ${incident.execution.destructiveChangesExecuted ? "Yes" : "No"}`,
    `- Infrastructure changes executed: ${incident.execution.infrastructureChangesExecuted ? "Yes" : "No"}`
  ].join("\n");
}

function getRequestedIncidentKind(query: string) {
  return INCIDENT_RULES.find(({ queryPattern }) => queryPattern.test(query))?.kind || null;
}

function getRule(kind: AdminAIIncidentKind) {
  return INCIDENT_RULES.find((rule) => rule.kind === kind);
}

function classifyAlert(alert: AdminAIHealthAlert): AdminAIIncidentKind | null {
  const text = `${alert.whatHappened} ${alert.impact} ${alert.affectedEntity}`;
  switch (alert.category) {
    case "admin-action-failure-spikes":
      return /\b(?:admin\s+)?(?:login|authentication|auth)\b/i.test(text)
        ? "admin-login-outage"
        : null;
    case "failed-publishes":
      return alert.recurrenceCount > 1 ? "mass-publish-failures" : null;
    case "payment-success-publish-pending-mismatches":
      return /\b(?:callback|webhook)\b/i.test(text) ? "payment-callback-failures" : null;
    case "broken-public-routes":
      return "public-coach-routes-unavailable";
    case "backup-failures":
      return "backup-failure";
    case "analytics-ingestion-failures":
      return "analytics-ingestion-outage";
    case "repeated-failed-otp-attempts":
    case "unusual-permission-changes":
      return "security-rbac-anomaly";
    case "repeated-api-failures":
      if (/\b(?:admin\s+)?(?:login|authentication|auth)\b/i.test(text)) {
        return "admin-login-outage";
      }
      if (/\bpayment\s+(?:callback|webhook)\b/i.test(text)) {
        return "payment-callback-failures";
      }
      return null;
    default:
      return null;
  }
}

function classifyEligibleAlerts(alerts: readonly AdminAIHealthAlert[]) {
  return alerts
    .map((alert) => ({ alert, kind: classifyAlert(alert) }))
    .filter(
      (item): item is { alert: AdminAIHealthAlert; kind: AdminAIIncidentKind } =>
        item.kind !== null && HIGH_PRIORITY_SEVERITIES.has(item.alert.severity)
    );
}

function buildIncidentEvidence(
  alerts: readonly AdminAIHealthAlert[],
  classification: AdminAIIncidentKind | null
) {
  return alerts
    .flatMap((alert) => {
      const entityReference = cleanProvenanceText(alert.affectedEntity, 160) || alert.id;
      const sourceRoute = safeInternalAdminRoute(alert.directRoute) || "";
      const entityRoute =
        sourceRoute && routeTargetsEntity(sourceRoute, entityReference) ? sourceRoute : undefined;
      const dateRange = deriveIncidentDateRange(alert);
      const freshness = deriveIncidentFreshness(alert);

      return alert.evidence.map((fact) => ({
        alertId: alert.id,
        dateRange,
        entityReference,
        ...(entityRoute ? { entityRoute } : {}),
        filters: {
          alertId: alert.id,
          incidentKind: classification || "unclassified",
          minimumSeverity: "high"
        },
        freshness,
        module: alert.module,
        observedAt: fact.observedAt,
        recordCount: 1,
        source: fact.source,
        sourceRoute,
        summary: fact.summary,
        ...(fact.value === undefined ? {} : { value: fact.value })
      }));
    })
    .sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.source.localeCompare(right.source) ||
        left.alertId.localeCompare(right.alertId)
    );
}

function buildTimeline(evidence: readonly AdminAIIncidentEvidence[]) {
  return evidence.map((item, index) => ({
    alertId: item.alertId,
    id: `timeline-${index + 1}-${stableHash(
      `${item.alertId}:${item.observedAt}:${item.source}:${item.summary}`
    )}`,
    module: item.module,
    observedAt: item.observedAt,
    source: item.source,
    summary: item.summary
  }));
}

function buildRecoverySteps(alerts: readonly AdminAIHealthAlert[]) {
  return unique(alerts.map(({ suggestedNextStep }) => suggestedNextStep)).map(
    (label, index) =>
      ({
        id: `recovery-${index + 1}-${stableHash(label)}`,
        label,
        mutation: false,
        status: "pending"
      }) as const
  );
}

function buildChecklist(active: boolean): AdminAIIncidentChecklistItem[] {
  return [
    {
      id: "review-evidence",
      label: "Review the validated source evidence",
      status: active ? "complete" : "pending"
    },
    {
      id: "confirm-impact",
      label: "Confirm the real user and workflow impact",
      status: "pending"
    },
    {
      id: "freeze-dangerous-actions",
      label: "Keep optional dangerous Admin AI actions frozen during investigation",
      status: "pending"
    },
    {
      id: "follow-recovery-runbook",
      label: "Follow the existing rollback or recovery runbook with explicit approval",
      status: "pending"
    },
    {
      id: "record-outcome",
      label: "Record verified findings and outcomes in the persistent audit system",
      status: "pending"
    }
  ];
}

function buildAuditTrail(input: {
  active: boolean;
  alertIds: readonly string[];
  incidentId: string;
  requestedAt: string;
}): AdminAIIncidentAuditEntry[] {
  const classified: AdminAIIncidentAuditEntry = {
    detail: input.active
      ? "Validated high-priority evidence matched a supported incident class."
      : "No validated high-priority evidence matched a supported incident class.",
    event: input.active ? "incident-classified" : "incident-not-declared",
    evidenceIds: input.alertIds,
    id: `${input.incidentId}-classification`,
    mutation: false,
    occurredAt: input.requestedAt
  };
  if (!input.active) return [classified];
  return [
    classified,
    {
      detail:
        "Optional dangerous Admin AI actions require freeze enforcement while the incident is active.",
      event: "dangerous-action-freeze-required",
      evidenceIds: input.alertIds,
      id: `${input.incidentId}-freeze`,
      mutation: false,
      occurredAt: input.requestedAt
    }
  ];
}

function buildReport(input: {
  affectedModules: readonly string[];
  auditTrail: readonly AdminAIIncidentAuditEntry[];
  evidence: readonly AdminAIIncidentEvidence[];
  generatedAt: string;
  impactSummary: string;
  incidentId: string;
  recoverySteps: readonly AdminAIIncidentRecoveryStep[];
  status: AdminAIIncident["status"];
  timeline: readonly AdminAIIncidentTimelineEntry[];
  title: string;
}): AdminAIIncidentReport {
  return {
    generatedAt: input.generatedAt,
    incidentId: input.incidentId,
    kind: "incident-report",
    sections: [
      { id: "impact", items: [input.impactSummary], title: "Impact" },
      {
        id: "affected-modules",
        items: input.affectedModules.length ? input.affectedModules : ["None"],
        title: "Affected modules"
      },
      {
        id: "evidence",
        items: input.evidence.length
          ? input.evidence.map((item) => `${item.observedAt} | ${item.source} | ${item.summary}`)
          : ["No validated incident evidence."],
        title: "Evidence"
      },
      {
        id: "recovery",
        items: input.recoverySteps.map(({ label }) => label),
        title: "Recovery"
      },
      {
        id: "timeline",
        items: input.timeline.map(
          (item) => `${item.observedAt} | ${item.module} | ${item.summary}`
        ),
        title: "Timeline"
      },
      {
        id: "audit-trail",
        items: input.auditTrail.map(
          (item) => `${item.occurredAt} | ${item.event} | mutation=${item.mutation}`
        ),
        title: "Audit trail"
      }
    ],
    status: input.status,
    title: input.title
  };
}

function resolveTimestamp(value: string, alerts: readonly AdminAIHealthAlert[]) {
  if (Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  const latest = alerts
    .map(({ lastDetected }) => lastDetected)
    .sort()
    .at(-1);
  return latest || "Timestamp unavailable";
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isInternalAdminRoute(route: string) {
  return route.startsWith("/admin/");
}

function safeInternalAdminRoute(value: unknown) {
  if (typeof value !== "string") return undefined;
  const route = value.trim();
  if (!route || /[\u0000-\u001f\u007f\\]/.test(route) || !isInternalAdminRoute(route)) {
    return undefined;
  }
  try {
    const parsed = new URL(route, "https://admin.invalid");
    if (parsed.origin !== "https://admin.invalid" || !parsed.pathname.startsWith("/admin/")) {
      return undefined;
    }
    return `${parsed.pathname}${parsed.search}`.slice(0, 500);
  } catch {
    return undefined;
  }
}

function routeTargetsEntity(route: string, entityReference: string) {
  try {
    const parsed = new URL(route, "https://admin.invalid");
    const expected = entityReference.trim().toLowerCase();
    if (!expected) return false;
    const pathSegments = parsed.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment).toLowerCase())
      .filter(Boolean);
    if (pathSegments.includes(expected)) return true;
    return Array.from(parsed.searchParams.entries()).some(
      ([key, value]) => key.toLowerCase() !== "view" && value.trim().toLowerCase() === expected
    );
  } catch {
    return false;
  }
}

function deriveIncidentDateRange(alert?: AdminAIHealthAlert, observedAt?: string) {
  const timestamps = incidentTimestamps(alert, observedAt);
  return timestamps.length
    ? `${timestamps[0]} to ${timestamps[timestamps.length - 1]}`
    : "Unavailable";
}

function deriveIncidentFreshness(alert?: AdminAIHealthAlert, observedAt?: string) {
  const latest = incidentTimestamps(alert, observedAt).at(-1);
  return latest ? `Last observed at ${latest}` : "Unavailable";
}

function incidentTimestamps(alert?: AdminAIHealthAlert, observedAt?: string) {
  return unique(
    [
      alert?.firstDetected,
      alert?.lastDetected,
      ...(alert?.evidence.map((fact) => fact.observedAt) || []),
      observedAt
    ]
      .map(normalizeTimestamp)
      .filter((value): value is string => Boolean(value))
  ).sort();
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
}

function normalizeProvenanceFilters(value: unknown, fallback: Readonly<Record<string, string>>) {
  const entries =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
          .filter(
            ([key, item]) =>
              /^[a-zA-Z0-9._:-]{1,80}$/.test(key) && typeof item === "string" && item.length <= 160
          )
          .slice(0, 20)
      : [];
  return { ...fallback, ...Object.fromEntries(entries) };
}

function normalizeRecordCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function cleanProvenanceText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength)
    : "";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
