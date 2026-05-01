# Phase 0 Project Spec

Micro-task: 0.1

Project: PCOS / Women's Wellness / Beauty Brand Landing Page and Automation System

## 1. Project Goal

Build a production-grade landing page and conversion system for a new women's wellness, PCOS, and beauty-focused expert brand.

The system should be inspired by the conversion logic of the reference landing page, but it must not copy the old brand, visuals, exact claims, medical wording, or assets.

The final system should support:

- Mobile-first paid traffic from Instagram / Meta ads.
- A premium long-form landing page.
- Lead capture.
- Hosted Razorpay payment.
- Verified webhook-based payment confirmation.
- Database-backed operational records.
- Google Sheets reporting.
- Email confirmation.
- WhatsApp onboarding.
- Retry handling.
- Manual follow-up handling.
- Compliance-friendly health and beauty copy.

## 2. Reference Page Summary

The reference page appears to be a long-form direct-response workshop page.

Observed funnel pattern:

```text
Ad traffic
-> Long-form landing page
-> Repeated CTA buttons
-> Hosted Razorpay payment destination
-> Possible post-payment automation
```

The reference page's effective conversion mechanics include:

- Strong transformation-oriented headline.
- Coach/authority positioning.
- Fixed workshop date and time.
- Repeated CTA sections.
- Low-price paid entry offer.
- Urgency and countdown framing.
- Testimonials and social proof.
- Pain-point identification.
- Workshop agenda.
- Bonus stacking.
- FAQ objection handling.
- Payment handoff to Razorpay.

## 3. What To Preserve From The Reference Funnel

The new build should preserve these structural ideas:

- Single clear primary offer.
- One repeated primary CTA.
- Mobile-first scroll journey.
- Strong hero section with coach identity.
- Clear date, time, language, price, and delivery format.
- Social proof and credibility.
- Outcomes framed as learning and support.
- FAQ section near the end.
- Payment through a hosted provider.
- Post-payment onboarding.

## 4. What To Improve

The new build must improve:

- Medical-safety language.
- Premium brand trust.
- Mobile speed and usability.
- Accessibility.
- Performance.
- Tracking discipline.
- Data ownership.
- Payment verification.
- Automation reliability.
- Retry and manual follow-up handling.
- Deployment readiness.

## 5. Key Product Requirements

### Landing Page

- Build a premium, mobile-first landing page.
- Use safe wellness and education-oriented copy.
- Avoid unverifiable medical promises.
- Use real brand assets once provided.
- Keep sections modular and easy to edit.
- CTA should eventually connect to hosted Razorpay flow.

### Payment

- Use hosted Razorpay Payment Page or hosted checkout redirect.
- Do not collect raw card data.
- Do not mark payment successful from frontend redirect alone.
- Mark payment successful only after verified Razorpay webhook.
- Handle duplicate webhooks idempotently.

### Database

- Use database as source of truth.
- Track leads, orders, payment events, sync jobs, message delivery, automation status, manual follow-up, and audit logs.

### Google Sheets

- Use Google Sheets as reporting dashboard only.
- Never write to Google Sheets directly from the browser.
- Sync server-side after database write.
- Retry failed syncs.
- Add unresolved failures to manual follow-up.

### Email

- Send confirmation email only after verified successful payment.
- Log delivery status.
- Retry failures.
- Support manual resend.

### WhatsApp

- Send onboarding WhatsApp message only after verified successful payment.
- Use approved WhatsApp provider/template.
- Log delivery status.
- Retry failures.
- Support manual resend.

## 6. Required Public Pages

- `/`
- `/success`
- `/payment-pending`
- `/payment-failed`
- `/privacy`
- `/terms`
- `/disclaimer`

## 7. Required Backend Routes

- `GET /api/health`
- `POST /api/leads`
- `POST /api/checkout/session`
- `POST /api/payments/webhook`
- `POST /api/admin/resend-email`
- `POST /api/admin/resend-whatsapp`

## 8. Required Database Tables

- `leads`
- `orders`
- `payment_events`
- `google_sheet_sync_jobs`
- `message_templates`
- `email_delivery_logs`
- `whatsapp_delivery_logs`
- `automation_runs`
- `manual_followup_queue`
- `audit_logs`

## 9. Required Google Sheet Tabs

- All Leads
- Checkout Started
- Successful Payments
- Failed Payments
- Pending Payments
- Refunded Payments
- Chargebacks / Disputes
- Onboarding Messages Sent
- Email Failures
- WhatsApp Failures
- Manual Follow-up Required

## 10. Medical and Compliance Rules

The site must avoid:

- Cure claims.
- Permanent reversal claims.
- Guaranteed fertility claims.
- Guaranteed beauty or skin-result claims.
- Guaranteed timeline claims.
- Medication-stop claims unless clearly framed as clinician-supervised.
- Unsupported percentage success claims.

Preferred wording:

- Learn.
- Support.
- Improve.
- Understand.
- Symptom-aware.
- Sustainable.
- Clinician-supervised.
- Results vary.

Tracking rule:

- Do not send symptom details, diagnosis strings, or health-sensitive free-text content to Meta, Google Analytics, or other ad platforms.

## 11. Recommended Technical Stack

Default recommendation:

- Next.js App Router.
- TypeScript.
- Tailwind CSS or equivalent clean styling system.
- PostgreSQL.
- Hosted Razorpay payment flow.
- Google Sheets API or secure Apps Script endpoint.
- Email provider abstraction.
- WhatsApp provider abstraction.
- Sentry or equivalent monitoring.
- Docker-compatible deployment.
- Environment-variable based secrets.

## 12. Phase Plan

### Phase 0: Audit, Spec, and Simulation

Create the project spec, landing page information architecture, technical architecture, and isolated prompt-refinement/council module note.

### Phase 1: Frontend Skeleton and Content System

Build the landing page shell, sections, policies, responsive polish, and Phase 1 QA report.

### Phase 2: Functional Conversion, Payment, Sheets, Email, and WhatsApp Automation

Build database, checkout, webhooks, Sheets sync, email, WhatsApp, retries, manual follow-up, and automation QA.

### Phase 3: Production Hardening

Add monitoring, logging, security headers, rate limits, deployment docs, backup/restore notes, incident runbook, launch checklist, and readiness report.

## 13. Missing Assets and Decisions

Business and brand:

- Exact brand name.
- Mother's public role/title.
- Short bio.
- Long bio.
- Public credentials.
- Exact offer name.
- Workshop/session format.
- Date, time, duration, language, and timezone.
- Price, inclusions, bonuses, and refund policy.
- Primary CTA text.
- Support email.
- Support WhatsApp number.

Assets:

- Main hero photo.
- Secondary photos.
- Logo.
- Favicon.
- Brand colors.
- Font preferences.
- Approved testimonials.
- Decision on video testimonials.

Legal:

- Privacy policy text.
- Terms text.
- Disclaimer text.
- Claims and phrases to avoid.

Payment:

- Razorpay hosted payment method choice.
- Razorpay test keys.
- Razorpay live keys.
- Razorpay webhook secret.
- Decision on when to capture leads.

Google Sheets:

- Google Sheet ID.
- Google Sheet owner/admin email.
- Service account credentials or secure Apps Script endpoint.
- Confirmed tab names and columns.

Email:

- Email provider.
- Sender domain.
- Sender name.
- Sender email.
- Email API key.
- Confirmation email copy.
- Pending, failed, and refund email copy if needed.

WhatsApp:

- WhatsApp provider.
- WhatsApp Business API token or vendor credentials.
- Phone number ID / sender ID.
- Approved template name.
- Template variables.
- WhatsApp group/community link.
- Onboarding, pending, failed, and refund message copy if needed.

Operations:

- Zoom/onboarding call link.
- Admin alert email.
- Retry limits.
- Manual follow-up workflow.
- Deployment target.
- Domain and DNS access.
- Staging environment decision.

## 14. Micro-task Protocol

All implementation must be done in small, approval-gated micro-tasks.

After each micro-task:

- State what changed.
- List files created and modified.
- Explain why the change was made.
- Explain how to test it.
- List assumptions.
- List missing assets or decisions.
- Stop and wait for approval.

