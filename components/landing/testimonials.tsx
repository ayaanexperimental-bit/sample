import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const testimonialSlots = [
  "Approved participant testimonial pending.",
  "Approved participant testimonial pending.",
  "Approved participant testimonial pending."
];

export function Testimonials() {
  return (
    <Section className="testimonials-section" aria-labelledby="testimonials-title">
      <Container>
        <div className="testimonials-header">
          <div className="section-heading">
            <p>Participant stories</p>
            <h2 id="testimonials-title">Real testimonials will appear here after approval.</h2>
          </div>
          <p>
            This section is intentionally placeholder-only until publishable testimonials,
            permission status, and results-vary language are confirmed.
          </p>
        </div>

        <div className="testimonial-grid">
          {testimonialSlots.map((slot, index) => (
            <article className="testimonial-card" key={`${slot}-${index}`}>
              <div className="testimonial-avatar" aria-hidden="true">
                {index + 1}
              </div>
              <blockquote>{slot}</blockquote>
              <p>Name, initials, or anonymized label pending.</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
