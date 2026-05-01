import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const pillars = [
  {
    name: "Nourish",
    description: "Build meals and timing habits that support a steadier daily routine."
  },
  {
    name: "Move",
    description: "Use approachable movement as part of a sustainable lifestyle plan."
  },
  {
    name: "Restore",
    description: "Make rest, stress awareness, and recovery part of the wellness conversation."
  },
  {
    name: "Track",
    description: "Notice patterns and prepare better questions for qualified clinical support."
  },
  {
    name: "Glow",
    description: "Connect beauty and confidence habits with consistent self-care."
  }
];

export function MethodPillars() {
  return (
    <Section className="method-section" aria-labelledby="method-title">
      <Container>
        <div className="method-intro">
          <div className="section-heading">
            <p>The approach</p>
            <h2 id="method-title">Five simple pillars for a calmer wellness routine.</h2>
          </div>
          <p>
            The final framework name can be updated once the brand method is confirmed. These
            pillars are intentionally practical and non-claim-heavy.
          </p>
        </div>

        <div className="method-rail">
          {pillars.map((pillar) => (
            <article className="method-pillar" key={pillar.name}>
              <h3>{pillar.name}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
