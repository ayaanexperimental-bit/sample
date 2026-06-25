import type { CoachSiteContent } from "./admin-coach-sites";

export type CoachTemplateContentSlot = {
  aiRegeneratable: boolean;
  description: string;
  editable: boolean;
  field: keyof CoachSiteContent;
  label: string;
  required: boolean;
  section:
    | "benefits"
    | "bonus"
    | "cta"
    | "faq"
    | "footer"
    | "hero"
    | "intro"
    | "journey"
    | "media"
    | "problem"
    | "vision";
  slotKey: string;
  validationRule: string;
};

type CoachTemplateContentSlotInput = Omit<
  CoachTemplateContentSlot,
  "aiRegeneratable" | "editable" | "label" | "slotKey" | "validationRule"
> &
  Partial<
    Pick<
      CoachTemplateContentSlot,
      "aiRegeneratable" | "editable" | "label" | "slotKey" | "validationRule"
    >
  >;

function createContentSlot(input: CoachTemplateContentSlotInput): CoachTemplateContentSlot {
  return {
    aiRegeneratable: input.aiRegeneratable ?? input.editable ?? true,
    description: input.description,
    editable: input.editable ?? true,
    field: input.field,
    label: input.label || input.description,
    required: input.required,
    section: input.section,
    slotKey: input.slotKey || String(input.field),
    validationRule:
      input.validationRule ||
      (input.required
        ? "Required visible copy. Keep coach-specific and non-empty."
        : "Optional visible copy. Keep coach-specific when provided.")
  };
}

const coachTemplateContentSlotInputs: CoachTemplateContentSlotInput[] = [
  { description: "Hero trust badge", field: "brandBadge", required: true, section: "hero" },
  { description: "Hero support badge", field: "brandEyebrow", required: true, section: "hero" },
  { description: "Hero headline", field: "heroHeadline", required: true, section: "hero" },
  { description: "Hero subheadline", field: "subheadline", required: true, section: "hero" },
  { description: "Hero media label", field: "heroMediaLabel", required: true, section: "hero" },
  { description: "Hero trust label", field: "heroTrustLine", required: true, section: "hero" },
  { description: "Hero trust copy", field: "heroMicroTrustText", required: true, section: "hero" },
  { description: "Introduction section label", field: "introSectionLabel", required: true, section: "intro" },
  { description: "Introduction section heading", field: "introHeading", required: true, section: "intro" },
  { description: "Coach intro card label", field: "coachIntroLabel", required: true, section: "intro" },
  { description: "Coach introduction paragraph", field: "coachIntro", required: true, section: "intro" },
  { description: "Mission card label", field: "visionLabel", required: true, section: "vision" },
  { description: "Coach mission paragraph", field: "visionText", required: true, section: "vision" },
  { description: "Problem section label", field: "problemSectionLabel", required: true, section: "problem" },
  { description: "Problem section heading", field: "problemHeading", required: true, section: "problem" },
  { description: "Problem bullets", field: "problemPoints", required: true, section: "problem" },
  { description: "Trust note", field: "trustText", required: true, section: "cta" },
  { description: "Journey section label", field: "journeySectionLabel", required: true, section: "journey" },
  { description: "Journey section heading", field: "journeyHeading", required: true, section: "journey" },
  { description: "Journey cards", field: "journeySteps", required: true, section: "journey" },
  {
    description: "Bonus section label",
    field: "benefitsSectionLabel",
    required: true,
    section: "bonus",
    slotKey: "bonus.eyebrow",
    validationRule: "Required canonical bonus label. Keep it niche-aware and non-medical."
  },
  {
    description: "Bonus section heading",
    field: "benefitsHeading",
    required: true,
    section: "bonus",
    slotKey: "bonus.heading",
    validationRule:
      "Required canonical bonus heading. May adapt to niche but must not invent new assets, rename fixed services, or use fake scarcity."
  },
  {
    description: "Bonus card descriptions",
    field: "benefitDescriptions",
    required: true,
    section: "bonus",
    slotKey: "bonus.items[].description",
    validationRule:
      "Editable display description only. Keep education-first; no cure, treatment, or guaranteed-result claims."
  },
  { description: "Media module label", field: "mediaModuleLabel", required: true, section: "media" },
  { description: "Media section label", field: "mediaSubheading", required: true, section: "media" },
  { description: "Media section heading", field: "mediaHeading", required: true, section: "media" },
  { description: "Media section body", field: "mediaBody", required: true, section: "media" },
  { description: "CTA section label", field: "ctaSectionLabel", required: true, section: "cta" },
  { description: "CTA heading text", field: "ctaText", required: true, section: "cta" },
  { description: "Sticky CTA label", field: "stickyCtaLabel", required: true, section: "cta" },
  { description: "Sticky CTA heading", field: "stickyCtaHeading", required: true, section: "cta" },
  { description: "Sticky CTA coach context", field: "stickyCtaContext", required: true, section: "hero" },
  { description: "Sticky CTA contact button", field: "stickyCtaContactButton", required: true, section: "cta" },
  { description: "Support section heading", field: "supportHeading", required: true, section: "cta" },
  { description: "Support phone label", field: "supportPhoneLabel", required: true, section: "cta" },
  { description: "Support WhatsApp label", field: "supportWhatsappLabel", required: true, section: "cta" },
  { description: "Support WhatsApp button", field: "supportWhatsappButton", required: true, section: "cta" },
  { description: "Support email label", field: "supportEmailLabel", required: true, section: "cta" },
  { description: "Support primary button", field: "supportPrimaryButton", required: true, section: "cta" },
  { description: "FAQ section label", field: "faqSectionLabel", required: true, section: "faq" },
  { description: "FAQ section heading", field: "faqHeading", required: true, section: "faq" },
  { description: "FAQ entries", field: "faq", required: true, section: "faq" },
  {
    aiRegeneratable: false,
    description: "Footer brand line",
    editable: true,
    field: "footerBrandLine",
    required: true,
    section: "footer",
    validationRule: "Required brand/footer copy. Must preserve YW Nutritech coach-site context."
  },
  {
    description: "Footer headline",
    field: "footerHeadline",
    required: true,
    section: "footer"
  },
  {
    aiRegeneratable: false,
    description: "Footer education disclaimer",
    editable: true,
    field: "footerText",
    required: true,
    section: "footer",
    validationRule:
      "Required legal/disclaimer copy. Must stay education-first and cannot claim diagnosis, treatment, cure, or guaranteed results."
  },
  {
    aiRegeneratable: false,
    description: "Support privacy note",
    editable: true,
    field: "supportPrivacyNote",
    required: true,
    section: "footer",
    validationRule: "Required public-support notice. Must not expose admin-only data."
  },
  { description: "Short share/social copy", field: "socialCopy", required: true, section: "cta" }
];

export const coachTemplateContentSlots: CoachTemplateContentSlot[] =
  coachTemplateContentSlotInputs.map(createContentSlot);

export const nonEditableCoachTemplateRules = [
  {
    label: "YW Nutritech branding placement",
    rule: "Brand name, public routing, sticky navigation, sticky CTA layout, and legal link placement are locked template structure."
  },
  {
    label: "Canonical bonus assets",
    rule: "The nicheAdaptiveBonusSection always keeps 3 universal service cards: Life-Long Health Calculators, Lifetime Support Sessions, and Lifestyle Success Toolkit. It can adapt supporting descriptions and SmartBonusVisual framing, but service titles, IDs, asset type, asset identity, asset availability, asset value, and CTA destination are locked."
  },
  {
    label: "Per-coach registration links",
    rule: "Google Form URLs are site data, not template data. Publishing requires the coach-specific form link."
  },
  {
    label: "Analytics and route logic",
    rule: "Analytics event names, public slugs, status behavior, and security/payment flows are non-editable."
  },
  {
    label: "Responsive layout",
    rule: "Canonical mobile/tablet/desktop layout and collision spacing are controlled by the template renderer."
  }
] as const;

export const requiredCoachTemplateContentFields = coachTemplateContentSlots
  .filter((slot) => slot.required)
  .map((slot) => slot.field);
