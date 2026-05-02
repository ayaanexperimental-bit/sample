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
    "PCOS/PCOD lifestyle education",
    `Next session: ${schedule.dateLabel}, ${schedule.timeLabel}`
  ];

  return (
    <Section className="hero-section" aria-labelledby="hero-title">
      <header className="site-header" aria-label="Primary navigation">
        <a className="site-brand" href="#top" aria-label="Women Health Masterclass 101 home">
          <span>WHM</span>
          Women Health Masterclass 101
        </a>
        <nav className="site-nav" aria-label="Page sections">
          <a href="#details">Details</a>
          <a href="#registration">₹29</a>
        </nav>
      </header>
      <Container className="hero-layout" size="wide">
        <div className="hero-copy">
          <Badge tone="accent">Women Health Masterclass 101</Badge>
          <h1 id="hero-title">
            An integrated and holistic approach for <span className="gradient-text">PCOS/PCOD</span>
          </h1>
          <p className="hero-lede">
            A guided masterclass for women who want practical, symptom-aware routines for wellness,
            confidence, and everyday self-care. This is education and support, not a replacement for
            medical advice.
          </p>

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
        </div>

        <div className="hero-media" aria-label="Coach photo placeholder">
          <div className="hero-orbit hero-orbit--one" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--two" aria-hidden="true" />
          <figure className="hero-photo-slot">
            <img
              src="/images/coach-hero.jpg"
              alt="Coach portrait for Women Health Masterclass 101"
            />
          </figure>
          <div className="hero-media-caption">
            <strong>Guided live session</strong>
            <span>Education-first, symptom-aware, and supportive.</span>
          </div>
        </div>
      </Container>
    </Section>
  );
}
