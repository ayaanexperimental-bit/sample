import Link from "next/link";

const DEFAULT_WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4";

export default function SuccessPage() {
  const whatsappJoinUrl =
    process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_INVITE_URL || DEFAULT_WHATSAPP_COMMUNITY_URL;

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
          <h2 id="success-next-step-title">Next step: join the WhatsApp community</h2>
          <p>
            Join the community from the same phone you used during payment. This helps us send class
            access, reminders, and workshop updates in one place.
          </p>

          <a
            className="ui-button ui-button--primary ui-button--lg success-action"
            href={whatsappJoinUrl}
            rel="noreferrer"
            target="_blank"
          >
            Join WhatsApp Community
          </a>
        </section>

        <p>
          If WhatsApp does not open, copy the community link and open it on your phone. Keep your
          Razorpay payment ID available if support asks for confirmation.
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
