import {
  type CoachSiteContent,
  type CoachHeroMediaType,
  type CoachSiteRecord,
  type CoachSiteStatus,
  EMPTY_COACH_SITE_FORM,
  createCoachSiteFromForm,
  getCoachPublicUrl,
  normalizeCoachSlug
} from "./admin-coach-sites";
import {
  DEFAULT_COACH_TEMPLATE_THEME_ID,
  type CoachTemplateThemeId,
  normalizeCoachTemplateThemeId
} from "./coach-template-themes";

export type ShopBuilderStatus =
  | "archived"
  | "draft"
  | "paid"
  | "payment_failed"
  | "pending_payment"
  | "paused"
  | "publish_failed"
  | "published"
  | "publishing"
  | "removed";

export type ShopBuilderState = {
  bio: string;
  coachEmail: string;
  coachName: string;
  coachPhone: string;
  contactLink: string;
  currentStep: number;
  email: string;
  heroMediaType: CoachHeroMediaType;
  location: string;
  logoUrl: string;
  niche: string;
  orderId: string;
  photoUrl: string;
  selectedThemeId: CoachTemplateThemeId;
  shortBio: string;
  slug: string;
  status: ShopBuilderStatus;
  videoUrl: string;
  whatsappLink: string;
  content: CoachSiteContent;
};

export const SHOP_BUILDER_STEPS = [
  "Coach Details",
  "Media & Contact",
  "Live Preview",
  "Payment",
  "Congratulations"
] as const;

export const EMPTY_SHOP_BUILDER_STATE: ShopBuilderState = {
  bio: "",
  coachEmail: "",
  coachName: "",
  coachPhone: "",
  contactLink: "",
  currentStep: 1,
  email: "",
  heroMediaType: "image",
  location: "",
  logoUrl: "",
  niche: "",
  orderId: "",
  photoUrl: "",
  selectedThemeId: DEFAULT_COACH_TEMPLATE_THEME_ID,
  shortBio: "",
  slug: "",
  status: "draft",
  videoUrl: "",
  whatsappLink: "",
  content: createShopContent({
    coachName: "",
    location: "",
    niche: "",
    shortBio: ""
  })
};

export type ShopValidationIssue = {
  field: keyof ShopBuilderState | "payment" | "preview";
  message: string;
  severity: "error" | "warning";
};

type ShopBuilderStateInput = Partial<
  Omit<ShopBuilderState, "content" | "currentStep" | "selectedThemeId" | "status">
> & {
  content?: Partial<CoachSiteContent>;
  currentStep?: unknown;
  selectedThemeId?: unknown;
  status?: unknown;
};

export function createShopContent({
  coachName,
  location,
  niche,
  shortBio
}: {
  coachName: string;
  location: string;
  niche: string;
  shortBio: string;
}): CoachSiteContent {
  const safeName = sanitizeText(coachName, 90) || "Your Coach";
  const safeNiche = sanitizeText(niche, 90) || "Wellness Coaching";
  const safeLocation = sanitizeText(location, 90) || "your community";
  const safeBio =
    sanitizeText(shortBio, 420) ||
    `A practical coach helping clients move with more clarity, confidence, and consistency.`;
  const nicheLower = safeNiche.toLowerCase();

  return {
    benefitDescriptions: [
      `A sharp introduction to ${safeName}'s point of view, coaching style, and client fit.`,
      `A calm explanation of how ${nicheLower} support works before someone registers.`,
      "A polished public page built for sharing, referrals, and confident first contact."
    ],
    benefits: ["Clear coach story", "Trust before registration", "Fast client action"],
    benefitsHeading: `Why clients connect with ${safeName}`,
    benefitsSectionLabel: "Benefits",
    brandBadge: "YW Nutritech premium coach profile",
    brandEyebrow: "Built for client-ready referrals",
    coachIntro: safeBio,
    coachIntroLabel: `Who ${safeName} is`,
    ctaText: "Ready to work with this coach?",
    ctaSectionLabel: "Next step",
    faq: [
      {
        question: "Who is this website for?",
        answer: `People looking for practical ${nicheLower} support from ${safeName}.`
      },
      {
        question: "Is this medical advice?",
        answer:
          "No. This website provides education and coaching information and is not a substitute for medical advice, diagnosis, or treatment."
      },
      {
        question: "How do I contact the coach?",
        answer: "Use the registration or contact button on this page to take the next step."
      }
    ],
    faqHeading: "Questions before connecting",
    faqSectionLabel: "FAQ",
    footerBrandLine: "YW Nutritech Premium Coach Website",
    footerHeadline: "Yours Wellness Center",
    footerText:
      "This page is for wellness education and coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual context and consistency.",
    heroHeadline: `${safeName}: premium ${nicheLower} support`,
    heroMediaLabel: "Coach",
    heroMicroTrustText: "Coach identity, clear method, trusted next step",
    heroTrustLine: "YW Nutritech care lens",
    introHeading: `${safeNiche} guidance for ${safeLocation}`,
    introSectionLabel: "Coach Introduction",
    journeyHeading: "A simple path from discovery to registration",
    journeySectionLabel: "Client journey",
    journeySteps: [
      {
        description: "Understand the coach's niche, story, and support style without guessing.",
        label: "Discover",
        title: "Meet the coach"
      },
      {
        description: "Review the practical benefits and decide whether this guidance fits your goal.",
        label: "Evaluate",
        title: "Check the fit"
      },
      {
        description: "Use the registration or contact link when you are ready for the next step.",
        label: "Connect",
        title: "Take the next step"
      }
    ],
    mediaBody: "A strong photo or video makes the page feel personal, credible, and ready to share.",
    mediaHeading: "Coach media spotlight",
    mediaModuleLabel: "Media",
    mediaSubheading: "Photo and video-ready profile",
    problemHeading: `For clients who need a clearer ${nicheLower} starting point.`,
    problemPoints: [
      "Too much scattered advice and not enough structure.",
      "Unclear next steps before booking or registering.",
      "A need for trust before starting a coaching relationship."
    ],
    problemSectionLabel: "Problem to solution",
    socialCopy: `Connect with ${safeName} for ${nicheLower} support.`,
    stickyCtaContactButton: "Contact Coach",
    stickyCtaContext: `${safeNiche} through YW Nutritech`,
    stickyCtaHeading: `Ready to connect with Coach ${safeName}?`,
    stickyCtaLabel: "Free guest registration",
    subheadline: `Meet the coach, understand the support style, and register for ${nicheLower} guidance in ${safeLocation}.`,
    supportEmailLabel: "Email",
    supportHeading: "Contact Support",
    supportPhoneLabel: "Phone",
    supportPrimaryButton: "Contact Support",
    supportPrivacyNote:
      "Contact details shown here are public coach-site support details, not admin-only data.",
    supportWhatsappButton: "Message coach",
    supportWhatsappLabel: "WhatsApp",
    trustText: "Built on education-first coaching, clear boundaries, and a simple registration step.",
    visionLabel: "Coach mission",
    visionText: `Help clients make ${nicheLower} feel clearer, calmer, and easier to act on.`
  };
}

export function normalizeShopBuilderState(input: ShopBuilderStateInput): ShopBuilderState {
  const coachName = sanitizeText(input.coachName, 120);
  const niche = sanitizeText(input.niche, 120);
  const location = sanitizeText(input.location, 120);
  const shortBio = sanitizeText(input.shortBio || input.bio, 700);
  const slug = normalizeShopSlugForCoach(input.slug, coachName);
  const content = normalizeShopContent(
    input.content || createShopContent({ coachName, location, niche, shortBio }),
    { coachName, location, niche, shortBio }
  );

  return {
    ...EMPTY_SHOP_BUILDER_STATE,
    ...input,
    bio: shortBio,
    coachEmail: sanitizeText(input.coachEmail || input.email, 180),
    coachName,
    coachPhone: sanitizeText(input.coachPhone, 60),
    contactLink: sanitizeUrl(input.contactLink),
    currentStep: clampStep(input.currentStep),
    email: sanitizeText(input.email || input.coachEmail, 180),
    heroMediaType: normalizeHeroMediaType(input.heroMediaType),
    location,
    logoUrl: sanitizeUrl(input.logoUrl),
    niche,
    orderId: sanitizeText(input.orderId, 120),
    photoUrl: sanitizeUrl(input.photoUrl),
    selectedThemeId: normalizeCoachTemplateThemeId(input.selectedThemeId),
    shortBio,
    slug,
    status: normalizeShopStatus(input.status),
    videoUrl: sanitizeUrl(input.videoUrl),
    whatsappLink: sanitizeUrl(input.whatsappLink),
    content
  };
}

export function buildCoachSiteFromShopState({
  createdAt,
  id,
  published,
  state
}: {
  createdAt?: string;
  id?: string;
  published?: boolean;
  state: ShopBuilderStateInput;
}): CoachSiteRecord {
  const normalized = normalizeShopBuilderState(state);
  const slug = normalized.slug || normalizeCoachSlug(normalized.coachName);
  const effectiveCreatedAt = createdAt || new Date().toISOString();
  const siteId = id || `shop-site-${slug}`;
  const site = createCoachSiteFromForm({
    form: {
      ...EMPTY_COACH_SITE_FORM,
      benefitsHeading: normalized.content.benefitsHeading,
      benefitsSectionLabel: normalized.content.benefitsSectionLabel,
      benefitDescriptionsText: normalized.content.benefitDescriptions.join("\n"),
      benefitsText: normalized.content.benefits.join("\n"),
      bio: normalized.shortBio,
      brandBadge: normalized.content.brandBadge,
      brandEyebrow: normalized.content.brandEyebrow,
      coachEmail: normalized.coachEmail || normalized.email,
      coachIntro: normalized.content.coachIntro,
      coachIntroLabel: normalized.content.coachIntroLabel,
      coachName: normalized.coachName,
      coachPhone: normalized.coachPhone,
      ctaSectionLabel: normalized.content.ctaSectionLabel,
      ctaText: normalized.content.ctaText,
      existingPaidFunnelUrl: "",
      faqHeading: normalized.content.faqHeading,
      faqSectionLabel: normalized.content.faqSectionLabel,
      faqText: normalized.content.faq
        .map((item) => `${item.question}\n${item.answer}`)
        .join("\n\n"),
      footerBrandLine: normalized.content.footerBrandLine,
      footerHeadline: normalized.content.footerHeadline,
      footerText: normalized.content.footerText,
      googleFormUrl: normalized.contactLink,
      heroMediaType: normalized.heroMediaType,
      heroHeadline: normalized.content.heroHeadline,
      heroMediaLabel: normalized.content.heroMediaLabel,
      heroMicroTrustText: normalized.content.heroMicroTrustText,
      heroTrustLine: normalized.content.heroTrustLine,
      introHeading: normalized.content.introHeading,
      introSectionLabel: normalized.content.introSectionLabel,
      journeyHeading: normalized.content.journeyHeading,
      journeySectionLabel: normalized.content.journeySectionLabel,
      journeyStepsText: normalized.content.journeySteps
        .map((step) => `${step.label} | ${step.title} | ${step.description}`)
        .join("\n"),
      location: normalized.location,
      logoUrl: normalized.logoUrl,
      mediaBody: normalized.content.mediaBody,
      mediaHeading: normalized.content.mediaHeading,
      mediaModuleLabel: normalized.content.mediaModuleLabel,
      mediaSubheading: normalized.content.mediaSubheading,
      niche: normalized.niche,
      paidFunnelContext: "source=shop_purchased",
      photoUrl: normalized.photoUrl,
      problemHeading: normalized.content.problemHeading,
      problemPointsText: normalized.content.problemPoints.join("\n"),
      problemSectionLabel: normalized.content.problemSectionLabel,
      registerButtonText: "Register Now",
      selectedThemeId: normalized.selectedThemeId,
      slug,
      socialCopy: normalized.content.socialCopy,
      subheadline: normalized.content.subheadline,
      supportText: "",
      trustText: normalized.content.trustText,
      videoUrl: normalized.videoUrl,
      vision: normalized.content.visionText,
      visionLabel: normalized.content.visionLabel,
      visionText: normalized.content.visionText,
      whatsappLink: normalized.whatsappLink
    },
    id: siteId,
    status: (published ? "published" : "draft") as CoachSiteStatus
  });

  return {
    ...site,
    analytics: {
      ...site.analytics,
      source: "shop_purchased"
    },
    id: siteId,
    coachId: `shop-${slug}`,
    content: normalized.content,
    createdAt: effectiveCreatedAt,
    publicUrl: getCoachPublicUrl(slug),
    publishedAt: published ? effectiveCreatedAt : undefined,
    status: (published ? "published" : "draft") as CoachSiteStatus,
    updatedAt: effectiveCreatedAt
  };
}

export function validateShopBuilderState(
  state: Partial<ShopBuilderState>,
  options: { requirePaymentReady?: boolean } = {}
): ShopValidationIssue[] {
  const normalized = normalizeShopBuilderState(state);
  const issues: ShopValidationIssue[] = [];

  if (!normalized.coachName) {
    issues.push({ field: "coachName", message: "Coach name is required.", severity: "error" });
  }
  if (!normalized.niche) {
    issues.push({ field: "niche", message: "Niche is required.", severity: "error" });
  }
  if (!normalized.shortBio) {
    issues.push({ field: "shortBio", message: "Short bio is required.", severity: "error" });
  }
  if (!normalized.slug) {
    issues.push({ field: "slug", message: "A public URL slug is required.", severity: "error" });
  }
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    issues.push({ field: "email", message: "Enter a valid email address.", severity: "error" });
  }
  if (
    options.requirePaymentReady &&
    !hasUsableShopPaymentContact(normalized.email || normalized.coachEmail, normalized.coachPhone)
  ) {
    issues.push({
      field: "email",
      message: "Add a valid email or phone/WhatsApp number before checkout.",
      severity: "error"
    });
  }
  if (normalized.contactLink && !isSafePublicUrl(normalized.contactLink)) {
    issues.push({ field: "contactLink", message: "Enter a valid HTTPS contact or registration link.", severity: "error" });
  }
  if (!normalized.content.heroHeadline.trim()) {
    issues.push({ field: "content", message: "Hero headline cannot be empty.", severity: "error" });
  }
  if (!normalized.content.ctaText.trim()) {
    issues.push({ field: "content", message: "CTA text cannot be empty.", severity: "error" });
  }
  if (!normalized.content.footerText.trim()) {
    issues.push({ field: "content", message: "Legal footer/disclaimer cannot be removed.", severity: "error" });
  }
  if (options.requirePaymentReady && !normalized.contactLink) {
    issues.push({
      field: "contactLink",
      message: "Add a registration or contact link before checkout.",
      severity: "error"
    });
  }

  return issues;
}

function hasUsableShopPaymentContact(email: string, phone: string) {
  const cleanEmail = email.trim().toLowerCase();
  const phoneDigits = phone.replace(/\D/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || phoneDigits.length >= 7;
}

function normalizeShopSlugForCoach(inputSlug: unknown, coachName: string) {
  const coachSlug = normalizeCoachSlug(coachName);
  const savedSlug = normalizeCoachSlug(String(inputSlug || ""));

  if (!coachSlug) return savedSlug;
  if (!savedSlug) return coachSlug;
  if (savedSlug === coachSlug || savedSlug.startsWith(`${coachSlug}-`)) return savedSlug;

  return coachSlug;
}

function normalizeShopContent(
  input: Partial<CoachSiteContent>,
  fallbackContext: { coachName: string; location: string; niche: string; shortBio: string }
): CoachSiteContent {
  const fallback = createShopContent(fallbackContext);
  return {
    ...fallback,
    ...input,
    benefitDescriptions: normalizeStringArray(input.benefitDescriptions, fallback.benefitDescriptions),
    benefits: normalizeStringArray(input.benefits, fallback.benefits),
    faq: Array.isArray(input.faq) && input.faq.length > 0 ? input.faq : fallback.faq,
    journeySteps:
      Array.isArray(input.journeySteps) && input.journeySteps.length > 0
        ? input.journeySteps
        : fallback.journeySteps
  };
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? value.map((item) => sanitizeText(item, 220)).filter(Boolean)
    : fallback;
}

function normalizeShopStatus(value: unknown): ShopBuilderStatus {
  if (
    value === "draft" ||
    value === "paid" ||
    value === "payment_failed" ||
    value === "pending_payment" ||
    value === "publish_failed" ||
    value === "published" ||
    value === "publishing"
  ) {
    return value;
  }

  return "draft";
}

function clampStep(value: unknown) {
  const step = typeof value === "number" ? value : Number(value || 1);
  if (!Number.isFinite(step)) return 1;
  return Math.max(1, Math.min(SHOP_BUILDER_STEPS.length, Math.round(step)));
}

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isSafeInternalCoachMediaUrl(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeHeroMediaType(value: unknown): CoachHeroMediaType {
  return value === "video" || value === "none" ? value : "image";
}

function isSafeInternalCoachMediaUrl(value: string) {
  return (
    /^\/api\/coach-media\?key=coach-sites%2F[a-z0-9-]+%2F(image|video)%2F[a-z0-9.-]+$/i.test(
      value
    ) ||
    /^\/api\/coach-media\?key=coach-sites\/[a-z0-9-]+\/(image|video)\/[a-z0-9.-]+$/i.test(
      value
    )
  );
}

function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hostname.includes("localhost");
  } catch {
    return false;
  }
}
