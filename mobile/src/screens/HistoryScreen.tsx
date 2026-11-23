import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { ScreenContainer } from "../components/ScreenContainer";
import { EmptyState, FullScreenModal, PrimaryButton, Text } from "../components/ui";
import { useTokens } from "../theme/tokens";
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
  const t = useTokens();

  return (
    <ScreenContainer>
      <FlatList
        data={trips}
        keyExtractor={(trip) => trip.id}
        contentContainerClassName="px-5 pb-8 pt-4 flex-grow"
        ListHeaderComponent={
          <Text tone="secondary" className="mb-3">
            Completed trips and receipts, stored on this phone.
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No completed trips"
            message="Finish a shopping trip and it will show up here."
          />
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => setOpenTrip(item)}
            accessibilityRole="button"
            android_ripple={{ color: t.line }}
            className={`min-h-16 flex-row items-center gap-3 py-3 ${index === trips.length - 1 ? "" : "border-b border-line dark:border-line-dark"}`}
          >
            <View className="flex-1">
              <Text>{item.storeName ?? "No store"}</Text>
              <Text variant="meta" tone="meta">
                {item.startedAt.toLocaleDateString()} · {item.purchaseCount} item
                {item.purchaseCount === 1 ? "" : "s"}
              </Text>
            </View>
            <Text className="font-medium">
              {formatMoney({ amountMinor: item.totalMinor, currency: item.currency ?? currency })}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View className="mt-8">
            <Text variant="label" tone="secondary">
              Receipts
            </Text>
            {receipts.length === 0 ? (
              <Text variant="meta" tone="meta" className="mt-1">
                Attach a receipt photo from an active trip to check what you paid against the
                shelf prices you recorded.
              </Text>
            ) : (
              receipts.map((receipt, index) => (
                <View
                  key={receipt.id}
                  className={`flex-row items-center gap-3 py-3 ${index === receipts.length - 1 ? "" : "border-b border-line dark:border-line-dark"}`}
                >
                  <View className="flex-1">
                    <Text>
                      {receipt.capturedAt?.toLocaleDateString() ?? "Receipt"} · {receipt.lineCount}{" "}
                      lines
                    </Text>
                    {receipt.overchargeMinor !== null && receipt.overchargeMinor > 0 ? (
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <Ionicons name="alert-circle-outline" size={14} color={t.cautionFg} />
                        <Text variant="meta" tone="caution" className="font-medium">
                          {formatMoney({ amountMinor: receipt.overchargeMinor, currency: receipt.currency })}{" "}
                          over the shelf prices
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-medium">
                    {formatMoney({ amountMinor: receipt.totalMinor ?? 0, currency: receipt.currency })}
                  </Text>
                </View>
              ))
            )}
          </View>
        }
      />

      {openTrip !== null ? (
        <TripDetailModal trip={openTrip} onClose={() => setOpenTrip(null)} />
      ) : null}
    </ScreenContainer>
  );
}

export function TripDetailModal({
  trip,
  onClose,
}: {
  trip: TripSummaryLine;
  onClose: () => void;
}) {
  const lines = getTripPurchases(getDatabase(), trip.id);
  const currency = trip.currency ?? getDefaultCurrency(getDatabase());

  return (
    <FullScreenModal onClose={onClose}>
      <View className="flex-1 px-5 pt-6">
        <Text variant="display">{trip.storeName ?? "No store"}</Text>
        <Text tone="meta" className="mt-1">
          {trip.startedAt.toLocaleDateString()}
          {trip.endedAt !== null
            ? ` – ${trip.endedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </Text>

        <FlatList
          data={lines}
          keyExtractor={(line) => line.id}
          className="mt-4 flex-1"
          ListEmptyComponent={<Text tone="meta">No purchases recorded.</Text>}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
              <View className="flex-1">
                <Text>{item.productName}</Text>
                <Text variant="meta" tone="meta">
                  × {item.quantity}
                </Text>
              </View>
              <Text>
                {formatMoney({ amountMinor: item.shelfPriceMinor * item.quantity, currency: item.currency })}
              </Text>
            </View>
          )}
        />

        <View className="flex-row items-baseline justify-between py-4">
          <Text tone="secondary">Total</Text>
          <Text variant="title" tone="brand">
            {formatMoney({ amountMinor: trip.totalMinor, currency })}
          </Text>
        </View>
        <View className="pb-4">
          <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </FullScreenModal>
  );
}
