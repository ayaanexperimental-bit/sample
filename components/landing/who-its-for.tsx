import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const audienceItems = [
  "Women looking for structured PCOS/PCOD lifestyle education.",
  "Women who feel overwhelmed by scattered advice and want a guided routine.",
  "Women interested in food, movement, rest, beauty, and self-care habits that work together.",
  "Women who want support while continuing appropriate medical care when needed."
];

export function WhoItsFor() {
  return (
    <Section className="audience-section" id="details" aria-labelledby="audience-title">
      <Container className="audience-layout">
        <div className="section-heading">
          <p>Who this is for</p>
          <h2 id="audience-title">
            For women who want clarity before making another routine change.
          </h2>
        </div>

        <div className="audience-panel">
          <ul className="audience-list">
            {audienceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="audience-note">
            This masterclass is educational. It does not replace diagnosis, treatment, or advice
            from your doctor.
          </p>
        </div>
      </Container>
    </Section>
  );
}
