"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AdminActionDialog, AdminPageShell } from "./admin-dashboard-layout";
import styles from "./admin-dashboard-shell.module.css";

type AdminActionActivityInput = {
  detail: string;
  label: string;
  status: "error" | "success" | "working";
};

type PermissionDefinition = {
  description: string;
  key: string;
  label: string;
  module: string;
};

type RoleTemplate = {
  description: string;
  key: string;
  label: string;
  permissions: string[];
};

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

const emptyForm: AdminFormState = {
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

const moduleLabels: Record<string, string> = {
  admin_users: "Admin User Management",
  backup_cleanup: "Backup / Cleanup",
  coach_analytics: "Coach Analytics",
  coach_sites: "Coach Sites",
  error_reports: "Error Reports",
  overview: "Overview",
  paid_masterclass: "Paid Masterclass",
  security: "Security",
  settings: "Settings",
  website_creator: "Website Creator"
};

const ownerOnlyPermissionKeys = new Set(["admin_users.manage", "security.strict_roles"]);

export function AdminUserManagement({
  csrfToken,
  onAdminActivity
}: {
  csrfToken: string;
  onAdminActivity: (activity: AdminActionActivityInput) => void;
}) {
  const [admins, setAdmins] = useState<ManagedAdmin[]>([]);
  const [invites, setInvites] = useState<ManagedInvite[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [preflight, setPreflight] = useState<AdminUsersPayload["strictRolePreflight"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<ManagedAdmin | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    action: "reactivate_admin" | "revoke_admin" | "revoke_invite" | "suspend_admin";
    email?: string;
    inviteId?: string;
    label: string;
    title: string;
  } | null>(null);
  const [form, setForm] = useState<AdminFormState>(emptyForm);
  const [wizardStep, setWizardStep] = useState(1);
  const [actionProgress, setActionProgress] = useState("");

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of permissions) {
      if (ownerOnlyPermissionKeys.has(permission.key)) continue;
      groups.set(permission.module, [...(groups.get(permission.module) || []), permission]);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [permissions]);

  useEffect(() => {
    void loadAdminUsers();
  }, []);

  useEffect(() => {
    if (!message && !error) return;
    const timer = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [message, error]);

  async function loadAdminUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as AdminUsersPayload;
      if (!response.ok || !payload.ok) throw new Error("Admin user management is unavailable.");
      setAdmins(payload.admins || []);
      setInvites(payload.invites || []);
      setPermissions(payload.permissionDefinitions || []);
      setRoleTemplates((payload.roleTemplates || []).filter((role) => role.key !== "owner"));
      setPreflight(payload.strictRolePreflight);
    } catch {
      setError("Admin user management is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function openInviteWizard() {
    setForm({
      ...emptyForm,
      roleKey: "website_creator",
      permissions: getTemplatePermissions("website_creator")
    });
    setWizardStep(1);
    setActionProgress("");
    setInviteOpen(true);
  }

  function openEditAdmin(admin: ManagedAdmin) {
    if (admin.isOwner) return;
    setForm({
      backupNotificationsEnabled: admin.backupNotificationsEnabled,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      note: admin.note,
      permissions: admin.permissions || getTemplatePermissions(admin.roleKey),
      phone: admin.phone,
      receiveSecurityBackup: admin.receiveSecurityBackup,
      roleKey: admin.roleKey
    });
    setEditAdmin(admin);
    setActionProgress("");
  }

  function handleRoleChange(roleKey: string) {
    const templatePermissions = getTemplatePermissions(roleKey);
    setForm((current) => ({
      ...current,
      permissions: templatePermissions,
      roleKey
    }));
  }

  function togglePermission(permissionKey: string) {
    if (ownerOnlyPermissionKeys.has(permissionKey)) return;
    setForm((current) => {
      const next = new Set(current.permissions);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      return { ...current, permissions: Array.from(next), roleKey: "custom" };
    });
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (wizardStep < 4) {
      setWizardStep((current) => current + 1);
      return;
    }

    setBusyAction("create_invite");
    setActionProgress("Validating admin email and permissions...");
    onAdminActivity({
      detail: `Creating admin invite for ${form.email}.`,
      label: "Admin Users",
      status: "working"
    });

    try {
      await wait(350);
      setActionProgress("Creating one-time invite in the server database...");
      const result = await postAdminUsers(
        {
          action: "create_invite",
          invite: form
        },
        csrfToken
      );
      if (!result.ok) throw new Error(result.error || "Invite failed.");
      setActionProgress("Invite email sent.");
      setMessage(result.message || "Admin invite email sent.");
      setInviteOpen(false);
      onAdminActivity({
        detail: `Admin invite sent to ${form.email}.`,
        label: "Admin Users",
        status: "success"
      });
      await loadAdminUsers();
    } catch (caught) {
      const safeError = caught instanceof Error ? caught.message : "Admin invite failed.";
      setError(safeError);
      onAdminActivity({ detail: safeError, label: "Admin Users", status: "error" });
    } finally {
      setBusyAction("");
      setActionProgress("");
    }
  }

  async function submitEditAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAdmin) return;
    setBusyAction("update_admin");
    setActionProgress("Saving admin role and permission changes...");
    try {
      const result = await postAdminUsers(
        {
          action: "update_admin",
          user: form
        },
        csrfToken,
        "PATCH"
      );
      if (!result.ok) throw new Error(result.error || "Admin update failed.");
      setMessage("Admin user updated.");
      setEditAdmin(null);
      onAdminActivity({
        detail: `${form.email} permissions updated.`,
        label: "Admin Users",
        status: "success"
      });
      await loadAdminUsers();
    } catch (caught) {
      const safeError = caught instanceof Error ? caught.message : "Admin update failed.";
      setError(safeError);
      onAdminActivity({ detail: safeError, label: "Admin Users", status: "error" });
    } finally {
      setBusyAction("");
      setActionProgress("");
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    setBusyAction(confirmAction.action);
    setActionProgress(`${confirmAction.label}...`);
    try {
      const payload =
        confirmAction.action === "revoke_invite"
          ? { action: confirmAction.action, inviteId: confirmAction.inviteId }
          : { action: confirmAction.action, email: confirmAction.email };
      const result = await postAdminUsers(payload, csrfToken, "PATCH");
      if (!result.ok) throw new Error(result.error || "Admin action failed.");
      setMessage(result.message || "Admin action completed.");
      onAdminActivity({
        detail: result.message || "Admin action completed.",
        label: "Admin Users",
        status: "success"
      });
      setConfirmAction(null);
      await loadAdminUsers();
    } catch (caught) {
      const safeError = caught instanceof Error ? caught.message : "Admin action failed.";
      setError(safeError);
      onAdminActivity({ detail: safeError, label: "Admin Users", status: "error" });
    } finally {
      setBusyAction("");
      setActionProgress("");
    }
  }

  async function resendInvite(inviteId: string, email: string) {
    setBusyAction(`resend-${inviteId}`);
    try {
      const result = await postAdminUsers({ action: "resend_invite", inviteId }, csrfToken);
      if (!result.ok) throw new Error(result.error || "Invite resend failed.");
      setMessage(`Invite resent to ${email}.`);
      await loadAdminUsers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invite resend failed.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AdminPageShell
      actions={
        <button className={styles.primaryAction} onClick={openInviteWizard} type="button">
          Add New Admin
        </button>
      }
      eyebrow="Owner Controls"
      title="Admin User Management"
    >
      {message ? <p className={styles.inlineStatus}>{message}</p> : null}
      {error ? <p className={styles.linkWarning}>{error}</p> : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Security source</p>
            <h2>Owner-controlled role system</h2>
          </div>
        </div>
        <div className={styles.adminUsersGrid}>
          <div>
            <strong>{preflight?.ownerVerified ? "Owner verified" : "Owner not verified"}</strong>
            <span>Root owner cannot be deleted, suspended, demoted, revoked, or overwritten.</span>
          </div>
          <div>
            <strong>{preflight?.strictDbRolesEnabled ? "Strict DB roles on" : "Strict DB roles off"}</strong>
            <span>Strict mode is safe only when the active owner row exists in the database.</span>
          </div>
          <div>
            <strong>{preflight?.dbConfigured ? "Admin DB connected" : "Admin DB missing"}</strong>
            <span>Invites, permissions, and audit logs are server-side only.</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Admins</p>
            <h2>Active and controlled admin accounts</h2>
          </div>
        </div>
        {loading ? <p className={styles.inlineStatus}>Loading admin users...</p> : null}
        {!loading && admins.length === 0 ? (
          <p className={styles.emptyState}>No admin users found yet.</p>
        ) : (
          <div className={styles.adminUsersTableWrap}>
            <table className={styles.adminUsersTable}>
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Backup</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.email}>
                    <td>
                      <strong>{admin.displayName}</strong>
                      <span>{admin.email}</span>
                    </td>
                    <td>{getRoleLabel(admin.roleKey)}</td>
                    <td>
                      <span className={styles.statusPill} data-status={admin.status}>
                        {admin.isOwner ? "Root Owner" : admin.statusLabel}
                      </span>
                    </td>
                    <td>{admin.lastLoginAt ? formatDate(admin.lastLoginAt) : "No login yet"}</td>
                    <td>{admin.backupNotificationsEnabled ? "Receives backups" : "No backup email"}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button disabled={admin.isOwner} onClick={() => openEditAdmin(admin)} type="button">
                          Edit
                        </button>
                        {admin.status === "active" ? (
                          <button
                            disabled={admin.isOwner}
                            onClick={() =>
                              setConfirmAction({
                                action: "suspend_admin",
                                email: admin.email,
                                label: "Suspending admin",
                                title: "Suspend Admin"
                              })
                            }
                            type="button"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            disabled={admin.isOwner}
                            onClick={() =>
                              setConfirmAction({
                                action: "reactivate_admin",
                                email: admin.email,
                                label: "Reactivating admin",
                                title: "Reactivate Admin"
                              })
                            }
                            type="button"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          disabled={admin.isOwner}
                          onClick={() =>
                            setConfirmAction({
                              action: "revoke_admin",
                              email: admin.email,
                              label: "Revoking admin",
                              title: "Revoke Admin"
                            })
                          }
                          type="button"
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Invites</p>
            <h2>Pending and recent admin invitations</h2>
          </div>
        </div>
        {invites.length === 0 ? (
          <p className={styles.emptyState}>No admin invites yet.</p>
        ) : (
          <div className={styles.adminInviteList}>
            {invites.map((invite) => (
              <article key={invite.id}>
                <div>
                  <strong>{invite.email}</strong>
                  <span>
                    {getRoleLabel(invite.roleKey)} · {invite.permissionCount} permissions · expires{" "}
                    {invite.expiresAt ? formatDate(invite.expiresAt) : "soon"}
                  </span>
                </div>
                <em>{invite.status}</em>
                <div className={styles.tableActions}>
                  <button
                    disabled={busyAction === `resend-${invite.id}` || invite.resendCount >= 3}
                    onClick={() => void resendInvite(invite.id, invite.email)}
                    type="button"
                  >
                    {busyAction === `resend-${invite.id}` ? "Sending..." : "Resend"}
                  </button>
                  <button
                    disabled={invite.status === "active" || invite.status === "verified"}
                    onClick={() =>
                      setConfirmAction({
                        action: "revoke_invite",
                        inviteId: invite.id,
                        label: "Revoking invite",
                        title: "Revoke Invite"
                      })
                    }
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <AdminActionDialog
        footer={
          <>
            <button disabled={Boolean(busyAction)} onClick={() => setInviteOpen(false)} type="button">
              Cancel
            </button>
            {wizardStep > 1 ? (
              <button disabled={Boolean(busyAction)} onClick={() => setWizardStep((step) => step - 1)} type="button">
                Back
              </button>
            ) : null}
            <button form="admin-invite-form" type="submit" disabled={Boolean(busyAction)}>
              {busyAction === "create_invite" ? "Sending..." : wizardStep === 4 ? "Send Invite" : "Next"}
            </button>
          </>
        }
        onClose={() => {
          if (!busyAction) setInviteOpen(false);
        }}
        open={inviteOpen}
        size="large"
        title="Add New Admin"
      >
        <form className={styles.adminWizard} id="admin-invite-form" onSubmit={submitInvite}>
          <WizardSteps activeStep={wizardStep} />
          {wizardStep === 1 ? renderIdentityFields() : null}
          {wizardStep === 2 ? renderRoleFields() : null}
          {wizardStep === 3 ? renderPermissionMatrix() : null}
          {wizardStep === 4 ? renderReview() : null}
          {actionProgress ? <p className={styles.inlineStatus}>{actionProgress}</p> : null}
        </form>
      </AdminActionDialog>

      <AdminActionDialog
        footer={
          <>
            <button disabled={Boolean(busyAction)} onClick={() => setEditAdmin(null)} type="button">
              Cancel
            </button>
            <button form="admin-edit-form" type="submit" disabled={Boolean(busyAction)}>
              {busyAction === "update_admin" ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
        onClose={() => {
          if (!busyAction) setEditAdmin(null);
        }}
        open={Boolean(editAdmin)}
        size="large"
        title="Edit Admin Permissions"
      >
        <form className={styles.adminWizard} id="admin-edit-form" onSubmit={submitEditAdmin}>
          {renderIdentityFields(true)}
          {renderRoleFields()}
          {renderPermissionMatrix()}
          {actionProgress ? <p className={styles.inlineStatus}>{actionProgress}</p> : null}
        </form>
      </AdminActionDialog>

      <AdminActionDialog
        footer={
          <>
            <button disabled={Boolean(busyAction)} onClick={() => setConfirmAction(null)} type="button">
              Cancel
            </button>
            <button data-tone="danger" disabled={Boolean(busyAction)} onClick={() => void runConfirmedAction()} type="button">
              {busyAction ? "Working..." : "Confirm"}
            </button>
          </>
        }
        onClose={() => {
          if (!busyAction) setConfirmAction(null);
        }}
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ""}
        tone="danger"
      >
        <p className={styles.dialogCopy}>
          This updates admin access immediately. The root owner account is protected and cannot be
          changed by this action.
        </p>
        {actionProgress ? <p className={styles.inlineStatus}>{actionProgress}</p> : null}
      </AdminActionDialog>
    </AdminPageShell>
  );

  function renderIdentityFields(disableEmail = false) {
    return (
      <div className={styles.adminFormGrid}>
        <label>
          <span>Admin email</span>
          <input
            autoComplete="email"
            disabled={disableEmail}
            inputMode="email"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            required
            type="email"
            value={form.email}
          />
        </label>
        <label>
          <span>First name</span>
          <input
            autoComplete="given-name"
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            value={form.firstName}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            autoComplete="family-name"
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            value={form.lastName}
          />
        </label>
        <label>
          <span>Phone (optional)</span>
          <input
            autoComplete="tel"
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            value={form.phone}
          />
        </label>
        <label className={styles.fullWidthField}>
          <span>Internal note</span>
          <textarea
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            rows={3}
            value={form.note}
          />
        </label>
      </div>
    );
  }

  function renderRoleFields() {
    return (
      <div className={styles.adminRoleGrid}>
        {roleTemplates.map((role) => (
          <button
            data-active={form.roleKey === role.key ? "true" : "false"}
            key={role.key}
            onClick={() => handleRoleChange(role.key)}
            type="button"
          >
            <strong>{role.label}</strong>
            <span>{role.description}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderPermissionMatrix() {
    return (
      <div className={styles.permissionMatrix}>
        {permissionGroups.map(([module, items]) => (
          <fieldset key={module}>
            <legend>{moduleLabels[module] || module}</legend>
            {items.map((permission) => (
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
        <label className={styles.toggleLine}>
          <input
            checked={form.backupNotificationsEnabled}
            onChange={(event) =>
              setForm((current) => ({ ...current, backupNotificationsEnabled: event.target.checked }))
            }
            type="checkbox"
          />
          Receive backup emails
        </label>
        <label className={styles.toggleLine}>
          <input
            checked={form.receiveSecurityBackup}
            onChange={(event) =>
              setForm((current) => ({ ...current, receiveSecurityBackup: event.target.checked }))
            }
            type="checkbox"
          />
          Receive masked security backup summary
        </label>
      </div>
    );
  }

  function renderReview() {
    return (
      <div className={styles.reviewPanel}>
        <strong>{form.email}</strong>
        <span>{getRoleLabel(form.roleKey)}</span>
        <p>{form.permissions.length} permissions selected. Invite link will be one-time use, hashed server-side, and emailed through the configured provider.</p>
      </div>
    );
  }

  function getTemplatePermissions(roleKey: string) {
    return (
      roleTemplates
        .find((role) => role.key === roleKey)
        ?.permissions.filter((permission) => !ownerOnlyPermissionKeys.has(permission)) || ["overview.view"]
    );
  }

  function getRoleLabel(roleKey: string) {
    return roleTemplates.find((role) => role.key === roleKey)?.label || (roleKey === "owner" ? "Owner" : "Custom");
  }
}

function WizardSteps({ activeStep }: { activeStep: number }) {
  const steps = ["Identity", "Role", "Permissions", "Review"];
  return (
    <div className={styles.adminWizardSteps}>
      {steps.map((step, index) => (
        <span data-active={activeStep === index + 1 ? "true" : "false"} key={step}>
          {index + 1}. {step}
        </span>
      ))}
    </div>
  );
}

async function postAdminUsers(
  payload: Record<string, unknown>,
  csrfToken: string,
  method: "PATCH" | "POST" = "POST"
) {
  const response = await fetch("/api/admin/users", {
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-yw-admin-csrf": csrfToken
    },
    method
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    ok?: boolean;
  };
  if (!response.ok || !data.ok) throw new Error(data.error || "Admin user request failed.");
  return data;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
