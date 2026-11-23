import { useEffect, useState, type ReactNode } from "react";
import { Appearance, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { vars } from "nativewind";

import { getDatabase } from "../db/database";
import { getMetaValue } from "../db/repositories/meta";
import { useAppStore } from "../store/useAppStore";
import { isDarkTheme, palettes, parseThemePreference, THEME_META_KEY, useTheme, type ThemeName } from "./tokens";

const kebab = (key: string) => key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`);
// "#FFD9EA" -> "255 217 234", the form tailwind's rgb(var(--x) / <alpha-value>) expects.
const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

const themeVars = Object.fromEntries(
  Object.entries(palettes).map(([name, palette]) => [
    name,
    vars(Object.fromEntries(Object.entries(palette).map(([key, hex]) => [`--${kebab(key)}`, channels(hex)]))),
  ]),
) as Record<ThemeName, ReturnType<typeof vars>>;

/**
 * Provides the active palette to every NativeWind class below it and keeps
 * the system UI in step: a pinned theme overrides the app's color scheme, so
 * the status bar, navigation bar, keyboard and dialogs match it.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  // Load the saved choice before the first paint, so a pinned theme does not flash.
  useState(() => useAppStore.getState().setTheme(parseThemePreference(getMetaValue(getDatabase(), THEME_META_KEY))));
  const pref = useAppStore((state) => state.theme);
  const { name, t } = useTheme();

  useEffect(() => {
    Appearance.setColorScheme(pref === "auto" ? "unspecified" : isDarkTheme(name) ? "dark" : "light");
  }, [pref, name]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.paper);
  }, [t.paper]);

  return (
    <View style={[{ flex: 1 }, themeVars[name]]}>
      <StatusBar style={isDarkTheme(name) ? "light" : "dark"} />
      {children}
    </View>
  );
}
