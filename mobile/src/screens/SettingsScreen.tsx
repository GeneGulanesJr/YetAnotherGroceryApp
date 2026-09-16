import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenContainer } from "../components/ScreenContainer";
import { PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import {
  getDefaultCurrency,
  getPendingMutationCount,
  setDefaultCurrency,
} from "../db/repositories/meta";

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CAD"] as const;

export function SettingsScreen() {
  const [currency, setCurrency] = useState(() => getDefaultCurrency(getDatabase()));
  const [pending, setPending] = useState(() => getPendingMutationCount(getDatabase()));

  const refreshPending = useCallback(
    () => setPending(getPendingMutationCount(getDatabase())),
    [],
  );
  useFocusEffect(refreshPending);

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
          Synchronization
        </Text>
        <View className="mt-2 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
          <Text className="text-base text-slate-800 dark:text-slate-100">
            {pending} change{pending === 1 ? "" : "s"} waiting to sync
          </Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            The sync backend ships in a later milestone. Every change is stored
            offline and journaled in the outbox, so nothing is lost.
          </Text>
          <View className="mt-3 opacity-50">
            <PrimaryButton label="Sync now (unavailable)" onPress={() => undefined} disabled />
          </View>
        </View>

        <Text className="mt-8 text-xs text-slate-400">
          YetAnotherGroceryApp 0.1.0 · offline-first · device-stored data only
        </Text>
      </View>
    </ScreenContainer>
  );
}
