export const CANONICAL_COACH_TEMPLATE_THEME_ID = "canonical-coach-site-template" as const;
export const DEFAULT_COACH_TEMPLATE_THEME_ID = CANONICAL_COACH_TEMPLATE_THEME_ID;

export const COACH_TEMPLATE_THEME_IDS = [
  CANONICAL_COACH_TEMPLATE_THEME_ID,
  "editorial-wellness",
  "liquid-glass",
  "dark-luxury",
  "soft-feminine",
  "minimal-premium",
  "prism-aurora",
  "performance-energy",
  "creator-brand"
] as const;

export type ActiveCoachTemplateThemeId = (typeof COACH_TEMPLATE_THEME_IDS)[number];
export type CoachTemplateThemeId = ActiveCoachTemplateThemeId;

export type CoachTemplateSkinStatus =
  | "deprecated"
  | "draft"
  | "hidden"
  | "internal_testing"
  | "production_ready"
  | "qa_ready"
  | "visual_review";

export type CoachTemplateBackgroundType =
  | "aurora"
  | "grid-glow"
  | "light-rays"
  | "liquid-glass"
  | "mesh-gradient"
  | "none"
  | "noise-texture"
  | "particle-field"
  | "prism"
  | "spotlight"
  | "static-gradient"
  | "webgl-subtle";

export type CoachTemplateMotionLevel = "dynamic" | "none" | "soft";
export type CoachTemplateQaStatus = "fail" | "partial" | "pass";
export type CoachTemplateMotionPresetId =
  | "canonical-smooth"
  | "cinematic-glow"
  | "creator-profile-lift"
  | "editorial-fade"
  | "glass-shimmer"
  | "minimal-still"
  | "performance-snap"
  | "prism-drift"
  | "soft-float";

export type CoachTemplateVisualDifferenceCategory =
  | "backgroundType"
  | "bonusVariant"
  | "cardStyle"
  | "faqVariant"
  | "footerVariant"
  | "heroVariant"
  | "mediaTreatment"
  | "motionPreset"
  | "navbarVariant"
  | "sectionRhythm"
  | "stickyCtaVariant"
  | "typographyHierarchy";

export type CoachTemplateBackgroundConfig = {
  fallbackType: CoachTemplateBackgroundType;
  intensity: number;
  mobileIntensity: number;
  mobileOpacity: number;
  opacity: number;
  performanceMode: "disabled" | "standard" | "low";
  reducedMotionFallback: CoachTemplateBackgroundType;
  requiresReactBits: boolean;
  type: CoachTemplateBackgroundType;
};

export type CoachTemplateFeatureFlags = {
  enableCoachTemplateSkins: boolean;
  enableHeavyMotionBackgrounds: boolean;
  enableReactBitsBackgrounds: boolean;
  enableTemplateSkinDebugPanel: boolean;
  enableWebglBackgrounds: boolean;
};

export type CoachTemplateRegistryOptions = {
  featureFlags?: CoachTemplateFeatureFlags;
  includeInternal?: boolean;
};

export type CoachTemplateTheme = {
  id: ActiveCoachTemplateThemeId;
  name: string;
  publicName: string;
  previewLabel: string;
  description: string;
  mood: string;
  status: CoachTemplateSkinStatus;
  visibleInAdmin: boolean;
  visibleInShop: boolean;
  fallbackSkin: ActiveCoachTemplateThemeId;
  requiresMotion: boolean;
  requiresReactBits: boolean;
  mobileSafe: boolean;
  reducedMotionSafe: boolean;
  lastQAAt: string;
  qaStatus: CoachTemplateQaStatus;
  designStory: {
    bestFor: string[];
    emotionalFeel: string;
    firstImpressionGoal: string;
    notToLookLike: string;
    oneLine: string;
    sectionRhythm: string;
    shouldAvoid: string[];
    uniqueSignature: string;
    visualReferenceType: string;
  };
  skinDesignContract: {
    backgroundLanguage: string;
    bonusTreatment: string;
    cardLanguage: string;
    coachMediaTreatment: string;
    colorLanguage: string;
    ctaLanguage: string;
    faqTreatment: string;
    footerTreatment: string;
    heroComposition: string;
    motionLanguage: string;
    navbarLanguage: string;
    responsiveBehavior: string;
    stickyCtaLanguage: string;
    surfaceLanguage: string;
    typographyLanguage: string;
    visualMetaphor: string;
  };
  fonts: {
    body: string;
    heading: string;
  };
  colors: {
    accent: string;
    background: string;
    border: string;
    card: string;
    cardForeground: string;
    ctaGradient: string;
    foreground: string;
    glow: string;
    muted: string;
    primary: string;
    secondary: string;
  };
  tokens: {
    colors: Record<
      | "accentPrimary"
      | "accentSecondary"
      | "accentSoft"
      | "backgroundAccent"
      | "borderStrong"
      | "borderSubtle"
      | "ctaBackground"
      | "ctaHover"
      | "ctaText"
      | "danger"
      | "focusRing"
      | "link"
      | "pageBackground"
      | "success"
      | "surfaceElevated"
      | "surfaceGlass"
      | "surfacePrimary"
      | "surfaceSecondary"
      | "textMuted"
      | "textPrimary"
      | "textSecondary"
      | "warning",
      string
    >;
    motion: Record<
      | "ctaDuration"
      | "easingPremium"
      | "easingStandard"
      | "hoverDuration"
      | "reducedMotionBehavior"
      | "revealDuration"
      | "staggerDelay",
      string
    >;
    radius: Record<
      | "cardRadius"
      | "mediaRadius"
      | "radiusLarge"
      | "radiusMedium"
      | "radiusPill"
      | "radiusSmall"
      | "radiusXL",
      string
    >;
    shadow: Record<"glowPrimary" | "glowSecondary" | "insetHighlight" | "shadowMedium" | "shadowSoft" | "shadowStrong", string>;
    spacing: Record<
      | "cardGap"
      | "cardPadding"
      | "contentMaxWidth"
      | "heroPaddingY"
      | "narrowMaxWidth"
      | "pagePaddingX"
      | "sectionGap"
      | "sectionPaddingY"
      | "wideMaxWidth",
      string
    >;
    typography: Record<
      | "bodyFont"
      | "bodyLineHeight"
      | "bodySize"
      | "bodyWeight"
      | "displayFont"
      | "displayLineHeight"
      | "displaySize"
      | "displayStyle"
      | "displayWeight"
      | "h2Size"
      | "h3Size"
      | "headingFont"
      | "headingLineHeight"
      | "headingWeight"
      | "heroSize"
      | "labelFont"
      | "labelSize"
      | "letterSpacingDisplay"
      | "letterSpacingLabel"
      | "smallSize",
      string
    >;
  };
  background: CoachTemplateBackgroundConfig;
  layout: {
    benefitLayout: string;
    bonusVariant: string;
    cardStyle: string;
    coachMediaTreatment: string;
    ctaLayout: string;
    faqVariant: string;
    footerVariant: string;
    heroVariant: string;
    mediaTreatment: string;
    navbarVariant: string;
    sectionDividerStyle: string;
    sectionRhythm: string;
    stickyCtaVariant: string;
  };
  motion: {
    cardHover: string;
    ctaInteraction: string;
    level: CoachTemplateMotionLevel;
    preset: CoachTemplateMotionPresetId;
    reducedMotionFallback: string;
    sectionReveal: string;
  };
  effects: {
    animationMood: string;
    glass: boolean;
    glow: "medium" | "none" | "soft";
  };
  readiness: {
    adminInspect: CoachTemplateQaStatus;
    adminSelectorVisible: boolean;
    backgroundClickSafe: boolean;
    buildSafe: boolean;
    inspectSafe: boolean;
    mobileSafe: boolean;
    previewPublicParity: boolean;
    qaStatus: CoachTemplateQaStatus;
    reducedMotionSafe: boolean;
    shopInspect: CoachTemplateQaStatus;
    shopSelectorVisible: boolean;
    stickyCtaSafe: boolean;
  };
  previewThumbnail: {
    accent: string;
    cardShape: string;
    description: string;
    gradient: string;
  };
  visualDifference: {
    evidence: string;
    minChangedCategories: number;
    scores: Record<CoachTemplateVisualDifferenceCategory, 0 | 1 | 2 | 3>;
  };
  cssVars: Record<string, string>;
};

type BackgroundRegistryEntry = {
  id: CoachTemplateBackgroundType;
  label: string;
  allowedSkins: ActiveCoachTemplateThemeId[];
  defaultOpacity: number;
  fallback: CoachTemplateBackgroundType;
  mobileOpacity: number;
  mobileSafe: boolean | "conditional";
  notes: string;
  performanceRisk: "high" | "low" | "medium";
  pointerEventsNone: true;
  reducedMotionFallback: CoachTemplateBackgroundType;
  requiresClient: boolean;
  requiresReactBits: boolean;
  ssrSafe: boolean;
};

const sharedFonts = {
  heading: "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
  body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
};

const QA_DATE = "2026-06-27";
const DEFAULT_SPACING = {
  cardGap: "clamp(1rem, 2vw, 1.6rem)",
  cardPadding: "clamp(1.05rem, 2.2vw, 1.8rem)",
  contentMaxWidth: "1180px",
  heroPaddingY: "clamp(4rem, 8vw, 7.5rem)",
  narrowMaxWidth: "820px",
  pagePaddingX: "clamp(1rem, 4vw, 3rem)",
  sectionGap: "clamp(1.6rem, 3vw, 3rem)",
  sectionPaddingY: "clamp(3.8rem, 7vw, 6.5rem)",
  wideMaxWidth: "1360px"
};
const DEFAULT_MOTION_TOKENS = {
  ctaDuration: "180ms",
  easingPremium: "cubic-bezier(0.22, 1, 0.36, 1)",
  easingStandard: "ease",
  hoverDuration: "220ms",
  reducedMotionBehavior: "static backgrounds, no card translation, no shimmer loops",
  revealDuration: "520ms",
  staggerDelay: "36ms"
};
const DEFAULT_SHADOWS = {
  glowPrimary: "0 0 32px rgb(33 230 193 / 0.22)",
  glowSecondary: "0 0 28px rgb(216 181 74 / 0.18)",
  insetHighlight: "inset 0 1px 0 rgb(255 255 255 / 0.18)",
  shadowMedium: "0 1.1rem 3rem rgb(0 40 54 / 0.18)",
  shadowSoft: "0 0.8rem 2.2rem rgb(0 40 54 / 0.12)",
  shadowStrong: "0 1.6rem 4rem rgb(0 40 54 / 0.28)"
};
const DEFAULT_RADIUS = {
  cardRadius: "1rem",
  mediaRadius: "1.6rem",
  radiusLarge: "1.4rem",
  radiusMedium: "1rem",
  radiusPill: "999px",
  radiusSmall: "0.5rem",
  radiusXL: "2rem"
};

export const coachTemplateMotionPresets: Record<
  CoachTemplateMotionPresetId,
  {
    inspectModeBehavior: string;
    level: CoachTemplateMotionLevel;
    reducedMotionFallback: string;
  }
> = {
  "canonical-smooth": {
    inspectModeBehavior: "keep reveal state static and preserve slot outlines",
    level: "soft",
    reducedMotionFallback: "static canonical surfaces"
  },
  "cinematic-glow": {
    inspectModeBehavior: "disable hover glow translation while inspecting",
    level: "soft",
    reducedMotionFallback: "static dark spotlight"
  },
  "creator-profile-lift": {
    inspectModeBehavior: "profile cards stop lifting while edit targets are selected",
    level: "soft",
    reducedMotionFallback: "static profile glow"
  },
  "editorial-fade": {
    inspectModeBehavior: "slow reveal becomes instant while inspect mode is active",
    level: "soft",
    reducedMotionFallback: "static paper texture"
  },
  "glass-shimmer": {
    inspectModeBehavior: "glass shimmer and hover lifts freeze under inspect mode",
    level: "soft",
    reducedMotionFallback: "static mesh glass surfaces"
  },
  "minimal-still": {
    inspectModeBehavior: "already static; keep focus rings visible",
    level: "none",
    reducedMotionFallback: "no animated background"
  },
  "performance-snap": {
    inspectModeBehavior: "disable diagonal card movement while selecting content slots",
    level: "dynamic",
    reducedMotionFallback: "static grid glow"
  },
  "prism-drift": {
    inspectModeBehavior: "freeze glow drift and keep selected outlines above backgrounds",
    level: "dynamic",
    reducedMotionFallback: "static prism mesh"
  },
  "soft-float": {
    inspectModeBehavior: "floating shapes stop moving while editing",
    level: "soft",
    reducedMotionFallback: "static blush gradient"
  }
};

export const coachTemplateBackgroundRegistry: Record<CoachTemplateBackgroundType, BackgroundRegistryEntry> = {
  aurora: {
    id: "aurora",
    label: "Aurora",
    allowedSkins: ["liquid-glass", "soft-feminine", "prism-aurora"],
    defaultOpacity: 0.9,
    fallback: "mesh-gradient",
    mobileOpacity: 0.56,
    mobileSafe: "conditional",
    notes: "React Bits Aurora was inspected; this repo uses a CSS aurora fallback to avoid unsupported imports.",
    performanceRisk: "medium",
    pointerEventsNone: true,
    reducedMotionFallback: "mesh-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "grid-glow": {
    id: "grid-glow",
    label: "Grid Glow",
    allowedSkins: ["performance-energy"],
    defaultOpacity: 0.86,
    fallback: "static-gradient",
    mobileOpacity: 0.5,
    mobileSafe: true,
    notes: "CSS-only energy lines; decorative and non-interactive.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "light-rays": {
    id: "light-rays",
    label: "Light Rays",
    allowedSkins: ["dark-luxury"],
    defaultOpacity: 0.84,
    fallback: "spotlight",
    mobileOpacity: 0.52,
    mobileSafe: true,
    notes: "CSS ray/vignette treatment for dark luxury without WebGL.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "spotlight",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "liquid-glass": {
    id: "liquid-glass",
    label: "Liquid Glass",
    allowedSkins: ["liquid-glass"],
    defaultOpacity: 0.92,
    fallback: "aurora",
    mobileOpacity: 0.58,
    mobileSafe: "conditional",
    notes: "CSS glass light field; no direct React Bits runtime dependency.",
    performanceRisk: "medium",
    pointerEventsNone: true,
    reducedMotionFallback: "mesh-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "mesh-gradient": {
    id: "mesh-gradient",
    label: "Mesh Gradient",
    allowedSkins: ["canonical-coach-site-template", "liquid-glass", "soft-feminine", "creator-brand"],
    defaultOpacity: 0.9,
    fallback: "static-gradient",
    mobileOpacity: 0.62,
    mobileSafe: true,
    notes: "CSS radial mesh fallback chain.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  none: {
    id: "none",
    label: "None",
    allowedSkins: [],
    defaultOpacity: 0,
    fallback: "none",
    mobileOpacity: 0,
    mobileSafe: true,
    notes: "Disabled decorative background.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "none",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "noise-texture": {
    id: "noise-texture",
    label: "Noise Texture",
    allowedSkins: ["editorial-wellness", "minimal-premium"],
    defaultOpacity: 0.54,
    fallback: "static-gradient",
    mobileOpacity: 0.4,
    mobileSafe: true,
    notes: "CSS paper/noise texture without external image dependency.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "particle-field": {
    id: "particle-field",
    label: "Particle Field",
    allowedSkins: ["dark-luxury", "prism-aurora"],
    defaultOpacity: 0.36,
    fallback: "static-gradient",
    mobileOpacity: 0.18,
    mobileSafe: "conditional",
    notes: "Not enabled as a primary production skin background to avoid mobile CPU risk.",
    performanceRisk: "medium",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  prism: {
    id: "prism",
    label: "Prism",
    allowedSkins: ["dark-luxury", "prism-aurora"],
    defaultOpacity: 0.88,
    fallback: "mesh-gradient",
    mobileOpacity: 0.52,
    mobileSafe: "conditional",
    notes: "React Bits Prism was found in docs; production uses CSS prism fallback for SSR safety.",
    performanceRisk: "medium",
    pointerEventsNone: true,
    reducedMotionFallback: "mesh-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  spotlight: {
    id: "spotlight",
    label: "Spotlight",
    allowedSkins: ["dark-luxury", "creator-brand"],
    defaultOpacity: 0.88,
    fallback: "static-gradient",
    mobileOpacity: 0.56,
    mobileSafe: true,
    notes: "CSS radial spotlight and vignette.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "static-gradient": {
    id: "static-gradient",
    label: "Static Gradient",
    allowedSkins: ["canonical-coach-site-template", "editorial-wellness", "minimal-premium"],
    defaultOpacity: 0.7,
    fallback: "static-gradient",
    mobileOpacity: 0.52,
    mobileSafe: true,
    notes: "Lowest-risk fallback for all skins.",
    performanceRisk: "low",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: false,
    requiresReactBits: false,
    ssrSafe: true
  },
  "webgl-subtle": {
    id: "webgl-subtle",
    label: "WebGL Subtle",
    allowedSkins: [],
    defaultOpacity: 0.42,
    fallback: "mesh-gradient",
    mobileOpacity: 0.2,
    mobileSafe: "conditional",
    notes: "Known available via local Grainient/OGL component, but not production-enabled for coach skins.",
    performanceRisk: "high",
    pointerEventsNone: true,
    reducedMotionFallback: "static-gradient",
    requiresClient: true,
    requiresReactBits: false,
    ssrSafe: false
  }
};

export function isKnownCoachTemplateBackgroundType(
  value: unknown
): value is CoachTemplateBackgroundType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(coachTemplateBackgroundRegistry, value)
  );
}

function createColorTokens(theme: {
  colors: CoachTemplateTheme["colors"];
}) {
  return {
    accentPrimary: theme.colors.accent,
    accentSecondary: theme.colors.secondary,
    accentSoft: theme.colors.glow,
    backgroundAccent: theme.colors.primary,
    borderStrong: theme.colors.border,
    borderSubtle: theme.colors.border,
    ctaBackground: theme.colors.ctaGradient,
    ctaHover: theme.colors.secondary,
    ctaText: theme.colors.cardForeground,
    danger: "#b42318",
    focusRing: theme.colors.accent,
    link: theme.colors.secondary,
    pageBackground: theme.colors.background,
    success: "#11845b",
    surfaceElevated: theme.colors.card,
    surfaceGlass: theme.colors.card,
    surfacePrimary: theme.colors.card,
    surfaceSecondary: theme.colors.muted,
    textMuted: theme.colors.muted,
    textPrimary: theme.colors.foreground,
    textSecondary: theme.colors.primary,
    warning: "#b7791f"
  };
}

function createTypographyTokens(theme: {
  fonts?: typeof sharedFonts;
  layout: Pick<CoachTemplateTheme["layout"], "sectionRhythm">;
  typographyStyle: string;
}) {
  const compact = theme.layout.sectionRhythm.includes("compact");
  const spacious = theme.layout.sectionRhythm.includes("spacious") || theme.layout.sectionRhythm.includes("editorial");

  return {
    bodyFont: sharedFonts.body,
    bodyLineHeight: spacious ? "1.75" : "1.62",
    bodySize: "clamp(0.96rem, 1.2vw, 1.06rem)",
    bodyWeight: "400",
    displayFont: sharedFonts.heading,
    displayLineHeight: compact ? "0.98" : "1.04",
    displaySize: compact ? "clamp(2.5rem, 5.8vw, 5.4rem)" : "clamp(2.8rem, 6.4vw, 6.2rem)",
    displayStyle: theme.typographyStyle,
    displayWeight: compact ? "800" : "700",
    h2Size: "clamp(2rem, 4vw, 4.2rem)",
    h3Size: "clamp(1.15rem, 2vw, 1.55rem)",
    headingFont: sharedFonts.heading,
    headingLineHeight: "1.08",
    headingWeight: compact ? "800" : "700",
    heroSize: spacious ? "clamp(3.1rem, 7vw, 7.1rem)" : "clamp(2.7rem, 6vw, 6rem)",
    labelFont: sharedFonts.body,
    labelSize: "0.78rem",
    letterSpacingDisplay: "0",
    letterSpacingLabel: "0.08em",
    smallSize: "0.86rem"
  };
}

function createSkin(theme: Omit<CoachTemplateTheme, "fallbackSkin" | "fonts" | "lastQAAt" | "mobileSafe" | "qaStatus" | "reducedMotionSafe" | "requiresMotion" | "requiresReactBits" | "status" | "tokens" | "visibleInAdmin" | "visibleInShop"> & {
  typographyStyle: string;
}): CoachTemplateTheme {
  const status: CoachTemplateSkinStatus = theme.readiness.qaStatus === "pass" ? "production_ready" : "visual_review";

  return {
    ...theme,
    fallbackSkin: CANONICAL_COACH_TEMPLATE_THEME_ID,
    fonts: sharedFonts,
    lastQAAt: QA_DATE,
    mobileSafe: theme.readiness.mobileSafe,
    qaStatus: theme.readiness.qaStatus,
    reducedMotionSafe: theme.readiness.reducedMotionSafe,
    requiresMotion: theme.motion.level !== "none",
    requiresReactBits: theme.background.requiresReactBits,
    status,
    tokens: {
      colors: createColorTokens(theme),
      motion: DEFAULT_MOTION_TOKENS,
      radius: DEFAULT_RADIUS,
      shadow: DEFAULT_SHADOWS,
      spacing: DEFAULT_SPACING,
      typography: createTypographyTokens(theme)
    },
    visibleInAdmin: status === "production_ready" && theme.readiness.adminSelectorVisible,
    visibleInShop: status === "production_ready" && theme.readiness.shopSelectorVisible
  };
}

function ready(): CoachTemplateTheme["readiness"] {
  return {
    adminInspect: "pass",
    adminSelectorVisible: true,
    backgroundClickSafe: true,
    buildSafe: true,
    inspectSafe: true,
    mobileSafe: true,
    previewPublicParity: true,
    qaStatus: "pass",
    reducedMotionSafe: true,
    shopInspect: "pass",
    shopSelectorVisible: true,
    stickyCtaSafe: true
  };
}

function scores(value: 0 | 1 | 2 | 3): Record<CoachTemplateVisualDifferenceCategory, 0 | 1 | 2 | 3> {
  return {
    backgroundType: value,
    bonusVariant: value,
    cardStyle: value,
    faqVariant: value,
    footerVariant: value,
    heroVariant: value,
    mediaTreatment: value,
    motionPreset: value,
    navbarVariant: value,
    sectionRhythm: value,
    stickyCtaVariant: value,
    typographyHierarchy: value
  };
}

export const coachTemplateThemes: CoachTemplateTheme[] = [
  createSkin({
    id: CANONICAL_COACH_TEMPLATE_THEME_ID,
    name: "Default Canonical",
    publicName: "Default Canonical",
    previewLabel: "Default",
    description:
      "The protected YW Nutritech coach-site design. This remains the default and rollback skin.",
    mood: "Allia-inspired teal wellness-tech with glass navigation and premium coach-first sections.",
    designStory: {
      bestFor: ["all coaches", "fallback", "unknown template IDs"],
      emotionalFeel: "stable, clear, premium, operationally safe",
      firstImpressionGoal: "a safe canonical YW coach website",
      notToLookLike: "experimental variant",
      oneLine: "Protected canonical coach-site renderer and rollback skin.",
      sectionRhythm: "balanced canonical rhythm",
      shouldAvoid: ["risky motion", "layout experiments", "business logic changes"],
      uniqueSignature: "Allia-style teal glass surfaces with the known stable section flow.",
      visualReferenceType: "canonical YW Nutritech coach page"
    },
    skinDesignContract: {
      backgroundLanguage: "safe mesh gradient with Allia teal/mint depth",
      bonusTreatment: "canonical three-card smart bonus grid",
      cardLanguage: "rounded glass cards with readable dark surfaces",
      coachMediaTreatment: "canonical cutout or framed coach media",
      colorLanguage: "teal, mint, deep wellness navy, champagne accent",
      ctaLanguage: "teal gradient Register CTA with clear icon",
      faqTreatment: "canonical card accordion",
      footerTreatment: "canonical branded legal footer",
      heroComposition: "existing canonical hero composition",
      motionLanguage: "smooth Allia-style reveal and pointer-reactive background",
      navbarLanguage: "glass sticky navbar from section registry",
      responsiveBehavior: "existing responsive canonical layout",
      stickyCtaLanguage: "canonical sticky Register CTA",
      surfaceLanguage: "glass wellness-tech surfaces",
      typographyLanguage: "safe premium sans hierarchy",
      visualMetaphor: "stable YW coach platform template"
    },
    colors: {
      background: "#f4f8fa",
      foreground: "#07100c",
      primary: "#062f38",
      secondary: "#0b7f7b",
      accent: "#d8b54a",
      muted: "#d0f5f0",
      card: "rgb(5 40 46 / 0.9)",
      cardForeground: "#f4fffb",
      border: "rgb(208 245 240 / 0.38)",
      ctaGradient: "linear-gradient(90deg, #062f38, #18c8bc)",
      glow: "rgb(33 230 193 / 0.32)"
    },
    background: {
      fallbackType: "static-gradient",
      intensity: 0.9,
      mobileIntensity: 0.72,
      mobileOpacity: 0.62,
      opacity: 1,
      performanceMode: "standard",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "mesh-gradient"
    },
    layout: {
      benefitLayout: "canonicalCards",
      bonusVariant: "canonicalBonusCards",
      cardStyle: "canonicalGlassCard",
      coachMediaTreatment: "canonicalFrame",
      ctaLayout: "canonicalCta",
      faqVariant: "canonicalAccordion",
      footerVariant: "canonicalFooter",
      heroVariant: "canonicalHero",
      mediaTreatment: "canonicalFrame",
      navbarVariant: "canonicalGlassNav",
      sectionDividerStyle: "canonicalSoftBands",
      sectionRhythm: "canonical-balanced",
      stickyCtaVariant: "canonicalStickyCta"
    },
    motion: {
      cardHover: "soft lift",
      ctaInteraction: "icon slide and gradient response",
      level: "soft",
      preset: "canonical-smooth",
      reducedMotionFallback: "static canonical surfaces",
      sectionReveal: "smooth reveal"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "smooth Allia-style gradient motion"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#18c8bc",
      cardShape: "rounded glass",
      description: "Teal glass canonical hero with stable cards.",
      gradient: "linear-gradient(135deg, #062f38, #18c8bc)"
    },
    visualDifference: {
      evidence: "Default is the comparison baseline, not an anti-clone variant.",
      minChangedCategories: 0,
      scores: scores(0)
    },
    typographyStyle: "canonical wellness-tech",
    cssVars: {
      "--yw-theme-1": "#cdf0e8",
      "--yw-theme-2": "#21e6c1",
      "--yw-theme-3": "#153747",
      "--yw-theme-accent": "#d8b54a",
      "--yw-theme-ink": "#07100c",
      "--yw-theme-card": "rgb(5 40 46 / 0.88)",
      "--yw-theme-card-border": "rgb(208 245 240 / 0.38)",
      "--yw-theme-cta": "linear-gradient(90deg, #062f38, #18c8bc)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(6 47 56 / 0.72), rgb(11 81 96 / 0.52))"
    }
  }),
  createSkin({
    id: "editorial-wellness",
    name: "Editorial Wellness",
    publicName: "Editorial Wellness Journey",
    previewLabel: "Editorial",
    description:
      "Ivory, teal, and champagne editorial styling over the same canonical coach-site structure.",
    mood: "Calm premium wellness publication with spacious cards and subtle gold details.",
    designStory: {
      bestFor: ["lifestyle", "gut health", "sleep", "stress", "PCOS when copy supports it", "general wellness"],
      emotionalFeel: "calm, human, refined, trustworthy",
      firstImpressionGoal: "a premium wellness magazine feature for the coach",
      notToLookLike: "default template recolored ivory",
      oneLine: "A calm editorial wellness page with magazine-style rhythm.",
      sectionRhythm: "editorial-spacious line-separated sections",
      shouldAvoid: ["dashboard feel", "heavy aurora", "fake magazine testimonials"],
      uniqueSignature: "large editorial hero, portrait frame, thin-line sections, paper texture.",
      visualReferenceType: "premium wellness publication"
    },
    skinDesignContract: {
      backgroundLanguage: "soft ivory gradient wash with paper/noise texture",
      bonusTreatment: "premium booklet/video/toolkit insert cards",
      cardLanguage: "thin-line cream cards with quiet shadow and border glow",
      coachMediaTreatment: "magazine portrait frame with cream border",
      colorLanguage: "warm ivory, deep teal, champagne, muted rose",
      ctaLanguage: "refined invitation CTA in teal/champagne",
      faqTreatment: "line accordion with editorial spacing",
      footerTreatment: "minimal magazine-style footer",
      heroComposition: "editorial title block and portrait feature",
      motionLanguage: "slow fade and subtle upward reveal",
      navbarLanguage: "thin editorial glass navbar",
      responsiveBehavior: "title first, portrait second, clean stacked cards on mobile",
      stickyCtaLanguage: "elegant bottom invitation bar",
      surfaceLanguage: "paper, cream glass, thin separators",
      typographyLanguage: "large editorial headings with generous line height",
      visualMetaphor: "wellness magazine coach feature"
    },
    colors: {
      background: "#fbf6ee",
      foreground: "#15130e",
      primary: "#0d4b4d",
      secondary: "#c46b4b",
      accent: "#c29b35",
      muted: "#5f6f6b",
      card: "rgb(255 249 239 / 0.92)",
      cardForeground: "#15130e",
      border: "rgb(194 155 53 / 0.32)",
      ctaGradient: "linear-gradient(90deg, #0d4b4d, #c29b35)",
      glow: "rgb(194 155 53 / 0.24)"
    },
    background: {
      fallbackType: "static-gradient",
      intensity: 0.6,
      mobileIntensity: 0.45,
      mobileOpacity: 0.42,
      opacity: 0.68,
      performanceMode: "low",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "noise-texture"
    },
    layout: {
      benefitLayout: "editorialRows",
      bonusVariant: "editorialProductCards",
      cardStyle: "editorialLineCard",
      coachMediaTreatment: "editorialPortraitFrame",
      ctaLayout: "editorialInvitationCta",
      faqVariant: "lineAccordion",
      footerVariant: "editorialFooter",
      heroVariant: "editorialHero",
      mediaTreatment: "editorialPortraitFrame",
      navbarVariant: "editorialThinNav",
      sectionDividerStyle: "thinEditorialRule",
      sectionRhythm: "editorial-spacious",
      stickyCtaVariant: "editorialInvitationBar"
    },
    motion: {
      cardHover: "border glow and tiny shadow deepen",
      ctaInteraction: "calm underline shine",
      level: "soft",
      preset: "editorial-fade",
      reducedMotionFallback: "static paper texture",
      sectionReveal: "slow fade"
    },
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "quiet editorial wash"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#c29b35",
      cardShape: "thin ivory editorial cards",
      description: "Magazine portrait, paper background, champagne CTA.",
      gradient: "linear-gradient(135deg, #fbf6ee, #0d4b4d 70%, #c29b35)"
    },
    visualDifference: {
      evidence:
        "Editorial uses paper texture, portrait frame, line accordions, insert-style bonuses, and slow editorial rhythm instead of canonical glass blocks.",
      minChangedCategories: 8,
      scores: {
        ...scores(3),
        motionPreset: 2,
        stickyCtaVariant: 2
      }
    },
    typographyStyle: "editorial",
    cssVars: {
      "--yw-theme-1": "#fbf6ee",
      "--yw-theme-2": "#cdece3",
      "--yw-theme-3": "#0d4b4d",
      "--yw-theme-accent": "#c29b35",
      "--yw-theme-ink": "#15130e",
      "--yw-theme-card": "rgb(255 249 239 / 0.9)",
      "--yw-theme-card-border": "rgb(194 155 53 / 0.32)",
      "--yw-theme-cta": "linear-gradient(90deg, #0d4b4d, #c29b35)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(13 75 77 / 0.68), rgb(34 83 80 / 0.42))"
    }
  }),
  createSkin({
    id: "liquid-glass",
    name: "Liquid Glass",
    publicName: "Liquid Glass Health-Tech",
    previewLabel: "Liquid Glass",
    description:
      "Frosted-glass aqua and violet styling with a lightweight aurora background.",
    mood: "Health-tech glass, soft glow, and translucent UI surfaces.",
    designStory: {
      bestFor: ["metabolic", "diabetes lifestyle", "nutrition", "fitness", "progress-oriented coaching"],
      emotionalFeel: "modern, luminous, clear, polished",
      firstImpressionGoal: "premium Apple/Framer-style health-tech interface",
      notToLookLike: "default template with transparent cards",
      oneLine: "A frosted glass wellness technology interface.",
      sectionRhythm: "wide layered glass panels",
      shouldAvoid: ["fake metrics", "unreadable glass", "heavy blur on mobile"],
      uniqueSignature: "aurora mesh, translucent shell, glass product modules.",
      visualReferenceType: "premium health-tech product page"
    },
    skinDesignContract: {
      backgroundLanguage: "aurora/mesh gradient with low-opacity glow and static fallback",
      bonusTreatment: "digital product tiles inside glass modules",
      cardLanguage: "floating translucent cards with luminous borders",
      coachMediaTreatment: "cutout or framed photo inside a frosted glass capsule",
      colorLanguage: "deep blue, aqua, violet, soft champagne",
      ctaLanguage: "luminous aqua glass CTA",
      faqTreatment: "glass accordion panels",
      footerTreatment: "translucent glass footer",
      heroComposition: "layered glass hero shell with media panel and floating details",
      motionLanguage: "glass shimmer, soft lift, subtle aurora drift",
      navbarLanguage: "frosted capsule navbar",
      responsiveBehavior: "reduce blur and stack glass panels on mobile",
      stickyCtaLanguage: "frosted bottom CTA pill",
      surfaceLanguage: "frosted glass and crisp translucent borders",
      typographyLanguage: "crisp SaaS hierarchy",
      visualMetaphor: "transparent health-tech interface"
    },
    colors: {
      background: "#edfaff",
      foreground: "#081d28",
      primary: "#055f72",
      secondary: "#6557d2",
      accent: "#64f4de",
      muted: "#6e8391",
      card: "rgb(232 255 252 / 0.42)",
      cardForeground: "#081d28",
      border: "rgb(100 244 222 / 0.44)",
      ctaGradient: "linear-gradient(90deg, #055f72, #20dfbf)",
      glow: "rgb(101 87 210 / 0.28)"
    },
    background: {
      fallbackType: "mesh-gradient",
      intensity: 0.92,
      mobileIntensity: 0.58,
      mobileOpacity: 0.56,
      opacity: 0.9,
      performanceMode: "standard",
      reducedMotionFallback: "mesh-gradient",
      requiresReactBits: false,
      type: "aurora"
    },
    layout: {
      benefitLayout: "glassCards",
      bonusVariant: "glassProductCards",
      cardStyle: "frostedGlassCard",
      coachMediaTreatment: "glassCapsule",
      ctaLayout: "glassCtaPanel",
      faqVariant: "glassAccordion",
      footerVariant: "glassFooter",
      heroVariant: "glassHero",
      mediaTreatment: "glassCapsule",
      navbarVariant: "glassCapsuleNav",
      sectionDividerStyle: "blurredGlassBands",
      sectionRhythm: "layered-glass-wide",
      stickyCtaVariant: "glassStickyPill"
    },
    motion: {
      cardHover: "soft glass lift",
      ctaInteraction: "luminous press glow",
      level: "soft",
      preset: "glass-shimmer",
      reducedMotionFallback: "static mesh glass",
      sectionReveal: "fade with glass lift"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "liquid aurora drift"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#64f4de",
      cardShape: "frosted glass capsule",
      description: "Aurora mesh with layered glass cards.",
      gradient: "linear-gradient(135deg, #055f72, #64f4de 55%, #6557d2)"
    },
    visualDifference: {
      evidence:
        "Liquid Glass changes the page to a layered translucent interface with aurora mesh, glass cards, glass FAQ, and glass CTA treatment.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "tech",
    cssVars: {
      "--yw-theme-1": "#e9fbff",
      "--yw-theme-2": "#64f4de",
      "--yw-theme-3": "#6557d2",
      "--yw-theme-accent": "#bafef3",
      "--yw-theme-ink": "#081d28",
      "--yw-theme-card": "rgb(6 67 78 / 0.72)",
      "--yw-theme-card-border": "rgb(186 254 243 / 0.46)",
      "--yw-theme-cta": "linear-gradient(90deg, #055f72, #20dfbf)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(5 95 114 / 0.56), rgb(101 87 210 / 0.34))"
    }
  }),
  createSkin({
    id: "dark-luxury",
    name: "Dark Luxury",
    publicName: "Dark Luxury Wellness",
    previewLabel: "Dark Luxury",
    description:
      "Deep navy wellness-luxury with champagne and rose accents, using the same renderer.",
    mood: "Premium dark coach brand with soft spotlight motion.",
    designStory: {
      bestFor: ["premium coach profiles", "fitness", "fat-loss", "personal brands", "high-ticket positioning"],
      emotionalFeel: "cinematic, premium, bold, high-value",
      firstImpressionGoal: "a dark luxury brand page",
      notToLookLike: "default template with black background",
      oneLine: "A cinematic dark luxury wellness page.",
      sectionRhythm: "cinematic contrast bands",
      shouldAvoid: ["cheap neon", "low contrast", "fake elite claims"],
      uniqueSignature: "spotlight portrait, champagne edges, dark product cards.",
      visualReferenceType: "dark luxury SaaS/wellness brand"
    },
    skinDesignContract: {
      backgroundLanguage: "dark spotlight/light-ray gradient with prism fallback",
      bonusTreatment: "dark premium digital product cards",
      cardLanguage: "dark elevated cards with champagne/rose borders",
      coachMediaTreatment: "spotlight cutout or dark portrait frame",
      colorLanguage: "black, navy, champagne, rose, violet",
      ctaLanguage: "high-contrast cinematic action CTA",
      faqTreatment: "dark accordion panels with separators",
      footerTreatment: "dark premium legal footer",
      heroComposition: "cinematic full-width hero with dramatic portrait",
      motionLanguage: "slow glow and spotlight fade",
      navbarLanguage: "dark translucent nav with champagne accents",
      responsiveBehavior: "reduce rays and preserve high contrast on mobile",
      stickyCtaLanguage: "dark premium glow CTA strip",
      surfaceLanguage: "dark glass, champagne edges, cinematic shadows",
      typographyLanguage: "bold cinematic headings with refined body copy",
      visualMetaphor: "elite dark wellness brand page"
    },
    colors: {
      background: "#05070b",
      foreground: "#fff8ee",
      primary: "#0d1624",
      secondary: "#bb6682",
      accent: "#e0bf64",
      muted: "#c8b7b7",
      card: "rgb(8 14 22 / 0.88)",
      cardForeground: "#fff8ee",
      border: "rgb(224 191 100 / 0.32)",
      ctaGradient: "linear-gradient(90deg, #07101d, #bb6682 58%, #e0bf64)",
      glow: "rgb(224 191 100 / 0.22)"
    },
    background: {
      fallbackType: "spotlight",
      intensity: 0.92,
      mobileIntensity: 0.62,
      mobileOpacity: 0.56,
      opacity: 0.88,
      performanceMode: "standard",
      reducedMotionFallback: "spotlight",
      requiresReactBits: false,
      type: "light-rays"
    },
    layout: {
      benefitLayout: "darkGlowCards",
      bonusVariant: "darkLuxuryProductCards",
      cardStyle: "darkGlowCard",
      coachMediaTreatment: "spotlightCutout",
      ctaLayout: "cinematicDarkCta",
      faqVariant: "darkAccordion",
      footerVariant: "darkFooter",
      heroVariant: "cinematicDarkHero",
      mediaTreatment: "spotlightCutout",
      navbarVariant: "darkLuxuryNav",
      sectionDividerStyle: "champagneVignette",
      sectionRhythm: "cinematic-contrast",
      stickyCtaVariant: "darkGlowStickyCta"
    },
    motion: {
      cardHover: "slow glow",
      ctaInteraction: "premium glow press",
      level: "soft",
      preset: "cinematic-glow",
      reducedMotionFallback: "static dark spotlight",
      sectionReveal: "spotlight fade"
    },
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "dark spotlight"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#e0bf64",
      cardShape: "dark champagne edged card",
      description: "Cinematic black canvas with gold/rose spotlight.",
      gradient: "linear-gradient(135deg, #05070b, #3a2338 56%, #e0bf64)"
    },
    visualDifference: {
      evidence:
        "Dark Luxury uses cinematic hero, dark cards, champagne separators, spotlight media, and a dark FAQ/footer system.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "luxury",
    cssVars: {
      "--yw-theme-1": "#05070b",
      "--yw-theme-2": "#0d3340",
      "--yw-theme-3": "#bb6682",
      "--yw-theme-accent": "#e0bf64",
      "--yw-theme-ink": "#fff8ee",
      "--yw-theme-card": "rgb(8 14 22 / 0.9)",
      "--yw-theme-card-border": "rgb(224 191 100 / 0.32)",
      "--yw-theme-cta": "linear-gradient(90deg, #07101d, #bb6682 58%, #e0bf64)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(8 14 22 / 0.78), rgb(52 28 48 / 0.54))"
    }
  }),
  createSkin({
    id: "soft-feminine",
    name: "Soft Feminine",
    publicName: "Soft Feminine Wellness",
    previewLabel: "Soft Feminine",
    description:
      "Blush, ivory, lavender, and champagne styling. Copy stays data-driven and never assumes women-only.",
    mood: "Gentle premium wellness with soft cards and warm highlights.",
    designStory: {
      bestFor: ["women's wellness when configured", "hormone/PCOS when configured", "sleep", "stress", "supportive wellness"],
      emotionalFeel: "soft, warm, supportive, premium",
      firstImpressionGoal: "a gentle premium supportive coach website",
      notToLookLike: "default template with pink colors",
      oneLine: "A warm organic wellness visual system without gendered copy assumptions.",
      sectionRhythm: "soft airy organic rhythm",
      shouldAvoid: ["hardcoded women-only copy", "harsh tech backgrounds", "aggressive claims"],
      uniqueSignature: "organic frames, blush gradients, warm rounded bonus cards.",
      visualReferenceType: "soft premium wellness"
    },
    skinDesignContract: {
      backgroundLanguage: "soft gradient blobs and warm light",
      bonusTreatment: "gentle product cards with warm visuals",
      cardLanguage: "plush rounded cards with warm shadow",
      coachMediaTreatment: "organic rounded frame with gentle glow",
      colorLanguage: "blush, ivory, lavender, champagne, mauve",
      ctaLanguage: "warm rose/champagne invitation",
      faqTreatment: "soft rounded accordion panels",
      footerTreatment: "warm calm footer",
      heroComposition: "organic hero with rounded media and gentle CTA",
      motionLanguage: "gentle float and soft reveal",
      navbarLanguage: "soft rounded nav",
      responsiveBehavior: "simplify blobs and stack softly on mobile",
      stickyCtaLanguage: "soft rounded warm CTA bar",
      surfaceLanguage: "soft organic cards and warm gradients",
      typographyLanguage: "warm rounded heading hierarchy",
      visualMetaphor: "supportive wellness sanctuary"
    },
    colors: {
      background: "#fff5f8",
      foreground: "#261622",
      primary: "#743c6d",
      secondary: "#e79bb9",
      accent: "#d6ae5d",
      muted: "#7b6673",
      card: "rgb(255 251 247 / 0.9)",
      cardForeground: "#261622",
      border: "rgb(231 155 185 / 0.32)",
      ctaGradient: "linear-gradient(90deg, #743c6d, #e79bb9 62%, #d6ae5d)",
      glow: "rgb(231 155 185 / 0.28)"
    },
    background: {
      fallbackType: "mesh-gradient",
      intensity: 0.72,
      mobileIntensity: 0.48,
      mobileOpacity: 0.48,
      opacity: 0.74,
      performanceMode: "low",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "mesh-gradient"
    },
    layout: {
      benefitLayout: "softRoundedCards",
      bonusVariant: "softBonusCards",
      cardStyle: "softOrganicCard",
      coachMediaTreatment: "softOrganicFrame",
      ctaLayout: "softWarmCta",
      faqVariant: "softAccordion",
      footerVariant: "softFooter",
      heroVariant: "softOrganicHero",
      mediaTreatment: "softOrganicFrame",
      navbarVariant: "softRoundedNav",
      sectionDividerStyle: "organicBlobDivider",
      sectionRhythm: "soft-airy-organic",
      stickyCtaVariant: "softWarmStickyCta"
    },
    motion: {
      cardHover: "gentle float",
      ctaInteraction: "soft press",
      level: "soft",
      preset: "soft-float",
      reducedMotionFallback: "static blush gradient",
      sectionReveal: "soft reveal"
    },
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "soft blush gradient"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#e79bb9",
      cardShape: "organic rounded cards",
      description: "Blush organic hero with warm CTA.",
      gradient: "linear-gradient(135deg, #fff5f8, #e79bb9 58%, #d6ae5d)"
    },
    visualDifference: {
      evidence:
        "Soft Feminine changes silhouette through organic hero, rounded warm cards, soft FAQ panels, warm sticky CTA, and blush mesh background.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "soft wellness",
    cssVars: {
      "--yw-theme-1": "#fff5f8",
      "--yw-theme-2": "#f2d8ef",
      "--yw-theme-3": "#8d5eaa",
      "--yw-theme-accent": "#d6ae5d",
      "--yw-theme-ink": "#261622",
      "--yw-theme-card": "rgb(255 251 247 / 0.9)",
      "--yw-theme-card-border": "rgb(231 155 185 / 0.32)",
      "--yw-theme-cta": "linear-gradient(90deg, #743c6d, #e79bb9 62%, #d6ae5d)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(116 60 109 / 0.58), rgb(231 155 185 / 0.36))"
    }
  }),
  createSkin({
    id: "minimal-premium",
    name: "Minimal Premium",
    publicName: "Minimal Premium Clarity",
    previewLabel: "Minimal",
    description:
      "Restrained whitespace-heavy visual skin with static texture and minimal motion.",
    mood: "Quiet, premium, low-distraction coach landing page.",
    designStory: {
      bestFor: ["nutrition", "general wellness", "gut", "sleep", "premium personal coaches"],
      emotionalFeel: "quiet, confident, restrained, high-end",
      firstImpressionGoal: "quiet luxury and calm authority",
      notToLookLike: "default template with fewer colors",
      oneLine: "A typography-first quiet luxury wellness consultancy page.",
      sectionRhythm: "minimal spacious text-first rhythm",
      shouldAvoid: ["heavy glow", "aurora", "visual clutter"],
      uniqueSignature: "large whitespace, line cards, static texture, understated CTA.",
      visualReferenceType: "Aesop-like minimal consultancy page"
    },
    skinDesignContract: {
      backgroundLanguage: "static neutral texture and warm gradient only",
      bonusTreatment: "clean product list/cards",
      cardLanguage: "minimal divider cards with thin lines",
      coachMediaTreatment: "restrained portrait block",
      colorLanguage: "off-white, charcoal, beige, soft olive/teal",
      ctaLanguage: "simple confident dark CTA",
      faqTreatment: "text-only line accordion",
      footerTreatment: "minimal legal footer",
      heroComposition: "typography-first hero with calm portrait and whitespace",
      motionLanguage: "almost none, simple fade",
      navbarLanguage: "clean text-led nav",
      responsiveBehavior: "preserve readability without giant empty mobile screens",
      stickyCtaLanguage: "clean minimal CTA bar",
      surfaceLanguage: "flat refined cards and thin borders",
      typographyLanguage: "restrained, readable, whitespace-led hierarchy",
      visualMetaphor: "high-end minimal wellness consultancy"
    },
    colors: {
      background: "#f7f6f2",
      foreground: "#101514",
      primary: "#163a38",
      secondary: "#68756f",
      accent: "#9d8762",
      muted: "#63706d",
      card: "rgb(255 255 252 / 0.94)",
      cardForeground: "#101514",
      border: "rgb(22 58 56 / 0.18)",
      ctaGradient: "linear-gradient(90deg, #101514, #236d68)",
      glow: "rgb(22 58 56 / 0.14)"
    },
    background: {
      fallbackType: "static-gradient",
      intensity: 0.42,
      mobileIntensity: 0.32,
      mobileOpacity: 0.42,
      opacity: 0.54,
      performanceMode: "low",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "noise-texture"
    },
    layout: {
      benefitLayout: "minimalLineCards",
      bonusVariant: "minimalBonusListCards",
      cardStyle: "minimalDividerCard",
      coachMediaTreatment: "minimalPortraitBlock",
      ctaLayout: "minimalCta",
      faqVariant: "minimalAccordion",
      footerVariant: "minimalFooter",
      heroVariant: "minimalTextHero",
      mediaTreatment: "minimalPortraitBlock",
      navbarVariant: "minimalTextNav",
      sectionDividerStyle: "thinMinimalRule",
      sectionRhythm: "minimal-spacious-text-first",
      stickyCtaVariant: "minimalStickyCta"
    },
    motion: {
      cardHover: "subtle border darken",
      ctaInteraction: "simple press",
      level: "none",
      preset: "minimal-still",
      reducedMotionFallback: "already static",
      sectionReveal: "simple fade"
    },
    effects: {
      glass: false,
      glow: "none",
      animationMood: "static premium texture"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#9d8762",
      cardShape: "flat line card",
      description: "Warm neutral typography-first preview.",
      gradient: "linear-gradient(135deg, #f7f6f2, #e3eee9 64%, #101514)"
    },
    visualDifference: {
      evidence:
        "Minimal Premium strips down motion and glass, uses line cards, text-first hero, minimal FAQ, and quiet product cards.",
      minChangedCategories: 8,
      scores: {
        ...scores(3),
        motionPreset: 3
      }
    },
    typographyStyle: "minimal",
    cssVars: {
      "--yw-theme-1": "#f7f6f2",
      "--yw-theme-2": "#e3eee9",
      "--yw-theme-3": "#163a38",
      "--yw-theme-accent": "#9d8762",
      "--yw-theme-ink": "#101514",
      "--yw-theme-card": "rgb(255 255 252 / 0.94)",
      "--yw-theme-card-border": "rgb(22 58 56 / 0.18)",
      "--yw-theme-cta": "linear-gradient(90deg, #101514, #236d68)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(16 21 20 / 0.62), rgb(35 109 104 / 0.32))"
    }
  }),
  createSkin({
    id: "prism-aurora",
    name: "Prism Aurora",
    publicName: "Prism Aurora Immersive",
    previewLabel: "Prism Aurora",
    description:
      "Vivid controlled prism/aurora styling with premium glow and reduced-motion fallback.",
    mood: "High-energy prism color field without changing coach-site logic.",
    designStory: {
      bestFor: ["tech-forward coaches", "modern personal brands", "fitness/performance", "standout visuals"],
      emotionalFeel: "immersive, futuristic, vibrant, premium",
      firstImpressionGoal: "controlled luminous wellness-tech experience",
      notToLookLike: "default with aurora pasted behind it",
      oneLine: "A controlled prism light-field coach website.",
      sectionRhythm: "immersive luminous flow",
      shouldAvoid: ["readability loss", "mobile jank", "overpowering glow"],
      uniqueSignature: "prism light field, luminous edges, glow FAQ and bonus tiles.",
      visualReferenceType: "futuristic premium product page"
    },
    skinDesignContract: {
      backgroundLanguage: "prism/aurora CSS field with mesh fallback",
      bonusTreatment: "luminous prism product cards",
      cardLanguage: "glow tiles with gradient surfaces",
      coachMediaTreatment: "prism edge-lit cutout or framed media",
      colorLanguage: "deep navy, aqua, violet, magenta, controlled gold",
      ctaLanguage: "luminous high-contrast CTA",
      faqTreatment: "glow accordion panels",
      footerTreatment: "dark prism footer",
      heroComposition: "immersive full-width light field hero",
      motionLanguage: "controlled glow movement and card lift",
      navbarLanguage: "glass/prism nav",
      responsiveBehavior: "disable heavy effects and lower opacity on mobile",
      stickyCtaLanguage: "luminous CTA bar with reduced glow",
      surfaceLanguage: "luminous glass/gradient surfaces",
      typographyLanguage: "modern high-impact display",
      visualMetaphor: "futuristic wellness-tech light field"
    },
    colors: {
      background: "#effdff",
      foreground: "#07131c",
      primary: "#007f91",
      secondary: "#7455d6",
      accent: "#cdef63",
      muted: "#55707b",
      card: "rgb(8 49 62 / 0.82)",
      cardForeground: "#f6fffb",
      border: "rgb(205 239 99 / 0.32)",
      ctaGradient: "linear-gradient(90deg, #007f91, #21e6c1 58%, #7455d6)",
      glow: "rgb(116 85 214 / 0.26)"
    },
    background: {
      fallbackType: "mesh-gradient",
      intensity: 1.06,
      mobileIntensity: 0.62,
      mobileOpacity: 0.52,
      opacity: 0.88,
      performanceMode: "standard",
      reducedMotionFallback: "mesh-gradient",
      requiresReactBits: false,
      type: "prism"
    },
    layout: {
      benefitLayout: "prismTiles",
      bonusVariant: "prismGlowBonusCards",
      cardStyle: "prismGlowTile",
      coachMediaTreatment: "prismGlowFrame",
      ctaLayout: "prismCta",
      faqVariant: "glowAccordion",
      footerVariant: "prismFooter",
      heroVariant: "prismImmersiveHero",
      mediaTreatment: "prismGlowFrame",
      navbarVariant: "prismGlassNav",
      sectionDividerStyle: "luminousGradientDivider",
      sectionRhythm: "immersive-luminous",
      stickyCtaVariant: "prismStickyCta"
    },
    motion: {
      cardHover: "glow edge lift",
      ctaInteraction: "prism shine press",
      level: "dynamic",
      preset: "prism-drift",
      reducedMotionFallback: "static prism mesh",
      sectionReveal: "glow reveal"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "prism aurora sweep"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#cdef63",
      cardShape: "luminous prism tile",
      description: "Prism light field and glow tiles.",
      gradient: "linear-gradient(135deg, #007f91, #21e6c1 46%, #7455d6)"
    },
    visualDifference: {
      evidence:
        "Prism Aurora uses an immersive light-field hero, prism media frame, luminous cards, glow FAQ, and prism CTA.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "futuristic",
    cssVars: {
      "--yw-theme-1": "#cdef63",
      "--yw-theme-2": "#21e6c1",
      "--yw-theme-3": "#7455d6",
      "--yw-theme-accent": "#e7ff84",
      "--yw-theme-ink": "#07131c",
      "--yw-theme-card": "rgb(8 49 62 / 0.82)",
      "--yw-theme-card-border": "rgb(205 239 99 / 0.32)",
      "--yw-theme-cta": "linear-gradient(90deg, #007f91, #21e6c1 58%, #7455d6)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(0 127 145 / 0.58), rgb(116 85 214 / 0.38))"
    }
  }),
  createSkin({
    id: "performance-energy",
    name: "Performance Energy",
    publicName: "Performance Energy",
    previewLabel: "Performance",
    description:
      "Higher-contrast fitness/fat-loss/performance-friendly visual skin with stronger CTA contrast.",
    mood: "Sharper, brighter, action-led coach page.",
    designStory: {
      bestFor: ["fitness", "fat-loss habits", "strength", "habit/performance", "active lifestyle"],
      emotionalFeel: "bold, active, confident, practical",
      firstImpressionGoal: "premium movement/progress coaching page",
      notToLookLike: "default with orange or green accents",
      oneLine: "A bold action-oriented performance coaching visual system.",
      sectionRhythm: "compact dynamic angled rhythm",
      shouldAvoid: ["body shaming", "fake before/after", "aggressive medical claims"],
      uniqueSignature: "diagonal accents, grid glow, action cards, strong CTA.",
      visualReferenceType: "premium performance coaching site"
    },
    skinDesignContract: {
      backgroundLanguage: "dynamic grid glow and motion-line CSS field",
      bonusTreatment: "practical toolkit/action-resource cards",
      cardLanguage: "strong geometric cards with progress motifs",
      coachMediaTreatment: "bold action frame with dynamic accent line",
      colorLanguage: "high contrast teal, energy lime, yellow accent",
      ctaLanguage: "bold action CTA with strong contrast",
      faqTreatment: "bold accordion panels",
      footerTreatment: "clean strong footer",
      heroComposition: "action-oriented hero with dynamic accents",
      motionLanguage: "quick controlled snap and card lift",
      navbarLanguage: "bold compact nav",
      responsiveBehavior: "remove diagonal overflow risk and keep compact mobile rhythm",
      stickyCtaLanguage: "bold bottom action bar",
      surfaceLanguage: "structured dark cards and energetic light cards",
      typographyLanguage: "bold heading hierarchy and strong CTA labels",
      visualMetaphor: "movement/progress coaching website"
    },
    colors: {
      background: "#eefbf5",
      foreground: "#07100c",
      primary: "#06433f",
      secondary: "#008e72",
      accent: "#ffcf4a",
      muted: "#3d6860",
      card: "rgb(3 47 43 / 0.9)",
      cardForeground: "#f6fffa",
      border: "rgb(255 207 74 / 0.32)",
      ctaGradient: "linear-gradient(90deg, #063b3a, #00c4a8)",
      glow: "rgb(0 196 168 / 0.28)"
    },
    background: {
      fallbackType: "static-gradient",
      intensity: 0.98,
      mobileIntensity: 0.58,
      mobileOpacity: 0.5,
      opacity: 0.86,
      performanceMode: "standard",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "grid-glow"
    },
    layout: {
      benefitLayout: "performanceActionCards",
      bonusVariant: "performanceToolkitCards",
      cardStyle: "performanceActionCard",
      coachMediaTreatment: "performanceFrame",
      ctaLayout: "performanceCta",
      faqVariant: "boldAccordion",
      footerVariant: "performanceFooter",
      heroVariant: "performanceHero",
      mediaTreatment: "performanceFrame",
      navbarVariant: "performanceCompactNav",
      sectionDividerStyle: "diagonalEnergyDivider",
      sectionRhythm: "compact-dynamic-angled",
      stickyCtaVariant: "performanceStickyCta"
    },
    motion: {
      cardHover: "controlled snap lift",
      ctaInteraction: "press and slide",
      level: "dynamic",
      preset: "performance-snap",
      reducedMotionFallback: "static grid glow",
      sectionReveal: "quick controlled reveal"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "controlled kinetic glow"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#ffcf4a",
      cardShape: "strong angled card",
      description: "Grid glow, energetic cards, bold CTA.",
      gradient: "linear-gradient(135deg, #063b3a, #21e6c1 58%, #ffcf4a)"
    },
    visualDifference: {
      evidence:
        "Performance Energy changes silhouette through compact action rhythm, diagonal accents, grid glow, progress-style cards, and bold CTA/footer language.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "bold performance",
    cssVars: {
      "--yw-theme-1": "#b8ee62",
      "--yw-theme-2": "#21e6c1",
      "--yw-theme-3": "#00677c",
      "--yw-theme-accent": "#ffcf4a",
      "--yw-theme-ink": "#07100c",
      "--yw-theme-card": "rgb(3 47 43 / 0.9)",
      "--yw-theme-card-border": "rgb(255 207 74 / 0.32)",
      "--yw-theme-cta": "linear-gradient(90deg, #063b3a, #00c4a8)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(6 67 63 / 0.7), rgb(0 142 114 / 0.44))"
    }
  }),
  createSkin({
    id: "creator-brand",
    name: "Creator Brand",
    publicName: "Creator Brand Profile",
    previewLabel: "Creator",
    description:
      "Coach-centered personal-brand skin with bolder profile emphasis and polished brand contrast.",
    mood: "Creator-led profile page with premium wellness-tech structure.",
    designStory: {
      bestFor: ["personal coaches", "community coaches", "creator-led brands", "trust-led coach profiles"],
      emotionalFeel: "personal, polished, warm, trust-led",
      firstImpressionGoal: "premium personal brand coach page",
      notToLookLike: "default with a larger coach photo",
      oneLine: "A coach-first personal brand profile experience.",
      sectionRhythm: "profile-led story rhythm",
      shouldAvoid: ["invented testimonials", "fake credentials", "generic social clone"],
      uniqueSignature: "profile hero, story cards, coach resource framing, warm CTA.",
      visualReferenceType: "premium personal brand page"
    },
    skinDesignContract: {
      backgroundLanguage: "subtle profile glow and warm gradient",
      bonusTreatment: "coach resource cards from a profile ecosystem",
      cardLanguage: "profile/story cards with warm surfaces",
      coachMediaTreatment: "central profile card or strong avatar fallback",
      colorLanguage: "warm neutral/profile teal with champagne",
      ctaLanguage: "personal invitation CTA",
      faqTreatment: "friendly profile-style FAQ",
      footerTreatment: "profile-aware legal-safe footer",
      heroComposition: "coach profile central with signature program title",
      motionLanguage: "profile card lift and warm reveal",
      navbarLanguage: "profile/brand-led nav",
      responsiveBehavior: "profile card early, CTA clear, avoid clutter",
      stickyCtaLanguage: "coach-signature CTA bar",
      surfaceLanguage: "clean personal brand surfaces",
      typographyLanguage: "name/title-forward personal hierarchy",
      visualMetaphor: "premium personal brand profile"
    },
    colors: {
      background: "#eef8fb",
      foreground: "#101624",
      primary: "#123f59",
      secondary: "#2a7c86",
      accent: "#dfb941",
      muted: "#5a6d78",
      card: "rgb(13 46 63 / 0.86)",
      cardForeground: "#f5fbff",
      border: "rgb(223 185 65 / 0.28)",
      ctaGradient: "linear-gradient(90deg, #123f59, #19b9b1)",
      glow: "rgb(25 185 177 / 0.25)"
    },
    background: {
      fallbackType: "static-gradient",
      intensity: 0.78,
      mobileIntensity: 0.52,
      mobileOpacity: 0.54,
      opacity: 0.76,
      performanceMode: "low",
      reducedMotionFallback: "static-gradient",
      requiresReactBits: false,
      type: "spotlight"
    },
    layout: {
      benefitLayout: "creatorStoryCards",
      bonusVariant: "creatorResourceCards",
      cardStyle: "creatorProfileCard",
      coachMediaTreatment: "creatorProfileCard",
      ctaLayout: "creatorInvitationCta",
      faqVariant: "profileAccordion",
      footerVariant: "creatorFooter",
      heroVariant: "creatorProfileHero",
      mediaTreatment: "creatorProfileCard",
      navbarVariant: "creatorProfileNav",
      sectionDividerStyle: "profileStoryDivider",
      sectionRhythm: "profile-led-story",
      stickyCtaVariant: "creatorSignatureStickyCta"
    },
    motion: {
      cardHover: "profile card lift",
      ctaInteraction: "warm press",
      level: "soft",
      preset: "creator-profile-lift",
      reducedMotionFallback: "static profile glow",
      sectionReveal: "warm reveal"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "profile-led soft motion"
    },
    readiness: ready(),
    previewThumbnail: {
      accent: "#dfb941",
      cardShape: "profile card",
      description: "Coach-first profile layout with warm CTA.",
      gradient: "linear-gradient(135deg, #123f59, #19b9b1 62%, #dfb941)"
    },
    visualDifference: {
      evidence:
        "Creator Brand changes the page into a profile-led experience with story cards, creator nav, personal invitation CTA, and resource-style bonuses.",
      minChangedCategories: 8,
      scores: scores(3)
    },
    typographyStyle: "personal brand",
    cssVars: {
      "--yw-theme-1": "#d0f5f0",
      "--yw-theme-2": "#19b9b1",
      "--yw-theme-3": "#123f59",
      "--yw-theme-accent": "#dfb941",
      "--yw-theme-ink": "#101624",
      "--yw-theme-card": "rgb(13 46 63 / 0.86)",
      "--yw-theme-card-border": "rgb(223 185 65 / 0.28)",
      "--yw-theme-cta": "linear-gradient(90deg, #123f59, #19b9b1)",
      "--yw-theme-nav": "linear-gradient(94deg, rgb(18 63 89 / 0.7), rgb(42 124 134 / 0.42))"
    }
  })
];

const legacyThemeMap: Record<string, ActiveCoachTemplateThemeId> = {
  "apple-liquid-glass": "liquid-glass",
  "creator-brand-profile": "creator-brand",
  "dark-luxury-wellness": "dark-luxury",
  default: CANONICAL_COACH_TEMPLATE_THEME_ID,
  "editorial-wellness-journey": "editorial-wellness",
  "liquid-glass-health-tech": "liquid-glass",
  "minimal-premium-clarity": "minimal-premium",
  "premium-feminine": "soft-feminine",
  "premium-feminine-wellness": "soft-feminine",
  "prism-aurora-immersive": "prism-aurora",
  "soft-feminine-wellness": "soft-feminine"
};

function readCoachTemplateEnvFlag(name: string, defaultValue: boolean) {
  const envValue =
    typeof process === "undefined" || !process.env ? undefined : process.env[name];
  if (envValue === undefined || envValue === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(envValue.toLowerCase());
}

export function getCoachTemplateFeatureFlags(): CoachTemplateFeatureFlags {
  return {
    enableCoachTemplateSkins: readCoachTemplateEnvFlag("ENABLE_COACH_TEMPLATE_SKINS", true),
    enableHeavyMotionBackgrounds: readCoachTemplateEnvFlag(
      "ENABLE_HEAVY_MOTION_BACKGROUNDS",
      true
    ),
    enableReactBitsBackgrounds: readCoachTemplateEnvFlag(
      "ENABLE_REACT_BITS_BACKGROUNDS",
      true
    ),
    enableTemplateSkinDebugPanel: readCoachTemplateEnvFlag(
      "ENABLE_TEMPLATE_SKIN_DEBUG_PANEL",
      false
    ),
    enableWebglBackgrounds: readCoachTemplateEnvFlag("ENABLE_WEBGL_BACKGROUNDS", false)
  };
}

export const coachTemplateFeatureFlags = getCoachTemplateFeatureFlags();

export function isKnownCoachTemplateThemeId(value: unknown): value is CoachTemplateThemeId {
  return COACH_TEMPLATE_THEME_IDS.includes(value as CoachTemplateThemeId);
}

export function normalizeCoachTemplateThemeId(value: unknown): ActiveCoachTemplateThemeId {
  if (typeof value !== "string") return CANONICAL_COACH_TEMPLATE_THEME_ID;
  const normalized = value.trim().toLowerCase();
  if (isKnownCoachTemplateThemeId(normalized)) return normalized;
  return legacyThemeMap[normalized] || CANONICAL_COACH_TEMPLATE_THEME_ID;
}

export function getCoachTemplateTheme(value: unknown): CoachTemplateTheme {
  const id = normalizeCoachTemplateThemeId(value);
  return coachTemplateThemes.find((theme) => theme.id === id) || coachTemplateThemes[0];
}

export function getCoachTemplateCssVariables(value: unknown): Record<string, string> {
  return getCoachTemplateTheme(value).cssVars;
}

function getRegistryFeatureFlags(options: CoachTemplateRegistryOptions = {}) {
  return options.featureFlags || coachTemplateFeatureFlags;
}

export function getProductionReadyCoachTemplateThemes(
  options: CoachTemplateRegistryOptions = {}
) {
  const featureFlags = getRegistryFeatureFlags(options);
  if (!featureFlags.enableCoachTemplateSkins) {
    return coachTemplateThemes.filter((theme) => theme.id === CANONICAL_COACH_TEMPLATE_THEME_ID);
  }

  return coachTemplateThemes.filter((theme) => {
    if (theme.status === "production_ready") return true;
    return Boolean(options.includeInternal && theme.status !== "deprecated" && theme.status !== "hidden");
  });
}

export const productionReadyCoachTemplateThemes = getProductionReadyCoachTemplateThemes();

export function getSkinsForAdminSelector(options: CoachTemplateRegistryOptions = {}) {
  return getProductionReadyCoachTemplateThemes(options).filter((theme) => theme.visibleInAdmin);
}

export function getSkinsForShopSelector(options: CoachTemplateRegistryOptions = {}) {
  return getProductionReadyCoachTemplateThemes(options).filter((theme) => theme.visibleInShop);
}

export function getTemplateBackgroundConfig(
  value: unknown,
  options: CoachTemplateRegistryOptions = {}
): CoachTemplateBackgroundConfig {
  const theme = getCoachTemplateTheme(value);
  const background = coachTemplateBackgroundRegistry[theme.background.type];
  if (!background) return getCoachTemplateTheme(CANONICAL_COACH_TEMPLATE_THEME_ID).background;
  const featureFlags = getRegistryFeatureFlags(options);
  const shouldUseFallback =
    (theme.background.requiresReactBits && !featureFlags.enableReactBitsBackgrounds) ||
    (theme.background.performanceMode === "standard" && !featureFlags.enableHeavyMotionBackgrounds) ||
    (theme.background.type === "webgl-subtle" && !featureFlags.enableWebglBackgrounds);
  if (shouldUseFallback) {
    const fallbackType =
      coachTemplateBackgroundRegistry[theme.background.fallbackType]?.id ||
      coachTemplateBackgroundRegistry[background.fallback]?.id ||
      getCoachTemplateTheme(CANONICAL_COACH_TEMPLATE_THEME_ID).background.type;
    return {
      ...theme.background,
      intensity: Math.min(theme.background.intensity, 0.55),
      mobileIntensity: Math.min(theme.background.mobileIntensity, 0.4),
      performanceMode: theme.background.performanceMode === "disabled" ? "disabled" : "low",
      requiresReactBits: false,
      type: fallbackType
    };
  }
  return theme.background;
}

export function calculateVisualDifferenceScore(theme: CoachTemplateTheme) {
  const categories = Object.keys(theme.visualDifference.scores) as CoachTemplateVisualDifferenceCategory[];
  const changedCategories = categories.filter((category) => theme.visualDifference.scores[category] >= 2);
  const total = categories.reduce((sum, category) => sum + theme.visualDifference.scores[category], 0);

  return {
    changedCategories: changedCategories.length,
    max: categories.length * 3,
    requiredChangedCategories: theme.visualDifference.minChangedCategories,
    total
  };
}

export type CoachTemplateSkinValidationResult = {
  errors: string[];
  warnings: string[];
};

export function validateCoachTemplateSkinRegistry(
  themes: CoachTemplateTheme[] = coachTemplateThemes
): CoachTemplateSkinValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const bannedLiteral = /\b(yourfitness\.in|gyana-ranjan|gyana|forms\.gle|docs\.google\.com\/forms)\b/i;
  const requiredHighDifference: CoachTemplateVisualDifferenceCategory[] = [
    "backgroundType",
    "bonusVariant",
    "cardStyle",
    "faqVariant",
    "heroVariant",
    "mediaTreatment",
    "stickyCtaVariant"
  ];

  for (const theme of themes) {
    if (ids.has(theme.id)) errors.push(`Duplicate skin id: ${theme.id}`);
    ids.add(theme.id);
    if (names.has(theme.publicName)) errors.push(`Duplicate skin public name: ${theme.publicName}`);
    names.add(theme.publicName);

    if (!isKnownCoachTemplateThemeId(theme.id)) errors.push(`Unregistered active skin id: ${theme.id}`);
    if (!coachTemplateBackgroundRegistry[theme.background.type]) {
      errors.push(`${theme.id} references unsupported background ${theme.background.type}`);
    }
    if (!coachTemplateBackgroundRegistry[theme.background.reducedMotionFallback]) {
      errors.push(`${theme.id} references unsupported reduced-motion background ${theme.background.reducedMotionFallback}`);
    }
    if (!coachTemplateMotionPresets[theme.motion.preset]) {
      errors.push(`${theme.id} references unsupported motion preset ${theme.motion.preset}`);
    }
    if (!theme.designStory.oneLine || !theme.designStory.uniqueSignature) {
      errors.push(`${theme.id} is missing design story metadata`);
    }
    if (!theme.skinDesignContract.heroComposition || !theme.skinDesignContract.faqTreatment) {
      errors.push(`${theme.id} is missing skin design contract fields`);
    }
    if (!theme.previewThumbnail.gradient || !theme.previewThumbnail.description) {
      errors.push(`${theme.id} is missing preview thumbnail metadata`);
    }
    if (bannedLiteral.test(JSON.stringify(theme))) {
      errors.push(`${theme.id} includes banned hardcoded coach/domain/form literal`);
    }

    if (theme.status === "production_ready") {
      const readinessPasses =
        theme.readiness.qaStatus === "pass" &&
        theme.readiness.adminInspect === "pass" &&
        theme.readiness.shopInspect === "pass" &&
        theme.readiness.backgroundClickSafe &&
        theme.readiness.buildSafe &&
        theme.readiness.inspectSafe &&
        theme.readiness.mobileSafe &&
        theme.readiness.previewPublicParity &&
        theme.readiness.reducedMotionSafe &&
        theme.readiness.stickyCtaSafe;
      if (!readinessPasses) errors.push(`${theme.id} is production_ready without full readiness pass`);
    }

    if (theme.id !== CANONICAL_COACH_TEMPLATE_THEME_ID) {
      const score = calculateVisualDifferenceScore(theme);
      if (score.changedCategories < theme.visualDifference.minChangedCategories) {
        errors.push(`${theme.id} changes only ${score.changedCategories} visual categories`);
      }
      for (const category of requiredHighDifference) {
        if (theme.visualDifference.scores[category] < 2) {
          errors.push(`${theme.id} is clone-like in ${category}`);
        }
      }
      if (score.total < 28) warnings.push(`${theme.id} visual difference score is below ideal premium threshold`);
    }
  }

  if (!ids.has(CANONICAL_COACH_TEMPLATE_THEME_ID)) errors.push("Missing canonical fallback skin");
  for (const theme of themes) {
    if (!ids.has(theme.fallbackSkin)) errors.push(`${theme.id} fallback skin does not exist`);
  }

  return { errors, warnings };
}
