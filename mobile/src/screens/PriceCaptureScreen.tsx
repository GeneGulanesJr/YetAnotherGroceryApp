import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppTextInput, Chip, Field, PrimaryButton } from "../components/ui";
import { getDatabase } from "../db/database";
import { getDefaultCurrency } from "../db/repositories/meta";
import { recordPrice } from "../db/repositories/prices";
import { addProductToTrip, getActiveTrip } from "../db/repositories/trips";
import type { RootStackParamList } from "../navigation/types";
import { formatMoney, parseMoney } from "../utils/money";

type PriceCaptureProps = NativeStackScreenProps<RootStackParamList, "PriceCapture">;

type PriceType = "regular" | "promotional" | "loyalty";

/**
 * Shelf-price capture (manual entry; OCR source arrives in the next
 * milestone). Prices are always captured per product+store+time and, when a
 * trip is active, the item is added to the running trip — a duplicate scan
 * increments the quantity (spec).
 */
export function PriceCaptureScreen({ navigation, route }: PriceCaptureProps) {
  const { productId, barcode, prefillAmount, ocrRawText, ocrConfidence, sourceImageId } =
    route.params;
  const [amount, setAmount] = useState(prefillAmount ?? "");
  const [priceType, setPriceType] = useState<PriceType>("regular");
  const [taxIncluded, setTaxIncluded] = useState(true);
  const currency = getDefaultCurrency(getDatabase());
  const tripActive = getActiveTrip(getDatabase()) !== undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const money = parseMoney(amount, currency);
    if (money.amountMinor <= 0) {
      setError("Enter the price printed on the shelf tag");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const db = getDatabase();
      recordPrice(db, {
        productId,
        storeId: null,
        currency: money.currency,
        // The schema requires regularPriceMinor; typed captures mirror into
        // it so unit-price math stays possible. The typed field is also set.
        regularPriceMinor: money.amountMinor,
        promotionalPriceMinor: priceType === "promotional" ? money.amountMinor : null,
        loyaltyPriceMinor: priceType === "loyalty" ? money.amountMinor : null,
        expectedCheckoutPriceMinor: money.amountMinor,
        taxIncluded,
        capturedAt: new Date(),
        sourceImageId: sourceImageId ?? null,
        ocrRawText: ocrRawText ?? null,
        ocrConfidence: ocrConfidence ?? null,
      });

      let addedToTrip = false;
      const trip = getActiveTrip(db);
      if (trip !== undefined) {
        addProductToTrip(db, {
          tripId: trip.id,
          productId,
          storeId: trip.storeId,
          currency: money.currency,
          shelfPriceMinor: money.amountMinor,
          expectedUnitPriceMinor: money.amountMinor,
          barcode: barcode ?? null,
        });
        addedToTrip = true;
      }

      setSaving(false);
      if (addedToTrip) {
        navigation.replace("Scanner");
      } else {
        navigation.goBack();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the price");
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-slate-900"
      contentContainerClassName="px-6 py-6"
      keyboardShouldPersistTaps="handled"
    >
      <Field label={`Price (${currency})`}>
        <AppTextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 123.45"
          autoFocus
        />
      </Field>

      <Field label="Price type">
        <View className="flex-row flex-wrap">
          <View className="mb-2">
            <Chip
              label="Regular"
              selected={priceType === "regular"}
              onPress={() => setPriceType("regular")}
            />
          </View>
          <View className="mb-2">
            <Chip
              label="Promo"
              selected={priceType === "promotional"}
              onPress={() => setPriceType("promotional")}
            />
          </View>
          <View className="mb-2">
            <Chip
              label="Loyalty"
              selected={priceType === "loyalty"}
              onPress={() => setPriceType("loyalty")}
            />
          </View>
        </View>
      </Field>

      <Field label="Tax included in this price?">
        <View className="flex-row flex-wrap">
          <View className="mb-2">
            <Chip label="Yes" selected={taxIncluded} onPress={() => setTaxIncluded(true)} />
          </View>
          <View className="mb-2">
            <Chip label="No" selected={!taxIncluded} onPress={() => setTaxIncluded(false)} />
          </View>
        </View>
      </Field>

      {amount.trim() !== "" ? (
        <Text className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Will be recorded as{" "}
          {formatMoney(parseMoney(amount, currency))}
        </Text>
      ) : null}

      {tripActive ? (
        <Text className="mb-4 text-sm font-medium text-teal-700 dark:text-teal-300">
          An active trip is running — this item will be added to it (scanning
          the same product again increases its quantity).
        </Text>
      ) : null}

      {error !== null ? (
        <Text className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</Text>
      ) : null}

      <PrimaryButton
        label={tripActive ? "Save and scan next item" : "Save price"}
        onPress={save}
        loading={saving}
      />
    </ScrollView>
  );
}
