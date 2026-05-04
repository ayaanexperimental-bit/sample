import { CheckoutButton } from "@/components/landing/checkout-button";
import { LiquidProgressLayer } from "@/components/landing/liquid-progress-layer";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

export function Pricing() {
  return (
    <Section
      className="pricing-section"
      id="registration"
      tone="strong"
      aria-labelledby="pricing-title"
    >
      <Container className="pricing-layout">
        <div className="pricing-copy">
          <Badge tone="accent">Registration</Badge>
          <h2 id="pricing-title">Reserve before this limited seat offer resets.</h2>
        </div>

        <div className="pricing-card">
          <LiquidProgressLayer />
          <div className="pricing-card-content">
            <p className="pricing-label">Current price</p>
            <div className="pricing-price">Rs. 51</div>
            <p className="pricing-note">Checkout access is currently paused for final setup.</p>
            <CheckoutButton />
            <p className="pricing-security">
              <span aria-hidden="true">*</span>
              No card details are collected on this site.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
