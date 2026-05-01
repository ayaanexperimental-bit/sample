import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <article className="policy-document">
        <p className="policy-kicker">Policy template</p>
        <h1>Privacy Policy</h1>
        <p>Last updated: [Date]</p>
        <p>
          This Privacy Policy explains how [Business Legal Name], operating under the brand name
          [Brand Name], collects, uses, stores, and protects your information when you visit our
          website, register for our workshop, make a payment, or communicate with us through phone,
          email, WhatsApp, SMS, or other channels.
        </p>
        <h2>Information We Collect</h2>
        <p>
          We may collect full name, phone number, email address, city or location, age group or
          health-interest information if voluntarily provided, workshop/session selected, payment
          status and transaction details, UTM/referral/ad source, browser/device details,
          communication preferences, and messages or queries shared with us.
        </p>
        <h2>Why We Collect Your Information</h2>
        <p>
          We collect your information to register you for the workshop, process payment, confirm
          registration, send onboarding details, reminders, joining links, preparation instructions,
          support messages, maintain internal database and Google Sheets records, track payment
          status, improve website/campaign performance, respond to support requests, and comply with
          legal, tax, payment, and regulatory requirements.
        </p>
        <h2>Payment Information</h2>
        <p>
          Payments may be processed through third-party payment gateways such as Razorpay or another
          approved provider. We do not store your card number, UPI PIN, banking password, or full
          payment instrument details on our servers.
        </p>
        <h2>Google Sheets And Internal Records</h2>
        <p>
          Your registration and payment details may be synced to Google Sheets or similar internal
          reporting tools for business tracking. Google Sheets is used only as an operational
          dashboard. Our database/payment records remain the primary source of truth.
        </p>
        <h2>Communication</h2>
        <p>
          By submitting your details, you agree to receive registration confirmation, payment
          status, workshop reminders, onboarding call details, Zoom/session links, WhatsApp
          group/community links, support messages, and related wellness education or program
          information.
        </p>
        <h2>Data Sharing And Security</h2>
        <p>
          We may share necessary information with trusted service providers such as payment
          gateways, email/SMS/WhatsApp providers, Google Sheets or CRM systems, hosting, analytics,
          security providers, and legal/accounting/compliance advisors where required. We do not
          sell your personal data.
        </p>
        <h2>Your Rights And Contact</h2>
        <p>
          You may request access, correction, promotional opt-out, deletion where legally permitted,
          or raise a privacy concern by contacting [Support Email].
        </p>
        <h2>Children&apos;s Privacy</h2>
        <p>
          Our workshops are intended for adults. If a participant is below 18 years of age,
          registration should be completed by a parent or legal guardian.
        </p>
        <h2>Contact</h2>
        <p>
          [Business Legal Name], [Business Address]. Email: [Support Email]. WhatsApp/Phone:
          [WhatsApp Number].
        </p>
        <p className="policy-warning">
          This is website-ready template text from the compliance pack and should be legally
          reviewed before publishing.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
