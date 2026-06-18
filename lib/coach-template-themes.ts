export const CANONICAL_COACH_TEMPLATE_THEME_ID = "canonical-coach-site-template" as const;
export const DEFAULT_COACH_TEMPLATE_THEME_ID = CANONICAL_COACH_TEMPLATE_THEME_ID;

export const COACH_TEMPLATE_THEME_IDS = [CANONICAL_COACH_TEMPLATE_THEME_ID] as const;

export type ActiveCoachTemplateThemeId = (typeof COACH_TEMPLATE_THEME_IDS)[number];
export type CoachTemplateThemeId = ActiveCoachTemplateThemeId;

export type CoachTemplateTheme = {
  id: ActiveCoachTemplateThemeId;
  name: string;
  previewLabel: string;
  description: string;
  mood: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    muted: string;
    card: string;
    cardForeground: string;
    border: string;
    ctaGradient: string;
    glow: string;
  };
  effects: {
    glass: boolean;
    glow: "medium" | "none" | "soft";
    animationMood: string;
  };
  cssVars: Record<string, string>;
};

export const coachTemplateThemes: CoachTemplateTheme[] = [
  {
    id: CANONICAL_COACH_TEMPLATE_THEME_ID,
    name: "Canonical Coach-Site Template",
    previewLabel: "Canonical",
    description:
      "The single approved YW Nutritech coach referral template for all current and future normal coach sites.",
    mood: "Premium YW Nutritech coach referral with locked branding, responsive sticky CTA, and per-coach content slots.",
    fonts: {
      heading: "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
      body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    },
    colors: {
      background: "#fff8ef",
      foreground: "#171b2d",
      primary: "#111730",
      secondary: "#8e4968",
      accent: "#d8b56f",
      muted: "#665f70",
      card: "rgb(255 253 249 / 0.9)",
      cardForeground: "#171b2d",
      border: "rgb(200 184 255 / 0.22)",
      ctaGradient: "linear-gradient(135deg, #121936, #9b4d70 58%, #66519b)",
      glow: "rgb(200 184 255 / 0.28)"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "cinematic wellness-tech reveal"
    },
    cssVars: {
      "--template-bg":
        "radial-gradient(circle at 10% 4rem, rgb(200 184 255 / 0.2), transparent 21rem), radial-gradient(circle at 96% 28rem, rgb(245 215 223 / 0.34), transparent 24rem), linear-gradient(180deg, #fff8ef 0, #fffdf9 42rem, #f8f1f8 100%)",
      "--template-hero-bg":
        "linear-gradient(130deg, rgb(12 16 35 / 0.99), rgb(26 29 53 / 0.98) 58%, rgb(83 47 78 / 0.96))",
      "--template-ink": "#171b2d",
      "--template-inverted-ink": "#fffaf1",
      "--template-muted": "#665f70",
      "--template-muted-inverted": "rgb(255 255 255 / 0.74)",
      "--template-primary": "#111730",
      "--template-secondary": "#8e4968",
      "--template-accent": "#d8b56f",
      "--template-aqua": "#46bfc0",
      "--template-card": "rgb(255 253 249 / 0.9)",
      "--template-card-strong": "rgb(255 250 241 / 0.96)",
      "--template-card-border": "rgb(200 184 255 / 0.22)",
      "--template-section": "rgb(255 253 249 / 0.78)",
      "--template-cta": "linear-gradient(135deg, #121936, #9b4d70 58%, #66519b)",
      "--template-cta-text": "#fffaf1",
      "--template-shadow": "0 1.25rem 3.2rem rgb(23 27 45 / 0.11)",
      "--template-glow": "rgb(200 184 255 / 0.28)",
      "--template-nav": "rgb(12 16 35 / 0.68)",
      "--template-nav-mobile-base": "rgb(12 16 35 / 0.58)",
      "--template-nav-mobile": "linear-gradient(135deg, rgb(12 16 35 / 0.62), rgb(43 31 62 / 0.46))",
      "--template-nav-mobile-border": "rgb(216 181 111 / 0.36)",
      "--template-nav-mobile-ink": "#fffaf1",
      "--template-nav-mobile-polish":
        "linear-gradient(135deg, rgb(255 255 255 / 0.16), transparent 48%, rgb(216 181 111 / 0.12))",
      "--template-nav-mobile-rim": "rgb(255 250 241 / 0.12)",
      "--template-radius": "8px",
      "--template-heading-font":
        "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
      "--template-body-font": "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    }
  }
];

export function isKnownCoachTemplateThemeId(value: unknown): value is CoachTemplateThemeId {
  return COACH_TEMPLATE_THEME_IDS.includes(value as CoachTemplateThemeId);
}

export function normalizeCoachTemplateThemeId(value: unknown): ActiveCoachTemplateThemeId {
  void value;
  return CANONICAL_COACH_TEMPLATE_THEME_ID;
}

export function getCoachTemplateTheme(value: unknown): CoachTemplateTheme {
  const id = normalizeCoachTemplateThemeId(value);
  return coachTemplateThemes.find((theme) => theme.id === id) || coachTemplateThemes[0];
}

export function getCoachTemplateCssVariables(value: unknown): Record<string, string> {
  return getCoachTemplateTheme(value).cssVars;
}
