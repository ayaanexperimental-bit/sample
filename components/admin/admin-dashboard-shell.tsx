"use client";

import { useMemo, useState } from "react";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
import {
  AdminActionDialog,
  AdminHeader,
  type AdminNavSection,
  AdminPageShell,
  AdminSidebar,
  AdminSubmenu
} from "./admin-dashboard-layout";
import styles from "./admin-dashboard-shell.module.css";
import { adminControlCenterData, createErrorReportBugPrompt } from "../../lib/admin-control-center";
import { adminDashboardData } from "../../lib/admin-dashboard-data";

type AdminDashboardShellProps = {
  csrfToken: string;
  onLogout: () => void;
  sessionEmail?: string;
};

type AdminViewId =
  | "activity-logs"
  | "admin-settings"
  | "backup-cleanup"
  | "coach-analytics"
  | "coach-sites-all"
  | "coach-sites-create"
  | "error-reports"
  | "overview"
  | "paid-funnel"
  | "paid-links"
  | "security-settings"
  | "success-settings"
  | "support-settings"
  | "top-coaches";

type ActionDialogState = {
  body: string;
  title: string;
  tone?: "danger" | "standard";
} | null;

const navSections: AdminNavSection[] = [
  {
    id: "overview",
    label: "Dashboard",
    items: [{ id: "overview", label: "Overview", description: "Summary, alerts, quick actions" }]
  },
  {
    id: "coach-sites",
    label: "Coach Sites",
    items: [
      { id: "coach-sites-all", label: "All Coach Sites", description: "List, filter, actions" },
      { id: "coach-sites-create", label: "Create Coach Site", description: "Open creator wizard" },
      { id: "top-coaches", label: "Top Performing Coaches", description: "Ranked demo table" },
      { id: "coach-analytics", label: "Coach Analytics", description: "Coach-wise metrics" }
    ]
  },
  {
    id: "paid-masterclass",
    label: "Paid Masterclass",
    items: [
      { id: "paid-funnel", label: "Funnel Analytics", description: "Paid funnel steps" },
      { id: "paid-links", label: "Link Settings", description: "Server-side link status" },
      { id: "success-settings", label: "Success Page Settings", description: "Post-payment status" }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { id: "error-reports", label: "Error Reports", description: "Safe error details" },
      { id: "activity-logs", label: "Activity Logs", description: "Recent admin events" },
      { id: "backup-cleanup", label: "Backup & Cleanup", description: "Retention controls" }
    ]
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { id: "admin-settings", label: "Admin Settings", description: "Role and access status" },
      { id: "support-settings", label: "Support Settings", description: "Fallback contact details" },
      { id: "security-settings", label: "Security Settings", description: "Hardening checklist" }
    ]
  }
];

const viewTitles: Record<AdminViewId, string> = {
  "activity-logs": "Activity Logs",
  "admin-settings": "Admin Settings",
  "backup-cleanup": "Backup & Cleanup",
  "coach-analytics": "Coach Analytics",
  "coach-sites-all": "All Coach Sites",
  "coach-sites-create": "Create Coach Site",
  "error-reports": "Error Reports",
  overview: "Overview",
  "paid-funnel": "Paid Funnel Analytics",
  "paid-links": "Masterclass Link Settings",
  "security-settings": "Security Settings",
  "success-settings": "Success Page Settings",
  "support-settings": "Support Settings",
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

  const currentSection = useMemo(
    () => navSections.find((section) => section.items.some((item) => item.id === activeView)),
    [activeView]
  );

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

        {currentSection && currentSection.items.length > 1 ? (
          <AdminSubmenu
            activeView={activeView}
            items={currentSection.items}
            onSelect={selectView}
          />
        ) : null}

        <p className={styles.demoNotice}>{data.demoNotice}</p>

        {activeView === "overview" ? (
          <OverviewView data={data} onAction={openAction} onSelect={setActiveView} />
        ) : null}

        {activeView === "coach-sites-all" ? (
          <AdminPageShell
            actions={
              <button
                className={styles.primaryAction}
                onClick={() => setActiveView("coach-sites-create")}
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

        {activeView === "coach-sites-create" ? (
          <AdminPageShell eyebrow="Coach Sites" title="Create Coach Site">
            <AdminCoachSitesManager csrfToken={csrfToken} mode="create" />
          </AdminPageShell>
        ) : null}

        {activeView === "top-coaches" ? <TopCoachesView data={data} /> : null}
        {activeView === "coach-analytics" ? <CoachAnalyticsView control={control} /> : null}
        {activeView === "paid-funnel" ? <PaidFunnelView data={data} /> : null}
        {activeView === "paid-links" ? <MasterclassLinksView control={control} /> : null}
        {activeView === "success-settings" ? (
          <SuccessSettingsView onAction={openAction} />
        ) : null}
        {activeView === "error-reports" ? (
          <ErrorReportsView control={control} onAction={openAction} />
        ) : null}
        {activeView === "activity-logs" ? <ActivityLogsView data={data} /> : null}
        {activeView === "backup-cleanup" ? (
          <BackupCleanupView control={control} onAction={openAction} />
        ) : null}
        {activeView === "admin-settings" ? <AdminSettingsView control={control} /> : null}
        {activeView === "support-settings" ? <SupportSettingsView onAction={openAction} /> : null}
        {activeView === "security-settings" ? <SecuritySettingsView control={control} /> : null}
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
  onAction,
  onSelect
}: {
  data: typeof adminDashboardData;
  onAction: (title: string, body: string) => void;
  onSelect: (view: AdminViewId) => void;
}) {
  return (
    <AdminPageShell
      actions={
        <button
          className={styles.primaryAction}
          onClick={() => onSelect("coach-sites-create")}
          type="button"
        >
          Create Coach Site
        </button>
      }
      eyebrow="Verified Admin Session"
      title="Admin Overview"
    >
      <section className={styles.summaryGrid} aria-label="Top summary cards">
        {data.summary.map((metric) => (
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
            <button className={styles.secondaryAction} onClick={() => onSelect("top-coaches")} type="button">
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
            <button className={styles.secondaryAction} onClick={() => onSelect("error-reports")} type="button">
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
          <button onClick={() => onSelect("coach-sites-create")} type="button">
            Create Coach Site
          </button>
          <button onClick={() => onSelect("coach-analytics")} type="button">
            View Coach Analytics
          </button>
          <button onClick={() => onSelect("paid-links")} type="button">
            Update Masterclass Links
          </button>
          <button onClick={() => onSelect("backup-cleanup")} type="button">
            Backup Analytics
          </button>
          <button
            onClick={() =>
              onAction(
                "Export Report",
                "Export is planned behind admin-only reporting APIs. No export file is generated until persistence is approved."
              )
            }
            type="button"
          >
            Export Report
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

function PaidFunnelView({ data }: { data: typeof adminDashboardData }) {
  const paidFunnel = data.funnels.find((funnel) => funnel.name.startsWith("Paid"));
  const freeFunnel = data.funnels.find((funnel) => funnel.name.startsWith("Free"));

  return (
    <AdminPageShell eyebrow="Paid Masterclass" title="Funnel Analytics">
      <section className={styles.twoColumn}>
        {[paidFunnel, freeFunnel].filter(Boolean).map((funnel) => (
          <article className={styles.section} key={funnel?.name}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Funnel</p>
                <h2>{funnel?.name}</h2>
              </div>
              <span className={styles.sampleBadge}>Sample</span>
            </div>
            <div className={styles.funnelSteps}>
              {funnel?.steps.map((step) => (
                <div className={styles.funnelStep} key={step.label}>
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </AdminPageShell>
  );
}

function MasterclassLinksView({ control }: { control: typeof adminControlCenterData }) {
  return (
    <AdminPageShell eyebrow="Paid Masterclass" title="Link Settings">
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
    </AdminPageShell>
  );
}

function SuccessSettingsView({
  onAction
}: {
  onAction: (title: string, body: string) => void;
}) {
  return (
    <AdminPageShell
      actions={
        <button
          className={styles.secondaryAction}
          onClick={() =>
            onAction(
              "Success Page Settings",
              "Success page settings are currently code/config controlled. A database settings table is required before admin edits are enabled."
            )
          }
          type="button"
        >
          Review Settings
        </button>
      }
      eyebrow="Paid Masterclass"
      title="Success Page Settings"
    >
      <section className={styles.statusGrid}>
        <article className={styles.statusCard} data-tone="success">
          <span>Protected</span>
          <h3>Success page access</h3>
          <p>Paid success page remains behind payment/funnel access checks.</p>
        </article>
        <article className={styles.statusCard} data-tone="success">
          <span>Server-side</span>
          <h3>Paid WhatsApp button</h3>
          <p>Private group URL is resolved only after verified paid access.</p>
        </article>
      </section>
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

function ActivityLogsView({ data }: { data: typeof adminDashboardData }) {
  return (
    <AdminPageShell eyebrow="Reports" title="Activity Logs">
      <div className={styles.activityList}>
        {data.activities.map((activity) => (
          <div className={styles.activityItem} key={`${activity.type}-${activity.timestamp}`}>
            <span>{activity.timestamp}</span>
            <strong>{activity.type}</strong>
            <p>{activity.description}</p>
          </div>
        ))}
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
            onAction(
              "Backup Data",
              "Backup storage is not configured yet. No backup was created."
            )
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

function AdminSettingsView({ control }: { control: typeof adminControlCenterData }) {
  return (
    <AdminPageShell eyebrow="Settings" title="Admin Settings">
      <div className={styles.modelList}>
        {control.dataModels.map((model) => (
          <article key={model.name}>
            <code>{model.name}</code>
            <strong>{model.status}</strong>
            <p>{model.purpose}</p>
          </article>
        ))}
      </div>
    </AdminPageShell>
  );
}

function SupportSettingsView({
  onAction
}: {
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
              "Default support is used only when coach-specific support details are missing. Coach support details remain editable inside the Coach Site creator."
            )
          }
          type="button"
        >
          Edit Support Settings
        </button>
      }
      eyebrow="Settings"
      title="Support Settings"
    >
      <section className={styles.statusGrid}>
        <article className={styles.statusCard} data-tone="success">
          <span>Coach-specific</span>
          <h3>Coach page support</h3>
          <p>Public coach pages prefer coach phone, WhatsApp, email, image/logo, and support text.</p>
        </article>
        <article className={styles.statusCard} data-tone="warning">
          <span>Fallback</span>
          <h3>Yours Wellness support</h3>
          <p>Default support appears only when a coach site has no public support contact details.</p>
        </article>
      </section>
    </AdminPageShell>
  );
}

function SecuritySettingsView({ control }: { control: typeof adminControlCenterData }) {
  return (
    <AdminPageShell eyebrow="Settings" title="Security Settings">
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
