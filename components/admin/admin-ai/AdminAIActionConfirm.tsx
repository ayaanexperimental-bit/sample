import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import type { AdminAICommand } from "../../../lib/admin-ai/adminAIRegistry";
import { getAdminAIConfirmationCopy } from "../../../lib/admin-ai/adminAISafety";
import styles from "./admin-ai.module.css";

export function AdminAIActionConfirm({
  command,
  currentState,
  affectedRecords,
  onCancel,
  onConfirm,
  proposedState,
  requestedBy
}: {
  affectedRecords: string[];
  command: AdminAICommand;
  currentState: string;
  onCancel: () => void;
  onConfirm: () => void;
  proposedState: string;
  requestedBy: string;
}) {
  const copy = getAdminAIConfirmationCopy(command);
  const contract = command.executionContract;
  const visibleRecords = affectedRecords.slice(0, contract.maxSelectedRecords);
  const skippedRecordCount = Math.max(0, affectedRecords.length - visibleRecords.length);
  const directExecutionBlocked =
    command.kind === "registered-action" && contract.availability !== "executable";
  const blockedOrSkippedReason = skippedRecordCount
    ? `${skippedRecordCount} selected record${skippedRecordCount === 1 ? " is" : "s are"} outside this bounded action.`
    : contract.blockedReason || "None";
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
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
      return;
    }
    if (event.key !== "Tab" || !confirmationRef.current) return;

    const focusable = Array.from(
      confirmationRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
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
      aria-label={copy.title}
      className={styles.confirmPanel}
      data-execution-availability={contract.availability}
      onKeyDown={handleKeyDown}
      ref={confirmationRef}
      role="alertdialog"
    >
      <small>Confirmation required</small>
      <h4>{copy.title}</h4>
      <p>{copy.body}</p>
      <strong className={styles.confirmSummaryTitle}>Decision summary</strong>
      <dl className={styles.confirmDecision}>
        <div>
          <dt>Recommended by AI</dt>
          <dd>{command.label}</dd>
        </div>
        <div>
          <dt>Affected records</dt>
          <dd>{visibleRecords.length ? visibleRecords.join(", ") : "No record selected"}</dd>
        </div>
        <div>
          <dt>Current state ({contract.currentStateLabel})</dt>
          <dd>{currentState}</dd>
        </div>
        <div>
          <dt>Proposed state ({contract.proposedStateLabel})</dt>
          <dd>{proposedState}</dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>{requestedBy || "Authenticated admin"}</dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd>{command.description}</dd>
        </div>
        <div>
          <dt>Approval level</dt>
          <dd>Level {command.approvalLevel}</dd>
        </div>
        <div>
          <dt>Permission check</dt>
          <dd>{command.requiredPermissions?.join(", ") || "Current authenticated admin"}</dd>
        </div>
        <div>
          <dt>OTP</dt>
          <dd>{command.otpRequired ? "Existing OTP required" : "Not required"}</dd>
        </div>
      </dl>
      <details className={styles.confirmTechnical}>
        <summary>Technical contract and safeguards</summary>
        <dl>
          <div>
            <dt>Action ID</dt>
            <dd>{command.id}</dd>
          </div>
          <div>
            <dt>Handler ID</dt>
            <dd>{command.handlerId || "No server handler (review only)"}</dd>
          </div>
          <div>
            <dt>Issue classification</dt>
            <dd>{formatContractValue(contract.issueClassification)}</dd>
          </div>
          <div>
            <dt>Execution availability</dt>
            <dd>{formatExecutionAvailability(contract.availability)}</dd>
          </div>
          <div>
            <dt>Selection limit</dt>
            <dd>
              {contract.minSelectedRecords}-{contract.maxSelectedRecords} records;{" "}
              {affectedRecords.length} selected
            </dd>
          </div>
          <div>
            <dt>Batch limit</dt>
            <dd>
              {contract.maxBatchSize
                ? `${contract.maxBatchSize} record${contract.maxBatchSize === 1 ? "" : "s"} per execution`
                : "No direct mutation batch"}
            </dd>
          </div>
          <div>
            <dt>Dependencies</dt>
            <dd>{contract.dependencies.join("; ")}</dd>
          </div>
          <div>
            <dt>Blocked / skipped reason</dt>
            <dd>{blockedOrSkippedReason}</dd>
          </div>
          <div>
            <dt>Rollback</dt>
            <dd>{command.rollback.replace(/-/g, " ")}</dd>
          </div>
          <div>
            <dt>Confirmation time</dt>
            <dd>{new Date().toLocaleString()}</dd>
          </div>
        </dl>
      </details>
      <div>
        <button
          data-admin-ai-confirm-cancel="true"
          onClick={onCancel}
          ref={cancelButtonRef}
          type="button"
        >
          Cancel
        </button>
        <button
          data-primary="true"
          disabled={directExecutionBlocked}
          onClick={onConfirm}
          type="button"
        >
          {copy.confirmLabel}
        </button>
      </div>
    </section>
  );
}

function formatContractValue(value: string) {
  return value.replace(/-/g, " ");
}

function formatExecutionAvailability(
  availability: AdminAICommand["executionContract"]["availability"]
) {
  if (availability === "executable") return "Registered execution available";
  if (availability === "review-only") return "Review only - direct execution disabled";
  return "No direct mutation";
}
