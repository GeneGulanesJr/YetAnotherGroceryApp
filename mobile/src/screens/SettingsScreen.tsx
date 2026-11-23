import { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { Card, Chip, ListRow, PrimaryButton, Text } from "../components/ui";
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
