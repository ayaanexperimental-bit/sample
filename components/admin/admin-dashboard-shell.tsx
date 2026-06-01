import styles from "./admin-dashboard-shell.module.css";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
import { adminControlCenterData, createErrorReportBugPrompt } from "../../lib/admin-control-center";
import { adminDashboardData } from "../../lib/admin-dashboard-data";

type AdminDashboardShellProps = {
  csrfToken: string;
  onLogout: () => void;
  sessionEmail?: string;
};

export function AdminDashboardShell({
  csrfToken,
  onLogout,
  sessionEmail
}: AdminDashboardShellProps) {
  const data = adminDashboardData;
  const control = adminControlCenterData;

  return (
    <section className={styles.dashboard} aria-labelledby="admin-overview-title">
      <header className={styles.header} id="overview">
        <div>
          <p className={styles.kicker}>Verified Admin Session</p>
          <h1 id="admin-overview-title">Admin Overview</h1>
          <p>
            Private control center for analytics, paid funnel visibility, coach referral sites,
            error reports, and backup planning.
          </p>
        </div>
        <div className={styles.headerActions}>
          {sessionEmail ? <span className={styles.sessionEmail}>{sessionEmail}</span> : null}
          <button className={styles.logoutButton} onClick={onLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <p className={styles.demoNotice}>{data.demoNotice}</p>

      <nav className={styles.nav} aria-label="Admin sections">
        {data.navigation.map((item) => (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <section className={styles.summaryGrid} aria-label="Top summary cards">
        {data.summary.map((metric) => (
          <article className={styles.metricCard} data-tone={metric.tone} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>Sample</em>
          </article>
        ))}
      </section>

      <section className={styles.section} id="top-performers">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Top Performing Coaches</p>
            <h2>Ranked coach performance</h2>
          </div>
          <span className={styles.sampleBadge}>Demo ranking</span>
        </div>
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
                <th>Action</th>
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
                  <td>
                    <a href="#coach-referral">View Details</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.twoColumn} aria-label="Funnel overview">
        {data.funnels.map((funnel) => (
          <article
            className={styles.section}
            id={funnel.name.startsWith("Paid") ? "paid-masterclass" : "coach-referral"}
            key={funnel.name}
          >
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Funnel Overview</p>
                <h2>{funnel.name}</h2>
              </div>
              <span className={styles.sampleBadge}>Sample</span>
            </div>
            <div className={styles.funnelSteps}>
              {funnel.steps.map((step) => (
                <div className={styles.funnelStep} key={step.label}>
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section} aria-labelledby="region-overview-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Region Overview</p>
              <h2 id="region-overview-title">Top regions</h2>
            </div>
          </div>
          <div className={styles.breakdownList}>
            {data.regionBreakdown.map((item) => (
              <div className={styles.breakdownItem} key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.section} aria-labelledby="device-overview-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Device Overview</p>
              <h2 id="device-overview-title">Traffic by device</h2>
            </div>
          </div>
          <div className={styles.breakdownList}>
            {data.deviceBreakdown.map((item) => (
              <div className={styles.breakdownItem} key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section} aria-labelledby="recent-activity-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Recent Activity</p>
              <h2 id="recent-activity-title">Latest platform events</h2>
            </div>
          </div>
          <div className={styles.activityList}>
            {data.activities.map((activity) => (
              <div className={styles.activityItem} key={`${activity.type}-${activity.timestamp}`}>
                <span>{activity.timestamp}</span>
                <strong>{activity.type}</strong>
                <p>{activity.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.section} aria-labelledby="alerts-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Alerts / Problems</p>
              <h2 id="alerts-title">Items needing review</h2>
            </div>
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

      <section className={styles.section} aria-labelledby="quick-actions-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Quick Actions</p>
            <h2 id="quick-actions-title">Admin shortcuts</h2>
          </div>
        </div>
        <div className={styles.quickActions}>
          {data.quickActions.map((action) => (
            <a href={action.href} key={action.label}>
              {action.label}
            </a>
          ))}
        </div>
      </section>

      <AdminCoachSitesManager csrfToken={csrfToken} />

      <section className={styles.section} aria-labelledby="coach-wise-analytics-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Coach-Wise Analytics</p>
            <h2 id="coach-wise-analytics-title">Individual coach performance</h2>
          </div>
          <span className={styles.sampleBadge}>Demo analytics</span>
        </div>
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
          Google Form submissions are not claimed here because the `.md` keeps Google Form
          automation for a later integration. Current free-funnel analytics stop at tracked clicks.
        </p>
      </section>

      <section className={styles.section} id="masterclass-settings">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Masterclass Link Settings</p>
            <h2>Server-side paid funnel settings</h2>
          </div>
          <span className={styles.sampleBadge}>No private URLs shown</span>
        </div>
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
          Paid landing pages remain custom jobs. Admin can manage references/settings only after a
          database settings table is approved.
        </p>
      </section>

      <section className={styles.section} id="error-reports">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.kicker}>Error Reports / Bug Reports</p>
            <h2>Safe error reports</h2>
          </div>
          <span className={styles.sampleBadge}>Admin-only details</span>
        </div>
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
                <th>Device</th>
                <th>Screen</th>
                <th>Coach</th>
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
                  <td>{report.deviceType}</td>
                  <td>{report.screenSize}</td>
                  <td>{report.coachSlug || "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.reportPrompt}>
          <strong>Codex-ready bug prompt</strong>
          <code>{createErrorReportBugPrompt(control.errorReports[0])}</code>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section} id="backup-cleanup">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Data Backup & Cleanup</p>
              <h2>90-day raw analytics retention</h2>
            </div>
          </div>
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
              <dt>Google Sheets</dt>
              <dd>
                {control.backupCleanup.googleSheetsConfigured ? "Configured" : "Not configured yet"}
              </dd>
            </div>
            <div>
              <dt>Last backup</dt>
              <dd>{control.backupCleanup.lastBackupAt}</dd>
            </div>
            <div>
              <dt>Last cleanup</dt>
              <dd>{control.backupCleanup.lastCleanupAt}</dd>
            </div>
            <div>
              <dt>Cleanup status</dt>
              <dd>{control.backupCleanup.cleanupStatus}</dd>
            </div>
          </dl>
          <div className={styles.formActions}>
            <button className={styles.secondaryAction} disabled type="button">
              Manual Backup
            </button>
            <button className={styles.dangerAction} disabled type="button">
              Manual Cleanup
            </button>
          </div>
          <p className={styles.linkWarning}>
            Cleanup stays disabled until backup storage succeeds. Coach profiles, sites, active
            links, and lifetime summaries must not be deleted by raw-event cleanup.
          </p>
        </article>

        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Event Tracking System</p>
              <h2>Tracked event contract</h2>
            </div>
          </div>
          <p className={styles.inlineNote}>{control.eventTracking.storageStatus}</p>
          <div className={styles.chipList}>
            {control.eventTracking.eventNames.map((eventName) => (
              <code key={eventName}>{eventName}</code>
            ))}
          </div>
          <div className={styles.chipList} data-tone="muted">
            {control.eventTracking.fields.map((field) => (
              <span key={field}>{field}</span>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.twoColumn}>
        <article className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Data Models</p>
              <h2>Persistence plan</h2>
            </div>
          </div>
          <div className={styles.modelList}>
            {control.dataModels.map((model) => (
              <article key={model.name}>
                <code>{model.name}</code>
                <strong>{model.status}</strong>
                <p>{model.purpose}</p>
              </article>
            ))}
          </div>
        </article>

        <article className={styles.section} id="settings">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>Settings</p>
              <h2>Security and configuration status</h2>
            </div>
          </div>
          <div className={styles.statusList}>
            {control.security.map((item) => (
              <div data-tone={item.tone} key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <p className={styles.securityNote}>
        Admin security TODOs remain: strict DB admin role activation after inserting the real admin,
        server-side role checks for future write APIs, CSRF on write APIs, AI provider setup,
        backup credentials, and production persistence for analytics.
      </p>
    </section>
  );
}
