"use client";

import { useState } from "react";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
import {
  AdminActionDialog,
  AdminHeader,
  type AdminNavSection,
  AdminPageShell,
  AdminSidebar
} from "./admin-dashboard-layout";
import styles from "./admin-dashboard-shell.module.css";
import {
  adminControlCenterData,
  type AdminPaidMasterclassLink,
  createErrorReportBugPrompt
} from "../../lib/admin-control-center";
import { adminDashboardData } from "../../lib/admin-dashboard-data";

type AdminDashboardShellProps = {
  csrfToken: string;
  onLogout: () => void;
  sessionEmail?: string;
};

type AdminViewId =
  | "backup-cleanup"
  | "coach-analytics"
  | "coach-sites"
  | "create-coach-site"
  | "error-reports"
  | "overview"
  | "paid-masterclass-settings"
  | "settings"
  | "top-coaches";

type ActionDialogState = {
  body: string;
  title: string;
  tone?: "danger" | "standard";
} | null;

const navSections: AdminNavSection[] = [
  {
    id: "admin-workflow",
    label: "Admin",
    items: [
      { id: "overview", label: "Overview", description: "Key metrics and alerts" },
      { id: "coach-sites", label: "Coach Sites", description: "Search and manage sites" },
      { id: "create-coach-site", label: "Create Coach Site", description: "Open builder wizard" },
      { id: "coach-analytics", label: "Coach Analytics", description: "Coach-wise metrics" },
      { id: "top-coaches", label: "Top Performers", description: "Best coaches" },
      {
        id: "paid-masterclass-settings",
        label: "Paid Masterclass Links/Settings",
        description: "Links and settings"
      },
      { id: "error-reports", label: "Error Reports", description: "Recent issues" },
      { id: "backup-cleanup", label: "Backup/Cleanup", description: "Retention controls" },
      { id: "settings", label: "Settings", description: "Admin and support basics" }
    ]
  }
];

const viewTitles: Record<AdminViewId, string> = {
  "backup-cleanup": "Backup & Cleanup",
  "coach-analytics": "Coach Analytics",
  "coach-sites": "Coach Sites",
  "create-coach-site": "Create Coach Site",
  "error-reports": "Error Reports",
  overview: "Overview",
  "paid-masterclass-settings": "Paid Masterclass Links/Settings",
  settings: "Settings",
  "top-coaches": "Top Performing Coaches"
};

export function AdminDashboardShell({
  csrfToken,
  onLogout,
  sessionEmail
}: AdminDashboardShellProps) {
  const data = adminDashboardData;
  const control = adminControlCenterData;
  const [activeView, setActiveView] = useState<AdminViewId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>(null);

  function openAction(title: string, body: string, tone: "danger" | "standard" = "standard") {
    setActionDialog({ body, title, tone });
  }

  function selectView(viewId: string) {
    setActiveView(viewId as AdminViewId);
  }

  return (
    <section className={styles.adminApp} aria-label="YW Coach admin dashboard">
      <AdminSidebar
        activeView={activeView}
        mobileOpen={mobileNavOpen}
        nav={navSections}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelect={selectView}
      />

      <div className={styles.adminMain}>
        <AdminHeader
          activeTitle={viewTitles[activeView]}
          onLogout={onLogout}
          onMenu={() => setMobileNavOpen(true)}
          sessionEmail={sessionEmail}
        />

        <p className={styles.demoNotice}>{data.demoNotice}</p>

        {activeView === "overview" ? <OverviewView data={data} onSelect={setActiveView} /> : null}

        {activeView === "coach-sites" ? (
          <AdminPageShell
            actions={
              <button
                className={styles.primaryAction}
                onClick={() => setActiveView("create-coach-site")}
                type="button"
              >
                Create Coach Site
              </button>
            }
            eyebrow="Coach Sites"
            title="All Coach Sites"
          >
            <AdminCoachSitesManager csrfToken={csrfToken} mode="list" />
          </AdminPageShell>
        ) : null}

        {activeView === "create-coach-site" ? (
          <AdminPageShell eyebrow="Coach Sites" title="Create Coach Site">
            <AdminCoachSitesManager csrfToken={csrfToken} mode="create" />
          </AdminPageShell>
        ) : null}

        {activeView === "top-coaches" ? <TopCoachesView data={data} /> : null}
        {activeView === "coach-analytics" ? <CoachAnalyticsView control={control} /> : null}
        {activeView === "paid-masterclass-settings" ? (
          <MasterclassLinksView control={control} />
        ) : null}
        {activeView === "error-reports" ? (
          <ErrorReportsView control={control} onAction={openAction} />
        ) : null}
        {activeView === "backup-cleanup" ? (
          <BackupCleanupView control={control} onAction={openAction} />
        ) : null}
        {activeView === "settings" ? (
          <SettingsView control={control} onAction={openAction} />
        ) : null}
      </div>

      <AdminActionDialog
        onClose={() => setActionDialog(null)}
        open={Boolean(actionDialog)}
        title={actionDialog?.title || ""}
        tone={actionDialog?.tone}
      >
        <p className={styles.dialogCopy}>{actionDialog?.body}</p>
      </AdminActionDialog>
    </section>
  );
}

function OverviewView({
  data,
  onSelect
}: {
  data: typeof adminDashboardData;
  onSelect: (view: AdminViewId) => void;
}) {
  const overviewMetrics = data.summary.filter((metric) =>
    [
      "Total site visits",
      "Today's visits",
      "Weekly visits",
      "Monthly visits",
      "Total register button clicks",
      "Total WhatsApp clicks",
      "Recent error reports"
    ].includes(metric.label)
  );

  return (
    <AdminPageShell
      actions={
        <button
          className={styles.primaryAction}
          onClick={() => onSelect("create-coach-site")}
          type="button"
        >
          Create Coach Site
        </button>
      }
      eyebrow="Verified Admin Session"
      title="Admin Overview"
    >
      <section className={styles.summaryGrid} aria-label="Top summary cards">
        {overviewMetrics.map((metric) => (
          <article className={styles.metricCard} data-tone={metric.tone} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>Sample</em>
          </article>
        ))}
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Top Performing Coaches</p>
              <h2>Fast ranking</h2>
            </div>
            <button
              className={styles.secondaryAction}
              onClick={() => onSelect("top-coaches")}
              type="button"
            >
              Open Details
            </button>
          </div>
          <div className={styles.compactList}>
            {data.topCoaches.map((coach) => (
              <div key={coach.rank}>
                <span>{coach.rank}</span>
                <strong>{coach.name}</strong>
                <p>
                  {coach.visits.toLocaleString()} visits / {coach.conversionRate}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Alerts</p>
              <h2>Needs attention</h2>
            </div>
            <button
              className={styles.secondaryAction}
              onClick={() => onSelect("error-reports")}
              type="button"
            >
              View Reports
            </button>
          </div>
          <div className={styles.alertList}>
            {data.alerts.map((alert) => (
              <div className={styles.alertItem} data-severity={alert.severity} key={alert.title}>
                <strong>{alert.title}</strong>
                <p>{alert.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Quick Actions</p>
            <h2>Focused shortcuts</h2>
          </div>
        </div>
        <div className={styles.quickActions}>
          <button onClick={() => onSelect("create-coach-site")} type="button">
            Create Coach Site
          </button>
          <button onClick={() => onSelect("coach-sites")} type="button">
            Coach Sites
          </button>
          <button onClick={() => onSelect("coach-analytics")} type="button">
            View Coach Analytics
          </button>
          <button onClick={() => onSelect("top-coaches")} type="button">
            Top Performers
          </button>
          <button onClick={() => onSelect("paid-masterclass-settings")} type="button">
            Update Masterclass Links
          </button>
          <button onClick={() => onSelect("error-reports")} type="button">
            Error Reports
          </button>
          <button onClick={() => onSelect("backup-cleanup")} type="button">
            Backup Analytics
          </button>
        </div>
      </section>
    </AdminPageShell>
  );
}

function TopCoachesView({ data }: { data: typeof adminDashboardData }) {
  return (
    <AdminPageShell eyebrow="Coach Sites" title="Top Performing Coaches">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Coach</th>
              <th>Niche</th>
              <th>Public link</th>
              <th>Visits</th>
              <th>Clicks</th>
              <th>Conversion</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.topCoaches.map((coach) => (
              <tr key={coach.rank}>
                <td>{coach.rank}</td>
                <td>{coach.name}</td>
                <td>{coach.niche}</td>
                <td>
                  <code>{coach.publicLink}</code>
                </td>
                <td>{coach.visits.toLocaleString()}</td>
                <td>{coach.clicks.toLocaleString()}</td>
                <td>{coach.conversionRate}</td>
                <td>{coach.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}

function CoachAnalyticsView({ control }: { control: typeof adminControlCenterData }) {
  return (
    <AdminPageShell eyebrow="Coach Sites" title="Coach Analytics">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Coach slug</th>
              <th>Status</th>
              <th>Public URL</th>
              <th>Total visits</th>
              <th>Daily</th>
              <th>Weekly</th>
              <th>Monthly</th>
              <th>Register clicks</th>
              <th>WhatsApp clicks</th>
              <th>Video plays</th>
              <th>Conversion</th>
              <th>Device</th>
              <th>Region</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {control.coachAnalytics.map((coach) => (
              <tr key={coach.slug}>
                <td>
                  <code>{coach.slug}</code>
                </td>
                <td>
                  <span className={styles.statusBadge} data-status={coach.status}>
                    {coach.status}
                  </span>
                </td>
                <td>
                  <code>{coach.publicUrl}</code>
                </td>
                <td>{coach.totalVisits.toLocaleString()}</td>
                <td>{coach.dailyVisits.toLocaleString()}</td>
                <td>{coach.weeklyVisits.toLocaleString()}</td>
                <td>{coach.monthlyVisits.toLocaleString()}</td>
                <td>{coach.registerClicks.toLocaleString()}</td>
                <td>{coach.whatsappClicks.toLocaleString()}</td>
                <td>{coach.videoPlays.toLocaleString()}</td>
                <td>{coach.conversionRate}</td>
                <td>{coach.deviceBreakdown}</td>
                <td>{coach.regionBreakdown}</td>
                <td>{coach.sourceBreakdown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.inlineNote}>
        Google Form submissions are not claimed here. Current free-funnel analytics stop at tracked
        clicks until Google Sheets/Form integration is approved.
      </p>
    </AdminPageShell>
  );
}

function MasterclassLinksView({ control }: { control: typeof adminControlCenterData }) {
  const [managedLink, setManagedLink] = useState<AdminPaidMasterclassLink | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  async function copyMasterclassPath(label: string, path: string) {
    const value =
      typeof window === "undefined" || path.startsWith("http")
        ? path
        : new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied.`);
    } catch {
      setCopyMessage(`${label}: ${value}`);
    }
  }

  function openMasterclassPath(path: string) {
    if (typeof window === "undefined") return;
    window.open(path, "_blank", "noopener,noreferrer");
  }

  return (
    <AdminPageShell eyebrow="Paid Masterclass" title="Link Settings">
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Live Paid Websites</p>
            <h2>Public links and private-link status</h2>
          </div>
        </div>
        <div className={styles.paidLinkList}>
          {control.paidMasterclassLinks.map((link) => (
            <article className={styles.paidLinkCard} key={link.entryPath}>
              <div>
                <p className={styles.kicker}>Masterclass</p>
                <h3>{link.displayName}</h3>
                <p>{link.coachName}</p>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Public entry</span>
                <code>{link.entryPath}</code>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Paid page</span>
                <code>{link.paidPagePath}</code>
              </div>
              <div className={styles.paidLinkMeta}>
                <span>Payment</span>
                <strong>{link.paymentStatus}</strong>
              </div>
              <button
                className={styles.primaryAction}
                onClick={() => {
                  setCopyMessage("");
                  setManagedLink(link);
                }}
                type="button"
              >
                Manage
              </button>
            </article>
          ))}
        </div>
        <p className={styles.inlineNote}>
          Public entry links can be shared. Private WhatsApp invite values are intentionally hidden
          and resolved only by the server after paid access verification.
        </p>
      </section>

      <div className={styles.statusGrid}>
        {control.masterclassSettings.map((item) => (
          <article className={styles.statusCard} data-tone={item.tone} key={item.label}>
            <span>{item.status}</span>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
      <p className={styles.inlineStatus}>
        Paid landing pages remain custom jobs. Private paid links stay server-side only.
      </p>

      <AdminActionDialog
        onClose={() => setManagedLink(null)}
        open={Boolean(managedLink)}
        title="Manage Paid Masterclass"
      >
        {managedLink ? (
          <div className={styles.manageDialog}>
            <div>
              <p className={styles.kicker}>Paid Website</p>
              <h3>{managedLink.displayName}</h3>
              <p>{managedLink.coachName}</p>
            </div>

            <dl className={styles.definitionGrid}>
              <div>
                <dt>Public entry</dt>
                <dd>
                  <code>{managedLink.entryPath}</code>
                </dd>
              </div>
              <div>
                <dt>Paid page</dt>
                <dd>
                  <code>{managedLink.paidPagePath}</code>
                </dd>
              </div>
              <div>
                <dt>Success page</dt>
                <dd>
                  <code>{managedLink.successPath}</code>
                </dd>
              </div>
              <div>
                <dt>Private WhatsApp</dt>
                <dd>
                  {managedLink.privateWhatsappStatus}
                  <code>{managedLink.privateWhatsappSecretName}</code>
                </dd>
              </div>
            </dl>

            <div className={styles.formActions}>
              <button
                className={styles.primaryAction}
                onClick={() => openMasterclassPath(managedLink.entryPath)}
                type="button"
              >
                Preview / Go To Site
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() => openMasterclassPath(managedLink.paidPagePath)}
                type="button"
              >
                Open Paid Page
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() => void copyMasterclassPath("Public entry link", managedLink.entryPath)}
                type="button"
              >
                Copy Entry Link
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() => void copyMasterclassPath("Paid page link", managedLink.paidPagePath)}
                type="button"
              >
                Copy Paid Page
              </button>
              <button
                className={styles.secondaryAction}
                onClick={() =>
                  void copyMasterclassPath("Success page link", managedLink.successPath)
                }
                type="button"
              >
                Copy Success Link
              </button>
            </div>

            {copyMessage ? <p className={styles.inlineStatus}>{copyMessage}</p> : null}
            <p className={styles.linkWarning}>
              The real WhatsApp invite is not shown here. Only the secret name is visible so the
              private paid group link stays server-side.
            </p>
          </div>
        ) : null}
      </AdminActionDialog>
    </AdminPageShell>
  );
}

function ErrorReportsView({
  control,
  onAction
}: {
  control: typeof adminControlCenterData;
  onAction: (title: string, body: string, tone?: "danger" | "standard") => void;
}) {
  return (
    <AdminPageShell eyebrow="Reports" title="Error Reports">
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Page</th>
              <th>User action</th>
              <th>Safe message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {control.errorReports.map((report) => (
              <tr key={report.referenceId}>
                <td>
                  <code>{report.referenceId}</code>
                </td>
                <td>{report.status}</td>
                <td>{report.severity}</td>
                <td>{report.category}</td>
                <td>{report.pagePath}</td>
                <td>{report.userAction}</td>
                <td>{report.safeMessage}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      onClick={() =>
                        onAction(
                          "View Error Details",
                          `${report.referenceId}: ${report.safeMessage} Device: ${report.deviceType}, screen ${report.screenSize}. Technical details stay admin-only.`
                        )
                      }
                      type="button"
                    >
                      View
                    </button>
                    <button
                      onClick={() =>
                        onAction(
                          "Mark Error as Fixed",
                          "This placeholder action is disabled until error_reports persistence is approved."
                        )
                      }
                      type="button"
                    >
                      Mark Fixed
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.reportPrompt}>
        <strong>Codex-ready bug prompt</strong>
        <code>{createErrorReportBugPrompt(control.errorReports[0])}</code>
      </div>
    </AdminPageShell>
  );
}

function BackupCleanupView({
  control,
  onAction
}: {
  control: typeof adminControlCenterData;
  onAction: (title: string, body: string, tone?: "danger" | "standard") => void;
}) {
  return (
    <AdminPageShell eyebrow="Reports" title="Backup & Cleanup">
      <dl className={styles.definitionGrid}>
        <div>
          <dt>Retention period</dt>
          <dd>{control.backupCleanup.retentionDays} days</dd>
        </div>
        <div>
          <dt>Backup destination</dt>
          <dd>{control.backupCleanup.backupDestination}</dd>
        </div>
        <div>
          <dt>Last backup</dt>
          <dd>{control.backupCleanup.lastBackupAt}</dd>
        </div>
        <div>
          <dt>Cleanup status</dt>
          <dd>{control.backupCleanup.cleanupStatus}</dd>
        </div>
      </dl>
      <div className={styles.formActions}>
        <button
          className={styles.secondaryAction}
          onClick={() =>
            onAction("Backup Data", "Backup storage is not configured yet. No backup was created.")
          }
          type="button"
        >
          Backup Data
        </button>
        <button
          className={styles.dangerAction}
          onClick={() =>
            onAction(
              "Cleanup Old Data",
              "Cleanup is disabled until backup storage succeeds. No data was deleted.",
              "danger"
            )
          }
          type="button"
        >
          Cleanup Old Data
        </button>
      </div>
      <p className={styles.linkWarning}>
        Raw analytics cleanup must never delete coach profiles, coach sites, active links, or
        lifetime summaries.
      </p>
    </AdminPageShell>
  );
}

function SettingsView({
  control,
  onAction
}: {
  control: typeof adminControlCenterData;
  onAction: (title: string, body: string) => void;
}) {
  return (
    <AdminPageShell
      actions={
        <button
          className={styles.secondaryAction}
          onClick={() =>
            onAction(
              "Support Settings",
              "Default Yours Wellness support is used only when coach-specific public contact details are missing. Coach details stay editable inside the Coach Site builder."
            )
          }
          type="button"
        >
          Support Settings
        </button>
      }
      eyebrow="Settings"
      title="Settings"
    >
      <section className={styles.statusGrid}>
        <article className={styles.statusCard} data-tone="success">
          <span>Protected</span>
          <h3>Admin access</h3>
          <p>Admin routes and write APIs remain protected behind the current auth foundation.</p>
        </article>
        <article className={styles.statusCard} data-tone="success">
          <span>Coach-specific</span>
          <h3>Contact support</h3>
          <p>Coach pages use coach phone, WhatsApp, email, image/logo, and support text first.</p>
        </article>
        <article className={styles.statusCard} data-tone="warning">
          <span>Fallback</span>
          <h3>Yours Wellness support</h3>
          <p>
            Default support appears only when a coach site has no public support contact details.
          </p>
        </article>
      </section>

      <div className={styles.statusList}>
        {control.security.map((item) => (
          <div data-tone={item.tone} key={item.label}>
            <strong>{item.label}</strong>
            <span>{item.status}</span>
          </div>
        ))}
      </div>
      <p className={styles.securityNote}>
        Strict DB admin role enforcement should stay disabled until the real admin row is verified.
      </p>
    </AdminPageShell>
  );
}
