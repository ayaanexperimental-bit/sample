import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="success-page">
      <article className="success-document">
        <p className="policy-kicker">Payment successful</p>
        <h1>Your registration is received.</h1>
        <p>
          Razorpay has received your payment for Women Health Masterclass 101. Keep your payment ID
          available for support if needed.
        </p>

        <section className="success-panel" aria-labelledby="success-next-step-title">
          <h2 id="success-next-step-title">Next step: check your verified payment updates</h2>
          <p>
            Class access, reminders, and community details are shared only after the payment is
            verified through the approved automation flow.
          </p>

          <span
            className="ui-button ui-button--secondary ui-button--lg success-action"
            aria-disabled="true"
          >
            Community Link Sent After Verification
          </span>
        </section>

        <p>
          Keep your Razorpay payment ID available if support asks for confirmation. Do not share
          private class or community links publicly.
        </p>
        <p className="policy-warning">
          Confirmation and follow-up messages are handled through the Razorpay and Pabbly automation
          flow.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
