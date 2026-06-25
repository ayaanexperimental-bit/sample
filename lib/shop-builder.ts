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
  const fallback = getShopNicheFallbackCopy(safeNiche, safeLocation);

  return {
    benefitDescriptions: [
      `A clear introduction to ${safeName}'s method, boundaries, and who the page is best for.`,
      fallback.benefitDescription,
      "A simple registration path that helps guests decide without pressure or confusing claims."
    ],
    benefits: ["Clear coach story", "Trust before registration", "Fast client action"],
    benefitsHeading: `Why clients connect with ${safeName}`,
    benefitsSectionLabel: "Benefits",
    brandBadge: "Education-first wellness page",
    brandEyebrow: "Coach-led practical guidance",
    coachIntro: safeBio,
    coachIntroLabel: `Who ${safeName} is`,
    ctaText: "Register Now",
    ctaSectionLabel: "Next step",
    faq: [
      {
        question: "Who is this website for?",
        answer: fallback.faqAudience(safeName)
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
    faqHeading: "Common Questions Before You Register",
    faqSectionLabel: "FAQ",
    footerBrandLine: "YW Nutritech Coach Circle",
    footerHeadline: "Yours Wellness Center",
    footerText:
      "This page is for wellness education and coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual context and consistency.",
    heroHeadline: fallback.heroHeadline(safeName),
    heroMediaLabel: "Coach",
    heroMicroTrustText: "Coach identity, clear method, trusted next step",
    heroTrustLine: "Education-first wellness guidance",
    introHeading: fallback.introHeading(safeName),
    introSectionLabel: "Coach Introduction",
    journeyHeading: "A simple path from discovery to registration",
    journeySectionLabel: "Client journey",
    journeySteps: [
      {
        description: "Understand the coach's niche, story, and guidance approach without guessing.",
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
    mediaHeading: "Coach media",
    mediaModuleLabel: "Media",
    mediaSubheading: "Photo and video-ready area",
    problemHeading: fallback.problemHeading,
    problemPoints: [
      "Too much scattered advice and not enough structure.",
      "Unclear next steps before booking or registering.",
      "A need for trust before starting a coaching relationship."
    ],
    problemSectionLabel: "Problem to solution",
    socialCopy: fallback.socialCopy(safeName),
    stickyCtaContactButton: "Register Now",
    stickyCtaContext: fallback.stickyContext,
    stickyCtaHeading: `Ready to connect with Coach ${safeName}?`,
    stickyCtaLabel: "Registration",
    subheadline: fallback.subheadline,
    supportEmailLabel: "Email",
    supportHeading: "Coach Contact",
    supportPhoneLabel: "Phone",
    supportPrimaryButton: "Register Now",
    supportPrivacyNote:
      "Contact details shown here are public coach-site support details, not admin-only data.",
    supportWhatsappButton: "Message coach",
    supportWhatsappLabel: "WhatsApp",
    trustText: "Built on education-first coaching, clear boundaries, and a simple registration step.",
    visionLabel: "Coach mission",
    visionText: fallback.visionText
  };
}

function getShopNicheFallbackCopy(niche: string, location: string) {
  const normalized = niche.toLowerCase();
  const place = location || "your community";

  if (/\b(pcos|pcod|pmos|hormone|hormonal|women'?s?\s+wellness|women wellness)\b/.test(normalized)) {
    return {
      benefitDescription: "A calm explanation of lifestyle guidance for everyday routines, cycle awareness, stress, sleep, movement, and consistency.",
      faqAudience: (name: string) =>
        `This page is for people who want education-first lifestyle guidance from ${name} while keeping medical care and personal health decisions with qualified professionals.`,
      heroHeadline: (name: string) => `Personal wellness guidance with ${name}`,
      introHeading: (name: string) => `${name}'s practical wellness approach in ${place}`,
      problemHeading: "For guests who want a calmer first step before choosing support.",
      socialCopy: (name: string) => `Connect with ${name} for education-first wellness guidance.`,
      stickyContext: "Education-first wellness support through YW Nutritech",
      subheadline:
        "Understand the coach's approach, see how the guidance works, and register when the fit feels clear.",
      visionText:
        "Help guests turn confusing lifestyle advice into a practical routine they can discuss, adapt, and follow consistently."
    };
  }

  if (/\b(diabetes|diabetic|blood sugar|glucose|insulin|metabolic)\b/.test(normalized)) {
    return {
      benefitDescription: "A practical overview of food rhythm, tracking, movement, recovery, and consistency habits for metabolic wellness education.",
      faqAudience: (name: string) =>
        `This page is for people who want structured education from ${name} to support daily wellness habits alongside their qualified healthcare providers.`,
      heroHeadline: (name: string) => `Metabolic wellness guidance with ${name}`,
      introHeading: (name: string) => `${name}'s practical metabolic wellness approach in ${place}`,
      problemHeading: "For guests who want structure before committing to support.",
      socialCopy: (name: string) => `Connect with ${name} for structured metabolic wellness education.`,
      stickyContext: "Structured wellness education through YW Nutritech",
      subheadline:
        "Meet the coach, understand the method, and register for education-first support without medical promises.",
      visionText:
        "Help guests build clearer routines around daily choices, tracking, movement, recovery, and consistency."
    };
  }

  if (/\b(gut|digestion|digestive)\b/.test(normalized)) {
    return {
      benefitDescription: "A grounded view of food rhythm, digestion patterns, stress, routine tracking, and sustainable daily changes.",
      faqAudience: (name: string) =>
        `This page is for people who want practical gut-wellness education from ${name} without replacing diagnosis or treatment from a clinician.`,
      heroHeadline: (name: string) => `Gut wellness guidance with ${name}`,
      introHeading: (name: string) => `${name}'s practical gut-wellness approach in ${place}`,
      problemHeading: "For guests who need a clearer way to understand their daily patterns.",
      socialCopy: (name: string) => `Connect with ${name} for practical gut-wellness education.`,
      stickyContext: "Gut-wellness education through YW Nutritech",
      subheadline:
        "See the coach's method, understand the support boundaries, and register when you are ready.",
      visionText:
        "Help guests notice daily patterns, simplify routines, and build consistency around food, stress, and recovery."
    };
  }

  if (/\b(sleep|recovery|rest)\b/.test(normalized)) {
    return {
      benefitDescription: "A simple look at sleep routines, evening habits, recovery rhythm, stress awareness, and consistency.",
      faqAudience: (name: string) =>
        `This page is for people who want practical sleep and recovery education from ${name} with clear coaching boundaries.`,
      heroHeadline: (name: string) => `Sleep and recovery guidance with ${name}`,
      introHeading: (name: string) => `${name}'s practical recovery approach in ${place}`,
      problemHeading: "For guests who want steadier routines before choosing support.",
      socialCopy: (name: string) => `Connect with ${name} for sleep and recovery education.`,
      stickyContext: "Sleep and recovery education through YW Nutritech",
      subheadline:
        "Understand the coach's approach to routine, recovery, and consistency before you register.",
      visionText:
        "Help guests make rest, recovery, and daily rhythm easier to understand and act on."
    };
  }

  if (/\b(fat\s*-?\s*loss|weight\s*-?\s*loss|fitness|strength|workout|movement)\b/.test(normalized)) {
    return {
      benefitDescription: "A practical path for movement, meal structure, recovery, tracking, and habit consistency without extreme promises.",
      faqAudience: (name: string) =>
        `This page is for people who want practical fitness or body-composition education from ${name} without unsafe shortcuts.`,
      heroHeadline: (name: string) => `Practical habit coaching with ${name}`,
      introHeading: (name: string) => `${name}'s practical habit approach in ${place}`,
      problemHeading: "For guests who want a realistic plan before taking the next step.",
      socialCopy: (name: string) => `Connect with ${name} for practical habit-based coaching.`,
      stickyContext: "Habit-based wellness support through YW Nutritech",
      subheadline:
        "Meet the coach, understand the habit framework, and register when the next step feels clear.",
      visionText:
        "Help guests turn scattered effort into steadier habits around movement, food rhythm, recovery, and follow-through."
    };
  }

  return {
    benefitDescription: "A calm explanation of how the coach structures education, support boundaries, and daily follow-through.",
    faqAudience: (name: string) =>
      `This page is for people who want practical education-first wellness guidance from ${name} before taking the next step.`,
    heroHeadline: (name: string) => `Practical wellness guidance with ${name}`,
    introHeading: (name: string) => `${name}'s practical wellness approach in ${place}`,
    problemHeading: "For guests who need a clearer first step before committing.",
    socialCopy: (name: string) => `Connect with ${name} for practical wellness guidance.`,
    stickyContext: "Education-first wellness support through YW Nutritech",
    subheadline:
      "Meet the coach, understand the method, and register when the next step feels clear.",
    visionText:
      "Help guests turn broad wellness intentions into clearer routines, better questions, and steadier follow-through."
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
    contactLink: sanitizeText(input.contactLink, 500),
    currentStep: clampStep(input.currentStep),
    email: sanitizeText(input.email || input.coachEmail, 180),
    heroMediaType: normalizeHeroMediaType(input.heroMediaType),
    location,
    logoUrl: sanitizeText(input.logoUrl, 500),
    niche,
    orderId: sanitizeText(input.orderId, 120),
    photoUrl: sanitizeText(input.photoUrl, 1200),
    selectedThemeId: normalizeCoachTemplateThemeId(input.selectedThemeId),
    shortBio,
    slug,
    status: normalizeShopStatus(input.status),
    videoUrl: sanitizeText(input.videoUrl, 1200),
    whatsappLink: sanitizeText(input.whatsappLink, 500),
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
  const safeContactLink = sanitizeUrl(normalized.contactLink);
  const safeLogoUrl = sanitizeUrl(normalized.logoUrl);
  const safePhotoUrl = sanitizeUrl(normalized.photoUrl);
  const safeVideoUrl = sanitizeUrl(normalized.videoUrl);
  const safeWhatsappLink = sanitizeUrl(normalized.whatsappLink);
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
      googleFormUrl: safeContactLink,
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
      logoUrl: safeLogoUrl,
      mediaBody: normalized.content.mediaBody,
      mediaHeading: normalized.content.mediaHeading,
      mediaModuleLabel: normalized.content.mediaModuleLabel,
      mediaSubheading: normalized.content.mediaSubheading,
      niche: normalized.niche,
      paidFunnelContext: "source=shop_purchased",
      photoUrl: safePhotoUrl,
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
      videoUrl: safeVideoUrl,
      vision: normalized.content.visionText,
      visionLabel: normalized.content.visionLabel,
      visionText: normalized.content.visionText,
      whatsappLink: safeWhatsappLink
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

  if (!normalized.coachName.trim()) {
    issues.push({ field: "coachName", message: "Coach name is required.", severity: "error" });
  }
  if (!normalized.niche.trim()) {
    issues.push({ field: "niche", message: "Niche is required.", severity: "error" });
  }
  if (!normalized.shortBio.trim()) {
    issues.push({ field: "shortBio", message: "Short bio is required.", severity: "error" });
  }
  if (!normalized.slug) {
    issues.push({ field: "slug", message: "A public URL slug is required.", severity: "error" });
  }
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    issues.push({ field: "email", message: "Enter a valid email address.", severity: "error" });
  }
  if (normalized.coachPhone && !isValidIndianPhoneNumber(normalized.coachPhone)) {
    issues.push({
      field: "coachPhone",
      message: "Enter one valid 10-digit Indian phone/WhatsApp number.",
      severity: "error"
    });
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
  if (normalized.contactLink && !isSingleSafePublicUrl(normalized.contactLink)) {
    issues.push({
      field: "contactLink",
      message: "Enter one valid HTTPS registration/contact link only.",
      severity: "error"
    });
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || isValidIndianPhoneNumber(phone);
}

function isValidIndianPhoneNumber(value: string) {
  const digits = normalizeIndianPhoneDigits(value);
  return /^[6-9]\d{9}$/.test(digits);
}

function normalizeIndianPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
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
  try {
    const url = new URL(value, "https://ywcoach.local");
    if (url.origin !== "https://ywcoach.local") return false;
    if (url.pathname !== "/api/coach-media") return false;

    const objectKey = url.searchParams.get("key") || "";
    if (objectKey.length > 900 || objectKey.includes("..")) return false;
    return /^coach-sites\/[a-z0-9-]+\/(image|video)(\/(original|cutout))?\/[0-9]{14}-[a-f0-9-]+\.[a-z0-9]+$/i.test(
      objectKey
    );
  } catch {
    return false;
  }
}

function isSafePublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.hostname.includes("localhost");
  } catch {
    return false;
  }
}

function isSingleSafePublicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  return isSafePublicUrl(trimmed);
}
