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
  requestedBy,
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

  return (
    <section aria-label={copy.title} className={styles.confirmPanel} role="alertdialog">
      <small>Confirmation required</small>
      <h4>{copy.title}</h4>
      <p>{copy.body}</p>
      <dl>
        <div><dt>Affected records</dt><dd>{affectedRecords.length ? affectedRecords.slice(0, 5).join(", ") : "No record selected"}</dd></div>
        <div><dt>Current state</dt><dd>{currentState}</dd></div>
        <div><dt>Proposed state</dt><dd>{proposedState}</dd></div>
        <div><dt>Requested by</dt><dd>{requestedBy || "Authenticated admin"}</dd></div>
        <div><dt>Approval level</dt><dd>Level {command.approvalLevel}</dd></div>
        <div><dt>Permission check</dt><dd>{command.requiredPermissions?.join(", ") || "Current authenticated admin"}</dd></div>
        <div><dt>OTP</dt><dd>{command.otpRequired ? "Existing OTP required" : "Not required"}</dd></div>
        <div><dt>Rollback</dt><dd>{command.rollback.replace(/-/g, " ")}</dd></div>
        <div><dt>Confirmation time</dt><dd>{new Date().toLocaleString()}</dd></div>
      </dl>
      <div>
        <button onClick={onCancel} type="button">Cancel</button>
        <button data-primary="true" onClick={onConfirm} type="button">{copy.confirmLabel}</button>
      </div>
    </section>
  );
}
