import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenContainer } from "../components/ScreenContainer";
import { EmptyState, PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import { listReceipts, type ReceiptSummaryLine } from "../db/repositories/receipts";
import {
  getTripPurchases,
  listTrips,
  type TripSummaryLine,
} from "../db/repositories/trips";
import { formatMoney } from "../utils/money";

export function HistoryScreen() {
  const [trips, setTrips] = useState<TripSummaryLine[]>(() =>
    listTrips(getDatabase(), { status: "completed" }),
  );
  const [receipts, setReceipts] = useState<ReceiptSummaryLine[]>(() =>
    listReceipts(getDatabase()),
  );
  const [openTrip, setOpenTrip] = useState<TripSummaryLine | null>(null);

  const refresh = useCallback(() => {
    setTrips(listTrips(getDatabase(), { status: "completed" }));
    setReceipts(listReceipts(getDatabase()));
  }, []);
  useFocusEffect(refresh);

  const currency = trips[0]?.currency ?? getDefaultCurrency(getDatabase());

  return (
    <ScreenContainer>
      <View className="flex-1 px-6 py-8">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">History</Text>
        <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Completed trips and purchases — all offline.
        </Text>

        <FlatList
          data={trips}
          keyExtractor={(trip) => trip.id}
          className="mt-4 flex-1"
          contentContainerClassName="pb-4"
          ListEmptyComponent={
            <EmptyState
              title="No completed trips"
              message="Finish a shopping trip and it will show up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setOpenTrip(item)}
              className="mb-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    {item.storeName ?? "No store"}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.startedAt.toLocaleDateString()} · {item.purchaseCount} item
                    {item.purchaseCount === 1 ? "" : "s"}
                  </Text>
                </View>
                <Text className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoney({
                    amountMinor: item.totalMinor,
                    currency: item.currency ?? currency,
                  })}
                </Text>
              </View>
            </Pressable>
          )}
        />

        <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Receipts
        </Text>
        {receipts.length === 0 ? (
          <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Attach a receipt photo from an active trip to verify prices against
            what you recorded on the shelf.
          </Text>
        ) : (
          <View className="mt-2">
            {receipts.map((receipt) => (
              <View
                key={receipt.id}
                className="mb-2 flex-row items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800"
              >
                <View className="flex-1">
                  <Text className="text-base text-slate-900 dark:text-slate-50">
                    {receipt.capturedAt?.toLocaleDateString() ?? "Receipt"} ·{" "}
                    {receipt.lineCount} lines
                  </Text>
                  {receipt.overchargeMinor !== null && receipt.overchargeMinor > 0 ? (
                    <Text className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      ⚠ {(receipt.overchargeMinor / 100).toFixed(2)} over recorded shelf
                      prices
                    </Text>
                  ) : null}
                </View>
                <Text className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatMoney({
                    amountMinor: receipt.totalMinor ?? 0,
                    currency: receipt.currency,
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text className="mt-2 text-center text-xs text-slate-400">
          Receipts and discrepancy reports arrive with the OCR milestone.
        </Text>
      </View>

      {openTrip !== null ? (
        <TripDetailModal trip={openTrip} onClose={() => setOpenTrip(null)} />
      ) : null}
    </ScreenContainer>
  );
}

function TripDetailModal({
  trip,
  onClose,
}: {
  trip: TripSummaryLine;
  onClose: () => void;
}) {
  const lines = getTripPurchases(getDatabase(), trip.id);
  const currency = trip.currency ?? getDefaultCurrency(getDatabase());

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white px-6 py-8 dark:bg-slate-900">
        <Text className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {trip.storeName ?? "No store"}
        </Text>
        <Text className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {trip.startedAt.toLocaleDateString()}
          {trip.endedAt !== null ? ` – ${trip.endedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </Text>

        <FlatList
          data={lines}
          keyExtractor={(line) => line.id}
          className="mt-4 flex-1"
          ListEmptyComponent={
            <Text className="text-slate-500 dark:text-slate-400">No purchases recorded.</Text>
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between border-b border-slate-100 py-3 dark:border-slate-800">
              <View className="flex-1">
                <Text className="text-base text-slate-900 dark:text-slate-50">
                  {item.productName}
                </Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400">
                  × {item.quantity}
                </Text>
              </View>
              <Text className="font-semibold text-slate-800 dark:text-slate-100">
                {formatMoney({
                  amountMinor: item.shelfPriceMinor * item.quantity,
                  currency: item.currency,
                })}
              </Text>
            </View>
          )}
        />

        <Text className="mt-2 text-right text-xl font-bold text-slate-900 dark:text-slate-50">
          {formatMoney({ amountMinor: trip.totalMinor, currency })}
        </Text>
        <View className="mt-4">
          <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
