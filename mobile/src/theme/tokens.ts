import { useColorScheme, type ColorSchemeName } from "react-native";

import { useAppStore } from "../store/useAppStore";
import themes from "./themes.json";

/**
 * Sticker-wallet design tokens: six palettes (Palengke, Resibo and Jade night
 * match the jade logo; Bubblegum, Cream and Night market are the originals),
 * chunky Bricolage Grotesque, ink outlines and a hard offset shadow (none in
 * the dark themes). Every body-text pair is at least 4.5:1 (theme.test.ts).
 *
 * Values live in themes.json, which tailwind.config.js also reads: classes use
 * CSS variables that ThemeRoot sets for the active theme, so `bg-paper` follows
 * the theme and JS colors (icons, ripples, placeholders) come from useTokens().
 *
 * Status: cautionFg is the over-budget color, under the within-budget one.
 * Never use either alone: pair it with ▲/✓ and a word.
 */
export const palettes = themes.palettes;
export const moneyColors = themes.money;

export type ThemeName = keyof typeof palettes;
export type ThemePreference = "auto" | ThemeName;
export type ThemeTokens = (typeof palettes)["bubblegum"];

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "auto",
  "palengke",
  "resibo",
  "jadenight",
  "bubblegum",
  "cream",
  "night",
];

/** Dark themes: light status bar, dark navigation theme, no offset shadow. */
export function isDarkTheme(name: ThemeName): boolean {
  return name === "night" || name === "jadenight";
}

/** The one bundled face (Bricolage Grotesque, OFL-1.1, weights 400/600/800), linked by the expo-font plugin. */
export const FONT_FAMILY = "Bricolage Grotesque";

/** sync_meta key holding the preference (local only, never synced). */
export const THEME_META_KEY = "theme";

/** A stored value back to a preference; anything unknown means Automatic. */
export function parseThemePreference(value: string | null): ThemePreference {
  return THEME_PREFERENCES.find((pref) => pref === value) ?? "auto";
}

/** Automatic is Palengke in light mode (the in-store default) and Jade night in dark mode. */
export function resolveTheme(pref: ThemePreference, system: ColorSchemeName | null | undefined): ThemeName {
  if (pref !== "auto") {
    return pref;
  }
  return system === "dark" ? "jadenight" : "palengke";
}

export function useTheme(): { name: ThemeName; t: ThemeTokens; shadow: string | undefined } {
  const pref = useAppStore((state) => state.theme);
  const name = resolveTheme(pref, useColorScheme());
  const t = palettes[name];
  return { name, t, shadow: isDarkTheme(name) ? undefined : `3px 3px 0px ${t.outline}` };
}

export function useTokens(): ThemeTokens {
  return useTheme().t;
}
