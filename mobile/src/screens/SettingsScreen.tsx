import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { Card, Chip, ListRow, PrimaryButton, Text } from "../components/ui";
import { getDatabase } from "../db/database";
import {
  getDefaultCurrency,
  getPendingMutationCount,
  setDefaultCurrency,
  setMetaValue,
} from "../db/repositories/meta";
import { useAppStore } from "../store/useAppStore";
import {
  palettes,
  resolveTheme,
  THEME_META_KEY,
  THEME_PREFERENCES,
  useTheme,
  type ThemePreference,
} from "../theme/tokens";
import { syncConfigured, syncNow } from "../sync/client";
import type { RootStackParamList } from "../navigation/types";

type SettingsNavigation = NativeStackNavigationProp<RootStackParamList>;

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD"] as const;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigation>();
  const [currency, setCurrency] = useState(() => getDefaultCurrency(getDatabase()));
  const [pending, setPending] = useState(() => getPendingMutationCount(getDatabase()));
  const syncStatus = useAppStore((state) => state.syncStatus);
  const lastSyncedAt = useAppStore((state) => state.lastSyncedAt);
  const configured = syncConfigured();

  useFocusEffect(
    useCallback(() => {
      setPending(getPendingMutationCount(getDatabase()));
    }, []),
  );

  const changeCurrency = (next: string) => {
    setDefaultCurrency(getDatabase(), next);
    setCurrency(next);
    Alert.alert("Default currency", `New prices will be captured in ${next}.`);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Text variant="label" tone="secondary">
          Default currency
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-y-3">
          {CURRENCIES.map((code) => (
            <Chip
              key={code}
              label={code}
              selected={currency === code}
              onPress={() => changeCurrency(code)}
            />
          ))}
        </View>

        <Text variant="label" tone="secondary" className="mt-8">
          Theme
        </Text>
        <ThemePicker />

        <Text variant="label" tone="secondary" className="mt-8">
          Account
        </Text>
        <ListRow
          icon="person-circle-outline"
          title="Sign in or manage account"
          detail="Optional, for sync between devices"
          onPress={() => navigation.navigate("Auth")}
          last
        />

        <Text variant="label" tone="secondary" className="mb-2 mt-8">
          Synchronization
        </Text>
        <Card>
          <Text>
            {pending === 0
              ? "No changes waiting to sync"
              : `${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
          </Text>
          {configured ? (
            <>
              <Text variant="meta" tone="meta" className="mt-1">
                Last sync:{" "}
                {lastSyncedAt === null ? "never" : new Date(lastSyncedAt).toLocaleString()}
              </Text>
              {syncStatus === "error" ? (
                <Text variant="meta" tone="caution" className="mt-1">
                  The last sync had errors.
                </Text>
              ) : null}
              <View className="mt-3">
                <PrimaryButton
                  label={syncStatus === "syncing" ? "Syncing…" : "Sync now"}
                  icon="sync-outline"
                  onPress={() => void syncNow()}
                  loading={syncStatus === "syncing"}
                  disabled={syncStatus === "syncing"}
                />
              </View>
            </>
          ) : (
            <Text variant="meta" tone="meta" className="mt-1">
              No sync server is set up, so everything stays on this device. Set
              extra.apiBaseUrl in app.json (or via EAS env) once the server ships.
            </Text>
          )}
        </Card>

        <Text variant="meta" tone="meta" className="mt-8">
          YetAnotherGroceryApp 0.1.0. Offline first; data stays on this device.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const THEME_LABELS: Record<ThemePreference, string> = {
  auto: "Automatic",
  palengke: "Palengke",
  resibo: "Resibo",
  jadenight: "Jade night",
  bubblegum: "Bubblegum",
  cream: "Cream",
  night: "Night market",
};

/** One sticker button per preference; the choice applies at once and is saved on this phone. */
function ThemePicker() {
  const pref = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const { t, shadow } = useTheme();

  const choose = (next: ThemePreference) => {
    setMetaValue(getDatabase(), THEME_META_KEY, next);
    setTheme(next);
  };

  return (
    <View className="mt-3 flex-row flex-wrap justify-between gap-y-3">
      {THEME_PREFERENCES.map((option) => {
        const selected = option === pref;
        return (
          <Pressable
            key={option}
            onPress={() => choose(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityHint={option === "auto" ? "Palengke in light mode, Jade night in dark mode" : undefined}
            android_ripple={{ color: t.line }}
            style={{ boxShadow: selected ? shadow : undefined }}
            className={`min-h-14 w-[48%] flex-row items-center gap-2.5 overflow-hidden rounded-2xl border-outline px-3 py-2 ${selected ? "border-[3px] bg-card" : "border-2 bg-sand"}`}
          >
            <Swatch option={option} />
            <Text className={`flex-1 ${selected ? "font-extrabold" : "font-semibold"}`} numberOfLines={2}>
              {THEME_LABELS[option]}
            </Text>
            {selected ? <Ionicons name="checkmark-circle" size={20} color={t.ink} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The theme's paper ringed in the current outline; Automatic is half its light theme, half its dark theme. */
function Swatch({ option }: { option: ThemePreference }) {
  const halves =
    option === "auto" ? [palettes[resolveTheme("auto", "light")], palettes[resolveTheme("auto", "dark")]] : [palettes[option]];
  return (
    <View className="h-7 w-7 flex-row overflow-hidden rounded-full border-2 border-outline">
      {halves.map((palette) => (
        <View key={palette.paper} style={{ backgroundColor: palette.paper }} className="flex-1" />
      ))}
    </View>
  );
}
