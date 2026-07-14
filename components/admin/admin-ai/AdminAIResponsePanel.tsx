import { useState } from "react";
import type { AdminAIResponse } from "../../../lib/admin-ai/adminAIService";
import type { AdminAIRollbackAction } from "../../../lib/admin-ai/adminAITypes";
import { AdminAIReportCard } from "./AdminAIReportCard";
import styles from "./admin-ai.module.css";

export function AdminAIResponsePanel({
  onApprovePlan,
  onCancelPlan,
  onDeleteArtifact,
  onDryRun,
  onEditPlan,
  onRegenerate,
  onRollback,
  onToggleSearchResult,
  response,
  selectedSearchResultIds = [],
}: {
  onApprovePlan?: () => void;
  onCancelPlan?: () => void;
  onDeleteArtifact?: () => void;
  onDryRun?: () => void;
  onEditPlan?: () => void;
  onRegenerate?: () => void;
  onRollback?: (action: AdminAIRollbackAction) => void;
  onToggleSearchResult?: (id: string) => void;
  response: AdminAIResponse | null;
  selectedSearchResultIds?: string[];
}) {
  const [artifactStatus, setArtifactStatus] = useState("");
  const [rollbackConfirm, setRollbackConfirm] = useState(false);
  if (!response) {
    return (
      <section className={styles.responsePanel} data-state="idle">
        <small>Ready</small>
        <h4>Choose a command or ask in natural language</h4>
        <p>Copilot uses only compact, permission-filtered context and registered actions.</p>
      </section>
    );
  }

  async function copyArtifact() {
    if (!response?.artifact) return;
    try {
      await navigator.clipboard.writeText(response.artifact.content);
      setArtifactStatus("Artifact copied.");
    } catch {
      setArtifactStatus("Copy was blocked by the browser.");
    }
  }

  function downloadArtifact() {
    if (!response?.artifact) return;
    const blob = new Blob([response.artifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${response.artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "admin-ai-artifact"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setArtifactStatus("Artifact download prepared.");
  }

  return (
    <section
      aria-live="polite"
      className={styles.responsePanel}
      data-admin-ai-response="true"
      data-state={response.state}
      role={response.state === "action-failed" || response.state === "offline-error" ? "alert" : "status"}
    >
      <small>{formatState(response.state)}</small>
      {response.report ? null : <h4>{response.title}</h4>}
      <p>{response.body}</p>

      {response.progress?.length ? (
        <ol className={styles.progressList} aria-label="Copilot progress">
          {response.progress.map((step) => (
            <li data-status={step.status} key={step.id}>{step.label}</li>
          ))}
        </ol>
      ) : null}

      {response.confidence ? (
        <div className={styles.confidence} data-level={response.confidence.level}>
          <strong>{formatState(response.confidence.level)} confidence</strong>
          <span>{response.confidence.reason}</span>
        </div>
      ) : null}

      {response.items.length ? (
        <ul>
          {response.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
        </ul>
      ) : null}

      {response.searchResults?.length ? (
        <div className={styles.searchResults} aria-label="Permission-filtered search results">
          {response.searchResults.map((item) => (
            <article key={`${item.module}:${item.id}`}>
              <a href={item.route}>
                <span><strong>{item.label}</strong><small>{item.module}</small></span>
                <span>{item.status}</span>
                <p>{item.matchReason}</p>
                <time>{item.updatedAt}</time>
              </a>
              <button
                aria-pressed={selectedSearchResultIds.includes(item.id)}
                onClick={() => onToggleSearchResult?.(item.id)}
                type="button"
              >
                {selectedSearchResultIds.includes(item.id) ? "Selected" : "Select record"}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {response.plan ? (
        <section className={styles.planPanel} aria-label={response.plan.title}>
          <header>
            <div><small>Plan before action</small><h4>{response.plan.title}</h4></div>
            <span>Level {response.plan.approvalLevel}</span>
          </header>
          <dl>
            <div><dt>Records affected</dt><dd>{response.plan.affectedRecords.length || "No concrete record selected"}</dd></div>
            <div><dt>Confirmation</dt><dd>{response.plan.confirmationRequired ? "Required" : "Not required"}</dd></div>
            <div><dt>OTP</dt><dd>{response.plan.otpRequired ? "Existing OTP required" : "Not required"}</dd></div>
            <div><dt>Reversible</dt><dd>{response.plan.reversible ? "Yes, after real persistence support" : "No rollback claimed"}</dd></div>
          </dl>
          <ol>
            {response.plan.steps.map((step) => (
              <li data-status={step.status} key={step.id}>
                <span>{step.label}</span>
                <small>{step.actionId || step.api || (step.mutation ? "mutation" : "read-only")}</small>
              </li>
            ))}
          </ol>
          <p><strong>Expected:</strong> {response.plan.expectedOutcome}</p>
          <p><strong>Rollback:</strong> {response.plan.rollback}</p>
          {response.plan.dryRun ? (
            <div className={styles.dryRun}>
              <strong>Dry run: {response.plan.dryRun.validation}</strong>
              <p>No real data changed. Public output change: {response.plan.dryRun.publicOutputChanges ? "possible after approval" : "no"}.</p>
              {response.plan.dryRun.errors.map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}
          <div className={styles.planActions}>
            <button disabled={!response.plan.executable} onClick={onApprovePlan} type="button">Approve Plan</button>
            <button onClick={onEditPlan} type="button">Edit Plan</button>
            <button onClick={onDryRun} type="button">Run Dry Test</button>
            <button onClick={onCancelPlan} type="button">Cancel</button>
          </div>
        </section>
      ) : null}

      {response.healthScore ? (
        <section className={styles.healthScore} aria-label="Transparent Admin Health Score">
          <header><strong>{response.healthScore.score}/100</strong><span>Admin Health Score</span></header>
          {response.healthScore.components.map((component) => (
            <div key={component.id}>
              <span>{component.label}</span><strong>{component.score}</strong>
              <small>{component.inputs.join(" / ")}</small>
            </div>
          ))}
          {response.healthScore.missingInputs.length ? <p>Missing inputs: {response.healthScore.missingInputs.join(", ")}</p> : null}
        </section>
      ) : null}

      {response.healthSignals?.length ? (
        <div className={styles.healthSignals} aria-label="Evidence-backed health alerts">
          {response.healthSignals.map((signal) => (
            <a data-severity={signal.severity} href={signal.directRoute} key={signal.id}>
              <span><strong>{signal.title}</strong><small>{signal.severity}</small></span>
              <p>{signal.evidence}</p>
              <small>{signal.suggestedNextStep}</small>
            </a>
          ))}
        </div>
      ) : null}

      {response.approvalReceipt ? (
        <section className={styles.approvalReceipt} aria-label="Admin AI approval receipt">
          <header><small>Approval receipt</small><strong>{response.approvalReceipt.action}</strong></header>
          <dl>
            <div><dt>Affected records</dt><dd>{response.approvalReceipt.affectedRecords.join(", ") || "No explicit record"}</dd></div>
            <div><dt>Requested by</dt><dd>{response.approvalReceipt.requestedBy}</dd></div>
            <div><dt>Current state</dt><dd>{response.approvalReceipt.currentState}</dd></div>
            <div><dt>Proposed state</dt><dd>{response.approvalReceipt.proposedState}</dd></div>
            <div><dt>Approval level</dt><dd>Level {response.approvalReceipt.approvalLevel}</dd></div>
            <div><dt>Permission</dt><dd>{response.approvalReceipt.permissionCheck}</dd></div>
            <div><dt>OTP</dt><dd>{response.approvalReceipt.otpRequired ? "Required by existing workflow" : "Not required"}</dd></div>
            <div><dt>Reversible</dt><dd>{response.approvalReceipt.reversible ? "Supported after persistence" : "No rollback claimed"}</dd></div>
            <div><dt>Outcome</dt><dd>{response.approvalReceipt.outcome}</dd></div>
            <div><dt>Records changed</dt><dd>{response.approvalReceipt.recordsChanged}</dd></div>
            <div><dt>Audit reference</dt><dd>{response.approvalReceipt.auditReference}</dd></div>
          </dl>
          <p>{response.approvalReceipt.impact}</p>
          <time>{response.approvalReceipt.confirmationTimestamp}</time>
        </section>
      ) : null}

      {response.rollbackAction ? (
        <section className={styles.rollbackPanel} aria-label="Rollback available">
          <div>
            <small>Reversible action</small>
            <strong>{response.rollbackAction.label}</strong>
            <span>Record: {response.rollbackAction.recordId}</span>
          </div>
          {rollbackConfirm ? (
            <div>
              <p>Confirm this explicit rollback. The same CSRF, RBAC, API validation, and audit path will run again.</p>
              <button
                onClick={() => {
                  setRollbackConfirm(false);
                  onRollback?.(response.rollbackAction!);
                }}
                type="button"
              >
                Confirm Undo
              </button>
              <button onClick={() => setRollbackConfirm(false)} type="button">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setRollbackConfirm(true)} type="button">Undo status change</button>
          )}
        </section>
      ) : null}

      {response.evidence?.length ? (
        <details className={styles.evidencePanel}>
          <summary>Evidence and data provenance</summary>
          <ul>
            {response.evidence.map((item, index) => (
              <li key={`${item.source}:${index}`}>
                <strong>{item.source}</strong>
                <span>{item.module} / {item.dateRange} / {item.recordCount} records</span>
                <small>{item.freshness}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {response.modelRoute ? (
        <p className={styles.modelRoute}>
          Route: {response.modelRoute.mode} / budget {response.modelRoute.estimatedTokenBudget} tokens. {response.modelRoute.reason}
        </p>
      ) : null}

      {response.report ? <AdminAIReportCard report={response.report} /> : null}

      {response.artifact ? (
        <section className={styles.artifactPanel} aria-label={`Artifact: ${response.artifact.title}`}>
          <div><small>{response.artifact.type}</small><strong>{response.artifact.title}</strong><span>{response.artifact.sourceContext}</span></div>
          <div>
            <button onClick={() => void copyArtifact()} type="button">Copy</button>
            <button onClick={downloadArtifact} type="button">Download</button>
            <button onClick={onRegenerate} type="button">Regenerate</button>
            <button onClick={onDeleteArtifact} type="button">Delete</button>
          </div>
          {artifactStatus ? <p role="status">{artifactStatus}</p> : null}
        </section>
      ) : null}
    </section>
  );
}

function formatState(value: string) {
  return value.replace(/-/g, " ");
}
