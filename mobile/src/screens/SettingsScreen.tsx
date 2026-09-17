import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { ScreenContainer } from "../components/ScreenContainer";
import { PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import {
  getDefaultCurrency,
  getPendingMutationCount,
  setDefaultCurrency,
} from "../db/repositories/meta";
import { useAppStore } from "../store/useAppStore";
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
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">Settings</Text>

        <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Default currency
        </Text>
        <View className="mt-2 flex-row flex-wrap">
          {CURRENCIES.map((code) => (
            <Pressable
              key={code}
              onPress={() => changeCurrency(code)}
              className={`mr-2 mb-2 rounded-full px-3 py-1.5 ${currency === code ? "bg-teal-700" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <Text
                className={`text-sm font-medium ${currency === code ? "text-white" : "text-slate-800 dark:text-slate-200"}`}
              >
                {code}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Account
        </Text>
        <View className="mt-2">
          <PrimaryButton
            label="Sign in / manage account"
            variant="secondary"
            onPress={() => navigation.navigate("Auth")}
          />
        </View>

        <Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Synchronization
        </Text>
        <View className="mt-2 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
          <Text className="text-base text-slate-800 dark:text-slate-100">
            {pending} change{pending === 1 ? "" : "s"} waiting to sync
          </Text>
          {configured ? (
            <>
              <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Last sync:{" "}
                {lastSyncedAt === null ? "never" : new Date(lastSyncedAt).toLocaleString()}
                {syncStatus === "error" ? " · last run had errors" : ""}
              </Text>
              <View className="mt-3">
                <PrimaryButton
                  label={syncStatus === "syncing" ? "Syncing…" : "Sync now"}
                  onPress={() => void syncNow()}
                  loading={syncStatus === "syncing"}
                  disabled={syncStatus === "syncing"}
                />
              </View>
            </>
          ) : (
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No sync backend configured — everything stays on this device. The
              sync engine is ready; set `extra.apiBaseUrl` in app.json (or via
              EAS env) once the server ships.
            </Text>
          )}
        </View>

        <Text className="mt-8 text-xs text-slate-400">
          YetAnotherGroceryApp 0.1.0 · offline-first · device-stored data only
        </Text>
      </View>
    </ScreenContainer>
  );
}
