import Link from "next/link";
import type { Metadata } from "next";
import { SuccessAccessPanel } from "@/components/landing/success-access-panel";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  title: "Payment Verification Required",
};

export default function SuccessPage() {
  return (
    <main className="success-page">
      <article className="success-document">
        <p className="policy-kicker">Verification required</p>
        <h1>This confirmation page is protected.</h1>
        <p>
          A direct browser visit to this page does not confirm payment or registration. Payment
          status is accepted only after verification through the approved Razorpay and automation
          flow.
        </p>

        <SuccessAccessPanel />

        <p>
          If you completed payment, keep your Razorpay payment ID available and wait for the official
          confirmation message from the approved follow-up channel.
        </p>
        <p className="policy-warning">
          No payment, class, or community access is granted from this public URL.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
