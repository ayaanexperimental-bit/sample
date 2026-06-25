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

const sharedFonts = {
  heading: "var(--font-tech-display), var(--font-conversion), ui-sans-serif, system-ui, sans-serif",
  body: "var(--font-body), ui-sans-serif, system-ui, sans-serif"
};

function createTheme(
  theme: Omit<CoachTemplateTheme, "fonts">
): CoachTemplateTheme {
  return {
    ...theme,
    fonts: sharedFonts
  };
}

export const coachTemplateThemes: CoachTemplateTheme[] = [
  createTheme({
    id: CANONICAL_COACH_TEMPLATE_THEME_ID,
    name: "Default Canonical",
    previewLabel: "Default",
    description:
      "The protected YW Nutritech coach-site design. This remains the default and rollback skin.",
    mood: "Allia-inspired teal wellness-tech with glass navigation and premium coach-first sections.",
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
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "smooth Allia-style gradient motion"
    },
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
  createTheme({
    id: "editorial-wellness",
    name: "Editorial Wellness",
    previewLabel: "Editorial",
    description:
      "Ivory, teal, and champagne editorial styling over the same canonical coach-site structure.",
    mood: "Calm premium wellness publication with spacious cards and subtle gold details.",
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
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "quiet editorial wash"
    },
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
  createTheme({
    id: "liquid-glass",
    name: "Liquid Glass",
    previewLabel: "Liquid Glass",
    description:
      "Frosted-glass aqua and violet styling with a lightweight aurora background.",
    mood: "Health-tech glass, soft glow, and translucent UI surfaces.",
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
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "liquid aurora drift"
    },
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
  createTheme({
    id: "dark-luxury",
    name: "Dark Luxury",
    previewLabel: "Dark Luxury",
    description:
      "Deep navy wellness-luxury with champagne and rose accents, using the same renderer.",
    mood: "Premium dark coach brand with soft spotlight motion.",
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
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "dark spotlight"
    },
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
  createTheme({
    id: "soft-feminine",
    name: "Soft Feminine",
    previewLabel: "Soft Feminine",
    description:
      "Blush, ivory, lavender, and champagne styling. Copy stays data-driven and never assumes women-only.",
    mood: "Gentle premium wellness with soft cards and warm highlights.",
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
    effects: {
      glass: true,
      glow: "soft",
      animationMood: "soft blush gradient"
    },
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
  createTheme({
    id: "minimal-premium",
    name: "Minimal Premium",
    previewLabel: "Minimal",
    description:
      "Restrained whitespace-heavy visual skin with static texture and minimal motion.",
    mood: "Quiet, premium, low-distraction coach landing page.",
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
    effects: {
      glass: false,
      glow: "none",
      animationMood: "static premium texture"
    },
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
  createTheme({
    id: "prism-aurora",
    name: "Prism Aurora",
    previewLabel: "Prism Aurora",
    description:
      "Vivid controlled prism/aurora styling with premium glow and reduced-motion fallback.",
    mood: "High-energy prism color field without changing coach-site logic.",
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
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "prism aurora sweep"
    },
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
  createTheme({
    id: "performance-energy",
    name: "Performance Energy",
    previewLabel: "Performance",
    description:
      "Higher-contrast fitness/fat-loss/performance-friendly visual skin with stronger CTA contrast.",
    mood: "Sharper, brighter, action-led coach page.",
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
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "controlled kinetic glow"
    },
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
  createTheme({
    id: "creator-brand",
    name: "Creator Brand",
    previewLabel: "Creator",
    description:
      "Coach-centered personal-brand skin with bolder profile emphasis and polished brand contrast.",
    mood: "Creator-led profile page with premium wellness-tech structure.",
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
    effects: {
      glass: true,
      glow: "medium",
      animationMood: "profile-led soft motion"
    },
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
  "dark-luxury-wellness": "dark-luxury",
  default: CANONICAL_COACH_TEMPLATE_THEME_ID,
  "premium-feminine-wellness": "soft-feminine"
};

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
