import { DisplaySlotCycle } from "@/components/landing/display-slot-cycle";
import { LiveViewerCount } from "@/components/landing/live-viewer-count";

export function FunnelStatusBars() {
  return (
    <div className="funnel-status" aria-label="Workshop availability and activity">
      <div className="funnel-status__urgency">
        <span className="funnel-status__dot" aria-hidden="true" />
        <span className="funnel-status__copy funnel-status__copy--display-only">
          Slots left: <DisplaySlotCycle />
        </span>
        <span className="funnel-status__proof">
          <strong>50,000+</strong> women already consulted
        </span>
      </div>
      <div className="funnel-status__live">
        <span className="funnel-status__dot funnel-status__dot--live" aria-hidden="true" />
        <span className="funnel-status__copy">
          <LiveViewerCount />
        </span>
      </div>
    </div>
  );
}
