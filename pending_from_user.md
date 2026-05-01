# Pending From User

This is the running tracker for decisions, assets, credentials, copy, and operational details that must come from you before the project can be launch-ready.

I will keep this updated as the build progresses.

## Already Provided

- Final price: `₹29`
- Hero / coach photo: `public/images/coach-hero.jpg`
- Page metadata title: `WOMEN HEALTH MASTERCLASS 101`
- Page metadata description: `AN INTEGRATED AND HOLISTIC APPROACH FOR PCOS/PCOD`
- Legal/compliance template pack: privacy, terms, disclaimer, refund, cancellation, avoid-list, safer wording, checkbox text, footer disclaimer, payment note, WhatsApp/email compliance line
- Payment flow decision: Razorpay Standard Checkout with Orders API, payment-first, no required lead form before checkout
- Automation architecture decision: n8n-first handoff; no direct backend Google Sheets/email/WhatsApp automation for now
- Google Sheet ID: `1D1orv4pqfmI7WRGzvCP_jMspFlAQPaXTDm5H3HerxO8`
- Google Sheets access decision: n8n manages Sheet updates for now; service account setup remains documented for n8n/reporting access
- Google Sheet owner/admin email: `ayaanexperimental@gmail.com`
- Google service account email: `workshop-sheet-writer@pcos-landing-page-automation.iam.gserviceaccount.com`
- Google service account JSON key file saved locally: `secrets/google-service-account.json`
- Google Sheet shared with service account as Editor

## Brand And Offer

- Exact brand name, if different from `WOMEN HEALTH MASTERCLASS 101`
- Coach name
- Coach public role/title
- Short coach bio
- Long coach bio
- Public credentials
- Final offer name
- Final primary CTA text
- Final brand colors
- Font preference
- Logo
- Final favicon or brand mark

## Session Details

- Final date
- Final time
- Timezone
- Duration
- Language
- Delivery platform
- Whether replay is available
- What happens immediately after payment

## Content And Proof

- Final curriculum
- Final method/framework name
- Final pillar names and descriptions
- Final expected outcomes language
- Approved testimonials
- Testimonial permission status
- Testimonial names, initials, or anonymized labels
- Testimonial photos/videos if allowed

## Offer Inclusions

- Final inclusions
- Bonus names
- Worksheet/checklist/planner availability
- Replay policy
- Support policy

## Legal And Compliance

- Legal review of provided policy templates before launch
- Replace `[Date]`
- Replace `[Business Legal Name]`
- Replace `[Brand Name]` wherever final brand naming differs
- Replace `[Website URL]`
- Replace `[Support Email]`
- Replace `[WhatsApp Number]`
- Replace `[Business Address]`
- Replace `[City, State]`
- Replace refund request window: `[X days/hours]`
- Confirm whether any policy wording should be shortened for the live website

## Payment

- Razorpay method: Standard Checkout with Orders API
- Razorpay test key ID
- Razorpay test key secret
- Razorpay live key ID
- Razorpay live key secret
- Razorpay webhook secret
- Final payment link or checkout setup decision
- Confirm checkout amount should remain `₹29` / `2900` paise
- Confirm post-payment fallback fields if Razorpay contact details are missing
- Confirm Razorpay dashboard webhook event selections

## n8n Automation

- n8n webhook URL
- n8n webhook secret
- `N8N_WHATSAPP_CLICK_TRACKING_URL`
- n8n click webhook must accept required `whatsapp_group_link_clicked` payload: `registration_id`, `registration_token`, `full_name`, `phone_number`, `email`, `program_slug`, `payment_status`, `member_status`, `clicked_at`
- Confirm n8n Google Sheets credential method
- Confirm n8n workflow owner/admin access
- Confirm n8n reminder interval: 10 minutes or 15 minutes
- Confirm reminder spacing after first reminder: 1 hour or 1.5 hours
- Confirm admin WhatsApp alert recipient
- Confirm group-join webhook availability from chosen WhatsApp provider

## Google Sheets

- Confirmation of n8n-managed tab names
- Confirmation of final n8n column mapping

## Email

- Email provider
- Sender domain
- Sender name
- Sender email
- Email API key
- Confirmation email copy
- Pending-payment email copy
- Failed-payment recovery email copy
- Refund email copy
- Admin alert email

## WhatsApp

- WhatsApp provider
- WhatsApp Business API token or vendor credentials
- Phone number ID / sender ID
- Approved template name
- Template variables
- WhatsApp group/community link
- Onboarding WhatsApp copy
- Pending-payment WhatsApp copy
- Failed-payment recovery WhatsApp copy
- Refund WhatsApp copy

## Operations And Deployment

- Support email
- Support WhatsApp number
- Zoom/onboarding call link
- Retry limits
- Manual follow-up workflow
- Deployment target
- Domain
- DNS access
- Staging environment decision
- Database provider
- Database migration tool choice
- UUID generation strategy
- PII retention rules
- Admin protection method
