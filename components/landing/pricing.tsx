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
          <h2 id="pricing-title">Reserve your seat through secure Razorpay checkout.</h2>
          <p>
            Payment is handled by Razorpay. Paid registration reporting and follow-up are handled
            through Pabbly and Google Sheets outside this website.
          </p>
        </div>

        <div className="pricing-card">
          <p className="pricing-label">Current price</p>
          <div className="pricing-price">Rs. 51</div>
          <p className="pricing-note">
            Hosted checkout keeps payment details off this site.
          </p>
          <CheckoutButton />
          <p className="pricing-security">
            <span aria-hidden="true">*</span>
            Hosted payment. No card details are collected on this site.
          </p>
        </div>
      </Container>
    </Section>
  );
}
