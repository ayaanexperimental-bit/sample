import Link from "next/link";

export default function RefundPage() {
  return (
    <main className="policy-page">
      <article className="policy-document">
        <p className="policy-kicker">Policy template</p>
        <h1>Refund Policy</h1>
        <p>Last updated: [Date]</p>
        <h2>Workshop Fee</h2>
        <p>The workshop/session fee is displayed on the registration page before payment.</p>
        <h2>Refund Eligibility</h2>
        <p>
          Refunds may be considered only for duplicate payment, payment deducted but registration
          not confirmed, workshop cancellation by us without alternate access or resolution, or a
          technical error from our side preventing access to the paid session.
        </p>
        <h2>Non-Refundable Cases</h2>
        <p>
          Refunds may not be available if the participant changes their mind, misses the session,
          provides incorrect contact details, cannot join due to personal internet/device issues,
          expected unpromised medical results, already received access or materials, or requests
          refund due to non-availability for the scheduled session.
        </p>
        <h2>Request Timeline</h2>
        <p>
          Refund requests must be raised within [X days/hours] of payment or before the workshop
          begins, whichever is earlier.
        </p>
        <h2>Processing And Final Decision</h2>
        <p>
          Approved refunds will be processed to the original payment method. Payment gateway
          timelines may vary. Gateway, bank, or platform charges may be deducted where applicable.
          Refund approval is subject to verification of payment records and our internal policy.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
