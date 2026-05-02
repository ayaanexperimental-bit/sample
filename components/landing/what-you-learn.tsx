import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const learningItems = [
  {
    title: "PCOS/PCOD foundations",
    description: "Understand the lifestyle basics commonly discussed around PCOS/PCOD support."
  },
  {
    title: "Daily routine design",
    description: "Learn how food, movement, rest, and self-care can fit into a realistic routine."
  },
  {
    title: "Beauty and confidence habits",
    description: "Explore practical self-care habits without relying on guaranteed result claims."
  },
  {
    title: "Tracking and next steps",
    description: "Know what to track, what to ask, and when to work with a qualified clinician."
  }
];

export function WhatYouLearn() {
  return (
    <Section className="learning-section" tone="soft" aria-labelledby="learning-title">
      <Container>
        <div className="learning-header">
          <div className="section-heading">
            <p>What you will learn</p>
            <h2 id="learning-title">A practical framework for routine, wellness, and self-care.</h2>
          </div>
          <p>
            The final curriculum will be updated after the exact masterclass outline is approved.
            These topics are safe placeholders for the current build.
          </p>
        </div>

        <div className="learning-grid">
          {learningItems.map((item, index) => (
            <article className="learning-card" key={item.title}>
              <span className="learning-card-index">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
