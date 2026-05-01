import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const inclusions = [
  {
    title: "Live masterclass access",
    description: "Attend the guided online session once the final schedule is confirmed."
  },
  {
    title: "Routine planning notes",
    description:
      "Placeholder for a worksheet, checklist, or planner if included in the final offer."
  },
  {
    title: "Onboarding instructions",
    description: "Receive next steps by email and WhatsApp after verified payment."
  }
];

export function Bonuses() {
  return (
    <Section className="bonuses-section" aria-labelledby="bonuses-title">
      <Container>
        <div className="bonuses-header">
          <div className="section-heading">
            <p>Included with registration</p>
            <h2 id="bonuses-title">Simple inclusions, clearly stated.</h2>
          </div>
          <p>
            Final bonuses should be listed only after the offer is confirmed. This section avoids
            inflated value stacking until the real inclusions are approved.
          </p>
        </div>

        <div className="bonuses-list">
          {inclusions.map((item) => (
            <article className="bonus-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
