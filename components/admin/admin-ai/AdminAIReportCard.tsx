import { useState } from "react";
import { formatAdminAIReport, type AdminAIReport } from "../../../lib/admin-ai/adminAIService";
import styles from "./admin-ai.module.css";

export function AdminAIReportCard({ report }: { report: AdminAIReport }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(formatAdminAIReport(report));
      setCopyStatus("Report copied.");
    } catch {
      setCopyStatus("Copy was blocked by the browser.");
    }
  }

  return (
    <article className={styles.reportCard} aria-label={report.title}>
      <header>
        <div>
          <small>Copyable report</small>
          <h4>{report.title}</h4>
          <p>{report.dateRange}</p>
        </div>
        <button onClick={() => void copyReport()} type="button">
          Copy report
        </button>
      </header>
      <ReportSection items={report.keyMetrics} title="Key metrics" />
      <ReportSection items={report.observations} title="Observations" />
      <ReportSection items={report.recommendations} title="Recommendations" />
      {report.actionItems.length ? <ReportSection items={report.actionItems} title="Action items" /> : null}
      <p className={styles.sourceNote}>Sources: {report.sourceNote}</p>
      {copyStatus ? <p className={styles.copyStatus} role="status">{copyStatus}</p> : null}
    </article>
  );
}

function ReportSection({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null;

  return (
    <section>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
