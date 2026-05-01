import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const logistics = [
  {
    label: "Date",
    value: "To be confirmed"
  },
  {
    label: "Time",
    value: "To be confirmed"
  },
  {
    label: "Duration",
    value: "To be confirmed"
  },
  {
    label: "Language",
    value: "To be confirmed"
  },
  {
    label: "Platform",
    value: "Zoom / WhatsApp details after payment"
  },
  {
    label: "After payment",
    value: "Confirmation email and WhatsApp onboarding"
  }
];

export function Logistics() {
  return (
    <Section className="logistics-section" tone="soft" aria-labelledby="logistics-title">
      <Container className="logistics-layout">
        <div className="section-heading">
          <p>Session details</p>
          <h2 id="logistics-title">Everything important should be clear before payment.</h2>
        </div>

        <div className="logistics-grid">
          {logistics.map((item) => (
            <article className="logistics-item" key={item.label}>
              <p>{item.label}</p>
              <h3>{item.value}</h3>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
