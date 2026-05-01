import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const outcomes = [
  "A clearer understanding of PCOS/PCOD lifestyle foundations.",
  "A simple routine structure you can adapt to your day.",
  "A better way to track patterns and prepare questions for your clinician.",
  "A practical self-care direction for confidence, wellness, and consistency."
];

export function Outcomes() {
  return (
    <Section className="outcomes-section" tone="strong" aria-labelledby="outcomes-title">
      <Container className="outcomes-layout">
        <div className="outcomes-card">
          <div className="section-heading">
            <p>Outcomes and expectations</p>
            <h2 id="outcomes-title">Leave with clarity, not unrealistic promises.</h2>
          </div>
          <p>
            This masterclass is designed to help you understand supportive lifestyle ideas and plan
            your next steps with more confidence. Individual experiences vary.
          </p>
        </div>

        <ul className="outcomes-list">
          {outcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
