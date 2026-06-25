import {
  DEFAULT_COACH_TEMPLATE_THEME_ID,
  type CoachTemplateThemeId,
  normalizeCoachTemplateThemeId
} from "./coach-template-themes";

export type CoachSiteStatus = "archived" | "draft" | "paused" | "published" | "removed";
export type CoachHeroMediaType = "image" | "none" | "video";

export type CoachSiteContent = {
  benefitDescriptions: string[];
  benefits: string[];
  benefitsHeading: string;
  brandBadge: string;
  brandEyebrow: string;
  coachIntro: string;
  coachIntroLabel: string;
  ctaText: string;
  ctaSectionLabel: string;
  faqHeading: string;
  faqSectionLabel: string;
  faq: Array<{
    answer: string;
    question: string;
  }>;
  footerBrandLine: string;
  footerHeadline: string;
  footerText: string;
  heroMediaLabel: string;
  heroMicroTrustText: string;
  heroHeadline: string;
  heroTrustLine: string;
  introHeading: string;
  introSectionLabel: string;
  journeyHeading: string;
  journeySectionLabel: string;
  journeySteps: Array<{
    description: string;
    label: string;
    title: string;
  }>;
  mediaBody: string;
  mediaHeading: string;
  mediaModuleLabel: string;
  mediaSubheading: string;
  problemHeading: string;
  problemSectionLabel: string;
  problemPoints: string[];
  benefitsSectionLabel: string;
  socialCopy: string;
  stickyCtaContactButton?: string;
  stickyCtaContext?: string;
  stickyCtaHeading?: string;
  stickyCtaLabel?: string;
  subheadline: string;
  supportEmailLabel?: string;
  supportHeading?: string;
  supportPhoneLabel?: string;
  supportPrimaryButton?: string;
  supportPrivacyNote?: string;
  supportWhatsappButton?: string;
  supportWhatsappLabel?: string;
  trustText: string;
  visionLabel: string;
  visionText: string;
};

export type CoachSiteAnalyticsSummary = {
  averageVisits: number;
  conversionRate: string;
  dailyVisits: number;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  lastUpdated: string;
  monthlyVisits: number;
  region: string;
  source: string;
  totalRegisterClicks: number;
  totalVisits: number;
  totalWhatsappClicks: number;
  videoPlays: number;
  weeklyVisits: number;
};

export type CoachSiteRecord = {
  bio: string;
  coachEmail: string;
  coachId: string;
  coachName: string;
  coachPhone: string;
  content: CoachSiteContent;
  archivedAt?: string;
  createdAt?: string;
  existingPaidFunnelUrl: string;
  googleFormUrl: string;
  heroMediaType: CoachHeroMediaType;
  id: string;
  location: string;
  logoUrl: string;
  niche: string;
  photoUrl: string;
  publishedAt?: string;
  publicUrl: string;
  registerButtonText: string;
  selectedThemeId: CoachTemplateThemeId;
  slug: string;
  status: CoachSiteStatus;
  paidFunnelContext: string;
  supportText: string;
  updatedAt?: string;
  videoUrl: string;
  vision: string;
  whatsappLink: string;
  analytics: CoachSiteAnalyticsSummary;
};

export type PublicCoachSiteRecord = Omit<
  CoachSiteRecord,
  | "analytics"
  | "archivedAt"
  | "coachId"
  | "createdAt"
  | "existingPaidFunnelUrl"
  | "id"
  | "paidFunnelContext"
  | "publishedAt"
  | "updatedAt"
>;

export type CoachSiteFormState = {
  benefitDescriptionsText: string;
  benefitsText: string;
  benefitsHeading: string;
  bio: string;
  brandBadge: string;
  brandEyebrow: string;
  coachEmail: string;
  coachName: string;
  coachPhone: string;
  coachIntro: string;
  coachIntroLabel: string;
  ctaText: string;
  ctaSectionLabel: string;
  existingPaidFunnelUrl: string;
  faqHeading: string;
  faqSectionLabel: string;
  faqText: string;
  footerBrandLine: string;
  footerHeadline: string;
  footerText: string;
  googleFormUrl: string;
  heroMediaType: CoachHeroMediaType;
  heroHeadline: string;
  heroMediaLabel: string;
  heroMicroTrustText: string;
  heroTrustLine: string;
  introHeading: string;
  introSectionLabel: string;
  journeyHeading: string;
  journeySectionLabel: string;
  journeyStepsText: string;
  location: string;
  logoUrl: string;
  mediaBody: string;
  mediaHeading: string;
  mediaModuleLabel: string;
  mediaSubheading: string;
  niche: string;
  paidFunnelContext: string;
  photoUrl: string;
  problemHeading: string;
  problemSectionLabel: string;
  problemPointsText: string;
  registerButtonText: string;
  selectedThemeId: CoachTemplateThemeId;
  slug: string;
  benefitsSectionLabel: string;
  socialCopy: string;
  stickyCtaContactButton: string;
  stickyCtaContext: string;
  stickyCtaHeading: string;
  stickyCtaLabel: string;
  subheadline: string;
  supportEmailLabel: string;
  supportHeading: string;
  supportPhoneLabel: string;
  supportPrimaryButton: string;
  supportPrivacyNote: string;
  supportWhatsappButton: string;
  supportWhatsappLabel: string;
  supportText: string;
  trustText: string;
  visionLabel: string;
  videoUrl: string;
  vision: string;
  visionText: string;
  whatsappLink: string;
};

export const EMPTY_COACH_SITE_FORM: CoachSiteFormState = {
  benefitDescriptionsText: "",
  benefitsText: "",
  benefitsHeading: "",
  bio: "",
  brandBadge: "",
  brandEyebrow: "",
  coachEmail: "",
  coachName: "",
  coachPhone: "",
  coachIntro: "",
  coachIntroLabel: "",
  ctaText: "Register Now",
  ctaSectionLabel: "",
  existingPaidFunnelUrl: "",
  faqHeading: "",
  faqSectionLabel: "",
  faqText: "",
  footerBrandLine: "",
  footerHeadline: "",
  footerText: "",
  googleFormUrl: "",
  heroMediaType: "image",
  heroHeadline: "",
  heroMediaLabel: "",
  heroMicroTrustText: "",
  heroTrustLine: "",
  introHeading: "",
  introSectionLabel: "",
  journeyHeading: "",
  journeySectionLabel: "",
  journeyStepsText: "",
  location: "",
  logoUrl: "",
  mediaBody: "",
  mediaHeading: "",
  mediaModuleLabel: "",
  mediaSubheading: "",
  niche: "",
  paidFunnelContext: "",
  photoUrl: "",
  problemHeading: "",
  problemSectionLabel: "",
  problemPointsText: "",
  registerButtonText: "Register Now",
  selectedThemeId: DEFAULT_COACH_TEMPLATE_THEME_ID,
  slug: "",
  benefitsSectionLabel: "",
  socialCopy: "",
  stickyCtaContactButton: "",
  stickyCtaContext: "",
  stickyCtaHeading: "",
  stickyCtaLabel: "",
  subheadline: "",
  supportEmailLabel: "",
  supportHeading: "",
  supportPhoneLabel: "",
  supportPrimaryButton: "",
  supportPrivacyNote: "",
  supportWhatsappButton: "",
  supportWhatsappLabel: "",
  supportText: "",
  trustText: "",
  visionLabel: "",
  videoUrl: "",
  vision: "",
  visionText: "",
  whatsappLink: ""
};

export const COACH_PUBLIC_ROUTE_PREFIX = "/coach";

export const approvedCoachSites: CoachSiteRecord[] = [
  {
    id: "coach-site-gyana-ranjan",
    coachId: "coach-gyana",
    coachName: "Gyana Ranjan",
    niche: "PMOS / Women Wellness",
    location: "Odisha",
    bio: "Practical wellness coach helping women understand hormones and daily lifestyle routines.",
    vision:
      "Make hormone education calmer, practical, and easier to follow alongside medical guidance.",
    coachEmail: "",
    coachPhone: "",
    existingPaidFunnelUrl: "",
    whatsappLink: "",
    photoUrl: "/images/coach-gyana-ranjan.png",
    logoUrl: "",
    videoUrl:
      "https://www.youtube.com/embed/gBQoms47fB8?playsinline=1&controls=1&rel=0&modestbranding=1",
    googleFormUrl: "https://forms.gle/nsY5F1mcjZnZBbVo9",
    heroMediaType: "image",
    slug: "gyana-ranjan",
    publicUrl: "/coach/gyana-ranjan",
    status: "published",
    paidFunnelContext: "",
    supportText: "",
    registerButtonText: "Register Now",
    selectedThemeId: DEFAULT_COACH_TEMPLATE_THEME_ID,
    content: {
      benefitDescriptions: [
        "Coach-led education designed to make lifestyle patterns easier to notice.",
        "A calmer first step before a deeper program or medical conversation.",
        "A simple next action before joining a more detailed pathway."
      ],
      heroHeadline: "Meet Gyana Ranjan for practical PMOS lifestyle guidance.",
      brandBadge: "Education-first wellness page",
      brandEyebrow: "Education-first wellness pathway",
      benefitsHeading: "PMOS lifestyle guidance without clutter.",
      subheadline:
        "A fixed-template coach referral page introducing the coach, niche, vision, and next registration step.",
      coachIntro:
        "Gyana helps women slow down confusing hormone advice and rebuild simple routines around food, movement, sleep, stress, and tracking.",
      coachIntroLabel: "Who Gyana is",
      faqHeading: "Clear answers before registration.",
      faqSectionLabel: "FAQ",
      footerBrandLine: "YW Nutritech Coach Referral",
      footerHeadline: "Yours Wellness Center",
      footerText:
        "This page is for wellness education and lifestyle coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual health history, lifestyle, and consistency.",
      heroMediaLabel: "Coach",
      heroMicroTrustText: "Nutrition, habits, lifestyle, education",
      heroTrustLine: "Education-first wellness guidance",
      introHeading: "Personal PMOS guidance inside a premium wellness-tech ecosystem.",
      introSectionLabel: "Coach Introduction",
      journeyHeading: "One page that moves from trust to action.",
      journeySectionLabel: "YW Nutritech guidance path",
      journeySteps: [
        {
          label: "Profile",
          title: "Meet Gyana",
          description: "Guests understand the coach story, niche, mission, and guidance style."
        },
        {
          label: "Focus",
          title: "See the PMOS wellness focus",
          description: "The page explains the coach approach in a clear, trustworthy tone."
        },
        {
          label: "Action",
          title: "Open registration",
          description: "The CTA sends visitors to the coach registration form when configured."
        }
      ],
      mediaBody:
        "Gyana's image and video-ready area stay inside the fixed YW Nutritech template while keeping the coach visible.",
      mediaHeading: "Coach image and video-ready area",
      mediaModuleLabel: "Coach media module",
      mediaSubheading: "YW Nutritech coach media",
      problemHeading: "For women who need direction before committing to a bigger program.",
      problemSectionLabel: "Problem to solution",
      problemPoints: [
        "Too much conflicting PMOS or hormone advice",
        "Unsure what daily routine changes matter first",
        "Need a coach-led starting point before a deeper program",
        "Want education-friendly guidance that can sit alongside medical care"
      ],
      visionText:
        "Support women with education-first guidance that fits real life and works alongside medical advice when needed.",
      benefits: [
        "Understand common lifestyle patterns connected to PMOS symptoms.",
        "Get a calmer view of food, movement, sleep, and routine consistency.",
        "Know the right next step before joining a deeper program."
      ],
      benefitsSectionLabel: "Benefits",
      ctaText: "Register Now",
      ctaSectionLabel: "Register",
      faq: [
        {
          question: "Is this medical treatment?",
          answer: "No. This coach page is for education and lifestyle guidance only."
        },
        {
          question: "What happens after registration?",
          answer: "The register button opens the admin-provided Google Form when configured."
        }
      ],
      trustText:
        "Education-first, doctor-friendly coaching support. This does not replace diagnosis or treatment.",
      visionLabel: "Coach mission",
      supportEmailLabel: "Email",
      supportHeading: "Contact Support",
      supportPhoneLabel: "Phone",
      supportPrimaryButton: "Contact Support",
      supportPrivacyNote:
        "Contact details shown here are public coach-site support details, not admin-only data.",
      supportWhatsappButton: "Message coach",
      supportWhatsappLabel: "WhatsApp",
      stickyCtaContactButton: "Register Now",
      stickyCtaContext: "PMOS / Women Wellness through YW Nutritech",
      stickyCtaHeading: "Ready to connect with Coach Gyana Ranjan?",
      stickyCtaLabel: "Registration",
      socialCopy: "Join Gyana Ranjan's PMOS lifestyle guidance page for a clear first step."
    },
    analytics: {
      averageVisits: 0,
      conversionRate: "0%",
      dailyVisits: 0,
      deviceBreakdown: {
        desktop: 0,
        mobile: 0,
        tablet: 0
      },
      lastUpdated: "Not connected",
      monthlyVisits: 0,
      region: "Not available",
      source: "Not available",
      totalRegisterClicks: 0,
      totalVisits: 0,
      totalWhatsappClicks: 0,
      videoPlays: 0,
      weeklyVisits: 0
    }
  }
];

export function getCoachPublicUrl(slug: string) {
  return `${COACH_PUBLIC_ROUTE_PREFIX}/${normalizeCoachSlug(slug)}`;
}

export function getPublicCoachSiteBySlug(slug: string) {
  const normalizedSlug = normalizeCoachSlug(slug);
  const site =
    approvedCoachSites.find(
      (record) =>
        record.slug === normalizedSlug &&
        (record.status === "published" || record.status === "paused")
    ) || null;

  return site ? toPublicCoachSiteRecord(site) : null;
}

export function toPublicCoachSiteRecord(site: CoachSiteRecord): PublicCoachSiteRecord {
  return {
    bio: site.bio,
    coachEmail: site.coachEmail,
    coachName: site.coachName,
    coachPhone: site.coachPhone,
    content: site.content,
    googleFormUrl: site.googleFormUrl,
    heroMediaType: site.heroMediaType,
    location: site.location,
    logoUrl: site.logoUrl,
    niche: site.niche,
    photoUrl: site.photoUrl,
    publicUrl: site.publicUrl,
    registerButtonText: site.registerButtonText,
    selectedThemeId: normalizeCoachTemplateThemeId(site.selectedThemeId),
    slug: site.slug,
    status: site.status,
    supportText: site.supportText,
    videoUrl: site.videoUrl,
    vision: site.vision,
    whatsappLink: site.whatsappLink
  };
}

export function normalizeCoachSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function createCoachContentFromForm(form: CoachSiteFormState): CoachSiteContent {
  const coachName = form.coachName.trim() || "Coach";
  const niche = form.niche.trim() || "wellness";
  const vision = form.vision.trim() || "support guests with practical wellness guidance";
  const bio = form.bio.trim() || "A Yours Wellness coach focused on simple, supportive guidance.";
  const benefits = parseLines(form.benefitsText, [
    `Understand the basics of ${niche} with a clear coach introduction.`,
    "See the coach vision before opening the registration form.",
    "Move to the admin-provided Google Form only after the register click is tracked."
  ]);

  return {
    benefitDescriptions: parseLines(
      form.benefitDescriptionsText,
      benefits.map(() => "Coach-led education designed to make the next step calmer and clearer.")
    ),
    benefits,
    benefitsHeading:
      form.benefitsHeading.trim() || `Practical ${niche} support without clutter.`,
    brandBadge: form.brandBadge.trim() || "Education-first wellness page",
    brandEyebrow: form.brandEyebrow.trim() || "Education-first wellness pathway",
    coachIntroLabel: form.coachIntroLabel.trim() || `Who ${coachName} is`,
    heroHeadline: form.heroHeadline.trim() || `Meet ${coachName} for practical ${niche} guidance.`,
    subheadline:
      form.subheadline.trim() ||
      `A fixed-template coach referral page introducing ${coachName}, their niche, vision, and registration step.`,
    coachIntro: form.coachIntro.trim() || bio,
    ctaSectionLabel: form.ctaSectionLabel.trim() || "Register",
    ctaText: form.ctaText.trim() || form.registerButtonText.trim() || "Register Now",
    faq: parseFaq(form.faqText),
    faqHeading: form.faqHeading.trim() || "Common Questions Before You Register",
    faqSectionLabel: form.faqSectionLabel.trim() || "FAQ",
    footerBrandLine: form.footerBrandLine.trim() || "YW Nutritech Coach Referral",
    footerHeadline: form.footerHeadline.trim() || `${coachName} | Yours Wellness Center`,
    footerText:
      form.footerText.trim() ||
      "This page is for wellness education and lifestyle coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual health history, lifestyle, and consistency.",
    heroMediaLabel: form.heroMediaLabel.trim() || "Coach",
    heroMicroTrustText:
      form.heroMicroTrustText.trim() || "Nutrition, habits, lifestyle, education",
    heroTrustLine: form.heroTrustLine.trim() || "Education-first wellness guidance",
    introHeading:
      form.introHeading.trim() ||
      `Personal ${niche} guidance inside a premium wellness-tech ecosystem.`,
    introSectionLabel: form.introSectionLabel.trim() || "Coach Introduction",
    journeyHeading:
      form.journeyHeading.trim() || "One page that moves from trust to action.",
    journeySectionLabel: form.journeySectionLabel.trim() || "YW Nutritech guidance path",
    journeySteps: parseJourneySteps(form.journeyStepsText, coachName, niche),
    mediaBody:
      form.mediaBody.trim() ||
      `${coachName}'s media stays inside the fixed YW Nutritech template while keeping the coach visible.`,
    mediaHeading: form.mediaHeading.trim() || "Coach image and video-ready area",
    mediaModuleLabel: form.mediaModuleLabel.trim() || "Coach media module",
    mediaSubheading:
      form.mediaSubheading.trim() || "YW Nutritech coach media",
    problemHeading:
      form.problemHeading.trim() ||
      `For guests who need direction before committing to a bigger ${niche} program.`,
    problemSectionLabel: form.problemSectionLabel.trim() || "Problem to solution",
    problemPoints: parseLines(form.problemPointsText, [
      `Too much conflicting ${niche} advice`,
      "Unsure what daily routine changes matter first",
      "Need a coach-led starting point before a deeper program",
      "Want education-friendly guidance that can sit alongside medical care"
    ]),
    benefitsSectionLabel: form.benefitsSectionLabel.trim() || "Benefits",
    visionText: form.visionText.trim() || vision,
    trustText:
      form.trustText.trim() ||
      "This page is for coach introduction and education. It does not replace medical advice.",
    visionLabel: form.visionLabel.trim() || "Coach mission",
    socialCopy:
      form.socialCopy.trim() || `Join ${coachName}'s ${niche} referral page for a clear first step.`,
    stickyCtaContactButton: form.stickyCtaContactButton.trim() || "Register Now",
    stickyCtaContext:
      form.stickyCtaContext.trim() || `${niche || "Coach referral"} through YW Nutritech`,
    stickyCtaHeading:
      form.stickyCtaHeading.trim() || `Ready to connect with Coach ${coachName}?`,
    stickyCtaLabel: form.stickyCtaLabel.trim() || "Registration",
    supportEmailLabel: form.supportEmailLabel.trim() || "Email",
    supportHeading: form.supportHeading.trim() || "Contact Support",
    supportPhoneLabel: form.supportPhoneLabel.trim() || "Phone",
    supportPrimaryButton: form.supportPrimaryButton.trim() || "Contact Support",
    supportPrivacyNote:
      form.supportPrivacyNote.trim() ||
      "Contact details shown here are public coach-site support details, not admin-only data.",
    supportWhatsappButton: form.supportWhatsappButton.trim() || "Message coach",
    supportWhatsappLabel: form.supportWhatsappLabel.trim() || "WhatsApp"
  };
}

function parseJourneySteps(value: string, coachName: string, niche: string) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((block) => {
      const [label = "", title = "", ...descriptionLines] = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      return {
        description: descriptionLines.join(" ") || title || label,
        label,
        title
      };
    })
    .filter((item) => item.label && item.title && item.description);

  return blocks.length > 0
    ? blocks
    : [
        {
          label: "Profile",
          title: `Meet ${coachName}`,
          description: "Guests understand the coach story, niche, mission, and practical guidance approach."
        },
        {
          label: "Focus",
          title: `See the ${niche} focus`,
          description: "The page explains the coach approach in a clear, trustworthy tone."
        },
        {
          label: "Action",
          title: "Open registration",
          description: "The CTA sends visitors to the coach registration form when configured."
        }
      ];
}

export function createCoachSiteFromForm(input: {
  form: CoachSiteFormState;
  id: string;
  status: CoachSiteStatus;
}): CoachSiteRecord {
  const slug = normalizeCoachSlug(input.form.slug || input.form.coachName);
  const content = createCoachContentFromForm(input.form);
  const now = new Date().toISOString();

  return {
    id: input.id,
    coachId: `coach-${slug}`,
    coachName: input.form.coachName.trim(),
    niche: input.form.niche.trim(),
    location: input.form.location.trim(),
    bio: input.form.bio.trim(),
    vision: input.form.vision.trim(),
    coachEmail: input.form.coachEmail.trim(),
    coachPhone: input.form.coachPhone.trim(),
    existingPaidFunnelUrl: input.form.existingPaidFunnelUrl.trim(),
    archivedAt: input.status === "archived" || input.status === "removed" ? now : undefined,
    createdAt: now,
    whatsappLink: input.form.whatsappLink.trim(),
    photoUrl: input.form.photoUrl.trim(),
    logoUrl: input.form.logoUrl.trim(),
    videoUrl: input.form.videoUrl.trim(),
    googleFormUrl: input.form.googleFormUrl.trim(),
    heroMediaType: input.form.heroMediaType,
    slug,
    publicUrl: getCoachPublicUrl(slug),
    publishedAt: input.status === "published" ? now : undefined,
    status: input.status,
    paidFunnelContext: input.form.paidFunnelContext.trim(),
    supportText: input.form.supportText.trim(),
    updatedAt: now,
    registerButtonText: input.form.registerButtonText.trim() || "Register Now",
    selectedThemeId: normalizeCoachTemplateThemeId(input.form.selectedThemeId),
    content,
    analytics: {
      averageVisits: 0,
      conversionRate: "0%",
      dailyVisits: 0,
      deviceBreakdown: {
        desktop: 0,
        mobile: 0,
        tablet: 0
      },
      lastUpdated: "Not connected",
      monthlyVisits: 0,
      region: "Not available",
      source: "Not available",
      totalRegisterClicks: 0,
      totalVisits: 0,
      totalWhatsappClicks: 0,
      videoPlays: 0,
      weeklyVisits: 0
    }
  };
}

export function createFormFromCoachSite(site: CoachSiteRecord): CoachSiteFormState {
  return {
    benefitDescriptionsText: site.content.benefitDescriptions.join("\n"),
    benefitsText: site.content.benefits.join("\n"),
    benefitsHeading: site.content.benefitsHeading,
    bio: site.bio,
    brandBadge: site.content.brandBadge,
    brandEyebrow: site.content.brandEyebrow,
    coachEmail: site.coachEmail,
    coachName: site.coachName,
    coachPhone: site.coachPhone,
    coachIntro: site.content.coachIntro,
    coachIntroLabel: site.content.coachIntroLabel,
    ctaText: site.content.ctaText,
    ctaSectionLabel: site.content.ctaSectionLabel,
    existingPaidFunnelUrl: site.existingPaidFunnelUrl,
    faqHeading: site.content.faqHeading,
    faqSectionLabel: site.content.faqSectionLabel,
    faqText: site.content.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
    footerBrandLine: site.content.footerBrandLine,
    footerHeadline: site.content.footerHeadline,
    footerText: site.content.footerText,
    googleFormUrl: site.googleFormUrl,
    heroMediaType: site.heroMediaType,
    heroHeadline: site.content.heroHeadline,
    heroMediaLabel: site.content.heroMediaLabel,
    heroMicroTrustText: site.content.heroMicroTrustText,
    heroTrustLine: site.content.heroTrustLine,
    introHeading: site.content.introHeading,
    introSectionLabel: site.content.introSectionLabel,
    journeyHeading: site.content.journeyHeading,
    journeySectionLabel: site.content.journeySectionLabel,
    journeyStepsText: site.content.journeySteps
      .map((step) => `${step.label}\n${step.title}\n${step.description}`)
      .join("\n\n"),
    location: site.location,
    logoUrl: site.logoUrl,
    mediaBody: site.content.mediaBody,
    mediaHeading: site.content.mediaHeading,
    mediaModuleLabel: site.content.mediaModuleLabel,
    mediaSubheading: site.content.mediaSubheading,
    niche: site.niche,
    paidFunnelContext: site.paidFunnelContext,
    photoUrl: site.photoUrl,
    problemHeading: site.content.problemHeading,
    problemSectionLabel: site.content.problemSectionLabel,
    problemPointsText: site.content.problemPoints.join("\n"),
    registerButtonText: site.registerButtonText,
    selectedThemeId: normalizeCoachTemplateThemeId(site.selectedThemeId),
    slug: site.slug,
    benefitsSectionLabel: site.content.benefitsSectionLabel,
    socialCopy: site.content.socialCopy,
    stickyCtaContactButton: site.content.stickyCtaContactButton || "Register Now",
    stickyCtaContext: site.content.stickyCtaContext || `${site.niche || "Coach referral"} through YW Nutritech`,
    stickyCtaHeading:
      site.content.stickyCtaHeading || `Ready to connect with Coach ${site.coachName}?`,
    stickyCtaLabel: site.content.stickyCtaLabel || "Registration",
    subheadline: site.content.subheadline,
    supportEmailLabel: site.content.supportEmailLabel || "Email",
    supportHeading: site.content.supportHeading || "Contact Support",
    supportPhoneLabel: site.content.supportPhoneLabel || "Phone",
    supportPrimaryButton: site.content.supportPrimaryButton || "Contact Support",
    supportPrivacyNote:
      site.content.supportPrivacyNote ||
      "Contact details shown here are public coach-site support details, not admin-only data.",
    supportWhatsappButton: site.content.supportWhatsappButton || "Message coach",
    supportWhatsappLabel: site.content.supportWhatsappLabel || "WhatsApp",
    supportText: site.supportText,
    trustText: site.content.trustText,
    visionLabel: site.content.visionLabel,
    videoUrl: site.videoUrl,
    vision: site.vision,
    visionText: site.content.visionText,
    whatsappLink: site.whatsappLink
  };
}

function parseLines(value: string, fallback: string[]) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : fallback;
}

function parseFaq(value: string) {
  const blocks = value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const parsed = blocks
    .map((block) => {
      const [question, ...answerLines] = block.split(/\r?\n/).map((line) => line.trim());

      return {
        question,
        answer: answerLines.join(" ").trim()
      };
    })
    .filter((item) => item.question && item.answer);

  return parsed.length > 0
    ? parsed
    : [
        {
          question: "What happens after I register?",
          answer: "The register button opens the admin-provided Google Form when configured."
        }
      ];
}
