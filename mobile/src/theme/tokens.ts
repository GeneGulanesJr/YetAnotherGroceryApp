export const colors = {
  light: {
    background: "#ffffff",
    surface: "#f8fafc",
    primary: "#0f766e",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    danger: "#dc2626",
    success: "#16a34a",
  },
  dark: {
    background: "#0f172a",
    surface: "#1e293b",
    primary: "#14b8a6",
    text: "#f8fafc",
    muted: "#94a3b8",
    border: "#334155",
    danger: "#f87171",
    success: "#4ade80",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeTokens = (typeof colors)["light"];
