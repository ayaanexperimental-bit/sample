import Link from "next/link";

export default function CancellationPage() {
  return (
    <main className="policy-page">
      <article className="policy-document">
        <p className="policy-kicker">Policy template</p>
        <h1>Cancellation Policy</h1>
        <p>
          A participant may request cancellation by contacting us at [Support Email] or [WhatsApp
          Number].
        </p>
        <h2>Required Details</h2>
        <p>
          Cancellation requests must include full name, registered phone number, email address,
          payment transaction ID, workshop name/date, and reason for cancellation.
        </p>
        <h2>Refund Linkage</h2>
        <p>
          Cancellation does not automatically guarantee a refund. Refunds will be handled according
          to our Refund Policy.
        </p>
        <h2>Access Already Provided</h2>
        <p>
          If the workshop has already started, access has been provided, links have been shared,
          recordings have been provided, or materials have been shared, cancellation may not be
          eligible for refund.
        </p>
        <h2>No Reschedule Promise</h2>
        <p>
          Participant-side rescheduling is not available unless specifically announced by [Brand
          Name] in writing.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
