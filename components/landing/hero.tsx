import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import type { WorkshopSchedule } from "@/lib/workshop-schedule";

type HeroProps = {
  schedule: WorkshopSchedule;
};

export function Hero({ schedule }: HeroProps) {
  const workshopDetails = [
    "Live online masterclass",
    "PMOS/PCOD lifestyle education",
    `Next session: ${schedule.dateLabel}, ${schedule.timeLabel}`
  ];

  return (
    <Section className="hero-section" aria-labelledby="hero-title">
      <Container className="hero-layout" size="wide">
        <div className="hero-copy">
          <Badge tone="accent">HEAL YOUR HORMONES Masterclass</Badge>
          <h1 id="hero-title">
            Practical <span className="gradient-text">PMOS/PCOD</span> lifestyle guidance for women
          </h1>
          <p className="hero-lede">
            A guided masterclass for women who want practical, symptom-aware routines for wellness,
            confidence, and everyday self-care. This is education and support, not a replacement for
            medical advice.
          </p>
        </div>

        <div className="hero-media" aria-label="Masterclass preview video">
          <div className="hero-orbit hero-orbit--one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--two" aria-hidden="true" />
          <figure className="hero-photo-slot">
            <iframe
              className="hero-video-frame"
              src="https://www.youtube-nocookie.com/embed/4jKkT3d8gdI"
              title="Heal Your Hormones Masterclass preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </figure>
          <div className="hero-media-caption">
            <strong>Guided live session</strong>
            <span>Education-first, symptom-aware, and supportive.</span>
          </div>
        </div>

        <div className="hero-actions" aria-label="Primary actions">
          <Button href="#registration" size="lg">
            Reserve My Seat
          </Button>
          <Button href="#details" variant="secondary" size="lg">
            View Details
          </Button>
        </div>

        <ul className="hero-details" aria-label="Masterclass details">
          {workshopDetails.map((detail) => (
            <li key={detail}>
              <span aria-hidden="true" />
              {detail}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
