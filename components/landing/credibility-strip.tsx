import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const credibilityItems = [
  {
    label: "Format",
    value: "Live online masterclass"
  },
  {
    label: "Focus",
    value: "PCOS/PCOD lifestyle education"
  },
  {
    label: "Approach",
    value: "Integrated and holistic"
  }
];

export function CredibilityStrip() {
  return (
    <Section className="credibility-section" tone="soft" aria-label="Masterclass credibility">
      <Container>
        <dl className="credibility-grid">
          {credibilityItems.map((item) => (
            <div className="credibility-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  );
}
