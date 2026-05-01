import { Bonuses } from "@/components/landing/bonuses";
import { CredibilityStrip } from "@/components/landing/credibility-strip";
import { FAQ } from "@/components/landing/faq";
import { FooterCompliance } from "@/components/landing/footer-compliance";
import { Hero } from "@/components/landing/hero";
import { Logistics } from "@/components/landing/logistics";
import { MethodPillars } from "@/components/landing/method-pillars";
import { Outcomes } from "@/components/landing/outcomes";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { WhatYouLearn } from "@/components/landing/what-you-learn";
import { WhoItsFor } from "@/components/landing/who-its-for";

export default function Home() {
  return (
    <main id="top">
      <Hero />
      <CredibilityStrip />
      <WhoItsFor />
      <WhatYouLearn />
      <MethodPillars />
      <Outcomes />
      <Testimonials />
      <Logistics />
      <Bonuses />
      <Pricing />
      <FAQ />
      <FooterCompliance />
    </main>
  );
}
