# Phase 0 Landing Page Information Architecture

Micro-task: 0.2

Project: PCOS / Women's Wellness / Beauty Brand Landing Page and Automation System

## 1. Purpose

This document defines the public landing page structure before implementation.

The page should convert paid mobile traffic into paid workshop/program registrations while maintaining a premium, medically responsible, trust-first brand position.

Primary conversion:

```text
Visitor -> understands offer -> trusts coach -> starts checkout -> pays -> receives onboarding
```

Secondary conversion:

```text
Visitor -> submits lead details -> can be recovered if checkout fails or is abandoned
```

## 2. Page Strategy

The landing page should be a focused long-form sales page, not a generic brand website.

The page should answer these questions in order:

1. Who is this for?
2. What problem or desire does it address?
3. Who is guiding it?
4. What will the visitor learn or experience?
5. Why is it trustworthy?
6. What exactly is included?
7. When does it happen?
8. What does it cost?
9. What happens after payment?
10. What objections or safety concerns are answered?

## 3. Recommended Page Sections

### 1. Hero

Purpose:

- Establish the brand, coach, offer, and core promise.
- Make the CTA visible immediately.
- Show the main coach photo.

Content needed:

- Brand name.
- Offer name.
- Coach name and role.
- Workshop date/time/language.
- Price.
- Main hero photo.
- CTA text.

Copy rules:

- Use outcome-aware but non-guaranteed wording.
- Avoid cure, permanent reversal, and guaranteed beauty/health results.

### 2. Credibility Strip

Purpose:

- Give quick trust signals directly below the hero.
- Help mobile visitors decide whether to keep scrolling.

Possible trust signals:

- Credentials.
- Years of experience.
- Number of students or clients, only if verifiable.
- Languages supported.
- Workshop format.

Content needed:

- Public credentials.
- Approved proof numbers if any.
- Language and delivery mode.

### 3. Who This Is For

Purpose:

- Help the right visitor self-identify.
- Reduce mismatch and refund risk.

Possible bullets:

- Women looking for structured PCOS lifestyle education.
- Women struggling with routine, skin, weight, cycle, or confidence concerns.
- Women who want guided habits instead of random advice.
- Women who understand that results vary.

Copy rules:

- Do not imply diagnosis or treatment.
- Do not promise medical outcomes.

### 4. What You Will Learn

Purpose:

- Explain workshop value clearly.
- Shift from vague transformation to concrete learning outcomes.

Possible topics:

- PCOS-aware food routines.
- Lifestyle foundations.
- Beauty and self-care habits.
- Cycle and symptom tracking basics.
- Sustainable routine design.
- When to seek clinician support.

Content needed:

- Final workshop curriculum.

### 5. Method Pillars

Purpose:

- Present the coach's approach as organized and premium.
- Replace miracle framing with a clear framework.

Example pillars:

- Nourish.
- Move.
- Restore.
- Track.
- Glow.

Content needed:

- Final brand method or framework name.

### 6. Outcomes and Expectations

Purpose:

- Explain what participants can reasonably expect.
- Set honest expectations before payment.

Safe framing:

- Participants will leave with a clearer routine.
- Participants will understand common PCOS lifestyle foundations.
- Participants will know what to track.
- Participants will receive onboarding instructions.

Avoid:

- Guaranteed symptom disappearance.
- Guaranteed fertility claims.
- Guaranteed skin or weight results.
- Fixed timeline transformation claims.

### 7. Testimonials / Social Proof

Purpose:

- Build trust using real, approved proof.

Content needed:

- Approved testimonials.
- Names or anonymized initials.
- Permission status.
- Optional photos or videos.

Rules:

- Do not fabricate testimonials.
- Use results-vary framing where needed.
- Avoid before/after claims unless legally approved.

### 8. Logistics

Purpose:

- Make practical details easy to scan.

Must include:

- Date.
- Time.
- Timezone.
- Duration.
- Language.
- Platform: Zoom, WhatsApp, or other.
- What happens after payment.

Content needed:

- Final workshop schedule.
- Zoom/onboarding call link strategy.
- WhatsApp group/community link strategy.

### 9. Bonuses / Inclusions

Purpose:

- Clarify what is included in the paid offer.
- Increase perceived value without fake scarcity.

Possible inclusions:

- Workshop access.
- Checklist.
- Routine planner.
- WhatsApp reminder access.
- Onboarding call.
- Replay availability if applicable.

Content needed:

- Final inclusions and bonuses.

### 10. Pricing and CTA

Purpose:

- State the price, what is included, and the next action.

Must include:

- Price.
- Payment method.
- CTA.
- Refund or cancellation note.
- Secure payment reassurance.

Rules:

- CTA should eventually route to lead capture and hosted Razorpay checkout.
- Do not imply payment confirmation until verified webhook succeeds.

### 11. FAQ

Purpose:

- Handle objections and reduce support burden.

Recommended FAQ topics:

- Is this medical treatment?
- Is this suitable if I am already consulting a doctor?
- What happens after payment?
- How will I receive the Zoom or WhatsApp link?
- What if my payment is pending?
- What if I cannot attend live?
- Is there a refund or reschedule policy?
- What language will the session be in?
- Can I join from mobile?

### 12. Compliance Footer

Purpose:

- Provide trust, legal clarity, and support channels.

Must include:

- Privacy policy link.
- Terms link.
- Disclaimer link.
- Support email.
- Support WhatsApp number.
- Medical/results-vary disclaimer.

## 4. Tone Guidelines

The page should feel:

- Premium.
- Warm.
- Clear.
- Practical.
- Trustworthy.
- Calm.
- Mobile-first.

The page should not feel:

- Miracle-driven.
- Aggressive.
- Fear-heavy.
- Over-medical.
- Overloaded with fake urgency.
- Copied from the diabetes reference page.

## 5. Claim Boundaries

Allowed:

- Educational guidance.
- Lifestyle support.
- Symptom-aware routines.
- Better understanding.
- Structured preparation.
- Confidence and self-care language.
- Results vary.

Avoid:

- Cure PCOS.
- Reverse PCOS permanently.
- Fix infertility.
- Stop medicines.
- Guaranteed weight loss.
- Guaranteed glowing skin.
- Guaranteed hormonal balance.
- Guaranteed result in a fixed number of days.
- Unsupported success percentages.

## 6. CTA Journey

Recommended user journey:

```text
CTA click
-> lead capture or checkout init
-> hosted Razorpay payment
-> payment pending/success/failure state
-> verified webhook updates database
-> automation sends Google Sheet sync, email, and WhatsApp
```

CTA text options to decide later:

- Reserve My Seat
- Join the Workshop
- Start My Registration
- Book My Spot

## 7. Missing Inputs By Section

| Section | Missing Inputs |
|---|---|
| Hero | Brand name, offer name, coach name/title, hero photo, schedule, price, CTA |
| Credibility Strip | Credentials, verifiable numbers, language, delivery mode |
| Who This Is For | Audience definition and exclusions |
| What You Will Learn | Final curriculum |
| Method Pillars | Framework name and pillars |
| Outcomes | Approved expectation language |
| Testimonials | Approved testimonials and permissions |
| Logistics | Date, time, duration, timezone, language, platform |
| Bonuses | Final inclusions and bonus names |
| Pricing | Price, refund/reschedule policy |
| FAQ | Final policies and operational answers |
| Footer | Legal links, support contacts, disclaimer |

## 8. Acceptance Criteria For This IA

This IA is approved when:

- The section order feels right.
- The page has one clear paid conversion goal.
- The health claims are safe enough for a PCOS/wellness offer.
- The automation journey is represented.
- Missing inputs are clearly listed.
- The structure is ready for technical architecture and later frontend implementation.

