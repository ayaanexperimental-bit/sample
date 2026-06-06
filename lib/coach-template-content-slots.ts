import type { CoachSiteContent } from "./admin-coach-sites";

export type CoachTemplateContentSlot = {
  description: string;
  field: keyof CoachSiteContent;
  required: boolean;
  section: "benefits" | "cta" | "faq" | "footer" | "hero" | "intro" | "journey" | "media" | "problem" | "vision";
};

export const coachTemplateContentSlots: CoachTemplateContentSlot[] = [
  { description: "Hero trust badge", field: "brandBadge", required: true, section: "hero" },
  { description: "Hero support badge", field: "brandEyebrow", required: true, section: "hero" },
  { description: "Hero headline", field: "heroHeadline", required: true, section: "hero" },
  { description: "Hero subheadline", field: "subheadline", required: true, section: "hero" },
  { description: "Hero trust label", field: "heroTrustLine", required: true, section: "hero" },
  { description: "Hero trust copy", field: "heroMicroTrustText", required: true, section: "hero" },
  { description: "Introduction section heading", field: "introHeading", required: true, section: "intro" },
  { description: "Coach introduction paragraph", field: "coachIntro", required: true, section: "intro" },
  { description: "Coach mission paragraph", field: "visionText", required: true, section: "vision" },
  { description: "Problem section heading", field: "problemHeading", required: true, section: "problem" },
  { description: "Problem bullets", field: "problemPoints", required: true, section: "problem" },
  { description: "Trust note", field: "trustText", required: true, section: "cta" },
  { description: "Journey section heading", field: "journeyHeading", required: true, section: "journey" },
  { description: "Journey cards", field: "journeySteps", required: true, section: "journey" },
  { description: "Benefits section heading", field: "benefitsHeading", required: true, section: "benefits" },
  { description: "Benefit card titles", field: "benefits", required: true, section: "benefits" },
  { description: "Benefit card descriptions", field: "benefitDescriptions", required: true, section: "benefits" },
  { description: "Media section label", field: "mediaSubheading", required: true, section: "media" },
  { description: "Media section heading", field: "mediaHeading", required: true, section: "media" },
  { description: "Media section body", field: "mediaBody", required: true, section: "media" },
  { description: "CTA heading text", field: "ctaText", required: true, section: "cta" },
  { description: "FAQ section heading", field: "faqHeading", required: true, section: "faq" },
  { description: "FAQ entries", field: "faq", required: true, section: "faq" },
  { description: "Footer headline", field: "footerHeadline", required: true, section: "footer" },
  { description: "Footer education disclaimer", field: "footerText", required: true, section: "footer" },
  { description: "Short share/social copy", field: "socialCopy", required: true, section: "cta" }
];

export const requiredCoachTemplateContentFields = coachTemplateContentSlots
  .filter((slot) => slot.required)
  .map((slot) => slot.field);
