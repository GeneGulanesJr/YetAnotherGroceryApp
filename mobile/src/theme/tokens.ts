import { useColorScheme } from "react-native";

import kami from "./kami.json";

/**
 * Design tokens derived from Kami (~/.claude/skills/kami): parchment paper,
 * one ink-blue accent kept to small areas, warm grays only, one serif in
 * weights 400/500, no bold, no italic, flat surfaces.
 *
 * Values live in kami.json, which tailwind.config.js also reads, so classes
 * (`bg-paper dark:bg-paper-dark`) and JS colors (icons, ripples, placeholders)
 * cannot drift apart.
 *
 * Light rungs are Kami's own: Parchment, Ivory, Warm Sand, Near Black, Olive,
 * Stone, Brand, Default tag, and the breaking-change caution pair.
 *
 * Deviation: Kami has no dark UI theme, but tech.mobile.md requires one. Dark
 * uses Kami's Deep Dark (#141413), Dark Surface (#30302e), Dark Warm (#3d3d3a)
 * and Ink Light (#2D5A8A, fills only), plus these registered values:
 * - ink2 #d1cfc5 / ink3 #a3a199: warm grays light enough for 4.5:1 body text on Deep Dark.
 * - brandText #9DB7D5: Ink Light is only 2.6:1 on Deep Dark, so accent text lifts it.
 * - tint #1f2d40: the Default tag (#E4ECF5) darkened to sit on Deep Dark.
 * - cautionBg #3b2a20 / cautionFg #e3b394: the caution pair inverted for dark.
 *
 * Status colors: caution (overcharge, error, mismatch) is the only second hue;
 * a good deal is shown with brand emphasis, never green.
 */
export const colors = kami;

export type ColorScheme = keyof typeof colors;
export type ThemeTokens = (typeof colors)["light"];

/** The one bundled serif (Source Serif 4, OFL-1.1), linked by the expo-font plugin. */
export const FONT_FAMILY = "Source Serif 4";

export function useTokens(): ThemeTokens {
  return colors[useColorScheme() === "dark" ? "dark" : "light"];
}
