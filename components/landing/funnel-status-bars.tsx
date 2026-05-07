export function FunnelStatusBars() {
  return (
    <div className="funnel-status" aria-label="Workshop availability and activity">
      <div className="funnel-status__urgency">
        <span className="funnel-status__dot" aria-hidden="true" />
        <span className="funnel-status__copy">
          Only <strong>7 slots</strong> left this week
        </span>
        <span className="funnel-status__proof">
          <strong>50,000+</strong> women already consulted
        </span>
      </div>
      <div className="funnel-status__live">
        <span className="funnel-status__dot funnel-status__dot--live" aria-hidden="true" />
        <span className="funnel-status__copy">
          <strong>144</strong> women are viewing this page right now
        </span>
      </div>
    </div>
  );
}
