import { FlatList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FullScreenModal, PrimaryButton, Text } from "./ui";
import { useTokens } from "../theme/tokens";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import type { ReceiptSummaryLine } from "../db/repositories/receipts";
import { getTripPurchases, type TripSummaryLine } from "../db/repositories/trips";
import { formatMoney } from "../utils/money";

/**
 * Receipts attached to runs, newest first, with any overcharge against the
 * recorded shelf prices (icon + words, never color alone).
 */
export function ReceiptList({ receipts }: { receipts: readonly ReceiptSummaryLine[] }) {
  const t = useTokens();
  return (
    <View>
      <Text variant="title" className="mb-1 mt-6 min-h-12 py-3">
        Receipts
      </Text>
      {receipts.length === 0 ? (
        <Text variant="meta" tone="meta" className="mt-1">
          Attach a receipt photo from an active run to check what you paid against the shelf
          prices you recorded.
        </Text>
      ) : (
        receipts.map((receipt, index) => (
          <View
            key={receipt.id}
            className={`flex-row items-center gap-3 py-3 ${index === receipts.length - 1 ? "" : "border-b-2 border-line"}`}
          >
            <View className="flex-1">
              <Text>
                {receipt.capturedAt?.toLocaleDateString() ?? "Receipt"} · {receipt.lineCount} lines
              </Text>
              {receipt.overchargeMinor !== null && receipt.overchargeMinor > 0 ? (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Ionicons name="alert-circle-outline" size={14} color={t.cautionFg} />
                  <Text variant="meta" tone="caution" className="font-semibold">
                    {formatMoney({ amountMinor: receipt.overchargeMinor, currency: receipt.currency })}{" "}
                    over the shelf prices
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="font-semibold">
              {formatMoney({ amountMinor: receipt.totalMinor ?? 0, currency: receipt.currency })}
            </Text>
          </View>
        ))
      )}
    </View>
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
            <View className="flex-row items-center gap-3 border-b-2 border-line py-3">
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
