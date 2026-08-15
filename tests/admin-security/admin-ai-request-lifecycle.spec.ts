import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const pillSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-ai/AdminAIPill.tsx"),
  "utf8"
);
const shellSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-v2-shell.tsx"),
  "utf8"
);
const actionConfirmSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-ai/AdminAIActionConfirm.tsx"),
  "utf8"
);
const drawerSource = readFileSync(
  resolve(process.cwd(), "components/admin/admin-ai/AdminAIDrawer.tsx"),
  "utf8"
);
const copilotStyles = readFileSync(
  resolve(process.cwd(), "components/admin/admin-ai/admin-ai.module.css"),
  "utf8"
);

test("propagates a real AbortSignal and cancels stale read requests", () => {
  expect(pillSource).toContain("new AbortController()");
  expect(pillSource).toContain("operationAbortRef.current?.abort()");
  expect(pillSource).toContain("signal: controller.signal");
  expect(shellSource).toMatch(/generateFloatingAiInsight\([^)]*signal\??:\s*AbortSignal/);
  expect(shellSource).toMatch(
    /fetch\("\/api\/admin\/analytics-insights",\s*\{[\s\S]*?signal\s*[,}]/
  );
});

test("surfaces executing and verifying states before the terminal response", () => {
  const executing = pillSource.indexOf('state: "executing"');
  const verifying = pillSource.indexOf('state: "verifying-result"');
  const terminal = pillSource.indexOf("setResponse(responseWithReceipt)");

  expect(executing).toBeGreaterThan(-1);
  expect(verifying).toBeGreaterThan(executing);
  expect(terminal).toBeGreaterThan(verifying);
});

test("preserves safe partial output when a request is cancelled", () => {
  const cancelStart = pillSource.indexOf("function cancelOperation()");
  const cancelEnd = pillSource.indexOf("function runDryTest()", cancelStart);
  const cancellation = pillSource.slice(cancelStart, cancelEnd);

  expect(cancellation).toContain("setResponse((current)");
  expect(cancellation).toContain("...(current ||");
  expect(cancellation).toContain("${current.body}");
  expect(cancellation).toContain('state: "cancelled"');
});

test("isolates natural-language failures with an honest retry and keeps entered data intact", () => {
  const submitStart = pillSource.indexOf("async function submitQuery(");
  const submitEnd = pillSource.indexOf("function cancelOperation()", submitStart);
  const submit = pillSource.slice(submitStart, submitEnd);

  expect(submit).toContain("try {");
  expect(submit).toContain("} catch (error) {");
  expect(submit).toContain("} finally {");
  expect(submit).toContain("finishOperation(controller)");
  expect(submit).toContain("describeAdminAIRequestFailure(error)");
  expect(submit).toContain('state: "offline-error"');
  expect(submit).toContain(
    "retryOperationRef.current = () => void submitQuery(undefined, request)"
  );
  expect(submit).not.toContain('setQuery("")');
});

test("distinguishes provider, network, timeout, rate-limit, and authorization recovery", () => {
  const helperStart = pillSource.indexOf("function describeAdminAIRequestFailure(");
  const helperEnd = pillSource.indexOf("function currentTimeMs()", helperStart);
  const helper = pillSource.slice(helperStart, helperEnd);

  expect(helperStart).toBeGreaterThan(-1);
  for (const title of [
    "Network connection unavailable",
    "Copilot request timed out",
    "Copilot rate limit reached",
    "Copilot authorization changed",
    "AI provider unavailable"
  ]) {
    expect(helper).toContain(title);
  }
  expect(helper).toContain("core Admin V2 controls");
  expect(helper).toContain("No AI result or protected action is claimed.");
});

test("restores only bounded redacted terminal responses inside one authenticated session", () => {
  for (const contract of [
    'const ADMIN_AI_SESSION_RESPONSE_KEY = "yw-admin-ai:response:v1"',
    "ADMIN_AI_SESSION_RESPONSE_MAX_BYTES",
    "ADMIN_AI_SESSION_RESPONSE_TTL_MS",
    "window.sessionStorage",
    "redactAdminAIValue",
    "new TextEncoder()",
    "snapshot.boundaryKey !== boundaryKey",
    "delete safe.approvalReceipt",
    "delete safe.artifact",
    "delete safe.plan",
    "delete safe.rollbackAction"
  ]) {
    expect(pillSource).toContain(contract);
  }

  const boundaryStart = pillSource.indexOf("if (previousBoundaryRef.current");
  const boundaryEnd = pillSource.indexOf("previousBoundaryRef.current = boundary", boundaryStart);
  expect(pillSource.slice(boundaryStart, boundaryEnd)).toContain(
    "clearPersistedAdminAIResponse(sessionStorage)"
  );

  const clearStart = pillSource.indexOf("function clearConversation()");
  const clearEnd = pillSource.indexOf("function recordFeedback", clearStart);
  expect(pillSource.slice(clearStart, clearEnd)).toContain(
    "clearPersistedAdminAIResponse(sessionStorage)"
  );
});

test("fails open for UI use when hardened browsers deny sessionStorage access", () => {
  const accessorStart = pillSource.indexOf("function getAdminAISessionStorage()");
  const accessorEnd = pillSource.indexOf("function persistAdminAILongTask", accessorStart);
  const accessor = pillSource.slice(accessorStart, accessorEnd);

  expect(accessorStart).toBeGreaterThan(-1);
  expect(accessor).toContain('typeof window === "undefined"');
  expect(accessor).toContain("return window.sessionStorage");
  expect(accessor).toMatch(/catch \{[\s\S]*?return null/);
  expect(pillSource).toContain(
    'storage: Pick<Storage, "removeItem" | "setItem"> | null'
  );
  expect(pillSource).toContain('storage: Pick<Storage, "getItem" | "removeItem"> | null');
  expect(pillSource).toContain("if (!storage) return null");
});

test("keeps keyboard focus and Escape handling inside the topmost confirmation", () => {
  expect(actionConfirmSource).toContain("cancelButtonRef.current?.focus()");
  expect(actionConfirmSource).toContain('event.key === "Escape"');
  expect(actionConfirmSource).toContain("event.stopPropagation()");
  expect(actionConfirmSource).toContain("onCancelRef.current()");
  expect(actionConfirmSource).toContain('event.key !== "Tab"');
  expect(actionConfirmSource).toContain("previousFocus?.focus()");
  expect(actionConfirmSource).toContain("onKeyDown={handleKeyDown}");
  expect(actionConfirmSource).toContain('data-admin-ai-confirm-cancel="true"');
  expect(drawerSource).toContain(
    '\'[role="alertdialog"] [data-admin-ai-confirm-cancel="true"]\''
  );
  expect(drawerSource).toContain("confirmationCancel.click()");
});

test("lets admins dismiss busy Copilot work without cancelling the request", () => {
  const closeStart = pillSource.indexOf("const close = useCallback(() => {");
  const closeEnd = pillSource.indexOf("function updatePreferences", closeStart);
  const closeHandler = pillSource.slice(closeStart, closeEnd);

  expect(closeStart).toBeGreaterThan(-1);
  expect(closeHandler).not.toContain("if (busy) return");
  expect(closeHandler).toContain("setDrawerDismissed(true)");
  expect(closeHandler).toContain("onOpenChange(false)");
  expect(closeHandler).not.toContain("operationAbortRef.current?.abort()");
  expect(pillSource).toContain('aria-controls="admin-ai-copilot-dialog"');
  expect(drawerSource).toContain('id="admin-ai-copilot-dialog"');
});

test("reuses a redacted context summary and suppresses duplicate in-flight sends", () => {
  expect(pillSource).toContain("contextSummaryCacheRef");
  expect(pillSource).toContain("activeRequestKeyRef");
  expect(pillSource).toContain("contextFingerprint");
  expect(pillSource).toContain("getCachedPolicyContext()");
  expect(pillSource).toContain("if (activeRequestKeyRef.current === requestKey) return");
  expect(pillSource).toContain("context: taskContext");
});

test("exposes the complete contextual and plan state labels in real transitions", () => {
  const analyzing = pillSource.indexOf('state: "analyzing"');
  const preparing = pillSource.indexOf('state: "preparing-plan"', analyzing);
  const retrieving = pillSource.indexOf('state: "retrieving-data"', preparing);

  expect(analyzing).toBeGreaterThan(-1);
  expect(preparing).toBeGreaterThan(analyzing);
  expect(retrieving).toBeGreaterThan(preparing);
  expect(pillSource).toContain('state: "waiting-approval"');
  for (const state of ["contextual-suggestion", "urgent-alert", "listening", "idle"]) {
    expect(pillSource).toContain(`"${state}"`);
  }
});

test("keeps long mobile reports scrollable, touch-safe, and clear of primary actions", () => {
  expect(copilotStyles).toContain("overflow-y: auto");
  expect(copilotStyles).toContain("overscroll-behavior: contain");
  expect(copilotStyles).toContain("overflow-wrap: anywhere");
  expect(copilotStyles).toContain("env(safe-area-inset-bottom)");
  expect(copilotStyles).toMatch(
    /@media \(max-width: 720px\)[\s\S]*?\.dock\s*\{[\s\S]*?bottom:\s*calc\(/
  );
  expect(copilotStyles).toMatch(
    /@media \(max-width: 720px\)[\s\S]*?\.drawer\s*\{[\s\S]*?max-height:[^;]*dvh/
  );
});

test("paints the drawer shell eagerly and lazy-loads its response renderer", () => {
  expect(pillSource).toContain('import { AdminAIDrawer } from "./AdminAIDrawer"');
  expect(pillSource).not.toContain("const LazyAdminAIDrawer = lazy");
  expect(pillSource).toContain("const LazyAdminAIResponsePanel = lazy");
  expect(pillSource).not.toContain('import { AdminAIResponsePanel } from "./AdminAIResponsePanel"');
});

test("defers closed Copilot analysis and gates drawer-only derivations behind open", () => {
  const derivationsStart = pillSource.indexOf("const effectiveContext = useMemo");
  const derivationsEnd = pillSource.indexOf("const [busy", derivationsStart);
  const derivations = pillSource.slice(derivationsStart, derivationsEnd);

  expect(derivationsStart).toBeGreaterThan(-1);
  for (const expensiveCall of [
    "scopeAdminAIContext(",
    "indexAdminAIApprovedReportArtifacts(",
    "mergeAdminAIKnowledgeIndexes(",
    "redactAdminAIValue(",
    "JSON.stringify(policyContext)",
    "personalizeAdminAICommands(",
    "getAllowedAdminAICommands(",
    "scopeAdminAICommandsByOwnerPolicy("
  ]) {
    const callAt = derivations.indexOf(expensiveCall);
    const openGateAt = derivations.lastIndexOf("if (!panelContentReady)", callAt);
    expect(callAt, expensiveCall).toBeGreaterThan(-1);
    expect(openGateAt, `${expensiveCall} must follow the prepared-panel guard`).toBeGreaterThan(-1);
  }

  expect(pillSource).toMatch(/const selectedEntitySummary = panelContentReady\s*\?/);
  expect(pillSource).toMatch(/const filterSummary = panelContentReady\s*\?/);

  const alertRuntimeStart = pillSource.indexOf("const [closedAlertCount");
  const alertRuntimeEnd = pillSource.indexOf("function clearActiveLongTask", alertRuntimeStart);
  const alertRuntime = pillSource.slice(alertRuntimeStart, alertRuntimeEnd);
  expect(alertRuntimeStart).toBeGreaterThan(-1);
  expect(alertRuntime).toContain("openAlertCount");
  expect(alertRuntime).toContain("countAdminAIProactiveSignals(effectiveContext)");
  expect(alertRuntime).toContain("scheduleAdminAIIdleWork");
  expect(alertRuntime).toContain("countAdminAIProactiveSignals(context)");
  expect(alertRuntime).toContain("return cancelIdleWork");

  const idleHelperStart = pillSource.indexOf("function scheduleAdminAIIdleWork");
  const idleHelper = pillSource.slice(idleHelperStart);
  expect(idleHelperStart).toBeGreaterThan(-1);
  expect(idleHelper).toContain("window.requestIdleCallback");
  expect(idleHelper).toContain("window.cancelIdleCallback");
  expect(idleHelper).toContain("window.setTimeout");
  expect(idleHelper).toContain("window.clearTimeout");
});

test("keeps drawer chrome independent from the lazy response details renderer", () => {
  const responseStart = pillSource.indexOf("<LazyAdminAIResponsePanel");
  const innerSuspenseStart = pillSource.lastIndexOf("<Suspense", responseStart);
  const drawerStart = pillSource.indexOf("<LazyAdminAIDrawer");

  expect(responseStart).toBeGreaterThan(-1);
  expect(innerSuspenseStart).toBeGreaterThan(drawerStart);
  expect(pillSource.slice(innerSuspenseStart, responseStart)).toContain('role="status"');
  expect(pillSource.slice(innerSuspenseStart, responseStart)).toContain(
    "Loading response details"
  );
});

test("uses a labelled pressed-toggle scope group and contextual repeated action labels", () => {
  const scopeStart = pillSource.indexOf("className={styles.scopeTabs}");
  const scopeEnd = pillSource.indexOf("Context path:", scopeStart);
  const scopeChooser = pillSource.slice(scopeStart, scopeEnd);

  expect(scopeChooser).toContain('role="group"');
  expect(scopeChooser).toContain('aria-label="Admin Copilot scope"');
  expect(scopeChooser).toContain("aria-pressed={scope === item.id}");
  expect(scopeChooser).not.toContain('role="tablist"');
  expect(scopeChooser).not.toContain('role="tab"');
  expect(scopeChooser).not.toContain("aria-selected=");
  expect(copilotStyles).toContain('.scopeTabs button[aria-pressed="true"]');
  expect(copilotStyles).not.toContain('.scopeTabs button[aria-selected="true"]');
  expect(pillSource).toContain("aria-label={`Remove knowledge source ${source.label}`}");
  expect(pillSource).toContain(
    "aria-label={`Edit ${schedule.reportType} ${schedule.cadence.frequency} schedule`}"
  );
  expect(pillSource).toContain(
    "aria-label={`Disable ${schedule.reportType} ${schedule.cadence.frequency} schedule`}"
  );
  expect(pillSource).toContain('Selected entity: {selectedEntitySummary || "None"}');
  expect(pillSource).toContain('Current filters: {filterSummary || "None"}');
});

test("offers a generic explanation only when role filtering hides a command", () => {
  expect(pillSource).toContain("getAdminAIUnavailableCapabilityReason");
  expect(pillSource).toContain("Why are some actions unavailable?");
  expect(pillSource).toMatch(
    /\{unavailableCapabilityReason \? \([\s\S]*?Why are some actions unavailable\?[\s\S]*?\) : null\}/
  );

  const handlerStart = pillSource.indexOf("function explainUnavailableCapabilities()");
  const handlerEnd = pillSource.indexOf("async function execute(", handlerStart);
  const handler = pillSource.slice(handlerStart, handlerEnd);
  expect(handler).toContain("unavailableCapabilityReason");
  expect(handler).toContain('state: "insufficient-permission"');
  expect(handler).not.toContain("requiredPermissions");
  expect(handler).not.toContain("command.id");
});

test("renders the registered section icon and a bounded useful-state attention pulse", () => {
  expect(pillSource).toContain("countAdminAIProactiveSignals(effectiveContext)");
  expect(pillSource).toContain("data-icon={section.icon}");
  expect(copilotStyles).toContain("@keyframes copilot-attention-pulse");
  expect(copilotStyles).toMatch(
    /\.pill\[data-alert="true"\]\s*\{[\s\S]*?animation:\s*copilot-attention-pulse 2\.8s ease-in-out 2;/
  );
  expect(copilotStyles).toMatch(
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pill\s*\{[\s\S]*?animation:\s*none;/
  );
});

test("clears task and selection context when the authenticated admin boundary changes", () => {
  const boundaryStart = pillSource.indexOf("const boundary = [");
  const boundaryEnd = pillSource.indexOf("previousBoundaryRef.current = boundary", boundaryStart);
  const boundaryReset = pillSource.slice(boundaryStart, boundaryEnd);

  expect(boundaryReset).toContain("profile?.email ||");
  expect(boundaryReset).toContain("operationAbortRef.current?.abort()");
  expect(boundaryReset).toContain("setPendingCommand(null)");
  expect(boundaryReset).toContain('setQuery("")');
  expect(boundaryReset).toContain("setResponse(null)");
  expect(boundaryReset).toContain("setContextTrail([context.sectionName])");
  expect(boundaryReset).toContain("setSelectedEntityIds([])");
});

test("restores and synchronizes durable Incident Mode instead of clearing its freeze", () => {
  expect(pillSource).toContain('fetch("/api/admin/ai-incidents"');
  expect(pillSource).toContain('mode: "sync"');
  expect(pillSource).toContain("evidence: incident.alerts");
  expect(pillSource).toContain(
    "activeIncident ? incidentResponse(activeIncident, effectiveContext) : null"
  );
  expect(pillSource).toContain("Optional dangerous Admin AI writes remain frozen");
});

test("routes very large report requests through an explicit Continue or Cancel preflight", () => {
  const executeStart = pillSource.indexOf("async function execute(");
  const executeEnd = pillSource.indexOf("function selectCommand(", executeStart);
  const execute = pillSource.slice(executeStart, executeEnd);
  const submitStart = pillSource.indexOf("async function submitQuery(");
  const submitEnd = pillSource.indexOf("function cancelOperation()", submitStart);
  const submit = pillSource.slice(submitStart, submitEnd);
  const decisionStart = pillSource.indexOf("function decidePendingReport(");
  const decisionEnd = pillSource.indexOf("async function submitQuery(", decisionStart);
  const decision = pillSource.slice(decisionStart, decisionEnd);
  const cancelStart = decision.indexOf('if (decision === "cancel")');
  const continueStart = decision.indexOf('if (pending.kind === "query")', cancelStart);

  expect(pillSource).toContain("evaluateAdminAIReportPreflight");
  expect(execute.indexOf("setPendingCommand(null)")).toBeLessThan(
    execute.indexOf("evaluateAdminAIReportPreflight")
  );
  expect(execute.indexOf("evaluateAdminAIReportPreflight")).toBeLessThan(
    execute.indexOf("commitOwnerPolicyRequest")
  );
  expect(submit.indexOf("evaluateAdminAIReportPreflight")).toBeLessThan(
    submit.indexOf("commitOwnerPolicyRequest")
  );
  expect(decision.slice(cancelStart, continueStart)).not.toContain("submitQuery(");
  expect(decision.slice(cancelStart, continueStart)).not.toContain("execute(");
  expect(decision).toContain('submitQuery(undefined, pending.request, "continue")');
  expect(decision).toContain('execute(pending.command, pending.confirmed, "continue")');
  expect(pillSource).toContain('decidePendingReport("continue")');
  expect(pillSource).toContain('decidePendingReport("cancel")');
  expect(pillSource).toContain("No report or artifact was created");
});

test("attaches source-labelled provenance to every durable incident response", () => {
  expect(pillSource).toContain("buildAdminAIIncidentProvenance");
  expect(pillSource.match(/incidentResponse\([^)]*, effectiveContext\)/g)).toHaveLength(3);
  const helperStart = pillSource.indexOf("function incidentResponse(");
  const helperEnd = pillSource.indexOf("function formatScope(", helperStart);
  const helper = pillSource.slice(helperStart, helperEnd);
  expect(helper).toContain("context: AdminAISectionContext");
  expect(helper).toContain("evidence: buildAdminAIIncidentProvenance(record.incident, context)");

  expect(pillSource).toMatch(
    /\}, \[busy, effectiveContext, featureFlags\.incidentMode, panelContentReady, profile\?\.isOwner\]\);/
  );
});

test("gives owners durable incident checklist and explicit resolution controls", () => {
  expect(pillSource).toContain('aria-label="Owner incident controls"');
  expect(pillSource).toContain('mode: "checklist"');
  expect(pillSource).toContain('mode: "resolve"');
  expect(pillSource).toContain("expectedVersion: activeIncident.version");
  expect(pillSource).toContain("Resolve incident and lift freeze");
  expect(pillSource).toContain("incidentResolutionReason.trim()");
});

test("hydrates and persists AI settings while keeping clear-memory fail closed", () => {
  expect(pillSource).toContain("loadAdminAISettings(controller.signal)");
  expect(pillSource).toContain("updateAdminAISettings(");
  expect(pillSource).toContain("ownerConfigMutation(ownerConfig)");
  const clearRequest = pillSource.indexOf("clearSafeMemory: true");
  const localClear = pillSource.indexOf(
    "clearAdminAIPreferences(window.localStorage)",
    clearRequest
  );
  const acceptedGuard = pillSource.indexOf(
    "if (!result.ok || !result.payload.settings)",
    clearRequest
  );
  expect(clearRequest).toBeGreaterThan(-1);
  expect(acceptedGuard).toBeGreaterThan(clearRequest);
  expect(localClear).toBeGreaterThan(acceptedGuard);
  expect(pillSource).toContain("durableSettings.privacy.memory");
  expect(pillSource).toContain("durableSettings.privacy.retention");
  expect(pillSource).toContain("durableSettings.privacy.sharing");
  expect(pillSource).toContain("durableSettings.actionHistory.map");
  expect(pillSource).toContain("AI-assisted action history");
});

test("explains and confirms the complete safe-memory clearing boundary", () => {
  const confirmStart = pillSource.indexOf("function AdminAIMemoryClearConfirm(");
  const confirmEnd = pillSource.indexOf("function currentTimeMs()", confirmStart);
  const confirmation = pillSource.slice(confirmStart, confirmEnd);
  const normalizedConfirmation = confirmation.replace(/\s+/g, " ");

  expect(confirmStart).toBeGreaterThan(-1);
  expect(pillSource).toContain("setClearMemoryConfirmOpen(true)");
  expect(confirmation).toContain('role="alertdialog"');
  expect(confirmation).toContain("Clear AI memory and feedback?");
  expect(confirmation).toContain("approved preference corrections");
  expect(confirmation).toContain("local response feedback");
  expect(normalizedConfirmation).toContain("session conversation context");
  expect(normalizedConfirmation).toContain(
    "Saved tasks, artifacts, core settings, and mandatory audit records remain."
  );
  expect(confirmation).toContain("Clear memory and feedback");
  expect(confirmation).toContain("Keep memory");
  expect(confirmation).toContain('data-admin-ai-confirm-cancel="true"');
});

test("wires artifact creation through approval, Reports save, version checks, and conflict reload", () => {
  for (const operation of [
    'operation: "create"',
    'operation: "request-report-save"',
    'operation: "decide-report-save"',
    'operation: "save-to-reports"',
    'operation: "delete"'
  ]) {
    expect(pillSource).toContain(operation);
  }
  expect(pillSource).toContain("expectedVersion: durable.version");
  expect(pillSource).toContain("if (result.status === 409)");
  expect(pillSource).toContain("loadAdminAIArtifact(durable.id)");
  expect(pillSource).toContain("owner approval is pending before Reports insertion");
});

test("refreshes approved report knowledge only for an authenticated open Copilot", () => {
  const loadAt = pillSource.indexOf("loadAdminAIArtifacts(controller.signal)");
  const effectStart = pillSource.lastIndexOf("useEffect(() => {", loadAt);
  const effectEnd = pillSource.indexOf("}, [panelContentReady, profile?.email", loadAt);
  const refreshEffect = pillSource.slice(effectStart, effectEnd);

  expect(loadAt).toBeGreaterThan(-1);
  expect(refreshEffect).toContain("if (!panelContentReady || !profile?.email)");
  expect(refreshEffect).toContain("controller.abort()");
  expect(pillSource).toContain("indexAdminAIApprovedReportArtifacts(");
  expect(pillSource).toContain("mergeAdminAIKnowledgeIndexes(");

  const boundaryStart = pillSource.indexOf("const boundary = [");
  const boundaryEnd = pillSource.indexOf("previousBoundaryRef.current = boundary", boundaryStart);
  expect(pillSource.slice(boundaryStart, boundaryEnd)).toContain(
    "setDurableKnowledgeArtifacts([])"
  );
});

test("persists request telemetry, response feedback, and structured corrections", () => {
  expect(pillSource).toContain("recordAdminAIObservationDurably(");
  expect(pillSource).toContain("recordAdminAIFeedbackDurably(kind, observation.id, csrfToken)");
  expect(pillSource).toContain("await observationWrite.promise");
  expect(pillSource).toContain("submitAdminAICorrectionDurably(");
  expect(pillSource).toContain("Correction queued for evaluation and explicit owner review");

  const naturalLanguageStart = pillSource.indexOf("async function submitQuery(");
  const attestationAt = pillSource.indexOf(
    "await attestAdminAINaturalLanguageRead(",
    naturalLanguageStart
  );
  const observationAt = pillSource.indexOf("recordObservation(", attestationAt);
  expect(attestationAt).toBeGreaterThan(naturalLanguageStart);
  expect(observationAt).toBeGreaterThan(attestationAt);
  expect(pillSource.slice(attestationAt, observationAt + 1_200)).toContain(
    "attestation.ok ? attestation.requestId"
  );
});

test("wires owner schedule create, update, disable, version refresh, and capability-safe status", () => {
  expect(pillSource).toContain("loadAdminAISchedules(");
  expect(pillSource).toContain('operation: "create"');
  expect(pillSource).toContain('operation: "update"');
  expect(pillSource).toContain('operation: "disable"');
  expect(pillSource).toContain("expectedVersion: editingSchedule.version");
  expect(pillSource).toContain("expectedVersion: schedule.version");
  expect(pillSource).toContain("secure scheduled jobs required");
  expect(pillSource).toContain("result.status === 409");
});
