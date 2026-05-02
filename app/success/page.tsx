import Link from "next/link";

export default function SuccessPage() {
  const whatsappTrackingUrl = process.env.N8N_WHATSAPP_CLICK_TRACKING_URL;

  return (
    <main className="success-page">
      <article className="success-document">
        <p className="policy-kicker">Payment successful</p>
        <h1>Your registration is received.</h1>
        <p>
          Razorpay has received your payment for Women Health Masterclass 101. Your registration is
          confirmed after the verified Razorpay payment event reaches our system.
        </p>

        <section className="success-panel" aria-labelledby="success-next-step-title">
          <h2 id="success-next-step-title">Next step: join the WhatsApp community</h2>
          <p>
            Join the community from the same phone you used during payment. This helps us send class
            access, reminders, and workshop updates in one place.
          </p>

          {whatsappTrackingUrl ? (
            <a
              className="ui-button ui-button--primary ui-button--lg success-action"
              href={whatsappTrackingUrl}
            >
              Join WhatsApp Community
            </a>
          ) : (
            <p className="success-pending">
              The WhatsApp community button is being connected. If you have already paid, your
              joining details will be shared shortly.
            </p>
          )}
        </section>

        <p>
          If WhatsApp does not open after the button is enabled, copy the community link and open it
          on your phone. Keep your Razorpay payment ID available if support asks for confirmation.
        </p>
        <p className="policy-warning">
          This page is shown after payment redirect. Final registration records are still based on
          the verified Razorpay webhook, not on the browser redirect alone.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
