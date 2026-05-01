import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="policy-page">
      <article className="policy-document">
        <p className="policy-kicker">Payment status</p>
        <h1>Registration received</h1>
        <p>
          If your payment was completed, confirmation will be finalized after Razorpay sends a
          verified payment webhook to our system.
        </p>
        <p>
          Once verified, onboarding details are planned to be sent by email and WhatsApp. If payment
          was deducted but confirmation is not received, contact support with your transaction ID.
        </p>
        <p className="policy-warning">
          This page does not by itself prove payment success. Payment status is confirmed only from
          the verified backend payment event.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
