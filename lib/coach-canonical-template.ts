import type { PublicCoachSiteRecord } from "./admin-coach-sites";

export type UniversalCoachBonus = {
  assetType: "ebook" | "toolkit" | "video";
  baseDescription: string;
  baseTitle: string;
  id: string;
  valueLabel: string;
};

export type CanonicalCoachTemplateRule = {
  aiAdaptive: boolean;
  editableSlots: string[];
  enabled: boolean;
  lockedFields: string[];
  ruleKey: string;
  source: string;
};

export const CANONICAL_COACH_TEMPLATE_ID = "canonical-coach-site-template";

export const universalCoachBonuses: UniversalCoachBonus[] = [
  {
    assetType: "ebook",
    baseDescription:
      "A practical guide for building a healthier, more intentional lifestyle.",
    baseTitle: "Unlocking the Golden Cage",
    id: "golden-cage-book",
    valueLabel: "Worth Rs 3,200"
  },
  {
    assetType: "video",
    baseDescription:
      "A guided tool to help clients create clarity, motivation, and direction.",
    baseTitle: "Vision Board Video",
    id: "vision-board-video",
    valueLabel: "Worth Rs 3,200"
  }
];

export const canonicalCoachTemplateRules: CanonicalCoachTemplateRule[] = [
  {
    aiAdaptive: true,
    editableSlots: [
      "bonus.heading",
      "bonus.subheading",
      "bonus.items[].title",
      "bonus.items[].description",
      "bonus.ctaText"
    ],
    enabled: true,
    lockedFields: [
      "bonus.id",
      "bonus.actualAssetUrl",
      "bonus.actualValue",
      "legal.disclaimer",
      "cta.destination"
    ],
    ruleKey: "nicheAdaptiveBonusSection",
    source: "universalBonusRegistry"
  }
];

export function getCanonicalCoachName(site: PublicCoachSiteRecord) {
  return site.coachName?.trim() || "Coach";
}

export function getCanonicalCoachNiche(site: PublicCoachSiteRecord) {
  return site.niche?.trim() || "wellness";
}

export function getCanonicalRegisterLabel(site: PublicCoachSiteRecord) {
  const label = site.registerButtonText || site.content.ctaText || "Register For FREE";
  if (!isGenericCtaLabel(label) && !isUnsafeHealthCopy(label)) return label;

  return `Start My ${getShortNicheLabel(getCanonicalCoachNiche(site))} Journey`;
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
  const nicheProfile = getNicheProfile(getCanonicalCoachNiche(site));
  const customHeading = site.content.benefitsHeading || "";
  const customSectionIsBonus =
    isBonusLike(customHeading) || isBonusLike(site.content.benefitsSectionLabel || "");
  const customTitles = customSectionIsBonus ? site.content.benefits || [] : [];
  const customDescriptions = customSectionIsBonus ? site.content.benefitDescriptions || [] : [];
  const heading = isBonusLike(customHeading)
    ? customHeading
    : `Claim Your Free ${nicheProfile.label} Bonuses`;
  const subheading =
    customDescriptions.find((item) => item.length > 60) ||
    nicheProfile.subheading ||
    "Practical tools to support your lifestyle journey with more clarity, consistency, and daily direction.";

  return {
    ctaSupportCopy: "Free access unlocks with your registration.",
    ctaText: getCanonicalRegisterLabel(site),
    heading,
    items: universalCoachBonuses.map((bonus, index) => ({
      ...bonus,
      description:
        customDescriptions[index] ||
        nicheProfile.descriptions[index] ||
        bonus.baseDescription,
      title: customTitles[index] || nicheProfile.titles[index] || bonus.baseTitle
    })),
    ruleKey: "nicheAdaptiveBonusSection",
    subheading,
    totalValueLabel: "Total bonus value: Rs 6,400"
  };
}

export function getCanonicalHeroPackage(site: PublicCoachSiteRecord) {
  const coachName = getCanonicalCoachName(site);
  const niche = getCanonicalCoachNiche(site);
  const shortNiche = getShortNicheLabel(niche);
  const blueprintNiche = getBlueprintNicheLabel(niche);
  const storedHeadline = site.content.heroHeadline || "";
  const storedHighlight = site.content.heroTrustLine || "";
  const shouldUseTemplateHeadline = shouldCondenseHeroHeadline(storedHeadline);
  const headline = shouldUseTemplateHeadline ? `The ${blueprintNiche}` : storedHeadline;
  const highlight =
    shouldUseTemplateHeadline || isGenericHighlight(storedHighlight) || isUnsafeHealthCopy(storedHighlight)
      ? "Blueprint"
      : storedHighlight;
  const storedSubheadline = site.content.subheadline || "";
  const storedHelperText = site.content.heroMicroTrustText || "";
  const storedSupportLine = site.content.trustText || "";
  const subheadline =
    storedSubheadline && !shouldCondenseHeroSubheadline(storedSubheadline) && !isUnsafeHealthCopy(storedSubheadline)
      ? storedSubheadline
      : `A practical ${shortNiche.toLowerCase()} path with ${coachName}, built for clear next steps and consistent support.`;

  return {
    eyebrow: site.content.brandBadge || "YW Nutritech Circle",
    headline,
    helperText:
      (storedHelperText && !isUnsafeHealthCopy(storedHelperText) ? storedHelperText : "") ||
      "Fill a quick form and the coach support pathway will guide you to the next step.",
    highlight,
    subheadline,
    supportLine:
      (storedSupportLine && !isUnsafeHealthCopy(storedSupportLine) ? storedSupportLine : "") ||
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

function isGenericCtaLabel(value: string) {
  return /^(register|register now|register for free|start now|join now|submit|learn more)$/i.test(
    value.trim()
  );
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

function shouldCondenseHeroSubheadline(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return true;
  if (/\b(fixed-template|placeholder|template|lorem|insert here)\b/i.test(normalized)) return true;
  return normalized.length > 128 || normalized.split(" ").length > 20;
}

function isGenericHighlight(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "blueprint" ||
    normalized === "yw care lens" ||
    normalized === "coach referral"
  );
}

function getBlueprintNicheLabel(niche: string) {
  const normalized = niche.toLowerCase();
  if (/\b(pcos|pmos|hormone|hormonal|women|woman|female)\b/.test(normalized)) {
    return "Wellness";
  }
  if (/\b(diabet|sugar|insulin|glucose|metabolic)\b/.test(normalized)) {
    return "Metabolic Wellness";
  }

  const shortNiche = getShortNicheLabel(niche).split(/[\/|,;-]/)[0]?.trim() || "Wellness";
  const label = shortNiche;
  return label.length > 24 ? "Wellness" : label || "Wellness";
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

function isBonusLike(value: string) {
  return /\b(bonus|bonuses|free|claim|toolkit|guide|tools|ticket)\b/i.test(value);
}

function getNicheProfile(niche: string) {
  const label = getShortNicheLabel(niche);
  const lowercaseLabel = label.toLowerCase();

  return {
    descriptions: [
      `A practical guide to help clients reflect on routines, choices, and daily habits that support their ${lowercaseLabel} journey.`,
      `A guided video to help clients create clarity, motivation, and direction for their ${lowercaseLabel} goals.`
    ],
    label,
    subheading:
      `Practical tools to support ${lowercaseLabel} with more clarity, consistency, and daily direction.`,
    titles: [`${label} Lifestyle Guide`, "Vision Board Clarity Video"]
  };
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
