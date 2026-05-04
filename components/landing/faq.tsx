import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const faqs = [
  {
    question: "Is this medical treatment?",
    answer:
      "No. This is an educational masterclass for lifestyle awareness and self-care planning. It does not replace diagnosis, treatment, or advice from your doctor."
  },
  {
    question: "Can I join from mobile?",
    answer:
      "Yes. The page and session flow are intended to work for mobile-first visitors. Final platform instructions will be sent after verified payment."
  },
  {
    question: "When will I receive the session links?",
    answer:
      "After verified payment, the system is planned to send confirmation details by email and WhatsApp."
  },
  {
    question: "What if my payment is pending?",
    answer:
      "Pending payments should not receive full onboarding confirmation until Razorpay sends a verified success webhook."
  },
  {
    question: "What is the refund or reschedule policy?",
    answer:
      "The final refund, cancellation, and reschedule policy is still pending and should be added before launch."
  }
];

export function FAQ() {
  return (
    <Section className="faq-section" aria-labelledby="faq-title">
      <Container className="faq-layout">
        <div className="section-heading">
          <p>Questions</p>
          <h2 id="faq-title">
            Frequently <span>Asked</span> Questions
          </h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq) => (
            <details className="faq-item" key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
