import type { PublicCoachSiteRecord } from "./admin-coach-sites";

export type UniversalCoachBonus = {
  actualAssetUrl: string;
  actualAvailability: boolean;
  actualValue: number | null;
  assetType:
    | "calculator_suite"
    | "digital_book"
    | "general_wellness"
    | "support_session"
    | "toolkit"
    | "video_training";
  baseDescription: string;
  baseType: string;
  baseTitle: string;
  fallbackIcon: "book" | "calculator" | "calendar" | "chat" | "checklist" | "play" | "spark";
  id: string;
  imageAlt: string;
  imageUrl: string;
  valueLabel: string;
};

export type NicheAdaptiveBonusItem = UniversalCoachBonus & {
  badge: string;
  description: string;
  displayTitle: string;
  lockedAssetId: string;
  title: string;
  typeLabel: string;
  valueDisplay: string;
  visualType:
    | "smart_book_cover"
    | "smart_product_tile"
    | "smart_support_tile"
    | "smart_toolkit_tile"
    | "smart_video_tile";
};

export type CanonicalCoachTemplateRule = {
  aiAdaptive: boolean;
  animationBehavior?: Record<string, boolean | string>;
  cardCount: number;
  editableSlots: string[];
  enabled: boolean;
  fallbackBehavior?: Record<string, boolean | string>;
  legalSafetyRules?: Record<string, boolean>;
  lockedFields: string[];
  ruleKey: string;
  smartVisuals: boolean;
  source: string;
  valueDisplayRules?: Record<string, boolean | string>;
};

export type CanonicalCoachSectionKey =
  | "hero"
  | "coach"
  | "problem"
  | "journey"
  | "results"
  | "fit"
  | "bonuses"
  | "faq"
  | "contact";

export type CanonicalCoachSectionDefinition = {
  anchorTarget: `#${string}`;
  enabled: boolean;
  navLabel: string;
  order: number;
  sectionId: string;
  sectionKey: CanonicalCoachSectionKey;
  visibleInNavbar: boolean;
};

export const CANONICAL_COACH_TEMPLATE_ID = "canonical-coach-site-template";

export const canonicalCoachSectionRegistry: CanonicalCoachSectionDefinition[] = [
  {
    anchorTarget: "#home",
    enabled: true,
    navLabel: "Home",
    order: 10,
    sectionId: "home",
    sectionKey: "hero",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#story",
    enabled: true,
    navLabel: "About Coach",
    order: 20,
    sectionId: "story",
    sectionKey: "coach",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#problem",
    enabled: true,
    navLabel: "Familiar",
    order: 30,
    sectionId: "problem",
    sectionKey: "problem",
    visibleInNavbar: false
  },
  {
    anchorTarget: "#how-it-works",
    enabled: true,
    navLabel: "Journey",
    order: 40,
    sectionId: "how-it-works",
    sectionKey: "journey",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#results",
    enabled: true,
    navLabel: "Results",
    order: 50,
    sectionId: "results",
    sectionKey: "results",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#for-you",
    enabled: true,
    navLabel: "For You",
    order: 60,
    sectionId: "for-you",
    sectionKey: "fit",
    visibleInNavbar: false
  },
  {
    anchorTarget: "#bonus",
    enabled: true,
    navLabel: "Bonuses",
    order: 70,
    sectionId: "bonus",
    sectionKey: "bonuses",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#faq",
    enabled: true,
    navLabel: "FAQ",
    order: 80,
    sectionId: "faq",
    sectionKey: "faq",
    visibleInNavbar: true
  },
  {
    anchorTarget: "#yw-footer",
    enabled: true,
    navLabel: "Contact",
    order: 90,
    sectionId: "yw-footer",
    sectionKey: "contact",
    visibleInNavbar: true
  }
];

export function getCanonicalCoachNavbarSections() {
  return canonicalCoachSectionRegistry
    .filter((section) => section.enabled && section.visibleInNavbar)
    .sort((a, b) => a.order - b.order);
}

export const universalCoachBonuses: UniversalCoachBonus[] = [
  {
    actualAssetUrl: "",
    actualAvailability: true,
    actualValue: 3200,
    assetType: "calculator_suite",
    baseDescription:
      "Access useful health calculators and progress tools to better understand wellness indicators and track your journey over time.",
    baseType: "Health Calculators",
    baseTitle: "Life-Long Health Calculators",
    fallbackIcon: "calculator",
    id: "life-long-health-calculators",
    imageAlt: "Health calculator and progress tool bonus visual",
    imageUrl: "/assets/bonus-life-long-health-calculators.png",
    valueLabel: "Worth Rs 3,200"
  },
  {
    actualAssetUrl: "",
    actualAvailability: true,
    actualValue: 3200,
    assetType: "support_session",
    baseDescription:
      "Join guided support sessions to stay consistent, informed, motivated, and supported throughout your wellness journey.",
    baseType: "Support Sessions",
    baseTitle: "Lifetime Support Sessions",
    fallbackIcon: "chat",
    id: "lifetime-support-sessions",
    imageAlt: "Guided support session bonus visual",
    imageUrl: "/assets/bonus-lifetime-support-sessions.png",
    valueLabel: "Worth Rs 3,200"
  },
  {
    actualAssetUrl: "",
    actualAvailability: true,
    actualValue: 3599,
    assetType: "toolkit",
    baseDescription:
      "Access practical lifestyle checklists, habit-building tools, implementation guides, and daily consistency resources.",
    baseType: "Digital Toolkit",
    baseTitle: "Lifestyle Success Toolkit",
    fallbackIcon: "checklist",
    id: "lifestyle-success-toolkit",
    imageAlt: "Lifestyle success toolkit bonus visual",
    imageUrl: "/assets/bonus-lifestyle-success-toolkit.png",
    valueLabel: "Worth Rs 3,599"
  }
];

export const canonicalCoachTemplateRules: CanonicalCoachTemplateRule[] = [
  {
    aiAdaptive: true,
    cardCount: 3,
    editableSlots: [
      "bonus.eyebrow",
      "bonus.heading",
      "bonus.subheading",
      "bonus.items[].description",
      "bonus.ctaHelperText"
    ],
    enabled: true,
    lockedFields: [
      "bonus.id",
      "bonus.lockedAssetId",
      "bonus.items[].displayTitle",
      "bonus.items[].title",
      "bonus.visualType",
      "bonus.assetType",
      "bonus.actualAssetUrl",
      "bonus.actualValue",
      "bonus.actualAvailability",
      "legal.disclaimer",
      "cta.destination",
      "analytics.tracking"
    ],
    ruleKey: "nicheAdaptiveBonusSection",
    smartVisuals: true,
    valueDisplayRules: {
      hideMissingValue: false,
      neverInventValue: true,
      showConfiguredValue: true,
      showIncludedFreeFallback: true
    },
    animationBehavior: {
      cardHoverLift: true,
      ctaHoverGlow: true,
      reducedMotionSafe: true,
      smartVisualHoverMotion: true,
      staggerReveal: true,
      valueStripShine: true
    },
    legalSafetyRules: {
      noDiagnosisTreatmentClaims: true,
      noFakeScarcity: true,
      noFakeUrgency: true,
      noGuaranteedResults: true,
      noInventedAssets: true,
      preserveDisclaimer: true
    },
    fallbackBehavior: {
      missingImage: "SmartBonusVisual",
      missingNiche: "Your Registration Includes Free Wellness Support Tools",
      missingValue: "Included Free"
    },
    source: "universalBonusRegistry"
  },
  {
    aiAdaptive: false,
    cardCount: 0,
    editableSlots: [],
    enabled: true,
    fallbackBehavior: {
      unknownTheme: "canonical-coach-site-template",
      unsafeMotion: "static-gradient"
    },
    legalSafetyRules: {
      preserveAnalytics: true,
      preserveContactSupport: true,
      preserveCtaDestination: true,
      preserveLegalReturn: true,
      preservePublicRoute: true
    },
    lockedFields: [
      "route.slug",
      "cta.destination",
      "googleFormUrl",
      "contactSupport.behavior",
      "legal.backToLandingPage",
      "analytics.tracking",
      "inspect.permissions",
      "section.structure"
    ],
    ruleKey: "themeSkinPresentationOnly",
    smartVisuals: false,
    source: "themeSkinRegistry",
    animationBehavior: {
      backgroundDecorativeOnly: true,
      noClickBlocking: true,
      reducedMotionSafe: true,
      staticFallbackRequired: true,
      stickyElementsAboveBackground: true
    }
  },
  {
    aiAdaptive: false,
    cardCount: 0,
    editableSlots: [],
    enabled: true,
    fallbackBehavior: {
      previewRenderer: "PublicCoachSitePage",
      publicRenderer: "PublicCoachSitePage"
    },
    legalSafetyRules: {
      noPreviewOnlyBusinessLogic: true,
      noPublicPageAiRegeneration: true,
      preservePublishedContentObject: true
    },
    lockedFields: [
      "renderer.component",
      "content.object",
      "content.normalization",
      "selectedThemeId",
      "sticky.navbar",
      "sticky.registerCta",
      "sticky.bottomCta",
      "responsive.breakpoints",
      "legal.links",
      "faq.accordion"
    ],
    ruleKey: "previewPublicRendererParity",
    smartVisuals: false,
    source: "canonicalRenderer"
  },
  {
    aiAdaptive: true,
    cardCount: 0,
    editableSlots: [
      "hero.programTitle",
      "hero.subheadline",
      "intro.heading",
      "intro.body",
      "problem.heading",
      "problem.items[]",
      "journey.heading",
      "journey.steps[]",
      "bonus.items[].description",
      "cta.heading",
      "faq.heading",
      "faq.items[].answer"
    ],
    enabled: true,
    fallbackBehavior: {
      failedAi: "premium-safe-fallback",
      lowConfidenceNiche: "neutral-wellness-copy"
    },
    legalSafetyRules: {
      noDeveloperLanguage: true,
      noFakeScarcity: true,
      noGuaranteedResults: true,
      noRawInputCopyPaste: true,
      noWrongNicheLeakage: true,
      preserveDisclaimer: true
    },
    lockedFields: [
      "bonus.items[].title",
      "legal.disclaimer",
      "cta.destination",
      "googleFormUrl",
      "analytics.tracking"
    ],
    ruleKey: "coachCopyQualityGuard",
    smartVisuals: false,
    source: "sharedAdminShopAiCopyPipeline"
  }
];

export function getCanonicalCoachName(site: PublicCoachSiteRecord) {
  return site.coachName?.trim() || "Coach";
}

export function getCanonicalCoachNiche(site: PublicCoachSiteRecord) {
  return site.niche?.trim() || "wellness";
}

export function getCanonicalRegisterLabel(site: PublicCoachSiteRecord) {
  void site;
  return "Register Now";
}

export function getCanonicalCoachInitials(site: PublicCoachSiteRecord) {
  const parts = getCanonicalCoachName(site).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "YW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function getNextTuesdayProgramDateLabel(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric"
  }).formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === "year")?.value || referenceDate.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || referenceDate.getUTCMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || referenceDate.getUTCDate());
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysUntilTuesday = (2 - (weekdayIndex >= 0 ? weekdayIndex : referenceDate.getUTCDay()) + 7) % 7;
  const target = new Date(Date.UTC(year, month - 1, day + daysUntilTuesday, 12, 0, 0));
  const targetParts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
    year: "numeric"
  }).formatToParts(target);
  const targetDay = Number(targetParts.find((part) => part.type === "day")?.value || target.getUTCDate());
  const targetMonth = targetParts.find((part) => part.type === "month")?.value || "";
  const targetYear = targetParts.find((part) => part.type === "year")?.value || String(target.getUTCFullYear());

  return `${targetDay}${getOrdinalSuffix(targetDay)} ${targetMonth.toUpperCase()} ${targetYear}`;
}

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  const lastDigit = day % 10;
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

export function getNicheAdaptiveBonusSection(site: PublicCoachSiteRecord) {
  const nicheProfile = getNicheProfile(site);
  const storedHeading = site.content.benefitsHeading || "";
  const customSectionIsBonus = isBonusLike(storedHeading) && !isInternalBonusLabel(storedHeading);
  const customDescriptions = customSectionIsBonus ? site.content.benefitDescriptions || [] : [];
  const heading = customSectionIsBonus
    ? sanitizeBonusPresentationCopy(storedHeading, nicheProfile.heading, nicheProfile)
    : nicheProfile.heading;
  const subheading =
    customDescriptions
      .map((item, index) => sanitizeBonusPresentationCopy(item, "", nicheProfile, index))
      .find((item) => item.length > 60) || nicheProfile.subheading;
  const items: NicheAdaptiveBonusItem[] = universalCoachBonuses.map((bonus, index) => {
    const title = bonus.baseTitle;
    const description = sanitizeBonusPresentationCopy(
      customDescriptions[index],
      nicheProfile.descriptions[index] || bonus.baseDescription,
      nicheProfile,
      index
    );

    return {
      ...bonus,
      badge: `Bonus ${index + 1}`,
      description,
      displayTitle: title,
      lockedAssetId: bonus.id,
      title,
      typeLabel: bonus.baseType,
      valueDisplay: getBonusValueDisplay(bonus),
      visualType: getSmartBonusVisualType(bonus.assetType)
    };
  });
  const totalValueText = getTotalBonusValueText(items);

  return {
    ctaButtonText: getCanonicalRegisterLabel(site),
    ctaHeading: totalValueText,
    ctaHelperText: nicheProfile.ctaHelperText,
    ctaSupportCopy: nicheProfile.ctaHelperText,
    ctaText: getCanonicalRegisterLabel(site),
    eyebrow: nicheProfile.eyebrow,
    heading,
    items,
    ruleKey: "nicheAdaptiveBonusSection",
    subheading,
    totalValueText,
    totalValueLabel: totalValueText
  };
}

export function getSmartBonusVisualType(assetType: UniversalCoachBonus["assetType"]): NicheAdaptiveBonusItem["visualType"] {
  if (assetType === "digital_book") return "smart_book_cover";
  if (assetType === "video_training") return "smart_video_tile";
  if (assetType === "toolkit") return "smart_toolkit_tile";
  if (assetType === "support_session") return "smart_support_tile";
  return "smart_product_tile";
}

export function getSmartBonusVisualCssType(visualType: NicheAdaptiveBonusItem["visualType"]) {
  if (visualType === "smart_video_tile") return "video";
  if (visualType === "smart_toolkit_tile") return "toolkit";
  if (visualType === "smart_support_tile") return "support";
  if (visualType === "smart_product_tile") return "product";
  return "ebook";
}

export function getSmartBonusVisualMark(item: Pick<NicheAdaptiveBonusItem, "assetType" | "fallbackIcon" | "visualType">) {
  if (item.assetType === "calculator_suite" || item.fallbackIcon === "calculator") {
    return "Calc";
  }
  if (item.visualType === "smart_video_tile" || item.assetType === "video_training" || item.fallbackIcon === "play") {
    return "Play";
  }
  if (item.visualType === "smart_toolkit_tile" || item.assetType === "toolkit" || item.fallbackIcon === "checklist") {
    return "Use";
  }
  if (item.visualType === "smart_support_tile" || item.assetType === "support_session" || item.fallbackIcon === "chat") {
    return "Meet";
  }
  return "Read";
}

function getBonusValueDisplay(bonus: UniversalCoachBonus) {
  return bonus.valueLabel ? `${bonus.valueLabel} - Included Free` : "Included Free";
}

function getTotalBonusValueText(items: NicheAdaptiveBonusItem[]) {
  const totalValue = items.reduce((sum, item) => sum + (Number(item.actualValue) || 0), 0);
  return totalValue > 0 ? `Total bonus value: Rs ${totalValue.toLocaleString("en-IN")}` : "";
}

export function getCanonicalHeroPackage(site: PublicCoachSiteRecord) {
  const sectionCopy = getCanonicalCoachSectionCopy(site);
  const storedHelperText = site.content.heroMicroTrustText || "";
  const storedSupportLine = site.content.trustText || "";

  return {
    eyebrow: sectionCopy.topStrip,
    headline: sectionCopy.heroTitleMain,
    helperText:
      (storedHelperText && !isUnsafeAdaptiveCopy(storedHelperText, sectionCopy.allowsWomenSpecificCopy)
        ? storedHelperText
        : "") ||
      "Fill a quick form and the coach will guide you to the next step.",
    highlight: sectionCopy.heroTitleAccent,
    subheadline: sectionCopy.heroSubheadline,
    supportLine:
      (storedSupportLine && !isUnsafeAdaptiveCopy(storedSupportLine, sectionCopy.allowsWomenSpecificCopy)
        ? storedSupportLine
        : "") ||
      "Education-first lifestyle coaching support. No guaranteed results, diagnosis, treatment, or cure claims."
  };
}

export function getCanonicalHeroDetailCards(site: PublicCoachSiteRecord) {
  const niche = getCanonicalCoachNiche(site);
  const location = site.location?.trim() || "YW Nutritech Circle";

  return [
    {
      label: "Focus",
      value: getShortNicheLabel(niche)
    },
    {
      label: "Support Type",
      value: "Lifestyle Guidance"
    },
    {
      label: "Next Step",
      value: "Quick Registration"
    },
    {
      label: "Coach Location",
      value: location
    }
  ];
}

export function getSafeCoachTemplateCopy(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() || "";
  return trimmed && !isUnsafeHealthCopy(trimmed) ? trimmed : fallback;
}

export type CanonicalHeroInfoCardKind =
  | "date"
  | "duration"
  | "focus"
  | "format"
  | "language"
  | "location"
  | "next"
  | "support"
  | "time";

export type CanonicalHeroInfoCard = {
  id: string;
  kind: CanonicalHeroInfoCardKind;
  label: string;
  value: string;
};

export type CanonicalCoachFaqItem = {
  answer: string;
  question: string;
};

export type CanonicalCoachResultCard = {
  attribution: string;
  body: string;
  label: string;
  title: string;
};

export type CanonicalCoachSectionCopy = {
  allowsWomenSpecificCopy: boolean;
  detailCards: CanonicalHeroInfoCard[];
  detailHeading: string;
  detailSubline: string;
  faqHeading: string;
  faqItems: CanonicalCoachFaqItem[];
  faqLabel: string;
  finalBody: string;
  finalHeadingAccent: string;
  finalHeadingMain: string;
  fitAriaLabel: string;
  fitForPoints: string[];
  fitHeadingAccent: string;
  fitHeadingMain: string;
  fitNotForPoints: string[];
  heroEyebrow: string;
  heroSubheadline: string;
  heroTitleAccent: string;
  heroTitleMain: string;
  journeyHeading: string;
  journeyLabel: string;
  journeySteps: Array<{
    description: string;
    label: string;
    title: string;
  }>;
  problemHeading: string;
  problemLabel: string;
  problemPoints: string[];
  resultsCards: CanonicalCoachResultCard[];
  resultsHeadingAccent: string;
  resultsHeadingMain: string;
  resultsLabel: string;
  resultsSubcopy: string;
  stickyCtaEyebrow: string;
  topStrip: string;
  trustHeading: string;
  trustIntro: string;
  trustLabel: string;
  trustMission: string;
};

export function getCanonicalCoachSectionCopy(site: PublicCoachSiteRecord): CanonicalCoachSectionCopy {
  const coachName = getCanonicalCoachName(site);
  const rawNiche = getCanonicalCoachNiche(site);
  const shortNiche = getShortNicheLabel(rawNiche);
  const profile = getNicheProfile(site);
  const profileCopy = getSectionProfileCopy(profile.key, profile.label, shortNiche);
  const allowsWomenSpecificCopy = profile.allowsWomenOnlyCopy;
  const fallbackTopStrip = `Practical ${profile.label.toLowerCase()} support with Coach ${coachName}`;
  const fallbackHeroEyebrow = `${profile.label} guidance with Coach ${coachName}`;
  const title = getAdaptiveHeroTitle(site, profileCopy, allowsWomenSpecificCopy);
  const heroSubheadline = sanitizeAdaptiveCopy(
    site.content.subheadline,
    `A calm, practical first step for ${profile.label.toLowerCase()} support with ${coachName}, built around education, routines, and clear next actions.`,
    allowsWomenSpecificCopy
  );
  const trustIntro = sanitizeAdaptiveCopy(
    site.content.coachIntro || site.bio,
    `${coachName} helps guests understand ${profileCopy.themePhrase} through education-first coaching, routine clarity, and a simple registration path.`,
    allowsWomenSpecificCopy
  );
  const trustMission = sanitizeAdaptiveCopy(
    site.content.visionText || site.vision,
    `The goal is to make ${profile.label.toLowerCase()} support feel practical, safe, and easier to follow alongside the right professional care.`,
    allowsWomenSpecificCopy
  );
  const registerLabel = getCanonicalRegisterLabel(site);

  return {
    allowsWomenSpecificCopy,
    detailCards: getCanonicalAdaptiveDetailCards(site, profile.label),
    detailHeading: sanitizeAdaptiveCopy(site.content.heroMediaLabel, "Support Details", allowsWomenSpecificCopy),
    detailSubline: sanitizeAdaptiveCopy(
      site.content.heroTrustLine,
      profileCopy.detailSubline,
      allowsWomenSpecificCopy
    ),
    faqHeading: sanitizeAdaptiveCopy(site.content.faqHeading, "Clean answers before registration.", allowsWomenSpecificCopy),
    faqItems: getCanonicalCoachFaqItems(site),
    faqLabel: sanitizeAdaptiveCopy(site.content.faqSectionLabel, "FAQ", allowsWomenSpecificCopy),
    finalBody: sanitizeAdaptiveCopy(
      site.content.trustText,
      `Use the coach-specific registration form to share your interest. This is a first-step guidance page, not diagnosis, emergency care, or a guaranteed outcome.`,
      allowsWomenSpecificCopy
    ),
    finalHeadingAccent: `With ${coachName}`,
    finalHeadingMain: sanitizeAdaptiveCopy(
      site.content.ctaText,
      "Take Your Next Step",
      allowsWomenSpecificCopy
    ),
    fitAriaLabel: "Who this coach guidance is for",
    fitForPoints: getFitForPoints(profileCopy, profile.label),
    fitHeadingAccent: "right for you?",
    fitHeadingMain: "Is this guidance",
    fitNotForPoints: getFitNotForPoints(),
    heroEyebrow: sanitizeAdaptiveCopy(site.content.brandEyebrow, fallbackHeroEyebrow, allowsWomenSpecificCopy),
    heroSubheadline,
    heroTitleAccent: title.accent,
    heroTitleMain: title.main,
    journeyHeading: sanitizeAdaptiveCopy(
      site.content.journeyHeading,
      "One page that moves from trust to action.",
      allowsWomenSpecificCopy
    ),
    journeyLabel: sanitizeAdaptiveCopy(site.content.journeySectionLabel, "How guests move forward", allowsWomenSpecificCopy),
    journeySteps: getCanonicalCoachJourneySteps(site, profile.label, coachName, allowsWomenSpecificCopy),
    problemHeading: sanitizeAdaptiveCopy(
      site.content.problemHeading,
      `For guests who want direction before committing to deeper ${profile.label.toLowerCase()} support.`,
      allowsWomenSpecificCopy
    ),
    problemLabel: sanitizeAdaptiveCopy(site.content.problemSectionLabel, "Problem to solution", allowsWomenSpecificCopy),
    problemPoints: getCanonicalCoachProblemPoints(site, profileCopy, profile, allowsWomenSpecificCopy),
    resultsCards: getCanonicalCoachResultCards(profileCopy),
    resultsHeadingAccent: "without pressure.",
    resultsHeadingMain: "Support stories that build clarity",
    resultsLabel: "Real support. Real next steps.",
    resultsSubcopy: `Guests use this page to understand the coach, the ${profile.label.toLowerCase()} focus, and the next registration step before moving forward.`,
    stickyCtaEyebrow: sanitizeAdaptiveCopy(
      site.content.stickyCtaLabel,
      registerLabel.toLowerCase().includes("free") ? "Registration" : "Coach registration",
      allowsWomenSpecificCopy
    ),
    topStrip: sanitizeAdaptiveCopy(site.content.brandBadge, fallbackTopStrip, allowsWomenSpecificCopy),
    trustHeading: sanitizeAdaptiveCopy(
      site.content.introHeading,
      `Meet the coach behind the ${profile.label.toLowerCase()} guidance.`,
      allowsWomenSpecificCopy
    ),
    trustIntro,
    trustLabel: sanitizeAdaptiveCopy(site.content.visionLabel, "Coach mission", allowsWomenSpecificCopy),
    trustMission
  };
}

export function getCanonicalCoachFaqItems(site: PublicCoachSiteRecord): CanonicalCoachFaqItem[] {
  const profile = getNicheProfile(site);
  const coachName = getCanonicalCoachName(site);
  const nicheLabel = profile.label.toLowerCase();
  const allowsWomenSpecificCopy = profile.allowsWomenOnlyCopy;
  const configured = (site.content.faq || [])
    .map((item) => ({
      answer: sanitizeAdaptiveCopy(item.answer, "", allowsWomenSpecificCopy),
      question: sanitizeAdaptiveCopy(item.question, "", allowsWomenSpecificCopy)
    }))
    .filter((item) => item.question && item.answer);
  const fallbackItems: CanonicalCoachFaqItem[] = [
    {
      answer:
        "No. This page is for wellness education and lifestyle coaching support only. It does not replace medical advice, diagnosis, treatment, prescriptions, or emergency care.",
      question: "Do you provide medical diagnosis or prescriptions?"
    },
    {
      answer: `It introduces Coach ${coachName}, explains the ${nicheLabel} support focus, and gives you a simple way to register interest through the coach-specific form.`,
      question: "What does this support include?"
    },
    {
      answer:
        "Tap any Register Now button on this page. If the coach has configured a form, it opens that specific registration form in a new tab.",
      question: "How do I register?"
    },
    {
      answer:
        "Your registration is used as the next step for coach follow-up or support routing. The page does not promise a result or replace professional care.",
      question: "What happens after I register?"
    },
    {
      answer: `It may be useful if you want practical ${nicheLabel} guidance, routine clarity, and education-first support before deciding on deeper coaching.`,
      question: "Is this suitable for me?"
    },
    {
      answer:
        "Yes. Coach support is designed to sit alongside appropriate healthcare guidance. Continue to follow your doctor's advice for medical decisions.",
      question: "Can I continue with my doctor while joining support?"
    },
    {
      answer:
        "The page itself is a registration and information page. Any paid or private support details should be confirmed through the coach-specific registration or follow-up process.",
      question: "Is this free or paid?"
    }
  ];
  const seen = new Set<string>();

  return [...configured, ...fallbackItems]
    .filter((item) => {
      const key = item.question.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(5, Math.min(8, configured.length || 5)));
}

function getAdaptiveHeroTitle(
  site: PublicCoachSiteRecord,
  profileCopy: ReturnType<typeof getSectionProfileCopy>,
  allowsWomenSpecificCopy: boolean
) {
  const configured = sanitizeAdaptiveCopy(site.content.heroHeadline, "", allowsWomenSpecificCopy);
  const shouldUseConfigured =
    configured &&
    !shouldCondenseHeroHeadline(configured) &&
    !/\b(meet|register|join|free|session|masterclass|limited|template|fixed-template)\b/i.test(configured);
  const title = shouldUseConfigured ? splitAdaptiveTitle(configured) : profileCopy.title;

  return title;
}

function splitAdaptiveTitle(value: string) {
  const words = value.trim().replace(/[.]+$/, "").split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return {
      accent: "",
      main: words.join(" ")
    };
  }

  return {
    accent: words.slice(-2).join(" "),
    main: words.slice(0, -2).join(" ")
  };
}

function getCanonicalAdaptiveDetailCards(site: PublicCoachSiteRecord, profileLabel: string): CanonicalHeroInfoCard[] {
  const location = sanitizeAdaptiveCopy(site.location, "", true);
  const cards: CanonicalHeroInfoCard[] = [
    {
      id: "e2303b9",
      kind: "focus",
      label: "Focus",
      value: profileLabel
    },
    {
      id: "98a2fea",
      kind: "support",
      label: "Support",
      value: "Lifestyle education"
    },
    {
      id: "4a1595b",
      kind: "next",
      label: "Next Step",
      value: site.googleFormUrl ? "Quick registration" : "Link pending"
    }
  ];

  cards.push(
    location
      ? {
          id: "d59d08f",
          kind: "location",
          label: "Location",
          value: location
        }
      : {
          id: "d59d08f",
          kind: "language",
          label: "Language",
          value: "English"
        }
  );

  return cards;
}

function getCanonicalCoachProblemPoints(
  site: PublicCoachSiteRecord,
  profileCopy: ReturnType<typeof getSectionProfileCopy>,
  profile: ReturnType<typeof getNicheProfile>,
  allowsWomenSpecificCopy: boolean
) {
  const configured = site.content.problemPoints
    .map((point) => sanitizeAdaptiveCopy(point, "", allowsWomenSpecificCopy))
    .filter((point) => point && !hasWrongNicheBonusLeakage(point, profile))
    .filter(Boolean);
  const fallback = [
    `Too much scattered ${profileCopy.topicPhrase} advice and not enough structure.`,
    "Unsure what daily routine changes matter first.",
    "Need a coach-led starting point before moving into deeper support.",
    "Want practical education that can sit alongside appropriate professional care."
  ];

  return ensureMinimumList(configured, fallback, 4);
}

function getCanonicalCoachJourneySteps(
  site: PublicCoachSiteRecord,
  profileLabel: string,
  coachName: string,
  allowsWomenSpecificCopy: boolean
) {
  const configured = site.content.journeySteps
    .map((step) => ({
      description: sanitizeAdaptiveCopy(step.description, "", allowsWomenSpecificCopy),
      label: sanitizeAdaptiveCopy(step.label, "", allowsWomenSpecificCopy),
      title: sanitizeAdaptiveCopy(step.title, "", allowsWomenSpecificCopy)
    }))
    .filter((step) => step.description && step.title);
  const fallback = [
    {
      description: `Understand ${coachName}'s story, guidance approach, and ${profileLabel.toLowerCase()} focus without guessing.`,
      label: "Profile",
      title: `Meet ${coachName}`
    },
    {
      description: "Review the practical guidance style and decide whether this feels like the right first step.",
      label: "Fit",
      title: "Check the guidance fit"
    },
    {
      description: "Use the coach-specific registration form when you are ready to move forward.",
      label: "Action",
      title: "Register interest"
    }
  ];

  return (configured.length ? configured : fallback).slice(0, 4);
}

function getCanonicalCoachResultCards(profileCopy: ReturnType<typeof getSectionProfileCopy>): CanonicalCoachResultCard[] {
  return [
    {
      attribution: "YW Member",
      body: `Used the page to understand the ${profileCopy.topicPhrase} focus and choose the next step with more clarity.`,
      label: "Support note",
      title: "Clarity before action"
    },
    {
      attribution: "Coach Circle",
      body: "Turned scattered advice into a calmer routine conversation with coach-led guidance.",
      label: "Support note",
      title: "Better routine direction"
    },
    {
      attribution: "YW Nutritech",
      body: "Found the registration path without confusing forms, missing links, or unclear next steps.",
      label: "Support note",
      title: "Clearer next step"
    }
  ];
}

function getFitForPoints(profileCopy: ReturnType<typeof getSectionProfileCopy>, profileLabel: string) {
  return [
    `You want education-first ${profileLabel.toLowerCase()} guidance before taking the next step.`,
    "You are open to practical lifestyle habits and consistency.",
    "You want to understand the coach's method before registering.",
    "You want support from a YW Nutritech coach pathway.",
    `You are ready to take notes and act on ${profileCopy.topicPhrase} routines.`
  ];
}

function getFitNotForPoints() {
  return [
    "You are looking for instant results or guaranteed outcomes.",
    "You need emergency, diagnosis, or treatment advice.",
    "You expect results without learning or consistent action.",
    "You are not open to changing your routine or support system.",
    "You plan to register without attending or following through."
  ];
}

function ensureMinimumList(configured: string[], fallback: string[], minimum: number) {
  const seen = new Set<string>();

  return [...configured, ...fallback]
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(minimum, Math.min(6, configured.length || minimum)));
}

function sanitizeAdaptiveCopy(value: string | undefined, fallback: string, allowsWomenSpecificCopy: boolean) {
  const trimmed = value?.trim().replace(/\s+/g, " ") || "";
  if (!trimmed) return fallback;
  if (isUnsafeAdaptiveCopy(trimmed, allowsWomenSpecificCopy)) return fallback;
  if (isWeakSectionCopy(trimmed)) return fallback;
  return trimmed;
}

function isWeakSectionCopy(value: string) {
  return /^(coach|register|register now|cta|contact coach|contact support|free guest registration|yw care lens|coach referral|yw nutritech coach network|yw nutritech premium coach profile|built for client-ready referrals|ready to work with this coach\??|questions before connecting|yw nutritech premium coach website|coach media spotlight|photo and video-ready profile)$/i.test(
    value.trim()
  ) || /\b(support style|care lens|premium\s+[a-z0-9 /&-]+\s+support)\b/i.test(value);
}

function isUnsafeAdaptiveCopy(value: string, allowsWomenSpecificCopy: boolean) {
  if (isUnsafeHealthCopy(value)) return true;
  if (
    /\b(free live masterclass|limited seats|2[-\s]?hour masterclass|only for women|women only|exclusively for women|the coaching blueprint|this masterclass is free|transformation isn't optional|masterclass right for you|real women|they used this blueprint|complete blueprint|nothing held back|without quitting|coaching business|profitable coaching|seat(?:s)? left|secure your seat)\b/i.test(
      value
    )
  ) {
    return true;
  }
  if (/\bmasterclass\b/i.test(value) && !/\bguest session|support session|registration session\b/i.test(value)) {
    return true;
  }
  if (!allowsWomenSpecificCopy && /\b(women|woman|female|pcos|pcod|pmos|hormone|hormonal)\b/i.test(value)) {
    return true;
  }
  if (/\b(lorem|undefined|null|insert here|fixed-template|placeholder)\b/i.test(value)) return true;

  return false;
}

function getSectionProfileCopy(key: string, label: string, shortNiche: string) {
  const normalizedLabel = label || shortNiche || "Wellness";
  const fallback = {
    detailSubline: "A calm first step before deeper coaching.",
    themePhrase: `${normalizedLabel.toLowerCase()} habits and daily routines`,
    title: {
      accent: "Clarity System",
      main: "The Lifestyle"
    },
    topicPhrase: normalizedLabel.toLowerCase()
  };

  const profiles: Record<string, typeof fallback> = {
    fatLoss: {
      detailSubline: "Useful for guests exploring sustainable weight-management habits.",
      themePhrase: "meal rhythm, movement consistency, mindset, and sustainable habit-building",
      title: {
        accent: "Habit Plan",
        main: "The Weight-Management"
      },
      topicPhrase: "weight-management"
    },
    fitness: {
      detailSubline: "Built for practical movement, recovery, and consistency support.",
      themePhrase: "training rhythm, movement consistency, recovery, and long-term motivation",
      title: {
        accent: "Consistency Plan",
        main: "The Strength"
      },
      topicPhrase: "fitness and strength"
    },
    general: fallback,
    gut: {
      detailSubline: "Useful for guests exploring digestion-friendly routines and habit clarity.",
      themePhrase: "food rhythm, digestion awareness, routine tracking, and calmer daily habits",
      title: {
        accent: "Framework",
        main: "The Gut Wellness"
      },
      topicPhrase: "gut wellness"
    },
    metabolic: {
      detailSubline: "Useful for guests exploring metabolic wellness habits and routine consistency.",
      themePhrase: "food choices, routine consistency, energy, movement, and everyday metabolic awareness",
      title: {
        accent: "Clarity Path",
        main: "The Metabolic"
      },
      topicPhrase: "metabolic wellness"
    },
    pcos: {
      detailSubline: "Focused on practical women's wellness support.",
      themePhrase: "food rhythm, stress awareness, recovery, mindset, and everyday hormone-supportive habits",
      title: {
        accent: "Habit Path",
        main: "The Hormone-Supportive"
      },
      topicPhrase: "women's wellness"
    },
    sleep: {
      detailSubline: "Useful for guests exploring calmer sleep and recovery routines.",
      themePhrase: "evening routine, stress regulation, recovery habits, and better daily rhythm",
      title: {
        accent: "Reset",
        main: "The Sleep Rhythm"
      },
      topicPhrase: "sleep and recovery"
    }
  };

  return profiles[key] || fallback;
}

function isGenericHeroHeadline(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "the coaching blueprint" ||
    normalized === "the coaching" ||
    normalized === "coaching blueprint" ||
    normalized.includes("magical lifestyle method") ||
    normalized.includes("reverse diabetes") ||
    normalized.includes("without medicines")
  );
}

function shouldCondenseHeroHeadline(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (isGenericHeroHeadline(normalized) || isUnsafeHealthCopy(normalized)) return true;

  const wordCount = normalized ? normalized.split(" ").length : 0;
  return normalized.length > 54 || wordCount > 7;
}

function getShortNicheLabel(niche: string) {
  const normalized = niche.toLowerCase();
  if (/\b(diabet|sugar|insulin|glucose)\b/.test(normalized)) return "Metabolic Wellness";

  return niche
    .replace(/\b(coaching|coach|support|guidance|program|masterclass)\b/gi, "")
    .replace(/\b(reverse|reversal|cure|treatment|medicine|medicines|medication|medications)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase()) || "Wellness";
}

function isInternalBonusLabel(value: string) {
  return /\b(niche[-\s]?adaptive|system|internal|template|registry|developer)\b/i.test(value);
}

function isBonusLike(value: string) {
  return /\b(bonus|bonuses|free|included|registration includes|support tools|toolkit|tools|ticket)\b/i.test(value);
}

function sanitizeBonusPresentationCopy(
  value: string | undefined,
  fallback: string,
  profile: ReturnType<typeof getNicheProfile>,
  itemIndex?: number
) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return fallback;
  if (isInternalBonusLabel(trimmed) || isUnsafeHealthCopy(trimmed)) return fallback;
  if (hasWrongNicheBonusLeakage(trimmed, profile)) return fallback;
  if (typeof itemIndex === "number" && hasWrongServiceTitleLeakage(trimmed, itemIndex)) return fallback;
  return trimmed;
}

function hasWrongServiceTitleLeakage(value: string, itemIndex: number) {
  const normalized = value.toLowerCase();
  const fixedTitle = universalCoachBonuses[itemIndex]?.baseTitle.toLowerCase();
  const otherFixedTitles = universalCoachBonuses
    .filter((_, index) => index !== itemIndex)
    .map((bonus) => bonus.baseTitle.toLowerCase());
  const referencesOtherService =
    otherFixedTitles.some((title) => normalized.includes(title)) || /\b(golden cage|vision board video)\b/i.test(value);

  return referencesOtherService ? !fixedTitle || !normalized.includes(fixedTitle) : false;
}

function hasWrongNicheBonusLeakage(value: string, profile: ReturnType<typeof getNicheProfile>) {
  const normalized = value.toLowerCase();
  const specificNicheGroups = [
    {
      allowedKeys: ["metabolic"],
      pattern:
        /\b(hba1c|a1c|insulin(?:\s+resistance)?|egfr|blood\s+sugar|glucose|diabet(?:es|ic)?|sugar[-\s]?(?:aware|level|levels|spike|spikes)|metabolic)\b/i
    },
    {
      allowedKeys: ["pcos"],
      pattern:
        /\b(pcos|pcod|pmos|hormonal?|hormone[-\s]?(?:aware|friendly|supportive)|cycle patterns?|periods?|menstrual|ovulation|women'?s?\s+hormone)\b/i
    },
    {
      allowedKeys: ["gut"],
      pattern: /\b(gut|digestion|digestive|bloating|acidity|constipation|ibs)\b/i
    },
    {
      allowedKeys: ["sleep"],
      pattern: /\b(sleep|insomnia|bedtime|circadian|evening routines?|sleep routine|recovery rhythm)\b/i
    },
    {
      allowedKeys: ["fatLoss"],
      pattern: /\b(fat[-\s]?loss|weight[-\s]?loss|weight management|body composition|slimming)\b/i
    },
    {
      allowedKeys: ["fitness"],
      pattern: /\b(fitness|strength|strength training|workouts?|exercise training|performance habit|training rhythm)\b/i
    }
  ];
  if (/\b(only for women|women only|exclusively for women)\b/i.test(normalized) && !profile.allowsWomenOnlyCopy) {
    return true;
  }

  return specificNicheGroups.some(
    (group) => group.pattern.test(normalized) && !group.allowedKeys.includes(profile.key)
  );
}

function getNicheProfile(site: PublicCoachSiteRecord) {
  const niche = getCanonicalCoachNiche(site);
  const haystack = [
    niche,
    site.bio,
    site.vision,
    site.content.heroHeadline,
    site.content.subheadline,
    site.content.coachIntro,
    site.content.problemHeading,
    site.content.problemPoints.join(" "),
    site.content.journeyHeading
  ].join(" ").toLowerCase();
  const audienceContext = [niche, site.bio, site.vision].join(" ").toLowerCase();
  const allowsWomenOnlyCopy = /\b(women|woman|female|pcos|pcod|pmos|hormone|hormonal)\b/.test(
    audienceContext
  );

  const profiles = [
    {
      key: "pcos",
      keys: ["pcos", "pcod", "pmos", "hormone", "hormonal", "cycle", "women wellness", "women's wellness"],
      label: "Hormone Wellness",
      themes: "food rhythm, stress awareness, recovery, mindset, and everyday lifestyle habits",
      descriptions: [
        "Access wellness and progress tools to understand lifestyle markers, cycle patterns, habits, and body-awareness trends.",
        "Join support sessions to stay consistent with food rhythm, stress awareness, sleep, movement, and everyday hormone-supportive habits.",
        "Access hormone-friendly lifestyle checklists, habit trackers, food-rhythm tools, and daily consistency resources."
      ]
    },
    {
      key: "metabolic",
      keys: ["diabet", "metabolic", "blood sugar", "insulin", "glucose"],
      label: "Metabolic Wellness",
      themes: "food choices, routine consistency, energy, movement, and everyday metabolic awareness",
      descriptions: [
        "Access calculators such as HbA1c, Insulin Resistance, eGFR, BMI, and BMR where relevant, helping you understand key wellness markers and track your progress.",
        "Join support sessions to stay consistent with food rhythm, activity, energy, and lifestyle habits while staying guided and motivated.",
        "Access sugar-aware lifestyle checklists, meal-rhythm tools, habit guides, and consistency resources for day-to-day implementation."
      ]
    },
    {
      key: "gut",
      keys: ["gut", "digestion", "digestive", "bloating", "acidity", "constipation"],
      label: "Gut Wellness",
      themes: "food rhythm, digestion awareness, routine tracking, and calmer daily habits",
      descriptions: [
        "Access habit and symptom-awareness tools to notice food rhythm, digestion patterns, and daily wellness trends.",
        "Join support sessions to stay consistent with digestion-friendly routines, meal rhythm, stress awareness, and practical lifestyle habits.",
        "Access gut-friendly checklists, food-rhythm tools, daily tracking resources, and practical habit guides."
      ]
    },
    {
      key: "sleep",
      keys: ["sleep", "recovery", "rest", "insomnia", "evening routine"],
      label: "Sleep Recovery",
      themes: "evening routine, stress regulation, recovery habits, and better daily rhythm",
      descriptions: [
        "Access sleep routine trackers, recovery reflection tools, and daily habit resources to understand patterns over time.",
        "Join support sessions to stay consistent with evening routines, stress awareness, recovery habits, and lifestyle rhythm.",
        "Access sleep-friendly checklists, routine builders, relaxation planning tools, and daily consistency guides."
      ]
    },
    {
      key: "fatLoss",
      keys: ["fat loss", "weight loss", "weight management", "slim", "body composition"],
      label: "Fat-Loss Habit",
      themes: "meal rhythm, activity consistency, mindset, and sustainable habit-building",
      descriptions: [
        "Access BMI, BMR, habit tracking, progress checklists, and lifestyle tools to understand your wellness journey clearly.",
        "Join support sessions to stay consistent with meal rhythm, movement, planning, motivation, and sustainable habits.",
        "Access meal-planning checklists, activity habit tools, progress reflection guides, and daily consistency resources."
      ]
    },
    {
      key: "fitness",
      keys: ["fitness", "strength", "workout", "exercise", "movement", "training"],
      label: "Strength & Consistency",
      themes: "training rhythm, movement consistency, recovery, and long-term motivation",
      descriptions: [
        "Access BMI/BMR, performance habit trackers, routine checklists, and progress tools to support your consistency.",
        "Join support sessions to stay consistent with movement, recovery, routine-building, motivation, and lifestyle rhythm.",
        "Access workout habit checklists, recovery planning tools, routine trackers, and daily consistency guides."
      ]
    },
    {
      key: "general",
      keys: ["general wellness", "lifestyle wellness"],
      label: "Wellness",
      themes: "daily habits, mindset, food rhythm, movement, and simple lifestyle consistency",
      descriptions: [
        "Access useful health calculators and progress tools to better understand wellness indicators and track your journey over time.",
        "Join guided support sessions to stay consistent, informed, motivated, and supported throughout your wellness journey.",
        "Access practical lifestyle checklists, habit-building tools, implementation guides, and daily consistency resources."
      ]
    }
  ];
  const explicitNiche = niche.toLowerCase();
  const explicitMatch = profiles.find((profile) => profile.keys.some((key) => explicitNiche.includes(key)));
  const matched =
    explicitMatch ||
    (!explicitNiche ? profiles.find((profile) => profile.keys.some((key) => haystack.includes(key))) : undefined);
  const label = matched?.label || toTitleCase(getShortNicheLabel(niche));
  const themes =
    matched?.themes ||
    `${label.toLowerCase()} clarity, habit consistency, personal reflection, and everyday wellness direction`;
  const descriptions = matched?.descriptions || profiles[profiles.length - 1].descriptions;

  return {
    allowsWomenOnlyCopy,
    descriptions,
    eyebrow: "Included Free",
    heading: "Your Registration Includes Free Wellness Support Tools",
    key: matched?.key || "general",
    label,
    subheading: `Practical tools to support ${themes}. Built to feel useful from the moment you register.`,
    ctaHelperText:
      "Register to unlock these support tools with your coach registration. Takes less than 1 minute.",
  };
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === "&" ? word : `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(" ");
}

function isUnsafeHealthCopy(value: string) {
  return /\b(cure|guarantee(?:d)?|reverse(?:d|s)?|reversal|without medicines?|stop(?:ping)? medicines?|diagnos(?:e|is)|treat(?:ment|s|ed)?|heal(?:s|ed|ing)? disease)\b/i.test(
    value
  );
}

export function getCanonicalLegalDisclaimer(site: PublicCoachSiteRecord) {
  return (
    site.content.footerText ||
    "This page is for wellness education and coaching support. It is not a substitute for medical advice, diagnosis, or treatment. Results vary based on individual context, health history, lifestyle, and consistency."
  );
}
