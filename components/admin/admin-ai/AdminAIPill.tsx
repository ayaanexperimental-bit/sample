import {
  lazy,
  startTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import type {
  AdminV2AccessProfileClient,
  AdminV2ActionActivity,
  AdminV2ActionActivityInput,
  AdminV2ViewId
} from "../../../lib/admin-v2-access";
import {
  attestAdminAINaturalLanguageRead,
  auditAdminAIAction,
  type AdminAIActionAuditResult,
  executeRegisteredAdminAIAction,
  rollbackRegisteredAdminAIAction
} from "../../../lib/admin-ai/adminAIActions";
import {
  scopeAdminAIContext,
  type AdminAISectionContext
} from "../../../lib/admin-ai/adminAIContext";
import {
  clearAdminAIFeedback,
  loadAdminAIFeedback,
  saveAdminAIFeedback,
  type AdminAIFeedbackRecord
} from "../../../lib/admin-ai/adminAIFeedback";
import {
  getAdminAIFeatureFlags,
  scopeAdminAIExperimentalFlags
} from "../../../lib/admin-ai/adminAIFeatureFlags";
import {
  indexAdminAIApprovedReportArtifacts,
  isAdminAIKnowledgeSourceApproved,
  mergeAdminAIKnowledgeIndexes,
  scopeAdminAIKnowledgeIndexByApprovedSources,
  type AdminAIKnowledgeIndex
} from "../../../lib/admin-ai/adminAIKnowledge";
import {
  applyApprovedAdminAIPreferenceCorrections,
  clearAdminAIPreferences,
  DEFAULT_ADMIN_AI_PREFERENCES,
  loadAdminAIPreferences,
  saveAdminAIPreferences,
  type AdminAIApprovedPreferenceCorrection,
  type AdminAIPreferences
} from "../../../lib/admin-ai/adminAIMemory";
import {
  createAdminAIObservation,
  summarizeAdminAIObservations,
  type AdminAIObservation
} from "../../../lib/admin-ai/adminAIObservability";
import { countAdminAIProactiveSignals } from "../../../lib/admin-ai/adminAIProactiveSignals";
import {
  ADMIN_AI_SCHEDULE_REPORT_TYPES_CLIENT,
  checkpointAdminAISavedTask,
  createAdminAISavedTask,
  deleteAdminAISavedTask,
  loadAdminAIArtifact,
  loadAdminAIArtifacts,
  loadAdminAIObservability,
  loadAdminAISavedTask,
  loadAdminAISavedTasks,
  loadAdminAISchedules,
  loadAdminAISettings,
  mutateAdminAIArtifact,
  mutateAdminAISavedTask,
  mutateAdminAISchedule,
  recordAdminAIFeedbackDurably,
  recordAdminAIObservationDurably,
  requestAdminAIProviderDurably,
  submitAdminAICorrectionDurably,
  updateAdminAISettings,
  type AdminAIDurableArtifact,
  type AdminAIDurableArtifactKind,
  type AdminAIObservabilityDashboardClient,
  type AdminAIOwnerConfigClient,
  type AdminAISavedTaskClient,
  type AdminAIScheduleClient,
  type AdminAISettingsCenterClient
} from "../../../lib/admin-ai/adminAIDurableClient";
import {
  getAdminAIReportIntent,
  getAdminAIReportSizeInput,
  runAdminAINaturalLanguageQueryWithModel,
  simulateAdminAIPlan
} from "../../../lib/admin-ai/adminAIOrchestrator";
import {
  evaluateAdminAIReportPreflight,
  type AdminAIReportPreflightDecision
} from "../../../lib/admin-ai/adminAIReports";
import {
  DEFAULT_ADMIN_AI_OWNER_POLICY,
  applyAdminAIResponsePolicy,
  evaluateAdminAIRequestPolicy,
  getAdminAIRetentionCutoff,
  normalizeAdminAIOwnerPolicy,
  redactAdminAIValue,
  resolveAdminAIModelPolicy,
  scopeAdminAICommandsByOwnerPolicy,
  shouldAuditAdminAIEvent,
  type AdminAIOwnerPolicy,
  type AdminAIPolicyUsage
} from "../../../lib/admin-ai/adminAIPolicy";
import {
  buildAdminAIIncidentProvenance,
  type AdminAIIncident
} from "../../../lib/admin-ai/adminAIIncident";
import {
  getAdminAIUnavailableCapabilityReason,
  getAllowedAdminAICommands
} from "../../../lib/admin-ai/adminAIPermissions";
import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import {
  getAdminAICommand,
  getAdminAIRolePersonalization,
  getAdminAISection,
  globalAdminAICommands,
  personalizeAdminAICommands
} from "../../../lib/admin-ai/adminAIRegistry";
import { requiresAdminAIConfirmation } from "../../../lib/admin-ai/adminAISafety";
import { runAdminAICommand, type AdminAIResponse } from "../../../lib/admin-ai/adminAIService";
import type {
  AdminAIFeedbackKind,
  AdminAIRollbackAction,
  AdminAIScope
} from "../../../lib/admin-ai/adminAITypes";
import {
  ADMIN_AI_ASK_EVENT,
  normalizeAdminAISelectedEntityIds,
  type AdminAIAskEventDetail
} from "../../../lib/admin-ai/adminAIEvents";
import { AdminAIActionConfirm } from "./AdminAIActionConfirm";
import { AdminAICommandList } from "./AdminAICommandList";
import { AdminAIDrawer } from "./AdminAIDrawer";
import { AdminV2PortalScope } from "../admin-v2-portal-scope";
import styles from "./admin-ai.module.css";

let adminAIResponsePanelModulePromise: ReturnType<typeof importAdminAIResponsePanel> | null = null;

function importAdminAIResponsePanel() {
  return import("./AdminAIResponsePanel");
}

function loadAdminAIResponsePanel() {
  adminAIResponsePanelModulePromise ||= importAdminAIResponsePanel();
  return adminAIResponsePanelModulePromise;
}

const LazyAdminAIResponsePanel = lazy(() =>
  loadAdminAIResponsePanel().then((module) => ({ default: module.AdminAIResponsePanel }))
);

const SCOPES: Array<{ id: AdminAIScope; label: string }> = [
  { id: "page", label: "This Page" },
  { id: "selection", label: "Selected Records" },
  { id: "module", label: "Current Module" },
  { id: "global", label: "Entire Admin Panel" }
];

const FEEDBACK: Array<{ id: AdminAIFeedbackKind; label: string }> = [
  { id: "helpful", label: "Helpful" },
  { id: "not-helpful", label: "Not helpful" },
  { id: "incorrect-data", label: "Incorrect data" },
  { id: "unsafe-suggestion", label: "Unsafe suggestion" },
  { id: "missing-context", label: "Missing context" }
];

const CORRECTION_CATEGORIES = [
  { id: "report-interpretation", label: "Report interpretation" },
  { id: "preferred-wording", label: "Preferred wording" },
  { id: "known-issue-classification", label: "Known issue classification" },
  { id: "workflow-preference", label: "Workflow preference" }
] as const;

const SCHEDULE_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

const DEFAULT_SCHEDULE_DRAFT = {
  channel: "in-app" as "email" | "in-app",
  dayOfMonth: 1,
  enabled: false,
  frequency: "daily" as "daily" | "monthly" | "weekly",
  localTime: "09:00",
  recipientEmails: "",
  reportType: "Daily Briefing" as (typeof ADMIN_AI_SCHEDULE_REPORT_TYPES_CLIENT)[number],
  timeZone: "Asia/Calcutta",
  weekday: "monday" as (typeof SCHEDULE_WEEKDAYS)[number]
};

const ADMIN_AI_SESSION_RESPONSE_KEY = "yw-admin-ai:response:v1";
const ADMIN_AI_SESSION_RESPONSE_MAX_BYTES = 64 * 1024;
const ADMIN_AI_SESSION_RESPONSE_TTL_MS = 30 * 60_000;
const ADMIN_AI_SESSION_TASK_KEY = "yw-admin-ai:task:v1";
const ADMIN_AI_SESSION_TASK_MAX_BYTES = 1_024;
const ADMIN_AI_SESSION_TASK_TTL_MS = 30 * 60_000;
const EMPTY_ADMIN_AI_KNOWLEDGE_INDEX: AdminAIKnowledgeIndex = { chunks: [], rejected: [] };
const ADMIN_AI_PERSISTED_RESPONSE_STATES = new Set<AdminAIResponse["state"]>([
  "action-complete",
  "action-failed",
  "action-prepared",
  "blocked-missing-data",
  "cancelled",
  "insufficient-permission",
  "missing-data",
  "offline-error",
  "partial-success",
  "ready"
]);

type AdminAIPersistedIncidentClient = {
  incident: AdminAIIncident;
  status: "active" | "resolved";
  version: number;
};

type AdminAIIncidentApiPayload = {
  error?: string;
  incident?: AdminAIPersistedIncidentClient | null;
  ok?: boolean;
};

type AdminAISettingsPolicyClient = AdminAISettingsCenterClient & {
  approvedCorrections?: AdminAIApprovedPreferenceCorrection[];
  effectivePolicy?: unknown;
  usageBudget?: AdminAIPolicyUsage;
};

type PersistedAdminAILongTask = {
  boundaryKey: string;
  expiresAt: number;
  requestFingerprint: string;
  startedAt: number;
  version: 1;
};

type ActiveAdminAILongTask = {
  boundaryKey: string;
  requestFingerprint: string;
};

type PendingAdminAIReportDecision = {
  boundaryKey: string;
  contextFingerprint: string;
  scope: AdminAIScope;
} & (
  | {
      command: AdminAICommand;
      confirmed: boolean;
      kind: "command";
    }
  | {
      kind: "query";
      request: string;
    }
);

type AdminAIRequestFailureView = {
  body: string;
  code: "authorization" | "network" | "provider" | "rate-limit" | "timeout";
  items: string[];
  title: string;
};

function AdminAIMemoryClearConfirm({
  busy,
  onCancel,
  onConfirm
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const confirmationRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
      return;
    }
    if (event.key !== "Tab" || !confirmationRef.current) return;
    const focusable = Array.from(
      confirmationRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section
      aria-busy={busy}
      aria-describedby="admin-ai-memory-clear-impact"
      aria-label="Clear AI memory and feedback?"
      className={styles.confirmPanel}
      data-admin-ai-memory-clear-confirm="true"
      onKeyDown={handleKeyDown}
      ref={confirmationRef}
      role="alertdialog"
    >
      <small>Confirmation required</small>
      <h4>Clear AI memory and feedback?</h4>
      <p id="admin-ai-memory-clear-impact">
        This deletes approved preference corrections, local response feedback, and this session
        conversation context. It also disables memory. Saved tasks, artifacts, core settings, and
        mandatory audit records remain.
      </p>
      <div>
        <button
          data-admin-ai-confirm-cancel="true"
          disabled={busy}
          onClick={onCancel}
          ref={cancelButtonRef}
          type="button"
        >
          Keep memory
        </button>
        <button data-primary="true" disabled={busy} onClick={() => void onConfirm()} type="button">
          {busy ? "Clearing memory..." : "Clear memory and feedback"}
        </button>
      </div>
    </section>
  );
}

function describeAdminAIRequestFailure(error: unknown): AdminAIRequestFailureView {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const items = [
    "No AI result or protected action is claimed.",
    "Your current page, form data, and core Admin V2 controls remain available."
  ];

  if (/(network|fetch|offline|connection)/.test(message)) {
    return {
      body: "We could not reach the AI service. Check the connection, then retry or continue with the core Admin V2 controls.",
      code: "network",
      items,
      title: "Network connection unavailable"
    };
  }
  if (/(timeout|timed-out|deadline)/.test(message)) {
    return {
      body: "The AI request exceeded its time limit. Retry once or continue with the core Admin V2 controls.",
      code: "timeout",
      items,
      title: "Copilot request timed out"
    };
  }
  if (/(429|quota|rate.?limit|too-many-requests)/.test(message)) {
    return {
      body: "The AI provider is temporarily limiting requests. Wait briefly, then retry or continue with the core Admin V2 controls.",
      code: "rate-limit",
      items,
      title: "Copilot rate limit reached"
    };
  }
  if (/(401|403|auth|forbidden|permission|unauthorized)/.test(message)) {
    return {
      body: "Your Admin AI access changed or could not be verified. Sign in again or ask an owner to verify access; the core Admin V2 controls still work.",
      code: "authorization",
      items,
      title: "Copilot authorization changed"
    };
  }
  return {
    body: "The configured AI provider is unavailable or disabled. Retry later or continue with the core Admin V2 controls.",
    code: "provider",
    items,
    title: "AI provider unavailable"
  };
}

function currentTimeMs() {
  return Date.now();
}

function monotonicTimeMs() {
  return performance.now();
}

function createAdminAIIdempotencyKey(operation: string, seed: string) {
  return `admin-ai-${operation}-${hashAdminAIText(seed)}-${crypto.randomUUID()}`;
}

function createAdminAISafeCheckpointSummary(response: AdminAIResponse) {
  return [response.title, response.body, ...(response.items || []).slice(0, 8)]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 4_000);
}

export type AdminAIExternalCommandHandler = (
  command: AdminAICommand,
  context: AdminAISectionContext,
  options: { signal: AbortSignal }
) => Promise<AdminAIResponse>;

export function AdminAIPill({
  activity,
  assistantState,
  context,
  csrfToken,
  onActivity,
  onAssistantStateChange,
  onExternalCommand,
  onNavigate,
  onOpenChange,
  open,
  orbContent,
  profile,
  theme
}: {
  activity: AdminV2ActionActivity[];
  assistantState: string;
  context: AdminAISectionContext;
  csrfToken: string;
  onActivity: (activity: AdminV2ActionActivityInput) => void;
  onAssistantStateChange: (
    state: "confused" | "focus" | "hover" | "idle" | "listen" | "success" | "thinking" | "warning",
    resetMs?: number
  ) => void;
  onExternalCommand?: AdminAIExternalCommandHandler;
  onNavigate: (view: AdminV2ViewId) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orbContent: ReactNode;
  profile?: AdminV2AccessProfileClient | null;
  theme: "dark" | "light";
}) {
  const section = getAdminAISection(context.sectionId);
  const rawFeatureFlags = useMemo(() => getAdminAIFeatureFlags(), []);
  const featureFlags = useMemo(
    () => scopeAdminAIExperimentalFlags(rawFeatureFlags, Boolean(profile?.isOwner)),
    [profile?.isOwner, rawFeatureFlags]
  );
  const [effectiveOwnerPolicy, setEffectiveOwnerPolicy] = useState<AdminAIOwnerPolicy>(() =>
    normalizeAdminAIOwnerPolicy(DEFAULT_ADMIN_AI_OWNER_POLICY)
  );
  const [durableKnowledgeArtifacts, setDurableKnowledgeArtifacts] = useState<
    AdminAIDurableArtifact[]
  >([]);
  const [scope, setScope] = useState<AdminAIScope>("page");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [preparedPanelSectionId, setPreparedPanelSectionId] = useState("");
  const panelContentReady = preparedPanelSectionId === context.sectionId;
  const [networkActiveSectionId, setNetworkActiveSectionId] = useState("");
  const panelContentActive =
    open && panelContentReady && networkActiveSectionId === context.sectionId;
  useEffect(() => {
    if (panelContentReady) return;
    if (open) {
      const activationId = window.setTimeout(() => {
        startTransition(() => setPreparedPanelSectionId(context.sectionId));
      }, 200);
      return () => window.clearTimeout(activationId);
    }
    return scheduleAdminAIPanelContent(() => {
      startTransition(() => setPreparedPanelSectionId(context.sectionId));
    });
  }, [context.sectionId, open, panelContentReady]);
  useEffect(() => {
    if (!open || !panelContentReady) {
      const resetId = window.setTimeout(() => setNetworkActiveSectionId(""), 0);
      return () => window.clearTimeout(resetId);
    }
    const activationId = window.setTimeout(() => {
      startTransition(() => setNetworkActiveSectionId(context.sectionId));
    }, 120);
    return () => window.clearTimeout(activationId);
  }, [context.sectionId, open, panelContentReady]);
  const effectiveContext = useMemo(() => {
    if (!panelContentReady) return context;
    return scopeAdminAIContext(context, scope, selectedEntityIds);
  }, [context, panelContentReady, scope, selectedEntityIds]);
  const candidateSelectionContext = useMemo(() => {
    if (!panelContentReady) return null;
    return scopeAdminAIContext(context, "selection", selectedEntityIds);
  }, [context, panelContentReady, selectedEntityIds]);
  const approvedReportKnowledgeIndex = useMemo(() => {
    if (!panelContentReady) return null;
    return indexAdminAIApprovedReportArtifacts(durableKnowledgeArtifacts, {
      approvedSources: effectiveOwnerPolicy.approvedKnowledgeSources,
      now: effectiveContext.lastUpdated
    });
  }, [
    durableKnowledgeArtifacts,
    effectiveContext.lastUpdated,
    effectiveOwnerPolicy.approvedKnowledgeSources,
    panelContentReady
  ]);
  const mergedKnowledgeIndex = useMemo(() => {
    if (!panelContentReady) return EMPTY_ADMIN_AI_KNOWLEDGE_INDEX;
    return mergeAdminAIKnowledgeIndexes(
      effectiveContext.knowledgeIndex,
      approvedReportKnowledgeIndex
    );
  }, [approvedReportKnowledgeIndex, effectiveContext.knowledgeIndex, panelContentReady]);
  const policyContext = useMemo(() => {
    if (!panelContentReady) return effectiveContext;
    const approvedSources = effectiveOwnerPolicy.approvedKnowledgeSources;
    return redactAdminAIValue({
      ...effectiveContext,
      knowledge: effectiveContext.knowledge.filter(({ id }) =>
        isAdminAIKnowledgeSourceApproved(id, approvedSources)
      ),
      knowledgeIndex: scopeAdminAIKnowledgeIndexByApprovedSources(
        mergedKnowledgeIndex,
        approvedSources
      )
    });
  }, [
    effectiveContext,
    effectiveOwnerPolicy.approvedKnowledgeSources,
    mergedKnowledgeIndex,
    panelContentReady
  ]);
  const sessionBoundaryKey = useMemo(() => getAdminAIBoundaryKey(profile), [profile]);
  const contextFingerprint = useMemo(() => {
    if (!panelContentReady) return "";
    return hashAdminAIText(JSON.stringify(policyContext));
  }, [panelContentReady, policyContext]);
  const rolePersonalization = useMemo(() => {
    if (!panelContentReady) return null;
    return getAdminAIRolePersonalization(profile);
  }, [panelContentReady, profile]);
  const sectionCommands = useMemo(() => {
    if (!panelContentReady) return [];
    return personalizeAdminAICommands(
      profile,
      getAllowedAdminAICommands(profile, section.commands)
    );
  }, [panelContentReady, profile, section.commands]);
  const globalCommands = useMemo(() => {
    if (!panelContentReady) return [];
    return personalizeAdminAICommands(
      profile,
      getAllowedAdminAICommands(profile, globalAdminAICommands)
    );
  }, [panelContentReady, profile]);
  const commands = useMemo(() => {
    if (!panelContentReady) return [];
    return scopeAdminAICommandsByOwnerPolicy(
      scope === "global" && featureFlags.globalMode ? globalCommands : sectionCommands,
      effectiveOwnerPolicy
    );
  }, [
    effectiveOwnerPolicy,
    featureFlags.globalMode,
    globalCommands,
    panelContentReady,
    scope,
    sectionCommands
  ]);
  const unavailableCapabilityReason = useMemo(() => {
    if (!panelContentReady) return null;
    return getAdminAIUnavailableCapabilityReason(
      profile,
      scope === "global" && featureFlags.globalMode ? globalAdminAICommands : section.commands
    );
  }, [featureFlags.globalMode, panelContentReady, profile, scope, section.commands]);
  const [busy, setBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<AdminAICommand | null>(null);
  const [preferences, setPreferences] = useState<AdminAIPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_ADMIN_AI_PREFERENCES
      : loadAdminAIPreferences(window.localStorage)
  );
  const [response, setResponse] = useState<AdminAIResponse | null>(null);
  const [activeIncident, setActiveIncident] = useState<AdminAIPersistedIncidentClient | null>(null);
  const [incidentResolutionReason, setIncidentResolutionReason] = useState("");
  const [incidentStatus, setIncidentStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [contextTrail, setContextTrail] = useState<string[]>([context.sectionName]);
  const [observations, setObservations] = useState<AdminAIObservation[]>([]);
  const [durableSettings, setDurableSettings] = useState<AdminAISettingsCenterClient | null>(null);
  const [savedTasks, setSavedTasks] = useState<AdminAISavedTaskClient[]>([]);
  const [activeSavedTask, setActiveSavedTask] = useState<AdminAISavedTaskClient | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<AdminAISavedTaskClient | null>(null);
  const [savedTasksOpen, setSavedTasksOpen] = useState(false);
  const [savedTaskStatus, setSavedTaskStatus] = useState("");
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState("");
  const [ownerConfig, setOwnerConfig] = useState<AdminAIOwnerConfigClient | null>(null);
  const [observabilityDashboard, setObservabilityDashboard] =
    useState<AdminAIObservabilityDashboardClient | null>(null);
  const [schedules, setSchedules] = useState<AdminAIScheduleClient[]>([]);
  const [scheduleDraft, setScheduleDraft] = useState(DEFAULT_SCHEDULE_DRAFT);
  const [editingSchedule, setEditingSchedule] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearMemoryBusy, setClearMemoryBusy] = useState(false);
  const [clearMemoryConfirmOpen, setClearMemoryConfirmOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [correctionCategory, setCorrectionCategory] =
    useState<(typeof CORRECTION_CATEGORIES)[number]["id"]>("preferred-wording");
  const [correctionText, setCorrectionText] = useState("");
  const [knowledgeSourceDraft, setKnowledgeSourceDraft] = useState({
    id: "",
    label: "",
    type: "internal" as "internal" | "public-url",
    url: ""
  });
  const [canCancel, setCanCancel] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [pendingReportDecision, setPendingReportDecision] =
    useState<PendingAdminAIReportDecision | null>(null);
  const [responseLayoutStable, setResponseLayoutStable] = useState(false);
  const releaseResponseLayout = useCallback(() => setResponseLayoutStable(false), []);
  const auditQueueRef = useRef<Promise<AdminAIActionAuditResult>>(
    Promise.resolve({ ok: true, requestId: "" })
  );
  const activeLongTaskRef = useRef<ActiveAdminAILongTask | null>(null);
  const mountedRef = useRef(true);
  const operationAbortRef = useRef<AbortController | null>(null);
  const operationModeRef = useRef<"idle" | "mutation" | "read">("idle");
  const operationRef = useRef(0);
  const retryOperationRef = useRef<(() => void) | null>(null);
  const activeRequestKeyRef = useRef("");
  const contextSummaryCacheRef = useRef<{
    boundaryKey: string;
    context: AdminAISectionContext;
    fingerprint: string;
  } | null>(null);
  const responseHydratedBoundaryRef = useRef("");
  const durableArtifactsRef = useRef(new Map<string, AdminAIDurableArtifact>());
  const lastObservationRef = useRef<AdminAIObservation | null>(null);
  const lastObservationWriteRef = useRef<{
    id: string;
    promise: ReturnType<typeof recordAdminAIObservationDurably>;
  } | null>(null);
  const policyUsageRef = useRef<AdminAIPolicyUsage>({
    dailyRequestsPerAdmin: 0,
    monthlyRequestsGlobal: 0
  });
  const settingsQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queryTimesRef = useRef<number[]>([]);
  const queryRef = useRef<HTMLInputElement>(null);
  const previousBoundaryRef = useRef("");
  const previousSectionRef = useRef(context.sectionId);
  const permittedSectionChangeRef = useRef(false);
  const proactiveSignalsEnabled =
    featureFlags.proactiveAlerts &&
    effectiveOwnerPolicy.featureAvailability.proactiveSuggestions &&
    preferences.proactiveSuggestions;
  const [closedAlertCount, setClosedAlertCount] = useState(0);
  const openAlertCount =
    panelContentReady && proactiveSignalsEnabled
      ? countAdminAIProactiveSignals(effectiveContext)
      : 0;
  useEffect(() => {
    if (open) return;
    if (!proactiveSignalsEnabled) return;
    const cancelIdleWork = scheduleAdminAIIdleWork(() => {
      setClosedAlertCount(countAdminAIProactiveSignals(context));
    });
    return cancelIdleWork;
  }, [context, open, proactiveSignalsEnabled]);
  const alertCount = proactiveSignalsEnabled
    ? open
      ? panelContentReady
        ? openAlertCount
        : closedAlertCount
      : closedAlertCount
    : 0;
  const observationSummary = useMemo(
    () => (panelContentReady ? summarizeAdminAIObservations(observations) : null),
    [observations, panelContentReady]
  );

  function clearActiveLongTask(requestFingerprint?: string) {
    if (
      requestFingerprint &&
      activeLongTaskRef.current?.requestFingerprint !== requestFingerprint
    ) {
      return;
    }
    activeLongTaskRef.current = null;
    clearPersistedAdminAILongTask(getAdminAISessionStorage());
  }

  function trackActiveLongTask(requestFingerprint: string, startedAt: number) {
    activeLongTaskRef.current = {
      boundaryKey: sessionBoundaryKey,
      requestFingerprint
    };
    persistAdminAILongTask(getAdminAISessionStorage(), {
      boundaryKey: sessionBoundaryKey,
      expiresAt: startedAt + ADMIN_AI_SESSION_TASK_TTL_MS,
      requestFingerprint,
      startedAt,
      version: 1
    });
  }

  function beginAbortableOperation() {
    operationAbortRef.current?.abort();
    clearActiveLongTask();
    const controller = new AbortController();
    operationAbortRef.current = controller;
    operationModeRef.current = "read";
    setCanCancel(true);
    return controller;
  }

  function finishOperation(controller: AbortController | null) {
    if (controller && operationAbortRef.current !== controller) return;
    operationAbortRef.current = null;
    operationModeRef.current = "idle";
    setCanCancel(false);
  }

  function getCachedPolicyContext() {
    const cached = contextSummaryCacheRef.current;
    if (cached?.boundaryKey === sessionBoundaryKey && cached.fingerprint === contextFingerprint) {
      return cached.context;
    }
    const safeContext = redactAdminAIValue(policyContext);
    contextSummaryCacheRef.current = {
      boundaryKey: sessionBoundaryKey,
      context: safeContext,
      fingerprint: contextFingerprint
    };
    return safeContext;
  }

  function ownerPolicyFeature(value: string) {
    return /daily[- ](?:admin[- ])?briefing/i.test(value) ? ("dailyBriefing" as const) : undefined;
  }

  function checkOwnerPolicyRequest(
    actionType: AdminAICommand["type"],
    feature?: keyof AdminAIOwnerPolicy["featureAvailability"]
  ) {
    const decision = evaluateAdminAIRequestPolicy(effectiveOwnerPolicy, {
      actionType,
      feature,
      usage: policyUsageRef.current
    });
    if (!decision.allowed) {
      setResponse({
        body: decision.reason,
        items: ["Change the persisted owner AI policy or wait for the applicable usage window."],
        state: "insufficient-permission",
        title: "Blocked by owner AI policy"
      });
      onAssistantStateChange("warning", 2400);
      return false;
    }
    return true;
  }

  function commitOwnerPolicyRequest() {
    policyUsageRef.current = {
      dailyRequestsPerAdmin: policyUsageRef.current.dailyRequestsPerAdmin + 1,
      monthlyRequestsGlobal: policyUsageRef.current.monthlyRequestsGlobal + 1
    };
  }

  function handleReportPreflight(
    preflight: ReturnType<typeof evaluateAdminAIReportPreflight>,
    pending: PendingAdminAIReportDecision
  ) {
    if (preflight.status === "ready") return false;
    setCanRetry(false);
    if (preflight.status === "confirmation-required") {
      setPendingReportDecision(pending);
      setResponse({
        body: preflight.warning,
        items: ["No report or artifact was created. Choose Continue or Cancel."],
        state: "confirmation-required",
        title: "Large report confirmation"
      });
      return true;
    }
    setPendingReportDecision(null);
    setResponse({
      body: "Large report generation was cancelled. No report or artifact was created.",
      items: [],
      state: "cancelled",
      title: "Report cancelled"
    });
    return true;
  }

  function enforceResponsePolicy(next: AdminAIResponse) {
    const safe = applyAdminAIResponsePolicy(
      next as unknown as Record<string, unknown>,
      effectiveOwnerPolicy
    ) as unknown as AdminAIResponse;
    if (!safe.modelRoute) return safe;
    const ownerRoute = resolveAdminAIModelPolicy(
      effectiveOwnerPolicy,
      safe.modelRoute.mode,
      safe.modelRoute.estimatedTokenBudget
    );
    return {
      ...safe,
      modelRoute: {
        ...safe.modelRoute,
        estimatedTokenBudget: ownerRoute.maxOutputTokens,
        reason: `${safe.modelRoute.reason} Owner policy route: ${ownerRoute.model || "deterministic"}; maximum ${ownerRoute.maxOutputTokens} output tokens.`
      }
    };
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setContextTrail((current) => {
        if (current[current.length - 1] === context.sectionName) return current;
        return [...current, context.sectionName].slice(-8);
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [context.sectionName]);

  useEffect(() => {
    if (previousSectionRef.current === context.sectionId) return;
    previousSectionRef.current = context.sectionId;
    if (permittedSectionChangeRef.current) {
      permittedSectionChangeRef.current = false;
      return;
    }
    if (operationModeRef.current === "mutation") return;
    if (
      operationModeRef.current === "read" &&
      activeLongTaskRef.current?.boundaryKey === sessionBoundaryKey
    ) {
      return;
    }
    operationAbortRef.current?.abort();
    operationAbortRef.current = null;
    operationModeRef.current = "idle";
    clearActiveLongTask();
    setCanCancel(false);
    operationRef.current += 1;
    const frame = window.requestAnimationFrame(() => {
      setPendingCommand(null);
      if (busy) {
        setBusy(false);
        setResponse((current) => ({
          ...(current || { items: [], title: "Context changed" }),
          body: current?.body
            ? `The read-only request was cancelled because the admin context changed. Safe partial output is preserved below.\n\n${current.body}`
            : "The read-only request was cancelled because the admin context changed. No stale result or mutation was applied.",
          state: "cancelled",
          title: current?.title || "Context changed"
        }));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, context.sectionId, sessionBoundaryKey]);

  useEffect(() => {
    const boundary = [
      profile?.email || "",
      profile?.isOwner ? "owner" : profile?.roleKey || profile?.role || "",
      ...(profile?.permissions || [])
    ]
      .sort()
      .join("|");
    if (previousBoundaryRef.current && previousBoundaryRef.current !== boundary) {
      const sessionStorage = getAdminAISessionStorage();
      clearPersistedAdminAIResponse(sessionStorage);
      clearPersistedAdminAILongTask(sessionStorage);
      activeLongTaskRef.current = null;
      operationAbortRef.current?.abort();
      operationAbortRef.current = null;
      operationModeRef.current = "idle";
      operationRef.current += 1;
      setCanCancel(false);
      setCanRetry(false);
      setBusy(false);
      setPendingCommand(null);
      setClearMemoryBusy(false);
      setClearMemoryConfirmOpen(false);
      setPendingReportDecision(null);
      setQuery("");
      setResponse(null);
      setContextTrail([context.sectionName]);
      setSelectedEntityIds([]);
      setDurableKnowledgeArtifacts([]);
      setSavedTasks([]);
      setActiveSavedTask(null);
      setResumeCandidate(null);
      setSavedTasksOpen(false);
      setSavedTaskStatus("");
      activeRequestKeyRef.current = "";
      contextSummaryCacheRef.current = null;
      responseHydratedBoundaryRef.current = "";
      retryOperationRef.current = null;
    }
    previousBoundaryRef.current = boundary;
  }, [context.sectionName, profile]);

  useEffect(() => {
    if (!sessionBoundaryKey || responseHydratedBoundaryRef.current === sessionBoundaryKey) {
      return;
    }
    responseHydratedBoundaryRef.current = sessionBoundaryKey;
    const sessionStorage = getAdminAISessionStorage();
    const interrupted = loadAdminAILongTask(sessionStorage, sessionBoundaryKey, currentTimeMs());
    if (interrupted) {
      clearPersistedAdminAILongTask(sessionStorage);
      const frame = window.requestAnimationFrame(() => {
        setResponse({
          body: "The prior read task was interrupted before completion. It was a browser request, not a durable background job, so it cannot be resumed or shown as complete.",
          items: ["Run the request again to use freshly permission-filtered context."],
          state: "cancelled",
          title: "Prior read task interrupted"
        });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const restored = loadPersistedAdminAIResponse(
      sessionStorage,
      sessionBoundaryKey,
      currentTimeMs()
    );
    if (!restored) return;
    const frame = window.requestAnimationFrame(() => {
      setResponse((current) => current || restored);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sessionBoundaryKey]);

  useEffect(() => {
    if (
      !response ||
      !sessionBoundaryKey ||
      responseHydratedBoundaryRef.current !== sessionBoundaryKey
    ) {
      return;
    }
    persistAdminAIResponse(
      getAdminAISessionStorage(),
      sessionBoundaryKey,
      response,
      currentTimeMs()
    );
  }, [response, sessionBoundaryKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationAbortRef.current?.abort();
      operationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!panelContentActive || busy || !profile?.isOwner || !featureFlags.incidentMode) return;
    const controller = new AbortController();
    void fetch("/api/admin/ai-incidents", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal
    })
      .then(async (result) => ({
        payload: (await result.json().catch(() => ({}))) as AdminAIIncidentApiPayload,
        result
      }))
      .then(({ payload, result }) => {
        if (!result.ok || !payload.ok || payload.incident?.status !== "active") return;
        setActiveIncident(payload.incident);
        setResponse((current) =>
          current?.incident ? current : incidentResponse(payload.incident!, effectiveContext)
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [busy, effectiveContext, featureFlags.incidentMode, panelContentActive, profile?.isOwner]);

  useEffect(() => {
    if (!panelContentActive || !profile?.email) return;
    const controller = new AbortController();
    void loadAdminAIArtifacts(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setDurableKnowledgeArtifacts(
        result.ok && Array.isArray(result.payload.artifacts) ? result.payload.artifacts : []
      );
    });
    return () => controller.abort();
  }, [panelContentActive, profile?.email]);

  useEffect(() => {
    if (!panelContentActive || !profile?.email) return;
    const controller = new AbortController();
    void loadAdminAISettings(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      const center = result.payload.settings;
      if (!result.ok || !center) {
        setSettingsStatus("Durable settings are unavailable; device preferences remain active.");
        return;
      }
      const policyCenter = center as AdminAISettingsPolicyClient;
      setDurableSettings(center);
      setOwnerConfig(center.ownerConfig || null);
      setEffectiveOwnerPolicy(normalizeAdminAIOwnerPolicy(policyCenter.effectivePolicy));
      policyUsageRef.current = normalizePolicyUsage(policyCenter.usageBudget);
      setPreferences((current) => {
        const next = applyApprovedAdminAIPreferenceCorrections(
          mergeDurablePreferences(current, center.preferences),
          policyCenter.approvedCorrections || []
        );
        saveAdminAIPreferences(window.localStorage, next);
        return next;
      });
      setSettingsStatus("Durable AI settings loaded.");
    });
    return () => controller.abort();
  }, [panelContentActive, profile?.email]);

  useEffect(() => {
    if (!panelContentActive || !profile?.email) return;
    const controller = new AbortController();
    void loadAdminAISavedTasks(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok || !Array.isArray(result.payload.tasks)) {
        setSavedTaskStatus(
          result.error || "Saved tasks are unavailable; this chat is currently non-resumable."
        );
        return;
      }
      setSavedTasks(result.payload.tasks);
      setSavedTaskStatus(
        result.payload.tasks.length
          ? `${result.payload.tasks.length} saved task${result.payload.tasks.length === 1 ? "" : "s"} available.`
          : "No saved tasks yet. Your next request can create one."
      );
    });
    return () => controller.abort();
  }, [panelContentActive, profile?.email]);

  useEffect(() => {
    if (!panelContentActive || !profile?.isOwner) return;
    const controller = new AbortController();
    void loadAdminAIObservability(controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok && result.payload.dashboard) {
        setObservabilityDashboard(result.payload.dashboard);
      }
    });
    return () => controller.abort();
  }, [panelContentActive, profile?.isOwner]);

  useEffect(() => {
    if (!panelContentActive || !settingsOpen || !profile?.isOwner) return;
    const controller = new AbortController();
    void loadAdminAISchedules(controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok && result.payload.schedules) {
        setSchedules(result.payload.schedules);
      }
    });
    return () => controller.abort();
  }, [panelContentActive, profile?.isOwner, settingsOpen]);

  useEffect(() => {
    function openCommandCenter(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      onOpenChange(true);
      onAssistantStateChange("listen");
      window.setTimeout(() => queryRef.current?.focus(), 0);
    }
    document.addEventListener("keydown", openCommandCenter);
    return () => document.removeEventListener("keydown", openCommandCenter);
  }, [onAssistantStateChange, onOpenChange]);

  useEffect(() => {
    function openContextualAsk(event: Event) {
      const detail = (event as CustomEvent<AdminAIAskEventDetail>).detail;
      if (!detail?.query) return;
      setQuery(detail.query.slice(0, 500));
      setScope(detail.scope);
      setSelectedEntityIds(
        detail.scope === "selection"
          ? normalizeAdminAISelectedEntityIds(detail.selectedEntityIds)
          : []
      );
      onOpenChange(true);
      onAssistantStateChange("listen");
      window.setTimeout(() => queryRef.current?.focus(), 0);
    }
    window.addEventListener(ADMIN_AI_ASK_EVENT, openContextualAsk);
    return () => window.removeEventListener(ADMIN_AI_ASK_EVENT, openContextualAsk);
  }, [onAssistantStateChange, onOpenChange]);

  const close = useCallback(() => {
    setPendingCommand(null);
    setClearMemoryConfirmOpen(false);
    setNetworkActiveSectionId("");
    onOpenChange(false);
    startTransition(() => onAssistantStateChange("idle"));
  }, [onAssistantStateChange, onOpenChange]);

  function updatePreferences(next: AdminAIPreferences) {
    setPreferences(next);
    saveAdminAIPreferences(window.localStorage, next);
    setSettingsStatus("Saving durable AI preferences...");
    settingsQueueRef.current = settingsQueueRef.current
      .then(async () => {
        const result = await updateAdminAISettings(
          { preferences: toDurablePreferences(next) },
          csrfToken
        );
        if (!result.ok || !result.payload.settings) {
          setSettingsStatus(
            result.error || "Saved on this device; durable settings are unavailable."
          );
          return;
        }
        const policyCenter = result.payload.settings as AdminAISettingsPolicyClient;
        setDurableSettings(result.payload.settings);
        setOwnerConfig(result.payload.settings.ownerConfig || null);
        setEffectiveOwnerPolicy(normalizeAdminAIOwnerPolicy(policyCenter.effectivePolicy));
        policyUsageRef.current = normalizePolicyUsage(policyCenter.usageBudget);
        setPreferences((current) =>
          applyApprovedAdminAIPreferenceCorrections(current, policyCenter.approvedCorrections || [])
        );
        setSettingsStatus("AI preferences saved durably.");
      })
      .catch(() => {
        setSettingsStatus("Saved on this device; durable settings are unavailable.");
      });
  }

  async function saveOwnerConfiguration() {
    if (!profile?.isOwner || !ownerConfig) return;
    setSettingsStatus("Saving owner AI policy...");
    const result = await updateAdminAISettings(
      { expectedVersion: ownerConfig.version, ownerConfig: ownerConfigMutation(ownerConfig) },
      csrfToken
    );
    if (!result.ok || !result.payload.settings?.ownerConfig) {
      setSettingsStatus(result.error || "Owner AI policy was not saved.");
      return;
    }
    const policyCenter = result.payload.settings as AdminAISettingsPolicyClient;
    setDurableSettings(result.payload.settings);
    setOwnerConfig(result.payload.settings.ownerConfig);
    setEffectiveOwnerPolicy(normalizeAdminAIOwnerPolicy(policyCenter.effectivePolicy));
    policyUsageRef.current = normalizePolicyUsage(policyCenter.usageBudget);
    setSettingsStatus("Owner AI policy saved and audited.");
  }

  function addKnowledgeSource() {
    if (!ownerConfig) return;
    const id = safeArtifactIdentifier(knowledgeSourceDraft.id, "");
    const label = knowledgeSourceDraft.label.trim().slice(0, 120);
    let url: string | undefined;
    if (knowledgeSourceDraft.type === "public-url") {
      try {
        const parsed = new URL(knowledgeSourceDraft.url.trim());
        if (parsed.protocol !== "https:") throw new Error();
        url = parsed.toString();
      } catch {
        setSettingsStatus("Enter a valid HTTPS URL for the approved public source.");
        return;
      }
    }
    if (!id || !label) {
      setSettingsStatus("Knowledge source ID and label are required.");
      return;
    }
    setOwnerConfig({
      ...ownerConfig,
      approvedKnowledgeSources: [
        ...ownerConfig.approvedKnowledgeSources.filter((source) => source.id !== id),
        { id, label, type: knowledgeSourceDraft.type, ...(url ? { url } : {}) }
      ].slice(0, 50)
    });
    setKnowledgeSourceDraft({ id: "", label: "", type: "internal", url: "" });
    setSettingsStatus("Knowledge source prepared. Save owner AI policy to activate it.");
  }

  async function refreshSchedules() {
    if (!profile?.isOwner) return;
    const result = await loadAdminAISchedules();
    if (result.ok && result.payload.schedules) setSchedules(result.payload.schedules);
  }

  async function saveSchedule() {
    if (!profile?.isOwner) return;
    if (
      scheduleDraft.reportType === "Daily Briefing" &&
      (!effectiveOwnerPolicy.featureAvailability.dailyBriefing || !preferences.dailyBriefing)
    ) {
      setScheduleStatus(
        "Daily briefings are disabled by the persisted owner policy or this admin preference."
      );
      return;
    }
    if (scheduleDraft.enabled && preferences.notificationPreference === "none") {
      setScheduleStatus("Enable an approved notification channel before scheduling delivery.");
      return;
    }
    const recipientEmails = scheduleDraft.recipientEmails
      .split(/[;,\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const cadence = {
      frequency: scheduleDraft.frequency,
      localTime: scheduleDraft.localTime,
      timeZone: scheduleDraft.timeZone.trim(),
      ...(scheduleDraft.frequency === "weekly" ? { weekday: scheduleDraft.weekday } : {}),
      ...(scheduleDraft.frequency === "monthly" ? { dayOfMonth: scheduleDraft.dayOfMonth } : {})
    };
    const configuration = {
      cadence,
      delivery: {
        channel: scheduleDraft.channel,
        recipientEmails: scheduleDraft.channel === "email" ? recipientEmails : []
      },
      enabled: scheduleDraft.enabled,
      reportType: scheduleDraft.reportType
    };
    setScheduleStatus(editingSchedule ? "Updating schedule..." : "Creating schedule...");
    const result = await mutateAdminAISchedule(
      editingSchedule
        ? {
            expectedVersion: editingSchedule.version,
            operation: "update",
            patch: configuration,
            scheduleId: editingSchedule.id
          }
        : { operation: "create", ...configuration },
      csrfToken,
      editingSchedule ? "PATCH" : "POST"
    );
    if (!result.ok || !result.payload.schedule) {
      if (result.status === 409) await refreshSchedules();
      setScheduleStatus(
        result.error ||
          (result.status === 409
            ? "The schedule changed in another session; the latest version was loaded."
            : "The schedule was not saved.")
      );
      return;
    }
    setSchedules((current) => [
      result.payload.schedule!,
      ...current.filter((schedule) => schedule.id !== result.payload.schedule!.id)
    ]);
    setScheduleDraft(DEFAULT_SCHEDULE_DRAFT);
    setEditingSchedule(null);
    setScheduleStatus(
      result.payload.schedule.enabled
        ? "Schedule saved with a durable next-run timestamp."
        : "Schedule saved disabled; no delivery is claimed."
    );
  }

  function editSchedule(schedule: AdminAIScheduleClient) {
    setEditingSchedule({ id: schedule.id, version: schedule.version });
    setScheduleDraft({
      channel: schedule.delivery.channel,
      dayOfMonth: schedule.cadence.dayOfMonth || 1,
      enabled: schedule.enabled,
      frequency: schedule.cadence.frequency,
      localTime: schedule.cadence.localTime,
      recipientEmails: schedule.delivery.recipientEmails.join(", "),
      reportType: schedule.reportType,
      timeZone: schedule.cadence.timeZone,
      weekday: schedule.cadence.weekday || "monday"
    });
    setScheduleStatus("Editing the selected version. Save explicitly to update it.");
  }

  async function disableSchedule(schedule: AdminAIScheduleClient) {
    setScheduleStatus("Disabling schedule...");
    const result = await mutateAdminAISchedule(
      {
        expectedVersion: schedule.version,
        operation: "disable",
        scheduleId: schedule.id
      },
      csrfToken,
      "PATCH"
    );
    if (!result.ok || !result.payload.schedule) {
      if (result.status === 409) await refreshSchedules();
      setScheduleStatus(result.error || "The schedule was not disabled.");
      return;
    }
    setSchedules((current) =>
      current.map((item) => (item.id === schedule.id ? result.payload.schedule! : item))
    );
    setScheduleStatus("Schedule disabled durably; no next delivery is queued.");
  }

  async function refreshOwnerObservability(signal?: AbortSignal) {
    if (!profile?.isOwner) return;
    const result = await loadAdminAIObservability(signal);
    if (!signal?.aborted && result.ok && result.payload.dashboard) {
      setObservabilityDashboard(result.payload.dashboard);
    }
  }

  function recordObservation(
    input: Omit<AdminAIObservation, "id" | "timestamp">,
    telemetry: {
      actionOutcome?: "blocked" | "failed" | "not-applicable" | "success";
      approval?: {
        level: 1 | 2 | 3;
        outcome: "approved" | "cancelled" | "denied" | "not-required";
      };
      dangerousActionBlocked?: boolean;
      errorCodes?: string[];
      permissionDenied?: boolean;
    } = {},
    attestedRequestId = ""
  ) {
    const localObservation = createAdminAIObservation(input);
    const observation = attestedRequestId
      ? { ...localObservation, id: attestedRequestId }
      : localObservation;
    lastObservationRef.current = observation;
    setObservations((current) => [observation, ...current].slice(0, 80));
    const durableWrite = recordAdminAIObservationDurably(
      {
        actionOutcome: telemetry.actionOutcome || "not-applicable",
        approvals: telemetry.approval ? [telemetry.approval] : [],
        command: observation.command,
        dangerousActionBlocked: telemetry.dangerousActionBlocked,
        errorCodes: telemetry.errorCodes || [],
        estimatedCostMicrousd: 0,
        latencyMs: observation.latencyMs,
        model: observation.model,
        module: observation.module,
        outcome: observation.outcome,
        permissionDenied: telemetry.permissionDenied,
        requestId: observation.id,
        safetyRefusal: observation.safetyRefusal,
        toolCalls: []
      },
      csrfToken
    );
    lastObservationWriteRef.current = { id: observation.id, promise: durableWrite };
    void durableWrite.then((result) => {
      if (result.ok) void refreshOwnerObservability();
    });
    return observation;
  }

  async function submitCorrection() {
    const observation = lastObservationRef.current;
    const correction = correctionText.trim();
    if (!observation || !correction) {
      setFeedbackStatus("Run a request and enter a correction before submitting.");
      return;
    }
    setFeedbackStatus("Submitting correction for owner-reviewed evaluation...");
    const result = await submitAdminAICorrectionDurably(
      {
        category: correctionCategory,
        command: observation.command,
        correction,
        module: observation.module,
        requestId: observation.id
      },
      csrfToken
    );
    if (!result.ok || !result.payload.correction) {
      setFeedbackStatus(result.error || "Correction was not submitted.");
      return;
    }
    setCorrectionText("");
    setFeedbackStatus(
      `Correction queued for evaluation and explicit owner review (${result.payload.correction.id}).`
    );
    void refreshOwnerObservability();
  }

  async function saveArtifactToReports() {
    if (!effectiveOwnerPolicy.featureAvailability.artifacts) {
      return "Artifact storage is disabled by the persisted owner AI policy.";
    }
    const localArtifact = response?.artifact;
    if (!localArtifact) return "No artifact is available to save.";
    try {
      let durable = durableArtifactsRef.current.get(localArtifact.id);
      if (!durable) {
        const created = await mutateAdminAIArtifact(
          {
            content: localArtifact.content,
            editorEmails: [],
            exportFormats: ["md", "txt"],
            kind: durableArtifactKind(localArtifact.type),
            operation: "create",
            sourceContext: {
              module: safeArtifactIdentifier(effectiveContext.sectionId, "admin"),
              referenceIds: effectiveContext.selectedRows
                .map((id) => safeArtifactIdentifier(id, ""))
                .filter(Boolean)
                .slice(0, 40),
              requestId: safeArtifactIdentifier(localArtifact.id, null),
              scope: durableArtifactScope(scope)
            },
            title: localArtifact.title,
            viewerEmails: []
          },
          csrfToken
        );
        durable = created.payload.artifact;
        if (!created.ok || !durable) {
          return created.error || "The artifact was not saved durably.";
        }
        durableArtifactsRef.current.set(localArtifact.id, durable);
      }

      if (durable.approval.status === "saved") {
        void refreshApprovedReportKnowledge();
        return "Artifact is already saved to Reports.";
      }
      if (durable.approval.status === "not-requested" || durable.approval.status === "rejected") {
        durable = await runArtifactOperation(localArtifact.id, durable, {
          operation: "request-report-save"
        });
      }
      if (!profile?.isOwner) {
        return "Artifact saved durably; owner approval is pending before Reports insertion.";
      }
      if (durable.approval.status === "pending") {
        durable = await runArtifactOperation(localArtifact.id, durable, {
          decision: "approve",
          operation: "decide-report-save",
          reason: "Owner approved the explicit Admin Copilot Save to Reports request."
        });
      }
      if (durable.approval.status === "approved") {
        durable = await runArtifactOperation(localArtifact.id, durable, {
          operation: "save-to-reports"
        });
      }
      if (durable.approval.status === "saved") {
        void refreshApprovedReportKnowledge();
        return "Artifact saved to Reports with durable owner approval and audit history.";
      }
      return "Artifact remains pending; no Reports insertion is claimed.";
    } catch (error) {
      return error instanceof Error ? error.message : "The artifact was not saved.";
    }
  }

  async function deleteArtifact() {
    if (!effectiveOwnerPolicy.featureAvailability.artifacts) {
      return "Artifact operations are disabled by the persisted owner AI policy.";
    }
    const localArtifact = response?.artifact;
    if (!localArtifact) return "No artifact is available to delete.";
    const durable = durableArtifactsRef.current.get(localArtifact.id);
    if (!durable) {
      setResponse((current) => (current ? { ...current, artifact: undefined } : current));
      return "Unsaved artifact removed from this response.";
    }
    try {
      await runArtifactOperation(localArtifact.id, durable, { operation: "delete" });
      durableArtifactsRef.current.delete(localArtifact.id);
      void refreshApprovedReportKnowledge();
      setResponse((current) => (current ? { ...current, artifact: undefined } : current));
      return "Artifact deleted with a versioned durable audit event.";
    } catch (error) {
      return error instanceof Error ? error.message : "The artifact was not deleted.";
    }
  }

  async function runArtifactOperation(
    localId: string,
    durable: AdminAIDurableArtifact,
    operation: Record<string, unknown>
  ) {
    const result = await mutateAdminAIArtifact(
      { artifactId: durable.id, expectedVersion: durable.version, ...operation },
      csrfToken
    );
    if (result.ok && result.payload.artifact) {
      durableArtifactsRef.current.set(localId, result.payload.artifact);
      return result.payload.artifact;
    }
    if (result.status === 409) {
      const current = await loadAdminAIArtifact(durable.id);
      if (current.ok && current.payload.artifact) {
        durableArtifactsRef.current.set(localId, current.payload.artifact);
      }
      throw new Error(
        "The artifact changed in another session. The latest version was loaded; retry explicitly."
      );
    }
    throw new Error(result.error || "The durable artifact operation failed safely.");
  }

  async function refreshApprovedReportKnowledge() {
    const result = await loadAdminAIArtifacts();
    setDurableKnowledgeArtifacts(
      result.ok && Array.isArray(result.payload.artifacts) ? result.payload.artifacts : []
    );
  }

  function logAudit(
    command: AdminAICommand,
    phase: "completed" | "confirmed" | "denied" | "failed" | "requested",
    confirmationResult: "accepted" | "declined" | "not-required"
  ) {
    if (!shouldAuditAdminAIEvent(effectiveOwnerPolicy, { actionType: command.type, phase })) {
      return Promise.resolve({ ok: true, requestId: "" });
    }
    const queuedWrite = auditQueueRef.current.then(() =>
      auditAdminAIAction(
        {
          actionId: command.id,
          actionType: command.type,
          confirmationResult,
          phase,
          recordIds:
            command.type === "write" || command.type === "dangerous"
              ? effectiveContext.selectedRows.slice(0, 12)
              : [],
          sectionId: command.sectionId
        },
        { csrfToken }
      ).catch(() => ({ ok: false, requestId: "" }))
    );
    auditQueueRef.current = queuedWrite;
    return queuedWrite;
  }

  async function getReadObservationRequestId(
    command: AdminAICommand,
    module: string,
    outcome: "failed" | "success",
    auditResult: AdminAIActionAuditResult
  ) {
    if (auditResult.requestId) return auditResult.requestId;
    if (command.type !== "read" && command.type !== "suggest") return "";
    const attestation = await attestAdminAINaturalLanguageRead(
      {
        actionId: command.id,
        module,
        outcome
      },
      { csrfToken }
    );
    return attestation.ok ? attestation.requestId : "";
  }

  async function persistDetectedIncident(incident: AdminAIIncident, request: string) {
    const result = await fetch("/api/admin/ai-incidents", {
      body: JSON.stringify({ evidence: incident.alerts, mode: "sync", query: request }),
      cache: "no-store",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-yw-admin-csrf": csrfToken
      },
      method: "POST"
    });
    const payload = (await result.json().catch(() => ({}))) as AdminAIIncidentApiPayload;
    return result.ok && payload.ok && payload.incident?.status === "active"
      ? payload.incident
      : null;
  }

  async function mutateActiveIncident(
    input:
      | { itemId: string; mode: "checklist"; status: "complete" | "pending" }
      | { mode: "resolve"; reason: string }
  ) {
    if (!activeIncident || !profile?.isOwner) return;
    setIncidentStatus(input.mode === "resolve" ? "Resolving incident..." : "Updating checklist...");
    const result = await fetch("/api/admin/ai-incidents", {
      body: JSON.stringify({
        ...input,
        expectedVersion: activeIncident.version,
        incidentId: activeIncident.incident.incidentId
      }),
      cache: "no-store",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-yw-admin-csrf": csrfToken
      },
      method: "POST"
    });
    const payload = (await result.json().catch(() => ({}))) as AdminAIIncidentApiPayload;
    if (!result.ok || !payload.ok || !payload.incident) {
      setIncidentStatus(payload.error || "The incident update failed safely; reload and retry.");
      return;
    }
    if (payload.incident.status === "resolved") {
      setActiveIncident(null);
      setIncidentResolutionReason("");
      setIncidentStatus("Incident resolved; the durable action freeze was lifted explicitly.");
      setResponse({
        body: "The owner resolved the incident through the protected durable workflow. The resolution and freeze change were audited.",
        items: [],
        state: "action-complete",
        title: "Incident resolved"
      });
      return;
    }
    setActiveIncident(payload.incident);
    setResponse(incidentResponse(payload.incident, effectiveContext));
    setIncidentStatus("Incident checklist updated and audited.");
  }

  function explainUnavailableCapabilities() {
    if (!unavailableCapabilityReason) return;
    setResponse({
      body: unavailableCapabilityReason,
      items: ["Only capabilities available to your current admin role are shown."],
      state: "insufficient-permission",
      title: "Some actions are unavailable"
    });
    onAssistantStateChange("warning", 2400);
  }

  async function execute(
    command: AdminAICommand,
    confirmed: boolean,
    reportDecision?: AdminAIReportPreflightDecision
  ) {
    const taskContext = getCachedPolicyContext();
    const taskScope = scope;
    const reportRequest = command.responseHandlerId === "report";
    setPendingCommand(null);
    if (
      !checkOwnerPolicyRequest(
        command.type,
        ownerPolicyFeature(`${command.id} ${command.reportTitle || ""}`)
      )
    ) {
      return;
    }
    if (
      reportRequest &&
      handleReportPreflight(
        evaluateAdminAIReportPreflight(
          getAdminAIReportSizeInput(
            taskContext,
            preferences,
            effectiveOwnerPolicy.usageLimits.maxTokensPerRequest
          ),
          reportDecision
        ),
        {
          boundaryKey: sessionBoundaryKey,
          command,
          confirmed,
          contextFingerprint,
          kind: "command",
          scope: taskScope
        }
      )
    ) {
      return;
    }
    if (!reportRequest) commitOwnerPolicyRequest();
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    const serverOwnsExecutionAudit = command.kind === "registered-action";
    const controller = serverOwnsExecutionAudit ? null : beginAbortableOperation();
    if (serverOwnsExecutionAudit) {
      operationAbortRef.current?.abort();
      operationAbortRef.current = null;
      operationModeRef.current = "mutation";
      setCanCancel(false);
    }
    const longTaskStartedAt = currentTimeMs();
    const externalReadFingerprint =
      command.kind === "external" && command.type === "read" && controller
        ? hashAdminAIText(
            `${sessionBoundaryKey}|${taskScope}|${command.id}|${operationId}|${longTaskStartedAt}`
          )
        : "";
    if (externalReadFingerprint) {
      trackActiveLongTask(externalReadFingerprint, longTaskStartedAt);
    }
    retryOperationRef.current = serverOwnsExecutionAudit
      ? null
      : () => void execute(command, confirmed);
    setCanRetry(!serverOwnsExecutionAudit);
    const startedAt = monotonicTimeMs();
    setResponseLayoutStable(true);
    setBusy(true);
    setSelectedId(command.id);
    setResponse({
      body: "Reading compact section context and registered sources.",
      items: [],
      progress: [
        { id: "context", label: "Reading permission-filtered context", status: "working" },
        { id: "command", label: "Running registered command", status: "pending" },
        { id: "verify", label: "Verifying result", status: "pending" }
      ],
      state: "retrieving-data",
      title: command.label
    });
    onAssistantStateChange("thinking");
    onActivity({
      detail: `${command.label} started in ${effectiveContext.sectionName}.`,
      label: "Admin Copilot",
      status: "working"
    });
    if (confirmed && !serverOwnsExecutionAudit) await logAudit(command, "confirmed", "accepted");

    try {
      await Promise.resolve();
      if (operationRef.current !== operationId) return;
      setResponse({
        body: "Running the registered command within the current permission boundary.",
        items: [],
        progress: [
          { id: "context", label: "Reading permission-filtered context", status: "complete" },
          { id: "command", label: "Running registered command", status: "working" },
          { id: "verify", label: "Verifying result", status: "pending" }
        ],
        state: "executing",
        title: command.label
      });

      let nextResponse: AdminAIResponse;
      if (command.kind === "external" && onExternalCommand) {
        if (!controller) throw new Error("Missing read-request controller.");
        nextResponse = await onExternalCommand(command, taskContext, {
          signal: controller.signal
        });
      } else if (command.kind === "registered-action") {
        nextResponse = await executeRegisteredAdminAIAction(command, taskContext, {
          csrfToken
        });
      } else {
        const generate = () => {
          if (reportRequest) commitOwnerPolicyRequest();
          return runAdminAICommand(command, taskContext, preferences);
        };
        nextResponse = generate();
      }
      nextResponse = enforceResponsePolicy(nextResponse);
      if (operationRef.current !== operationId) return;
      setResponse({
        ...nextResponse,
        progress: [
          { id: "context", label: "Reading permission-filtered context", status: "complete" },
          { id: "command", label: "Running registered command", status: "complete" },
          { id: "verify", label: "Verifying result", status: "working" }
        ],
        state: "verifying-result"
      });
      await Promise.resolve();
      if (operationRef.current !== operationId) return;
      if (command.kind === "navigate" && command.destinationView) {
        permittedSectionChangeRef.current = true;
        onNavigate(command.destinationView);
      }
      const failed = [
        "action-failed",
        "blocked-missing-data",
        "insufficient-permission",
        "offline-error"
      ].includes(nextResponse.state);
      const auditResult = serverOwnsExecutionAudit
        ? {
            ok: Boolean(nextResponse.approvalReceipt?.auditReference),
            requestId: nextResponse.approvalReceipt?.auditReference || ""
          }
        : await logAudit(
            command,
            failed ? "failed" : "completed",
            confirmed ? "accepted" : "not-required"
          );
      if (operationRef.current !== operationId) return;
      const observationModule = taskScope === "global" ? "global" : taskContext.sectionId;
      const observationRequestId = await getReadObservationRequestId(
        command,
        observationModule,
        failed ? "failed" : "success",
        auditResult
      );
      if (operationRef.current !== operationId) return;
      const responseWithReceipt: AdminAIResponse = serverOwnsExecutionAudit
        ? nextResponse
        : !auditResult.ok
          ? {
              ...nextResponse,
              body: `${nextResponse.body}\n\nDurable audit storage is unavailable, so this result is not recorded as a completed AI-assisted action.`,
              state: failed ? nextResponse.state : "partial-success",
              title: failed ? nextResponse.title : "Completed with audit warning"
            }
          : auditResult.requestId
            ? {
                ...nextResponse,
                approvalReceipt: {
                  action: command.label,
                  affectedRecords: taskContext.selectedRows.slice(0, 12),
                  approvalLevel: command.approvalLevel,
                  auditReference: auditResult.requestId,
                  confirmationTimestamp: new Date().toISOString(),
                  currentState: describeCurrentState(taskContext),
                  executionStatus: failed ? "failure" : "success",
                  impact: command.description,
                  impactLabel: "Impact",
                  outcome: nextResponse.title,
                  otpRequired: Boolean(command.otpRequired),
                  permissionCheck: command.requiredPermissions?.join(", ") || "Authenticated admin",
                  proposedState: describeProposedState(command),
                  recommendedByAI: command.label,
                  recordsChanged:
                    command.kind === "registered-action" && nextResponse.state === "action-complete"
                      ? taskContext.selectedRows.length
                      : 0,
                  requestedBy: profile?.email || "Authenticated admin",
                  reversible: command.rollback === "available-after-persist",
                  rollbackAvailable: !failed && command.rollback === "available-after-persist"
                }
              }
            : nextResponse;
      responseWithReceipt.progress = [
        { id: "context", label: "Reading permission-filtered context", status: "complete" },
        { id: "command", label: "Running registered command", status: "complete" },
        { id: "verify", label: "Verifying result", status: "complete" }
      ];
      setResponse(responseWithReceipt);
      onAssistantStateChange(failed ? "confused" : "success", 2400);
      onActivity({
        detail: failed
          ? `${command.label} stopped safely without changing unauthorized data.`
          : `${command.label} completed without bypassing protected actions.`,
        label: "Admin Copilot",
        status: failed ? "error" : "success"
      });
      recordObservation(
        {
          command: command.id,
          latencyMs: Math.max(0, Math.round(monotonicTimeMs() - startedAt)),
          model: nextResponse.modelRoute?.mode || "deterministic",
          module: observationModule,
          outcome: failed ? "failed" : "success",
          safetyRefusal: false
        },
        {
          actionOutcome:
            command.kind === "registered-action"
              ? failed
                ? "failed"
                : "success"
              : "not-applicable",
          approval:
            command.approvalLevel === 0
              ? undefined
              : {
                  level: command.approvalLevel,
                  outcome: confirmed ? "approved" : "not-required"
                },
          dangerousActionBlocked: command.type === "dangerous" && failed,
          errorCodes: failed ? [nextResponse.state] : [],
          permissionDenied: nextResponse.state === "insufficient-permission"
        },
        observationRequestId
      );
    } catch {
      if (operationRef.current !== operationId) return;
      setResponse({
        body: "The registered command failed safely. No data was changed.",
        items: [],
        state: "offline-error",
        title: "Copilot command unavailable"
      });
      onAssistantStateChange("confused", 3200);
      onActivity({
        detail: `${command.label} failed safely; no data changed.`,
        label: "Admin Copilot",
        status: "error"
      });
      const failedAuditResult = serverOwnsExecutionAudit
        ? { ok: false, requestId: "" }
        : await logAudit(command, "failed", confirmed ? "accepted" : "not-required");
      const observationModule = taskScope === "global" ? "global" : taskContext.sectionId;
      const observationRequestId = await getReadObservationRequestId(
        command,
        observationModule,
        "failed",
        failedAuditResult
      );
      if (operationRef.current !== operationId) return;
      recordObservation(
        {
          command: command.id,
          latencyMs: Math.max(0, Math.round(monotonicTimeMs() - startedAt)),
          model: "deterministic",
          module: observationModule,
          outcome: "failed",
          safetyRefusal: false
        },
        {
          actionOutcome: command.kind === "registered-action" ? "failed" : "not-applicable",
          approval:
            command.approvalLevel === 0
              ? undefined
              : {
                  level: command.approvalLevel,
                  outcome: confirmed ? "approved" : "not-required"
                },
          dangerousActionBlocked: command.type === "dangerous",
          errorCodes: ["request-failed"]
        },
        observationRequestId
      );
    } finally {
      if (
        externalReadFingerprint &&
        mountedRef.current &&
        operationRef.current === operationId &&
        !controller?.signal.aborted
      ) {
        clearActiveLongTask(externalReadFingerprint);
      }
      if (operationRef.current === operationId) {
        setBusy(false);
        finishOperation(controller);
      }
    }
  }

  function selectCommand(command: AdminAICommand) {
    if (!preferences.enabled) {
      setResponse({
        body: "Enable Admin Copilot in settings before running commands. Core admin actions remain available manually.",
        items: [],
        state: "offline-error",
        title: "Admin Copilot is disabled"
      });
      return;
    }
    setSelectedId(command.id);
    void logAudit(command, "requested", "not-required");
    if (requiresAdminAIConfirmation(command)) {
      setPendingCommand(command);
      setResponse({
        body: "Review the protected-action boundary before continuing.",
        items: command.otpRequired ? ["OTP remains required in the existing workflow."] : [],
        state: "waiting-approval",
        title: command.label
      });
      onAssistantStateChange("warning");
      return;
    }
    void execute(command, false);
  }

  function cancelConfirmation() {
    if (pendingCommand) void logAudit(pendingCommand, "denied", "declined");
    setPendingCommand(null);
    setResponse({
      body: "The prepared action was cancelled. No data changed.",
      items: [],
      state: "action-complete",
      title: "Action cancelled"
    });
    onAssistantStateChange("idle");
  }

  function decidePendingReport(decision: AdminAIReportPreflightDecision) {
    const pending = pendingReportDecision;
    if (!pending) return;
    setPendingReportDecision(null);
    if (
      pending.boundaryKey !== sessionBoundaryKey ||
      pending.contextFingerprint !== contextFingerprint ||
      pending.scope !== scope
    ) {
      setResponse({
        body: "The authenticated permission boundary changed. No report or artifact was created.",
        items: ["Run the report request again with the current admin role and scope."],
        state: "cancelled",
        title: "Report context changed"
      });
      return;
    }
    if (decision === "cancel") {
      setCanRetry(false);
      setResponse({
        body: "Large report generation was cancelled. No report or artifact was created.",
        items: [],
        state: "cancelled",
        title: "Report cancelled"
      });
      onAssistantStateChange("idle");
      return;
    }
    if (pending.kind === "query") {
      void submitQuery(undefined, pending.request, "continue");
      return;
    }
    void execute(pending.command, pending.confirmed, "continue");
  }

  function upsertSavedTask(task: AdminAISavedTaskClient) {
    setSavedTasks((current) =>
      [task, ...current.filter((item) => item.id !== task.id)].sort(
        (left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt)
      )
    );
  }

  async function ensureSavedTaskForRequest(request: string) {
    if (
      activeSavedTask &&
      !["blocked-access-changed", "cancelled", "completed"].includes(activeSavedTask.status)
    ) {
      return activeSavedTask;
    }
    setSavedTaskStatus("Creating a secure 90-day saved-task boundary.");
    const taskScope: AdminAISavedTaskClient["scope"] = {
      allowedSectionIds: [effectiveContext.sectionId],
      mode: scope,
      module: effectiveContext.sectionId
    };
    const result = await createAdminAISavedTask(
      {
        goal: request,
        scope: taskScope,
        selectedEntityRefs: effectiveContext.selectedRows.slice(0, 100).map((id) => ({
          id,
          requiredPermissions: [],
          sourceVersion: effectiveContext.lastUpdated || null,
          type: effectiveContext.sectionId
        }))
      },
      csrfToken,
      createAdminAIIdempotencyKey("create", request)
    );
    const task = result.payload.task;
    if (!result.ok || !task) {
      setSavedTaskStatus(
        result.error || "Saved-task storage is unavailable; this request is non-resumable."
      );
      return null;
    }
    setActiveSavedTask(task);
    upsertSavedTask(task);
    setSavedTaskStatus(`Saving to “${task.title}” for 90 days.`);
    return task;
  }

  async function reviewSavedTask(task: AdminAISavedTaskClient) {
    setPendingDeleteTaskId("");
    setSavedTaskStatus("Checking current permissions and saved-task expiry.");
    const result = await loadAdminAISavedTask(task.id);
    const preview = result.payload.task;
    if (!result.ok || !preview) {
      setSavedTaskStatus(result.error || "The saved task could not be opened.");
      return;
    }
    setResumeCandidate(preview);
    upsertSavedTask(preview);
    setSavedTaskStatus(
      preview.accessChanged
        ? "Permissions changed. Resume is blocked without an authorized review."
        : "Resume preview ready. Permissions and data will be checked again."
    );
  }

  async function resumeSavedTask(task: AdminAISavedTaskClient) {
    setSavedTaskStatus("Revalidating identity, permissions, policy, and task boundary.");
    const result = await mutateAdminAISavedTask(
      task,
      "resume",
      csrfToken,
      createAdminAIIdempotencyKey("resume", `${task.id}-${task.version}`)
    );
    const resumed = result.payload.task;
    if (!result.ok || !resumed) {
      setSavedTaskStatus(result.error || "The saved task was not resumed.");
      return;
    }
    setActiveSavedTask(resumed);
    setResumeCandidate(null);
    upsertSavedTask(resumed);
    setResponse({
      body: resumed.lastSafeStep
        ? `Saved goal: ${resumed.goal}\n\nLast safe step: ${resumed.lastSafeStep}`
        : `Saved goal: ${resumed.goal}\n\nNo safe checkpoint was recorded yet.`,
      items: ["Current permissions and data will be checked again on the next request."],
      state: "ready",
      title: `Resumed: ${resumed.title}`
    });
    setSavedTaskStatus("Saved task resumed in a new execution boundary.");
  }

  async function cancelSavedTask(task: AdminAISavedTaskClient) {
    const result = await mutateAdminAISavedTask(
      task,
      "cancel",
      csrfToken,
      createAdminAIIdempotencyKey("cancel", `${task.id}-${task.version}`)
    );
    const cancelled = result.payload.task;
    if (!result.ok || !cancelled) {
      setSavedTaskStatus(result.error || "The saved task was not cancelled.");
      return;
    }
    if (activeSavedTask?.id === cancelled.id) setActiveSavedTask(null);
    setResumeCandidate(cancelled);
    upsertSavedTask(cancelled);
    setSavedTaskStatus("Task cancelled. Its audit history remains until the 90-day expiry.");
  }

  async function deleteSavedTask(task: AdminAISavedTaskClient) {
    const result = await deleteAdminAISavedTask(
      task,
      csrfToken,
      createAdminAIIdempotencyKey("delete", `${task.id}-${task.version}`)
    );
    if (!result.ok) {
      setSavedTaskStatus(result.error || "The saved task was not deleted.");
      return;
    }
    setSavedTasks((current) => current.filter((item) => item.id !== task.id));
    if (activeSavedTask?.id === task.id) setActiveSavedTask(null);
    if (resumeCandidate?.id === task.id) setResumeCandidate(null);
    setPendingDeleteTaskId("");
    setSavedTaskStatus("Saved task deleted. Mandatory audit records remain until policy expiry.");
  }

  async function submitQuery(
    event?: { preventDefault(): void },
    retryRequest?: string,
    reportDecision?: AdminAIReportPreflightDecision
  ) {
    event?.preventDefault();
    const request = (retryRequest ?? query).trim();
    if (!request || busy) return;
    const taskContext = getCachedPolicyContext();
    const taskFeatureFlags = featureFlags;
    const taskOwnerPolicy = effectiveOwnerPolicy;
    const taskPreferences = preferences;
    const taskScope = scope;
    const reportRequest = getAdminAIReportIntent(request) !== null;
    const requestKey = hashAdminAIText(
      `${sessionBoundaryKey}|${scope}|${contextFingerprint}|${request.toLowerCase()}`
    );
    if (activeRequestKeyRef.current === requestKey) return;
    if (!preferences.enabled) {
      setResponse({
        body: "Enable Admin Copilot in settings before running a request. Core admin actions remain available manually.",
        items: [],
        state: "offline-error",
        title: "Admin Copilot is disabled"
      });
      return;
    }
    const now = currentTimeMs();
    queryTimesRef.current = queryTimesRef.current.filter((timestamp) => now - timestamp < 60_000);
    if (queryTimesRef.current.length >= 20) {
      setResponse({
        body: "The session limit is 20 Copilot queries per minute. Wait briefly and retry; core admin actions remain available.",
        items: [],
        state: "action-failed",
        title: "Copilot rate limit reached"
      });
      return;
    }
    if (!checkOwnerPolicyRequest("read", ownerPolicyFeature(request))) return;
    if (
      reportRequest &&
      handleReportPreflight(
        evaluateAdminAIReportPreflight(
          getAdminAIReportSizeInput(
            taskContext,
            taskPreferences,
            taskOwnerPolicy.usageLimits.maxTokensPerRequest
          ),
          reportDecision
        ),
        {
          boundaryKey: sessionBoundaryKey,
          contextFingerprint,
          kind: "query",
          request,
          scope: taskScope
        }
      )
    ) {
      return;
    }
    if (!reportRequest) {
      commitOwnerPolicyRequest();
      queryTimesRef.current.push(now);
    }
    activeRequestKeyRef.current = requestKey;
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    const requestFingerprint = hashAdminAIText(`${requestKey}|${operationId}|${now}`);
    let taskForRequest = activeSavedTask;
    const providerCheckpoint = {
      task: null as AdminAISavedTaskClient | null
    };
    const controller = beginAbortableOperation();
    trackActiveLongTask(requestFingerprint, now);
    retryOperationRef.current = () => void submitQuery(undefined, request);
    setCanRetry(true);
    const startedAt = monotonicTimeMs();
    setResponseLayoutStable(true);
    setBusy(true);
    setPendingCommand(null);
    setSelectedId("");
    setResponse({
      body: "Applying scope, RBAC, source, and registered-action boundaries.",
      items: [],
      progress: [
        { id: "scope", label: "Applying scope and permissions", status: "working" },
        { id: "retrieve", label: "Retrieving bounded evidence", status: "pending" },
        { id: "answer", label: "Preparing grounded result", status: "pending" }
      ],
      state: "analyzing",
      title: "Analyzing admin request"
    });
    onAssistantStateChange("thinking");
    try {
      taskForRequest = await ensureSavedTaskForRequest(request);
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      await Promise.resolve();
      if (operationRef.current !== operationId) return;
      setResponse({
        body: "Preparing a bounded read-only plan before retrieving admin evidence.",
        items: [],
        progress: [
          { id: "scope", label: "Applying scope and permissions", status: "complete" },
          { id: "retrieve", label: "Preparing retrieval plan", status: "working" },
          { id: "answer", label: "Preparing grounded result", status: "pending" }
        ],
        state: "preparing-plan",
        title: "Preparing request plan"
      });
      await Promise.resolve();
      if (operationRef.current !== operationId) return;
      setResponse({
        body: "Retrieving permission-filtered evidence for the requested scope.",
        items: [],
        progress: [
          { id: "scope", label: "Applying scope and permissions", status: "complete" },
          { id: "retrieve", label: "Retrieving bounded evidence", status: "working" },
          { id: "answer", label: "Preparing grounded result", status: "pending" }
        ],
        state: "retrieving-data",
        title: "Retrieving admin evidence"
      });
      await Promise.resolve();
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      const fastRoute = resolveAdminAIModelPolicy(taskOwnerPolicy, "fast");
      const reasoningRoute = resolveAdminAIModelPolicy(taskOwnerPolicy, "reasoning");
      const generate = () => {
        if (reportRequest) {
          commitOwnerPolicyRequest();
          queryTimesRef.current.push(now);
        }
        return runAdminAINaturalLanguageQueryWithModel({
          context: taskContext,
          featureFlags: taskFeatureFlags,
          modelOptions: {
            fast: {
              maxOutputTokens: fastRoute.maxOutputTokens,
              model: fastRoute.model || undefined
            },
            reasoning: {
              maxOutputTokens: reasoningRoute.maxOutputTokens,
              model: reasoningRoute.model || undefined
            }
          },
          preferences: taskPreferences,
          providers: {
            openai: async (providerRequest) => {
              const result = await requestAdminAIProviderDurably(
                taskForRequest,
                request,
                providerRequest,
                csrfToken,
                createAdminAIIdempotencyKey(
                  "message",
                  `${taskForRequest?.id || "session"}-${requestFingerprint}`
                )
              );
              if (!result.ok || !result.payload.response) {
                throw new Error(result.code || "provider-unavailable");
              }
              if (result.payload.task) {
                providerCheckpoint.task = result.payload.task;
              }
              return result.payload.response;
            }
          },
          query: request,
          reportDecision,
          requestedMaxOutputTokens: taskOwnerPolicy.usageLimits.maxTokensPerRequest,
          signal: controller.signal,
          scope: taskScope
        });
      };
      let next = await generate();
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      next = enforceResponsePolicy(next);
      const providerCheckpointedTask = providerCheckpoint.task;
      if (providerCheckpointedTask) {
        taskForRequest = providerCheckpointedTask;
        setActiveSavedTask(providerCheckpointedTask);
        upsertSavedTask(providerCheckpointedTask);
        setSavedTaskStatus(`Checkpoint saved to “${providerCheckpointedTask.title}”.`);
      } else if (taskForRequest) {
        const checkpoint = await checkpointAdminAISavedTask(
          taskForRequest,
          {
            assistantSummary: createAdminAISafeCheckpointSummary(next),
            query: request
          },
          csrfToken,
          createAdminAIIdempotencyKey("checkpoint", `${taskForRequest.id}-${requestFingerprint}`)
        );
        if (checkpoint.ok && checkpoint.payload.task) {
          taskForRequest = checkpoint.payload.task;
          setActiveSavedTask(checkpoint.payload.task);
          upsertSavedTask(checkpoint.payload.task);
          setSavedTaskStatus(`Checkpoint saved to “${checkpoint.payload.task.title}”.`);
        } else {
          setSavedTaskStatus(
            checkpoint.error ||
              "The response is visible but its resumable checkpoint was not saved."
          );
        }
      }
      if (next.incident?.actionFreeze.active) {
        const persisted = profile?.isOwner
          ? await persistDetectedIncident(next.incident, request).catch(() => null)
          : null;
        if (operationRef.current !== operationId || controller.signal.aborted) return;
        if (!persisted) {
          next = {
            body: "Validated incident evidence could not be durably registered. No incident completion is claimed; owner review is required before any optional dangerous action.",
            items: ["Durable incident storage or owner authorization is required."],
            state: "action-failed",
            title: "Incident tracking unavailable"
          };
        } else {
          setActiveIncident(persisted);
          next = { ...next, incident: persisted.incident };
        }
      }
      setResponse({
        ...next,
        progress: [
          { id: "scope", label: "Applying scope and permissions", status: "complete" },
          { id: "retrieve", label: "Retrieving bounded evidence", status: "complete" },
          { id: "answer", label: "Preparing grounded result", status: "working" }
        ],
        state: "verifying-result"
      });
      await Promise.resolve();
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      const blocked = next.state === "insufficient-permission";
      const observationModule = taskScope === "global" ? "global" : taskContext.sectionId;
      const attestation = await attestAdminAINaturalLanguageRead(
        {
          module: observationModule,
          outcome: blocked ? "blocked" : "success"
        },
        { csrfToken }
      );
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      next.progress = [
        { id: "scope", label: "Applying scope and permissions", status: "complete" },
        { id: "retrieve", label: "Retrieving bounded evidence", status: "complete" },
        { id: "answer", label: "Preparing grounded result", status: "complete" }
      ];
      setResponse(next);
      recordObservation(
        {
          command: "natural-language",
          latencyMs: Math.max(0, Math.round(monotonicTimeMs() - startedAt)),
          model: next.modelRoute?.mode || "deterministic",
          module: observationModule,
          outcome: blocked ? "blocked" : "success",
          safetyRefusal: blocked && /safety/i.test(next.title)
        },
        {
          actionOutcome: "not-applicable",
          errorCodes: blocked ? [next.state] : [],
          permissionDenied: blocked
        },
        attestation.ok ? attestation.requestId : ""
      );
      onAssistantStateChange(blocked ? "warning" : "success", 2400);
      onActivity({
        detail: blocked
          ? "A natural-language request was blocked by safety policy."
          : `Grounded ${formatScope(taskScope)} request completed.`,
        label: "Admin Copilot",
        status: blocked ? "error" : "success"
      });
    } catch (error) {
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      const observationModule = taskScope === "global" ? "global" : taskContext.sectionId;
      const failure = describeAdminAIRequestFailure(error);
      const attestation = await attestAdminAINaturalLanguageRead(
        { module: observationModule, outcome: "failed" },
        { csrfToken }
      );
      if (operationRef.current !== operationId || controller.signal.aborted) return;
      setResponse({
        body: failure.body,
        items: failure.items,
        state: "offline-error",
        title: failure.title
      });
      recordObservation(
        {
          command: "natural-language",
          latencyMs: Math.max(0, Math.round(monotonicTimeMs() - startedAt)),
          model: "deterministic",
          module: observationModule,
          outcome: "failed",
          safetyRefusal: false
        },
        { errorCodes: [failure.code] },
        attestation.ok ? attestation.requestId : ""
      );
      onAssistantStateChange("confused", 3200);
      onActivity({
        detail:
          "The natural-language request failed safely; core admin controls and entered data remain available.",
        label: "Admin Copilot",
        status: "error"
      });
    } finally {
      if (activeRequestKeyRef.current === requestKey) activeRequestKeyRef.current = "";
      if (
        mountedRef.current &&
        operationRef.current === operationId &&
        !controller.signal.aborted
      ) {
        clearActiveLongTask(requestFingerprint);
      }
      if (operationRef.current === operationId) {
        setBusy(false);
        finishOperation(controller);
      }
    }
  }

  function cancelOperation() {
    operationAbortRef.current?.abort();
    operationAbortRef.current = null;
    operationModeRef.current = "idle";
    clearActiveLongTask();
    operationRef.current += 1;
    setCanCancel(false);
    setBusy(false);
    setPendingCommand(null);
    setPendingReportDecision(null);
    setResponse((current) => ({
      ...(current || { items: [], title: "Operation cancelled" }),
      body: current?.body
        ? `The active read-only request was cancelled. Safe partial output is preserved below and was not treated as complete.\n\n${current.body}`
        : "The active read-only request was cancelled. No partial output was available and no data changed.",
      state: "cancelled",
      title: current?.title || "Operation cancelled"
    }));
    recordObservation({
      command: selectedId || "natural-language",
      latencyMs: 0,
      model: "deterministic",
      module: scope === "global" ? "global" : effectiveContext.sectionId,
      outcome: "cancelled",
      safetyRefusal: false
    });
    onAssistantStateChange("idle");
  }

  function runDryTest() {
    if (!response?.plan) return;
    setResponse({
      ...response,
      plan: simulateAdminAIPlan(response.plan),
      state: "action-prepared"
    });
  }

  function approvePlan() {
    const actionId = response?.plan?.steps.find((step) => step.actionId)?.actionId;
    const command = actionId ? getAdminAICommand(actionId) : null;
    if (command && response?.plan?.executable) {
      selectCommand(command);
      return;
    }
    setResponse((current) =>
      current
        ? {
            ...current,
            body: "This plan has no registered executable handler. It remains a reviewable artifact and no data changed.",
            state: "action-prepared"
          }
        : current
    );
  }

  async function executeRollback(action: AdminAIRollbackAction) {
    if (busy) return;
    setBusy(true);
    onAssistantStateChange("thinking");
    const next = await rollbackRegisteredAdminAIAction(action, { csrfToken }).catch(() => ({
      body: "The rollback request failed safely. No rollback success is claimed.",
      items: [],
      state: "action-failed" as const,
      title: "Rollback failed"
    }));
    const failed = [
      "action-failed",
      "blocked-missing-data",
      "insufficient-permission",
      "offline-error"
    ].includes(next.state);
    setResponse(next);
    setBusy(false);
    onAssistantStateChange(failed ? "confused" : "success", 2400);
    onActivity({
      detail: failed
        ? "Copilot rollback failed safely."
        : `${action.label} completed through the protected API.`,
      label: "Admin Copilot",
      status: failed ? "error" : "success"
    });
  }

  function editPlan() {
    if (!response?.plan) return;
    setQuery(response.plan.request);
    window.setTimeout(() => queryRef.current?.focus(), 0);
  }

  async function clearConversation() {
    const task = activeSavedTask;
    const sessionStorage = getAdminAISessionStorage();
    clearPersistedAdminAIResponse(sessionStorage);
    clearPersistedAdminAILongTask(sessionStorage);
    activeLongTaskRef.current = null;
    operationAbortRef.current?.abort();
    operationAbortRef.current = null;
    operationModeRef.current = "idle";
    operationRef.current += 1;
    setCanCancel(false);
    setBusy(false);
    setPendingCommand(null);
    setPendingReportDecision(null);
    setQuery("");
    setResponse(activeIncident ? incidentResponse(activeIncident, effectiveContext) : null);
    setSelectedId("");
    setContextTrail([context.sectionName]);
    setSelectedEntityIds([]);
    activeRequestKeyRef.current = "";
    contextSummaryCacheRef.current = null;
    onAssistantStateChange("idle");
    if (!task) {
      setSavedTaskStatus("Fresh conversation started. No saved task was active.");
      return;
    }
    setSavedTaskStatus("Closing the active conversation boundary.");
    const result = await mutateAdminAISavedTask(
      task,
      "clear-context",
      csrfToken,
      createAdminAIIdempotencyKey("clear-context", `${task.id}-${task.version}`)
    );
    if (!result.ok || !result.payload.task) {
      setSavedTaskStatus(
        result.error ||
          "Local context cleared, but the durable conversation boundary was not updated."
      );
      return;
    }
    setActiveSavedTask(result.payload.task);
    upsertSavedTask(result.payload.task);
    setSavedTaskStatus(
      "Fresh conversation started. Saved task, artifacts, preferences, and audit remain."
    );
  }

  async function recordFeedback(kind: AdminAIFeedbackKind) {
    const record: AdminAIFeedbackRecord = {
      commandId: selectedId || "natural-language",
      kind,
      sectionId: context.sectionId,
      timestamp: new Date().toISOString()
    };
    const retentionCutoff = getAdminAIRetentionCutoff(effectiveOwnerPolicy, "general");
    const retained = loadAdminAIFeedback(window.localStorage).filter(
      ({ timestamp }) => Date.parse(timestamp) >= retentionCutoff
    );
    const next = [record, ...retained].slice(0, 80);
    saveAdminAIFeedback(window.localStorage, next);
    const observation = lastObservationRef.current;
    if (!observation) {
      setFeedbackStatus(
        "Feedback saved on this device; no matching request telemetry was available."
      );
      return;
    }
    setFeedbackStatus("Saving response feedback without response or source content...");
    const observationWrite = lastObservationWriteRef.current;
    if (observationWrite?.id === observation.id) {
      const observationResult = await observationWrite.promise;
      if (!observationResult.ok) {
        setFeedbackStatus("Feedback remains on this device; durable storage is unavailable.");
        return;
      }
    }
    const result = await recordAdminAIFeedbackDurably(kind, observation.id, csrfToken);
    setFeedbackStatus(
      result.ok
        ? "Feedback recorded durably without storing the response or source data."
        : result.error || "Feedback remains on this device; durable storage is unavailable."
    );
    if (result.ok) void refreshOwnerObservability();
  }

  async function clearSafeMemory() {
    if (clearMemoryBusy) return;
    setClearMemoryBusy(true);
    setFeedbackStatus("Requesting durable safe-memory clearing...");
    try {
      const nextPreferences = { ...preferences, memoryEnabled: false };
      const result = await updateAdminAISettings(
        {
          clearSafeMemory: true,
          preferences: { memoryEnabled: false }
        },
        csrfToken
      );
      if (!result.ok || !result.payload.settings) {
        setFeedbackStatus(result.error || "Safe memory was not cleared; no success is claimed.");
        return;
      }
      clearConversation();
      clearAdminAIPreferences(window.localStorage);
      clearAdminAIFeedback(window.localStorage);
      saveAdminAIPreferences(window.localStorage, nextPreferences);
      setPreferences(nextPreferences);
      setDurableSettings(result.payload.settings);
      setOwnerConfig(result.payload.settings.ownerConfig || null);
      const policyCenter = result.payload.settings as AdminAISettingsPolicyClient;
      setEffectiveOwnerPolicy(normalizeAdminAIOwnerPolicy(policyCenter.effectivePolicy));
      policyUsageRef.current = normalizePolicyUsage(policyCenter.usageBudget);
      setObservations([]);
      lastObservationRef.current = null;
      setCorrectionText("");
      setClearMemoryConfirmOpen(false);
      setFeedbackStatus(
        "AI memory, approved corrections, local feedback, and session context cleared. Saved tasks, artifacts, settings, and audit records remain."
      );
    } catch {
      setFeedbackStatus(
        "Safe memory could not be cleared. Nothing is reported as deleted; retry or keep the current settings."
      );
    } finally {
      setClearMemoryBusy(false);
    }
  }

  const selectedEntitySummary = panelContentReady
    ? effectiveContext.selectedRows
        .map((id) => effectiveContext.entities.find((entity) => entity.id === id)?.label || id)
        .join(", ")
    : "";
  const filterSummary = panelContentReady
    ? Object.entries(effectiveContext.filters)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    : "";
  const copilotDisplayState = response?.state
    ? response.state
    : alertCount
      ? effectiveContext.errors.length
        ? "urgent-alert"
        : "contextual-suggestion"
      : assistantState === "listen"
        ? "listening"
        : "idle";

  const panel = (
      <AdminAIDrawer
        onClose={close}
        onContentHidden={releaseResponseLayout}
        open={open}
      sectionName={scope === "global" ? "Global Admin" : section.name}
      stateLabel={`${context.dataFreshness} / ${formatCopilotState(copilotDisplayState)}`}
      theme={theme}
    >
      {panelContentReady ? (
        <>
          <section className={styles.scopePanel} aria-label="Copilot scope">
            <div>
              <small>Operating scope</small>
              <strong>{formatScope(scope)}</strong>
              <span>
                {effectiveContext.selectedRows.length} selected / {effectiveContext.entities.length}{" "}
                indexed records
              </span>
            </div>
            <div className={styles.scopeTabs} role="group" aria-label="Admin Copilot scope">
              {SCOPES.map((item) => {
                const disabled =
                  (item.id === "global" && !featureFlags.globalMode) ||
                  (item.id === "selection" && !candidateSelectionContext?.selectedRows.length);
                return (
                  <button
                    aria-pressed={scope === item.id}
                    disabled={disabled}
                    key={item.id}
                    onClick={() => setScope(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <details className={styles.scopeDetails}>
              <summary>Context details</summary>
              <div>
                <p>Context path: {contextTrail.join(" -> ")}</p>
                <p>Selected entity: {selectedEntitySummary || "None"}</p>
                <p>Current filters: {filterSummary || "None"}</p>
              </div>
            </details>
          </section>

          <section className={styles.savedTasksPanel} aria-label="Saved tasks">
            <button
              aria-expanded={savedTasksOpen}
              className={styles.savedTasksToggle}
              onClick={() => setSavedTasksOpen((value) => !value)}
              type="button"
            >
              <span>
                <strong>Saved tasks</strong>
                <small>
                  {activeSavedTask
                    ? `Active: ${activeSavedTask.title}`
                    : `${savedTasks.length} available · retained for 90 days`}
                </small>
              </span>
              <span>{savedTasksOpen ? "Hide" : "Review"}</span>
            </button>
            {savedTasksOpen ? (
              <div className={styles.savedTasksBody}>
                <p>Resume is always explicit. Permissions and data will be checked again.</p>
                {savedTasks.length ? (
                  <ul className={styles.savedTaskList}>
                    {savedTasks.map((task) => (
                      <li
                        data-active={activeSavedTask?.id === task.id ? "true" : "false"}
                        key={task.id}
                      >
                        <div>
                          <strong>{task.title}</strong>
                          <span>
                            {task.status} · updated {new Date(task.lastActivityAt).toLocaleString()}
                          </span>
                        </div>
                        <button onClick={() => void reviewSavedTask(task)} type="button">
                          Review
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No saved tasks yet. Run a request to create a secure task boundary.</p>
                )}
                {resumeCandidate ? (
                  <div
                    className={styles.resumePreview}
                    role="group"
                    aria-label="Saved task resume preview"
                  >
                    <strong>{resumeCandidate.title}</strong>
                    <p>{resumeCandidate.goal}</p>
                    <dl>
                      <div>
                        <dt>Last safe step</dt>
                        <dd>{resumeCandidate.lastSafeStep || "No checkpoint recorded"}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{new Date(resumeCandidate.expiresAt).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Artifacts</dt>
                        <dd>{resumeCandidate.artifactCount}</dd>
                      </div>
                    </dl>
                    <p>Permissions and data will be checked again.</p>
                    <div className={styles.savedTaskActions}>
                      <button
                        disabled={
                          resumeCandidate.accessChanged === true ||
                          resumeCandidate.status === "cancelled"
                        }
                        onClick={() => void resumeSavedTask(resumeCandidate)}
                        type="button"
                      >
                        Resume
                      </button>
                      {resumeCandidate.status !== "cancelled" ? (
                        <button onClick={() => void cancelSavedTask(resumeCandidate)} type="button">
                          Cancel task
                        </button>
                      ) : null}
                      {pendingDeleteTaskId === resumeCandidate.id ? null : (
                        <button
                          onClick={() => setPendingDeleteTaskId(resumeCandidate.id)}
                          type="button"
                        >
                          Delete saved task
                        </button>
                      )}
                    </div>
                    {pendingDeleteTaskId === resumeCandidate.id ? (
                      <div
                        aria-label="Confirm saved task deletion"
                        className={styles.deleteConfirmation}
                        role="group"
                      >
                        <p>
                          Delete this saved task and its checkpoints? Mandatory audit records remain
                          for the fixed 90-day policy.
                        </p>
                        <div>
                          <button
                            onClick={() => void deleteSavedTask(resumeCandidate)}
                            type="button"
                          >
                            Confirm deletion
                          </button>
                          <button onClick={() => setPendingDeleteTaskId("")} type="button">
                            Keep task
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {savedTaskStatus ? <p role="status">{savedTaskStatus}</p> : null}
              </div>
            ) : null}
          </section>

          <form className={styles.commandCenter} onSubmit={(event) => void submitQuery(event)}>
            <label htmlFor="admin-ai-command-input">
              Ask, search, investigate, report, or prepare an action
            </label>
            <div>
              <input
                autoComplete="off"
                id="admin-ai-command-input"
                maxLength={500}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={rolePersonalization?.promptPlaceholder}
                ref={queryRef}
                value={query}
              />
              <button disabled={busy || !query.trim()} type="submit">
                Run
              </button>
              {busy && canCancel ? (
                <button onClick={cancelOperation} type="button">
                  Cancel
                </button>
              ) : null}
            </div>
            <small>
              Strict schema, bounded context, registered actions, and RBAC. No arbitrary SQL or tool
              calls.
            </small>
          </form>

          <details className={styles.contextSummary} aria-label="Current section context">
            <summary>
              <span>Current context</span>
              <strong>{context.sectionName}</strong>
            </summary>
            <div className={styles.contextSummaryGrid}>
              <div>
                <small>Current section</small>
                <strong>{context.sectionName}</strong>
                <span>{context.dateRange}</span>
              </div>
              <div>
                <small>Permission boundary</small>
                <strong>{rolePersonalization?.label}</strong>
                <span>
                  {commands.length} allowed commands · {rolePersonalization?.focus}
                </span>
                {unavailableCapabilityReason ? (
                  <button onClick={explainUnavailableCapabilities} type="button">
                    Why are some actions unavailable?
                  </button>
                ) : null}
              </div>
              <div>
                <small>Source state</small>
                <strong>
                  {effectiveContext.loadingState
                    ? "Loading"
                    : effectiveContext.errors.length
                      ? "Unavailable source"
                      : "Ready"}
                </strong>
                <span>{effectiveContext.relatedAPIs.length} registered sources</span>
              </div>
            </div>
          </details>

          {alertCount ? (
            <section className={styles.alertStrip} aria-label="Real data alerts">
              <strong>
                {alertCount} current attention signal{alertCount === 1 ? "" : "s"}
              </strong>
              <p>{effectiveContext.errors[0] || effectiveContext.warnings[0]}</p>
            </section>
          ) : null}

          <AdminAICommandList
            busy={busy}
            commands={commands}
            onSelect={selectCommand}
            selectedId={selectedId}
          />

          {pendingReportDecision ? (
            <section
              aria-label="Large report confirmation"
              className={styles.confirmPanel}
              role="alertdialog"
            >
              <small>Confirmation required</small>
              <h4>Continue with this large report?</h4>
              <p>
                Generation has not started. Continue uses the captured permission-filtered scope;
                Cancel creates no report or artifact.
              </p>
              <div>
                <button onClick={() => decidePendingReport("cancel")} type="button">
                  Cancel
                </button>
                <button
                  data-primary="true"
                  onClick={() => decidePendingReport("continue")}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </section>
          ) : null}

          {pendingCommand ? (
            <AdminAIActionConfirm
              command={pendingCommand}
              affectedRecords={effectiveContext.selectedRows}
              currentState={describeCurrentState(effectiveContext)}
              onCancel={cancelConfirmation}
              onConfirm={() => void execute(pendingCommand, true)}
              proposedState={describeProposedState(pendingCommand)}
              requestedBy={profile?.email || "Authenticated admin"}
            />
          ) : null}

          <Suspense
            fallback={
              <div className={styles.drawerLoading} role="status">
                Loading response details.
              </div>
            }
          >
            <LazyAdminAIResponsePanel
              onApprovePlan={approvePlan}
              onCancelPlan={() => setResponse(null)}
              onDeleteArtifact={deleteArtifact}
              onDryRun={runDryTest}
              onEditPlan={editPlan}
              onRegenerate={() => retryOperationRef.current?.()}
              onRetry={canRetry ? () => retryOperationRef.current?.() : undefined}
              onRollback={(action) => void executeRollback(action)}
              onSaveArtifact={saveArtifactToReports}
              onToggleSearchResult={(id) =>
                setSelectedEntityIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id].slice(0, 40)
                )
              }
              response={response}
              selectedSearchResultIds={selectedEntityIds}
              stabilizeLayout={responseLayoutStable}
            />
          </Suspense>

          {profile?.isOwner && activeIncident?.status === "active" ? (
            <section className={styles.settingsPanel} aria-label="Owner incident controls">
              <strong>Owner incident checklist</strong>
              <ul>
                {activeIncident.incident.checklist.map((item) => (
                  <li key={item.id}>
                    <span>
                      {item.label} · {item.status}
                    </span>
                    <button
                      onClick={() =>
                        void mutateActiveIncident({
                          itemId: item.id,
                          mode: "checklist",
                          status: item.status === "complete" ? "pending" : "complete"
                        })
                      }
                      type="button"
                    >
                      Mark {item.status === "complete" ? "pending" : "complete"}
                    </button>
                  </li>
                ))}
              </ul>
              <label>
                Resolution reason
                <textarea
                  maxLength={240}
                  onChange={(event) => setIncidentResolutionReason(event.target.value)}
                  placeholder="State the verified recovery outcome before lifting the freeze."
                  value={incidentResolutionReason}
                />
              </label>
              <button
                disabled={incidentResolutionReason.trim().length < 8}
                onClick={() =>
                  void mutateActiveIncident({
                    mode: "resolve",
                    reason: incidentResolutionReason.trim()
                  })
                }
                type="button"
              >
                Resolve incident and lift freeze
              </button>
              {incidentStatus ? <p role="status">{incidentStatus}</p> : null}
            </section>
          ) : null}

          {response && !busy ? (
            <details className={styles.feedbackPanel} aria-label="Copilot response feedback">
              <summary>Response feedback and correction</summary>
              <div className={styles.feedbackBody}>
                <strong>Evaluate this response</strong>
                <div>
                  {FEEDBACK.map((item) => (
                    <button key={item.id} onClick={() => recordFeedback(item.id)} type="button">
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className={styles.settingsGrid}>
                  <label>
                    Structured correction category
                    <select
                      onChange={(event) =>
                        setCorrectionCategory(
                          event.target.value as (typeof CORRECTION_CATEGORIES)[number]["id"]
                        )
                      }
                      value={correctionCategory}
                    >
                      {CORRECTION_CATEGORIES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Correction for evaluation
                    <textarea
                      maxLength={800}
                      onChange={(event) => setCorrectionText(event.target.value)}
                      placeholder="Describe the corrected interpretation or workflow preference."
                      value={correctionText}
                    />
                  </label>
                  <button
                    disabled={!correctionText.trim()}
                    onClick={() => void submitCorrection()}
                    type="button"
                  >
                    Submit for owner review
                  </button>
                </div>
                {feedbackStatus ? <p role="status">{feedbackStatus}</p> : null}
              </div>
            </details>
          ) : null}

          <section className={styles.settingsPanel} aria-label="Admin Copilot settings">
            <button
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((value) => !value)}
              type="button"
            >
              <span>
                <strong>AI settings and privacy</strong>
                <small>Preferences only; no secrets or record content.</small>
              </span>
              <span>{settingsOpen ? "Hide" : "Open"}</span>
            </button>
            {settingsOpen ? (
              <div className={styles.settingsGrid}>
                <label>
                  Response length
                  <select
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        reportStyle: event.target.value === "detailed" ? "detailed" : "concise",
                        responseLength: event.target.value === "detailed" ? "detailed" : "concise"
                      })
                    }
                    value={preferences.responseLength}
                  >
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label>
                  Preferred language
                  <select
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        preferredLanguage: event.target.value === "hi" ? "hi" : "en"
                      })
                    }
                    value={preferences.preferredLanguage}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi / Hinglish</option>
                  </select>
                </label>
                <label>
                  Report format
                  <select
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        reportFormat: event.target.value === "summary" ? "summary" : "operations"
                      })
                    }
                    value={preferences.reportFormat}
                  >
                    <option value="operations">Operations report</option>
                    <option value="summary">Short summary</option>
                  </select>
                </label>
                <label>
                  Briefing notifications
                  <select
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        notificationPreference: event.target
                          .value as AdminAIPreferences["notificationPreference"]
                      })
                    }
                    value={preferences.notificationPreference}
                  >
                    <option value="in-app">In-app</option>
                    <option value="email">Email</option>
                    <option value="both">In-app and email</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    checked={preferences.enabled}
                    onChange={(event) =>
                      updatePreferences({ ...preferences, enabled: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Enable Admin Copilot commands
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    checked={preferences.proactiveSuggestions}
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        proactiveSuggestions: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  Proactive evidence-backed alerts
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    checked={preferences.dailyBriefing}
                    onChange={(event) =>
                      updatePreferences({ ...preferences, dailyBriefing: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Daily briefing preference
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    checked={preferences.memoryEnabled && featureFlags.memory}
                    disabled={!featureFlags.memory}
                    onChange={(event) =>
                      updatePreferences({ ...preferences, memoryEnabled: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Safe preference memory
                </label>
                <label className={styles.checkboxLabel}>
                  <input
                    checked={preferences.includeActionItems}
                    onChange={(event) =>
                      updatePreferences({
                        ...preferences,
                        includeActionItems: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  Include action items
                </label>
                <button
                  aria-expanded={clearMemoryConfirmOpen}
                  onClick={() => setClearMemoryConfirmOpen(true)}
                  type="button"
                >
                  Review memory clearing
                </button>
                {clearMemoryConfirmOpen ? (
                  <AdminAIMemoryClearConfirm
                    busy={clearMemoryBusy}
                    onCancel={() => setClearMemoryConfirmOpen(false)}
                    onConfirm={clearSafeMemory}
                  />
                ) : null}
                <div className={styles.flagGrid} aria-label="Admin AI feature flags">
                  {Object.entries(featureFlags).map(([key, value]) => (
                    <span data-enabled={value ? "true" : "false"} key={key}>
                      {key}: {value ? "on" : "off"}
                    </span>
                  ))}
                </div>
                {durableSettings ? (
                  <>
                    <div className={styles.flagGrid} aria-label="Durable AI settings summary">
                      <span>Usage scope: {durableSettings.usage.scope}</span>
                      <span>Durable requests: {durableSettings.usage.requests}</span>
                      <span>Tool calls: {durableSettings.usage.toolCalls}</span>
                      <span>Approvals: {durableSettings.usage.approvals}</span>
                      <span>
                        Estimated cost:{" "}
                        {formatMicrousd(durableSettings.usage.estimatedCostMicrousd)}
                      </span>
                    </div>
                    <section aria-label="AI privacy policy">
                      <strong>Privacy and retention</strong>
                      <p>Memory: {durableSettings.privacy.memory}</p>
                      <p>Retention: {durableSettings.privacy.retention}</p>
                      <p>Sharing: {durableSettings.privacy.sharing}</p>
                    </section>
                    <section aria-label="AI-assisted action history">
                      <strong>AI-assisted action history</strong>
                      {durableSettings.actionHistory.length ? (
                        <ul>
                          {durableSettings.actionHistory.map((entry) => (
                            <li key={entry.id}>
                              {entry.command} · {entry.actionOutcome} · {entry.outcome} ·{" "}
                              {entry.createdAt}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No durable AI-assisted actions recorded for this scope.</p>
                      )}
                    </section>
                  </>
                ) : null}
                {profile?.isOwner && ownerConfig ? (
                  <fieldset aria-label="Owner AI policy">
                    <legend>Owner AI policy</legend>
                    <strong>Action permissions</strong>
                    {(["readEnabled", "writeEnabled", "dangerousEnabled"] as const).map((key) => (
                      <label className={styles.checkboxLabel} key={key}>
                        <input
                          checked={ownerConfig.actionPermissions[key]}
                          onChange={(event) =>
                            setOwnerConfig((current) =>
                              current
                                ? {
                                    ...current,
                                    actionPermissions: {
                                      ...current.actionPermissions,
                                      [key]: event.target.checked
                                    }
                                  }
                                : current
                            )
                          }
                          type="checkbox"
                        />
                        {ownerPolicyLabel(key)}
                      </label>
                    ))}

                    <strong>Feature availability</strong>
                    {(
                      [
                        "artifacts",
                        "dailyBriefing",
                        "proactiveSuggestions",
                        "streaming",
                        "voice"
                      ] as const
                    ).map((key) => (
                      <label className={styles.checkboxLabel} key={key}>
                        <input
                          checked={ownerConfig.featureAvailability[key]}
                          onChange={(event) =>
                            setOwnerConfig((current) =>
                              current
                                ? {
                                    ...current,
                                    featureAvailability: {
                                      ...current.featureAvailability,
                                      [key]: event.target.checked
                                    }
                                  }
                                : current
                            )
                          }
                          type="checkbox"
                        />
                        {ownerPolicyLabel(key)}
                      </label>
                    ))}

                    <label>
                      Per-admin daily request limit
                      <input
                        min={1}
                        onChange={(event) =>
                          setOwnerConfig((current) =>
                            current
                              ? {
                                  ...current,
                                  usageLimits: {
                                    ...current.usageLimits,
                                    dailyRequestsPerAdmin: Number(event.target.value)
                                  }
                                }
                              : current
                          )
                        }
                        type="number"
                        value={ownerConfig.usageLimits.dailyRequestsPerAdmin}
                      />
                    </label>
                    <label>
                      Global monthly request limit
                      <input
                        min={1}
                        onChange={(event) =>
                          setOwnerConfig((current) =>
                            current
                              ? {
                                  ...current,
                                  usageLimits: {
                                    ...current.usageLimits,
                                    monthlyRequestsGlobal: Number(event.target.value)
                                  }
                                }
                              : current
                          )
                        }
                        type="number"
                        value={ownerConfig.usageLimits.monthlyRequestsGlobal}
                      />
                    </label>
                    <label>
                      Maximum tokens per request
                      <input
                        min={256}
                        onChange={(event) =>
                          setOwnerConfig((current) =>
                            current
                              ? {
                                  ...current,
                                  usageLimits: {
                                    ...current.usageLimits,
                                    maxTokensPerRequest: Number(event.target.value)
                                  }
                                }
                              : current
                          )
                        }
                        type="number"
                        value={ownerConfig.usageLimits.maxTokensPerRequest}
                      />
                    </label>
                    <label>
                      Retention period (days)
                      <input
                        aria-describedby="admin-ai-task-retention-note"
                        min={1}
                        readOnly
                        type="number"
                        value={ownerConfig.retentionPeriodDays}
                      />
                      <small id="admin-ai-task-retention-note">
                        Fixed 90-day policy for saved Admin AI tasks in this release.
                      </small>
                    </label>

                    <strong>Model routing</strong>
                    {(["defaultModel", "complexModel", "fallbackModel"] as const).map((key) => (
                      <label key={key}>
                        {ownerPolicyLabel(key)}
                        <input
                          maxLength={80}
                          onChange={(event) =>
                            setOwnerConfig((current) =>
                              current
                                ? {
                                    ...current,
                                    modelRouting: {
                                      ...current.modelRouting,
                                      [key]: event.target.value
                                    }
                                  }
                                : current
                            )
                          }
                          value={ownerConfig.modelRouting[key]}
                        />
                      </label>
                    ))}

                    <strong>Audit configuration</strong>
                    {(["enabled", "recordDeniedAttempts", "recordReadEvents"] as const).map(
                      (key) => (
                        <label className={styles.checkboxLabel} key={key}>
                          <input
                            checked={ownerConfig.auditConfiguration[key]}
                            onChange={(event) =>
                              setOwnerConfig((current) =>
                                current
                                  ? {
                                      ...current,
                                      auditConfiguration: {
                                        ...current.auditConfiguration,
                                        [key]: event.target.checked
                                      }
                                    }
                                  : current
                              )
                            }
                            type="checkbox"
                          />
                          {ownerPolicyLabel(key)}
                        </label>
                      )
                    )}
                    <label>
                      Audit retention (days)
                      <input
                        aria-describedby="admin-ai-audit-retention-note"
                        min={1}
                        readOnly
                        type="number"
                        value={ownerConfig.auditConfiguration.retentionDays}
                      />
                      <small id="admin-ai-audit-retention-note">
                        Fixed 90-day policy; audit events cannot be shortened or extended here.
                      </small>
                    </label>

                    <strong>Approved knowledge sources</strong>
                    {ownerConfig.approvedKnowledgeSources.length ? (
                      <ul>
                        {ownerConfig.approvedKnowledgeSources.map((source) => (
                          <li key={source.id}>
                            <span>
                              {source.label} ({source.type})
                            </span>
                            <button
                              aria-label={`Remove knowledge source ${source.label}`}
                              onClick={() =>
                                setOwnerConfig((current) =>
                                  current
                                    ? {
                                        ...current,
                                        approvedKnowledgeSources:
                                          current.approvedKnowledgeSources.filter(
                                            (item) => item.id !== source.id
                                          )
                                      }
                                    : current
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No owner-approved knowledge sources.</p>
                    )}
                    <label>
                      Source ID
                      <input
                        maxLength={80}
                        onChange={(event) =>
                          setKnowledgeSourceDraft((current) => ({
                            ...current,
                            id: event.target.value
                          }))
                        }
                        value={knowledgeSourceDraft.id}
                      />
                    </label>
                    <label>
                      Source label
                      <input
                        maxLength={120}
                        onChange={(event) =>
                          setKnowledgeSourceDraft((current) => ({
                            ...current,
                            label: event.target.value
                          }))
                        }
                        value={knowledgeSourceDraft.label}
                      />
                    </label>
                    <label>
                      Source type
                      <select
                        onChange={(event) =>
                          setKnowledgeSourceDraft((current) => ({
                            ...current,
                            type: event.target.value === "public-url" ? "public-url" : "internal"
                          }))
                        }
                        value={knowledgeSourceDraft.type}
                      >
                        <option value="internal">Internal</option>
                        <option value="public-url">Public URL</option>
                      </select>
                    </label>
                    {knowledgeSourceDraft.type === "public-url" ? (
                      <label>
                        Approved source URL
                        <input
                          maxLength={500}
                          onChange={(event) =>
                            setKnowledgeSourceDraft((current) => ({
                              ...current,
                              url: event.target.value
                            }))
                          }
                          type="url"
                          value={knowledgeSourceDraft.url}
                        />
                      </label>
                    ) : null}
                    <button onClick={addKnowledgeSource} type="button">
                      Add source to policy draft
                    </button>
                    <button onClick={() => void saveOwnerConfiguration()} type="button">
                      Save owner AI policy
                    </button>
                  </fieldset>
                ) : null}
                {profile?.isOwner ? (
                  <fieldset aria-label="Scheduled Admin AI briefings">
                    <legend>Scheduled briefings and reports</legend>
                    {schedules.length ? (
                      <ul>
                        {schedules.map((schedule) => (
                          <li key={schedule.id}>
                            <span>
                              {schedule.reportType} · {schedule.cadence.frequency} ·{" "}
                              {schedule.enabled
                                ? `next ${schedule.nextRunAt || "pending"}`
                                : "disabled"}{" "}
                              · delivery {schedule.delivery.status}
                            </span>
                            <span>
                              <button
                                aria-label={`Edit ${schedule.reportType} ${schedule.cadence.frequency} schedule`}
                                onClick={() => editSchedule(schedule)}
                                type="button"
                              >
                                Edit
                              </button>
                              {schedule.enabled ? (
                                <button
                                  aria-label={`Disable ${schedule.reportType} ${schedule.cadence.frequency} schedule`}
                                  onClick={() => void disableSchedule(schedule)}
                                  type="button"
                                >
                                  Disable
                                </button>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No scheduled Admin AI reports.</p>
                    )}
                    <label>
                      Report type
                      <select
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            reportType: event.target.value as AdminAIScheduleClient["reportType"]
                          }))
                        }
                        value={scheduleDraft.reportType}
                      >
                        {ADMIN_AI_SCHEDULE_REPORT_TYPES_CLIENT.map((reportType) => (
                          <option key={reportType} value={reportType}>
                            {reportType}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Frequency
                      <select
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            frequency: event.target.value as typeof current.frequency
                          }))
                        }
                        value={scheduleDraft.frequency}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    {scheduleDraft.frequency === "weekly" ? (
                      <label>
                        Weekday
                        <select
                          onChange={(event) =>
                            setScheduleDraft((current) => ({
                              ...current,
                              weekday: event.target.value as typeof current.weekday
                            }))
                          }
                          value={scheduleDraft.weekday}
                        >
                          {SCHEDULE_WEEKDAYS.map((weekday) => (
                            <option key={weekday} value={weekday}>
                              {ownerPolicyLabel(weekday)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {scheduleDraft.frequency === "monthly" ? (
                      <label>
                        Day of month
                        <input
                          max={31}
                          min={1}
                          onChange={(event) =>
                            setScheduleDraft((current) => ({
                              ...current,
                              dayOfMonth: Number(event.target.value)
                            }))
                          }
                          type="number"
                          value={scheduleDraft.dayOfMonth}
                        />
                      </label>
                    ) : null}
                    <label>
                      Local time
                      <input
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            localTime: event.target.value
                          }))
                        }
                        type="time"
                        value={scheduleDraft.localTime}
                      />
                    </label>
                    <label>
                      IANA time zone
                      <input
                        maxLength={80}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            timeZone: event.target.value
                          }))
                        }
                        value={scheduleDraft.timeZone}
                      />
                    </label>
                    <label>
                      Delivery channel
                      <select
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            channel: event.target.value === "email" ? "email" : "in-app"
                          }))
                        }
                        value={scheduleDraft.channel}
                      >
                        <option value="in-app">In-app</option>
                        <option value="email">Email (approved workflow required)</option>
                      </select>
                    </label>
                    {scheduleDraft.channel === "email" ? (
                      <label>
                        Recipient emails
                        <input
                          maxLength={1000}
                          onChange={(event) =>
                            setScheduleDraft((current) => ({
                              ...current,
                              recipientEmails: event.target.value
                            }))
                          }
                          placeholder="owner@example.com"
                          value={scheduleDraft.recipientEmails}
                        />
                      </label>
                    ) : null}
                    <label className={styles.checkboxLabel}>
                      <input
                        checked={scheduleDraft.enabled}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            enabled: event.target.checked
                          }))
                        }
                        type="checkbox"
                      />
                      Enable after save (secure scheduled jobs required)
                    </label>
                    <button onClick={() => void saveSchedule()} type="button">
                      {editingSchedule ? "Update schedule" : "Create schedule"}
                    </button>
                    {editingSchedule ? (
                      <button
                        onClick={() => {
                          setEditingSchedule(null);
                          setScheduleDraft(DEFAULT_SCHEDULE_DRAFT);
                          setScheduleStatus("Schedule edit cancelled; no change was sent.");
                        }}
                        type="button"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                    {scheduleStatus ? <p role="status">{scheduleStatus}</p> : null}
                  </fieldset>
                ) : null}
                {settingsStatus ? <p role="status">{settingsStatus}</p> : null}
              </div>
            ) : null}
          </section>

          {profile?.isOwner ? (
            <details className={styles.observabilityDisclosure} aria-label="Owner AI observability">
              <summary>
                <span>
                  <strong>AI observability</strong>
                  <small>Owner-only usage, reliability, safety, and cost signals</small>
                </span>
                <span aria-hidden="true">Review</span>
              </summary>
              <section className={styles.observabilityPanel}>
                <div>
                  <small>Durable requests</small>
                  <strong>
                    {observabilityDashboard?.usage.requests ?? observationSummary?.requests ?? 0}
                  </strong>
                </div>
                <div>
                  <small>Action success</small>
                  <strong>
                    {observabilityDashboard?.actionSuccess.rate ??
                      observationSummary?.successRate ??
                      0}
                    %
                  </strong>
                </div>
                <div>
                  <small>Blocked</small>
                  <strong>
                    {observabilityDashboard?.failures.blocked ?? observationSummary?.blocked ?? 0}
                  </strong>
                </div>
                <div>
                  <small>Average latency</small>
                  <strong>
                    {observabilityDashboard?.latency.averageMs ??
                      observationSummary?.averageLatencyMs ??
                      0}{" "}
                    ms
                  </strong>
                </div>
                <div>
                  <small>Dangerous actions blocked</small>
                  <strong>{observabilityDashboard?.blockedDangerousActions ?? 0}</strong>
                </div>
                <div>
                  <small>Feedback score</small>
                  <strong>{observabilityDashboard?.feedback.score ?? 0}%</strong>
                </div>
                <div>
                  <small>Pending corrections</small>
                  <strong>{observabilityDashboard?.corrections.pending ?? 0}</strong>
                </div>
                <div>
                  <small>Estimated cost</small>
                  <strong>
                    {formatMicrousd(observabilityDashboard?.cost.estimatedMicrousd ?? 0)}
                  </strong>
                </div>
              </section>
            </details>
          ) : null}

          <section className={styles.activityStream} aria-label="Copilot action audit stream">
            <div className={styles.activityHeader}>
              <strong>Session action stream</strong>
              <button onClick={clearConversation} type="button">
                Clear conversation/context
              </button>
            </div>
            {activity.length ? (
              <ul>
                {activity.slice(0, 6).map((item) => (
                  <li data-status={item.status} key={item.id}>
                    <span>{item.label}</span>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No session actions recorded yet.</p>
            )}
          </section>
        </>
      ) : (
        <div className={styles.drawerLoading} role="status">
          Preparing Admin Copilot workspace.
        </div>
      )}
    </AdminAIDrawer>
  );

  if (!featureFlags.copilot) return null;

  return (
    <aside
      className={styles.dock}
      data-open={open ? "true" : "false"}
      data-state={copilotDisplayState}
    >
      <button
        aria-controls="admin-ai-copilot-dialog"
        aria-expanded={open}
        aria-label={
          open ? `Close ${section.name} Admin Copilot` : `Open ${section.name} Admin Copilot`
        }
        className={styles.pill}
        data-alert={alertCount ? "true" : "false"}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          onOpenChange(!open);
          startTransition(() => onAssistantStateChange(open ? "idle" : "listen"));
        }}
        onFocus={() => {
          void loadAdminAIResponsePanel();
        }}
        onPointerEnter={() => {
          void loadAdminAIResponsePanel();
        }}
        type="button"
      >
        <span className={styles.orb}>{orbContent}</span>
        <span className={styles.pillCopy}>
          <strong>Copilot</strong>
          <small>
            <span className={styles.sectionIcon} data-icon={section.icon} aria-hidden="true" />
            {section.name}
          </small>
        </span>
        <span className={styles.badge} aria-label={`${alertCount} attention signals`}>
          {alertCount || "AI"}
        </span>
      </button>
      {panel && typeof document !== "undefined"
        ? createPortal(
            <AdminV2PortalScope active={open} theme={theme}>
              {panel}
            </AdminV2PortalScope>,
            document.body
          )
        : panel}
    </aside>
  );
}

function scheduleAdminAIIdleWork(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(callback, { timeout: 750 });
    return () => window.cancelIdleCallback(idleId);
  }
  const timeoutId = window.setTimeout(callback, 50);
  return () => window.clearTimeout(timeoutId);
}

function scheduleAdminAIPanelContent(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  let firstFrame = 0;
  let secondFrame = 0;
  let cancelIdleWork: () => void = () => undefined;

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      cancelIdleWork = scheduleAdminAIIdleWork(callback);
    });
  });

  return () => {
    window.cancelAnimationFrame(firstFrame);
    window.cancelAnimationFrame(secondFrame);
    cancelIdleWork();
  };
}

function incidentResponse(
  record: AdminAIPersistedIncidentClient,
  context: AdminAISectionContext
): AdminAIResponse {
  return {
    body: `Durable Incident Mode is active at version ${record.version}. Optional dangerous Admin AI writes remain frozen until explicit owner resolution.`,
    evidence: buildAdminAIIncidentProvenance(record.incident, context),
    incident: record.incident,
    items: ["Review the evidence and recovery checklist before resolving the incident."],
    state: "partial-success",
    title: record.incident.criticalBanner.title
  };
}

function formatScope(scope: AdminAIScope) {
  return SCOPES.find(({ id }) => id === scope)?.label || SCOPES[0].label;
}

function describeCurrentState(context: AdminAISectionContext) {
  const states = context.selectedRows
    .map((recordId) => context.entities.find((entity) => entity.id === recordId))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
    .map((entity) => `${entity.id}: ${entity.status}`);

  return (
    states.join("; ") || "No protected workflow has run; current source data remains unchanged."
  );
}

function describeProposedState(command: AdminAICommand) {
  if (command.id === "error-reports.mark-reviewing")
    return "Selected error report status: Reviewing";
  if (command.kind === "navigate")
    return `Open ${command.destinationView || command.sectionId} for explicit manual review; no mutation in Copilot.`;
  return command.description;
}

function mergeDurablePreferences(
  current: AdminAIPreferences,
  durable: AdminAISettingsCenterClient["preferences"]
): AdminAIPreferences {
  const detailed = durable.responseLength === "detailed";
  return {
    ...current,
    dailyBriefing: durable.dailyBriefingEnabled,
    enabled: durable.aiPillEnabled,
    memoryEnabled: durable.memoryEnabled,
    notificationPreference: durable.notificationPreference,
    preferredLanguage: durable.preferredLanguage.toLowerCase().startsWith("hi") ? "hi" : "en",
    proactiveSuggestions: durable.proactiveSuggestionsEnabled,
    reportFormat: durable.reportFormat === "plain-text" ? "summary" : "operations",
    reportStyle: detailed ? "detailed" : "concise",
    responseLength: detailed ? "detailed" : "concise"
  };
}

function toDurablePreferences(preferences: AdminAIPreferences) {
  return {
    aiPillEnabled: preferences.enabled,
    dailyBriefingEnabled: preferences.dailyBriefing,
    memoryEnabled: preferences.memoryEnabled,
    notificationPreference: preferences.notificationPreference,
    preferredLanguage: preferences.preferredLanguage,
    proactiveSuggestionsEnabled: preferences.proactiveSuggestions,
    reportFormat: preferences.reportFormat === "summary" ? "plain-text" : "markdown",
    responseLength: preferences.responseLength
  };
}

function normalizePolicyUsage(value: AdminAIPolicyUsage | undefined): AdminAIPolicyUsage {
  return {
    dailyRequestsPerAdmin: nonNegativeInteger(value?.dailyRequestsPerAdmin),
    monthlyRequestsGlobal: nonNegativeInteger(value?.monthlyRequestsGlobal)
  };
}

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function ownerConfigMutation(ownerConfig: AdminAIOwnerConfigClient) {
  return {
    actionPermissions: ownerConfig.actionPermissions,
    approvedKnowledgeSources: ownerConfig.approvedKnowledgeSources,
    auditConfiguration: ownerConfig.auditConfiguration,
    featureAvailability: ownerConfig.featureAvailability,
    modelRouting: ownerConfig.modelRouting,
    retentionPeriodDays: ownerConfig.retentionPeriodDays,
    usageLimits: ownerConfig.usageLimits
  };
}

function durableArtifactKind(type: string): AdminAIDurableArtifactKind {
  if (type === "health-report" || type === "performance-summary") {
    return "coach-performance-summary";
  }
  if (type === "publish-readiness") return "publish-readiness-review";
  if (
    type === "action-plan" ||
    type === "checklist" ||
    type === "configuration-comparison" ||
    type === "error-investigation" ||
    type === "incident-summary" ||
    type === "report"
  ) {
    return type;
  }
  return "report";
}

function durableArtifactScope(scope: AdminAIScope) {
  if (scope === "global") return "global" as const;
  if (scope === "selection") return "selection" as const;
  return "section" as const;
}

function safeArtifactIdentifier<T extends string | null>(value: string, fallback: T): string | T {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._:/-]+/g, "-")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .slice(0, 120);
  return normalized || fallback;
}

function ownerPolicyLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function formatMicrousd(value: number) {
  return `$${(Math.max(0, value) / 1_000_000).toFixed(4)}`;
}

function getAdminAIBoundaryKey(profile?: AdminV2AccessProfileClient | null) {
  if (!profile?.email) return "";
  return hashAdminAIText(
    [
      profile.email.toLowerCase(),
      profile.isOwner ? "owner" : profile.roleKey || profile.role || "admin",
      ...(profile.permissions || [])
    ]
      .sort()
      .join("|")
  );
}

function hashAdminAIText(value: string) {
  let forward = 2166136261;
  let reverse = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    forward = Math.imul(forward ^ value.charCodeAt(index), 16777619);
    reverse = Math.imul(reverse ^ value.charCodeAt(value.length - index - 1), 16777619);
  }
  return `${(forward >>> 0).toString(36)}-${(reverse >>> 0).toString(36)}`;
}

function getAdminAISessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function persistAdminAILongTask(
  storage: Pick<Storage, "removeItem" | "setItem"> | null,
  snapshot: PersistedAdminAILongTask
) {
  if (!storage) return;
  try {
    const serialized = JSON.stringify(snapshot);
    if (new TextEncoder().encode(serialized).byteLength > ADMIN_AI_SESSION_TASK_MAX_BYTES) {
      clearPersistedAdminAILongTask(storage);
      return;
    }
    storage.setItem(ADMIN_AI_SESSION_TASK_KEY, serialized);
  } catch {
    clearPersistedAdminAILongTask(storage);
  }
}

function loadAdminAILongTask(
  storage: Pick<Storage, "getItem" | "removeItem"> | null,
  boundaryKey: string,
  now: number
): PersistedAdminAILongTask | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(ADMIN_AI_SESSION_TASK_KEY);
    if (
      !serialized ||
      new TextEncoder().encode(serialized).byteLength > ADMIN_AI_SESSION_TASK_MAX_BYTES
    ) {
      if (serialized) clearPersistedAdminAILongTask(storage);
      return null;
    }
    const snapshot = JSON.parse(serialized) as Partial<PersistedAdminAILongTask>;
    if (
      snapshot.version !== 1 ||
      snapshot.boundaryKey !== boundaryKey ||
      typeof snapshot.expiresAt !== "number" ||
      snapshot.expiresAt <= now ||
      typeof snapshot.startedAt !== "number" ||
      snapshot.startedAt > now ||
      typeof snapshot.requestFingerprint !== "string" ||
      snapshot.requestFingerprint.length < 3 ||
      snapshot.requestFingerprint.length > 128
    ) {
      clearPersistedAdminAILongTask(storage);
      return null;
    }
    return snapshot as PersistedAdminAILongTask;
  } catch {
    clearPersistedAdminAILongTask(storage);
    return null;
  }
}

function clearPersistedAdminAILongTask(storage: Pick<Storage, "removeItem"> | null) {
  if (!storage) return;
  try {
    storage.removeItem(ADMIN_AI_SESSION_TASK_KEY);
  } catch {
    // Session storage may be unavailable; the in-memory task boundary is still cleared.
  }
}

function persistAdminAIResponse(
  storage: Pick<Storage, "removeItem" | "setItem"> | null,
  boundaryKey: string,
  response: AdminAIResponse,
  now: number
) {
  if (!storage) return;
  try {
    const safeResponse = createSafePersistedAdminAIResponse(response);
    if (!safeResponse) {
      storage.removeItem(ADMIN_AI_SESSION_RESPONSE_KEY);
      return;
    }
    const serialized = JSON.stringify({
      boundaryKey,
      expiresAt: now + ADMIN_AI_SESSION_RESPONSE_TTL_MS,
      response: safeResponse,
      version: 1
    });
    if (new TextEncoder().encode(serialized).byteLength > ADMIN_AI_SESSION_RESPONSE_MAX_BYTES) {
      storage.removeItem(ADMIN_AI_SESSION_RESPONSE_KEY);
      return;
    }
    storage.setItem(ADMIN_AI_SESSION_RESPONSE_KEY, serialized);
  } catch {
    clearPersistedAdminAIResponse(storage);
  }
}

function loadPersistedAdminAIResponse(
  storage: Pick<Storage, "getItem" | "removeItem"> | null,
  boundaryKey: string,
  now: number
) {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(ADMIN_AI_SESSION_RESPONSE_KEY);
    if (
      !serialized ||
      new TextEncoder().encode(serialized).byteLength > ADMIN_AI_SESSION_RESPONSE_MAX_BYTES
    ) {
      if (serialized) storage.removeItem(ADMIN_AI_SESSION_RESPONSE_KEY);
      return null;
    }
    const snapshot = JSON.parse(serialized) as {
      boundaryKey?: unknown;
      expiresAt?: unknown;
      response?: unknown;
      version?: unknown;
    };
    if (
      snapshot.version !== 1 ||
      snapshot.boundaryKey !== boundaryKey ||
      typeof snapshot.expiresAt !== "number" ||
      snapshot.expiresAt <= now ||
      !isPersistedAdminAIResponse(snapshot.response)
    ) {
      storage.removeItem(ADMIN_AI_SESSION_RESPONSE_KEY);
      return null;
    }
    return snapshot.response;
  } catch {
    clearPersistedAdminAIResponse(storage);
    return null;
  }
}

function clearPersistedAdminAIResponse(storage: Pick<Storage, "removeItem"> | null) {
  if (!storage) return;
  try {
    storage.removeItem(ADMIN_AI_SESSION_RESPONSE_KEY);
  } catch {
    // Session storage can be unavailable in hardened browsers; local UI clearing still continues.
  }
}

function createSafePersistedAdminAIResponse(response: AdminAIResponse) {
  if (!ADMIN_AI_PERSISTED_RESPONSE_STATES.has(response.state)) return null;
  const safe = redactAdminAIValue({ ...response });
  delete safe.approvalReceipt;
  delete safe.artifact;
  delete safe.plan;
  delete safe.rollbackAction;
  safe.body = safe.body.slice(0, 24_000);
  safe.items = safe.items.slice(0, 80).map((item) => item.slice(0, 1_000));
  return safe;
}

function isPersistedAdminAIResponse(value: unknown): value is AdminAIResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Partial<AdminAIResponse>;
  return (
    typeof response.body === "string" &&
    response.body.length <= 24_000 &&
    typeof response.title === "string" &&
    response.title.length <= 500 &&
    typeof response.state === "string" &&
    ADMIN_AI_PERSISTED_RESPONSE_STATES.has(response.state as AdminAIResponse["state"]) &&
    Array.isArray(response.items) &&
    response.items.length <= 80 &&
    response.items.every((item) => typeof item === "string" && item.length <= 1_000) &&
    !response.plan &&
    !response.approvalReceipt &&
    !response.artifact &&
    !response.rollbackAction
  );
}

function formatCopilotState(value: string) {
  const labels: Record<string, string> = {
    analyzing: "Thinking",
    "contextual-suggestion": "Contextual suggestion available",
    executing: "Executing",
    idle: "Idle",
    listening: "Listening",
    "preparing-plan": "Preparing plan",
    "retrieving-data": "Retrieving data",
    "urgent-alert": "Urgent alert",
    "verifying-result": "Verifying result",
    "waiting-approval": "Waiting for approval"
  };
  return labels[value] || value.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
