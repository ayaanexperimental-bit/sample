import styles from "./admin-dashboard-shell.module.css";
import { AdminCoachSitesManager } from "./admin-coach-sites-manager";
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

      <section className={styles.modulePlaceholders} aria-label="Pending admin modules">
        {[
          [
            "masterclass-settings",
            "Masterclass Link Settings",
            "Manage payment, success video, support, and private paid links server-side."
          ],
          [
            "error-reports",
            "Error Reports / Bug Reports",
            "Review safe error reports, statuses, admin notes, and Codex-ready bug prompts."
          ],
          [
            "backup-cleanup",
            "Data Backup & Cleanup",
            "Manual backup and 90-day raw analytics cleanup planning."
          ],
          ["settings", "Settings", "Admin-only configuration, role checks, and security hardening."]
        ].map(([id, title, description]) => (
          <article className={styles.placeholderCard} id={id} key={id}>
            <span className={styles.sampleBadge}>Planned module</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <p className={styles.securityNote}>
        Admin security TODOs remain: strict DB admin role activation after inserting the real admin,
        server-side role checks for future write APIs, CSRF on write APIs, AI provider setup,
        backup credentials, and production persistence for analytics.
      </p>
    </section>
  );
}
