import { useState } from "react";
import { getAdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import type { AdminAIResponse } from "../../../lib/admin-ai/adminAIService";
import type { AdminAIRollbackAction } from "../../../lib/admin-ai/adminAITypes";
import { AdminAIReportCard } from "./AdminAIReportCard";
import styles from "./admin-ai.module.css";

const ADMIN_AI_RESPONSE_STATE_LABELS: Record<AdminAIResponse["state"], string> = {
  analyzing: "Thinking",
  "action-complete": "Success",
  "action-failed": "Error",
  "action-prepared": "Plan ready",
  "blocked-missing-data": "Blocked by missing data",
  cancelled: "Cancelled",
  "confirmation-required": "Confirmation required",
  executing: "Executing",
  "insufficient-permission": "Blocked by permission",
  loading: "Loading",
  "missing-data": "Missing data",
  "offline-error": "Unavailable",
  "partial-success": "Partial success",
  "preparing-plan": "Preparing plan",
  ready: "Ready",
  "retrieving-data": "Retrieving data",
  "streaming-response": "Streaming response",
  "verifying-result": "Verifying result",
  "waiting-approval": "Waiting for approval"
};

export function AdminAIResponsePanel({
  onApprovePlan,
  onCancelPlan,
  onDeleteArtifact,
  onDryRun,
  onEditPlan,
  onRegenerate,
  onRetry,
  onRollback,
  onSaveArtifact,
  onToggleSearchResult,
  response,
  selectedSearchResultIds = [],
  stabilizeLayout = false
}: {
  onApprovePlan?: () => void;
  onCancelPlan?: () => void;
  onDeleteArtifact?: () => Promise<string | void> | string | void;
  onDryRun?: () => void;
  onEditPlan?: () => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onRollback?: (action: AdminAIRollbackAction) => void;
  onSaveArtifact?: () => Promise<string | void> | string | void;
  onToggleSearchResult?: (id: string) => void;
  response: AdminAIResponse | null;
  selectedSearchResultIds?: string[];
  stabilizeLayout?: boolean;
}) {
  if (!response) {
    return (
      <section
        aria-label="Admin AI response"
        className={styles.responsePanel}
        data-layout-stable={stabilizeLayout ? "true" : "false"}
        data-state="idle"
        role="region"
      >
        <small>Ready</small>
        <h4>Choose a command or ask in natural language</h4>
        <p>Copilot uses only compact, permission-filtered context and registered actions.</p>
      </section>
    );
  }

  const plannedActionId =
    response.plan?.steps.find((step) => Boolean(step.actionId))?.actionId || null;
  const plannedCommand = plannedActionId ? getAdminAICommand(plannedActionId) : undefined;
  const planContract = plannedCommand?.executionContract;
  const planRecordLimit = planContract?.maxSelectedRecords ?? 12;
  const visiblePlanRecords = response.plan?.affectedRecords.slice(0, planRecordLimit) || [];
  const excludedPlanRecords = response.plan?.affectedRecords.slice(planRecordLimit) || [];
  const planBlockedReason = response.plan
    ? response.plan.executable
      ? planContract?.blockedReason || "None"
      : response.plan.risks[0] ||
        planContract?.blockedReason ||
        "No registered executable action matched; direct execution is disabled."
    : "None";
  const normalizedBody = response.body.trim().replace(/\s+/g, " ").toLowerCase();
  const visibleConclusions = response.conclusions?.filter(
    ({ text }) => text.trim().replace(/\s+/g, " ").toLowerCase() !== normalizedBody
  );

  return (
    <section
      aria-label={`Admin AI response: ${response.title}`}
      className={styles.responsePanel}
      data-admin-ai-response="true"
      data-layout-stable={stabilizeLayout ? "true" : "false"}
      data-state={response.state}
      role="region"
    >
      <small
        aria-atomic="true"
        role={
          response.state === "action-failed" || response.state === "offline-error"
            ? "alert"
            : "status"
        }
      >
        {formatResponseState(response.state)}: {response.title}
      </small>
      {response.report ? null : <h4>{response.title}</h4>}
      <p>{response.body}</p>

      {response.incident ? <AdminAIIncidentPanel incident={response.incident} /> : null}

      {response.progress?.length ? (
        <ol className={styles.progressList} aria-label="Copilot progress">
          {response.progress.map((step) => (
            <li data-status={step.status} key={step.id}>
              {step.label}
            </li>
          ))}
        </ol>
      ) : null}

      {response.confidence ? (
        <div className={styles.confidence} data-level={response.confidence.level}>
          <strong>{formatConfidenceLevel(response.confidence.level)} confidence</strong>
          <span>{response.confidence.reason}</span>
        </div>
      ) : null}

      {visibleConclusions?.length ? (
        <section aria-label="Important conclusions">
          <strong>Important conclusions</strong>
          <ol>
            {visibleConclusions.map((conclusion) => (
              <li data-level={conclusion.confidence.level} key={conclusion.id}>
                <p>{conclusion.text}</p>
                <strong>{formatConfidenceLevel(conclusion.confidence.level)} confidence</strong>
                <span>{conclusion.confidence.reason}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {response.items.length ? (
        <ul>
          {response.items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : null}

      {response.analyticsExplanation ? (
        <AdminAIAnalyticsExplanation explanation={response.analyticsExplanation} />
      ) : null}

      {response.structuredReport ? (
        <AdminAIStructuredReportPanel report={response.structuredReport} />
      ) : null}

      {response.tableAnalysis ? (
        <AdminAITableAnalysisPanel analysis={response.tableAnalysis} />
      ) : null}

      {response.builderInspection ? (
        <AdminAIBuilderInspectionPanel inspection={response.builderInspection} />
      ) : null}

      {response.errorInvestigation ? (
        <AdminAIErrorInvestigationPanel investigation={response.errorInvestigation} />
      ) : null}

      {response.searchResults?.length ? (
        <div className={styles.searchResults} aria-label="Permission-filtered search results">
          {response.searchResults.map((item) => {
            const selected = selectedSearchResultIds.includes(item.id);
            return (
              <article key={`${item.module}:${item.id}`}>
                <a href={item.route}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.module}</small>
                  </span>
                  <span>{item.status}</span>
                  <p>{item.matchReason}</p>
                  <time>{item.updatedAt}</time>
                </a>
                <button
                  aria-label={`${selected ? "Deselect" : "Select"} ${item.label} record ${item.id}`}
                  aria-pressed={selected}
                  onClick={() => onToggleSearchResult?.(item.id)}
                  type="button"
                >
                  {selected ? "Selected" : "Select record"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}

      {response.plan ? (
        <section className={styles.planPanel} aria-label={response.plan.title}>
          <header>
            <div>
              <small>Plan before action</small>
              <h4>{response.plan.title}</h4>
            </div>
            <span>Level {response.plan.approvalLevel}</span>
          </header>
          <strong>Decision summary</strong>
          <dl className={styles.planDecisionSummary}>
            <div>
              <dt>What changes</dt>
              <dd>{response.plan.expectedOutcome}</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>
                {response.plan.affectedRecords.length
                  ? response.plan.affectedRecords.length.toLocaleString("en-IN")
                  : "No concrete record selected"}
              </dd>
            </div>
            <div>
              <dt>Main risk</dt>
              <dd>{response.plan.risks[0] || "No material risk identified"}</dd>
            </div>
            <div>
              <dt>Undo</dt>
              <dd>{response.plan.reversible ? response.plan.rollback : "No rollback available"}</dd>
            </div>
          </dl>
          <details className={styles.planDetails}>
            <summary>Review technical plan and safeguards</summary>
            <dl>
            <div>
              <dt>Plan ID</dt>
              <dd>{response.plan.id}</dd>
            </div>
            <div>
              <dt>Section ID</dt>
              <dd>{response.plan.sectionId}</dd>
            </div>
            <div>
              <dt>Action ID</dt>
              <dd>{plannedActionId || "No registered action"}</dd>
            </div>
            <div>
              <dt>Handler ID</dt>
              <dd>{plannedCommand?.handlerId || "No server handler"}</dd>
            </div>
            <div>
              <dt>Issue classification</dt>
              <dd>
                {planContract
                  ? formatContractValue(planContract.issueClassification)
                  : "review only recommendation"}
              </dd>
            </div>
            <div>
              <dt>Execution availability</dt>
              <dd>
                {response.plan.executable && planContract?.availability === "executable"
                  ? "Registered execution available after confirmation"
                  : "Direct execution disabled"}
              </dd>
            </div>
            <div>
              <dt>Records affected</dt>
              <dd>
                {response.plan.affectedRecords.length
                  ? `${response.plan.affectedRecords.length}: ${visiblePlanRecords.join(", ")}`
                  : "No concrete record selected"}
              </dd>
            </div>
            <div>
              <dt>Records outside action bound</dt>
              <dd>{excludedPlanRecords.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Selection limit</dt>
              <dd>
                {planContract
                  ? `${planContract.minSelectedRecords}-${planContract.maxSelectedRecords} records`
                  : `0-${planRecordLimit} records`}
              </dd>
            </div>
            <div>
              <dt>Batch limit</dt>
              <dd>
                {planContract?.maxBatchSize
                  ? `${planContract.maxBatchSize} record${planContract.maxBatchSize === 1 ? "" : "s"} per execution`
                  : "No direct mutation batch"}
              </dd>
            </div>
            <div>
              <dt>Current state label</dt>
              <dd>{planContract?.currentStateLabel || "Current permission-filtered state"}</dd>
            </div>
            <div>
              <dt>Proposed state label</dt>
              <dd>{planContract?.proposedStateLabel || "Reviewable recommendation only"}</dd>
            </div>
            <div>
              <dt>Permissions</dt>
              <dd>{response.plan.permissions.join(", ") || "Authenticated admin"}</dd>
            </div>
            <div>
              <dt>Dependencies</dt>
              <dd>{planContract?.dependencies.join("; ") || "No mutation dependencies"}</dd>
            </div>
            <div>
              <dt>Blocked / skipped reason</dt>
              <dd>{planBlockedReason}</dd>
            </div>
            <div>
              <dt>Confirmation</dt>
              <dd>{response.plan.confirmationRequired ? "Required" : "Not required"}</dd>
            </div>
            <div>
              <dt>OTP</dt>
              <dd>{response.plan.otpRequired ? "Existing OTP required" : "Not required"}</dd>
            </div>
            <div>
              <dt>Reversible</dt>
              <dd>
                {response.plan.reversible
                  ? "Yes, after real persistence support"
                  : "No rollback claimed"}
              </dd>
            </div>
            </dl>
          {response.plan.risks.length ? (
            <div>
              <strong>Risks and constraints</strong>
              <ul>
                {response.plan.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <ol>
            {response.plan.steps.map((step) => (
              <li data-status={step.status} key={step.id}>
                <span>{step.label}</span>
                <small>
                  {step.actionId || step.api || (step.mutation ? "mutation" : "read-only")}
                </small>
                <small>Status: {step.status}</small>
              </li>
            ))}
          </ol>
          <p>
            <strong>Expected:</strong> {response.plan.expectedOutcome}
          </p>
          <p>
            <strong>Rollback:</strong> {response.plan.rollback}
          </p>
            {response.plan.dryRun ? (
              <div className={styles.dryRun}>
              <strong>Dry run: {response.plan.dryRun.validation}</strong>
              <p>
                No real data changed. Public output change:{" "}
                {response.plan.dryRun.publicOutputChanges ? "possible after approval" : "no"}.
              </p>
              <time>{response.plan.dryRun.generatedAt}</time>
              <div>
                <strong>Before state</strong>
                <ul>
                  {response.plan.dryRun.before.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Proposed state</strong>
                <ul>
                  {response.plan.dryRun.proposedAfter.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Dry-run dependencies</strong>
                <ul>
                  {response.plan.dryRun.dependencies.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Skipped records</strong>
                {response.plan.dryRun.recordsSkipped.length ? (
                  <ul>
                    {response.plan.dryRun.recordsSkipped.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <span>None</span>
                )}
              </div>
              <div>
                <strong>Validation errors</strong>
                {response.plan.dryRun.errors.length ? (
                  <ul>
                    {response.plan.dryRun.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <span>None</span>
                )}
              </div>
              </div>
            ) : null}
          </details>
          <div className={styles.planActions}>
            <button
              aria-label={`Approve plan ${response.plan.title}`}
              disabled={!response.plan.executable}
              onClick={onApprovePlan}
              type="button"
            >
              Approve Plan
            </button>
            <button
              aria-label={`Edit plan ${response.plan.title}`}
              onClick={onEditPlan}
              type="button"
            >
              Edit Plan
            </button>
            <button
              aria-label={`Run dry test for plan ${response.plan.title}`}
              onClick={onDryRun}
              type="button"
            >
              Run Dry Test
            </button>
            <button
              aria-label={`Cancel plan ${response.plan.title}`}
              onClick={onCancelPlan}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {response.healthScore ? <AdminAIHealthScorePanel healthScore={response.healthScore} /> : null}

      {response.anomalyAnalysis ? (
        <AdminAIAnomalyAnalysisPanel analysis={response.anomalyAnalysis} />
      ) : null}

      {response.healthSignals?.length ? (
        <AdminAIHealthSignalsPanel signals={response.healthSignals} />
      ) : null}

      {response.approvalReceipt ? (
        <details
          className={styles.approvalReceipt}
          aria-label="Admin AI approval receipt"
          role="region"
        >
          <summary>
            <small>Approval receipt</small>
            <strong>{response.approvalReceipt.action}</strong>
          </summary>
          <dl>
            <div>
              <dt>Recommended by AI</dt>
              <dd>{response.approvalReceipt.recommendedByAI || response.approvalReceipt.action}</dd>
            </div>
            <div>
              <dt>Affected records</dt>
              <dd>{response.approvalReceipt.affectedRecords.join(", ") || "No explicit record"}</dd>
            </div>
            <div>
              <dt>Requested by</dt>
              <dd>{response.approvalReceipt.requestedBy}</dd>
            </div>
            <div>
              <dt>Current state</dt>
              <dd>{response.approvalReceipt.currentState}</dd>
            </div>
            <div>
              <dt>Proposed state</dt>
              <dd>{response.approvalReceipt.proposedState}</dd>
            </div>
            <div>
              <dt>Approval level</dt>
              <dd>Level {response.approvalReceipt.approvalLevel}</dd>
            </div>
            <div>
              <dt>Permission</dt>
              <dd>{response.approvalReceipt.permissionCheck}</dd>
            </div>
            <div>
              <dt>OTP</dt>
              <dd>
                {response.approvalReceipt.otpRequired
                  ? "Required by existing workflow"
                  : "Not required"}
              </dd>
            </div>
            <div>
              <dt>Reversible</dt>
              <dd>
                {response.approvalReceipt.reversible
                  ? "Backed by a durable rollback receipt"
                  : "No rollback claimed"}
              </dd>
            </div>
            <div>
              <dt>Outcome</dt>
              <dd>{response.approvalReceipt.outcome}</dd>
            </div>
            <div>
              <dt>Execution status</dt>
              <dd>{response.approvalReceipt.executionStatus || "Not reported"}</dd>
            </div>
            <div>
              <dt>Records changed</dt>
              <dd>{response.approvalReceipt.recordsChanged}</dd>
            </div>
            <div>
              <dt>Rollback availability</dt>
              <dd>
                {response.approvalReceipt.rollbackAvailable
                  ? "Available from this durable receipt"
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Audit reference</dt>
              <dd>
                {response.approvalReceipt.auditReference || "Not persisted; failure receipt only"}
              </dd>
            </div>
          </dl>
          <p>
            <strong>{response.approvalReceipt.impactLabel || "Impact"}:</strong>{" "}
            {response.approvalReceipt.impact}
          </p>
          <time>{response.approvalReceipt.confirmationTimestamp}</time>
        </details>
      ) : null}

      {response.rollbackAction ? (
        <AdminAIRollbackPanel
          action={response.rollbackAction}
          key={response.rollbackAction.receiptId}
          onRollback={onRollback}
        />
      ) : null}

      {response.evidence?.length ? (
        <details className={styles.evidencePanel}>
          <summary>Evidence and data provenance</summary>
          <ul>
            {response.evidence.map((item, index) => (
              <li key={`${item.source}:${index}`}>
                <strong>{item.source}</strong>
                <dl>
                  <div>
                    <dt>Module</dt>
                    <dd>{item.module}</dd>
                  </div>
                  <div>
                    <dt>Date range</dt>
                    <dd>{item.dateRange}</dd>
                  </div>
                  <div>
                    <dt>Records analyzed</dt>
                    <dd>{item.recordCount}</dd>
                  </div>
                  <div>
                    <dt>Entity references</dt>
                    <dd>{item.entityReferences?.join(", ") || "None"}</dd>
                  </div>
                  <div>
                    <dt>Observed at</dt>
                    <dd>{item.observedAt || "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt>Freshness</dt>
                    <dd>{item.freshness}</dd>
                  </div>
                </dl>
                <div>
                  {item.sourceRoute?.startsWith("/admin/") && item.entityReferences?.length ? (
                    <a href={item.sourceRoute}>View supporting records</a>
                  ) : null}
                  {Object.entries(item.entityRoutes || {}).map(([entityId, route]) =>
                    route.startsWith("/admin/") ? (
                      <a href={route} key={entityId}>
                        View supporting record {entityId}
                      </a>
                    ) : null
                  )}
                  {item.sourceRoute?.startsWith("/admin/") ? (
                    <a href={item.sourceRoute}>Open source module</a>
                  ) : null}
                  {item.filters ? (
                    <details>
                      <summary>View applied filters</summary>
                      <span>
                        {Object.keys(item.filters).length ? formatRecord(item.filters) : "None"}
                      </span>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {response.modelRoute ? (
        <div className={styles.modelRoute}>
          <strong>{formatAdminAIModelRoute(response.modelRoute.mode)}</strong>
          <details>
            <summary>Why this route?</summary>
            <p>
              {response.modelRoute.estimatedTokenBudget.toLocaleString("en-IN")} output-token
              ceiling. {response.modelRoute.reason}
            </p>
          </details>
        </div>
      ) : null}

      {response.state === "offline-error" || response.state === "action-failed" ? (
        <div className={styles.failureFallback}>
          <p>Copilot is optional. Continue with this page&apos;s manual admin controls.</p>
          {onRetry ? (
            <button
              aria-label={`Retry request for ${response.title}`}
              onClick={onRetry}
              type="button"
            >
              Retry request
            </button>
          ) : null}
        </div>
      ) : null}

      {response.report ? <AdminAIReportCard report={response.report} /> : null}

      {response.artifact ? (
        <AdminAIArtifactPanel
          artifact={response.artifact}
          key={response.artifact.id}
          onDelete={onDeleteArtifact}
          onRegenerate={onRegenerate}
          onSave={onSaveArtifact}
        />
      ) : null}
    </section>
  );
}

function formatAdminAIModelRoute(mode: NonNullable<AdminAIResponse["modelRoute"]>["mode"]) {
  if (mode === "reasoning") return "Luna · Medium reasoning";
  if (mode === "fast") return "Luna · Low reasoning";
  return "Deterministic · No model call";
}

type AnalyticsExplanation = NonNullable<AdminAIResponse["analyticsExplanation"]>;
type BuilderInspection = NonNullable<AdminAIResponse["builderInspection"]>;
type ErrorInvestigation = NonNullable<AdminAIResponse["errorInvestigation"]>;
type HealthScore = NonNullable<AdminAIResponse["healthScore"]>;
type HealthSignal = NonNullable<AdminAIResponse["healthSignals"]>[number];
type AnomalyAnalysis = NonNullable<AdminAIResponse["anomalyAnalysis"]>;
type Incident = NonNullable<AdminAIResponse["incident"]>;
type Artifact = NonNullable<AdminAIResponse["artifact"]>;
type StructuredReport = NonNullable<AdminAIResponse["structuredReport"]>;
type StructuredReportEntry = StructuredReport["sections"][number]["entries"][number];
type TableAnalysis = NonNullable<AdminAIResponse["tableAnalysis"]>;

function AdminAIRollbackPanel({
  action,
  onRollback
}: {
  action: AdminAIRollbackAction;
  onRollback?: (action: AdminAIRollbackAction) => void;
}) {
  const [rollbackConfirm, setRollbackConfirm] = useState(false);
  return (
    <section className={styles.rollbackPanel} aria-label="Rollback available">
      <div>
        <small>Reversible action</small>
        <strong>{action.label}</strong>
        <span>Record: {action.recordId}</span>
      </div>
      {rollbackConfirm ? (
        <div>
          <p>
            Confirm this explicit rollback. The same CSRF, RBAC, API validation, and audit path will
            run again.
          </p>
          <button
            aria-label={`Confirm undo for record ${action.recordId}`}
            onClick={() => {
              setRollbackConfirm(false);
              onRollback?.(action);
            }}
            type="button"
          >
            Confirm Undo
          </button>
          <button
            aria-label={`Cancel undo for record ${action.recordId}`}
            onClick={() => setRollbackConfirm(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          aria-label={`Undo status change for record ${action.recordId}`}
          onClick={() => setRollbackConfirm(true)}
          type="button"
        >
          Undo status change
        </button>
      )}
    </section>
  );
}

function AdminAIArtifactPanel({
  artifact,
  onDelete,
  onRegenerate,
  onSave
}: {
  artifact: Artifact;
  onDelete?: () => Promise<string | void> | string | void;
  onRegenerate?: () => void;
  onSave?: () => Promise<string | void> | string | void;
}) {
  const [artifactStatus, setArtifactStatus] = useState("");
  const [artifactBusy, setArtifactBusy] = useState(false);

  async function copyArtifact() {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setArtifactStatus("Artifact copied.");
    } catch {
      setArtifactStatus("Copy was blocked by the browser.");
    }
  }

  function downloadArtifact() {
    const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${
      artifact.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "admin-ai-artifact"
    }.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setArtifactStatus("Artifact download prepared.");
  }

  async function runArtifactAction(
    action: (() => Promise<string | void> | string | void) | undefined,
    workingLabel: string
  ) {
    if (!action || artifactBusy) return;
    setArtifactBusy(true);
    setArtifactStatus(workingLabel);
    try {
      const status = await action();
      setArtifactStatus(status || "Artifact operation completed.");
    } catch {
      setArtifactStatus("The artifact operation failed safely.");
    } finally {
      setArtifactBusy(false);
    }
  }

  return (
    <section className={styles.artifactPanel} aria-label={`Artifact: ${artifact.title}`}>
      <div>
        <small>{artifact.type}</small>
        <strong>{artifact.title}</strong>
        <span>{artifact.sourceContext}</span>
        <span>Created {artifact.createdAt}</span>
      </div>
      <div>
        <button
          aria-label={`Copy artifact ${artifact.title}`}
          disabled={artifactBusy}
          onClick={() => void copyArtifact()}
          type="button"
        >
          Copy
        </button>
        <button
          aria-label={`Download artifact ${artifact.title}`}
          disabled={artifactBusy}
          onClick={downloadArtifact}
          type="button"
        >
          Download
        </button>
        {onSave ? (
          <button
            aria-label={`Save artifact ${artifact.title} to Reports`}
            disabled={artifactBusy}
            onClick={() => void runArtifactAction(onSave, "Saving artifact durably...")}
            type="button"
          >
            Save to Reports
          </button>
        ) : null}
        <button
          aria-label={`Regenerate artifact ${artifact.title}`}
          disabled={artifactBusy}
          onClick={onRegenerate}
          type="button"
        >
          Regenerate
        </button>
        <button
          aria-label={`Delete artifact ${artifact.title}`}
          disabled={artifactBusy}
          onClick={() => void runArtifactAction(onDelete, "Deleting artifact safely...")}
          type="button"
        >
          Delete
        </button>
      </div>
      {artifactStatus ? <p role="status">{artifactStatus}</p> : null}
    </section>
  );
}

function AdminAIIncidentPanel({ incident }: { incident: Incident }) {
  return (
    <article
      aria-label={incident.criticalBanner.title}
      className={styles.reportCard}
      role={incident.criticalBanner.visible ? "alert" : "status"}
    >
      <header>
        <div>
          <small>
            {incident.criticalBanner.severity === "critical"
              ? "Critical Incident Mode"
              : "Incident Mode"}
          </small>
          <h4>{incident.criticalBanner.title}</h4>
          <p>{incident.impactSummary}</p>
        </div>
      </header>

      <section aria-label="Dangerous action freeze">
        <strong>Dangerous action freeze</strong>
        <dl>
          <div>
            <dt>Active</dt>
            <dd>{formatYesNo(incident.actionFreeze.active)}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{incident.actionFreeze.scope}</dd>
          </div>
          <div>
            <dt>Enforcement</dt>
            <dd>{incident.actionFreeze.enforcement}</dd>
          </div>
          <div>
            <dt>Blocked action kinds</dt>
            <dd>{formatList(incident.actionFreeze.blockedActionKinds)}</dd>
          </div>
        </dl>
        <p>{incident.actionFreeze.reason}</p>
      </section>

      <StringListSection
        emptyMessage="No affected module was identified."
        items={incident.affectedModules}
        title="Affected modules"
      />

      <section aria-label="Validated incident evidence">
        <strong>Validated incident evidence</strong>
        {incident.evidence.length ? (
          <ul>
            {incident.evidence.map((item, index) => (
              <li key={`${item.alertId}:${item.observedAt}:${index}`}>
                <p>{item.summary}</p>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>{item.source}</dd>
                  </div>
                  <div>
                    <dt>Module</dt>
                    <dd>{item.module}</dd>
                  </div>
                  <div>
                    <dt>Entity</dt>
                    <dd>{item.entityReference}</dd>
                  </div>
                  <div>
                    <dt>Observed at</dt>
                    <dd>{item.observedAt}</dd>
                  </div>
                  <div>
                    <dt>Applied filters</dt>
                    <dd>{formatRecord(item.filters)}</dd>
                  </div>
                </dl>
                {item.sourceRoute.startsWith("/admin/") ? (
                  <a href={item.sourceRoute}>Open supporting record {item.entityReference}</a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No validated incident evidence.</p>
        )}
      </section>

      <section aria-label="Investigation checklist">
        <strong>Investigation checklist</strong>
        <ol>
          {incident.checklist.map((item) => (
            <li data-status={item.status} key={item.id}>
              {item.label} <small>{item.status}</small>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Incident timeline">
        <strong>Incident timeline</strong>
        {incident.timeline.length ? (
          <ol>
            {incident.timeline.map((item) => (
              <li key={item.id}>
                <time dateTime={item.observedAt}>{item.observedAt}</time> / {item.module} /{" "}
                {item.summary}
              </li>
            ))}
          </ol>
        ) : (
          <p>No validated incident events.</p>
        )}
      </section>

      <section aria-label="Audit trail">
        <strong>Audit trail</strong>
        <ol>
          {incident.auditTrail.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.occurredAt}>{entry.occurredAt}</time> / {entry.event} /{" "}
              {entry.detail}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Incident execution policy">
        <strong>Execution policy</strong>
        <dl>
          <div>
            <dt>Mode</dt>
            <dd>{incident.execution.mode}</dd>
          </div>
          <div>
            <dt>Mutations executed</dt>
            <dd>{incident.execution.mutationsExecuted}</dd>
          </div>
          <div>
            <dt>Destructive changes executed</dt>
            <dd>{formatYesNo(incident.execution.destructiveChangesExecuted)}</dd>
          </div>
          <div>
            <dt>Infrastructure changes executed</dt>
            <dd>{formatYesNo(incident.execution.infrastructureChangesExecuted)}</dd>
          </div>
        </dl>
      </section>
    </article>
  );
}

function AdminAIAnalyticsExplanation({ explanation }: { explanation: AnalyticsExplanation }) {
  return (
    <article aria-label="Analytics explanation" className={styles.reportCard}>
      <header>
        <div>
          <small>{formatState(explanation.status)}</small>
          <h4>Analytics explanation</h4>
          <p>
            {explanation.evidence.dataRange} / {explanation.evidence.freshness}
          </p>
        </div>
      </header>

      <section aria-label="Trend">
        <strong>Trend</strong>
        <dl>
          <div>
            <dt>Current visits</dt>
            <dd>{formatScalar(explanation.trend.currentVisits)}</dd>
          </div>
          <div>
            <dt>Previous visits</dt>
            <dd>{formatScalar(explanation.trend.previousVisits)}</dd>
          </div>
          <div>
            <dt>Visits change</dt>
            <dd>{formatPercent(explanation.trend.visitsChangePercent)}</dd>
          </div>
          <div>
            <dt>Current registration clicks</dt>
            <dd>{formatScalar(explanation.trend.currentRegistrationClicks)}</dd>
          </div>
          <div>
            <dt>Previous registration clicks</dt>
            <dd>{formatScalar(explanation.trend.previousRegistrationClicks)}</dd>
          </div>
          <div>
            <dt>Registration clicks change</dt>
            <dd>{formatPercent(explanation.trend.registrationClicksChangePercent)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Analytics evidence sources">
        <strong>Evidence sources</strong>
        <dl>
          <div>
            <dt>Data range</dt>
            <dd>{explanation.evidence.dataRange}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>{explanation.evidence.freshness}</dd>
          </div>
          <div>
            <dt>Sources</dt>
            <dd>{formatList(explanation.evidence.sources)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Important windows">
        <strong>Important windows</strong>
        {explanation.importantWindows.length ? (
          <ol>
            {explanation.importantWindows.map((window, index) => (
              <li key={`${window.kind}:${window.bucketStart}:${index}`}>
                <strong>
                  {formatState(window.kind)} / {window.metric}
                </strong>
                <dl>
                  <div>
                    <dt>Window</dt>
                    <dd>
                      {window.bucketStart} to {window.bucketEnd}
                    </dd>
                  </div>
                  <div>
                    <dt>Change</dt>
                    <dd>{formatScalar(window.change)}</dd>
                  </div>
                  <div>
                    <dt>Current visits</dt>
                    <dd>{formatScalar(window.currentVisits)}</dd>
                  </div>
                  <div>
                    <dt>Previous bucket visits</dt>
                    <dd>{formatScalar(window.previousBucketVisits)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        ) : (
          <p>No important traffic windows were detected.</p>
        )}
      </section>

      <section aria-label="Source performance">
        <strong>Source performance</strong>
        {explanation.sourcePerformance.length ? (
          <ul>
            {explanation.sourcePerformance.map((source) => (
              <li key={source.source}>
                <strong>{source.source}</strong>
                <dl>
                  <div>
                    <dt>Visits</dt>
                    <dd>{formatScalar(source.visits)}</dd>
                  </div>
                  <div>
                    <dt>Registration clicks</dt>
                    <dd>{formatScalar(source.registrationClicks)}</dd>
                  </div>
                  <div>
                    <dt>Conversion</dt>
                    <dd>{formatPercent(source.conversionPercent)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p>No source-labelled analytics buckets are available.</p>
        )}
      </section>

      <section aria-label="Source comparison">
        <strong>Source comparison</strong>
        <p>{explanation.sourceComparison.message}</p>
        <dl>
          <div>
            <dt>Status</dt>
            <dd>{formatState(explanation.sourceComparison.status)}</dd>
          </div>
          <div>
            <dt>Highest traffic source</dt>
            <dd>{formatScalar(explanation.sourceComparison.highestTrafficSource)}</dd>
          </div>
          <div>
            <dt>Highest traffic source visits</dt>
            <dd>{formatScalar(explanation.sourceComparison.highestTrafficSourceVisits)}</dd>
          </div>
          <div>
            <dt>Highest traffic source conversion</dt>
            <dd>
              {formatPercent(explanation.sourceComparison.highestTrafficSourceConversionPercent)}
            </dd>
          </div>
          <div>
            <dt>Overall conversion</dt>
            <dd>{formatPercent(explanation.sourceComparison.overallConversionPercent)}</dd>
          </div>
          <div>
            <dt>Difference from overall conversion</dt>
            <dd>{formatPercent(explanation.sourceComparison.differenceFromOverallPercent)}</dd>
          </div>
        </dl>
      </section>

      <section aria-label="Analytics anomalies">
        <strong>Anomalies</strong>
        {explanation.anomalies.length ? (
          <ol>
            {explanation.anomalies.map((anomaly, index) => (
              <li key={`${anomaly.type}:${anomaly.dataRange}:${index}`}>
                <strong>{formatState(anomaly.type)}</strong>
                <dl>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{anomaly.confidence}</dd>
                  </div>
                  <div>
                    <dt>Data range</dt>
                    <dd>{anomaly.dataRange}</dd>
                  </div>
                  <div>
                    <dt>Observed value</dt>
                    <dd>{formatScalar(anomaly.observedValue)}</dd>
                  </div>
                  <div>
                    <dt>Baseline</dt>
                    <dd>{formatScalar(anomaly.baseline)}</dd>
                  </div>
                  <div>
                    <dt>Deviation</dt>
                    <dd>{formatPercent(anomaly.deviationPercent)}</dd>
                  </div>
                  <div>
                    <dt>Detection method</dt>
                    <dd>{anomaly.detectionMethod}</dd>
                  </div>
                  <div>
                    <dt>Recommended verification</dt>
                    <dd>{anomaly.recommendedVerification}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        ) : (
          <p>No deterministic anomaly crossed the configured threshold.</p>
        )}
      </section>

      <section aria-label="Correlation">
        <strong>Correlation</strong>
        {explanation.correlation ? (
          <dl>
            <div>
              <dt>Coefficient</dt>
              <dd>{formatScalar(explanation.correlation.coefficient)}</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>{explanation.correlation.direction}</dd>
            </div>
            <div>
              <dt>Strength</dt>
              <dd>{explanation.correlation.strength}</dd>
            </div>
            <div>
              <dt>Caveat</dt>
              <dd>{explanation.correlation.caveat}</dd>
            </div>
          </dl>
        ) : (
          <p>Unavailable because the supplied buckets do not support a reliable coefficient.</p>
        )}
      </section>

      <StringListSection
        emptyMessage="No missing-data warning."
        items={explanation.missingDataWarnings}
        title="Data warnings"
      />
      <StringListSection
        emptyMessage="No investigation step was generated."
        items={explanation.investigationSteps}
        ordered
        title="Investigation steps"
      />
    </article>
  );
}

function AdminAIStructuredReportPanel({ report }: { report: StructuredReport }) {
  return (
    <article aria-label={`Structured report: ${report.title}`} className={styles.reportCard}>
      <header>
        <div>
          <small>
            {report.kind === "daily-briefing" ? "Ordered Daily Briefing" : "Executive report"}
          </small>
          <h4>{report.title}</h4>
          <p>{report.kind === "executive" ? report.reportType : "Daily Briefing"}</p>
        </div>
      </header>
      <section aria-label="Report provenance">
        <strong>Report provenance</strong>
        <dl>
          <div>
            <dt>Kind</dt>
            <dd>{formatState(report.kind)}</dd>
          </div>
          <div>
            <dt>Generated at</dt>
            <dd>
              <time dateTime={report.generatedAt}>{report.generatedAt}</time>
            </dd>
          </div>
          <div>
            <dt>Date range</dt>
            <dd>{report.dateRange}</dd>
          </div>
          <div>
            <dt>Filters</dt>
            <dd>{formatRecord(report.filters)}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>{report.freshness}</dd>
          </div>
        </dl>
      </section>
      <ol
        aria-label={
          report.kind === "daily-briefing"
            ? "Ordered Daily Briefing sections"
            : "Ordered executive report sections"
        }
      >
        {report.sections.map((section) => (
          <li key={section.id}>
            <section aria-label={section.title}>
              <strong>{section.title}</strong>
              {"classification" in section ? (
                <small>Classification: {section.classification}</small>
              ) : null}
              <ol>
                {section.entries.map((entry, index) => (
                  <li key={`${entry.classification}:${entry.label}:${index}`}>
                    <AdminAIStructuredReportEntry entry={entry} />
                  </li>
                ))}
              </ol>
            </section>
          </li>
        ))}
      </ol>
    </article>
  );
}

function AdminAIStructuredReportEntry({ entry }: { entry: StructuredReportEntry }) {
  return (
    <article aria-label={entry.label}>
      <strong>{entry.label}</strong>
      <dl>
        <div>
          <dt>Value</dt>
          <dd>{formatScalar(entry.value)}</dd>
        </div>
        <div>
          <dt>Classification</dt>
          <dd>{entry.classification}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{entry.source}</dd>
        </div>
        <div>
          <dt>Date range</dt>
          <dd>{entry.dateRange}</dd>
        </div>
        <div>
          <dt>Filters</dt>
          <dd>{formatRecord(entry.filters)}</dd>
        </div>
        <div>
          <dt>Freshness</dt>
          <dd>{entry.freshness}</dd>
        </div>
        <div>
          <dt>Missing reason</dt>
          <dd>{entry.missingReason || "None"}</dd>
        </div>
      </dl>
    </article>
  );
}

function AdminAITableAnalysisPanel({ analysis }: { analysis: TableAnalysis }) {
  return (
    <article aria-label="Smart-table analysis" className={styles.reportCard}>
      <header>
        <div>
          <small>{formatState(analysis.capability)}</small>
          <h4>Smart-table analysis</h4>
          <p>{analysis.summary}</p>
        </div>
      </header>
      <section aria-label="Table scope">
        <strong>Table scope</strong>
        <dl>
          <div>
            <dt>Table</dt>
            <dd>{analysis.tableId}</dd>
          </div>
          <div>
            <dt>Capability</dt>
            <dd>{formatState(analysis.capability)}</dd>
          </div>
          <div>
            <dt>Visible rows</dt>
            <dd>{analysis.visibleCount}</dd>
          </div>
          <div>
            <dt>Selected rows</dt>
            <dd>{analysis.selectedCount}</dd>
          </div>
          <div>
            <dt>Filters</dt>
            <dd>{formatRecord(analysis.filters)}</dd>
          </div>
          <div>
            <dt>Sort</dt>
            <dd>
              {analysis.sort ? `${analysis.sort.field} (${analysis.sort.direction})` : "None"}
            </dd>
          </div>
        </dl>
      </section>
      <section aria-label="Row reasoning">
        <strong>Row reasoning</strong>
        {analysis.rowResults.length ? (
          <ol>
            {analysis.rowResults.map((row) => (
              <li key={row.id}>
                <strong>{row.label}</strong>
                <dl>
                  <div>
                    <dt>Record ID</dt>
                    <dd>{row.id}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{row.status}</dd>
                  </div>
                </dl>
                <ul>
                  {row.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <p>No row-level result was generated for this capability.</p>
        )}
      </section>
      <section aria-label="Table groups">
        <strong>Groups</strong>
        {analysis.groups.length ? (
          <ul>
            {analysis.groups.map((group) => (
              <li key={group.key}>
                <strong>{group.key}</strong>: {formatList(group.recordIds)}
              </li>
            ))}
          </ul>
        ) : (
          <p>No grouped result was generated for this capability.</p>
        )}
      </section>
      {analysis.plan ? (
        <section aria-label="Review-only plan">
          <strong>Review-only plan</strong>
          <dl>
            <div>
              <dt>Confirmation required</dt>
              <dd>{formatYesNo(analysis.plan.confirmationRequired)}</dd>
            </div>
            <div>
              <dt>Executable</dt>
              <dd>{formatYesNo(analysis.plan.executable)}</dd>
            </div>
            <div>
              <dt>Selected record IDs</dt>
              <dd>{formatList(analysis.plan.recordIds)}</dd>
            </div>
            <div>
              <dt>Safety</dt>
              <dd>{analysis.plan.safety}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </article>
  );
}

function AdminAIBuilderInspectionPanel({ inspection }: { inspection: BuilderInspection }) {
  return (
    <article aria-label="Builder pre-publish inspection" className={styles.reportCard}>
      <header>
        <div>
          <small>{formatState(inspection.outcome)}</small>
          <h4>Builder pre-publish inspection</h4>
          <p>Score: {inspection.score}/100</p>
        </div>
      </header>
      <section aria-label="Builder inspection scope">
        <strong>Inspection scope</strong>
        <dl>
          <div>
            <dt>Advisory only</dt>
            <dd>{formatYesNo(inspection.advisoryOnly)}</dd>
          </div>
          <div>
            <dt>Outcome</dt>
            <dd>{formatState(inspection.outcome)}</dd>
          </div>
          <div>
            <dt>Missing inputs</dt>
            <dd>{formatList(inspection.missingInputs)}</dd>
          </div>
          <div>
            <dt>Risks</dt>
            <dd>{formatList(inspection.risks)}</dd>
          </div>
        </dl>
        <p>
          <strong>Authoritative validation:</strong> {inspection.authoritativeValidation}
        </p>
      </section>
      <section aria-label="Fourteen Builder checks">
        <strong>Fourteen Builder checks</strong>
        <ol>
          {inspection.checks.map((check) => (
            <li data-status={check.status} key={check.id}>
              <strong>{check.id}</strong> <small>{check.status}</small>
              <p>{check.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function AdminAIErrorInvestigationPanel({ investigation }: { investigation: ErrorInvestigation }) {
  return (
    <article aria-label="Selected-error investigation" className={styles.reportCard}>
      <header>
        <div>
          <small>{formatState(investigation.status)}</small>
          <h4>Selected-error investigation</h4>
          <p>{investigation.summary}</p>
        </div>
      </header>
      <section aria-label="Investigation status">
        <strong>Investigation status</strong>
        <dl>
          <div>
            <dt>Summary</dt>
            <dd>{investigation.summary}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{investigation.status}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{investigation.severity}</dd>
          </div>
          <div>
            <dt>Impact</dt>
            <dd>{investigation.impactSummary}</dd>
          </div>
          <div>
            <dt>Resolution status</dt>
            <dd>{investigation.resolutionStatus}</dd>
          </div>
          <div>
            <dt>Likely cause</dt>
            <dd>{investigation.likelyCause}</dd>
          </div>
          <div>
            <dt>Recommended fix</dt>
            <dd>{investigation.recommendedFix}</dd>
          </div>
          <div>
            <dt>Safe temporary action</dt>
            <dd>{investigation.safeTemporaryAction}</dd>
          </div>
        </dl>
      </section>
      <StringListSection
        emptyMessage="No affected user or entity is visible."
        items={investigation.affectedUsersOrEntities}
        title="Affected users or entities"
      />
      <StringListSection
        emptyMessage="No permission-visible evidence is available."
        items={investigation.evidence}
        title="Evidence"
      />
      <StringListSection
        emptyMessage="No related permission-visible error was found."
        items={investigation.relatedErrors}
        title="Related errors"
      />
      <StringListSection
        emptyMessage="No safe reproduction step is available."
        items={investigation.reproduction}
        ordered
        title="Reproduction"
      />
    </article>
  );
}

function AdminAIHealthScorePanel({ healthScore }: { healthScore: HealthScore }) {
  return (
    <section aria-label="Transparent Admin Health Score" className={styles.healthScore}>
      <header>
        <strong>{healthScore.score === null ? "Unavailable" : `${healthScore.score}/100`}</strong>
        <span>Admin Health Score</span>
      </header>
      <p>
        Calculated at: <time dateTime={healthScore.calculatedAt}>{healthScore.calculatedAt}</time>
      </p>
      <p>Calculation: {healthScore.calculation || "Unavailable"}</p>
      {healthScore.components.map((component) => {
        const improvementSteps = component.howToImprove.filter((step) => step.trim().length > 0);
        return (
          <div key={component.id}>
            <span>{component.label}</span>
            <strong>{component.score === null ? "Unavailable" : `${component.score}/100`}</strong>
            <small>Dimension: {component.id}</small>
            <small>Weight: {formatScalar(component.weight ?? null)}</small>
            <small>Calculation: {component.calculation || "Unavailable"}</small>
            <small>Inputs: {formatList(component.inputs)}</small>
            <small>Missing inputs: {formatList(component.missingInputs)}</small>
            <strong>How to improve</strong>
            {improvementSteps.length ? (
              <ul>
                {improvementSteps.map((step, index) => (
                  <li key={`${component.id}:${index}`}>{step}</li>
                ))}
              </ul>
            ) : (
              <small>No source-backed remediation step is available.</small>
            )}
          </div>
        );
      })}
      <p>Missing inputs: {formatList(healthScore.missingInputs)}</p>
    </section>
  );
}

function AdminAIAnomalyAnalysisPanel({ analysis }: { analysis: AnomalyAnalysis }) {
  return (
    <section aria-label="Source-backed anomaly analysis" className={styles.healthScore}>
      <header>
        <strong>Source-backed anomaly analysis</strong>
        <span>{formatState(analysis.status)}</span>
      </header>
      {analysis.message ? <p>{analysis.message}</p> : null}
      <p>Insufficient baseline categories: {formatList(analysis.insufficientBaselineCategories)}</p>
      {analysis.anomalies.length ? (
        <ol>
          {analysis.anomalies.map((anomaly) => (
            <li key={anomaly.id}>
              <strong>{formatState(anomaly.category)}</strong>
              <dl>
                <div>
                  <dt>Category</dt>
                  <dd>{anomaly.category}</dd>
                </div>
                <div>
                  <dt>Anomaly ID</dt>
                  <dd>{anomaly.id}</dd>
                </div>
                <div>
                  <dt>Affected entity</dt>
                  <dd>{anomaly.affectedEntity}</dd>
                </div>
                <div>
                  <dt>Module</dt>
                  <dd>{anomaly.module}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{formatState(anomaly.confidence)}</dd>
                </div>
                <div>
                  <dt>Baseline</dt>
                  <dd>{anomaly.baseline.description}</dd>
                </div>
                <div>
                  <dt>Baseline sample size</dt>
                  <dd>{anomaly.baseline.sampleSize}</dd>
                </div>
                <div>
                  <dt>Minimum baseline size</dt>
                  <dd>{anomaly.baseline.minimumSampleSize}</dd>
                </div>
                <div>
                  <dt>Observed value</dt>
                  <dd>{formatScalar(anomaly.observedValue)}</dd>
                </div>
                <div>
                  <dt>Deviation</dt>
                  <dd>{anomaly.deviation}</dd>
                </div>
                <div>
                  <dt>Data range</dt>
                  <dd>
                    {anomaly.dataRange.from} to {anomaly.dataRange.to}
                  </dd>
                </div>
                <div>
                  <dt>Detection method</dt>
                  <dd>{anomaly.detectionMethod}</dd>
                </div>
                <div>
                  <dt>Recommended verification</dt>
                  <dd>{anomaly.recommendedVerification}</dd>
                </div>
              </dl>
              <strong>Evidence</strong>
              <ul>
                {anomaly.evidence.map((fact, index) => (
                  <li key={`${fact.source}:${fact.observedAt}:${index}`}>
                    {fact.summary} ({fact.source}, {fact.observedAt}
                    {fact.value === undefined ? "" : `, ${String(fact.value)}`})
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p>No source-backed anomaly crossed its configured threshold.</p>
      )}
    </section>
  );
}

function AdminAIHealthSignalsPanel({ signals }: { signals: HealthSignal[] }) {
  return (
    <div aria-label="Evidence-backed health alerts" className={styles.healthSignals}>
      {signals.map((signal) => (
        <a data-severity={signal.severity} href={signal.directRoute} key={signal.id}>
          <span>
            <strong>{signal.title}</strong>
            <small>{signal.severity}</small>
          </span>
          <dl>
            <div>
              <dt>Alert ID</dt>
              <dd>{signal.id}</dd>
            </div>
            <div>
              <dt>Affected entity</dt>
              <dd>{signal.affectedEntity}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{formatState(signal.confidence)}</dd>
            </div>
            <div>
              <dt>Module</dt>
              <dd>{signal.module}</dd>
            </div>
            <div>
              <dt>First detected</dt>
              <dd>
                <time dateTime={signal.firstDetected}>{signal.firstDetected}</time>
              </dd>
            </div>
            <div>
              <dt>Last detected</dt>
              <dd>
                <time dateTime={signal.lastDetected}>{signal.lastDetected}</time>
              </dd>
            </div>
            <div>
              <dt>Recurrence count</dt>
              <dd>{signal.recurrenceCount}</dd>
            </div>
            <div>
              <dt>Impact</dt>
              <dd>{signal.impact}</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{signal.evidence}</dd>
            </div>
            <div>
              <dt>Suggested next step</dt>
              <dd>{signal.suggestedNextStep}</dd>
            </div>
            <div>
              <dt>Direct route</dt>
              <dd>{signal.directRoute}</dd>
            </div>
          </dl>
        </a>
      ))}
    </div>
  );
}

function StringListSection({
  emptyMessage,
  items,
  ordered = false,
  title
}: {
  emptyMessage: string;
  items: readonly string[];
  ordered?: boolean;
  title: string;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <section aria-label={title}>
      <strong>{title}</strong>
      {items.length ? (
        <List>
          {items.map((item, index) => (
            <li key={`${index}:${item}`}>{item}</li>
          ))}
        </List>
      ) : (
        <p>{emptyMessage}</p>
      )}
    </section>
  );
}

function formatList(values: readonly string[]) {
  return values.length ? values.join(", ") : "None";
}

function formatConfidenceLevel(level: NonNullable<AdminAIResponse["confidence"]>["level"]) {
  if (level === "insufficient-data") return "Insufficient data";
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "Unavailable" : `${value}%`;
}

function formatRecord(values: Readonly<Record<string, boolean | number | string | null>>) {
  const entries = Object.entries(values);
  return entries.length
    ? entries.map(([key, value]) => `${key}=${formatScalar(value)}`).join(", ")
    : "None";
}

function formatScalar(value: boolean | number | string | null) {
  if (value === null) return "Unavailable";
  if (typeof value === "boolean") return formatYesNo(value);
  return typeof value === "number" ? value.toLocaleString() : value;
}

function formatYesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function formatContractValue(value: string) {
  return value.replace(/-/g, " ");
}

function formatState(value: string) {
  return value.replace(/-/g, " ");
}

function formatResponseState(value: AdminAIResponse["state"]) {
  return ADMIN_AI_RESPONSE_STATE_LABELS[value];
}
