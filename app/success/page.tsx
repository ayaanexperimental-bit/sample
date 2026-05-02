import Link from "next/link";

const DEFAULT_WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/LYf1V55hDimAhfNVCghaN4";

type SuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const whatsappJoinUrl = buildWhatsappJoinUrl(resolvedSearchParams);

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
          This page is shown after payment redirect. Final registration records are still based on
          the verified Razorpay webhook, not on the browser redirect alone.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}

function buildWhatsappJoinUrl(searchParams: Record<string, string | string[] | undefined>) {
  const trackingUrl = process.env.N8N_WHATSAPP_CLICK_TRACKING_URL;
  const fallbackUrl = process.env.WHATSAPP_COMMUNITY_INVITE_URL || DEFAULT_WHATSAPP_COMMUNITY_URL;

  if (!trackingUrl) {
    return fallbackUrl;
  }

  const url = new URL(trackingUrl);

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item) {
          url.searchParams.append(key, item);
        }
      }
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("event_type", "whatsapp_group_link_clicked");
  url.searchParams.set("program_slug", "women-health-masterclass-101");
  url.searchParams.set("payment_status", "success");
  url.searchParams.set("member_status", "group_link_clicked");

  return url.toString();
}
