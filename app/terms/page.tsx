import { CoachLegalPage } from "../../components/coach/coach-legal-page";

export default function TermsPage() {
  return (
    <CoachLegalPage
      links={[
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/disclaimer", label: "Disclaimer" }
      ]}
      title="Terms and Conditions"
    >
      <p className="yw-legal-date">Last updated: May 26, 2026</p>
      <p>
        These Terms and Conditions govern your use of ywcoach.com, coach landing pages,
        registration for sessions, and participation in programs offered through Yours Wellness
        Center and YW Nutritech.
      </p>

      <h2>Nature Of Service</h2>
      <p>
        We provide educational wellness sessions, coach-led awareness, habit-building guidance, and
        lifestyle education. Our sessions are not a substitute for medical diagnosis, medical
        treatment, emergency care, or personal consultation with a qualified medical practitioner.
      </p>

      <h2>Eligibility And Registration</h2>
      <p>
        You must be at least 18 years old to register. If you are registering for someone else, you
        confirm that you have their consent. You agree that all information provided by you is
        accurate and complete.
      </p>

      <h2>Payment And Confirmation</h2>
      <p>
        If a page includes payment, fees must be paid through the available payment method shown on
        the website. Your registration or publishing action is confirmed only after successful
        payment verification through the payment gateway or backend system. A payment screenshot
        alone may not be treated as final confirmation unless verified in our system.
      </p>

      <h2>No Medical Guarantee</h2>
      <p>
        We do not guarantee cure, reversal, medicine stoppage, weight loss, pregnancy, skin
        improvement, hair growth, hormone correction, disease reversal, or any fixed health outcome.
        Results vary from person to person depending on health condition, consistency, medical
        history, lifestyle, medication, sleep, stress, nutrition, activity, and professional medical
        supervision.
      </p>

      <h2>Medicine And Medical Advice</h2>
      <p>
        Do not stop, reduce, or change any medicine without consulting your doctor. Any lifestyle,
        nutrition, exercise, or wellness guidance shared in our session is for educational purposes
        only.
      </p>

      <h2>Session Changes</h2>
      <p>
        We may modify, postpone, or cancel a session due to technical issues, speaker availability,
        low registrations, emergencies, or other unavoidable circumstances. Participant-side
        rescheduling is not available unless specifically announced in writing.
      </p>

      <h2>Intellectual Property And Conduct</h2>
      <p>
        All session content, slides, videos, documents, messages, designs, and materials belong to
        their respective owners unless otherwise stated. You may not copy, record, distribute, sell,
        upload, or reuse content without written permission.
      </p>

      <h2>Liability And Governing Law</h2>
      <p>
        To the maximum extent permitted by law, Yours Wellness Center and YW Nutritech will not be
        liable for indirect, incidental, consequential, or personal health-related losses arising
        from your use of the website, coach landing page, workshop, or educational content. These
        Terms are governed by the laws of India.
      </p>
    </CoachLegalPage>
  );
}
