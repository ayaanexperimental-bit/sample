import { CoachLegalPage } from "../../components/coach/coach-legal-page";

export default function DisclaimerPage() {
  return (
    <CoachLegalPage
      links={[
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms & Conditions" }
      ]}
      title="Disclaimer"
    >
      <p>
        This page and the related masterclass or coach content are intended for education and
        general wellness awareness. They are not a substitute for diagnosis, medical treatment,
        medication decisions, emergency care, or advice from a qualified healthcare professional.
      </p>

      <p>
        Results and experiences vary. Any information shared on the landing page, in the session,
        or through support communication should be interpreted as educational wellness content and
        considered with professional medical guidance where needed.
      </p>

      <p>
        If you have any medical condition, are pregnant or nursing, take medication, are under
        clinical care, or have concerns about food, exercise, supplements, routines, or lifestyle
        changes, please consult a qualified healthcare professional before acting on any educational
        content.
      </p>

      <p>
        We do not guarantee cure, reversal, medicine stoppage, weight loss, pregnancy, skin
        improvement, hair growth, hormone correction, disease reversal, or any fixed outcome.
        Testimonials, success stories, examples, and coach experiences are individual experiences
        and should not be treated as guaranteed results.
      </p>

      <p>
        If you experience any medical emergency, immediately contact a qualified medical
        professional or emergency service.
      </p>
    </CoachLegalPage>
  );
}
