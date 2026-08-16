export const palette = {
  basalt: "#14252B",
  salt: "#EDF2ED",
  paper: "#FBFCF8",
  seaGlass: "#76B7A7",
  tide: "#1A5362",
  waypoint: "#F3B548",
  fog: "#D8E3DE",
} as const;

export const semanticTokens = {
  background: "var(--color-background)",
  foreground: "var(--color-foreground)",
  surface: "var(--color-surface)",
  surfaceMuted: "var(--color-surface-muted)",
  primary: "var(--color-primary)",
  primaryForeground: "var(--color-primary-foreground)",
  accent: "var(--color-accent)",
  border: "var(--color-border)",
  focus: "var(--color-focus)",
} as const;

export type Palette = typeof palette;
export type SemanticTokens = typeof semanticTokens;
