import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type {
  AdminV2AccessProfileClient,
  AdminV2ActionActivity,
  AdminV2ActionActivityInput,
  AdminV2ViewId,
} from "../../../lib/admin-v2-access";
import {
  auditAdminAIAction,
  type AdminAIActionAuditResult,
  executeRegisteredAdminAIAction,
} from "../../../lib/admin-ai/adminAIActions";
import {
  scopeAdminAIContext,
  type AdminAISectionContext,
} from "../../../lib/admin-ai/adminAIContext";
import {
  clearAdminAIFeedback,
  loadAdminAIFeedback,
  saveAdminAIFeedback,
  type AdminAIFeedbackRecord,
} from "../../../lib/admin-ai/adminAIFeedback";
import { getAdminAIFeatureFlags } from "../../../lib/admin-ai/adminAIFeatureFlags";
import {
  clearAdminAIPreferences,
  DEFAULT_ADMIN_AI_PREFERENCES,
  loadAdminAIPreferences,
  saveAdminAIPreferences,
  type AdminAIPreferences,
} from "../../../lib/admin-ai/adminAIMemory";
import {
  createAdminAIObservation,
  summarizeAdminAIObservations,
  type AdminAIObservation,
} from "../../../lib/admin-ai/adminAIObservability";
import {
  runAdminAINaturalLanguageQuery,
  simulateAdminAIPlan,
} from "../../../lib/admin-ai/adminAIOrchestrator";
import { getAllowedAdminAICommands } from "../../../lib/admin-ai/adminAIPermissions";
import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import {
  getAdminAICommand,
  getAdminAISection,
  globalAdminAICommands,
} from "../../../lib/admin-ai/adminAIRegistry";
import { requiresAdminAIConfirmation } from "../../../lib/admin-ai/adminAISafety";
import {
  runAdminAICommand,
  type AdminAIResponse,
} from "../../../lib/admin-ai/adminAIService";
import type {
  AdminAIFeedbackKind,
  AdminAIRollbackAction,
  AdminAIScope,
} from "../../../lib/admin-ai/adminAITypes";
import {
  ADMIN_AI_ASK_EVENT,
  type AdminAIAskEventDetail,
} from "../../../lib/admin-ai/adminAIEvents";
import { AdminAIActionConfirm } from "./AdminAIActionConfirm";
import { AdminAICommandList } from "./AdminAICommandList";
import { AdminAIResponsePanel } from "./AdminAIResponsePanel";
import styles from "./admin-ai.module.css";

const LazyAdminAIDrawer = lazy(() =>
  import("./AdminAIDrawer").then((module) => ({ default: module.AdminAIDrawer }))
);

const SCOPES: Array<{ id: AdminAIScope; label: string }> = [
  { id: "page", label: "This Page" },
  { id: "selection", label: "Selected Records" },
  { id: "module", label: "Current Module" },
  { id: "global", label: "Entire Admin Panel" },
];

const FEEDBACK: Array<{ id: AdminAIFeedbackKind; label: string }> = [
  { id: "helpful", label: "Helpful" },
  { id: "not-helpful", label: "Not helpful" },
  { id: "incorrect-data", label: "Incorrect data" },
  { id: "unsafe-suggestion", label: "Unsafe suggestion" },
  { id: "missing-context", label: "Missing context" },
];

export type AdminAIExternalCommandHandler = (
  command: AdminAICommand,
  context: AdminAISectionContext
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
  theme,
}: {
  activity: AdminV2ActionActivity[];
  assistantState: string;
  context: AdminAISectionContext;
  csrfToken: string;
  onActivity: (activity: AdminV2ActionActivityInput) => void;
  onAssistantStateChange: (state: "confused" | "focus" | "hover" | "idle" | "listen" | "success" | "thinking" | "warning", resetMs?: number) => void;
  onExternalCommand?: AdminAIExternalCommandHandler;
  onNavigate: (view: AdminV2ViewId) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  orbContent: ReactNode;
  profile?: AdminV2AccessProfileClient | null;
  theme: "dark" | "light";
}) {
  const section = getAdminAISection(context.sectionId);
  const featureFlags = useMemo(() => getAdminAIFeatureFlags(), []);
  const [scope, setScope] = useState<AdminAIScope>("page");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const effectiveContext = useMemo(
    () => scopeAdminAIContext(context, scope, selectedEntityIds),
    [context, scope, selectedEntityIds]
  );
  const sectionCommands = useMemo(
    () => getAllowedAdminAICommands(profile, section.commands),
    [profile, section.commands]
  );
  const globalCommands = useMemo(
    () => getAllowedAdminAICommands(profile, globalAdminAICommands),
    [profile]
  );
  const commands = scope === "global" && featureFlags.globalMode ? globalCommands : sectionCommands;
  const [busy, setBusy] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<AdminAICommand | null>(null);
  const [preferences, setPreferences] = useState<AdminAIPreferences>(() =>
    typeof window === "undefined"
      ? DEFAULT_ADMIN_AI_PREFERENCES
      : loadAdminAIPreferences(window.localStorage)
  );
  const [response, setResponse] = useState<AdminAIResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [contextTrail, setContextTrail] = useState<string[]>([context.sectionName]);
  const [feedback, setFeedback] = useState<AdminAIFeedbackRecord[]>(() =>
    typeof window === "undefined" ? [] : loadAdminAIFeedback(window.localStorage)
  );
  const [observations, setObservations] = useState<AdminAIObservation[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const auditQueueRef = useRef<Promise<AdminAIActionAuditResult>>(
    Promise.resolve({ ok: true, requestId: "" })
  );
  const operationRef = useRef(0);
  const queryTimesRef = useRef<number[]>([]);
  const queryRef = useRef<HTMLInputElement>(null);
  const previousBoundaryRef = useRef("");
  const previousSectionRef = useRef(context.sectionId);
  const permittedSectionChangeRef = useRef(false);
  const alertCount = featureFlags.proactiveAlerts && preferences.proactiveSuggestions
    ? effectiveContext.warnings.length + effectiveContext.errors.length
    : 0;
  const observationSummary = useMemo(
    () => summarizeAdminAIObservations(observations),
    [observations]
  );

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
    operationRef.current += 1;
    const frame = window.requestAnimationFrame(() => {
      setPendingCommand(null);
      if (busy) {
        setBusy(false);
        setResponse({
          body: "The previous page operation was cancelled because the admin context changed. No stale result or mutation was applied.",
          items: [],
          state: "cancelled",
          title: "Context changed",
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, context.sectionId]);

  useEffect(() => {
    const boundary = [profile?.email || "", profile?.isOwner ? "owner" : profile?.roleKey || profile?.role || "", ...(profile?.permissions || [])]
      .sort()
      .join("|");
    if (previousBoundaryRef.current && previousBoundaryRef.current !== boundary) {
      operationRef.current += 1;
      setBusy(false);
      setPendingCommand(null);
      setQuery("");
      setResponse(null);
      setContextTrail([context.sectionName]);
      setSelectedEntityIds([]);
    }
    previousBoundaryRef.current = boundary;
  }, [context.sectionName, profile]);

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
      onOpenChange(true);
      onAssistantStateChange("listen");
      window.setTimeout(() => queryRef.current?.focus(), 0);
    }
    window.addEventListener(ADMIN_AI_ASK_EVENT, openContextualAsk);
    return () => window.removeEventListener(ADMIN_AI_ASK_EVENT, openContextualAsk);
  }, [onAssistantStateChange, onOpenChange]);

  const close = useCallback(() => {
    if (busy) return;
    setPendingCommand(null);
    onOpenChange(false);
    onAssistantStateChange("idle");
  }, [busy, onAssistantStateChange, onOpenChange]);

  function updatePreferences(next: AdminAIPreferences) {
    setPreferences(next);
    saveAdminAIPreferences(window.localStorage, next);
  }

  function logAudit(
    command: AdminAICommand,
    phase: "completed" | "confirmed" | "denied" | "failed" | "requested",
    confirmationResult: "accepted" | "declined" | "not-required"
  ) {
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
          sectionId: command.sectionId,
        },
        { csrfToken }
      ).catch(() => ({ ok: false, requestId: "" }))
    );
    auditQueueRef.current = queuedWrite;
    return queuedWrite;
  }

  async function execute(command: AdminAICommand, confirmed: boolean) {
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    const startedAt = performance.now();
    setBusy(true);
    setPendingCommand(null);
    setSelectedId(command.id);
    setResponse({
      body: "Reading compact section context and registered sources.",
      items: [],
      progress: [
        { id: "context", label: "Reading permission-filtered context", status: "working" },
        { id: "command", label: "Running registered command", status: "pending" },
        { id: "verify", label: "Verifying result", status: "pending" },
      ],
      state: "retrieving-data",
      title: command.label,
    });
    onAssistantStateChange("thinking");
    onActivity({ detail: `${command.label} started in ${context.sectionName}.`, label: "Admin Copilot", status: "working" });
    if (confirmed) await logAudit(command, "confirmed", "accepted");

    try {
      const nextResponse =
        command.kind === "external" && onExternalCommand
          ? await onExternalCommand(command, context)
          : command.kind === "registered-action"
            ? await executeRegisteredAdminAIAction(command, effectiveContext, { csrfToken })
          : runAdminAICommand(command, context, preferences);
      if (operationRef.current !== operationId) return;
      if (command.kind === "navigate" && command.destinationView) {
        permittedSectionChangeRef.current = true;
        onNavigate(command.destinationView);
      }
      const failed = ["action-failed", "blocked-missing-data", "insufficient-permission", "offline-error"].includes(nextResponse.state);
      const auditResult = await logAudit(
        command,
        failed ? "failed" : "completed",
        confirmed ? "accepted" : "not-required"
      );
      if (operationRef.current !== operationId) return;
      const responseWithReceipt = auditResult.requestId
        ? {
            ...nextResponse,
            approvalReceipt: {
              action: command.label,
              affectedRecords: effectiveContext.selectedRows.slice(0, 12),
              approvalLevel: command.approvalLevel,
              auditReference: auditResult.requestId,
              confirmationTimestamp: new Date().toISOString(),
              currentState: describeCurrentState(effectiveContext),
              impact: command.description,
              outcome: nextResponse.title,
              otpRequired: Boolean(command.otpRequired),
              permissionCheck: command.requiredPermissions?.join(", ") || "Authenticated admin",
              proposedState: describeProposedState(command),
              recordsChanged:
                command.kind === "registered-action" && nextResponse.state === "action-complete"
                  ? effectiveContext.selectedRows.length
                  : 0,
              requestedBy: profile?.email || "Authenticated admin",
              reversible: command.rollback === "available-after-persist",
            },
          }
        : nextResponse;
      setResponse(responseWithReceipt);
      onAssistantStateChange(failed ? "confused" : "success", 2400);
      onActivity({
        detail: failed
          ? `${command.label} stopped safely without changing unauthorized data.`
          : `${command.label} completed without bypassing protected actions.`,
        label: "Admin Copilot",
        status: failed ? "error" : "success",
      });
      setObservations((current) => [
        createAdminAIObservation({
          command: command.id,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          model: nextResponse.modelRoute?.mode || "deterministic",
          module: context.sectionId,
          outcome: failed ? "failed" : "success",
          safetyRefusal: false,
        }),
        ...current,
      ].slice(0, 80));
    } catch {
      if (operationRef.current !== operationId) return;
      setResponse({
        body: "The registered command failed safely. No data was changed.",
        items: [],
        state: "offline-error",
        title: "Copilot command unavailable",
      });
      onAssistantStateChange("confused", 3200);
      onActivity({ detail: `${command.label} failed safely; no data changed.`, label: "Admin Copilot", status: "error" });
      void logAudit(command, "failed", confirmed ? "accepted" : "not-required");
      setObservations((current) => [
        createAdminAIObservation({
          command: command.id,
          latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
          model: "deterministic",
          module: context.sectionId,
          outcome: "failed",
          safetyRefusal: false,
        }),
        ...current,
      ].slice(0, 80));
    } finally {
      if (operationRef.current === operationId) setBusy(false);
    }
  }

  function selectCommand(command: AdminAICommand) {
    if (!preferences.enabled) {
      setResponse({
        body: "Enable Admin Copilot in settings before running commands. Core admin actions remain available manually.",
        items: [],
        state: "offline-error",
        title: "Admin Copilot is disabled",
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
        state: "confirmation-required",
        title: command.label,
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
      title: "Action cancelled",
    });
    onAssistantStateChange("idle");
  }

  async function submitQuery(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const request = query.trim();
    if (!request || busy) return;
    if (!preferences.enabled) {
      setResponse({
        body: "Enable Admin Copilot in settings before running a request. Core admin actions remain available manually.",
        items: [],
        state: "offline-error",
        title: "Admin Copilot is disabled",
      });
      return;
    }
    const now = Date.now();
    queryTimesRef.current = queryTimesRef.current.filter((timestamp) => now - timestamp < 60_000);
    if (queryTimesRef.current.length >= 20) {
      setResponse({
        body: "The session limit is 20 Copilot queries per minute. Wait briefly and retry; core admin actions remain available.",
        items: [],
        state: "action-failed",
        title: "Copilot rate limit reached",
      });
      return;
    }
    queryTimesRef.current.push(now);
    const operationId = operationRef.current + 1;
    operationRef.current = operationId;
    const startedAt = performance.now();
    setBusy(true);
    setPendingCommand(null);
    setSelectedId("");
    setResponse({
      body: "Applying scope, RBAC, source, and registered-action boundaries.",
      items: [],
      progress: [
        { id: "scope", label: "Applying scope and permissions", status: "working" },
        { id: "retrieve", label: "Retrieving bounded evidence", status: "pending" },
        { id: "answer", label: "Preparing grounded result", status: "pending" },
      ],
      state: "analyzing",
      title: "Analyzing admin request",
    });
    onAssistantStateChange("thinking");
    await Promise.resolve();
    if (operationRef.current !== operationId) return;
    const next = runAdminAINaturalLanguageQuery({
      context: effectiveContext,
      featureFlags,
      preferences,
      query: request,
      scope,
    });
    setResponse(next);
    setBusy(false);
    const blocked = next.state === "insufficient-permission";
    setObservations((current) => [
      createAdminAIObservation({
        command: "natural-language",
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        model: next.modelRoute?.mode || "deterministic",
        module: scope === "global" ? "global" : context.sectionId,
        outcome: blocked ? "blocked" : "success",
        safetyRefusal: blocked && /safety/i.test(next.title),
      }),
      ...current,
    ].slice(0, 80));
    onAssistantStateChange(blocked ? "warning" : "success", 2400);
    onActivity({
      detail: blocked ? "A natural-language request was blocked by safety policy." : `Grounded ${formatScope(scope)} request completed.`,
      label: "Admin Copilot",
      status: blocked ? "error" : "success",
    });
  }

  function cancelOperation() {
    operationRef.current += 1;
    setBusy(false);
    setPendingCommand(null);
    setResponse({
      body: "The active Copilot operation was cancelled. Partial output was not treated as complete and no data changed.",
      items: [],
      state: "cancelled",
      title: "Operation cancelled",
    });
    setObservations((current) => [
      createAdminAIObservation({
        command: selectedId || "natural-language",
        latencyMs: 0,
        model: "deterministic",
        module: context.sectionId,
        outcome: "cancelled",
        safetyRefusal: false,
      }),
      ...current,
    ].slice(0, 80));
    onAssistantStateChange("idle");
  }

  function runDryTest() {
    if (!response?.plan) return;
    setResponse({ ...response, plan: simulateAdminAIPlan(response.plan), state: "action-prepared" });
  }

  function approvePlan() {
    const actionId = response?.plan?.steps.find((step) => step.actionId)?.actionId;
    const command = actionId ? getAdminAICommand(actionId) : null;
    if (command && response?.plan?.executable) {
      selectCommand(command);
      return;
    }
    setResponse((current) => current ? {
      ...current,
      body: "This plan has no registered executable handler. It remains a reviewable artifact and no data changed.",
      state: "action-prepared",
    } : current);
  }

  async function executeRollback(action: AdminAIRollbackAction) {
    const command = getAdminAICommand(action.actionId);
    if (!command || busy) return;
    setBusy(true);
    onAssistantStateChange("thinking");
    await logAudit(command, "requested", "not-required");
    await logAudit(command, "confirmed", "accepted");
    const next = await executeRegisteredAdminAIAction(
      command,
      { ...effectiveContext, selectedRows: [action.recordId] },
      { csrfToken, targetStatus: action.targetStatus }
    ).catch(() => ({
      body: "The rollback request failed safely. No rollback success is claimed.",
      items: [],
      state: "action-failed" as const,
      title: "Rollback failed",
    }));
    const failed = next.state === "action-failed" || next.state === "insufficient-permission";
    const auditResult = await logAudit(command, failed ? "failed" : "completed", "accepted");
    setResponse({
      ...next,
      approvalReceipt: auditResult.requestId
        ? {
            action: action.label,
            affectedRecords: [action.recordId],
            approvalLevel: 2,
            auditReference: auditResult.requestId,
            confirmationTimestamp: new Date().toISOString(),
            currentState: "Persisted status before the explicit rollback request.",
            impact: `Restore the selected report status to ${action.targetStatus}.`,
            outcome: next.title,
            otpRequired: false,
            permissionCheck: command.requiredPermissions?.join(", ") || "Authenticated admin",
            proposedState: `Status: ${action.targetStatus}`,
            recordsChanged: failed ? 0 : 1,
            requestedBy: profile?.email || "Authenticated admin",
            reversible: false,
          }
        : undefined,
    });
    setBusy(false);
    onAssistantStateChange(failed ? "confused" : "success", 2400);
    onActivity({
      detail: failed ? "Copilot rollback failed safely." : `${action.label} completed through the protected API.`,
      label: "Admin Copilot",
      status: failed ? "error" : "success",
    });
  }

  function editPlan() {
    if (!response?.plan) return;
    setQuery(response.plan.request);
    window.setTimeout(() => queryRef.current?.focus(), 0);
  }

  function clearConversation() {
    operationRef.current += 1;
    setBusy(false);
    setPendingCommand(null);
    setQuery("");
    setResponse(null);
    setSelectedId("");
    setContextTrail([context.sectionName]);
    setSelectedEntityIds([]);
    onAssistantStateChange("idle");
  }

  function recordFeedback(kind: AdminAIFeedbackKind) {
    const record: AdminAIFeedbackRecord = {
      commandId: selectedId || "natural-language",
      kind,
      sectionId: context.sectionId,
      timestamp: new Date().toISOString(),
    };
    const next = [record, ...feedback].slice(0, 80);
    setFeedback(next);
    saveAdminAIFeedback(window.localStorage, next);
    setFeedbackStatus("Feedback recorded without storing the response or source data.");
  }

  function clearSafeMemory() {
    clearConversation();
    clearAdminAIPreferences(window.localStorage);
    clearAdminAIFeedback(window.localStorage);
    setPreferences(DEFAULT_ADMIN_AI_PREFERENCES);
    setFeedback([]);
    setObservations([]);
    setFeedbackStatus("Safe preferences, feedback, and session context cleared.");
  }

  const panel = open ? (
    <Suspense fallback={<div className={styles.drawerLoading} role="status">Loading Admin Copilot.</div>}>
      <LazyAdminAIDrawer
        onClose={close}
        sectionName={scope === "global" ? "Global Admin" : section.name}
        stateLabel={`${context.dataFreshness} / ${assistantState}`}
        theme={theme}
      >
        <section className={styles.scopePanel} aria-label="Copilot scope">
          <div>
            <small>Operating scope</small>
            <strong>{formatScope(scope)}</strong>
            <span>{effectiveContext.selectedRows.length} selected / {context.entities.length} indexed records</span>
          </div>
          <div className={styles.scopeTabs} role="tablist" aria-label="Admin Copilot scope">
            {SCOPES.map((item) => {
              const disabled = (item.id === "global" && !featureFlags.globalMode) || (item.id === "selection" && !effectiveContext.selectedRows.length);
              return (
                <button
                  aria-selected={scope === item.id}
                  disabled={disabled}
                  key={item.id}
                  onClick={() => setScope(item.id)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p>Context path: {contextTrail.join(" -> ")}</p>
        </section>

        <form className={styles.commandCenter} onSubmit={(event) => void submitQuery(event)}>
          <label htmlFor="admin-ai-command-input">Ask, search, investigate, report, or prepare an action</label>
          <div>
            <input
              autoComplete="off"
              id="admin-ai-command-input"
              maxLength={500}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What requires my attention today?"
              ref={queryRef}
              value={query}
            />
            <button disabled={busy || !query.trim()} type="submit">Run</button>
            {busy ? <button onClick={cancelOperation} type="button">Cancel</button> : null}
          </div>
          <small>Strict schema, bounded context, registered actions, and RBAC. No arbitrary SQL or tool calls.</small>
        </form>

        <section className={styles.contextSummary} aria-label="Current section context">
          <div>
            <small>Current section</small>
            <strong>{context.sectionName}</strong>
            <span>{context.dateRange}</span>
          </div>
          <div>
            <small>Permission boundary</small>
            <strong>{context.userRole}</strong>
            <span>{commands.length} allowed commands</span>
          </div>
          <div>
            <small>Source state</small>
            <strong>{effectiveContext.loadingState ? "Loading" : effectiveContext.errors.length ? "Unavailable source" : "Ready"}</strong>
            <span>{effectiveContext.relatedAPIs.length} registered sources</span>
          </div>
        </section>

        {alertCount ? (
          <section className={styles.alertStrip} aria-label="Real data alerts">
            <strong>{alertCount} current attention signal{alertCount === 1 ? "" : "s"}</strong>
            <p>{effectiveContext.errors[0] || effectiveContext.warnings[0]}</p>
          </section>
        ) : null}

        <AdminAICommandList
          busy={busy}
          commands={commands}
          onSelect={selectCommand}
          selectedId={selectedId}
        />

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

        <AdminAIResponsePanel
          onApprovePlan={approvePlan}
          onCancelPlan={() => setResponse(null)}
          onDeleteArtifact={() => setResponse((current) => current ? { ...current, artifact: undefined } : current)}
          onDryRun={runDryTest}
          onEditPlan={editPlan}
          onRegenerate={() => void submitQuery()}
          onRollback={(action) => void executeRollback(action)}
          onToggleSearchResult={(id) => setSelectedEntityIds((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 40)
          )}
          response={response}
          selectedSearchResultIds={selectedEntityIds}
        />

        {response && !busy ? (
          <section className={styles.feedbackPanel} aria-label="Copilot response feedback">
            <strong>Evaluate this response</strong>
            <div>
              {FEEDBACK.map((item) => (
                <button key={item.id} onClick={() => recordFeedback(item.id)} type="button">{item.label}</button>
              ))}
            </div>
            {feedbackStatus ? <p role="status">{feedbackStatus}</p> : null}
          </section>
        ) : null}

        <section className={styles.settingsPanel} aria-label="Admin Copilot settings">
          <button aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)} type="button">
            <span><strong>AI settings and privacy</strong><small>Preferences only; no secrets or record content.</small></span>
            <span>{settingsOpen ? "Hide" : "Open"}</span>
          </button>
          {settingsOpen ? (
            <div className={styles.settingsGrid}>
              <label>
                Response length
                <select
                  onChange={(event) => updatePreferences({ ...preferences, reportStyle: event.target.value === "detailed" ? "detailed" : "concise", responseLength: event.target.value === "detailed" ? "detailed" : "concise" })}
                  value={preferences.responseLength}
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
              <label>
                Preferred language
                <select
                  onChange={(event) => updatePreferences({ ...preferences, preferredLanguage: event.target.value === "hi" ? "hi" : "en" })}
                  value={preferences.preferredLanguage}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi / Hinglish</option>
                </select>
              </label>
              <label>
                Report format
                <select
                  onChange={(event) => updatePreferences({ ...preferences, reportFormat: event.target.value === "summary" ? "summary" : "operations" })}
                  value={preferences.reportFormat}
                >
                  <option value="operations">Operations report</option>
                  <option value="summary">Short summary</option>
                </select>
              </label>
              <label className={styles.checkboxLabel}>
                <input checked={preferences.enabled} onChange={(event) => updatePreferences({ ...preferences, enabled: event.target.checked })} type="checkbox" />
                Enable Admin Copilot commands
              </label>
              <label className={styles.checkboxLabel}>
                <input checked={preferences.proactiveSuggestions} onChange={(event) => updatePreferences({ ...preferences, proactiveSuggestions: event.target.checked })} type="checkbox" />
                Proactive evidence-backed alerts
              </label>
              <label className={styles.checkboxLabel}>
                <input checked={preferences.dailyBriefing} onChange={(event) => updatePreferences({ ...preferences, dailyBriefing: event.target.checked })} type="checkbox" />
                Daily briefing preference
              </label>
              <label className={styles.checkboxLabel}>
                <input checked={preferences.memoryEnabled && featureFlags.memory} disabled={!featureFlags.memory} onChange={(event) => updatePreferences({ ...preferences, memoryEnabled: event.target.checked })} type="checkbox" />
                Safe preference memory
              </label>
              <label className={styles.checkboxLabel}>
                <input checked={preferences.includeActionItems} onChange={(event) => updatePreferences({ ...preferences, includeActionItems: event.target.checked })} type="checkbox" />
                Include action items
              </label>
              <button onClick={clearSafeMemory} type="button">Clear safe memory</button>
              <div className={styles.flagGrid} aria-label="Admin AI feature flags">
                {Object.entries(featureFlags).map(([key, value]) => (
                  <span data-enabled={value ? "true" : "false"} key={key}>{key}: {value ? "on" : "off"}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {profile?.isOwner ? (
          <section className={styles.observabilityPanel} aria-label="Owner AI observability">
            <div><small>Session requests</small><strong>{observationSummary.requests}</strong></div>
            <div><small>Success rate</small><strong>{observationSummary.successRate}%</strong></div>
            <div><small>Blocked</small><strong>{observationSummary.blocked}</strong></div>
            <div><small>Average latency</small><strong>{observationSummary.averageLatencyMs} ms</strong></div>
          </section>
        ) : null}

        <section className={styles.activityStream} aria-label="Copilot action audit stream">
          <div className={styles.activityHeader}>
            <strong>Session action stream</strong>
            <button onClick={clearConversation} type="button">Clear conversation/context</button>
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
      </LazyAdminAIDrawer>
    </Suspense>
  ) : null;

  if (!featureFlags.copilot) return null;

  return (
    <aside className={styles.dock} data-open={open ? "true" : "false"}>
      <button
        aria-expanded={open}
        aria-label={open ? `Close ${section.name} Admin Copilot` : `Open ${section.name} Admin Copilot`}
        className={styles.pill}
        data-alert={alertCount ? "true" : "false"}
        onClick={() => {
          onOpenChange(!open);
          onAssistantStateChange(open ? "idle" : "listen");
        }}
        type="button"
      >
        <span className={styles.orb}>{orbContent}</span>
        <span className={styles.pillCopy}>
          <strong>Copilot</strong>
          <small>{section.name}</small>
        </span>
        <span className={styles.badge} aria-label={`${alertCount} attention signals`}>
          {alertCount || "AI"}
        </span>
      </button>
      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : panel}
    </aside>
  );
}

function formatScope(scope: AdminAIScope) {
  if (scope === "global") return "Entire Admin Panel";
  if (scope === "module") return "Current Module";
  if (scope === "selection") return "Selected Records";
  return "This Page";
}

function describeCurrentState(context: AdminAISectionContext) {
  const states = context.selectedRows
    .map((recordId) => context.entities.find((entity) => entity.id === recordId))
    .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity))
    .map((entity) => `${entity.id}: ${entity.status}`);

  return states.join("; ") || "No protected workflow has run; current source data remains unchanged.";
}

function describeProposedState(command: AdminAICommand) {
  if (command.id === "error-reports.mark-reviewing") return "Selected error report status: Reviewing";
  if (command.kind === "navigate") return `Open ${command.destinationView || command.sectionId} for explicit manual review; no mutation in Copilot.`;
  return command.description;
}
