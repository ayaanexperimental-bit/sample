export const designTokens = {
  colors: {
    background: "#ffffff",
    surface: "#f8faf9",
    surfaceStrong: "#edf3ef",
    text: "#1e2521",
    textMuted: "#637067",
    border: "#dbe4de",
    accent: "#1f7a5f",
    accentStrong: "#145943",
    danger: "#b42318",
    warning: "#b7791f",
    success: "#1f7a5f"
  },
  radii: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem"
  },
  layout: {
    containerMaxWidth: "72rem"
  }
} as const;

export type DesignTokens = typeof designTokens;
