export const DEFAULT_COACH_TEMPLATE_THEME_ID = "default-current";

export const COACH_TEMPLATE_THEME_IDS = [
  "default-current",
  "premium-feminine-wellness",
  "apple-liquid-glass",
  "dark-luxury-wellness"
] as const;

export type CoachTemplateThemeId = (typeof COACH_TEMPLATE_THEME_IDS)[number];

export type CoachTemplateTheme = {
  id: CoachTemplateThemeId;
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
    id: "default-current",
    name: "Template 1: Default Current Template",
    previewLabel: "Default",
    description: "Approved YW Nutritech coach referral theme with navy, rose, champagne, and lavender.",
    mood: "Premium, animated, YW Nutritech wellness-tech",
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
      "--template-radius": "8px",
      "--template-heading-font":
        "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
      "--template-body-font": "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    }
  },
  {
    id: "premium-feminine-wellness",
    name: "Premium Feminine Wellness",
    previewLabel: "Feminine Wellness",
    description: "Warm ivory, blush, dusty rose, lavender, peach, and champagne wellness theme.",
    mood: "Warm, feminine, elegant, supportive, trustworthy",
    fonts: {
      heading: "var(--font-display), var(--font-accent), Georgia, serif",
      body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    },
    colors: {
      background: "#fff8f3",
      foreground: "#2a1724",
      primary: "#9b2f5f",
      secondary: "#c8a6ff",
      accent: "#d8b56f",
      muted: "#7a6071",
      card: "rgb(255 253 249 / 0.92)",
      cardForeground: "#2a1724",
      border: "rgb(217 145 171 / 0.26)",
      ctaGradient: "linear-gradient(135deg, #9b2f5f, #d86f94 48%, #d8b56f)",
      glow: "rgb(245 181 201 / 0.34)"
    },
    effects: {
      glass: false,
      glow: "soft",
      animationMood: "soft fade-up with blush glow"
    },
    cssVars: {
      "--template-bg":
        "radial-gradient(circle at 12% 8rem, rgb(245 215 223 / 0.52), transparent 24rem), radial-gradient(circle at 88% 26rem, rgb(200 184 255 / 0.32), transparent 25rem), linear-gradient(180deg, #fff8f3 0, #fffdf9 48rem, #fff1f7 100%)",
      "--template-hero-bg": "linear-gradient(135deg, #fff8f3, #fff0f6 52%, #f6ecff)",
      "--template-ink": "#2a1724",
      "--template-inverted-ink": "#2a1724",
      "--template-muted": "#7a6071",
      "--template-muted-inverted": "#6f5365",
      "--template-primary": "#9b2f5f",
      "--template-secondary": "#c57491",
      "--template-accent": "#d8b56f",
      "--template-aqua": "#4fbfc0",
      "--template-card": "rgb(255 253 249 / 0.92)",
      "--template-card-strong": "rgb(255 247 250 / 0.96)",
      "--template-card-border": "rgb(217 145 171 / 0.26)",
      "--template-section": "rgb(255 253 249 / 0.82)",
      "--template-cta": "linear-gradient(135deg, #9b2f5f, #d86f94 48%, #d8b56f)",
      "--template-cta-text": "#fffdf9",
      "--template-shadow": "0 1.3rem 3.4rem rgb(155 47 95 / 0.11)",
      "--template-glow": "rgb(245 181 201 / 0.34)",
      "--template-nav": "rgb(255 253 249 / 0.72)",
      "--template-radius": "18px",
      "--template-heading-font": "var(--font-display), var(--font-accent), Georgia, serif",
      "--template-body-font": "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    }
  },
  {
    id: "apple-liquid-glass",
    name: "Apple Liquid Glass / YW Nutritech Health-Tech",
    previewLabel: "YW Nutritech Glass",
    description: "Pearl glass, deep navy, controlled aqua, violet, and champagne health-tech theme.",
    mood: "Clean, futuristic, precise, premium, nutrition-tech",
    fonts: {
      heading: "var(--font-tech-display), var(--font-body), ui-sans-serif, system-ui, sans-serif",
      body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    },
    colors: {
      background: "#f7fbff",
      foreground: "#101729",
      primary: "#101729",
      secondary: "#46bfc0",
      accent: "#b8a8ff",
      muted: "#5f6877",
      card: "rgb(255 255 255 / 0.58)",
      cardForeground: "#101729",
      border: "rgb(255 255 255 / 0.46)",
      ctaGradient: "linear-gradient(135deg, #101729, #218f9a 56%, #7c67d8)",
      glow: "rgb(70 191 192 / 0.28)"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "smooth glass reveal with light shimmer"
    },
    cssVars: {
      "--template-bg":
        "radial-gradient(circle at 12% 7rem, rgb(70 191 192 / 0.18), transparent 23rem), radial-gradient(circle at 88% 28rem, rgb(184 168 255 / 0.32), transparent 26rem), linear-gradient(180deg, #f7fbff 0, #fffdf9 44rem, #eef6ff 100%)",
      "--template-hero-bg": "linear-gradient(135deg, rgb(255 255 255 / 0.42), rgb(246 251 255 / 0.34)), linear-gradient(130deg, #101729, #1d2742 60%, #274e61)",
      "--template-ink": "#101729",
      "--template-inverted-ink": "#fffdf9",
      "--template-muted": "#5f6877",
      "--template-muted-inverted": "rgb(255 255 255 / 0.76)",
      "--template-primary": "#101729",
      "--template-secondary": "#218f9a",
      "--template-accent": "#b8a8ff",
      "--template-aqua": "#46bfc0",
      "--template-card": "rgb(255 255 255 / 0.58)",
      "--template-card-strong": "rgb(255 255 255 / 0.72)",
      "--template-card-border": "rgb(255 255 255 / 0.46)",
      "--template-section": "rgb(255 255 255 / 0.52)",
      "--template-cta": "linear-gradient(135deg, #101729, #218f9a 56%, #7c67d8)",
      "--template-cta-text": "#ffffff",
      "--template-shadow": "0 1.4rem 3.8rem rgb(16 23 41 / 0.13)",
      "--template-glow": "rgb(70 191 192 / 0.28)",
      "--template-nav": "rgb(255 255 255 / 0.42)",
      "--template-radius": "14px",
      "--template-heading-font":
        "var(--font-tech-display), var(--font-body), ui-sans-serif, system-ui, sans-serif",
      "--template-body-font": "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    }
  },
  {
    id: "dark-luxury-wellness",
    name: "Dark Luxury Wellness",
    previewLabel: "Dark Luxury",
    description: "Cinematic navy, charcoal, pearl, violet, rose, and champagne high-end theme.",
    mood: "High-end, bold, cinematic, luxury wellness",
    fonts: {
      heading: "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
      body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    },
    colors: {
      background: "#080b17",
      foreground: "#fffaf1",
      primary: "#fffaf1",
      secondary: "#9b4d70",
      accent: "#d8b56f",
      muted: "rgb(255 255 255 / 0.72)",
      card: "rgb(255 255 255 / 0.08)",
      cardForeground: "#fffaf1",
      border: "rgb(216 181 111 / 0.24)",
      ctaGradient: "linear-gradient(135deg, #6f54d5, #b75d78 50%, #d8b56f)",
      glow: "rgb(216 181 111 / 0.3)"
    },
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "cinematic reveal with restrained glow depth"
    },
    cssVars: {
      "--template-bg":
        "radial-gradient(circle at 10% 8rem, rgb(111 84 213 / 0.24), transparent 24rem), radial-gradient(circle at 88% 28rem, rgb(183 93 120 / 0.22), transparent 25rem), linear-gradient(180deg, #080b17 0, #111730 52rem, #170d1c 100%)",
      "--template-hero-bg": "linear-gradient(135deg, #080b17, #111730 56%, #321b38)",
      "--template-ink": "#fffaf1",
      "--template-inverted-ink": "#fffaf1",
      "--template-muted": "rgb(255 255 255 / 0.72)",
      "--template-muted-inverted": "rgb(255 255 255 / 0.72)",
      "--template-primary": "#fffaf1",
      "--template-secondary": "#b75d78",
      "--template-accent": "#d8b56f",
      "--template-aqua": "#46bfc0",
      "--template-card": "rgb(255 255 255 / 0.08)",
      "--template-card-strong": "rgb(255 255 255 / 0.1)",
      "--template-card-border": "rgb(216 181 111 / 0.24)",
      "--template-section": "rgb(255 255 255 / 0.07)",
      "--template-cta": "linear-gradient(135deg, #6f54d5, #b75d78 50%, #d8b56f)",
      "--template-cta-text": "#ffffff",
      "--template-shadow": "0 1.5rem 4rem rgb(0 0 0 / 0.28)",
      "--template-glow": "rgb(216 181 111 / 0.3)",
      "--template-nav": "rgb(8 11 23 / 0.72)",
      "--template-radius": "10px",
      "--template-heading-font":
        "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
      "--template-body-font": "var(--font-body), ui-sans-serif, system-ui, sans-serif"
    }
  }
];

export function normalizeCoachTemplateThemeId(value: unknown): CoachTemplateThemeId {
  return COACH_TEMPLATE_THEME_IDS.includes(value as CoachTemplateThemeId)
    ? (value as CoachTemplateThemeId)
    : DEFAULT_COACH_TEMPLATE_THEME_ID;
}

export function getCoachTemplateTheme(value: unknown): CoachTemplateTheme {
  const id = normalizeCoachTemplateThemeId(value);
  return coachTemplateThemes.find((theme) => theme.id === id) || coachTemplateThemes[0];
}

export function getCoachTemplateCssVariables(value: unknown): Record<string, string> {
  return getCoachTemplateTheme(value).cssVars;
}
