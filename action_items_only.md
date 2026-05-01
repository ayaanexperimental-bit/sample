# Action Items Only

Source reviewed:
- `C:\Users\Yours Wellness\Documents\Codex\consolidated_landing_page_automation_plan.md`

## A. Immediate Decisions Needed From Business Owner

- Confirm exact brand name.
- Confirm mother's public role/title.
- Provide short bio.
- Provide long bio.
- Provide public credentials that can be displayed.
- Confirm exact offer name.
- Confirm workshop/session format.
- Confirm workshop date.
- Confirm workshop time.
- Confirm workshop duration.
- Confirm workshop language.
- Confirm timezone.
- Confirm price.
- Confirm inclusions.
- Confirm bonuses.
- Confirm refund, cancellation, or reschedule policy.
- Confirm primary CTA text.
- Provide support email.
- Provide support WhatsApp number.
- Use payment-first qualification: no required lead form before checkout.
- Use n8n-first automation handoff for v1.
- Do not build a separate admin dashboard in the current phase.
- Keep retry limits and manual follow-up workflow inside n8n for now.
- Decide deployment target: Vercel, Docker server, or another cloud.
- Confirm domain and DNS access.
- Confirm staging environment before production unless explicitly declined.

## B. Assets To Collect

- Provide main hero photo.
- Provide secondary photos.
- Provide logo.
- Provide favicon.
- Provide brand colors.
- Provide font preferences.
- Provide approved testimonials.
- Decide whether video testimonials are needed.

## C. Legal, Medical, and Compliance Actions

- Provide privacy policy text.
- Provide terms text.
- Provide disclaimer text.
- Approve safe medical-copy rules.
- List claims that must be avoided.
- List phrases that must be avoided.
- List competitor references that must be avoided.
- Avoid cure claims.
- Avoid permanent reversal claims.
- Avoid guaranteed fertility claims.
- Avoid guaranteed skin-result claims.
- Avoid guaranteed timeline claims.
- Use safer wording around education, support, improvement, symptom awareness, sustainability, clinician supervision, and results varying.
- Confirm that health-sensitive fields will not be sent to Meta, Google Analytics, or other ad platforms.

## D. Payment Setup Actions

- Use Razorpay Standard Checkout with Orders API.
- Keep checkout payment-first, with no required lead form before payment.
- Provide Razorpay test keys.
- Provide Razorpay live keys when ready.
- Provide Razorpay webhook secret.
- Configure Razorpay webhook endpoint.
- Ensure payment success is marked only after server-side verification.
- Ensure frontend success redirect is not treated as payment proof.
- Ensure duplicate Razorpay webhook events are idempotent.
- Capture paid customer records after verified payment.
- Use a post-payment fallback form only if Razorpay contact details are missing.
- Redirect to the Thank You page immediately after verified payment.
- Use Option B for the primary WhatsApp community button: Thank You Page button -> n8n click-tracking webhook -> real WhatsApp community invite link.
- Do not point the Thank You Page button directly to the raw WhatsApp group link.

## E. Google Sheets Setup Actions

- Google Sheet ID provided: `1D1orv4pqfmI7WRGzvCP_jMspFlAQPaXTDm5H3HerxO8`.
- Use n8n to write/update Google Sheets for now.
- Do not write to Google Sheets from the frontend/browser.
- Keep the database as source of truth and Google Sheets as reporting dashboard only.
- Google Sheet owner/admin email provided: `ayaanexperimental@gmail.com`.
- Confirm required sheet tab names.
- Confirm required sheet columns.
- Google service account email provided: `workshop-sheet-writer@pcos-landing-page-automation.iam.gserviceaccount.com`.
- Keep Google service account setup documented for n8n/reporting access.
- Confirm n8n Google Sheets credential setup.
- Create or verify these sheet tabs:
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
- Confirm column mapping for:
  - lead_id
  - order_id
  - full_name
  - phone_number
  - email
  - guest_name
  - coach_name
  - workshop_slot
  - language
  - amount
  - currency
  - payment_status
  - payment_gateway
  - razorpay_payment_id
  - razorpay_order_id
  - razorpay_signature_verified
  - utm_source
  - utm_medium
  - utm_campaign
  - utm_content
  - utm_term
  - landing_page_variant
  - created_at
  - payment_attempted_at
  - payment_confirmed_at
  - refund_status
  - chargeback_status
  - email_sent_status
  - email_sent_at
  - email_error
  - whatsapp_sent_status
  - whatsapp_sent_at
  - whatsapp_error
  - onboarding_call_link
  - whatsapp_group_link
  - zoom_link
  - admin_notes

## F. Email Setup Actions

- Keep email sending inside n8n for now.
- Choose email provider.
- Provide sender domain.
- Provide sender name.
- Provide sender email.
- Provide email API key securely.
- Provide exact confirmation email copy or approve generated version.
- Provide pending-payment email copy if needed.
- Provide failed-payment recovery email copy if needed.
- Provide refund email copy if needed.
- Provide admin alert recipient email.
- Confirm confirmation email includes:
  - payment confirmation
  - workshop/program name
  - date and time
  - Zoom/onboarding call link
  - WhatsApp group/community link
  - preparation instructions
  - support contact
  - refund/reschedule note if applicable

## G. WhatsApp Setup Actions

- Keep WhatsApp sending and reminder logic inside n8n for now.
- Choose WhatsApp provider.
- Provide WhatsApp Business API token or vendor credentials.
- Provide phone number ID or sender ID.
- Provide approved WhatsApp template name.
- Provide WhatsApp template variables.
- Provide WhatsApp group/community link.
- Provide exact onboarding WhatsApp copy or approve generated version.
- Provide pending-payment WhatsApp copy if needed.
- Provide failed-payment recovery WhatsApp copy if needed.
- Provide refund WhatsApp copy if needed.
- Confirm WhatsApp onboarding message includes:
  - greeting
  - payment confirmation
  - workshop/program date and time
  - Zoom link
  - WhatsApp group/community link
  - preparation checklist
  - support number

## G.1 n8n Setup Actions

- Provide n8n webhook URL.
- Provide n8n webhook secret.
- Provide `N8N_WHATSAPP_CLICK_TRACKING_URL`.
- Create n8n workflow for `paid_user_created`.
- Create n8n tracking workflow for WhatsApp community button clicks and redirect.
- Ensure n8n tracking webhook accepts the required `whatsapp_group_link_clicked` payload.
- Ensure n8n tracking webhook redirects to the real WhatsApp community invite link.
- Create scheduled n8n reminder workflow.
- Configure n8n Google Sheets credential.
- Configure n8n email credential.
- Configure n8n WhatsApp provider credential.
- Configure admin alert recipient.
- Confirm whether group-join webhook is available from the WhatsApp provider.

## H. Operations Actions

- Provide Zoom/onboarding call link.
- Provide WhatsApp group/community link.
- Provide support contact details.
- Provide admin email for failure alerts.
- Define owner workflow for checking Google Sheets.
- Define manual follow-up process for:
  - paid but email failed
  - paid but WhatsApp failed
  - paid but Google Sheets sync failed
  - payment pending too long
  - refund or chargeback

## I. Phase 0 Implementation Actions

- Create project spec document.
- Document reference page structure.
- Document reference funnel.
- Document reference-page risks.
- Define new brand goals.
- Define missing resource list.
- Define landing page information architecture.
- Define tone rules.
- Define medical-copy constraints.
- Define compliance rules.
- Define technical architecture.
- Define routes.
- Define database tables.
- Define integrations.
- Define environments.
- Define isolated prompt-refinement / council module scope.
- Get approval before Phase 1.

## J. Phase 1 Frontend Actions

- Initialize Next.js / TypeScript project.
- Configure linting.
- Configure formatting.
- Create environment example.
- Create base README.
- Create base app layout.
- Create global CSS.
- Create design tokens or constants.
- Create Button primitive.
- Create Container primitive.
- Create Section primitive.
- Create Badge primitive.
- Create content config files.
- Build hero section.
- Build credibility strip.
- Build "who this is for" section.
- Build "what you will learn" section.
- Build method pillars section.
- Build outcomes / expectations section.
- Build testimonials section.
- Build logistics section.
- Build bonuses section.
- Build pricing and CTA section.
- Build FAQ section.
- Build compliance footer.
- Create privacy page.
- Create terms page.
- Create disclaimer page.
- Add responsive polish.
- Add image optimization.
- Add metadata.
- Add placeholder favicon.
- Produce Phase 1 QA report.

## K. Phase 2 Backend and Automation Actions

- Add minimal `registrations` model/status fields.
- Add `automation_events` retry-safe logging.
- Add Razorpay test order creation route.
- Add Razorpay payment verification route.
- Add secure Thank You Page registration token lookup.
- Add Thank You page n8n tracking button URL support.
- Add n8n `paid_user_created` event dispatch service with placeholder env vars.
- Track successful payments.
- Track failed payments.
- Track pending payments.
- Track refunds.
- Track chargebacks/disputes.
- Log failed n8n dispatches.
- Defer direct Google Sheets sync job system.
- Defer direct email provider integration.
- Defer direct WhatsApp provider integration.
- Defer backend reminder workers.
- Defer admin dashboard.

## L. Phase 2 Testing Actions

- Test successful payment flow:
  - payment success
  - database update
  - Thank You page
  - n8n tracking button URL
  - paid_user_created n8n dispatch
- Test failed payment flow:
  - failed payment saved
  - Failed Payments sheet updated
  - recovery message optional
  - onboarding link not sent
- Test pending payment flow:
  - pending payment saved
  - onboarding confirmation not sent
  - success confirmed only after verified webhook
- Test refund handling.
- Test chargeback/dispute handling.
- Test duplicate webhook handling.
- Test n8n dispatch failure logging and retry.
- Test that Google Sheets/email/WhatsApp are not blocking the user-facing flow.

## M. Phase 3 Production Hardening Actions

- Add Sentry or equivalent monitoring.
- Add request-level structured logging.
- Add security headers.
- Tighten rate limiting.
- Add deployment documentation.
- Add Dockerfile or deployment config.
- Add staging environment docs.
- Add production environment docs.
- Add backup notes.
- Add restore notes.
- Add health-check guidance.
- Add readiness guidance.
- Add incident-response runbook.
- Add launch checklist.
- Produce final production readiness report.

## N. Required Final Acceptance Checks

- Successful payment updates the database.
- Successful payment dispatches `paid_user_created` to n8n.
- Thank You page shows tracked WhatsApp community button.
- Thank You page WhatsApp button points to the n8n tracking webhook.
- Failed payment updates the database.
- Failed payment syncs to Failed Payments tab.
- Pending payment is tracked correctly.
- Refund status can be recorded.
- Chargeback status can be recorded.
- Duplicate webhook does not create duplicate rows.
- Duplicate webhook does not send duplicate emails.
- Duplicate webhook does not send duplicate WhatsApp messages.
- n8n dispatch failure does not lose registration data.
- Backend does not directly write Google Sheets in the current phase.
- Backend does not directly send email in the current phase.
- Backend does not directly send WhatsApp in the current phase.
- Secrets are stored securely.
- Browser never writes directly to Google Sheets.
- Webhook signature verification works.
- Automation QA report is produced.
