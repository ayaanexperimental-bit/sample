import { CheckoutButton } from "@/components/landing/checkout-button";
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
          <h2 id="pricing-title">Reserve your place after the final schedule is confirmed.</h2>
          <p>
            Payment will connect to a hosted Razorpay flow later. Confirmation is sent only after
            the payment webhook is verified by the system.
          </p>
        </div>

        <div className="pricing-card">
          <p className="pricing-label">Current price</p>
          <div className="pricing-price">₹29</div>
          <p className="pricing-note">
            Refund policy and payment link will be added after approval.
          </p>
          <CheckoutButton />
          <p className="pricing-security">
            Hosted payment. No card details are collected on this site.
          </p>
        </div>
      </Container>
    </Section>
  );
}
