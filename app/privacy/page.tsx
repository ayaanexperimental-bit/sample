import { CoachLegalPage } from "../../components/coach/coach-legal-page";

export default function PrivacyPage() {
  return (
    <CoachLegalPage
      links={[
        { href: "/terms", label: "Terms & Conditions" },
        { href: "/disclaimer", label: "Disclaimer" }
      ]}
      title="Privacy Policy"
    >
      <p className="yw-legal-date">Last updated: May 26, 2026</p>
      <p>
        This Privacy Policy explains how Yours Wellness Center and YW Nutritech collect, use,
        store, and protect your information when you visit a coach landing page, register for a
        workshop, make a payment where applicable, or communicate through phone, email, WhatsApp,
        SMS, or other channels.
      </p>

      <h2>Information We Collect</h2>
      <p>
        We may collect full name, phone number, email address, city or location, age group or
        health-interest information if voluntarily provided, selected session, payment status and
        transaction details where applicable, UTM/referral/ad source, browser/device details,
        communication preferences, and messages or queries shared with us.
      </p>

      <h2>Why We Collect Your Information</h2>
      <p>
        We collect your information to register you for the session, confirm registration, send
        reminders, joining links, preparation instructions, support messages, maintain operational
        records, improve website/campaign performance, respond to support requests, and comply with
        legal, tax, payment, and regulatory requirements.
      </p>

      <h2>Payment Information</h2>
      <p>
        If a page includes payment, payments may be processed through third-party payment gateways
        such as Razorpay or another approved provider. We do not store your card number, UPI PIN,
        banking password, or full payment instrument details on our servers.
      </p>

      <h2>Internal Records</h2>
      <p>
        Your registration and payment details may be synced to internal reporting tools such as
        Google Sheets or CRM systems for business tracking. These tools are used only for operations
        and support.
      </p>

      <h2>Communication</h2>
      <p>
        By submitting your details, you agree to receive registration confirmation, session
        reminders, onboarding details, joining links, support messages, and related wellness
        education or program information.
      </p>

      <h2>Data Sharing And Security</h2>
      <p>
        We may share necessary information with trusted service providers such as payment gateways,
        email/SMS/WhatsApp providers, Google Sheets or CRM systems, hosting, analytics, security
        providers, and legal/accounting/compliance advisors where required. We do not sell your
        personal data.
      </p>

      <h2>Your Rights And Contact</h2>
      <p>
        You may request access, correction, promotional opt-out, deletion where legally permitted,
        or raise a privacy concern through the contact details shared with your registration.
      </p>

      <h2>Children&apos;s Privacy</h2>
      <p>
        Our workshops are intended for adults. If a participant is below 18 years of age,
        registration should be completed by a parent or legal guardian.
      </p>
    </CoachLegalPage>
  );
}
