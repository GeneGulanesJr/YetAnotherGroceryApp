import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ScreenContainer } from "../components/ScreenContainer";
import { AppTextInput, EmptyState, Field, PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import { ensureStore, listStores } from "../db/repositories/stores";
import {
  cancelTrip,
  completeTrip,
  getActiveTrip,
  getTripPurchases,
  getTripStore,
  removePurchase,
  setPurchaseQuantity,
  startTrip,
  tripTotalMinor,
  type TripPurchaseLine,
} from "../db/repositories/trips";
import type { Store, Trip } from "../db/schema";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney } from "../utils/money";

type ShoppingNavigation = NativeStackNavigationProp<RootStackParamList>;

interface TripView {
  trip: Trip | null;
  store: Store | null;
  lines: TripPurchaseLine[];
  totalMinor: number;
}

function loadView(): TripView {
  const db = getDatabase();
  const trip = getActiveTrip(db) ?? null;
  if (trip === null) {
    return { trip: null, store: null, lines: [], totalMinor: 0 };
  }
  const lines = getTripPurchases(db, trip.id);
  return {
    trip,
    store: getTripStore(db, trip) ?? null,
    lines,
    totalMinor: tripTotalMinor(lines),
  };
}

/**
 * Shopping tab. The active trip lives in SQLite and is reloaded on every
 * focus — killing the app mid-trip loses nothing (spec requirement).
 */
export function ShoppingScreen({ navigation }: { navigation: ShoppingNavigation }) {
  const [view, setView] = useState<TripView>(() => loadView());
  const [startOpen, setStartOpen] = useState(false);
  const [summary, setSummary] = useState<{ items: number; totalMinor: number; currency: string } | null>(
    null,
  );

  // Stable identity or useFocusEffect re-runs every render (update loop).
  const refresh = useCallback(() => setView(loadView()), []);
  useFocusEffect(refresh);

  const finishTrip = () => {
    if (view.trip === null) {
      return;
    }
    setSummary({
      items: view.lines.length,
      totalMinor: view.totalMinor,
      currency: view.trip.currency ?? getDefaultCurrency(getDatabase()),
    });
    completeTrip(getDatabase(), view.trip.id);
    refresh();
  };

  const dropTrip = () => {
    if (view.trip === null) {
      return;
    }
    cancelTrip(getDatabase(), view.trip.id);
    refresh();
  };

  if (summary !== null) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            Trip complete
          </Text>
          <Text className="mt-3 text-lg text-slate-600 dark:text-slate-300">
            {summary.items} item{summary.items === 1 ? "" : "s"} ·{" "}
            {formatMoney({ amountMinor: summary.totalMinor, currency: summary.currency })}
          </Text>
          <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Saved offline. Receipt verification arrives with the OCR milestone.
          </Text>
          <View className="mt-8">
            <PrimaryButton label="Done" onPress={() => setSummary(null)} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (view.trip === null) {
    return (
      <ScreenContainer>
        <View className="flex-1 px-6 py-8">
          <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Shopping
          </Text>
          <Text className="mt-2 text-slate-600 dark:text-slate-300">
            No active trip. Start one, then scan shelf prices as you shop —
            everything works offline.
          </Text>
          <View className="mt-8">
            <PrimaryButton label="Start trip" onPress={() => setStartOpen(true)} />
            <View className="mt-3" />
            <PrimaryButton
              label="Scan a price without a trip"
              variant="secondary"
              onPress={() => navigation.navigate("Scanner")}
            />
          </View>
        </View>

        <StartTripModal
          visible={startOpen}
          onClose={() => setStartOpen(false)}
          onStarted={() => {
            setStartOpen(false);
            refresh();
          }}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-1 px-6 py-8">
        <Text className="text-xs font-medium uppercase tracking-wide text-teal-700 dark:text-teal-300">
          Active trip · started{" "}
          {view.trip.startedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
          {view.store?.name ?? "No store"}
          {view.store?.branch !== null && view.store?.branch !== undefined
            ? ` (${view.store.branch})`
            : ""}
        </Text>

        <FlatList
          data={view.lines}
          keyExtractor={(line) => line.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4"
          ListEmptyComponent={
            <EmptyState
              title="No items yet"
              message="Scan a barcode to capture prices and fill the trip."
            />
          }
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {item.productName}
                </Text>
                {item.productBrand !== null ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    {item.productBrand}
                    {item.packageSize !== null ? ` · ${item.packageSize} ${item.unit ?? ""}` : ""}
                  </Text>
                ) : null}
                <Text className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {formatMoney({ amountMinor: item.shelfPriceMinor, currency: item.currency })} ×{" "}
                  {item.quantity} ={" "}
                  {formatMoney({
                    amountMinor: item.shelfPriceMinor * item.quantity,
                    currency: item.currency,
                  })}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <QtyButton
                  label="−"
                  onPress={() => {
                    setPurchaseQuantity(getDatabase(), item.id, item.quantity - 1);
                    refresh();
                  }}
                />
                <QtyButton
                  label="+"
                  onPress={() => {
                    setPurchaseQuantity(getDatabase(), item.id, item.quantity + 1);
                    refresh();
                  }}
                />
                <QtyButton
                  label="✕"
                  onPress={() => {
                    removePurchase(getDatabase(), item.id);
                    refresh();
                  }}
                />
              </View>
            </View>
          )}
        />

        <View className="mt-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Text className="text-right text-xl font-bold text-slate-900 dark:text-slate-50">
            {formatMoney({
              amountMinor: view.totalMinor,
              currency: view.trip.currency ?? getDefaultCurrency(getDatabase()),
            })}
          </Text>
          <View className="mt-3 gap-3">
            <PrimaryButton label="Scan next item" onPress={() => navigation.navigate("Scanner")} />
            <PrimaryButton
              label="Attach receipt photo"
              variant="secondary"
              onPress={() =>
                navigation.navigate("ReceiptCapture", { tripId: view.trip?.id })
              }
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <PrimaryButton label="Complete trip" onPress={finishTrip} />
              </View>
              <View className="flex-1">
                <PrimaryButton label="Cancel trip" variant="danger" onPress={dropTrip} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

function QtyButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700"
    >
      <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">{label}</Text>
    </Pressable>
  );
}

function StartTripModal({
  visible,
  onClose,
  onStarted,
}: {
  visible: boolean;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [storeName, setStoreName] = useState("");
  const [branch, setBranch] = useState("");
  const stores = listStores(getDatabase());

  const start = () => {
    const db = getDatabase();
    const store =
      storeName.trim() === ""
        ? null
        : ensureStore(db, {
            name: storeName.trim(),
            branch: branch.trim() === "" ? null : branch.trim(),
          });
    startTrip(db, {
      storeId: store?.id ?? null,
      currency: getDefaultCurrency(db),
    });
    onStarted();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-white px-6 dark:bg-slate-900">
        <Text className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-50">
          Start a trip
        </Text>
        <Field label="Store">
          <AppTextInput
            value={storeName}
            onChangeText={setStoreName}
            placeholder="e.g. Save More"
            autoFocus
          />
        </Field>
        <Field label="Branch (optional)">
          <AppTextInput value={branch} onChangeText={setBranch} placeholder="e.g. Katipunan" />
        </Field>
        {stores.length > 0 ? (
          <View className="mb-4 flex-row flex-wrap">
            {stores.slice(0, 6).map((store) => (
              <Pressable
                key={store.id}
                onPress={() => {
                  setStoreName(store.name);
                  setBranch(store.branch ?? "");
                }}
                className="mr-2 mb-2 rounded-full bg-slate-200 px-3 py-1.5 dark:bg-slate-700"
              >
                <Text className="text-sm text-slate-800 dark:text-slate-200">
                  {store.name}
                  {store.branch !== null ? ` (${store.branch})` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <PrimaryButton label="Start" onPress={start} />
        <View className="mt-3" />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}
