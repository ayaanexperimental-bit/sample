"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdminPaidMasterclassLink } from "../../lib/admin-control-center";
import type { AdminV2ActionActivityInput } from "../../lib/admin-v2-access";
import styles from "./admin-v2-production-parity.module.css";

const ADMIN_CSRF_HEADER_NAME = "x-yw-admin-csrf";
const OWNER_ONLY_PERMISSIONS = new Set(["admin_users.manage", "security.strict_roles"]);

type NativeDialogProps = {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  theme: "dark" | "light";
  title: string;
  tone?: "danger" | "standard";
};

function AdminV2NativeDialog({
  children,
  footer,
  onClose,
  open,
  theme,
  title,
  tone = "standard"
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.dialogBackdrop}
      data-od-theme={theme}
      data-tone={tone}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.dialogPanel}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.dialogHeader}>
          <div>
            <span>Protected admin action</span>
            <h3 id={titleId}>{title}</h3>
          </div>
          <button
            aria-label={`Close ${title}`}
            className="btn btn-sm"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
        {footer ? <footer className={styles.dialogFooter}>{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

type AdminMaintenanceRoleChecklist = {
  adminEmailPresent: boolean;
  adminEmailRole: string;
  adminEmailStatus: string;
  adminRoleTableExists: boolean;
  currentAdminEmailMasked: string;
  lockoutRisk: "high" | "low" | "medium";
  rollbackInstructions: string[];
  roleRequirementMet: boolean;
  strictDbRolesEnabled: boolean;
};

type AdminMaintenanceStatus = {
  activeAdminRecipientCount: number;
  backupDestination: string;
  backupDownloadUrl: string | null;
  backupXlsDownloadUrl: string | null;
  backupEmailConfigured: boolean;
  cleanupEligibleAnalyticsEvents: number;
  cleanupStatus: string;
  failedRecipients: string[];
  includeShopDataByDefault: boolean;
  lastBackupAt: string;
  lastBackupRecordCount: number;
  lastBackupStatus: string;
  lastCleanupAt: string;
  lastCleanupDeletedCount: number;
  lastErrorReportCleanupAt: string;
  lastErrorReportCleanupDeletedCount: number;
  lastShopBackupAt: string;
  lastShopBackupRecordCount: number;
  maskedRecipients: string[];
  rawRecipientRoles: Array<{ maskedEmail: string; role: string; status: string }>;
  retentionDays: number;
  roleChecklist: AdminMaintenanceRoleChecklist;
  scheduledCleanup: string;
};

type BackupCleanupPayload = {
  backupCleanup?: AdminMaintenanceStatus;
  deletedCount?: number;
  error?: string;
  notificationStatus?: string;
  ok?: boolean;
  recordCount?: number;
};

export function AdminV2MaintenancePanel({
  csrfToken,
  onAdminActivity,
  onOpenReports,
  theme
}: {
  csrfToken: string;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  onOpenReports: () => void;
  theme: "dark" | "light";
}) {
  const [status, setStatus] = useState<AdminMaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"" | "backup" | "cleanup" | "test_backup_email">("");
  const [confirmAction, setConfirmAction] = useState<
    "" | "backup" | "cleanup" | "test_backup_email"
  >("");
  const [includeShopData, setIncludeShopData] = useState(true);
  const [message, setMessage] = useState("");

  async function requestMaintenanceStatus() {
    const response = await fetch("/api/admin/backup-cleanup", {
      cache: "no-store",
      credentials: "include"
    });
    const payload = (await response.json().catch(() => ({}))) as BackupCleanupPayload;
    if (!response.ok || !payload.backupCleanup) {
      throw new Error(payload.error || "Backup and cleanup status is unavailable.");
    }
    return payload.backupCleanup;
  }

  useEffect(() => {
    let active = true;
    void requestMaintenanceStatus()
      .then((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        setIncludeShopData(nextStatus.includeShopDataByDefault);
        setMessage("");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setMessage(
          caught instanceof Error ? caught.message : "Backup and cleanup status is unavailable."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function runMaintenanceAction(action: "backup" | "cleanup" | "test_backup_email") {
    setBusyAction(action);
    setMessage("");
    onAdminActivity({
      detail:
        action === "backup"
          ? "Analytics and Shop backup started."
          : action === "cleanup"
            ? "Backup-first analytics cleanup started."
            : "Test backup email started.",
      label: "Backup and cleanup",
      status: "working"
    });
    try {
      const response = await fetch("/api/admin/backup-cleanup", {
        body: JSON.stringify({ action, includeShopData }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          [ADMIN_CSRF_HEADER_NAME]: csrfToken
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as BackupCleanupPayload;
      if (payload.backupCleanup) setStatus(payload.backupCleanup);
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Maintenance action failed safely.");

      const successMessage =
        action === "backup"
          ? `Backup completed for ${payload.recordCount || 0} records. ${payload.notificationStatus || "Notification status not returned."}`
          : action === "cleanup"
            ? `${payload.deletedCount || 0} old analytics events cleaned after backup verification.`
            : "Test backup email sent to active admin recipients.";
      setMessage(successMessage);
      setConfirmAction("");
      onAdminActivity({ detail: successMessage, label: "Backup and cleanup", status: "success" });
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Maintenance action failed safely.";
      setMessage(error);
      onAdminActivity({ detail: error, label: "Backup and cleanup", status: "error" });
    } finally {
      setBusyAction("");
    }
  }

  const checklist = status?.roleChecklist;

  return (
    <div className={styles.parityStack} data-parity-panel="maintenance">
      <section className={styles.commandStrip}>
        <div>
          <span className="badge badge-accent">Production maintenance</span>
          <h3>Backup-first retention control</h3>
          <p>
            CSV/XLS backup, active-admin delivery checks, cleanup and downloads use the protected
            production API.
          </p>
        </div>
        <button className="btn btn-sm" onClick={onOpenReports} type="button">
          Open error reports
        </button>
      </section>

      <div className="grid grid-3">
        <ParityMetric
          label="Retention"
          value={status ? `${status.retentionDays} days` : "--"}
          note="Raw analytics policy"
        />
        <ParityMetric
          label="Eligible records"
          value={(status?.cleanupEligibleAnalyticsEvents || 0).toLocaleString("en-IN")}
          note={status?.cleanupStatus || "Loading cleanup status"}
        />
        <ParityMetric
          label="Active recipients"
          value={(status?.activeAdminRecipientCount || 0).toLocaleString("en-IN")}
          note={
            status?.backupEmailConfigured ? "Email channel configured" : "Email channel missing"
          }
        />
      </div>

      <div className={styles.splitGrid}>
        <section className={styles.parityCard}>
          <header>
            <span>Manual maintenance</span>
            <h3>Backup and cleanup controls</h3>
          </header>
          <label className={styles.field}>
            Include Shop records in backup
            <select
              aria-label="Include Shop records in backup"
              disabled={Boolean(busyAction)}
              onChange={(event) => setIncludeShopData(event.currentTarget.value === "yes")}
              value={includeShopData ? "yes" : "no"}
            >
              <option value="yes">
                Yes - analytics, purchases, sites, settings audit and failures
              </option>
              <option value="no">No - analytics only</option>
            </select>
          </label>
          <dl className={styles.definitionGrid}>
            <Definition label="Last backup" value={status?.lastBackupAt || "Not loaded"} />
            <Definition label="Backup status" value={status?.lastBackupStatus || "Not loaded"} />
            <Definition
              label="Backed-up records"
              value={(status?.lastBackupRecordCount || 0).toLocaleString("en-IN")}
            />
            <Definition label="Last cleanup" value={status?.lastCleanupAt || "Not loaded"} />
            <Definition
              label="Deleted analytics"
              value={(status?.lastCleanupDeletedCount || 0).toLocaleString("en-IN")}
            />
            <Definition
              label="Scheduled cleanup"
              value={status?.scheduledCleanup || "Not loaded"}
            />
          </dl>
          <div className={styles.actionRow}>
            <button
              className="btn btn-sm btn-primary"
              disabled={Boolean(busyAction)}
              onClick={() => setConfirmAction("backup")}
              type="button"
            >
              Run backup now
            </button>
            <button
              className="btn btn-sm"
              disabled={Boolean(busyAction) || !status?.backupEmailConfigured}
              onClick={() => setConfirmAction("test_backup_email")}
              type="button"
            >
              Send test email
            </button>
            <button
              className={styles.dangerButton}
              disabled={Boolean(busyAction)}
              onClick={() => setConfirmAction("cleanup")}
              type="button"
            >
              Run protected cleanup
            </button>
          </div>
          <div className={styles.actionRow}>
            {status?.backupDownloadUrl ? (
              <a className="btn btn-sm" href={status.backupDownloadUrl}>
                Download latest CSV
              </a>
            ) : null}
            {status?.backupXlsDownloadUrl ? (
              <a className="btn btn-sm" href={status.backupXlsDownloadUrl}>
                Download latest XLS
              </a>
            ) : null}
          </div>
        </section>

        <section className={styles.parityCard}>
          <header>
            <span>Safety contract</span>
            <h3>Recipients and strict-role readiness</h3>
          </header>
          <div className={styles.recipientList}>
            {status?.rawRecipientRoles.length ? (
              status.rawRecipientRoles.map((recipient) => (
                <span key={`${recipient.maskedEmail}-${recipient.role}`}>
                  <strong>{recipient.maskedEmail}</strong>
                  <small>
                    {recipient.role} / {recipient.status}
                  </small>
                </span>
              ))
            ) : (
              <span>
                <strong>No active recipients returned</strong>
                <small>Cleanup remains protected by server checks.</small>
              </span>
            )}
          </div>
          <div className={styles.checkGrid}>
            {[
              ["DB role table", checklist?.adminRoleTableExists],
              ["Current admin row", checklist?.adminEmailPresent],
              ["Role requirement", checklist?.roleRequirementMet],
              ["Strict DB roles", checklist?.strictDbRolesEnabled]
            ].map(([label, ready]) => (
              <div data-ready={ready ? "true" : "false"} key={String(label)}>
                <strong>{String(label)}</strong>
                <span>{ready ? "Ready" : "Review"}</span>
              </div>
            ))}
          </div>
          <dl className={styles.definitionGrid}>
            <Definition
              label="Current admin"
              value={checklist?.currentAdminEmailMasked || "Not loaded"}
            />
            <Definition label="DB role" value={checklist?.adminEmailRole || "Not loaded"} />
            <Definition label="DB status" value={checklist?.adminEmailStatus || "Not loaded"} />
            <Definition label="Lockout risk" value={checklist?.lockoutRisk || "Not loaded"} />
          </dl>
        </section>
      </div>

      {loading ? (
        <p className={styles.statusLine} role="status">
          Loading protected maintenance status...
        </p>
      ) : null}
      {message ? (
        <p className={styles.statusLine} role="status">
          {message}
        </p>
      ) : null}

      <AdminV2NativeDialog
        footer={
          <>
            <button
              className="btn btn-sm"
              disabled={Boolean(busyAction)}
              onClick={() => setConfirmAction("")}
              type="button"
            >
              Cancel
            </button>
            <button
              className={
                confirmAction === "cleanup" ? styles.dangerButton : "btn btn-sm btn-primary"
              }
              disabled={!confirmAction || Boolean(busyAction)}
              onClick={() => confirmAction && void runMaintenanceAction(confirmAction)}
              type="button"
            >
              {busyAction
                ? "Working..."
                : confirmAction === "cleanup"
                  ? "Run protected cleanup"
                  : confirmAction === "test_backup_email"
                    ? "Send test email"
                    : "Run backup"}
            </button>
          </>
        }
        onClose={() => !busyAction && setConfirmAction("")}
        open={Boolean(confirmAction)}
        theme={theme}
        title={
          confirmAction === "cleanup"
            ? "Confirm backup-first cleanup"
            : confirmAction === "test_backup_email"
              ? "Confirm test backup email"
              : "Confirm analytics backup"
        }
        tone={confirmAction === "cleanup" ? "danger" : "standard"}
      >
        <p className={styles.dialogCopy}>
          {confirmAction === "cleanup"
            ? "The server will create and verify a backup before deleting eligible raw analytics. Coach sites, users, payments, links and lifetime summaries are excluded from cleanup."
            : confirmAction === "test_backup_email"
              ? "This sends a non-destructive test backup message to active admin recipients."
              : `This creates protected CSV and XLS backup files${includeShopData ? " including Shop records" : " for analytics only"}. No cleanup runs.`}
        </p>
      </AdminV2NativeDialog>
    </div>
  );
}

type PrivateLinkMetadata = {
  configured: boolean;
  entryCode: string;
  funnelId: string;
  paymentPageConfigured: boolean;
  paymentPageStorageSource: "d1_table" | "none";
  paymentPageUpdatedAt: string | null;
  paymentPageUpdatedBy: string;
  storageSource: "d1_table" | "none";
  updatedAt: string | null;
  updatedBy: string;
};

export function AdminV2PaidMasterclassPanel({
  csrfToken,
  links,
  onAdminActivity,
  source,
  theme
}: {
  csrfToken: string;
  links: AdminPaidMasterclassLink[];
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  source: string;
  theme: "dark" | "light";
}) {
  const [metadata, setMetadata] = useState<Record<string, PrivateLinkMetadata>>({});
  const [managed, setManaged] = useState<AdminPaidMasterclassLink | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [otp, setOtp] = useState("");
  const [paymentDraft, setPaymentDraft] = useState("");
  const [whatsappDraft, setWhatsappDraft] = useState("");
  const [revealedUrl, setRevealedUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadMetadata() {
      try {
        const response = await fetch("/api/admin/masterclass-private-link", {
          cache: "no-store",
          credentials: "include"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          links?: PrivateLinkMetadata[];
          ok?: boolean;
        };
        if (active && response.ok && payload.ok && payload.links) {
          setMetadata(Object.fromEntries(payload.links.map((item) => [item.funnelId, item])));
        }
      } catch {
        if (active) setMessage("Protected paid-link metadata is unavailable.");
      }
    }
    void loadMetadata();
    return () => {
      active = false;
    };
  }, []);

  const activeLinks = links.filter((link) => link.status !== "archived");
  const managedMetadata = managed ? metadata[managed.funnelId] : undefined;

  async function postPaidAction(
    action: "reveal" | "send_otp" | "update_payment" | "update_whatsapp"
  ) {
    if (!managed || busyAction) return;
    setBusyAction(action);
    setMessage("");
    setRevealedUrl("");
    onAdminActivity({
      detail: `${action.replace(/_/g, " ")} started for ${managed.displayName}.`,
      label: "Payments",
      status: "working"
    });
    const body =
      action === "send_otp"
        ? { action, entryPath: managed.entryPath }
        : action === "reveal"
          ? { action, entryPath: managed.entryPath, otp }
          : action === "update_payment"
            ? { action, entryCode: managed.entryCode, otp, paymentPageUrl: paymentDraft }
            : { action, entryCode: managed.entryCode, otp, whatsappGroupUrl: whatsappDraft };
    try {
      const response = await fetch("/api/admin/masterclass-private-link", {
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json", [ADMIN_CSRF_HEADER_NAME]: csrfToken },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        expiresInSeconds?: number;
        joinUrl?: string;
        message?: string;
        metadata?: PrivateLinkMetadata;
        ok?: boolean;
      };
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || "Protected paid-link action failed safely.");
      if (payload.metadata)
        setMetadata((current) => ({ ...current, [payload.metadata!.funnelId]: payload.metadata! }));
      if (payload.joinUrl) {
        setRevealedUrl(payload.joinUrl);
        window.setTimeout(() => setRevealedUrl(""), (payload.expiresInSeconds || 20) * 1000);
      }
      if (action !== "send_otp") setOtp("");
      if (action === "update_payment") setPaymentDraft("");
      if (action === "update_whatsapp") setWhatsappDraft("");
      const success =
        payload.message ||
        (action === "reveal"
          ? "Private link revealed temporarily."
          : action === "update_payment"
            ? "Payment link saved server-side."
            : action === "update_whatsapp"
              ? "Private WhatsApp link saved server-side."
              : "OTP sent to the current admin email.");
      setMessage(success);
      onAdminActivity({ detail: success, label: "Payments", status: "success" });
    } catch (caught) {
      const error =
        caught instanceof Error ? caught.message : "Protected paid-link action failed safely.";
      setMessage(error);
      onAdminActivity({ detail: error, label: "Payments", status: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(
        value.startsWith("http") ? value : new URL(value, window.location.origin).toString()
      );
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`${label}: ${value}`);
    }
  }

  return (
    <div className={styles.parityStack} data-parity-panel="payments">
      <div className="grid grid-3">
        <ParityMetric
          label="Active funnels"
          value={activeLinks.length.toLocaleString("en-IN")}
          note="Paid masterclass rows"
        />
        <ParityMetric
          label="Payment links"
          value={activeLinks
            .filter(
              (link) =>
                metadata[link.funnelId]?.paymentPageConfigured ?? link.paymentStatus !== "missing"
            )
            .length.toLocaleString("en-IN")}
          note="Server redirect controlled"
        />
        <ParityMetric
          label="Private groups"
          value={activeLinks
            .filter(
              (link) =>
                metadata[link.funnelId]?.configured ?? link.privateWhatsappStatus !== "missing"
            )
            .length.toLocaleString("en-IN")}
          note={source}
        />
      </div>
      <section className={styles.parityCard}>
        <header>
          <span>Private access</span>
          <h3>Masterclass link matrix</h3>
          <p>
            Public paths are visible; private destinations stay server-side until OTP verification.
          </p>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Coach</th>
                <th>Entry</th>
                <th>Payment</th>
                <th>Private group</th>
                <th>Success</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeLinks.length ? (
                activeLinks.map((link) => {
                  const row = metadata[link.funnelId];
                  return (
                    <tr key={link.funnelId}>
                      <td data-label="Coach">
                        <strong>{link.displayName || link.coachName}</strong>
                        <small>{link.entryCode}</small>
                      </td>
                      <td data-label="Entry">
                        <code>{link.entryPath}</code>
                      </td>
                      <td data-label="Payment">
                        <span
                          className={`badge ${row?.paymentPageConfigured ? "badge-accent" : "badge-warning"}`}
                        >
                          {row?.paymentPageConfigured ? "Configured" : link.paymentStatus}
                        </span>
                      </td>
                      <td data-label="Private group">
                        <span
                          className={`badge ${row?.configured ? "badge-accent" : "badge-warning"}`}
                        >
                          {row?.configured ? "Configured" : link.privateWhatsappStatus}
                        </span>
                      </td>
                      <td data-label="Success">
                        <code>{link.successPath}</code>
                      </td>
                      <td data-label="Actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setManaged(link);
                            setOtp("");
                            setMessage("");
                            setRevealedUrl("");
                          }}
                          type="button"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>No paid masterclass rows returned by the protected source.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {message && !managed ? (
        <p className={styles.statusLine} role="status">
          {message}
        </p>
      ) : null}

      <AdminV2NativeDialog
        footer={
          <button
            className="btn btn-sm"
            disabled={Boolean(busyAction)}
            onClick={() => setManaged(null)}
            type="button"
          >
            Done
          </button>
        }
        onClose={() => !busyAction && setManaged(null)}
        open={Boolean(managed)}
        theme={theme}
        title="Manage paid masterclass"
      >
        {managed ? (
          <div className={styles.parityStack}>
            <section className={styles.commandStrip}>
              <div>
                <span className="badge badge-accent">{managed.entryCode}</span>
                <h3>{managed.displayName}</h3>
                <p>{managed.coachName}</p>
              </div>
              <div className={styles.actionRow}>
                <button
                  className="btn btn-sm"
                  onClick={() => window.open(managed.entryPath, "_blank", "noopener,noreferrer")}
                  type="button"
                >
                  Open entry
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => window.open(managed.paidPagePath, "_blank", "noopener,noreferrer")}
                  type="button"
                >
                  Open paid page
                </button>
              </div>
            </section>
            <div className={styles.definitionGrid}>
              <Definition
                label="Payment storage"
                value={managedMetadata?.paymentPageStorageSource || managed.paymentStorageSource}
              />
              <Definition
                label="Payment updated"
                value={
                  managedMetadata?.paymentPageUpdatedAt ||
                  managed.paymentLastChangedAt ||
                  "Not recorded"
                }
              />
              <Definition
                label="WhatsApp storage"
                value={managedMetadata?.storageSource || managed.privateWhatsappStorageSource}
              />
              <Definition
                label="WhatsApp updated"
                value={
                  managedMetadata?.updatedAt ||
                  managed.privateWhatsappLastChangedAt ||
                  "Not recorded"
                }
              />
            </div>
            <div className={styles.actionRow}>
              <button
                className="btn btn-sm"
                onClick={() => void copyValue("Entry link", managed.entryPath)}
                type="button"
              >
                Copy entry
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void copyValue("Paid page", managed.paidPagePath)}
                type="button"
              >
                Copy paid page
              </button>
              <button
                className="btn btn-sm"
                onClick={() => void copyValue("Success page", managed.successPath)}
                type="button"
              >
                Copy success page
              </button>
            </div>
            <label className={styles.field}>
              Admin OTP
              <input
                aria-label="Admin OTP"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setOtp(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit code"
                value={otp}
              />
            </label>
            <div className={styles.actionRow}>
              <button
                className="btn btn-sm btn-primary"
                disabled={Boolean(busyAction)}
                onClick={() => void postPaidAction("send_otp")}
                type="button"
              >
                {busyAction === "send_otp" ? "Sending..." : "Send OTP"}
              </button>
              <button
                className="btn btn-sm"
                disabled={Boolean(busyAction) || otp.length !== 6}
                onClick={() => void postPaidAction("reveal")}
                type="button"
              >
                {busyAction === "reveal" ? "Revealing..." : "Reveal private link"}
              </button>
              {revealedUrl ? (
                <button
                  className="btn btn-sm"
                  onClick={() => void copyValue("Private WhatsApp", revealedUrl)}
                  type="button"
                >
                  Copy revealed link
                </button>
              ) : null}
            </div>
            {revealedUrl ? <code className={styles.revealedSecret}>{revealedUrl}</code> : null}
            <div className={styles.splitGrid}>
              <label className={styles.field}>
                New payment page URL
                <input
                  aria-label="New payment page URL"
                  onChange={(event) => setPaymentDraft(event.currentTarget.value)}
                  placeholder="https://pages.razorpay.com/..."
                  value={paymentDraft}
                />
                <button
                  className="btn btn-sm"
                  disabled={Boolean(busyAction) || otp.length !== 6 || !paymentDraft.trim()}
                  onClick={() => void postPaidAction("update_payment")}
                  type="button"
                >
                  {busyAction === "update_payment" ? "Saving..." : "Save payment link"}
                </button>
              </label>
              <label className={styles.field}>
                New private WhatsApp URL
                <input
                  aria-label="New private WhatsApp URL"
                  onChange={(event) => setWhatsappDraft(event.currentTarget.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  value={whatsappDraft}
                />
                <button
                  className="btn btn-sm"
                  disabled={Boolean(busyAction) || otp.length !== 6 || !whatsappDraft.trim()}
                  onClick={() => void postPaidAction("update_whatsapp")}
                  type="button"
                >
                  {busyAction === "update_whatsapp" ? "Saving..." : "Save private link"}
                </button>
              </label>
            </div>
            {message ? (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminV2NativeDialog>
    </div>
  );
}

type PermissionDefinition = { description: string; key: string; label: string; module: string };
type RoleTemplate = { description: string; key: string; label: string; permissions: string[] };
type ManagedAdmin = {
  backupNotificationsEnabled: boolean;
  createdAt: string;
  displayName: string;
  email: string;
  firstName: string;
  isOwner: boolean;
  lastLoginAt: string;
  lastName: string;
  note: string;
  permissions: string[];
  phone: string;
  receiveSecurityBackup: boolean;
  roleKey: string;
  status: "active" | "disabled" | "inactive";
  statusLabel: string;
};
type ManagedInvite = {
  createdAt: string;
  email: string;
  expiresAt: string;
  firstName: string;
  id: string;
  lastName: string;
  permissionCount: number;
  resendCount: number;
  roleKey: string;
  sentAt: string;
  status: string;
};
type AdminUsersPayload = {
  admins?: ManagedAdmin[];
  error?: string;
  invites?: ManagedInvite[];
  ok?: boolean;
  permissionDefinitions?: PermissionDefinition[];
  roleTemplates?: RoleTemplate[];
  strictRolePreflight?: {
    currentAdminEmail: string;
    dbConfigured: boolean;
    ownerVerified: boolean;
    strictDbRolesEnabled: boolean;
  };
};
type AdminFormState = {
  backupNotificationsEnabled: boolean;
  email: string;
  firstName: string;
  lastName: string;
  note: string;
  permissions: string[];
  phone: string;
  receiveSecurityBackup: boolean;
  roleKey: string;
};
const EMPTY_ADMIN_FORM: AdminFormState = {
  backupNotificationsEnabled: true,
  email: "",
  firstName: "",
  lastName: "",
  note: "",
  permissions: ["overview.view"],
  phone: "",
  receiveSecurityBackup: false,
  roleKey: "custom"
};

export function AdminV2AdminUsersPanel({
  csrfToken,
  onAdminActivity,
  theme
}: {
  csrfToken: string;
  onAdminActivity: (activity: AdminV2ActionActivityInput) => void;
  theme: "dark" | "light";
}) {
  const [payload, setPayload] = useState<AdminUsersPayload>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [formMode, setFormMode] = useState<"" | "edit" | "invite">("");
  const [form, setForm] = useState<AdminFormState>(EMPTY_ADMIN_FORM);
  const [confirmAction, setConfirmAction] = useState<{
    action:
      | "delete_admin"
      | "reactivate_admin"
      | "revoke_admin"
      | "revoke_invite"
      | "suspend_admin";
    email?: string;
    inviteId?: string;
    title: string;
  } | null>(null);

  async function requestUsersPayload() {
    const response = await fetch("/api/admin/users", {
      cache: "no-store",
      credentials: "include"
    });
    const next = (await response.json().catch(() => ({}))) as AdminUsersPayload;
    if (!response.ok || !next.ok) {
      throw new Error(next.error || "Admin users could not be loaded.");
    }
    return next;
  }

  async function loadUsers() {
    try {
      const next = await requestUsersPayload();
      setPayload(next);
      setMessage("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Admin users could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void requestUsersPayload()
      .then((next) => {
        if (!active) return;
        setPayload(next);
        setMessage("");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setMessage(caught instanceof Error ? caught.message : "Admin users could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of payload.permissionDefinitions || []) {
      if (OWNER_ONLY_PERMISSIONS.has(permission.key)) continue;
      groups.set(permission.module, [...(groups.get(permission.module) || []), permission]);
    }
    return Array.from(groups.entries());
  }, [payload.permissionDefinitions]);

  function rolePermissions(roleKey: string) {
    return (
      (payload.roleTemplates || [])
        .find((role) => role.key === roleKey)
        ?.permissions.filter((permission) => !OWNER_ONLY_PERMISSIONS.has(permission)) || [
        "overview.view"
      ]
    );
  }

  function openInvite() {
    setForm({
      ...EMPTY_ADMIN_FORM,
      permissions: rolePermissions("website_creator"),
      roleKey: "website_creator"
    });
    setFormMode("invite");
    setMessage("");
  }

  function openEdit(admin: ManagedAdmin) {
    setForm({
      backupNotificationsEnabled: admin.backupNotificationsEnabled,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      note: admin.note,
      permissions: admin.permissions,
      phone: admin.phone,
      receiveSecurityBackup: admin.receiveSecurityBackup,
      roleKey: admin.roleKey
    });
    setFormMode("edit");
    setMessage("");
  }

  function selectRole(roleKey: string) {
    setForm((current) => ({ ...current, permissions: rolePermissions(roleKey), roleKey }));
  }

  function togglePermission(permission: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
      roleKey: "custom"
    }));
  }

  async function requestUsersAction(
    input: {
      action: string;
      email?: string;
      invite?: AdminFormState;
      inviteId?: string;
      user?: AdminFormState;
    },
    method: "PATCH" | "POST"
  ) {
    const action = input.action;
    setBusyAction(action);
    setMessage("");
    onAdminActivity({
      detail: `${action.replace(/_/g, " ")} started.`,
      label: "Admin users",
      status: "working"
    });
    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify(input),
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json", [ADMIN_CSRF_HEADER_NAME]: csrfToken },
        method
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        ok?: boolean;
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error || "Admin user action failed safely.");
      const success = result.message || "Admin user action completed.";
      setMessage(success);
      setFormMode("");
      setConfirmAction(null);
      onAdminActivity({ detail: success, label: "Admin users", status: "success" });
      await loadUsers();
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : "Admin user action failed safely.";
      setMessage(error);
      onAdminActivity({ detail: error, label: "Admin users", status: "error" });
    } finally {
      setBusyAction("");
    }
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (formMode === "invite")
      await requestUsersAction({ action: "create_invite", invite: form }, "POST");
    if (formMode === "edit")
      await requestUsersAction({ action: "update_admin", user: form }, "PATCH");
  }

  async function resendInvite(invite: ManagedInvite) {
    await requestUsersAction({ action: "resend_invite", inviteId: invite.id }, "POST");
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    await requestUsersAction(
      {
        action: confirmAction.action,
        email: confirmAction.email,
        inviteId: confirmAction.inviteId
      },
      "PATCH"
    );
  }

  const admins = payload.admins || [];
  const invites = payload.invites || [];
  const preflight = payload.strictRolePreflight;

  return (
    <div className={styles.parityStack} data-parity-panel="admin-users">
      <section className={styles.commandStrip}>
        <div>
          <span className="badge badge-accent">Owner-only control</span>
          <h3>Admin users and permissions</h3>
          <p>
            Invites, role templates, explicit permissions and lifecycle controls use the protected
            production API.
          </p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={openInvite} type="button">
          Invite admin
        </button>
      </section>
      <div className="grid grid-3">
        <ParityMetric
          label="Managed admins"
          value={admins.length.toLocaleString("en-IN")}
          note="Owner remains immutable"
        />
        <ParityMetric
          label="Pending invites"
          value={invites
            .filter((invite) => !["active", "verified", "revoked"].includes(invite.status))
            .length.toLocaleString("en-IN")}
          note="One-time hashed links"
        />
        <ParityMetric
          label="Strict DB roles"
          value={preflight?.strictDbRolesEnabled ? "On" : "Off"}
          note={preflight?.ownerVerified ? "Owner row verified" : "Owner row needs review"}
        />
      </div>

      <section className={styles.parityCard}>
        <header>
          <span>Active directory</span>
          <h3>Managed administrators</h3>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.length ? (
                admins.map((admin) => (
                  <tr key={admin.email}>
                    <td data-label="Admin">
                      <strong>{admin.displayName || admin.email}</strong>
                      <small>{admin.email}</small>
                    </td>
                    <td data-label="Role">{admin.isOwner ? "Root owner" : admin.roleKey}</td>
                    <td data-label="Permissions">
                      {admin.isOwner ? "All" : admin.permissions.length}
                    </td>
                    <td data-label="Status">
                      <span
                        className={`badge ${admin.status === "active" ? "badge-accent" : "badge-warning"}`}
                      >
                        {admin.statusLabel || admin.status}
                      </span>
                    </td>
                    <td data-label="Last login">{admin.lastLoginAt || "Never"}</td>
                    <td data-label="Actions">
                      <div className={styles.actionRow}>
                        <button
                          className="btn btn-sm"
                          disabled={admin.isOwner}
                          onClick={() => openEdit(admin)}
                          type="button"
                        >
                          Edit
                        </button>
                        {admin.status === "active" ? (
                          <button
                            className="btn btn-sm"
                            disabled={admin.isOwner}
                            onClick={() =>
                              setConfirmAction({
                                action: "suspend_admin",
                                email: admin.email,
                                title: `Suspend ${admin.email}`
                              })
                            }
                            type="button"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm"
                            disabled={admin.isOwner}
                            onClick={() =>
                              setConfirmAction({
                                action: "reactivate_admin",
                                email: admin.email,
                                title: `Reactivate ${admin.email}`
                              })
                            }
                            type="button"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          disabled={admin.isOwner || admin.status === "inactive"}
                          onClick={() =>
                            setConfirmAction({
                              action: "revoke_admin",
                              email: admin.email,
                              title: `Revoke ${admin.email}`
                            })
                          }
                          type="button"
                        >
                          Revoke
                        </button>
                        <button
                          className={styles.dangerButton}
                          disabled={admin.isOwner || admin.status !== "inactive"}
                          onClick={() =>
                            setConfirmAction({
                              action: "delete_admin",
                              email: admin.email,
                              title: `Delete ${admin.email}`
                            })
                          }
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    {loading ? "Loading managed admins..." : "No managed admins returned."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.parityCard}>
        <header>
          <span>Invite queue</span>
          <h3>Pending and historical invites</h3>
        </header>
        <div className={styles.inviteGrid}>
          {invites.length ? (
            invites.map((invite) => (
              <article key={invite.id}>
                <span
                  className={`badge ${invite.status === "sent" || invite.status === "delivered" ? "badge-accent" : "badge-warning"}`}
                >
                  {invite.status}
                </span>
                <strong>
                  {invite.firstName || invite.lastName
                    ? `${invite.firstName} ${invite.lastName}`.trim()
                    : invite.email}
                </strong>
                <small>{invite.email}</small>
                <p>
                  {invite.roleKey} / {invite.permissionCount} permissions / resend{" "}
                  {invite.resendCount}/3
                </p>
                <div className={styles.actionRow}>
                  <button
                    className="btn btn-sm"
                    disabled={
                      invite.resendCount >= 3 ||
                      ["active", "verified", "revoked"].includes(invite.status)
                    }
                    onClick={() => void resendInvite(invite)}
                    type="button"
                  >
                    Resend
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={["active", "verified", "revoked"].includes(invite.status)}
                    onClick={() =>
                      setConfirmAction({
                        action: "revoke_invite",
                        inviteId: invite.id,
                        title: `Revoke invite for ${invite.email}`
                      })
                    }
                    type="button"
                  >
                    Revoke invite
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p>No admin invites yet.</p>
          )}
        </div>
      </section>
      {message ? (
        <p className={styles.statusLine} role="status">
          {message}
        </p>
      ) : null}

      <AdminV2NativeDialog
        footer={
          <>
            <button
              className="btn btn-sm"
              disabled={Boolean(busyAction)}
              onClick={() => setFormMode("")}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={Boolean(busyAction)}
              form="admin-v2-user-form"
              type="submit"
            >
              {busyAction ? "Saving..." : formMode === "invite" ? "Send invite" : "Save admin"}
            </button>
          </>
        }
        onClose={() => !busyAction && setFormMode("")}
        open={Boolean(formMode)}
        theme={theme}
        title={formMode === "invite" ? "Invite administrator" : "Edit administrator"}
      >
        <form className={styles.parityStack} id="admin-v2-user-form" onSubmit={submitForm}>
          <div className={styles.splitGrid}>
            <label className={styles.field}>
              First name
              <input
                required
                onChange={(event) =>
                  setForm((current) => ({ ...current, firstName: event.currentTarget.value }))
                }
                value={form.firstName}
              />
            </label>
            <label className={styles.field}>
              Last name
              <input
                required
                onChange={(event) =>
                  setForm((current) => ({ ...current, lastName: event.currentTarget.value }))
                }
                value={form.lastName}
              />
            </label>
            <label className={styles.field}>
              Admin email
              <input
                disabled={formMode === "edit"}
                required
                type="email"
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.currentTarget.value }))
                }
                value={form.email}
              />
            </label>
            <label className={styles.field}>
              Phone
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.currentTarget.value }))
                }
                value={form.phone}
              />
            </label>
          </div>
          <label className={styles.field}>
            Internal note
            <textarea
              rows={3}
              onChange={(event) =>
                setForm((current) => ({ ...current, note: event.currentTarget.value }))
              }
              value={form.note}
            />
          </label>
          <section className={styles.roleGrid} aria-label="Admin role templates">
            {(payload.roleTemplates || [])
              .filter((role) => role.key !== "owner")
              .map((role) => (
                <button
                  className="btn btn-sm"
                  data-active={form.roleKey === role.key ? "true" : undefined}
                  key={role.key}
                  onClick={() => selectRole(role.key)}
                  type="button"
                >
                  <strong>{role.label}</strong>
                  <small>{role.description}</small>
                </button>
              ))}
          </section>
          <section className={styles.permissionGrid} aria-label="Admin permissions">
            {permissionGroups.map(([module, permissions]) => (
              <fieldset key={module}>
                <legend>{module.replace(/_/g, " ")}</legend>
                {permissions.map((permission) => (
                  <label key={permission.key}>
                    <input
                      checked={form.permissions.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{permission.label}</strong>
                      <small>{permission.description}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </section>
          {formMode === "edit" ? (
            <div className={styles.checkList}>
              <label>
                <input
                  checked={form.backupNotificationsEnabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      backupNotificationsEnabled: event.currentTarget.checked
                    }))
                  }
                  type="checkbox"
                />
                Backup notifications enabled
              </label>
              <label>
                <input
                  checked={form.receiveSecurityBackup}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      receiveSecurityBackup: event.currentTarget.checked
                    }))
                  }
                  type="checkbox"
                />
                Receive security backup
              </label>
            </div>
          ) : null}
        </form>
      </AdminV2NativeDialog>

      <AdminV2NativeDialog
        footer={
          <>
            <button
              className="btn btn-sm"
              disabled={Boolean(busyAction)}
              onClick={() => setConfirmAction(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={
                confirmAction?.action === "delete_admin" ||
                confirmAction?.action === "revoke_admin" ||
                confirmAction?.action === "revoke_invite"
                  ? styles.dangerButton
                  : "btn btn-sm btn-primary"
              }
              disabled={Boolean(busyAction)}
              onClick={() => void runConfirmedAction()}
              type="button"
            >
              {busyAction ? "Working..." : "Confirm action"}
            </button>
          </>
        }
        onClose={() => !busyAction && setConfirmAction(null)}
        open={Boolean(confirmAction)}
        theme={theme}
        title={confirmAction?.title || "Confirm admin action"}
        tone={
          confirmAction?.action === "delete_admin" ||
          confirmAction?.action === "revoke_admin" ||
          confirmAction?.action === "revoke_invite"
            ? "danger"
            : "standard"
        }
      >
        <p className={styles.dialogCopy}>
          {confirmAction?.action === "delete_admin"
            ? "Permanent deletion is allowed only after the admin has been revoked. Security audit history remains retained."
            : "This lifecycle action is protected by owner RBAC, CSRF and server-side audit logging."}
        </p>
      </AdminV2NativeDialog>
    </div>
  );
}

function ParityMetric({ label, note, value }: { label: string; note: string; value: string }) {
  return (
    <article className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
